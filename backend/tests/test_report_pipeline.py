"""POST /api/reports pipeline tests (Task 8). Owner: BE1.

AI is forced off (rule-based fallback, no embeddings, no disk cache) so results are
deterministic and no paid API is ever called, even if .env has keys.
"""
import threading
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

AKHBARNAGAR_GU = "અખબારનગર અંડરપાસમાં ગાડી ફસાઈ છે, પાણી વધી રહ્યું છે"
AKHBARNAGAR_EN = "Car stuck in Akhbarnagar underpass, water rising fast, two people inside"


@pytest.fixture(autouse=True)
def ai_off(monkeypatch):
    monkeypatch.setenv("AI_ENABLED", "false")
    monkeypatch.setenv("LLM_CACHE_PATH", "")
    get_settings.cache_clear()
    summarizer._last.clear()  # debounce cache is keyed by incident id, which repeats across tests
    yield
    pipeline.cancel_trailing_refreshes()
    get_settings.cache_clear()
    summarizer._last.clear()


def _make_client(eng):
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
    return Session


@pytest.fixture()
def env():
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Session = _make_client(eng)
    with TestClient(app) as client:
        yield client, Session
    app.dependency_overrides.clear()
    eng.dispose()


def _post(client, **body):
    return client.post("/api/reports", json=body)


def _count(Session, model):
    with Session() as db:
        return db.scalar(select(func.count()).select_from(model))


# ---------------------------------------------------------------- golden path


def test_golden_path_gujarati_report_creates_p1_flood(env):
    client, Session = env
    r = _post(client, source="citizen", text=AKHBARNAGAR_GU, lat=23.0588, lng=72.5620, reporter="Citizen app")
    assert r.status_code == 201, r.text
    body = r.json()
    assert set(body) == {"report", "incident", "merged", "classification"}
    inc, rep, cls = body["incident"], body["report"], body["classification"]
    assert body["merged"] is False
    assert inc["code"] == "INC-0001" and inc["type"] == "flood" and inc["priority"] == "P1"
    assert inc["status"] == "new" and inc["report_count"] == 1
    assert rep["incident_id"] == inc["id"] and rep["lang"] == "gu"
    assert cls["source_model"] == "fallback" and cls["type"] == "flood"
    with Session() as db:
        stored = db.get(m.Report, rep["id"])
        assert stored.ai_json["type"] == "flood"  # classification cached on the report


def test_duplicate_report_merges_into_same_incident(env):
    client, _ = env
    first = _post(client, source="citizen", text=AKHBARNAGAR_GU, lat=23.0588, lng=72.5620).json()
    second = _post(client, source="call", text=AKHBARNAGAR_EN, lat=23.0590, lng=72.5623).json()
    assert second["merged"] is True
    assert second["incident"]["id"] == first["incident"]["id"]
    assert second["incident"]["report_count"] == 2
    detail = client.get(f"/api/incidents/{first['incident']['id']}").json()
    assert [r["source"] for r in detail["reports"]] == ["citizen", "call"]


def test_unrelated_report_creates_second_incident(env):
    client, _ = env
    _post(client, source="citizen", text=AKHBARNAGAR_EN, lat=23.0588, lng=72.5620)
    fire = _post(client, source="citizen", text="Fire in a commercial complex on C.G. Road, people on terrace",
                 lat=23.0290, lng=72.5600).json()
    assert fire["merged"] is False and fire["incident"]["code"] == "INC-0002" and fire["incident"]["type"] == "fire"


def test_sensor_report_uses_rules(env):
    client, _ = env
    r = _post(client, source="sensor", lat=22.996, lng=72.558,
              sensor={"sensor_id": "VASNA-WL-01", "metric": "water_level_m", "value": 4.9, "threshold": 4.2,
                      "unit": "m"}).json()
    assert r["classification"]["source_model"] == "rules" and r["incident"]["type"] == "flood"
    assert r["report"]["sensor"]["sensor_id"] == "VASNA-WL-01"


def test_report_without_gps_is_geocoded_from_text(env):
    client, _ = env
    r = _post(client, source="citizen", text="Waterlogging at Akhbarnagar underpass, a car is stuck").json()
    assert r["report"]["lat"] == pytest.approx(23.0588) and r["incident"]["address"]
    assert r["incident"]["confidence"] > 0.4


def test_unlocatable_report_goes_to_city_centre_with_low_confidence(env):
    client, _ = env
    r = _post(client, source="citizen", text="help needed urgently").json()
    assert (r["report"]["lat"], r["report"]["lng"]) == pytest.approx((23.0225, 72.5714))
    assert r["incident"]["confidence"] <= 0.4


