"""
Phase 2b — Realized household synthesis (V2.2).

Replaces the V2.1 design where home cells were drawn independently per agent and
"households" were inferred post-hoc from res-10 co-location (mean 24.6 agents/cell —
not households). Here households are FIRST-CLASS entities with linked members, one
shared home cell, and persistent work/school anchors, following Jiang et al. (2022).

Pipeline
────────
1. Assemble agents into households respecting each adult's household_composition tag
   and the available age pool (children 0–14 drawn from the child pool by role, not
   their own tag). Same-nationality preference (homophily); plausible age gaps for
   couples (≤15 yr) and parent–child (≥16 yr).
2. Assign ONE shared home H3 cell per household (existing residential prior).
3. Assign persistent anchors: work_h3 per employed adult (gravity from home),
   school_h3 per child (gravity for "education" from home), employer_id buckets.
4. Compute household economics: pooled net income, tenure, housing cost + burden,
   vehicles, parish.

All priors are config-grounded or clearly-labelled proxies. No LLM.

Outputs: list[dict] households; mutates each agent in place with household_id,
household_role, home_h3, parish, and (adult) work_h3/employer_id /(child) school_h3.
"""

from __future__ import annotations
import numpy as np

from config import ACTIVE_CONFIG

try:
    import h3 as _h3
    _H3_OK = True
except ImportError:
    _H3_OK = False

# ── Net monthly income midpoints per bracket (EUR) ────────────────────────────
# Derived from config.income_distribution bracket definitions (net €/month).
_INCOME_NET = {
    "precarious": 900, "low": 1150, "lower_middle": 1550, "middle": 2150,
    "upper_middle": 3000, "comfortable": 4750, "wealthy": 8000,
}
_INCOME_RANK = {k: i for i, k in enumerate(
    ["precarious", "low", "lower_middle", "middle", "upper_middle", "comfortable", "wealthy"])}

# ── Andorra parishes (approx centroids, WGS84) for home→parish assignment ──────
# Source: Govern d'Andorra parish geography (centroid approximations).
_PARISHES = {
    "Canillo":             (42.567, 1.600),
    "Encamp":              (42.536, 1.583),
    "Ordino":              (42.555, 1.533),
    "La Massana":          (42.545, 1.515),
    "Andorra la Vella":    (42.506, 1.521),
    "Sant Julià de Lòria": (42.464, 1.491),
    "Escaldes-Engordany":  (42.510, 1.538),
}

# ── Tenure prior by nationality × income tier ─────────────────────────────────
# Proxy [SAIG 2023 + housing-crisis context]: Andorrans and long-settled higher
# incomes skew owner; recent-immigrant / lower income skew renter; small social stock.
def _tenure(nat: str, inc_rank: int, rng) -> str:
    if nat == "Andorran":
        w = [0.62, 0.33, 0.05] if inc_rank >= 3 else [0.45, 0.50, 0.05]
    elif nat in ("Spanish", "French"):
        w = [0.45, 0.50, 0.05] if inc_rank >= 3 else [0.25, 0.70, 0.05]
    else:  # Portuguese / Other — predominantly renting labour migrants
        w = [0.30, 0.65, 0.05] if inc_rank >= 4 else [0.12, 0.83, 0.05]
    return ["owner", "renter", "social_housing"][int(rng.choice(3, p=w))]


def _haversine_km(a, b):
    import math
    R = 6371.0
    (la1, lo1), (la2, lo2) = a, b
    p1, p2 = math.radians(la1), math.radians(la2)
    dp = math.radians(la2 - la1); dl = math.radians(lo2 - lo1)
    h = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return R * 2 * math.asin(math.sqrt(h))


def _parish_of(lat: float, lon: float) -> str:
    return min(_PARISHES, key=lambda p: _haversine_km((lat, lon), _PARISHES[p]))


