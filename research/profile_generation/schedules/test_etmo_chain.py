import numpy as np
from .generator import _build_chain, _travel_duration
from .schema import Trip


class StubGrid:
    """Fixed 5km distance for every leg -- isolates the chain-ordering logic
    from the real H3 grid/POI lookup, which we don't need for this check."""
    def distance_km(self, origin, dest):
        return 5.0


def run_case(edep, work_dep, label):
    grid = StubGrid()
    home, school, work = "HOME", "SCHOOL", "WORK"

    edist = grid.distance_km(home, school)
    edur = _travel_duration(edist, "car")
    escort_trip = Trip(
        agent_id="TEST", activity_type="escort", origin_h3=home, dest_h3=school,
        mode="car", departure_min=edep, duration_min=edur,
        poi_name="", poi_lat=None, poi_lon=None,
    )
    escort_start_loc = school
    escort_start_free = escort_trip.departure_min + escort_trip.duration_min + 8.0

    intents = [{"type": "work", "dest": work, "dwell": 480.0,
                "dep_pref": work_dep, "poi": None}]
    pick_mode = lambda o, d, dist: "car"

    trips = _build_chain("TEST", home, intents, grid, pick_mode,
                         start_loc=escort_start_loc, start_free=escort_start_free,
                         prefix_trips=[escort_trip])

    seq = [(t.activity_type, t.origin_h3, t.dest_h3) for t in trips]
    print(f"{label}: gap={work_dep - escort_start_free:.1f} min -> {seq}")
    spurious_return = any(t.activity_type == "home" for t in trips)
    print("  spurious return-home inserted:", spurious_return)
    print()


run_case(edep=470.0, work_dep=500.0, label="normal case (edep min'd to work_dep-15)")
run_case(edep=470.0, work_dep=600.0, label="large gap -- work far after escort")