# ---------------------------------------------------------------- incident_id hint (contract v1.3)


def test_field_update_with_incident_id_attaches_even_without_gps(env):
    client, _ = env
    inc = _post(client, source="citizen", text=AKHBARNAGAR_EN, lat=23.0588, lng=72.5620).json()["incident"]
    upd = _post(client, source="field", text="On scene. Two people rescued from the car roof.",
                incident_id=inc["id"]).json()
    assert upd["merged"] is True and upd["incident"]["id"] == inc["id"]
    assert (upd["report"]["lat"], upd["report"]["lng"]) == pytest.approx((23.0588, 72.5620))


def test_unknown_incident_id_is_404_and_stores_nothing(env):
    client, Session = env
    r = _post(client, source="field", text="On scene", incident_id=999)
    assert r.status_code == 404 and r.json() == {"detail": "Incident 999 not found"}
    assert _count(Session, m.Report) == 0


def test_resolved_incident_hint_is_ignored(env):
    client, Session = env
    inc = _post(client, source="citizen", text=AKHBARNAGAR_EN, lat=23.0588, lng=72.5620).json()["incident"]
    with Session() as db:
        db.get(m.Incident, inc["id"]).status = "resolved"
        db.commit()
    r = _post(client, source="field", text="Water rising again at the underpass", lat=23.0588, lng=72.5620,
              incident_id=inc["id"]).json()
    assert r["incident"]["id"] != inc["id"] and r["merged"] is False


# ---------------------------------------------------------------- validation, audit, failure


@pytest.mark.parametrize(
    "body",
    [{"source": "citizen"}, {"source": "sensor", "text": "x"}, {"source": "citizen", "text": "x", "lat": 23.0},
     {"source": "citizen", "text": "x", "incident_id": 0}, {"source": "citizen", "text": "x", "extra": 1},
     {"source": "citizen", "text": "x", "photo_url": "file:///etc/passwd"}],
)
def test_invalid_reports_rejected_and_nothing_stored(env, body):
    client, Session = env
    assert client.post("/api/reports", json=body).status_code == 422
    assert _count(Session, m.Report) == 0


def test_audit_log_records_actor(env):
    client, Session = env
    r = client.post("/api/reports", json={"source": "call", "text": AKHBARNAGAR_EN, "lat": 23.0588, "lng": 72.562},
                    headers={"X-Actor": "108-operator-7"}).json()
    with Session() as db:
        rows = db.scalars(select(m.AuditLog).order_by(m.AuditLog.id)).all()
    assert [(a.actor, a.action, a.entity) for a in rows] == [
        ("108-operator-7", "report.created", "report"), ("108-operator-7", "incident.created", "incident")]
    assert rows[0].entity_id == r["report"]["id"] and rows[1].payload["code"] == "INC-0001"


def test_default_actor_is_reporter_or_source(env):
    client, Session = env
    _post(client, source="citizen", text=AKHBARNAGAR_EN, lat=23.0588, lng=72.562, reporter="Citizen app")
    with Session() as db:
        assert db.scalars(select(m.AuditLog.actor)).first() == "Citizen app"


def test_processing_failure_keeps_raw_report(env, monkeypatch):
    client, Session = env

    def boom(*_a, **_kw):
        raise RuntimeError("triage exploded")

    monkeypatch.setattr("app.pipeline.triage", boom)
    r = _post(client, source="citizen", text=AKHBARNAGAR_EN, lat=23.0588, lng=72.562)
    assert r.status_code == 500
    assert r.json()["detail"] == "Report 1 was saved but could not be processed"
    with Session() as db:
        kept = db.get(m.Report, 1)
        assert kept is not None and kept.incident_id is None and kept.text == AKHBARNAGAR_EN
        assert db.scalar(select(func.count()).select_from(m.Incident)) == 0


# ---------------------------------------------------------------- summary + WebSocket


def test_summary_is_filled_by_background_task(env):
    client, Session = env
    inc = _post(client, source="citizen", text=AKHBARNAGAR_EN, lat=23.0588, lng=72.562).json()["incident"]
    # TestClient runs background tasks before returning; a real server does it after the response.
    with Session() as db:
        stored = db.get(m.Incident, inc["id"])
        assert stored.ai_summary and stored.ai_actions