def _employer_id(work_h3: str, sector: str | None) -> str:
    """Local employer bucket = sector × work-cell coarsened to H3 res 9 (block,
    ~0.1 km²). H3 string prefixes are NOT valid parents (all Andorra cells share a
    long prefix), so use the real cell_to_parent — otherwise employers collapse to
    one giant per sector."""
    if work_h3 == "BORDER":
        return f"EMP-{(sector or 'NA')[:4]}-BORDER"
    bucket = work_h3
    if _H3_OK:
        try:
            bucket = _h3.cell_to_parent(work_h3, 9)
        except Exception:
            pass
    return f"EMP-{(sector or 'NA')[:4]}-{bucket}"


def _ll(h3_cell: str, grid_ll: dict):
    """(lat, lon) for an H3 cell — prefer the grid centroid, fall back to h3 lib."""
    if h3_cell in grid_ll:
        return grid_ll[h3_cell]
    if _H3_OK:
        try:
            la, lo = _h3.cell_to_latlng(h3_cell)
            return (la, lo)
        except Exception:
            pass
    return (42.50, 1.52)  # Andorra centroid fallback


# ── Household assembly ────────────────────────────────────────────────────────

def _compatible_partner(a: dict, candidates: list[dict]) -> int | None:
    """Index in candidates of an age-compatible same-nationality partner (≤15 yr gap)."""
    best, best_gap = None, 16
    for i, c in enumerate(candidates):
        if c["nationality"] != a["nationality"]:
            continue
        gap = abs(c["age"] - a["age"])
        if gap < best_gap:
            best, best_gap = i, gap
    if best is None and candidates:                 # relax nationality if needed
        best = int(np.argmin([abs(c["age"] - a["age"]) for c in candidates]))
    return best


def assemble_households(population: list[dict], rng_seed: int = 42) -> list[dict]:
    """
    Group agents into realized households. Returns the household list and mutates
    each agent with household_id and household_role. Anchors/economics are added
    by assign_anchors_and_economics().
    """
    rng = np.random.default_rng(rng_seed)

    adults   = [a for a in population if not a.get("is_minor", False)]
    children = [a for a in population if a.get("is_minor", False)]
    rng.shuffle(adults)
    rng.shuffle(children)

    by_id = {a["agent_id"]: a for a in population}
    used  = set()
    child_pool = list(children)          # consumed as families form
    ci = 0                               # child pool cursor
    households: list[dict] = []

    def take_children(n: int, nat: str) -> list[dict]:
        nonlocal ci
        out = []
        # prefer same-nationality children near the front of the remaining pool
        for _ in range(n):
            if ci >= len(child_pool):
                break
            # scan a small window for a same-nat child, else take next
            j = ci
            while j < min(ci + 25, len(child_pool)) and child_pool[j]["nationality"] != nat:
                j += 1
            if j >= len(child_pool):
                j = ci
            out.append(child_pool[j])
            # swap consumed child to cursor, advance
            child_pool[ci], child_pool[j] = child_pool[j], child_pool[ci]
            ci += 1
        return out

    hh_n = 0
    for a in adults:
        if a["agent_id"] in used:
            continue
        comp = a.get("household_composition") or "single"
        members = [a]
        roles = {a["agent_id"]: "head"}
        used.add(a["agent_id"])

        avail = [x for x in adults if x["agent_id"] not in used]

        if comp in ("couple_no_children", "couple_with_children"):
            pj = _compatible_partner(a, avail)
            if pj is not None:
                p = avail[pj]; members.append(p); roles[p["agent_id"]] = "partner"; used.add(p["agent_id"])
            if comp == "couple_with_children":
                kids = take_children(int(rng.integers(1, 4)), a["nationality"])  # 1–3
                for k in kids:
                    members.append(k); roles[k["agent_id"]] = "child"; used.add(k["agent_id"])

        elif comp == "single_parent":
            kids = take_children(int(rng.integers(1, 3)), a["nationality"])      # 1–2
            for k in kids:
                members.append(k); roles[k["agent_id"]] = "child"; used.add(k["agent_id"])

        elif comp == "multi_generational":
            # add a senior (or another adult) + 0–2 children
            seniors = [x for x in avail if x["age"] >= 60 and x["nationality"] == a["nationality"]]
            extra = seniors[0] if seniors else (avail[0] if avail else None)
            if extra is not None:
                members.append(extra)
                roles[extra["agent_id"]] = "grandparent" if extra["age"] >= 60 else "adult_child"
                used.add(extra["agent_id"])
            for k in take_children(int(rng.integers(0, 3)), a["nationality"]):
                members.append(k); roles[k["agent_id"]] = "child"; used.add(k["agent_id"])

        elif comp == "shared_accommodation":
            n_extra = int(rng.integers(1, 3))                                    # +1–2 → size 2–3
            same = [x for x in avail if x["nationality"] == a["nationality"]][:n_extra]
            for r in same:
                members.append(r); roles[r["agent_id"]] = "roommate"; used.add(r["agent_id"])
        # single → just [a]

        hh_id = f"HH-{hh_n:05d}"; hh_n += 1
        for m in members:
            m["household_id"]   = hh_id
            m["household_role"] = roles[m["agent_id"]]
            m["household_composition"] = comp
        households.append({
            "household_id": hh_id,
            "composition":  comp,
            "member_ids":   [m["agent_id"] for m in members],
            "member_roles": roles,
            "size":         len(members),
            "_head_id":     a["agent_id"],
        })

    # Any children not placed (pool > family demand): attach to a random family
    # household of the same nationality, else form single-parent stubs.
    leftover = child_pool[ci:]
    fam = [h for h in households if h["composition"] in
           ("couple_with_children", "single_parent", "multi_generational")]
    for k in leftover:
        if k.get("household_id"):
            continue
        cand = [h for h in fam if by_id[h["_head_id"]]["nationality"] == k["nationality"]] or fam
        if cand:
            h = cand[int(rng.integers(0, len(cand)))]
            k["household_id"] = h["household_id"]; k["household_role"] = "child"
            k["household_composition"] = h["composition"]
            h["member_ids"].append(k["agent_id"]); h["member_roles"][k["agent_id"]] = "child"
            h["size"] += 1

    return households


