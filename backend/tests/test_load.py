"""The demo load / race harness (scripts/load_test.py) inside pytest. Owner: BE1.

Same actors and invariants as the live 2x rehearsal, at max scenario speed against a file SQLite
DB (several threads write at once), so every `pytest` run re-checks the whole system under load.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import sessionmaker

from app import models as m
from app import pipeline
from app.config import get_settings
from app.db import Base, get_db
from app.main import app
from app.seed import reset_database
from app.services import summarizer
from scripts.load_test import Recorder, check_invariants, run_load


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("AI_ENABLED", "false")
    monkeypatch.setenv("LLM_CACHE_PATH", "")
    get_settings.cache_clear()
    summarizer._last.clear()
    eng = create_engine(f"sqlite:///{(tmp_path / 'load.db').as_posix()}",
                        connect_args={"check_same_thread": False, "timeout": 30})

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
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    pipeline.cancel_trailing_refreshes()
    eng.dispose()
    get_settings.cache_clear()
    summarizer._last.clear()


def test_scenario_under_concurrent_operators_keeps_every_invariant(client):
    result = run_load(client, speed=20, dispatchers=3, burst_size=5, poll_sec=0.1, settle_sec=1.0, timeout_sec=60)
    assert result.ok, "\n".join(result.problems)
    assert result.simulator == {"running": False, "events_sent": 30, "events_total": 30}
    dispatch = result.recorder.codes["POST dispatch"]
    assert dispatch[200] > 0  # the dispatchers actually got units out
    assert set(dispatch) <= {200, 409}  # losing a race is a clean 409, never a 5xx


def test_invariant_checker_catches_a_leaked_unit(client):
    """Guard against a checker that always says OK: a unit stuck as 'assigned' with no assignment."""
    assert check_invariants(client, Recorder()) == []
    db = next(app.dependency_overrides[get_db]())
    unit = db.scalars(select(m.Resource).order_by(m.Resource.id)).first()
    unit.status = "assigned"
    db.commit()
    db.close()
    problems = check_invariants(client, Recorder())
    assert problems == [f"{unit.callsign} is assigned with 0 active assignments (leaked unit)"]
