"""Schema tests (Task 2). Owner: BE1.

Asserts every response object serialises to exactly the key set in
docs/API_CONTRACT.md §2, enums match app.models, and request validation
rejects bad input.
"""
from datetime import datetime, timedelta, timezone
from typing import get_args

import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models as m
from app import schemas as s
from app.db import Base
from app.services.classifier import fallback_classify

T0 = datetime(2026, 9, 19, 8, 42, 10, tzinfo=timezone.utc)

# Key sets copied from docs/API_CONTRACT.md §2.
REPORT_KEYS = {"id", "source", "text", "lang", "lat", "lng", "address", "photo_url", "reporter", "sensor",
               "incident_id", "created_at"}
INCIDENT_KEYS = {"id", "code", "type", "severity", "priority", "status", "title", "lat", "lng", "address",
                 "ai_summary", "ai_reasoning", "ai_actions", "confidence", "hazards", "people_affected_est",
                 "report_count", "created_at", "updated_at", "dispatched_at", "resolved_at"}
RESOURCE_KEYS = {"id", "callsign", "kind", "status", "lat", "lng", "base", "phone", "current_incident_id"}
FACILITY_KEYS = {"id", "name", "kind", "lat", "lng", "beds_total", "beds_available", "specialties"}
ASSIGNMENT_KEYS = {"id", "incident_id", "resource_id", "resource", "status", "eta_min", "approved_by",
                   "created_at", "updated_at"}
ALERT_KEYS = {"id", "incident_id", "incident_code", "kind", "message", "acknowledged", "created_at"}
CLASSIFICATION_KEYS = {"type", "severity", "priority", "title", "location_text", "people_affected_est",
                       "hazards", "reasoning", "confidence", "lang", "source_model", "photo"}


@pytest.fixture()
def db():
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)

    @event.listens_for(eng, "connect")
    def _fk(dbapi_conn, _record):
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(eng)
    session = sessionmaker(bind=eng, expire_on_commit=False)()
    yield session
    session.close()
    eng.dispose()


@pytest.fixture()
def graph(db):
    """One incident with 2 reports, 1 assignment, 2 alerts (golden-path shape)."""
    inc = m.Incident(code="INC-0007", type="flood", severity=4, priority="P1", title="Car trapped",
                     lat=23.0496, lng=72.5621, address="Akhbarnagar Underpass", hazards=["trapped_people"],
                     ai_actions=["Send rescue boat"], confidence=0.92, report_count=2,
                     created_at=T0, updated_at=T0)
    res = m.Resource(callsign="NDRF-BOAT-02", kind="rescue_boat", lat=23.03, lng=72.577, base="Riverfront")
    db.add_all([inc, res])
    db.flush()
    db.add_all([
        m.Report(source="call", text="second", incident_id=inc.id, created_at=T0 + timedelta(minutes=1)),
        m.Report(source="citizen", text="અખબારનગર", lang="gu", lat=23.0496, lng=72.5621, incident_id=inc.id,
                 created_at=T0),
        m.Assignment(incident_id=inc.id, resource_id=res.id, eta_min=9, created_at=T0, updated_at=T0),
        m.Alert(incident_id=inc.id, kind="critical", message="P1 flood", created_at=T0),
        m.Alert(incident_id=inc.id, kind="sla_breach", message="late", created_at=T0 + timedelta(minutes=2)),
    ])
    db.commit()
    db.expire_all()
    return db.get(m.Incident, inc.id)


# ---------------------------------------------------------------- enums


@pytest.mark.parametrize(
    ("literal", "values"),
    [
        (s.IncidentType, m.INCIDENT_TYPES),
        (s.IncidentStatus, m.INCIDENT_STATUSES),
        (s.Priority, m.PRIORITIES),
        (s.ReportSource, m.REPORT_SOURCES),
        (s.ResourceKind, m.RESOURCE_KINDS),
        (s.ResourceStatus, m.RESOURCE_STATUSES),
        (s.FacilityKind, m.FACILITY_KINDS),
        (s.AssignmentStatus, m.ASSIGNMENT_STATUSES),
        (s.AlertKind, m.ALERT_KINDS),
    ],
)
def test_schema_enums_match_models(literal, values):
    assert get_args(literal) == values


# ---------------------------------------------------------------- response shapes