# ── Anchors + household economics ─────────────────────────────────────────────

def assign_anchors_and_economics(
    households: list[dict],
    population: list[dict],
    grid,                       # schedules.destination_model.H3Grid
    rng_seed: int = 42,
) -> None:
    """Assign shared home_h3, work/school anchors, employer_id, parish, tenure,
    pooled income, housing cost + burden, and vehicles. Mutates in place."""
    rng = np.random.default_rng(rng_seed + 7)
    by_id = {a["agent_id"]: a for a in population}
    grid_ll = {c["h3"]: (c["lat"], c["lon"]) for c in grid.cells}
    rent_lo, rent_hi = ACTIVE_CONFIG.rent_range

    for h in households:
        head = by_id[h["_head_id"]]
        nat  = head["nationality"]
        members = [by_id[mid] for mid in h["member_ids"]]

        # 1. Shared home cell (household-level residential prior)
        home_prefs = head.get("place_preferences")
        home = grid.home_cell(nat, head.get("income_bracket", "middle"), rng, housing_prefs=home_prefs)
        lat, lon = _ll(home, grid_ll)
        parish = _parish_of(lat, lon)

        # 2. Pooled net income (adults only) and income rank
        adult_incs = [_INCOME_NET.get(m.get("income_bracket", "middle"), 2150)
                      for m in members if not m.get("is_minor")]
        net_income = int(sum(adult_incs)) if adult_incs else 1550
        head_rank  = _INCOME_RANK.get(head.get("income_bracket", "middle"), 3)

        # 3. Tenure + housing cost + burden
        tenure = _tenure(nat, head_rank, rng)
        size_factor = 1.0 + 0.12 * max(0, h["size"] - 1)
        inc_factor  = 0.7 + 0.12 * head_rank
        if tenure == "renter":
            cost = int(np.clip(rng.normal((rent_lo + rent_hi) / 2, 200) * size_factor * inc_factor,
                               rent_lo * 0.7, rent_hi * 1.4))
        elif tenure == "social_housing":
            cost = int(rng.normal(550, 100) * size_factor)
        else:  # owner — imputed effective housing cost (mortgage/maintenance), lower burden
            cost = int(np.clip(rng.normal((rent_lo + rent_hi) / 2, 250) * 0.55 * size_factor,
                               300, rent_hi))
        burden = round(min(cost / max(net_income, 1), 1.5), 3)

        # 4. Vehicles (household level): income + size, gated by any licensed adult
        licensed = any(m.get("has_license") for m in members if not m.get("is_minor"))
        if not licensed:
            n_veh = 0
        else:
            p_two = 0.05 + 0.10 * head_rank
            if h["size"] >= 3 and head_rank >= 3 and rng.random() < p_two:
                n_veh = 2
            else:
                n_veh = 1 if rng.random() < (0.55 + 0.07 * head_rank) else 0

        # 5. Per-member anchors
        young_child = any(m.get("is_minor") and m["age"] < 6 for m in members)
        for m in members:
            m["home_h3"] = home
            m["parish"]  = parish
            m["household_has_young_children"] = young_child
            if m.get("is_minor"):
                # children: school anchor (gravity draw for education from home)
                if m.get("school_stage") != "nursery":
                    m["school_h3"] = grid.choose_destination(home, "education", 0.5, rng)
                else:
                    m["school_h3"] = grid.choose_destination(home, "grocery", 0.5, rng)  # nursery near home
                m["guardian_ids"] = [mm["agent_id"] for mm in members
                                     if not mm.get("is_minor") and mm.get("household_role") in ("head", "partner")]
            else:
                # adults: persistent work anchor for employed; cross-border → border marker
                from experiments.expand import _employed
                if _employed(m.get("employment_status", "")):
                    if m.get("is_cross_border"):
                        m["work_h3"] = "BORDER"           # external work node
                    else:
                        m["work_h3"] = grid.choose_destination(home, "work", 0.5, rng)
                    m["employer_id"] = _employer_id(m["work_h3"], m.get("work_sector"))
                else:
                    m["work_h3"] = None
                    m["employer_id"] = None

        h.update({
            "home_h3": home, "parish": parish, "tenure": tenure,
            "household_net_income_monthly": net_income,
            "housing_cost_monthly": int(cost), "housing_cost_burden": burden,
            "num_vehicles": int(n_veh),
            "num_children": sum(1 for m in members if m.get("is_minor")),
            "has_young_children": any(m.get("is_minor") and m["age"] < 6 for m in members),
        })
        h.pop("_head_id", None)

     # households.py — PCE: Psychometric Correlation Extension (V3.0 household extension)
