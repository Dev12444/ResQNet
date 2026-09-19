"""Escalation loop + alert tests (Task 12). Owner: BE1.

Rules run against a frozen clock so SLA boundaries are exact.
"""
import asyncio
import contextlib
import threading
import time
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, select, update
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models as m
from app.config import Settings, get_settings
from app.db import Base, get_db
from app.main import app
from app.seed import reset_database
from app.services import escalation
from app.services.escalation import EscalationLoop, evaluate, run_tick
from app.ws_manager import manager

T0 = datetime(2026, 9, 19, 8, 0, tzinfo=timezone.utc)
ST = Settings(sla_p1_dispatch_sec=120, sla_p2_dispatch_sec=300, sla_no_update_sec=600,
              auto_escalate_after_breaches=2)


@pytest.fixture(autouse=True)
def ai_off(monkeypatch):
    monkeypatch.setenv("AI_ENABLED", "false")
    monkeypatch.setenv("LLM_CACHE_PATH", "")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture()
def Session():
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)

    @event.listens_for(eng, "connect")
    def _fk(dbapi_conn, _record):
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(eng)
    S = sessionmaker(bind=eng, expire_on_commit=False)
    with S() as db:
        reset_database(db)
    yield S
    eng.dispose()


def _incident(db, code="INC-0001", type_="flood", severity=4, priority="P1", status="new", hazards=None,
              address="Akhbarnagar Underpass"):
    inc = m.Incident(code=code, type=type_, severity=severity, priority=priority, status=status,
                     title=f"{type_} {code}", lat=23.0588, lng=72.562, address=address,
                     hazards=hazards or [], created_at=T0, updated_at=T0)
    db.add(inc)
    db.commit()
    return inc


def _tick(db, seconds, st=ST):
    result = evaluate(db, now=T0 + timedelta(seconds=seconds), settings=st)
    db.commit()
    return [(a.kind, a.message) for a in result.alerts]


def _kinds(db, seconds, st=ST):
    return [k for k, _ in _tick(db, seconds, st)]


# ---------------------------------------------------------------- critical


def test_critical_fires_once_for_p1_only(Session):
    with Session() as db:
        _incident(db)
        _incident(db, code="INC-0002", type_="fire", severity=3, priority="P2", address="C.G. Road")
        alerts = _tick(db, 1)
        assert [(k, "INC-0001" in msg) for k, msg in alerts] == [("critical", True)]
        assert "Akhbarnagar Underpass" in alerts[0][1]
        assert _tick(db, 2) == []


def test_acknowledged_critical_does_not_refire(Session):
    with Session() as db:
        _incident(db)
        _tick(db, 1)
        db.execute(update(m.Alert).values(acknowledged=True))
        db.commit()
        assert "critical" not in _kinds(db, 5)


# ---------------------------------------------------------------- dispatch SLA + auto escalation


def test_p1_dispatch_sla_boundaries_and_auto_escalation(Session):
    with Session() as db:
        inc = _incident(db, type_="industrial", hazards=["gas_leak"], address="Vatva GIDC")
        _tick(db, 1)  # critical (+ nothing else: hazmat available)
        assert _kinds(db, 119) == []
        breach = _tick(db, 121)
        assert breach == [("sla_breach", "P1 industrial INC-0001 (Vatva GIDC) not dispatched for 2 min")]
        assert _kinds(db, 200) == []  # once
        assert db.get(m.Incident, inc.id).status == "new"
        esc = _tick(db, 241)  # second SLA period
        assert [k for k, _ in esc] == ["escalation"] and "escalated automatically" in esc[0][1]
        assert db.get(m.Incident, inc.id).status == "escalated"
        assert _kinds(db, 500) == []


def test_p2_uses_its_own_sla(Session):
    with Session() as db:
        _incident(db, type_="fire", severity=3, priority="P2", address="C.G. Road")
        assert _kinds(db, 299) == []
        assert _kinds(db, 301) == ["sla_breach"]


def test_p3_has_no_dispatch_sla(Session):
    with Session() as db:
        _incident(db, type_="other", severity=2, priority="P3")
        assert _kinds(db, 10_000) == []


