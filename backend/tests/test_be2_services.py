"""BE2 unit tests — run offline (AI disabled) so they are fast and deterministic. Owner: BE2."""
import os
from datetime import datetime, timedelta, timezone

os.environ["AI_ENABLED"] = "false"

from app.routers import analytics  # noqa: E402
from app.services import classifier, dedup, recommender, summarizer  # noqa: E402
from app.services.gazetteer import geocode  # noqa: E402

NOW = datetime.now(timezone.utc)


# ---------------- classifier

def test_gujarati_trapped_flood_is_p1():
    r = classifier.classify("અખબારનગર અંડરપાસમાં ગાડી ફસાઈ છે, પાણી વધી રહ્યું છે", "citizen")
    assert r.type == "flood" and r.priority == "P1" and r.lang == "gu"
    assert "trapped_people" in r.hazards
    assert r.location_text == "Akhbarnagar Underpass"


def test_hindi_gas_leak_is_industrial_p1():
    r = classifier.classify("वटवा जीआईडीसी की फैक्ट्री में गैस रिसाव हुआ है", "call")
    assert r.type == "industrial" and r.priority == "P1" and r.lang == "hi"
    assert r.location_text == "Vatva GIDC"


def test_minor_report_is_low_priority():
    r = classifier.classify("Small branch fell on the road in Paldi, nobody hurt", "citizen")
    assert r.priority in ("P3", "P4")


def test_sensor_over_threshold():
    r = classifier.classify(None, "sensor", sensor={
        "sensor_id": "VASNA-WL-01", "metric": "water_level_m", "value": 4.9, "threshold": 4.2, "unit": "m"})
    assert r.type == "flood" and r.severity == 4 and r.priority == "P1" and r.source_model == "rules"


def test_sensor_below_threshold_is_p4():
    r = classifier.classify(None, "sensor", sensor={"sensor_id": "X", "metric": "water_level_m", "value": 3, "threshold": 4.2})
    assert r.priority == "P4"


def test_classify_never_raises_on_garbage():
    for text in [None, "", "   ", "🤷" * 50]:
        r = classifier.classify(text, "citizen")
        assert r.type in classifier.INCIDENT_TYPES and 1 <= r.severity <= 5


def test_priority_rule():
    assert classifier.priority_for(2, ["gas_leak"]) == "P1"
    assert classifier.priority_for(4, []) == "P1"
    assert classifier.priority_for(3, []) == "P2"
    assert classifier.priority_for(1, []) == "P4"


def test_geocode():
    lat, lng, name = geocode("near vatva gidc gate 2")
    assert name == "Vatva GIDC" and 22.9 < lat < 23.0


# ---------------- dedup (geo + time + type only, embeddings off)

def _cand(type_="flood", lat=23.0588, lng=72.5620, mins_ago=5):
    return dedup.Candidate(key="INC-1", type=type_, lat=lat, lng=lng,
                           last_at=NOW - timedelta(minutes=mins_ago), texts=["car stuck in underpass"])


def test_dedup_merges_nearby_same_type():
    hit = dedup.best_match(new_type="flood", new_lat=23.0590, new_lng=72.5625, new_at=NOW,
                           new_text="water rising in akhbarnagar", candidates=[_cand()], use_embeddings=False)
    assert hit and hit[0].key == "INC-1"


def test_dedup_rejects_far_type_or_old():
    far = dedup.best_match(new_type="fire", new_lat=23.03, new_lng=72.56, new_at=NOW, new_text="x",
                           candidates=[_cand("fire", 23.06, 72.60)], use_embeddings=False)
    other_type = dedup.best_match(new_type="fire", new_lat=23.0588, new_lng=72.5620, new_at=NOW, new_text="x",
                                  candidates=[_cand("flood")], use_embeddings=False)
    old = dedup.best_match(new_type="flood", new_lat=23.0588, new_lng=72.5620, new_at=NOW, new_text="x",
                           candidates=[_cand(mins_ago=45)], use_embeddings=False)
    assert far is None and other_type is None and old is None


