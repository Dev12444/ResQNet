"""Dispatch + assignment lifecycle tests (Task 9). Owner: BE1."""
import threading
import time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models as m
from app.config import get_settings
from app.db import Base, get_db
from app.main import app
from app.seed import reset_database
from app.services import geo
from app.ws_manager import manager

AKHBARNAGAR = (23.0588, 72.5620)


@pytest.fixture(autouse=True)
def ai_off(monkeypatch):
    monkeypatch.setenv("AI_ENABLED", "false")
    monkeypatch.setenv("LLM_CACHE_PATH", "")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _setup(eng):
    @event.listens_for(eng, "connect")
    def _fk(dbapi_conn, _record):
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(eng)
    Session = sessionmaker(bind=eng, expire_on_commit=False)
    with Session() as db:
        reset_database(db)
        for code, type_, lat_lng in (("INC-0001", "flood", AKHBARNAGAR), ("INC-0002", "fire", (23.029, 72.56))):
            db.add(m.Incident(code=code, type=type_, severity=4, priority="P1", title=f"{type_} test",
                              lat=lat_lng[0], lng=lat_lng[1]))
        db.commit()

    def _db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _db
    return Session


@pytest.fixture()
def env():
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Session = _setup(eng)
    with TestClient(app) as client:
        yield client, Session
    app.dependency_overrides.clear()
    eng.dispose()


def _ids(Session, *callsigns):
    with Session() as db:
        by = {r.callsign: r.id for r in db.scalars(select(m.Resource))}
    return [by[c] for c in callsigns]


def _dispatch(client, incident_id, resource_ids, **extra):
    return client.post(f"/api/incidents/{incident_id}/dispatch", json={"resource_ids": resource_ids, **extra},
                       headers={"X-Actor": "dispatcher-1"})


def _patch(client, assignment_id, status):
    return client.patch(f"/api/assignments/{assignment_id}", json={"status": status})


def _wait(pred, timeout=3.0):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if pred():
            return True
        time.sleep(0.02)
    return False


# ---------------------------------------------------------------- dispatch


def test_dispatch_happy_path(env):
    client, Session = env
    boat, amb = _ids(Session, "NDRF-BOAT-01", "108-AMD-01")
    with client.websocket_connect("/ws") as ws:
        assert _wait(lambda: manager.client_count == 1)
        r = _dispatch(client, 1, [boat, amb], facility_id=1, approved_by="dispatcher")
        events = [ws.receive_json()["event"] for _ in range(5)]
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "dispatched" and body["dispatched_at"] is not None
    assert [a["resource"]["callsign"] for a in body["assignments"]] == ["NDRF-BOAT-01", "108-AMD-01"]
    assert all(a["status"] == "assigned" and a["approved_by"] == "dispatcher" for a in body["assignments"])
    assert events == ["assignment.updated", "resource.updated", "assignment.updated", "resource.updated",
                      "incident.updated"]
    with Session() as db:
        b = db.get(m.Resource, boat)
        assert (b.status, b.current_incident_id) == ("assigned", 1)
        expected_eta = geo.eta_between(b.lat, b.lng, *AKHBARNAGAR, "rescue_boat")
        log = db.scalars(select(m.AuditLog).where(m.AuditLog.action == "incident.dispatched")).one()
    assert body["assignments"][0]["eta_min"] == expected_eta
    assert log.actor == "dispatcher-1" and log.payload["callsigns"] == ["NDRF-BOAT-01", "108-AMD-01"]


def test_dispatching_a_busy_unit_is_409_and_changes_nothing(env):
    client, Session = env
    boat, amb = _ids(Session, "NDRF-BOAT-01", "108-AMD-01")
    assert _dispatch(client, 1, [boat]).status_code == 200
    r = _dispatch(client, 2, [amb, boat])  # amb is free, boat is not
    assert r.status_code == 409 and "NDRF-BOAT-01 (assigned)" in r.json()["detail"]
    with Session() as db:
        assert db.get(m.Resource, amb).status == "available"  # all-or-nothing
        assert db.scalar(select(func.count()).select_from(m.Assignment).where(m.Assignment.incident_id == 2)) == 0
        assert db.get(m.Incident, 2).status == "new"