def test_websocket_events_new_then_merge(env):
    client, _ = env
    with client.websocket_connect("/ws") as ws:
        assert _wait(lambda: manager.client_count == 1)
        first = _post(client, source="citizen", text=AKHBARNAGAR_EN, lat=23.0588, lng=72.562).json()
        events = [ws.receive_json() for _ in range(4)]
        assert [e["event"] for e in events] == ["report.created", "incident.created", "incident.updated",
                                                "alert.created"]
        assert events[1]["data"]["code"] == "INC-0001"
        assert events[2]["data"]["ai_summary"]
        assert events[3]["data"]["kind"] == "critical"  # P1: immediate check after the report (Task 12)

        _post(client, source="call", text=AKHBARNAGAR_GU, lat=23.059, lng=72.5622)
        merged = [ws.receive_json() for _ in range(2)]
        assert [e["event"] for e in merged] == ["report.created", "incident.merged"]  # no second critical alert
        assert merged[1]["data"]["incident"]["id"] == first["incident"]["id"]
        assert merged[1]["data"]["incident"]["report_count"] == 2
        assert merged[1]["data"]["report"]["source"] == "call"


def _wait(pred, timeout=3.0):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if pred():
            return True
        time.sleep(0.02)
    return False


# ---------------------------------------------------------------- concurrency


def test_concurrent_duplicates_merge_into_one_incident(tmp_path):
    """Without the pipeline lock, simultaneous reports race past dedup and create duplicate incidents."""
    eng = create_engine(f"sqlite:///{(tmp_path / 'race.db').as_posix()}",
                        connect_args={"check_same_thread": False, "timeout": 30})
    Session = _make_client(eng)
    try:
        with TestClient(app) as client:
            errors: list[int] = []

            def send(i):
                r = _post(client, source="citizen", text=f"{AKHBARNAGAR_EN} (report {i})",
                          lat=23.0588 + i * 0.00001, lng=72.5620)
                if r.status_code != 201:
                    errors.append(r.status_code)

            threads = [threading.Thread(target=send, args=(i,)) for i in range(8)]
            for t in threads:
                t.start()
            for t in threads:
                t.join()
        assert errors == []
        with Session() as db:
            incidents = db.scalars(select(m.Incident)).all()
            assert len(incidents) == 1 and incidents[0].report_count == 8
            assert db.scalar(select(func.count()).select_from(m.Report)) == 8
    finally:
        app.dependency_overrides.clear()
        eng.dispose()


def test_ai_calls_run_in_parallel_but_duplicates_still_merge(tmp_path, monkeypatch):
    """The slow AI half (prepare) runs outside the pipeline lock; only dedup + merge is serialised.

    With a 0.5 s classifier, 4 simultaneous reports take ~0.5 s instead of ~2 s, and still end up
    in ONE incident (the merge decision is still made under the lock).
    """
    from app.services import triage as triage_mod

    real_classify = triage_mod.classify

    def slow_classify(*args, **kwargs):
        time.sleep(0.5)  # stands in for an LLM call
        return real_classify(*args, **kwargs)

    monkeypatch.setattr(triage_mod, "classify", slow_classify)
    eng = create_engine(f"sqlite:///{(tmp_path / 'parallel.db').as_posix()}",
                        connect_args={"check_same_thread": False, "timeout": 30})
    Session = _make_client(eng)
    try:
        with TestClient(app) as client:
            codes: list[int] = []
            barrier = threading.Barrier(4)

            def send(i):
                barrier.wait()
                codes.append(_post(client, source="citizen", text=f"{AKHBARNAGAR_EN} (report {i})",
                                   lat=23.0588 + i * 0.00001, lng=72.5620).status_code)

            threads = [threading.Thread(target=send, args=(i,)) for i in range(4)]
            started = time.monotonic()
            for t in threads:
                t.start()
            for t in threads:
                t.join()
            elapsed = time.monotonic() - started
        assert codes == [201] * 4
        assert elapsed < 1.5, f"AI calls were serialised: {elapsed:.2f}s for 4 reports"
        with Session() as db:
            incidents = db.scalars(select(m.Incident)).all()
            assert len(incidents) == 1 and incidents[0].report_count == 4
    finally:
        app.dependency_overrides.clear()
        eng.dispose()


def test_prepare_failure_keeps_raw_report(env, monkeypatch):
    """prepare() is documented never to raise; if it ever does, the report is still kept."""
    client, Session = env

    def boom(_report):
        raise RuntimeError("classifier exploded")

    monkeypatch.setattr("app.pipeline.prepare", boom)
    r = _post(client, source="citizen", text=AKHBARNAGAR_EN, lat=23.0588, lng=72.562)
    assert r.status_code == 500 and r.json()["detail"] == "Report 1 was saved but could not be processed"
    with Session() as db:
        assert db.get(m.Report, 1).incident_id is None
        assert db.scalar(select(func.count()).select_from(m.Incident)) == 0