def test_incident_detail_matches_contract(graph):
    out = s.IncidentDetail.model_validate(graph).model_dump(mode="json")

    assert set(out) == INCIDENT_KEYS | {"reports", "assignments", "alerts"}
    assert out["code"] == "INC-0007"
    assert out["created_at"] == "2026-09-19T08:42:10Z"
    assert out["dispatched_at"] is None and out["resolved_at"] is None  # present as null, not omitted
    assert out["ai_reasoning"] is None

    assert [r["text"] for r in out["reports"]] == ["અખબારનગર", "second"]  # oldest first
    assert all(set(r) == REPORT_KEYS for r in out["reports"])

    (a,) = out["assignments"]
    assert set(a) == ASSIGNMENT_KEYS and set(a["resource"]) == RESOURCE_KEYS
    assert a["resource"]["callsign"] == "NDRF-BOAT-02" and a["approved_by"] == "dispatcher"

    assert [al["kind"] for al in out["alerts"]] == ["sla_breach", "critical"]  # newest first
    assert all(set(al) == ALERT_KEYS and al["incident_code"] == "INC-0007" for al in out["alerts"])


def test_incident_list_item_has_no_relations(graph):
    assert set(s.IncidentOut.model_validate(graph).model_dump(mode="json")) == INCIDENT_KEYS


def test_facility_shape_and_null_beds(db):
    db.add(m.Facility(name="Danapith Fire Station", kind="fire_station", lat=23.02, lng=72.58))
    db.commit()
    out = s.FacilityOut.model_validate(db.query(m.Facility).one()).model_dump(mode="json")
    assert set(out) == FACILITY_KEYS and out["beds_total"] is None and out["specialties"] == []


def test_shortage_alert_without_incident(db):
    db.add(m.Alert(kind="shortage", message="No hazmat available"))
    db.commit()
    out = s.AlertOut.model_validate(db.query(m.Alert).one()).model_dump(mode="json")
    assert out["incident_id"] is None and out["incident_code"] is None and out["acknowledged"] is False


def test_classification_out_from_be2_result():
    cls = fallback_classify("Car stuck in Akhbarnagar underpass, water rising, people trapped")
    out = s.ClassificationOut.model_validate(cls).model_dump(mode="json")
    assert set(out) == CLASSIFICATION_KEYS
    assert out["source_model"] == "fallback" and out["type"] == "flood" and out["photo"] is None


def test_classification_out_with_photo():
    cls = fallback_classify("Fire at C.G. Road complex")
    cls.photo = {"relevant": True, "type": "fire", "severity_hint": 4, "hazards": ["fire_spread"],
                 "description": "Smoke from 3rd floor", "confidence": 0.8}
    out = s.ClassificationOut.model_validate(cls).model_dump(mode="json")
    assert out["photo"]["severity_hint"] == 4 and out["photo"]["relevant"] is True


@pytest.mark.parametrize(
    "url",
    ["data:image/jpeg;base64,/9j/4AAQ", "data:image/png;base64,iVBOR", "data:image/webp;base64,UklGR",
     "https://example.org/flood.jpg"],
)
def test_photo_url_accepted(url):
    assert s.ReportCreate(source="citizen", text="flood", photo_url=url).photo_url == url


def test_photo_url_empty_becomes_null():
    assert s.ReportCreate(source="citizen", text="flood", photo_url="").photo_url is None


