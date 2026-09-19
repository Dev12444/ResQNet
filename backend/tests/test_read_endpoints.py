"""Read endpoint tests (Task 6). Owner: BE1."""
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models as m
from app.db import Base, get_db
from app.main import app
from app.seed import load_seed, reset_database

T0 = datetime(2026, 9, 19, 8, 0, tzinfo=timezone.utc)
INCIDENT_KEYS = {"id", "code", "type", "severity", "priority", "status", "title", "lat", "lng", "address",
                 "ai_summary", "ai_reasoning", "ai_actions", "confidence", "hazards", "people_affected_est",
                 "report_count", "created_at", "updated_at", "dispatched_at", "resolved_at"}


@pytest.fixture()
def env():
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)

    @event.listens_for(eng, "connect")
    def _fk(dbapi_conn, _record):
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(eng)
    Session = sessionmaker(bind=eng, expire_on_commit=False)
    with Session() as db:
        reset_database(db)
        _populate(db)

    def _db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _db
    with TestClient(app) as client:
        yield client, eng, Session
    app.dependency_overrides.clear()
    eng.dispose()


def _incident(db, code, type_, sev, prio, status, minutes, **kw):
    inc = m.Incident(code=code, type=type_, severity=sev, priority=prio, status=status, title=f"{type_} {code}",
                     lat=23.03, lng=72.57, created_at=T0 + timedelta(minutes=minutes),
                     updated_at=T0 + timedelta(minutes=minutes), **kw)
    db.add(inc)
    db.flush()
    return inc


def _populate(db):
    boat = db.scalars(select(m.Resource).where(m.Resource.callsign == "NDRF-BOAT-01")).one()
    a = _incident(db, "INC-0001", "flood", 4, "P1", "dispatched", 5, hazards=["trapped_people"])
    _incident(db, "INC-0002", "fire", 3, "P2", "new", 1)
    _incident(db, "INC-0003", "industrial", 5, "P1", "escalated", 2)
    _incident(db, "INC-0004", "other", 1, "P4", "resolved", 0)
    _incident(db, "INC-0005", "medical", 2, "P3", "triaged", 3)
    db.add_all([
        m.Report(source="call", text="second", incident_id=a.id, created_at=T0 + timedelta(minutes=6)),
        m.Report(source="citizen", text="first", lang="gu", lat=23.03, lng=72.57, incident_id=a.id,
                 created_at=T0 + timedelta(minutes=5)),
        m.Report(source="sensor", sensor={"sensor_id": "VASNA-WL-01", "value": 4.9}, created_at=T0),
        m.Assignment(incident_id=a.id, resource_id=boat.id, eta_min=9, status="en_route",
                     created_at=T0 + timedelta(minutes=7), updated_at=T0 + timedelta(minutes=8)),
        m.Alert(incident_id=a.id, kind="critical", message="P1 flood", created_at=T0 + timedelta(minutes=5)),
        m.Alert(incident_id=a.id, kind="sla_breach", message="late", acknowledged=True,
                created_at=T0 + timedelta(minutes=7)),
        m.Alert(kind="shortage", message="No hazmat units available", created_at=T0 + timedelta(minutes=9)),
    ])
    boat.status, boat.current_incident_id = "assigned", a.id
    db.commit()


@contextmanager
def count_queries(eng):
    stmts = []

    def _before(conn, cursor, statement, *args):
        stmts.append(statement)

    event.listen(eng, "before_cursor_execute", _before)
    try:
        yield stmts
    finally:
        event.remove(eng, "before_cursor_execute", _before)


# ---------------------------------------------------------------- incidents list


def test_incidents_default_excludes_resolved_and_sorts_p1_first_then_oldest(env):
    client, *_ = env
    r = client.get("/api/incidents")
    assert r.status_code == 200
    codes = [i["code"] for i in r.json()]
    # P1: INC-0003 (t+2) before INC-0001 (t+5); then P2, P3. Resolved INC-0004 hidden.
    assert codes == ["INC-0003", "INC-0001", "INC-0002", "INC-0005"]
    assert set(r.json()[0]) == INCIDENT_KEYS


