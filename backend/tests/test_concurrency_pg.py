"""Row-locking races that only a real Postgres can show (Task 15). Owner: BE1.

SQLite serialises every write, so these run only with TEST_POSTGRES_URL set (a throwaway DB:
the tables are dropped and recreated), e.g.
    TEST_POSTGRES_URL=postgresql://postgres@127.0.0.1:55432/resqnet_test pytest tests/test_concurrency_pg.py

Each test pauses one request at a hook inside its transaction, fires the competing request, and
checks the end state is one of the valid serial outcomes.
"""
import os
import threading
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import sessionmaker

from app import models as m
from app.config import get_settings
from app.db import Base, engine_options, get_db, normalize_database_url
from app.main import app
from app.routers import dispatch as dispatch_router
from app.seed import reset_database

pytestmark = pytest.mark.skipif(not os.environ.get("TEST_POSTGRES_URL"), reason="TEST_POSTGRES_URL not set")

PAUSE_SEC = 1.0  # how long the paused request waits for its rival (it gives up if the rival is blocked)


@pytest.fixture()
def pg(monkeypatch):
    monkeypatch.setenv("AI_ENABLED", "false")
    monkeypatch.setenv("LLM_CACHE_PATH", "")
    monkeypatch.setenv("ESCALATION_TICK_SEC", "0")
    get_settings.cache_clear()
    url = normalize_database_url(os.environ["TEST_POSTGRES_URL"])
    eng = create_engine(url, **engine_options(url))
    Base.metadata.drop_all(eng)
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
    get_settings.cache_clear()


def _incident(Session, status="triaged") -> int:
    now = datetime.now(timezone.utc)
    with Session() as db:
        inc = m.Incident(code="INC-0001", type="flood", severity=3, priority="P2", status=status, title="Flooded lane",
                         lat=23.0588, lng=72.562, hazards=[], created_at=now, updated_at=now)
        db.add(inc)
        db.commit()
        return inc.id


def _free_unit(Session, kind="rescue_boat") -> int:
    with Session() as db:
        return db.scalars(select(m.Resource.id).where(m.Resource.kind == kind, m.Resource.status == "available")
                          .order_by(m.Resource.id)).first()


def _run(target) -> threading.Thread:
    t = threading.Thread(target=target)
    t.start()
    return t


@pytest.mark.parametrize("pause", ["before_claim", "after_claim"])
def test_dispatch_racing_resolve_never_leaves_a_unit_on_a_closed_incident(pg, monkeypatch, pause):
    """Dispatch reads the open incident, then (paused) a supervisor resolves it.

    Valid outcomes: resolve waits for the dispatch and then closes the new assignment, or the
    dispatch sees the resolved incident and gets a 409. Invalid: incident "dispatched" with
    resolved_at set, or a unit still assigned to a resolved incident.
    Paused after the unit claim, the claim's foreign-key lock on the incident already blocks the
    resolve; paused before it, only dispatch's own incident row lock does.
    """
    client, Session = pg
    inc_id, unit = _incident(Session), _free_unit(Session)
    paused, rival_done = threading.Event(), threading.Event()

    def hold():
        if not paused.is_set():
            paused.set()
            rival_done.wait(PAUSE_SEC)

    if pause == "after_claim":
        real_eta = dispatch_router._eta
        monkeypatch.setattr(dispatch_router, "_eta", lambda r, i: (hold(), real_eta(r, i))[1])
    else:  # the dispatch's own "SELECT resources WHERE id IN (...)", just before the claim UPDATE
        def on_execute(state):
            if state.is_select and any(d.get("entity") is m.Resource for d in state.statement.column_descriptions):
                hold()

        event.listen(Session, "do_orm_execute", on_execute)
    codes = {}

    def do_dispatch():
        codes["dispatch"] = client.post(f"/api/incidents/{inc_id}/dispatch", json={"resource_ids": [unit]}).status_code

    def do_resolve():
        codes["resolve"] = client.patch(f"/api/incidents/{inc_id}", json={"status": "resolved"}).status_code
        rival_done.set()

    a = _run(do_dispatch)
    assert paused.wait(5)
    b = _run(do_resolve)
    a.join(10)
    b.join(10)
    if pause == "before_claim":
        event.remove(Session, "do_orm_execute", on_execute)

    assert codes["resolve"] == 200 and codes["dispatch"] in (200, 409)
    with Session() as db:
        inc = db.get(m.Incident, inc_id)
        res = db.get(m.Resource, unit)
        active = db.scalars(select(m.Assignment).where(m.Assignment.incident_id == inc_id,
                                                       m.Assignment.status.in_(m.ACTIVE_ASSIGNMENT_STATUSES))).all()
        assert (inc.status, inc.resolved_at is not None) == ("resolved", True)
        assert active == []
        assert (res.status, res.current_incident_id) == ("available", None)