def test_flood_radius_is_wider():
    # ~700 m apart: merges for flood, not for fire
    flood = dedup.best_match(new_type="flood", new_lat=23.0650, new_lng=72.5620, new_at=NOW, new_text="x",
                             candidates=[_cand("flood")], use_embeddings=False)
    fire = dedup.best_match(new_type="fire", new_lat=23.0650, new_lng=72.5620, new_at=NOW, new_text="x",
                            candidates=[_cand("fire")], use_embeddings=False)
    assert flood is not None and fire is None


# ---------------- recommender

RESOURCES = [
    {"id": 1, "callsign": "NDRF-BOAT-01", "kind": "rescue_boat", "status": "available", "lat": 23.03, "lng": 72.577, "base": "Riverfront"},
    {"id": 2, "callsign": "NDRF-BOAT-02", "kind": "rescue_boat", "status": "assigned", "lat": 23.058, "lng": 72.562, "base": "Riverfront"},
    {"id": 3, "callsign": "108-AMD-01", "kind": "ambulance", "status": "available", "lat": 23.05, "lng": 72.60, "base": "Civil"},
    {"id": 4, "callsign": "108-AMD-02", "kind": "ambulance", "status": "available", "lat": 22.99, "lng": 72.60, "base": "Maninagar"},
]
FACILITIES = [
    {"id": 1, "name": "Civil Hospital", "kind": "hospital", "lat": 23.0536, "lng": 72.6037, "beds_available": 34, "specialties": ["trauma"]},
    {"id": 2, "name": "Full Hospital", "kind": "hospital", "lat": 23.058, "lng": 72.562, "beds_available": 0, "specialties": []},
    {"id": 3, "name": "School Shelter", "kind": "shelter", "lat": 23.06, "lng": 72.56, "beds_available": 200, "specialties": []},
]
FLOOD = {"id": 7, "type": "flood", "severity": 4, "hazards": ["trapped_people"], "lat": 23.0588, "lng": 72.562, "title": "Car trapped"}


def test_recommend_skips_busy_units_and_flags_shortage():
    out = recommender.build_recommendation(FLOOD, RESOURCES, FACILITIES, with_llm=False)
    assert out["needed_kinds"] == ["rescue_boat", "ndrf_team", "ambulance"]
    assert [r["resource"]["id"] for r in out["recommendations"]["rescue_boat"]] == [1]  # boat 2 is busy
    assert "ndrf_team" in out["shortages"]
    assert out["suggested_resource_ids"] == [1, 3]  # closer ambulance first
    assert all(r["reason"] for recs in out["recommendations"].values() for r in recs)


def test_facility_skips_full_hospital_and_trapped_flood_goes_to_hospital():
    out = recommender.build_recommendation(FLOOD, RESOURCES, FACILITIES, with_llm=False)
    assert out["facility"]["facility"]["id"] == 1


def test_plain_flood_goes_to_shelter():
    inc = dict(FLOOD, hazards=["rising_water"])
    assert recommender.pick_facility(inc, FACILITIES)["facility"]["kind"] == "shelter"


def test_capabilities_break_ties_between_same_kind_units():
    trucks = [
        {"id": 10, "callsign": "FT-PLAIN", "kind": "fire_truck", "status": "available", "lat": 23.030, "lng": 72.560,
         "base": "A", "capabilities": ["water_tender"]},
        {"id": 11, "callsign": "FT-LADDER", "kind": "fire_truck", "status": "available", "lat": 23.045, "lng": 72.560,
         "base": "B", "capabilities": ["aerial_ladder", "rescue", "water_tender"]},
    ]
    fire = {"id": 1, "type": "fire", "severity": 4, "hazards": ["trapped_people"], "lat": 23.029, "lng": 72.560,
            "title": "People trapped on 4th floor"}
    out = recommender.build_recommendation(fire, trucks, [], with_llm=False)
    best = out["recommendations"]["fire_truck"][0]
    assert best["resource"]["callsign"] == "FT-LADDER"  # ~2 km farther but has the ladder
    assert set(best["matched_capabilities"]) == {"aerial_ladder", "rescue", "water_tender"}
    assert "aerial ladder" in best["reason"]
    # Without trapped people the nearer truck wins.
    out = recommender.build_recommendation(dict(fire, hazards=[]), trucks, [], with_llm=False)
    assert out["recommendations"]["fire_truck"][0]["resource"]["callsign"] == "FT-PLAIN"


