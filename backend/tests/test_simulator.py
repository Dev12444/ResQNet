"""Scenario simulator tests (Task 14). Owner: BE1."""
import json
import time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, func, select
from sqlalchemy.orm import sessionmaker

from app import models as m
from app import pipeline
from app import simulator as sim_mod
from app.config import get_settings
from app.db import Base, get_db
from app.main import app
from app.seed import load_seed, reset_database
from app.services import summarizer
from app.simulator import ScenarioError, load_scenario, simulator
from app.ws_manager import manager

AKH = {"source": "citizen", "lat": 23.0588, "lng": 72.562, "text": "Car stuck in Akhbarnagar underpass, water rising"}
FIRE = {"source": "call", "lat": 23.029, "lng": 72.56, "text": "Fire in a commercial complex on C.G. Road"}


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


def _write(dir_, name, events):
    (dir_ / f"scenario_{name}.json").write_text(json.dumps({"events": events}), encoding="utf-8")


@pytest.fixture()
def env(tmp_path, monkeypatch):
    # File-based SQLite: the simulator uses several threads at once (ingest + summaries + alerts).
    eng = create_engine(f"sqlite:///{(tmp_path / 'sim.db').as_posix()}",
                        connect_args={"check_same_thread": False, "timeout": 30})

    @event.listens_for(eng, "connect")
    def _fk(dbapi_conn, _record):
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(eng)
    Session = sessionmaker(bind=eng, expire_on_commit=False)
    with Session() as db:
        reset_database(db)

    scen = tmp_path / "scenarios"
    scen.mkdir()
    monkeypatch.setattr(sim_mod, "SCENARIO_DIR", scen)

    def _db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _db
    with TestClient(app) as client:
        yield client, Session, scen
    app.dependency_overrides.clear()
    eng.dispose()


def _wait_done(client, timeout=15.0):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        st = client.get("/api/simulator/status").json()
        if not st["running"]:
            time.sleep(0.3)  # let summary / alert side work settle
            return st
        time.sleep(0.05)
    raise AssertionError("simulator did not finish")


def _count(Session, model, *where):
    with Session() as db:
        return db.scalar(select(func.count()).select_from(model).where(*where))


# ---------------------------------------------------------------- loading


def test_real_scenario_loads_and_validates():
    events = load_scenario("ahmedabad_flood")
    assert len(events) == 30
    assert [e.offset_sec for e in events] == sorted(e.offset_sec for e in events)
    assert events[0].body.source == "citizen" and events[0].body.lang == "gu"


@pytest.mark.parametrize(
    ("content", "match"),
    [
        (None, "not found"),
        ("{not json", "not valid JSON"),
        ('{"events": []}', "no events"),
        ('{"events": [{"t_offset_sec": 0, "source": "citizen"}]}', "event #0"),          # no text
        ('{"events": [{"t_offset_sec": -1, "source": "citizen", "text": "x"}]}', "event #0"),
        ('{"events": [{"source": "citizen", "text": "x"}]}', "event #0"),                  # no offset
    ],
)
def test_bad_scenarios_rejected_before_starting(tmp_path, content, match):
    if content is not None:
        (tmp_path / "scenario_bad.json").write_text(content, encoding="utf-8")
    with pytest.raises(ScenarioError, match=match):
        load_scenario("bad", tmp_path)


# ---------------------------------------------------------------- start / status / finish


def test_run_scenario_end_to_end(env):
    client, Session, scen = env
    _write(scen, "tiny", [
        {"t_offset_sec": 0, "group": "g1", **AKH},
        {"t_offset_sec": 0.1, "group": "g1", **{**AKH, "source": "call", "lat": 23.059}},
        {"t_offset_sec": 0.2, "group": "g2", **FIRE},
    ])
    with client.websocket_connect("/ws") as ws:
        end = time.monotonic() + 3
        while manager.client_count < 1 and time.monotonic() < end:
            time.sleep(0.02)
        r = client.post("/api/simulator/start", json={"scenario": "tiny", "speed": 1})
        assert r.status_code == 200 and r.json() == {"running": True, "events_total": 3}
        final = _wait_done(client)
        statuses = []
        while True:
            msg = ws.receive_json()
            if msg["event"] == "simulator.status":
                statuses.append(msg["data"])
                if not msg["data"]["running"]:
                    break
    assert final == {"running": False, "events_sent": 3, "events_total": 3}
    assert [s["events_sent"] for s in statuses] == [0, 1, 2, 3, 3]
    assert _count(Session, m.Incident) == 2  # the duplicate merged, same pipeline as POST /api/reports
    assert _count(Session, m.AuditLog, m.AuditLog.actor == "simulator") >= 3


def test_second_start_while_running_is_409(env):
    client, _, scen = env
    _write(scen, "slow", [{"t_offset_sec": 0, **AKH}, {"t_offset_sec": 30, **FIRE}])
    assert client.post("/api/simulator/start", json={"scenario": "slow"}).status_code == 200
    r = client.post("/api/simulator/start", json={"scenario": "slow"})
    assert r.status_code == 409 and "already running" in r.json()["detail"]
    client.post("/api/simulator/stop")