def test_photo_url_six_mb_image_fits():
    six_mb_b64 = "A" * ((s.MAX_PHOTO_BYTES + 2) // 3 * 4)
    r = s.ReportCreate(source="citizen", text="flood", photo_url="data:image/jpeg;base64," + six_mb_b64)
    assert r.photo_url is not None


@pytest.mark.parametrize(
    "url",
    ["http://example.org/a.jpg", "file:///etc/passwd", "data:text/html;base64,PGh0bWw+", "javascript:alert(1)",
     "flood.jpg"],
)
def test_photo_url_rejected(url):
    with pytest.raises(ValidationError):
        s.ReportCreate(source="citizen", text="flood", photo_url=url)


def test_photo_url_too_large_rejected():
    with pytest.raises(ValidationError):
        s.ReportCreate(source="citizen", text="flood", photo_url="data:image/jpeg;base64," + "A" * s.MAX_PHOTO_URL_LEN)


def test_datetime_serialisation():
    ist = timezone(timedelta(hours=5, minutes=30))
    assert s.to_utc_iso(datetime(2026, 9, 19, 14, 12, 10, tzinfo=ist)) == "2026-09-19T08:42:10Z"
    assert s.to_utc_iso(datetime(2026, 9, 19, 8, 42, 10)) == "2026-09-19T08:42:10Z"  # naive = UTC
    msg = s.WsMessage(event="incident.created", data={"id": 1}, ts=T0).model_dump(mode="json")
    assert msg == {"event": "incident.created", "data": {"id": 1}, "ts": "2026-09-19T08:42:10Z"}


# ---------------------------------------------------------------- ReportCreate validation


def test_report_create_contract_example():
    r = s.ReportCreate.model_validate({
        "source": "citizen", "text": "Car stuck in Akhbarnagar underpass, water rising fast!", "lang": None,
        "lat": 23.0496, "lng": 72.5621, "address": None, "photo_url": None, "reporter": "Citizen app",
        "sensor": None,
    })
    assert r.source == "citizen" and r.lat == 23.0496


def test_report_create_sensor():
    r = s.ReportCreate(source="sensor", sensor={"sensor_id": "VASNA-WL-01", "metric": "water_level_m",
                                                "value": 4.9, "threshold": 4.2, "unit": "m"})
    assert r.text is None and r.sensor.value == 4.9


def test_report_create_strips_text():
    assert s.ReportCreate(source="call", text="  flood near Vasna  ").text == "flood near Vasna"


@pytest.mark.parametrize(
    "body",
    [
        {"source": "citizen"},                                         # text missing
        {"source": "citizen", "text": "   "},                          # blank text
        {"source": "sensor", "text": "reading"},                       # sensor missing
        {"source": "citizen", "text": "x", "sensor": {"sensor_id": "a", "metric": "m", "value": 1, "threshold": 1}},
        {"source": "sensor", "sensor": {"sensor_id": "a", "metric": "m", "value": 1, "threshold": 0}},
        {"source": "email", "text": "x"},                              # bad source
        {"source": "citizen", "text": "x", "lat": 23.0},               # lng missing
        {"source": "citizen", "text": "x", "lat": 91, "lng": 72.5},    # lat out of range
        {"source": "citizen", "text": "x", "lng": 181, "lat": 23.0},   # lng out of range
        {"source": "citizen", "text": "x", "lang": "fr"},              # unsupported lang
        {"source": "citizen", "text": "x" * (s.MAX_TEXT_LEN + 1)},     # too long
        {"source": "citizen", "text": "x", "priority": "P1"},          # unknown field
    ],
)
def test_report_create_rejects(body):
    with pytest.raises(ValidationError):
        s.ReportCreate.model_validate(body)


# ---------------------------------------------------------------- other requests


def test_dispatch_request():
    d = s.DispatchRequest(resource_ids=[3, 14, 21], facility_id=1)
    assert d.approved_by == "dispatcher"
    for bad in ({"resource_ids": []}, {"resource_ids": [3, 3]}, {"resource_ids": [1], "extra": 1}):
        with pytest.raises(ValidationError):
            s.DispatchRequest.model_validate(bad)


def test_incident_patch():
    assert s.IncidentPatch(status="escalated", note="No boat available").status == "escalated"
    assert s.IncidentPatch(note="just a note").note == "just a note"
    for bad in ({}, {"status": "closed"}, {"severity": 6}, {"priority": "P0"}, {"note": ""}):
        with pytest.raises(ValidationError):
            s.IncidentPatch.model_validate(bad)


def test_status_patches():
    assert s.AssignmentPatch(status="on_scene").status == "on_scene"
    assert s.ResourcePatch(status="offline").status == "offline"
    with pytest.raises(ValidationError):
        s.AssignmentPatch(status="arrived")
    with pytest.raises(ValidationError):
        s.ResourcePatch(status="sleeping")


def test_simulator_start():
    assert s.SimulatorStart().model_dump() == {"scenario": "ahmedabad_flood", "speed": 1.0}
    for bad in ({"speed": 0}, {"speed": 50}, {"scenario": "../../etc/passwd"}):
        with pytest.raises(ValidationError):
            s.SimulatorStart.model_validate(bad)


def test_unmerge_request():
    assert s.UnmergeRequest(report_id=44).report_id == 44
    with pytest.raises(ValidationError):
        s.UnmergeRequest(report_id=0)