@pytest.mark.parametrize(("status", "code"), [("offline", 409), ("busy", 409)])
def test_offline_or_busy_units_cannot_be_dispatched(env, status, code):
    client, Session = env
    (amb,) = _ids(Session, "108-AMD-02")
    with Session() as db:
        db.get(m.Resource, amb).status = status
        db.commit()
    assert _dispatch(client, 1, [amb]).status_code == code


def test_dispatch_404s(env):
    client, Session = env
    (amb,) = _ids(Session, "108-AMD-01")
    assert _dispatch(client, 999, [amb]).json() == {"detail": "Incident 999 not found"}
    assert _dispatch(client, 1, [amb, 9999]).status_code == 404
    assert _dispatch(client, 1, [amb], facility_id=9999).status_code == 404
    with Session() as db:
        assert db.get(m.Resource, amb).status == "available"


@pytest.mark.parametrize("body", [{"resource_ids": []}, {"resource_ids": [1, 1]}, {"resource_ids": [1], "x": 1}])
def test_dispatch_validation(env, body):
    client, _ = env
    assert client.post("/api/incidents/1/dispatch", json=body).status_code == 422


def test_cannot_dispatch_to_resolved_incident(env):
    client, Session = env
    with Session() as db:
        db.get(m.Incident, 1).status = "resolved"
        db.commit()
    r = _dispatch(client, 1, _ids(Session, "108-AMD-01"))
    assert r.status_code == 409 and "resolved" in r.json()["detail"]


def test_escalated_incident_can_be_dispatched(env):
    client, Session = env
    with Session() as db:
        db.get(m.Incident, 1).status = "escalated"
        db.commit()
    assert _dispatch(client, 1, _ids(Session, "108-AMD-01")).json()["status"] == "dispatched"


# ---------------------------------------------------------------- lifecycle


def test_full_lifecycle_resolves_incident_and_frees_unit(env):
    client, Session = env
    boat = _ids(Session, "NDRF-BOAT-01")[0]
    aid = _dispatch(client, 1, [boat]).json()["assignments"][0]["id"]

    assert _patch(client, aid, "en_route").json()["status"] == "en_route"
    on_scene = _patch(client, aid, "on_scene")
    assert on_scene.status_code == 200
    detail = client.get("/api/incidents/1").json()
    assert detail["status"] == "on_scene"

    done = _patch(client, aid, "completed").json()
    assert done["status"] == "completed" and done["resource"]["status"] == "available"
    detail = client.get("/api/incidents/1").json()
    assert detail["status"] == "resolved" and detail["resolved_at"] is not None
    with Session() as db:
        a = db.get(m.Assignment, aid)
        assert a.on_scene_at is not None
        assert db.get(m.Resource, boat).current_incident_id is None


def test_steps_may_be_skipped_but_never_reversed(env):
    client, Session = env
    aid = _dispatch(client, 1, _ids(Session, "108-AMD-01")).json()["assignments"][0]["id"]
    assert _patch(client, aid, "on_scene").status_code == 200  # skipped en_route
    r = _patch(client, aid, "en_route")
    assert r.status_code == 409 and "back to en_route" in r.json()["detail"]


def test_same_status_is_idempotent(env):
    client, Session = env
    aid = _dispatch(client, 1, _ids(Session, "108-AMD-01")).json()["assignments"][0]["id"]
    _patch(client, aid, "en_route")
    with Session() as db:
        audits = db.scalar(select(func.count()).select_from(m.AuditLog))
    assert _patch(client, aid, "en_route").status_code == 200
    with Session() as db:
        assert db.scalar(select(func.count()).select_from(m.AuditLog)) == audits  # nothing recorded twice


def test_finished_assignment_cannot_change(env):
    client, Session = env
    aid = _dispatch(client, 1, _ids(Session, "108-AMD-01")).json()["assignments"][0]["id"]
    _patch(client, aid, "completed")
    for status in ("en_route", "cancelled"):
        r = _patch(client, aid, status)
        assert r.status_code == 409 and "already completed" in r.json()["detail"]


def test_incident_waits_for_all_units(env):
    client, Session = env
    a1, a2 = (a["id"] for a in _dispatch(client, 1, _ids(Session, "NDRF-BOAT-01", "108-AMD-01")).json()["assignments"])
    _patch(client, a1, "on_scene")
    _patch(client, a2, "on_scene")
    _patch(client, a1, "completed")
    assert client.get("/api/incidents/1").json()["status"] == "on_scene"
    _patch(client, a2, "completed")
    assert client.get("/api/incidents/1").json()["status"] == "resolved"