def test_wanted_capabilities_from_hazards_and_text():
    w = recommender.wanted_capabilities({"type": "industrial", "severity": 5, "hazards": ["gas_leak", "chemical"]})
    assert w["hazmat"] == ["gas_leak", "chemical", "decontamination"]
    w = recommender.wanted_capabilities({"type": "medical", "severity": 3, "hazards": [], "title": "Child with chest pain"})
    assert w["ambulance"] == ["cardiac", "als", "pediatric"]
    assert recommender.wanted_specialties({"type": "fire", "hazards": ["injuries"]}) == ["trauma", "burns"]


def test_gas_leak_needs_hazmat():
    assert recommender.needed_kinds("fire", ["gas_leak"])[0] == "hazmat"


# ---------------- summarizer

def test_summary_fallback_mentions_counts_and_actions():
    reports = [{"source": "citizen", "text": "car stuck", "lang": "en"}, {"source": "call", "text": "same", "lang": "en"}]
    out = summarizer.summarize_incident(dict(FLOOD, address="Akhbarnagar", priority="P1", code="INC-7"), reports)
    assert "2 reports" in out["summary"]
    assert out["actions"][0].startswith("Prioritise rescue")


def test_sitrep_fallback_lists_p1():
    md = summarizer.sitrep([dict(FLOOD, code="INC-7", priority="P1", status="new", address="Akhbarnagar")])
    assert "INC-7" in md and "Situation Report" in md


# ---------------- analytics

def test_analytics_computations():
    t0 = NOW - timedelta(minutes=10)
    incidents = [
        {"id": 1, "type": "flood", "severity": 4, "priority": "P1", "status": "dispatched", "lat": 23.0588, "lng": 72.562,
         "created_at": t0, "dispatched_at": t0 + timedelta(seconds=90)},
        {"id": 2, "type": "fire", "severity": 3, "priority": "P2", "status": "resolved", "lat": 23.029, "lng": 72.56,
         "created_at": t0, "dispatched_at": t0 + timedelta(seconds=400), "resolved_at": NOW},
    ]
    reports = [{"incident_id": 1, "lat": 23.0588, "lng": 72.562, "created_at": t0}] * 3 + [
        {"incident_id": 2, "lat": 23.029, "lng": 72.56, "created_at": t0}]
    assignments = [{"incident_id": 1, "status": "on_scene", "updated_at": t0 + timedelta(seconds=600)}]
    s = analytics.compute_summary(incidents, reports, RESOURCES, assignments)
    assert s["active_incidents"] == 1 and s["duplicates_merged"] == 2 and s["avg_time_to_dispatch_sec"] == 245
    assert s["avg_time_to_scene_sec"] == 600
    rt = analytics.compute_response_times(incidents, reports, assignments)
    assert {b["label"]: b["count"] for b in rt["buckets"]} == {"0-1 min": 0, "1-2 min": 1, "2-5 min": 0, "5+ min": 1}
    hs = analytics.compute_hotspots(incidents, reports)
    assert hs[0]["count"] == 3 and hs[0]["top_type"] == "flood"
    assert analytics.compute_by_type(incidents)[0]["count"] == 1
    sh = analytics.compute_shortages([{"kind": "shortage", "message": "No rescue boat available"}], RESOURCES)
    assert sh[0]["kind"] == "rescue_boat" and sh[0]["shortage_alerts"] == 1