def test_auto_escalation_can_be_disabled(Session):
    st = ST.model_copy(update={"auto_escalate_after_breaches": 0})
    with Session() as db:
        inc = _incident(db)
        assert "escalation" not in _kinds(db, 10_000, st)
        assert db.get(m.Incident, inc.id).status == "new"


def test_human_de_escalation_is_respected(Session):
    with Session() as db:
        inc = _incident(db)
        _tick(db, 241)
        inc = db.get(m.Incident, inc.id)
        assert inc.status == "escalated"
        inc.status = "triaged"  # dispatcher de-escalates
        db.commit()
        assert "escalation" not in _kinds(db, 1000)
        assert db.get(m.Incident, inc.id).status == "triaged"


def test_dispatched_incident_has_no_dispatch_breach(Session):
    with Session() as db:
        inc = _incident(db)
        boat = db.scalars(select(m.Resource).where(m.Resource.callsign == "NDRF-BOAT-01")).one()
        db.add(m.Assignment(incident_id=inc.id, resource_id=boat.id, status="assigned",
                            created_at=T0, updated_at=T0 + timedelta(seconds=30)))
        boat.status = "assigned"
        inc.status, inc.dispatched_at = "dispatched", T0 + timedelta(seconds=30)
        db.commit()
        assert [k for k in _kinds(db, 400) if k != "critical"] == []


# ---------------------------------------------------------------- no-update SLA


def test_silent_unit_triggers_one_no_update_breach(Session):
    with Session() as db:
        inc = _incident(db, status="dispatched")
        boat = db.scalars(select(m.Resource).where(m.Resource.callsign == "NDRF-BOAT-01")).one()
        db.add(m.Assignment(incident_id=inc.id, resource_id=boat.id, status="en_route",
                            created_at=T0, updated_at=T0))
        db.commit()
        _tick(db, 1)
        assert _kinds(db, 599) == []
        alerts = _tick(db, 601)
        assert alerts == [("sla_breach", "No status update from NDRF-BOAT-01 on INC-0001 for 10 min (status en_route)")]
        assert _kinds(db, 2000) == []


# ---------------------------------------------------------------- shortage


def test_shortage_names_the_kind_and_matches_be2_analytics(Session):
    with Session() as db:
        db.execute(update(m.Resource).where(m.Resource.kind == "rescue_boat").values(status="offline"))
        db.commit()
        _incident(db)
        alerts = _tick(db, 1)
        assert ("shortage", "No rescue boats available for INC-0001 (flood)") in alerts
        assert "shortage" not in _kinds(db, 5)  # open alert exists -> no duplicate

        from app.routers.analytics import compute_shortages
        rows = compute_shortages(db.scalars(select(m.Alert)).all(), db.scalars(select(m.Resource)).all())
        boats = next(r for r in rows if r["kind"] == "rescue_boat")
        assert boats["shortage_alerts"] == 1 and boats["available"] == 0


def test_shortage_refires_after_ack_while_still_short(Session):
    with Session() as db:
        db.execute(update(m.Resource).where(m.Resource.kind == "hazmat").values(status="offline"))
        db.commit()
        _incident(db, type_="industrial", hazards=["gas_leak"], address="Vatva GIDC")
        assert ("shortage", "No hazmat units available for INC-0001 (industrial)") in _tick(db, 1)
        db.execute(update(m.Alert).where(m.Alert.kind == "shortage").values(acknowledged=True))
        db.commit()
        assert "shortage" in _kinds(db, 20)


def test_resolved_incidents_are_ignored(Session):
    with Session() as db:
        _incident(db, status="resolved")
        assert _kinds(db, 10_000) == []


def test_only_selected_incidents(Session):
    with Session() as db:
        a = _incident(db)
        _incident(db, code="INC-0002")
        result = evaluate(db, now=T0, settings=ST, incident_ids=[a.id])
        assert {al.incident_id for al in result.alerts} == {a.id}


# ---------------------------------------------------------------- run_tick / loop


