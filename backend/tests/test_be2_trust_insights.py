"""Trust (corroboration/conflicts) and operational insights. Owner: BE2."""
import os
from datetime import datetime, timedelta, timezone

os.environ["AI_ENABLED"] = "false"

from app.services import insights, trust  # noqa: E402
from tests.test_be2_routers import client  # noqa: E402,F401  (fixture)

NOW = datetime(2026, 9, 19, 9, 0, tzinfo=timezone.utc)


def rep(id, source="citizen", text="", mins_ago=5, reporter=None, incident_id=1, sensor=None, **ai):
    return {"id": id, "source": source, "text": text, "reporter": reporter, "incident_id": incident_id,
            "sensor": sensor, "created_at": NOW - timedelta(minutes=mins_ago), "ai_json": ai or None}


# ---------------- trust

def test_single_report_is_unverified():
    t = trust.incident_trust({"id": 1}, [rep(1, severity=4, type="flood")])
    assert t["verification"] == "unverified" and t["conflicts"] == [] and t["duplicate_state"] == "matched"


def test_two_independent_sources_corroborate_but_same_reporter_does_not():
    two = trust.incident_trust({"id": 1}, [rep(1, reporter="A", type="flood"), rep(2, "call", reporter="B", type="flood")])
    same = trust.incident_trust({"id": 1}, [rep(1, reporter="A"), rep(2, reporter="A")])
    assert two["verification"] == "corroborated" and two["sources"]["unique_sources"] == 2
    assert same["verification"] == "unverified" and same["duplicate_state"] == "possible_duplicate"


def test_field_report_verifies_and_sensor_corroborates():
    f = trust.incident_trust({"id": 1}, [rep(1), rep(2, "field")])
    s = trust.incident_trust({"id": 1}, [rep(1), rep(2, "sensor", sensor={
        "sensor_id": "VASNA-WL-01", "metric": "water_level_m", "value": 4.9, "threshold": 4.2, "unit": "m"})])
    assert f["verification"] == "verified"
    assert s["verification"] == "corroborated" and s["sensor_corroboration"]["sensor_id"] == "VASNA-WL-01"
    assert "4.9m against a 4.2m threshold" in s["sensor_corroboration"]["detail"]


def test_conflicts_people_severity_type_and_situation():
    reports = [
        rep(1, text="3 people trapped, water rising", mins_ago=9, people_affected_est=3, severity=4, type="flood"),
        rep(2, "call", text="about 12 people stuck", mins_ago=7, people_affected_est=12, severity=5, type="flood"),
        rep(3, text="small fire near the shop", mins_ago=6, severity=2, type="fire"),
        rep(4, "field", text="everyone rescued, water has receded", mins_ago=1, severity=2, type="flood"),
    ]
    t = trust.incident_trust({"id": 1}, reports)
    fields = {c["field"] for c in t["conflicts"]}
    assert fields == {"people_affected", "severity", "type", "situation"}
    people = next(c for c in t["conflicts"] if c["field"] == "people_affected")
    assert [c["value"] for c in people["claims"]] == ["3 people", "12 people"]
    assert people["claims"][1]["report_id"] == 2 and people["claims"][1]["at"].endswith("Z")
    assert t["verification"] == "conflicting" and t["duplicate_state"] == "review_required"


def test_close_estimates_are_not_conflicts():
    t = trust.incident_trust({"id": 1}, [rep(1, people_affected_est=3, severity=4), rep(2, people_affected_est=4, severity=5)])
    assert t["conflicts"] == []


# ---------------- insights

RES = [
    {"id": 1, "callsign": "NDRF-BOAT-01", "kind": "rescue_boat", "status": "available", "lat": 23.03, "lng": 72.577},
    {"id": 2, "callsign": "108-AMD-01", "kind": "ambulance", "status": "available", "lat": 23.05, "lng": 72.60},
    {"id": 3, "callsign": "HAZMAT-01", "kind": "hazmat", "status": "assigned", "lat": 23.0, "lng": 72.6},
]