#
# Applied AFTER assemble_households() + assign_anchors_and_economics(), since it
# requires household_role and household_composition to already be set.
#
# Fields use the same dotted-path convention as schema.py's NUMERICAL_FIELDS
# (e.g. "personality.agreeableness", "economic.financial_stress").
#
# Two of the four deltas from the original research design don't map onto real
# schema fields and were adapted here:
#   - Schwartz values are a ranked top-3 list of strings, not scored floats.
#     "high v_benevolence" is approximated as a step function on rank.
#   - There is no standalone "housing_salience" field. The closest real proxy
#     is issue_salience.housing (political salience of the housing issue),
#     which is related but not identical in meaning to general housing-market
#     pressure. Flagged here as a proxy, not an exact substitution.
#
# Citations: Mazzocco 2007; Schwartz 1992 + Bhat et al. 2007; McCrae & Costa 2003;
# EPF 2020 + SAIG 2023.


_BENEVOLENCE_WEIGHT = {"primary": 1.0, "secondary": 0.67, "tertiary": 0.33}


def _get_path(d: dict, path: str, default=None):
    """Read a dotted path like 'economic.financial_stress' from a nested dict."""
    parts = path.split(".")
    cur = d
    for p in parts:
        if not isinstance(cur, dict) or p not in cur:
            return default
        cur = cur[p]
    return cur


