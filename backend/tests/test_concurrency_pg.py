"""Row-locking races, forced step by step on a real Postgres (Task 15). Owner: BE1.

They need real row locks and concurrent connections, so they run only with TEST_POSTGRES_URL set
(a throwaway DB: the tables are dropped and recreated), e.g.
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


AKH = {"source": "citizen", "lat": 23.0588, "lng": 72.562, "text": "Car stuck in Akhbarnagar underpass, water rising"}


@pytest.mark.parametrize("pause", ["after_dedup", "after_row_lock"])
def test_report_never_merges_into_an_incident_resolved_meanwhile(pg, monkeypatch, pause):
    """Dedup picks an open incident, then (paused) a supervisor resolves it.

    Valid outcomes: the report opens a NEW incident (resolve won the race), or it merged first and
    the resolve closed the incident afterwards. Invalid: a new report inside an incident that was
    already resolved (it silently drops off the dashboard queue).
    """
    from app import pipeline
    from app.services import triage as triage_mod

    client, Session = pg
    first = client.post("/api/reports", json=AKH).json()["incident"]["id"]
    paused, rival_done = threading.Event(), threading.Event()

    def hold():
        if not paused.is_set():
            paused.set()
            rival_done.wait(PAUSE_SEC)

    if pause == "after_dedup":  # before the pipeline locks the matched incident
        real_find = triage_mod.dedup.find_match
        monkeypatch.setattr(triage_mod.dedup, "find_match", lambda *a, **kw: (real_find(*a, **kw), hold())[0])
    else:  # the pipeline holds the incident row: the resolve must wait for the merge
        real_apply = pipeline.apply_to_incident
        monkeypatch.setattr(pipeline, "apply_to_incident",
                            lambda inc, cls, is_new: (is_new or hold(), real_apply(inc, cls, is_new))[1])
    out, codes, finished = {}, {}, []

    def do_report():
        r = client.post("/api/reports", json={**AKH, "source": "call"})
        codes["report"], out["body"] = r.status_code, r.json()
        finished.append("report")

    def do_resolve():
        codes["resolve"] = client.patch(f"/api/incidents/{first}", json={"status": "resolved"}).status_code
        finished.append("resolve")

    t = _run(do_report)
    assert paused.wait(5)
    r = _run(do_resolve)
    t.join(10)
    rival_done.set()
    r.join(10)

    assert codes == {"report": 201, "resolve": 200}
    landed = out["body"]["incident"]
    with Session() as db:
        old = db.get(m.Incident, first)
        assert old.status == "resolved"
        if pause == "after_dedup":  # resolve committed first: the report must open a new incident
            assert (landed["id"], out["body"]["merged"], landed["status"]) != (first, True, "new")
            assert landed["id"] != first and landed["status"] == "new" and old.report_count == 1
        else:  # the resolve waited for the merge's row lock: merged while open, resolved afterwards
            assert finished == ["report", "resolve"], "resolve did not wait for the merge"
            assert (landed["id"], out["body"]["merged"], old.report_count) == (first, True, 2)


def test_marking_a_unit_offline_while_it_is_dispatched(pg, monkeypatch):
    """PATCH /api/resources (paused after its check) races a dispatch claiming the same unit.

    Valid: one wins cleanly (offline + dispatch 409, or assigned + PATCH 409). Invalid: both 200
    and the unit "offline" while holding an active assignment.
    """
    from app.routers import resources as res_router

    client, Session = pg
    inc_id, unit = _incident(Session), _free_unit(Session)
    paused, rival_done = threading.Event(), threading.Event()
    real_record = res_router.audit.record

    def slow_record(*a, **kw):
        if not paused.is_set():
            paused.set()
            rival_done.wait(PAUSE_SEC)
        return real_record(*a, **kw)

    monkeypatch.setattr(res_router.audit, "record", slow_record)
    codes = {}
    t = _run(lambda: codes.__setitem__(
        "patch", client.patch(f"/api/resources/{unit}", json={"status": "offline"}).status_code))
    assert paused.wait(5)
    codes["dispatch"] = client.post(f"/api/incidents/{inc_id}/dispatch", json={"resource_ids": [unit]}).status_code
    rival_done.set()
    t.join(10)

    with Session() as db:
        res = db.get(m.Resource, unit)
        active = db.scalars(select(m.Assignment).where(m.Assignment.resource_id == unit,
                                                       m.Assignment.status.in_(m.ACTIVE_ASSIGNMENT_STATUSES))).all()
    assert sorted(codes.values()) == [200, 409], codes
    if active:
        assert (res.status, res.current_incident_id) == ("assigned", inc_id)
    else:
        assert (res.status, res.current_incident_id) == ("offline", None)