def test_speed_multiplier(env):
    client, _, scen = env
    _write(scen, "fast", [{"t_offset_sec": 0, **AKH}, {"t_offset_sec": 4, **FIRE}])
    started = time.monotonic()
    client.post("/api/simulator/start", json={"scenario": "fast", "speed": 20})  # 4 s -> 0.2 s
    _wait_done(client)
    assert time.monotonic() - started < 3


def test_stop_mid_run(env):
    client, Session, scen = env
    _write(scen, "long", [{"t_offset_sec": 0, **AKH}, {"t_offset_sec": 20, **FIRE}])
    client.post("/api/simulator/start", json={"scenario": "long"})
    end = time.monotonic() + 5
    while client.get("/api/simulator/status").json()["events_sent"] < 1 and time.monotonic() < end:
        time.sleep(0.05)
    assert client.post("/api/simulator/stop").json() == {"running": False}
    st = client.get("/api/simulator/status").json()
    assert st == {"running": False, "events_sent": 1, "events_total": 2}
    time.sleep(0.3)
    assert _count(Session, m.Report) == 1


def test_failing_event_is_skipped(env, monkeypatch):
    client, Session, scen = env
    _write(scen, "mixed", [{"t_offset_sec": 0, **AKH}, {"t_offset_sec": 0.05, **FIRE}])
    real = sim_mod.ingest_report
    calls = []

    def flaky(db, body, actor):
        calls.append(body.source)
        if body.source == "citizen":
            raise RuntimeError("boom")
        return real(db, body, actor)

    monkeypatch.setattr(sim_mod, "ingest_report", flaky)
    client.post("/api/simulator/start", json={"scenario": "mixed"})
    assert _wait_done(client)["events_sent"] == 2
    assert simulator.errors == 1 and calls == ["citizen", "call"]
    assert _count(Session, m.Incident) == 1


@pytest.mark.parametrize(
    ("body", "code"),
    [({"scenario": "nope"}, 404), ({"scenario": "../etc"}, 422), ({"speed": 0}, 422), ({"speed": 50}, 422)],
)
def test_start_validation(env, body, code):
    client, _, _ = env
    assert client.post("/api/simulator/start", json=body).status_code == code


def test_invalid_scenario_file_is_422(env):
    client, _, scen = env
    _write(scen, "broken", [{"t_offset_sec": 0, "source": "citizen"}])
    r = client.post("/api/simulator/start", json={"scenario": "broken"})
    assert r.status_code == 422 and "event #0" in r.json()["detail"]


# ---------------------------------------------------------------- reset


def test_reset_wipes_demo_and_reseeds(env):
    client, Session, scen = env
    _write(scen, "tiny", [{"t_offset_sec": 0, **AKH}])
    client.post("/api/simulator/start", json={"scenario": "tiny"})
    _wait_done(client)
    assert _count(Session, m.Incident) == 1

    r = client.post("/api/simulator/reset", headers={"X-Actor": "demo-host"})
    assert r.status_code == 200 and r.json() == {"ok": True}
    assert _count(Session, m.Incident) == 0 and _count(Session, m.Report) == 0 and _count(Session, m.Alert) == 0
    assert _count(Session, m.Resource) == len(load_seed().resources)
    assert client.get("/api/simulator/status").json() == {"running": False, "events_sent": 0, "events_total": 0}
    with Session() as db:
        (row,) = db.scalars(select(m.AuditLog)).all()
    assert (row.action, row.actor) == ("demo.reset", "demo-host")

    first = client.post("/api/reports", json=AKH).json()["incident"]
    assert first["code"] == "INC-0001"  # codes restart after a reset


def test_reset_stops_a_running_scenario(env):
    client, Session, scen = env
    _write(scen, "long", [{"t_offset_sec": 0, **AKH}, {"t_offset_sec": 20, **FIRE}])
    client.post("/api/simulator/start", json={"scenario": "long"})
    time.sleep(0.3)
    client.post("/api/simulator/reset")
    assert client.get("/api/simulator/status").json()["running"] is False
    time.sleep(0.3)
    assert _count(Session, m.Incident) == 0


# ---------------------------------------------------------------- the real demo scenario


def test_full_ahmedabad_scenario_at_max_speed(env, monkeypatch):
    """All 30 events through the real pipeline (AI off): 11 incidents, Akhbarnagar = 7-report P1."""
    client, Session, _ = env
    monkeypatch.setattr(sim_mod, "SCENARIO_DIR", sim_mod.Path(sim_mod.__file__).resolve().parent / "data")
    client.post("/api/simulator/start", json={"scenario": "ahmedabad_flood", "speed": 20})
    final = _wait_done(client, timeout=40)
    assert final["events_sent"] == 30 and simulator.errors == 0
    with Session() as db:
        incidents = db.scalars(select(m.Incident)).all()
    assert len(incidents) == 11
    akh = max(incidents, key=lambda i: i.report_count)
    assert (akh.report_count, akh.type, akh.priority) == (7, "flood", "P1")
