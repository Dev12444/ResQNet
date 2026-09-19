"""Incident + resource update tests (Task 10). Owner: BE1."""
import time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models as m
from app import pipeline
from app.config import get_settings
from app.db import Base, get_db
from app.main import app
from app.seed import reset_database
from app.services import summarizer
from app.ws_manager import manager

AKH_EN = "Car stuck in Akhbarnagar underpass, water rising fast, two people inside"
AKH_GU = "અખબારનગર અંડરપાસમાં ગાડી ફસાઈ છે, પાણી વધી રહ્યું છે"
FIRE = "Fire in a commercial complex on C.G. Road, people on terrace"


@pytest.fixture(autouse=True)
def ai_off(monkeypatch):
    monkeypatch.setenv("AI_ENABLED", "false")
    monkeypatch.setenv("LLM_CACHE_PATH", "")
    get_settings.cache_clear()
    summarizer._last.clear()
    yield
    pipeline.cancel_trailing_refreshes()
    get_settings.cache_clear()
    summarizer._last.clear()


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

    def _db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _db
    with TestClient(app) as client:
        yield client, Session
    app.dependency_overrides.clear()
    eng.dispose()


def _report(client, text=AKH_EN, lat=23.0588, lng=72.5620, source="citizen"):
    return client.post("/api/reports", json={"source": source, "text": text, "lat": lat, "lng": lng}).json()


def _patch(client, incident_id, **body):
    return client.patch(f"/api/incidents/{incident_id}", json=body, headers={"X-Actor": "supervisor"})


def _resource_id(Session, callsign):
    with Session() as db:
        return db.scalars(select(m.Resource.id).where(m.Resource.callsign == callsign)).one()


def _wait(pred, timeout=3.0):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if pred():
            return True
        time.sleep(0.02)
    return False


# ---------------------------------------------------------------- escalation


def test_escalate_creates_one_alert_and_broadcasts(env):
    client, Session = env
    inc = _report(client)["incident"]
    with client.websocket_connect("/ws") as ws:
        assert _wait(lambda: manager.client_count == 1)
        r = _patch(client, inc["id"], status="escalated", note="No boat available, escalating to collector")
        events = [ws.receive_json() for _ in range(2)]
    assert r.status_code == 200 and r.json()["status"] == "escalated"
    assert [e["event"] for e in events] == ["alert.created", "incident.updated"]
    alert = events[0]["data"]
    assert alert["kind"] == "escalation" and alert["incident_code"] == "INC-0001"
    assert "escalated by supervisor: No boat available" in alert["message"]
    assert r.json()["alerts"][0]["kind"] == "escalation"

    _patch(client, inc["id"], status="triaged")
    _patch(client, inc["id"], status="escalated")  # re-escalating: alert still open -> no duplicate
    with Session() as db:
        assert db.scalar(select(func.count()).select_from(m.Alert).where(m.Alert.kind == "escalation")) == 1


def test_cannot_escalate_resolved_incident(env):
    client, _ = env
    inc = _report(client)["incident"]
    _patch(client, inc["id"], status="resolved")
    r = _patch(client, inc["id"], status="escalated")
    assert r.status_code == 409 and "re-open" in r.json()["detail"]


@pytest.mark.parametrize("status", ["new", "dispatched", "on_scene"])
def test_derived_statuses_cannot_be_set_manually(env, status):
    client, _ = env
    inc = _report(client)["incident"]
    _patch(client, inc["id"], status="escalated")  # move off "new" (asking for the current status is a no-op)
    r = _patch(client, inc["id"], status=status)
    assert r.status_code == 409 and "set automatically" in r.json()["detail"]


def test_de_escalating_returns_to_what_the_units_imply(env):
    client, Session = env
    inc = _report(client)["incident"]
    client.post(f"/api/incidents/{inc['id']}/dispatch", json={"resource_ids": [_resource_id(Session, "108-AMD-01")]})
    _patch(client, inc["id"], status="escalated")
    assert _patch(client, inc["id"], status="triaged").json()["status"] == "dispatched"


# ---------------------------------------------------------------- severity / priority


def test_severity_change_recomputes_priority(env):
    client, _ = env
    inc = _report(client, text=FIRE, lat=23.029, lng=72.56)["incident"]
    low = _patch(client, inc["id"], severity=2).json()
    assert low["severity"] == 2 and low["priority"] in ("P3", "P1")  # P1 only if a critical hazard applies
    high = _patch(client, inc["id"], severity=5).json()
    assert high["severity"] == 5 and high["priority"] == "P1"


def test_explicit_priority_wins(env):
    client, _ = env
    inc = _report(client)["incident"]
    body = _patch(client, inc["id"], severity=2, priority="P2").json()
    assert (body["severity"], body["priority"]) == (2, "P2")


def test_note_only_is_audited_without_broadcast(env):
    client, Session = env
    inc = _report(client)["incident"]
    r = _patch(client, inc["id"], note="Called the reporter back, confirmed")
    assert r.status_code == 200
    with Session() as db:
        row = db.scalars(select(m.AuditLog).where(m.AuditLog.action == "incident.updated")).one()
    assert row.actor == "supervisor" and row.payload["note"] == "Called the reporter back, confirmed"


def test_no_change_is_a_noop(env):
    client, Session = env
    inc = _report(client)["incident"]
    _patch(client, inc["id"], severity=inc["severity"])
    with Session() as db:
        updates = select(func.count()).select_from(m.AuditLog).where(m.AuditLog.action == "incident.updated")
        assert db.scalar(updates) == 0


