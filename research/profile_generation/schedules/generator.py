"""
Schedule generator (V2.2): builds a DailySchedule per agent from REALIZED
households and persistent anchors. Network and households already exist when this
runs (schedules are the LAST phase), so the schedule consumes structure rather
than inventing it.

Per-agent pipeline
──────────────────
ADULTS
  1. Home = the household's shared home_h3 (assigned in households.py).
  2. Work trip → the agent's persistent work_h3 anchor (NOT a fresh gravity draw).
     Cross-border workers (work_h3="BORDER") commute to the southern border cell.
  3. Escort trip → guardians of school-age children do a morning school drop-off.
  4. Discretionary trips (education/grocery/shopping/leisure/healthcare/civic) → gravity model,
     with a parenthood β multiplier (Macedo 2026: parents have a tighter radius).
CHILDREN (0–14)
  1. School trip → the child's school_h3 anchor (age ≥ 3), escorted in mode.
  2. One optional outdoor/park trip.

Dwell times (min, mean ± sd) — HETUS 2010 proxy; school/escort added for V2.2.
"""

import numpy as np
from .schema import Trip, DailySchedule
from .activity_model import generate_activity_counts
from .mode_model import choose_mode, sample_car_ownership
from .destination_model import H3Grid
from .temporal_model import sample_departure
from .osm_poi import PoiLookup
from .config import SPEED_KMH

_DWELL: dict[str, tuple[float, float]] = {
    "work":            (480.0, 60.0),
    "grocery":         ( 30.0, 10.0),
    "shopping":        ( 60.0, 20.0),
    "education":       (240.0, 60.0),
    "leisure_indoor":  ( 90.0, 30.0),
    "leisure_outdoor": (120.0, 45.0),
    "healthcare":      ( 45.0, 15.0),
    "civic":           ( 60.0, 20.0),
    "school":          (375.0, 45.0),   # child school day (~6 h)
    "escort":          (  8.0,  4.0),   # drop-off then leave
}
_MINUTES_PER_DAY = 1440.0

_ADULT_EMPLOYED = ("employed_full_time", "employed_part_time", "self_employed",
                   "full_time", "part_time")


def _travel_duration(dist_km: float, mode: str) -> float:
    speed = SPEED_KMH[mode].value
    return max((dist_km / speed) * 60.0, 1.0)


# Idle gap (minutes) above which the agent returns home between two activities,
# starting a new home-based tour instead of chaining directly.
_TOUR_GAP_MIN = 60.0


def _build_chain(agent_id, home, intents, grid, pick_mode,
                  start_loc=None, start_free=0.0, prefix_trips=None):
    """Build a COHERENT trip chain from time-ordered activity intents.

    Each intent: {type, dest, dwell, dep_pref, poi}. Trips chain location→location
    (origin = where the previous activity left the agent), never depart before the
    previous activity finishes (no time overlap), and a return-home is inserted when
    there is a long idle gap (a new home-based tour). The agent ends the day at home.
    This replaces the old hub-and-spoke design where every trip started from home and
    independent departure times produced overlapping, teleporting trips.
    """
    intents = sorted(intents, key=lambda a: a["dep_pref"])
    trips: list[Trip] = list(prefix_trips) if prefix_trips else []
    history: list[tuple[str, float, int]] = []
    loc  = start_loc if start_loc is not None else home
    free = start_free  # minute the agent becomes free at its current location

    def add(origin, activity, dest, dep, poi=None, state_before=None):
        """Append a trip and return its arrival minute, or None if it cannot fit in
        the day (so the caller skips it rather than clamping into the prior trip)."""
        dist = grid.distance_km(origin, dest)
        mode = pick_mode(origin, dest, dist)
        dur  = _travel_duration(dist, mode)
        dep  = max(dep, 0.0)
        if dep > _MINUTES_PER_DAY - dur - 1.0:
            return None
        if state_before is not None:
            history.append((state_before[0], state_before[1], len(trips)))
        trips.append(Trip(
            agent_id=agent_id, activity_type=activity, origin_h3=origin, dest_h3=dest,
            mode=mode, departure_min=dep, duration_min=dur,
            poi_name=poi.get("name", "") if poi else "",
            poi_lat=poi.get("lat") if poi else None,
            poi_lon=poi.get("lon") if poi else None,
        ))
        return dep + dur   # arrival minute

    for act in intents:
        # Return home first if a long idle gap precedes this activity (new tour).
        if loc != home and act["dep_pref"] - free > _TOUR_GAP_MIN:
            arr = add(loc, "home", home, free, state_before=(loc, free))
            if arr is not None:
                loc, free = home, arr
        arr = add(
            loc, act["type"], act["dest"], max(free, act["dep_pref"]),
            act.get("poi"), state_before=(loc, free)
        )
        if arr is None:
            continue   # doesn't fit; stay put and try later intents (day is filling up)
        free = arr + max(act["dwell"], 5.0)
        loc  = act["dest"]

    # The day should end at home. If the final return leg does not fit, remove the
    # latest accepted activity/tour leg and try again rather than leaving the agent
    # stranded away from home.
    while loc != home:
        arr = add(loc, "home", home, free, state_before=(loc, free))
        if arr is not None:
            break
        if not history:
            break
        prev_loc, prev_free, trip_len = history.pop()
        del trips[trip_len:]
        loc, free = prev_loc, prev_free
    return trips


