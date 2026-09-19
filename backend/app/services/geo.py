"""Distance + ETA helpers. Owner: BE1 (used by BE2's recommender and dedup).

Contract §5:
    haversine_km(lat1, lng1, lat2, lng2) -> float
    eta_minutes(distance_km, kind) -> int

ETA model (PRD FR-4, no routing engine): straight-line distance x road factor
at an average monsoon-traffic speed per unit kind, plus crew turnout time.
Boats travel along the river/flooded streets, so no road factor for them.
Geocoding of free text lives in BE2's services/gazetteer.py (used by triage).
"""
from __future__ import annotations

import math

EARTH_RADIUS_KM = 6371.0

# Average urban speeds (km/h) incl. monsoon traffic.
SPEED_KMH: dict[str, float] = {
    "ambulance": 35,
    "fire_truck": 30,
    "police": 40,
    "rescue_boat": 10,
    "ndrf_team": 25,
    "hazmat": 30,
}
DEFAULT_SPEED_KMH = 30.0
ROAD_FACTOR = 1.35  # straight line -> typical road distance in Ahmedabad
NO_ROAD_FACTOR_KINDS = frozenset({"rescue_boat"})
TURNOUT_MIN = 2  # time for the crew to get rolling
MIN_ETA_MIN = 2


def _check_coord(lat: float, lng: float) -> None:
    if not (math.isfinite(lat) and math.isfinite(lng)):
        raise ValueError(f"coordinates must be finite numbers, got ({lat}, {lng})")
    if not (-90.0 <= lat <= 90.0 and -180.0 <= lng <= 180.0):
        raise ValueError(f"coordinates out of range: ({lat}, {lng})")


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in km between two WGS84 points. Raises ValueError on invalid coordinates."""
    _check_coord(lat1, lng1)
    _check_coord(lat2, lng2)
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(min(1.0, math.sqrt(a)))


def speed_kmh(kind: str) -> float:
    """Average speed for a resource kind; unknown kinds get a conservative default."""
    return SPEED_KMH.get(kind, DEFAULT_SPEED_KMH)


def eta_minutes(distance_km: float, kind: str) -> int:
    """Estimated minutes for a unit of `kind` to cover a straight-line `distance_km`.

    Always >= MIN_ETA_MIN. Raises ValueError for negative or non-finite distance.
    """
    if not math.isfinite(distance_km) or distance_km < 0:
        raise ValueError(f"distance_km must be a non-negative finite number, got {distance_km}")
    factor = 1.0 if kind in NO_ROAD_FACTOR_KINDS else ROAD_FACTOR
    travel_min = math.ceil(distance_km * factor / speed_kmh(kind) * 60)
    return max(MIN_ETA_MIN, travel_min + TURNOUT_MIN)


def eta_between(lat1: float, lng1: float, lat2: float, lng2: float, kind: str) -> int:
    """ETA in minutes for a unit of `kind` at (lat1, lng1) to reach (lat2, lng2)."""
    return eta_minutes(haversine_km(lat1, lng1, lat2, lng2), kind)