def inc(id, type_, priority, mins_ago, status="new", lat=23.0588, lng=72.562, hazards=()):
    return {"id": id, "code": f"INC-{id:04d}", "type": type_, "priority": priority, "status": status, "lat": lat,
            "lng": lng, "hazards": list(hazards), "title": f"{type_} incident", "address": "Somewhere",
            "created_at": NOW - timedelta(minutes=mins_ago)}


def test_sla_breach_only_for_undispatched_over_limit():
    out = insights.sla_breaches([inc(1, "flood", "P1", 5), inc(2, "flood", "P1", 1),
                                 inc(3, "fire", "P1", 9, status="dispatched"), inc(4, "fire", "P2", 6)], NOW)
    ids = [x["id"] for x in out]
    assert ids == ["sla_breach:INC-0001", "sla_breach:INC-0004"]
    assert out[0]["severity"] == "critical" and "waited 300s" in out[0]["evidence"]
    assert out[1]["severity"] == "warning"


def test_shortage_counts_primary_need_vs_available():
    out = insights.shortages([inc(1, "industrial", "P1", 3), inc(2, "industrial", "P1", 2),
                              inc(3, "flood", "P1", 2)], RES)
    assert [x["id"] for x in out] == ["shortage:hazmat"]
    assert out[0]["severity"] == "critical" and "demand 2" in out[0]["evidence"] and "available 0 of 1" in out[0]["evidence"]


def test_coverage_gap_when_nearest_unit_far():
    far = inc(1, "flood", "P1", 1, lat=23.25, lng=72.70)  # ~27 km from the only boat
    near = inc(2, "flood", "P1", 1)
    out = insights.coverage_gaps([far, near], RES)
    assert [x["id"] for x in out] == ["coverage:INC-0001"] and "NDRF-BOAT-01" in out[0]["evidence"]


def test_trend_detects_surge():
    incidents = [inc(1, "flood", "P2", 30), inc(2, "flood", "P2", 3)]
    reports = [rep(i, mins_ago=m, incident_id=1 + i % 2) for i, m in enumerate([1, 2, 3, 4, 5, 6, 15], start=1)]
    out = insights.trends(incidents, reports, NOW)
    assert out and out[0]["id"] == "trend:flood" and "6 reports in last 10 min vs 1" in out[0]["evidence"]


def test_many_reports_about_one_incident_is_not_a_trend():
    incidents = [inc(1, "fire", "P1", 3)]
    reports = [rep(i, mins_ago=i) for i in range(1, 6)]
    assert insights.trends(incidents, reports, NOW) == []


def test_rain_gauge_corroborates_but_does_not_escalate():
    from app.services.classifier import classify_sensor
    rain = classify_sensor({"sensor_id": "PALDI-RG-02", "metric": "rainfall_mm_hr", "value": 68, "threshold": 50})
    level = classify_sensor({"sensor_id": "VASNA-WL-01", "metric": "water_level_m", "value": 5.3, "threshold": 4.2})
    assert rain.type == "flood" and rain.severity == 3 and rain.priority == "P2"
    assert level.severity == 5 and level.priority == "P1"


def test_compute_insights_sorted_and_includes_conflicts():
    incidents = [inc(1, "flood", "P1", 5), inc(2, "fire", "P3", 1)]
    reports = [rep(1, people_affected_est=2, incident_id=2), rep(2, people_affected_est=10, incident_id=2)]
    out = insights.compute_insights(incidents, reports, RES, now=NOW)
    kinds = [x["kind"] for x in out]
    assert kinds[0] == "sla_breach" and "conflict" in kinds
    assert all({"id", "kind", "severity", "headline", "detail", "evidence"} <= set(x) for x in out)


# ---------------- endpoints (real BE1 models when available)

def test_trust_and_insights_endpoints(client):  # noqa: F811
    t = client.get("/api/incidents/1/trust")
    assert t.status_code == 200 and t.json()["sources"]["reports"] == 2
    assert client.get("/api/incidents/999/trust").status_code == 404
    r = client.get("/api/analytics/insights")
    assert r.status_code == 200 and isinstance(r.json(), list)
    status = client.get("/api/ai/status").json()
    assert "embed_model" in status and "rpm_per_model" in status
    assert all(h["top_type"] for h in client.get("/api/analytics/hotspots").json())