def test_incidents_include_resolved(env):
    client, *_ = env
    codes = [i["code"] for i in client.get("/api/incidents", params={"include_resolved": "true"}).json()]
    assert "INC-0004" in codes and len(codes) == 5


@pytest.mark.parametrize(
    ("params", "expected"),
    [
        ({"status": "new,escalated"}, ["INC-0003", "INC-0002"]),
        ({"status": " resolved "}, ["INC-0004"]),
        ({"status": "new,new"}, ["INC-0002"]),
        ({"type": "flood"}, ["INC-0001"]),
        ({"min_severity": 4}, ["INC-0003", "INC-0001"]),
        ({"type": "fire", "min_severity": 4}, []),
    ],
)
def test_incident_filters(env, params, expected):
    client, *_ = env
    assert [i["code"] for i in client.get("/api/incidents", params=params).json()] == expected


@pytest.mark.parametrize(
    "params",
    [{"status": "closed"}, {"status": "new,bogus"}, {"type": "tsunami"}, {"min_severity": 0},
     {"min_severity": 6}, {"include_resolved": "maybe"}],
)
def test_incident_filters_reject_bad_values(env, params):
    client, *_ = env
    r = client.get("/api/incidents", params=params)
    assert r.status_code == 422 and "detail" in r.json()


# ---------------------------------------------------------------- incident detail


def test_incident_detail_shape_and_ordering(env):
    client, *_ = env
    body = client.get("/api/incidents/1").json()
    assert set(body) == INCIDENT_KEYS | {"reports", "assignments", "alerts"}
    assert [r["text"] for r in body["reports"]] == ["first", "second"]          # oldest first
    assert body["assignments"][0]["resource"]["callsign"] == "NDRF-BOAT-01"
    assert body["assignments"][0]["status"] == "en_route"
    assert [a["kind"] for a in body["alerts"]] == ["sla_breach", "critical"]    # newest first
    assert all(a["incident_code"] == "INC-0001" for a in body["alerts"])
    assert body["created_at"] == "2026-09-19T08:05:00Z"


def test_incident_detail_404_and_422(env):
    client, *_ = env
    r = client.get("/api/incidents/999")
    assert r.status_code == 404 and r.json() == {"detail": "Incident 999 not found"}
    assert client.get("/api/incidents/abc").status_code == 422


def test_incident_detail_query_count_is_constant(env):
    client, eng, Session = env
    with count_queries(eng) as few:
        client.get("/api/incidents/1")
    with Session() as db:
        db.add_all(m.Alert(incident_id=1, kind="critical", message=f"x{i}") for i in range(20))
        db.add_all(m.Report(source="citizen", text=f"r{i}", incident_id=1) for i in range(20))
        db.commit()
    with count_queries(eng) as many:
        body = client.get("/api/incidents/1").json()
    assert len(body["alerts"]) == 22 and len(body["reports"]) == 22
    assert len(many) == len(few) <= 6  # incident + reports + assignments + resources + alerts


# ---------------------------------------------------------------- reports


def test_reports_list_newest_first_and_filters(env):
    client, *_ = env
    all_reports = client.get("/api/reports").json()
    assert [r["text"] for r in all_reports][:2] == ["second", "first"]
    assert len(all_reports) == 3
    by_inc = client.get("/api/reports", params={"incident_id": 1}).json()
    assert {r["incident_id"] for r in by_inc} == {1} and len(by_inc) == 2
    sensors = client.get("/api/reports", params={"source": "sensor"}).json()
    assert len(sensors) == 1 and sensors[0]["sensor"]["sensor_id"] == "VASNA-WL-01"
    assert client.get("/api/reports", params={"limit": 1}).json()[0]["text"] == "second"
    assert client.get("/api/reports", params={"incident_id": 999}).json() == []