def test_run_tick_commits_and_broadcasts(Session):
    with Session() as db:
        _incident(db)

    def _db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _db
    try:
        with TestClient(app) as client, client.websocket_connect("/ws") as ws:
            end = time.monotonic() + 3
            while manager.client_count < 1 and time.monotonic() < end:
                time.sleep(0.02)
            result = run_tick(Session, now=T0 + timedelta(seconds=241))
            assert [a.kind for a in result.alerts] == ["critical", "sla_breach", "escalation"]
            events = [ws.receive_json() for _ in range(4)]
            assert [e["event"] for e in events] == ["incident.updated", "alert.created", "alert.created",
                                                    "alert.created"]
            assert events[0]["data"]["status"] == "escalated"
            alerts = client.get("/api/alerts").json()
            assert {a["kind"] for a in alerts} == {"critical", "sla_breach", "escalation"}
    finally:
        app.dependency_overrides.clear()


def test_run_tick_never_raises():
    def broken():
        raise RuntimeError("database down")

    assert run_tick(broken).alerts == []


def test_loop_ticks_and_stops(monkeypatch):
    calls = []
    monkeypatch.setattr(escalation, "run_tick", lambda factory: calls.append(factory))

    async def scenario():
        lp = EscalationLoop()
        await lp.start(lambda: None, 0.05)
        await asyncio.sleep(0.3)
        assert lp.running
        await lp.stop()
        return lp

    lp = asyncio.run(scenario())
    assert len(calls) >= 3 and not lp.running


def test_loop_disabled_when_tick_is_zero():
    async def scenario():
        lp = EscalationLoop()
        await lp.start(lambda: None, 0)
        return lp.running

    assert asyncio.run(scenario()) is False


# ---------------------------------------------------------------- ack endpoint


def test_ack_endpoint(Session):
    with Session() as db:
        _incident(db)
        _tick(db, 1)

    def _db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _db
    try:
        with TestClient(app) as client:
            alert_id = client.get("/api/alerts").json()[0]["id"]
            r = client.post(f"/api/alerts/{alert_id}/ack", headers={"X-Actor": "dispatcher-2"})
            assert r.status_code == 200 and r.json()["acknowledged"] is True
            assert r.json()["incident_code"] == "INC-0001"
            assert client.post(f"/api/alerts/{alert_id}/ack").status_code == 200  # idempotent
            assert client.get("/api/alerts", params={"acknowledged": "false"}).json() == []
            assert client.post("/api/alerts/999/ack").status_code == 404
        with Session() as db:
            acks = db.scalars(select(m.AuditLog).where(m.AuditLog.action == "alert.acknowledged")).all()
            assert len(acks) == 1 and acks[0].actor == "dispatcher-2"
    finally:
        app.dependency_overrides.clear()


def test_new_p1_report_gets_critical_alert_immediately(Session):
    def _db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _db
    try:
        with TestClient(app) as client:
            client.post("/api/reports", json={"source": "citizen", "lat": 23.0588, "lng": 72.562,
                                              "text": "Car stuck in Akhbarnagar underpass, two people inside"})
            alerts = client.get("/api/alerts").json()  # no tick needed: checked right after the report
            assert [a["kind"] for a in alerts] == ["critical"]
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------- concurrency


def test_concurrent_checks_create_one_alert(tmp_path, monkeypatch):
    """The loop tick and a report's immediate check can evaluate the same incident at once.

    A barrier inside add_alert() holds the first thread after its "already alerted?" check until
    the second arrives (or 0.5 s pass): without serialisation both would insert a critical alert.
    """
    eng = create_engine(f"sqlite:///{(tmp_path / 'race.db').as_posix()}",
                        connect_args={"check_same_thread": False, "timeout": 30})
    Base.metadata.create_all(eng)
    S = sessionmaker(bind=eng, expire_on_commit=False)
    with S() as db:
        reset_database(db)
        inc_id = _incident(db).id

    barrier = threading.Barrier(2, timeout=0.5)
    real_add = escalation.add_alert

    def slow_add(db, **kw):
        # BrokenBarrierError = serialised: the other thread is waiting for us, not beside us.
        with contextlib.suppress(threading.BrokenBarrierError):
            barrier.wait()
        return real_add(db, **kw)

    monkeypatch.setattr(escalation, "add_alert", slow_add)
    threads = [threading.Thread(target=run_tick, args=(S,), kwargs={"incident_ids": [inc_id]}) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(10)
    with S() as db:
        kinds = db.scalars(select(m.Alert.kind).where(m.Alert.incident_id == inc_id)).all()
    eng.dispose()
    assert kinds.count("critical") == 1