def test_report_does_not_merge_into_an_incident_resolved_after_dedup(tmp_path, monkeypatch):
    """Dedup picks an open incident; a supervisor resolves it before the merge commits.

    The pipeline re-reads the match under a row lock, so the new report opens a NEW incident
    instead of disappearing into the resolved one. (Postgres variants: test_concurrency_pg.py.)
    """
    from app.services import triage as triage_mod

    eng = create_engine(f"sqlite:///{(tmp_path / 'resolve.db').as_posix()}",
                        connect_args={"check_same_thread": False, "timeout": 30})
    Session = _make_client(eng)
    try:
        with TestClient(app) as client:
            first = _post(client, source="citizen", text=AKHBARNAGAR_EN, lat=23.0588, lng=72.562).json()["incident"]
            real_find = triage_mod.dedup.find_match

            def find_then_resolve(*args, **kwargs):
                match = real_find(*args, **kwargs)
                with Session() as other:  # the supervisor's resolve commits in between
                    other.get(m.Incident, first["id"]).status = "resolved"
                    other.commit()
                return match

            monkeypatch.setattr(triage_mod.dedup, "find_match", find_then_resolve)
            r = _post(client, source="call", text=AKHBARNAGAR_EN, lat=23.0589, lng=72.562)
        body = r.json()
        assert r.status_code == 201 and body["merged"] is False
        assert body["incident"]["id"] != first["id"] and body["incident"]["status"] == "new"
        with Session() as db:
            assert db.get(m.Incident, first["id"]).report_count == 1
    finally:
        app.dependency_overrides.clear()
        eng.dispose()


def test_report_in_flight_during_a_reset_is_discarded_not_misattached(tmp_path, monkeypatch):
    """A report still in its AI step when the demo is reset must not land in the fresh database.

    Ids restart at 1 after a reset, so without a guard its late UPDATE hits the NEW report 1:
    that report is moved to a ghost incident and its own incident is left with 0 reports.
    """
    eng = create_engine(f"sqlite:///{(tmp_path / 'epoch.db').as_posix()}",
                        connect_args={"check_same_thread": False, "timeout": 30})
    Session = _make_client(eng)
    entered, gate = threading.Event(), threading.Event()
    real_prepare = pipeline.prepare

    def gated_prepare(report):
        if not entered.is_set():
            entered.set()
            gate.wait(5)  # the first report is stuck in its (slow) AI call
        return real_prepare(report)

    monkeypatch.setattr(pipeline, "prepare", gated_prepare)
    fire = "Fire in a commercial complex on C.G. Road, people on the terrace"
    try:
        with TestClient(app) as client:
            out = {}
            t = threading.Thread(target=lambda: out.__setitem__(
                "r", _post(client, source="citizen", text=AKHBARNAGAR_EN, lat=23.0588, lng=72.562)))
            t.start()
            assert entered.wait(5)
            assert client.post("/api/simulator/reset").status_code == 200
            fresh = _post(client, source="call", text=fire, lat=23.029, lng=72.56)
            assert fresh.status_code == 201 and fresh.json()["report"]["id"] == 1  # the id is reused
            gate.set()
            t.join(10)
        assert out["r"].status_code == 409 and "reset" in out["r"].json()["detail"]
        with Session() as db:
            reports = db.scalars(select(m.Report)).all()
            assert [(r.id, r.text) for r in reports] == [(1, fire)]
            incidents = db.scalars(select(m.Incident)).all()
            assert [(i.type, i.report_count) for i in incidents] == [("fire", 1)]
            assert reports[0].incident_id == incidents[0].id
    finally:
        app.dependency_overrides.clear()
        eng.dispose()


def test_summary_ai_call_holds_no_db_connection(tmp_path, monkeypatch):
    """The LLM call must not pin a pooled connection (or make a reset's TRUNCATE wait for it)."""
    eng = create_engine(f"sqlite:///{(tmp_path / 'pool.db').as_posix()}",
                        connect_args={"check_same_thread": False, "timeout": 30})
    _make_client(eng)
    try:
        with TestClient(app) as client:
            inc_id = _post(client, source="citizen", text=AKHBARNAGAR_EN,
                           lat=23.0588, lng=72.562).json()["incident"]["id"]
        real = pipeline.refresh_summary
        checked_out = []

        def spy(incident, force=False):
            checked_out.append(eng.pool.checkedout())
            return real(incident, force=force)

        monkeypatch.setattr(pipeline, "refresh_summary", spy)
        pipeline.refresh_summary_in_background(eng, inc_id, force=True)
        assert checked_out == [0]
    finally:
        app.dependency_overrides.clear()
        eng.dispose()