def test_field_tap_racing_resolve_does_not_deadlock(pg, monkeypatch):
    """A field "on scene" tap and a supervisor's resolve touch the same incident + assignment.

    Both must take their row locks in the same order (incident first), or Postgres aborts one
    with a deadlock (a 500). Valid outcomes: resolve closes the unit after the tap, or the tap
    hits an already-closed assignment and gets a 409.
    """
    client, Session = pg
    inc_id, unit = _incident(Session), _free_unit(Session)
    assert client.post(f"/api/incidents/{inc_id}/dispatch", json={"resource_ids": [unit]}).status_code == 200
    with Session() as db:
        a_id = db.scalars(select(m.Assignment.id).where(m.Assignment.incident_id == inc_id)).one()

    paused, rival_done = threading.Event(), threading.Event()
    real_check = dispatch_router._check_transition

    def slow_check(current, new):
        paused.set()
        rival_done.wait(PAUSE_SEC)
        return real_check(current, new)

    monkeypatch.setattr(dispatch_router, "_check_transition", slow_check)
    codes = {}

    def do_tap():
        codes["tap"] = client.patch(f"/api/assignments/{a_id}", json={"status": "on_scene"}).status_code

    def do_resolve():
        codes["resolve"] = client.patch(f"/api/incidents/{inc_id}", json={"status": "resolved"}).status_code
        rival_done.set()

    t = _run(do_tap)
    assert paused.wait(5)
    r = _run(do_resolve)
    t.join(10)
    r.join(10)

    assert codes["resolve"] == 200 and codes["tap"] in (200, 409), codes
    with Session() as db:
        inc = db.get(m.Incident, inc_id)
        a = db.get(m.Assignment, a_id)
        res = db.get(m.Resource, unit)
        assert inc.status == "resolved" and a.status in ("completed", "cancelled")
        assert (res.status, res.current_incident_id) == ("available", None)


def test_auto_escalation_does_not_overwrite_a_concurrent_dispatch(pg, monkeypatch):
    """The loop reads an overdue P1, then (paused) a dispatcher sends a unit and commits.

    The loop must not then flip the incident to "escalated" (units out, yet shown as waiting).
    """
    from datetime import timedelta

    from app.services import escalation

    client, Session = pg
    inc_id, unit = _incident(Session), _free_unit(Session)
    long_ago = datetime.now(timezone.utc) - timedelta(hours=1)  # many SLA periods: auto-escalation due
    with Session() as db:
        inc = db.get(m.Incident, inc_id)
        inc.priority, inc.severity, inc.created_at = "P1", 5, long_ago
        db.commit()

    paused, rival_done = threading.Event(), threading.Event()
    real_sla = escalation._dispatch_sla

    def slow_sla(inc, st):
        paused.set()
        rival_done.wait(PAUSE_SEC)
        return real_sla(inc, st)

    monkeypatch.setattr(escalation, "_dispatch_sla", slow_sla)
    tick = _run(lambda: escalation.run_tick(Session, incident_ids=[inc_id]))
    assert paused.wait(5)
    assert client.post(f"/api/incidents/{inc_id}/dispatch", json={"resource_ids": [unit]}).status_code == 200
    rival_done.set()
    tick.join(10)

    with Session() as db:
        assert db.get(m.Incident, inc_id).status == "dispatched"
        kinds = db.scalars(select(m.Alert.kind).where(m.Alert.incident_id == inc_id)).all()
    assert "escalation" not in kinds