def generate_schedules(
    population: list[dict],
    rng_seed: int = 42,
    households: list[dict] | None = None,
) -> list[DailySchedule]:
    rng    = np.random.default_rng(rng_seed)
    grid   = H3Grid()
    lookup = PoiLookup.load()
    if lookup.loaded:
        n_fac = sum(sum(len(v) for v in c.values()) for c in lookup._index.values())
        print(f"  POI index loaded ({n_fac} facilities)")
    else:
        print("  POI index not found — trips will use H3 centroid fallback")

    # Southern border cell proxy for cross-border commutes (toward La Seu d'Urgell).
    border_cell = min(grid.cells, key=lambda c: c["lat"])["h3"]

    # Guardian → child school anchor map (for escort trips). One drop-off per guardian.
    escort_target: dict[str, str] = {}
    for a in population:
        if a.get("is_minor") and a.get("school_h3") and a.get("school_stage") != "nursery":
            for g in (a.get("guardian_ids") or [])[:1]:   # primary guardian
                escort_target.setdefault(g, a["school_h3"])

    household_vehicles = {
        h.get("household_id"): int(h.get("num_vehicles", 0))
        for h in (households or [])
        if h.get("household_id")
    }

    schedules: list[DailySchedule] = []

    for i, agent in enumerate(population):
        agent_id = agent.get("agent_id", f"AG-{i:05d}")
        home     = agent.get("home_h3") or grid.home_cell(
            agent.get("nationality", "Other"), agent.get("income_bracket", "middle"), rng)
        trips: list[Trip] = []

        # ── Children ──────────────────────────────────────────────────────────
        if agent.get("is_minor"):
            school = agent.get("school_h3")
            stage  = agent.get("school_stage", "primary")
            intents: list[dict] = []
            if school and stage != "nursery":
                dm, ds = _DWELL["school"]
                intents.append({"type": "education", "dest": school,
                                "dwell": float(rng.normal(dm, ds)),
                                "dep_pref": float(np.clip(rng.normal(495, 20), 420, 540)),
                                "poi": lookup.sample(school, "education", rng)})
            elif school:   # nursery / daycare
                intents.append({"type": "education", "dest": school, "dwell": 300.0,
                                "dep_pref": float(np.clip(rng.normal(540, 30), 420, 600)),
                                "poi": lookup.sample(school, "education", rng)})
            if rng.random() < 0.35:   # optional afternoon park/outdoor trip
                dest = grid.choose_destination(home, "leisure_outdoor", 0.5, rng, beta_mult=1.3)
                dm, ds = _DWELL["leisure_outdoor"]
                intents.append({"type": "leisure_outdoor", "dest": dest,
                                "dwell": float(rng.normal(dm * 0.6, ds)),
                                "dep_pref": float(np.clip(rng.normal(960, 60), 780, 1140)),
                                "poi": lookup.sample(dest, "leisure_outdoor", rng)})
            child_mode = lambda o, d, dist: "walk" if dist < 1.0 else "bus"
            trips = _build_chain(agent_id, home, intents, grid, child_mode)
            schedules.append(DailySchedule(agent_id=agent_id, home_h3=home, trips=trips))
            continue

        # ── Adults ──────────────────────────────────────────────────────────────
        income   = agent.get("income_bracket", "middle")
        if household_vehicles:
            has_car = bool(agent.get("has_license") and
                           household_vehicles.get(agent.get("household_id"), 0) > 0)
        else:
            # Backward-compatible fallback for ad-hoc use before households exist.
            has_car = bool(agent.get("has_license") and sample_car_ownership(income, rng))
        prefs    = agent.get("place_preferences") or None
        counts   = generate_activity_counts(agent, rng, place_preferences=prefs)
        bridging = float(agent.get("social", {}).get("bridging_capital", 0.5))

        # parenthood β multiplier: tighter radius for parents of young children
        beta_mult = 1.35 if (agent.get("household_role") in ("head", "partner")
                             and agent.get("household_has_young_children")) else 1.0

        # mode is chosen per leg from the ACTUAL origin (transit coverage is local)
        adult_mode = lambda o, d, dist: choose_mode(
            agent, dist, grid.transit_coverage(o), has_car, rng)

        intents = []

        # Work → persistent anchor
        work_dep = None
        is_worker = agent.get("employment_status") in _ADULT_EMPLOYED and agent.get("work_h3")
        if is_worker:
            wdest = border_cell if agent.get("work_h3") == "BORDER" else agent["work_h3"]
            dm, ds = _DWELL["work"]
            work_dep = sample_departure("work", outbound=True, profile=agent, rng=rng)
            intents.append({"type": "work", "dest": wdest, "dwell": float(rng.normal(dm, ds)),
                            "dep_pref": work_dep, "poi": lookup.sample(wdest, "work", rng)})

        ## ETMO: Escort Trip Mandatory Override (Recker 1995 HAPP, simplified to a
        # deterministic rule per Rezvany et al. 2023 -- full MILP is computationally
        # impractical at 90K-agent scale; design doc §2.3). If this agent is the
        # primary guardian of a school-age dependent, the escort trip is forced into
        # the schedule FIRST -- inserted directly as trip #1, not passed through
        # _build_chain's soft fit-check, so it cannot be silently dropped.
        # Mode is car (design doc Q2 default for V3.0 -- no school-proximity data
        # sourced yet to support Bhat et al. 2007's distance/income mode split;
        # revisit if that becomes available).
        escort_start_loc, escort_start_free = home, 0.0
        escort_prefix = None
        if agent_id in escort_target:
            dm, ds = _DWELL["escort"]
            edep = float(np.clip(rng.normal(485, 15), 420, 540))
            if work_dep is not None:
                edep = min(edep, work_dep - 15.0)
            edest = escort_target[agent_id]
            edist = grid.distance_km(home, edest)
            edur  = _travel_duration(edist, "car")
            escort_trip = Trip(
                agent_id=agent_id, activity_type="escort", origin_h3=home, dest_h3=edest,
                mode="car", departure_min=max(edep, 0.0), duration_min=edur,
                poi_name="", poi_lat=None, poi_lon=None,
            )
            escort_prefix = [escort_trip]
            escort_start_loc = edest
            escort_start_free = escort_trip.departure_min + escort_trip.duration_min + float(rng.normal(dm, ds))

        # Discretionary activities (gravity from home, parenthood β)
        for activity in ("education", "grocery", "shopping", "leisure_indoor", "leisure_outdoor",
                         "healthcare", "civic"):
            for _ in range(counts.get(activity, 0)):
                dest = grid.choose_destination(home, activity, bridging, rng,
                                               place_preferences=prefs, beta_mult=beta_mult)
                dm, ds = _DWELL[activity]
                intents.append({"type": activity, "dest": dest,
                                "dwell": float(rng.normal(dm, ds)),
                                "dep_pref": sample_departure(activity, outbound=True,
                                                             profile=agent, rng=rng),
                                "poi": lookup.sample(dest, activity, rng)})

        trips = _build_chain(agent_id, home, intents, grid, adult_mode,
                             start_loc=escort_start_loc, start_free=escort_start_free,
                             prefix_trips=escort_prefix)
        schedules.append(DailySchedule(agent_id=agent_id, home_h3=home, trips=trips))

    return schedules