def test_summary_is_not_written_onto_a_new_incident_that_reused_the_id(tmp_path, monkeypatch):
    """A reset during the LLM call: the incident id now belongs to a different incident."""
    eng = create_engine(f"sqlite:///{(tmp_path / 'reuse.db').as_posix()}",
                        connect_args={"check_same_thread": False, "timeout": 30})
    Session = _make_client(eng)
    try:
        with TestClient(app) as client:
            inc_id = _post(client, source="citizen", text=AKHBARNAGAR_EN,
                           lat=23.0588, lng=72.562).json()["incident"]["id"]
        real = pipeline.refresh_summary

        def reset_during_llm(incident, force=False):
            result = real(incident, force=force)
            incident.ai_summary, incident.ai_actions = "Summary of the OLD incident", ["old action"]
            with Session() as db:  # demo reset + a brand-new incident that gets the same id
                reset_database(db)
                db.add(m.Incident(type="fire", severity=3, priority="P2", status="new", title="New fire",
                                  lat=23.03, lng=72.56, report_count=1))
                db.commit()
            return result

        monkeypatch.setattr(pipeline, "refresh_summary", reset_during_llm)
        pipeline.refresh_summary_in_background(eng, inc_id, force=True)
        with Session() as db:
            new = db.get(m.Incident, inc_id)
            assert new.title == "New fire" and new.ai_summary is None and not new.ai_actions
    finally:
        app.dependency_overrides.clear()
        eng.dispose()


# ---------------------------------------------------------------- debounced summaries catch up


def test_summary_catches_up_after_debounce_window(env, monkeypatch):
    """Reports merged inside the summarizer's debounce window must still reach the summary."""
    client, Session = env
    monkeypatch.setattr(summarizer, "MIN_INTERVAL_SEC", 0.4)
    with client.websocket_connect("/ws") as ws:
        assert _wait(lambda: manager.client_count == 1)
        inc = _post(client, source="citizen", text=AKHBARNAGAR_EN, lat=23.0588, lng=72.562).json()["incident"]
        [ws.receive_json() for _ in range(4)]  # report.created, incident.created, incident.updated, alert.created
        with Session() as db:
            first_summary = db.get(m.Incident, inc["id"]).ai_summary
        _post(client, source="call", text=AKHBARNAGAR_GU, lat=23.059, lng=72.5622)
        _post(client, source="citizen", text="Akhbarnagar underpass flooded, car trapped", lat=23.0589, lng=72.5621)
        assert [ws.receive_json()["event"] for _ in range(4)] == [
            "report.created", "incident.merged", "report.created", "incident.merged"]
        with Session() as db:
            assert db.get(m.Incident, inc["id"]).ai_summary == first_summary  # debounced for now

        caught_up = ws.receive_json()  # one trailing refresh after the window
        assert caught_up["event"] == "incident.updated"
        assert caught_up["data"]["ai_summary"] != first_summary
        assert caught_up["data"]["report_count"] == 3
    with Session() as db:
        assert db.get(m.Incident, inc["id"]).ai_summary == caught_up["data"]["ai_summary"]


def test_only_one_trailing_refresh_per_incident(env, monkeypatch):
    client, _ = env
    monkeypatch.setattr(summarizer, "MIN_INTERVAL_SEC", 30)
    _post(client, source="citizen", text=AKHBARNAGAR_EN, lat=23.0588, lng=72.562)
    for i in range(4):
        _post(client, source="call", text=f"{AKHBARNAGAR_GU} {i}", lat=23.059, lng=72.5622)
    assert list(pipeline._trailing_refresh) == [1]
    pipeline.cancel_trailing_refreshes()
    assert pipeline._trailing_refresh == {}


def test_trailing_refresh_for_deleted_incident_is_harmless(env):
    client, Session = env
    inc = _post(client, source="citizen", text=AKHBARNAGAR_EN, lat=23.0588, lng=72.562).json()["incident"]
    with Session() as db:
        reset_database(db)  # demo reset wipes the incident
        bind = db.get_bind()
    pipeline.refresh_summary_in_background(bind, inc["id"], force=True)  # must not raise