def _set_path(d: dict, path: str, value) -> None:
    """Write a dotted path like 'economic.financial_stress' into a nested dict."""
    parts = path.split(".")
    cur = d
    for p in parts[:-1]:
        cur = cur.setdefault(p, {})
    cur[parts[-1]] = value


def apply_pce(population: list[dict], households: list[dict]) -> int:
    """
    Apply the 4 PCE deltas to coupled agents only (household_role in head/partner
    within couple_no_children / couple_with_children households).
    Mutates population in place. Returns count of agents affected.
    """
    by_id = {a["agent_id"]: a for a in population}
    n_affected = 0

    for hh in households:
        if hh["composition"] not in ("couple_no_children", "couple_with_children"):
            continue

        partners = [by_id[mid] for mid in hh["member_ids"]
                    if hh["member_roles"].get(mid) in ("head", "partner")
                    and mid in by_id]
        if len(partners) != 2:
            continue  # skip incomplete/malformed households

        a, b = partners
        for agent, partner in ((a, b), (b, a)):

            # 1. Partner has high income -> own financial_stress DOWN
            #    [Mazzocco 2007]
            fs = _get_path(agent, "economic.financial_stress")
            p_income = partner.get("income_bracket")
            if fs is not None and p_income in _INCOME_RANK:
                p_rank_norm = _INCOME_RANK[p_income] / 6.0
                new_fs = float(np.clip(fs - 0.10 * p_rank_norm, 0.0, 1.0))
                _set_path(agent, "economic.financial_stress", new_fs)

            # 2. High v_benevolence -> escort_willingness UP
            #    [Schwartz 1992; Bhat et al. 2007]
            #    Schwartz values are a ranked top-3 list, not a score -- approximated
            #    as a step function on rank (primary=1.0, secondary=0.67, tertiary=0.33).
            sv = agent.get("schwartz_values", {})
            bw = 0.0
            for rank_key, weight in _BENEVOLENCE_WEIGHT.items():
                if sv.get(rank_key) == "benevolence":
                    bw = weight
                    break
            if bw > 0.0:
                agent.setdefault("escort_willingness", 0.5)
                agent["escort_willingness"] = float(np.clip(
                    agent["escort_willingness"] + 0.12 * bw, 0.0, 1.0))

            # 3. High agreeableness -> joint_activity_rate UP
            #    [McCrae & Costa 2003]
            agree = _get_path(agent, "personality.agreeableness")
            if agree is not None:
                agent.setdefault("joint_activity_rate", 0.5)
                agent["joint_activity_rate"] = float(np.clip(
                    agent["joint_activity_rate"] + 0.10 * agree, 0.0, 1.0))

            # 4. High housing salience -> coupled_residential_search UP
            #    [EPF 2020; SAIG 2023]
            #    PROXY: no standalone housing_salience field exists; using
            #    issue_salience.housing (political salience) as the closest
            #    available substitute. Not an exact match to the original design.
            hs = _get_path(agent, "issue_salience.housing")
            if hs is not None:
                agent.setdefault("coupled_residential_search", 0.5)
                agent["coupled_residential_search"] = float(np.clip(
                    agent["coupled_residential_search"] + 0.15 * hs, 0.0, 1.0))

            n_affected += 1

    return n_affected   

# ── MSUM: Marital Status Utility Modifier (V3.0) -- lambda_i (bargaining weight) ──
#
# Design doc Sec 2.2: U_HH(a) = lambda_i*U_i(a) + lambda_j*U_j(a) + gamma*1[joint(a)]
# For singles: U_HH(a) = U_i(a) -- no change, backward compatible (doc Sec 2.2).
#
# This function computes lambda_i only. gamma is NOT agent-derived -- it's a fixed
# constant (Meister et al. 2005, via Rezvany, Bierlaire & Hillel 2023 Table 6,
# alpha_jnt = 0.1), used later by the joint-tour probability logic in generator.py,
# not something to attach per-agent here.
#
# lambda_i = agent i's income / total household income (design doc, exact formula --
# no proxy needed; real per-agent income already exists via _INCOME_NET above).