# ── MSUM: Joint Tour Probability for Coupled Agents (V3.0, design doc Sec 2.2) ──
#
# U_HH_joint - U_HH_solo = gamma exactly (the lambda-weighted U_i(a)/U_j(a) terms
# appear in both sides and cancel), so P(joint) = 1/(1+exp(-gamma)) is the same
# fixed probability for every coupled leisure trip -- gamma (0.10, Meister et al.
# 2005) is a flat constant in the source citation, not activity- or agent-dependent.
#
# Scope: leisure_indoor / leisure_outdoor only -- the closest real proxies to the
# design doc's D16/D21/D22/D23 cluster. generator.py has no "restaurant"/"cafe"/
# "bar" trip type (place_preferences.py's 26 D-layers don't map onto the
# discretionary-trip taxonomy used here); D19 daycare is out of scope, already
# handled by ETMO's escort logic, not the discretionary loop.
#
# Runs POST-HOC on already-built schedules: does not create new trips, only merges
# a same-day leisure_indoor/leisure_outdoor trip pair (one per partner) into a
# single shared destination/time when the joint draw succeeds.

_JOINT_ACTIVITY_TYPES = {"leisure_indoor", "leisure_outdoor"}


def apply_msum_joint_tours(
    schedules: list[DailySchedule],
    households: list[dict],
    rng_seed: int = 42,
) -> int:
    """MSUM Step 4c: merge coupled agents' independent leisure trips into joint
    tours with probability 1/(1+exp(-gamma)). Mutates schedules in place. Returns
    count of trips converted to joint."""
    from households import _GAMMA_JOINT  # local import, avoids circular dependency

    rng = np.random.default_rng(rng_seed + 13)
    p_joint = 1.0 / (1.0 + np.exp(-_GAMMA_JOINT))

    by_agent = {s.agent_id: s for s in schedules}
    n_joint = 0

    for hh in households:
        if hh["composition"] not in ("couple_no_children", "couple_with_children"):
            continue
        partner_ids = [mid for mid in hh["member_ids"]
                       if hh["member_roles"].get(mid) in ("head", "partner")]
        if len(partner_ids) != 2:
            continue
        s_a, s_b = by_agent.get(partner_ids[0]), by_agent.get(partner_ids[1])
        if s_a is None or s_b is None:
            continue

        trips_a = [t for t in s_a.trips if t.activity_type in _JOINT_ACTIVITY_TYPES]
        trips_b = [t for t in s_b.trips if t.activity_type in _JOINT_ACTIVITY_TYPES]

        for ta in trips_a:
            matched = False
            for tb in trips_b:
                if tb.dest_h3 == ta.dest_h3 and tb.departure_min == ta.departure_min:
                    matched = True
                    break
            if matched or not trips_b:
                continue
            if rng.random() < p_joint:
                tb = trips_b[0]
                tb.dest_h3 = ta.dest_h3
                tb.origin_h3 = ta.origin_h3
                tb.mode = ta.mode
                tb.departure_min = ta.departure_min
                tb.duration_min = ta.duration_min
                n_joint += 1

    return n_joint