@pytest.mark.parametrize("body", [{}, {"status": "closed"}, {"severity": 7}, {"priority": "P9"}, {"x": 1}])
def test_patch_validation(env, body):
    client, _ = env
    inc = _report(client)["incident"]
    assert client.patch(f"/api/incidents/{inc['id']}", json=body).status_code == 422


def test_patch_unknown_incident(env):
    client, _ = env
    assert _patch(client, 999, status="escalated").status_code == 404


# ---------------------------------------------------------------- manual resolve (FE2 /field "resolved")


def test_manual_resolve_closes_units_and_frees_them(env):
    client, Session = env
    inc = _report(client)["incident"]
    boat, amb = _resource_id(Session, "NDRF-BOAT-01"), _resource_id(Session, "108-AMD-01")
    detail = client.post(f"/api/incidents/{inc['id']}/dispatch", json={"resource_ids": [boat, amb]}).json()
    boat_asg = next(a["id"] for a in detail["assignments"] if a["resource_id"] == boat)
    client.patch(f"/api/assignments/{boat_asg}", json={"status": "on_scene"})

    body = _patch(client, inc["id"], status="resolved", note="Field situation update").json()
    assert body["status"] == "resolved" and body["resolved_at"] is not None
    by_res = {a["resource_id"]: a["status"] for a in body["assignments"]}
    assert by_res == {boat: "completed", amb: "cancelled"}
    with Session() as db:
        assert db.get(m.Resource, boat).status == "available" and db.get(m.Resource, amb).current_incident_id is None


def test_reopen_resolved_incident(env):
    client, _ = env
    inc = _report(client)["incident"]
    _patch(client, inc["id"], status="resolved")
    body = _patch(client, inc["id"], status="triaged").json()
    assert body["status"] == "triaged" and body["resolved_at"] is None


# ---------------------------------------------------------------- unmerge


def test_unmerge_moves_report_into_new_incident(env):
    client, Session = env
    first = _report(client)
    second = _report(client, text=AKH_GU, lat=23.0590, lng=72.5623, source="call")
    assert second["merged"] is True
    inc_id, rep_id = first["incident"]["id"], second["report"]["id"]

    r = client.post(f"/api/incidents/{inc_id}/unmerge", json={"report_id": rep_id})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["old"]["id"] == inc_id and body["old"]["report_count"] == 1
    assert body["new"]["code"] == "INC-0002" and body["new"]["report_count"] == 1
    assert body["new"]["type"] == "flood"  # rebuilt from the report's cached classification
    assert [x["id"] for x in client.get(f"/api/incidents/{body['new']['id']}").json()["reports"]] == [rep_id]
    with Session() as db:
        assert db.get(m.Report, rep_id).incident_id == body["new"]["id"]
        assert db.scalars(select(m.AuditLog.action).where(m.AuditLog.action == "incident.unmerged")).one()


def test_unmerge_errors(env):
    client, _ = env
    first = _report(client)
    other = _report(client, text=FIRE, lat=23.029, lng=72.56)
    inc_id = first["incident"]["id"]
    only = client.post(f"/api/incidents/{inc_id}/unmerge", json={"report_id": first["report"]["id"]})
    assert only.status_code == 409 and "only one report" in only.json()["detail"]
    foreign = client.post(f"/api/incidents/{inc_id}/unmerge", json={"report_id": other["report"]["id"]})
    assert foreign.status_code == 404
    assert client.post("/api/incidents/999/unmerge", json={"report_id": 1}).status_code == 404
    assert client.post(f"/api/incidents/{inc_id}/unmerge", json={"report_id": 0}).status_code == 422


# ---------------------------------------------------------------- PATCH /api/resources/{id}


def test_mark_unit_offline_and_back(env):
    client, Session = env
    amb = _resource_id(Session, "108-AMD-02")
    with client.websocket_connect("/ws") as ws:
        assert _wait(lambda: manager.client_count == 1)
        r = client.patch(f"/api/resources/{amb}", json={"status": "offline"}, headers={"X-Actor": "fleet-desk"})
        assert ws.receive_json()["event"] == "resource.updated"
    assert r.status_code == 200 and r.json()["status"] == "offline"
    assert client.post("/api/incidents/1/dispatch", json={"resource_ids": [amb]}).status_code in (404, 409)
    assert client.patch(f"/api/resources/{amb}", json={"status": "available"}).json()["status"] == "available"
    with Session() as db:
        row = db.scalars(select(m.AuditLog).where(m.AuditLog.action == "resource.status")).first()
    assert row.actor == "fleet-desk" and row.payload == {"callsign": "108-AMD-02", "from": "available", "to": "offline"}


def test_resource_patch_guards(env):
    client, Session = env
    inc = _report(client)["incident"]
    boat = _resource_id(Session, "NDRF-BOAT-01")
    client.post(f"/api/incidents/{inc['id']}/dispatch", json={"resource_ids": [boat]})
    busy = client.patch(f"/api/resources/{boat}", json={"status": "offline"})
    assert busy.status_code == 409 and "active assignment" in busy.json()["detail"]
    amb = _resource_id(Session, "108-AMD-03")
    assert client.patch(f"/api/resources/{amb}", json={"status": "assigned"}).status_code == 409
    assert client.patch("/api/resources/9999", json={"status": "offline"}).status_code == 404
    assert client.patch(f"/api/resources/{amb}", json={"status": "sleeping"}).status_code == 422
    assert client.patch(f"/api/resources/{amb}", json={"status": "available"}).status_code == 200  # same = no-op