@pytest.mark.parametrize("params", [{"incident_id": 0}, {"source": "email"}, {"limit": 0}, {"limit": 5000}])
def test_reports_reject_bad_params(env, params):
    client, *_ = env
    assert client.get("/api/reports", params=params).status_code == 422


# ---------------------------------------------------------------- resources & facilities


def test_resources_list_and_filters(env):
    client, *_ = env
    everything = client.get("/api/resources").json()
    assert len(everything) == len(load_seed().resources)
    boats = client.get("/api/resources", params={"kind": "rescue_boat"}).json()
    assert len(boats) == 4 and [b["callsign"] for b in boats] == sorted(b["callsign"] for b in boats)
    assigned = client.get("/api/resources", params={"status": "assigned"}).json()
    assert [(a["callsign"], a["current_incident_id"]) for a in assigned] == [("NDRF-BOAT-01", 1)]
    available_boats = client.get("/api/resources", params={"kind": "rescue_boat", "status": "available"}).json()
    assert len(available_boats) == 3
    assert "capabilities" not in everything[0]  # contract Resource shape only


def test_facilities_list_and_filter(env):
    client, *_ = env
    assert len(client.get("/api/facilities").json()) == len(load_seed().facilities)
    shelters = client.get("/api/facilities", params={"kind": "shelter"}).json()
    assert len(shelters) == 4 and all(s["beds_available"] > 0 for s in shelters)
    stations = client.get("/api/facilities", params={"kind": "fire_station"}).json()
    assert all(s["beds_total"] is None for s in stations)


@pytest.mark.parametrize(("path", "params"), [("/api/resources", {"kind": "helicopter"}),
                                              ("/api/resources", {"status": "sleeping"}),
                                              ("/api/facilities", {"kind": "school"})])
def test_resource_filters_reject_bad_values(env, path, params):
    client, *_ = env
    assert client.get(path, params=params).status_code == 422


# ---------------------------------------------------------------- alerts


def test_alerts_newest_first_with_codes(env):
    client, *_ = env
    body = client.get("/api/alerts").json()
    assert [a["kind"] for a in body] == ["shortage", "sla_breach", "critical"]
    assert body[0]["incident_code"] is None and body[1]["incident_code"] == "INC-0001"


def test_alerts_filters(env):
    client, *_ = env
    assert [a["kind"] for a in client.get("/api/alerts", params={"acknowledged": "false"}).json()] == [
        "shortage", "critical"]
    assert [a["kind"] for a in client.get("/api/alerts", params={"acknowledged": "true"}).json()] == ["sla_breach"]
    assert len(client.get("/api/alerts", params={"incident_id": 1}).json()) == 2
    assert len(client.get("/api/alerts", params={"kind": "shortage"}).json()) == 1
    assert client.get("/api/alerts", params={"kind": "info"}).status_code == 422


def test_alerts_query_count_is_constant(env):
    client, eng, Session = env
    with count_queries(eng) as few:
        client.get("/api/alerts")
    with Session() as db:
        for i in range(10):
            inc = m.Incident(code=f"INC-9{i:03d}", type="fire", severity=3, priority="P2", title="t")
            db.add(inc)
            db.flush()
            db.add(m.Alert(incident_id=inc.id, kind="critical", message="x"))
        db.commit()
    with count_queries(eng) as many:
        body = client.get("/api/alerts").json()
    assert len(body) == 13 and all(a["incident_code"] for a in body if a["incident_id"])
    assert len(many) == len(few) <= 3  # alerts + their incidents, not one query per alert


def test_read_routes_do_not_shadow_be2_routes(env):
    client, *_ = env
    assert client.get("/api/incidents/1/recommendations").status_code == 200
    assert client.get("/api/analytics/summary").status_code == 200
