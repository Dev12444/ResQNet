"""Geo helper tests (Task 3). Owner: BE1."""
import math

import pytest

from app.services import geo

CIVIL_HOSPITAL = (23.0536, 72.6037)
AKHBARNAGAR = (23.0588, 72.5620)


def test_zero_distance():
    assert geo.haversine_km(*AKHBARNAGAR, *AKHBARNAGAR) == 0.0


def test_one_degree_longitude_at_equator():
    assert geo.haversine_km(0, 0, 0, 1) == pytest.approx(2 * math.pi * 6371.0 / 360, rel=1e-9)


def test_known_city_distance():
    # London -> Paris is ~343.5 km great-circle.
    assert geo.haversine_km(51.5074, -0.1278, 48.8566, 2.3522) == pytest.approx(343.5, abs=0.5)


def test_ahmedabad_distance_is_symmetric_and_plausible():
    d1 = geo.haversine_km(*CIVIL_HOSPITAL, *AKHBARNAGAR)
    d2 = geo.haversine_km(*AKHBARNAGAR, *CIVIL_HOSPITAL)
    assert d1 == pytest.approx(d2) and 4.0 < d1 < 4.6


def test_antipodal_points_do_not_crash():
    assert geo.haversine_km(0, 0, 0, 180) == pytest.approx(math.pi * 6371.0, rel=1e-9)


@pytest.mark.parametrize(
    "coords",
    [(91, 0, 0, 0), (0, 181, 0, 0), (0, 0, -91, 0), (0, 0, 0, -181), (math.nan, 0, 0, 0), (0, math.inf, 0, 0)],
)
def test_invalid_coordinates_rejected(coords):
    with pytest.raises(ValueError):
        geo.haversine_km(*coords)


@pytest.mark.parametrize(
    ("distance", "kind", "expected"),
    [
        (10.0, "ambulance", 26),   # 10 * 1.35 = 13.5 km @ 35 km/h = 23.1 -> 24 + 2
        (2.4, "rescue_boat", 17),  # no road factor: 2.4 km @ 10 km/h = 14.4 -> 15 + 2
        (5.0, "fire_truck", 16),   # 6.75 km @ 30 = 13.5 -> 14 + 2
        (5.0, "police", 13),       # 6.75 km @ 40 = 10.1 -> 11 + 2
        (5.0, "ndrf_team", 19),    # 6.75 km @ 25 = 16.2 -> 17 + 2
        (5.0, "hazmat", 16),
        (0.0, "ambulance", 2),     # floor at MIN_ETA_MIN
        (0.01, "police", 3),       # any movement rounds up to a whole minute
    ],
)
def test_eta_minutes(distance, kind, expected):
    assert geo.eta_minutes(distance, kind) == expected


def test_eta_unknown_kind_uses_default_speed():
    assert geo.eta_minutes(5.0, "helicopter") == geo.eta_minutes(5.0, "fire_truck")


def test_eta_monotonic_in_distance():
    etas = [geo.eta_minutes(d / 2, "ambulance") for d in range(0, 60)]
    assert etas == sorted(etas)


def test_boat_slower_than_ambulance_over_same_distance():
    assert geo.eta_minutes(3.0, "rescue_boat") > geo.eta_minutes(3.0, "ambulance")


@pytest.mark.parametrize("distance", [-0.1, math.nan, math.inf])
def test_eta_invalid_distance_rejected(distance):
    with pytest.raises(ValueError):
        geo.eta_minutes(distance, "ambulance")


def test_eta_between():
    d = geo.haversine_km(*CIVIL_HOSPITAL, *AKHBARNAGAR)
    assert geo.eta_between(*CIVIL_HOSPITAL, *AKHBARNAGAR, "ambulance") == geo.eta_minutes(d, "ambulance")


def test_matches_be2_recommender_fallback_formula():
    """BE2's recommender used an identical fallback before geo.py existed; ETAs must not shift."""
    from app.services import recommender

    for kind in geo.SPEED_KMH:
        for d in (0.0, 0.3, 1.7, 4.2, 12.9):
            road = d * (1.0 if kind == "rescue_boat" else recommender.ROAD_FACTOR)
            legacy = max(2, math.ceil(road / recommender.SPEED_KMH[kind] * 60) + 2)
            assert geo.eta_minutes(d, kind) == legacy


def test_be2_services_now_use_be1_geo():
    from app.services import dedup, recommender

    assert recommender._eta_min(10.0, "ambulance") == geo.eta_minutes(10.0, "ambulance")
    assert dedup.haversine_km(*CIVIL_HOSPITAL, *AKHBARNAGAR) == geo.haversine_km(*CIVIL_HOSPITAL, *AKHBARNAGAR)