_GAMMA_JOINT = 0.10  # Meister et al. 2005, via Rezvany et al. 2023, Table 6 (alpha_jnt)


def apply_msum_lambda(population: list[dict], households: list[dict]) -> int:
    """
    Attaches `lambda_bargaining` to each partner in a couple household.
    Runs on the same trigger condition as apply_pce(). Returns count of agents affected.
    """
    by_id = {a["agent_id"]: a for a in population}
    n_affected = 0

    for hh in households:
        if hh["composition"] not in ("couple_no_children", "couple_with_children"):
            continue

        partners = [by_id[mid] for mid in hh["member_ids"]
                    if hh["member_roles"].get(mid) in ("head", "partner")
                    and mid in by_id]
        if len(partners) != 2:
            continue  # skip incomplete/malformed households, same guard as apply_pce()

        a, b = partners
        inc_a = _INCOME_NET.get(a.get("income_bracket", "middle"), 2150)
        inc_b = _INCOME_NET.get(b.get("income_bracket", "middle"), 2150)
        total = inc_a + inc_b
        if total <= 0:
            continue

        a["lambda_bargaining"] = round(inc_a / total, 3)
        b["lambda_bargaining"] = round(inc_b / total, 3)
        n_affected += 2

    return n_affected
# ── MSUM: Married RUM Predictor (V3.0) -- place_preferences deltas ───────────
#
# Design doc Sec 2.2 specifies married as a direct RUM beta predictor for five
# destination layers (D21, D22, D16, D19, D23), with DIRECTION grounded in
# Koppelman & Bhat (2006) / MTUS W6 -- but no MAGNITUDE given, and the actual
# codebase has no RUM beta mechanism to insert into (place_preferences.py
# replaced that architecture with LLM-generated + validated preferences; see
# its module docstring). Implemented here instead as an additive delta
# correction, same pattern as apply_pce()'s four deltas, applied post-hoc to
# place_preferences for coupled agents.
#
# PLACEHOLDER MAGNITUDES -- directions are from the design doc's citation
# (Koppelman & Bhat 2006; MTUS W6), sizes are NOT sourced from either and are
# set here in the same range as PCE's existing deltas (0.05-0.12) purely as a
# reasonable placeholder. Replace with real coefficients if/when available.
#
# D4 Commercial is explicitly excluded -- the design doc describes it as an
# "interaction with work" (coupled commute / car-sharing scheduling), not a
# direct additive predictor like the other five. Left unresolved, not guessed.

_MARRIED_DELTAS: dict[str, float] = {
    "D21": +0.08,   # Restaurant -- joint leisure more common in couples [Koppelman & Bhat 2006]
    "D22": +0.06,   # Cafe -- joint discretionary trips [MTUS W6, Gershuny & Fisher 2014]
    "D16": +0.06,   # Recreation -- coupled joint tours [Vo et al. 2020]
    "D19": +0.05,   # Daycare -- dual-earner escort duties [Bhat et al. 2007]
    "D23": -0.05,   # Bar -- lower solo bar attendance in couple households [GS97]
}


def apply_msum_married_deltas(population: list[dict], households: list[dict]) -> int:
    """
    Applies placeholder married-status deltas to place_preferences for coupled
    agents. Same trigger condition as apply_pce() / apply_msum_lambda(). Returns
    count of agents affected.
    """
    by_id = {a["agent_id"]: a for a in population}
    n_affected = 0

    for hh in households:
        if hh["composition"] not in ("couple_no_children", "couple_with_children"):
            continue

        partners = [by_id[mid] for mid in hh["member_ids"]
                    if hh["member_roles"].get(mid) in ("head", "partner")
                    and mid in by_id]
        if len(partners) != 2:
            continue

        for agent in partners:
            prefs = agent.get("place_preferences")
            if not prefs:
                continue
            for did, delta in _MARRIED_DELTAS.items():
                if did in prefs:
                    prefs[did] = round(float(np.clip(prefs[did] + delta, 0.01, 0.99)), 3)
            n_affected += 1

    return n_affected