def test_cancelling_every_unit_returns_incident_to_triaged(env):
    client, Session = env
    ids = _ids(Session, "NDRF-BOAT-01", "108-AMD-01")
    a1, a2 = (a["id"] for a in _dispatch(client, 1, ids).json()["assignments"])
    _patch(client, a1, "cancelled")
    _patch(client, a2, "cancelled")
    detail = client.get("/api/incidents/1").json()
    assert detail["status"] == "triaged" and detail["resolved_at"] is None
    with Session() as db:
        assert all(db.get(m.Resource, r).status == "available" for r in ids)
    assert _dispatch(client, 1, ids).status_code == 200  # can be re-dispatched


def test_cancel_one_complete_other_resolves(env):
    client, Session = env
    a1, a2 = (a["id"] for a in _dispatch(client, 1, _ids(Session, "NDRF-BOAT-01", "108-AMD-01")).json()["assignments"])
    _patch(client, a1, "cancelled")
    _patch(client, a2, "completed")
    assert client.get("/api/incidents/1").json()["status"] == "resolved"


def test_extra_units_do_not_step_back_an_on_scene_incident(env):
    client, Session = env
    first = _dispatch(client, 1, _ids(Session, "NDRF-BOAT-01")).json()
    _patch(client, first["assignments"][0]["id"], "on_scene")
    more = _dispatch(client, 1, _ids(Session, "NDRF-BOAT-02")).json()
    assert more["status"] == "on_scene" and more["dispatched_at"] == first["dispatched_at"]
    assert len(more["assignments"]) == 2


def test_patch_errors(env):
    client, _ = env
    assert _patch(client, 999, "en_route").status_code == 404
    assert client.patch("/api/assignments/1", json={"status": "arrived"}).status_code == 422


# ---------------------------------------------------------------- listing (used by /field and /resources)


def test_list_assignments_filters(env):
    client, Session = env
    boat, amb = _ids(Session, "NDRF-BOAT-01", "108-AMD-01")
    a_boat = _dispatch(client, 1, [boat]).json()["assignments"][0]["id"]
    _dispatch(client, 2, [amb])
    _patch(client, a_boat, "completed")

    assert len(client.get("/api/assignments").json()) == 2
    active = client.get("/api/assignments", params={"active": "true"}).json()
    assert [a["resource"]["callsign"] for a in active] == ["108-AMD-01"]
    mine = client.get("/api/assignments", params={"resource_id": boat, "active": "true"}).json()
    assert mine == []
    assert len(client.get("/api/assignments", params={"incident_id": 2}).json()) == 1
    assert client.get("/api/assignments", params={"resource_id": 0}).status_code == 422


# ---------------------------------------------------------------- BE2 analytics sees the timings


def test_analytics_reads_dispatch_and_scene_times(env):
    client, Session = env
    aid = _dispatch(client, 1, _ids(Session, "NDRF-BOAT-01")).json()["assignments"][0]["id"]
    _patch(client, aid, "on_scene")
    summary = client.get("/api/analytics/summary").json()
    assert summary["avg_time_to_dispatch_sec"] is not None and summary["avg_time_to_scene_sec"] is not None


# ---------------------------------------------------------------- concurrency


def test_two_dispatchers_racing_for_one_boat(tmp_path):
    eng = create_engine(f"sqlite:///{(tmp_path / 'race.db').as_posix()}",
                        connect_args={"check_same_thread": False, "timeout": 30})
    Session = _setup(eng)
    try:
        with TestClient(app) as client:
            (boat,) = _ids(Session, "NDRF-BOAT-01")
            codes: list[int] = []
            barrier = threading.Barrier(2)

            def go(incident_id):
                barrier.wait()
                codes.append(_dispatch(client, incident_id, [boat]).status_code)

            threads = [threading.Thread(target=go, args=(i,)) for i in (1, 2)]
            for t in threads:
                t.start()
            for t in threads:
                t.join()
        assert sorted(codes) == [200, 409]
        with Session() as db:
            assert db.scalar(select(func.count()).select_from(m.Assignment)) == 1
    finally:
        app.dependency_overrides.clear()
        eng.dispose()
