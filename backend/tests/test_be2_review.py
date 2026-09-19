"""Regression tests for the BE2 review fixes (AI routes, dedup, LLM layer, summaries, photos)."""
import threading
import time
import types
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine

from app.config import get_settings
from app.main import app
from app.services import dedup, llm, recommender, summarizer, vision
from app.services.classifier import fallback_classify
from app.ws_manager import manager
from tests.test_be2_llm import FakeOpenAI, env  # noqa: F401  (pytest fixture)
from tests.test_report_pipeline import AKHBARNAGAR_EN, _make_client, _post, ai_off  # noqa: F401  (autouse)


@pytest.fixture()
def file_db(tmp_path):
    """File-backed SQLite with a real connection pool, so checked-out connections can be counted."""
    eng = create_engine(f"sqlite:///{(tmp_path / 'review.db').as_posix()}",
                        connect_args={"check_same_thread": False, "timeout": 30})
    Session = _make_client(eng)
    summarizer._last.clear()
    try:
        with TestClient(app) as client:
            inc_id = _post(client, source="citizen", text=AKHBARNAGAR_EN,
                           lat=23.0588, lng=72.562).json()["incident"]["id"]
            yield types.SimpleNamespace(client=client, eng=eng, Session=Session, inc_id=inc_id)
    finally:
        app.dependency_overrides.clear()
        summarizer._last.clear()
        eng.dispose()


# ---------------------------------------------------------------- AI routes: no DB connection held during LLM calls

def test_recommendations_llm_call_holds_no_db_connection(file_db, monkeypatch):
    seen = []

    def spy(prompt, schema, system=None, temperature=0.0):
        seen.append(file_db.eng.pool.checkedout())
        return {"reasons": []}

    monkeypatch.setattr(recommender.llm, "generate_json", spy)
    r = file_db.client.get(f"/api/incidents/{file_db.inc_id}/recommendations")
    assert r.status_code == 200 and r.json()["suggested_resource_ids"]
    assert seen == [0]


def test_recommendations_answer_within_budget_with_template_reasons(file_db, monkeypatch):
    """A slow LLM must not hold up the dispatcher: rank now, template reasons, LLM reasons later."""
    release = threading.Event()

    def slow(prompt, schema, system=None, temperature=0.0):
        release.wait(5)
        return {"reasons": []}

    monkeypatch.setattr(recommender.llm, "generate_json", slow)
    monkeypatch.setattr(recommender, "REASON_BUDGET_SEC", 0.2)
    started = time.monotonic()
    body = file_db.client.get(f"/api/incidents/{file_db.inc_id}/recommendations").json()
    elapsed = time.monotonic() - started
    release.set()
    assert elapsed < 2.0
    recs = [x for v in body["recommendations"].values() for x in v]
    assert recs and all("ETA" in x["reason"] for x in recs)  # template reasons


def test_recommendations_use_llm_reasons_when_fast(file_db, monkeypatch):
    def fast(prompt, schema, system=None, temperature=0.0):
        ids = [int(line.split("id=")[1].split()[0]) for line in prompt.splitlines() if "id=" in line]
        return {"reasons": [{"id": i, "reason": f"LLM reason {i}"} for i in ids]}

    monkeypatch.setattr(recommender.llm, "generate_json", fast)
    body = file_db.client.get(f"/api/incidents/{file_db.inc_id}/recommendations").json()
    recs = [x for v in body["recommendations"].values() for x in v]
    assert recs and all(x["reason"] == f"LLM reason {x['resource']['id']}" for x in recs)


def test_sitrep_llm_call_holds_no_db_connection(file_db, monkeypatch):
    seen = []

    def spy(prompt, system=None, temperature=0.3):
        seen.append(file_db.eng.pool.checkedout())
        return "## Situation Report\nAll quiet."

    monkeypatch.setattr(summarizer.llm, "generate_text", spy)
    r = file_db.client.post("/api/ai/sitrep", json={})
    assert r.status_code == 200 and r.json()["markdown"].startswith("## Situation Report")
    assert r.json()["active_count"] == 1
    assert seen == [0]


def test_summarize_holds_no_db_connection_and_broadcasts(file_db, monkeypatch):
    seen, published = [], []

    def spy(prompt, schema, system=None, temperature=0.0):
        seen.append(file_db.eng.pool.checkedout())
        return {"summary": "Fresh summary.", "actions": ["Send a boat"]}

    monkeypatch.setattr(summarizer.llm, "generate_json", spy)
    real_publish = manager.publish
    monkeypatch.setattr(manager, "publish", lambda ev, data: (published.append((ev, data)), real_publish(ev, data)))
    r = file_db.client.post(f"/api/incidents/{file_db.inc_id}/summarize")
    assert r.status_code == 200
    assert r.json() == {"ai_summary": "Fresh summary.", "ai_actions": ["Send a boat"]}
    assert seen == [0]
    assert any(ev == "incident.updated" and data.ai_summary == "Fresh summary." for ev, data in published)
    assert file_db.client.get(f"/api/incidents/{file_db.inc_id}").json()["ai_summary"] == "Fresh summary."
    assert file_db.client.post("/api/incidents/9999/summarize").status_code == 404


# ---------------------------------------------------------------- dedup: no network call under the pipeline lock

class CountingOpenAI(FakeOpenAI):
    def __init__(self):
        super().__init__()
        self.embed_calls = 0

    def _embed(self, model, input):
        self.embed_calls += 1
        return super()._embed(model, input)


def test_find_match_never_calls_the_embedding_api(env):  # noqa: F811
    client = env.install(CountingOpenAI())
    client.embeddings = types.SimpleNamespace(create=client._embed)
    new_text = "Water rising fast in the Akhbarnagar underpass"
    dedup.embed_batch([new_text])  # prepare() warms the new report's own vector
    calls_after_warmup = client.embed_calls

    now = datetime.now(timezone.utc)
    old_report = types.SimpleNamespace(text="Car stuck at Akhbarnagar, never embedded", created_at=now)
    inc = types.SimpleNamespace(id=7, type="flood", status="new", lat=23.0588, lng=72.562,
                                created_at=now, updated_at=now, reports=[old_report])
    db = types.SimpleNamespace(query=lambda *_: types.SimpleNamespace(
        filter=lambda *_: types.SimpleNamespace(all=lambda: [inc])))
    report = types.SimpleNamespace(id=1, source="citizen", text=new_text, lat=23.0589, lng=72.5621,
                                   created_at=now, incident_id=None)
    cls = types.SimpleNamespace(type="flood")

    assert dedup.find_match(db, report, cls) is inc  # still merges (geo + time + type for that candidate)
    assert client.embed_calls == calls_after_warmup  # ...without an API call while holding the lock


# ---------------------------------------------------------------- LLM: a timeout does not stall the report

class Timeout(Exception):
    pass


Timeout.__name__ = "APITimeoutError"


def test_openai_timeout_moves_straight_to_the_next_provider(env):  # noqa: F811
    client = env.install(FakeOpenAI(error_once=[Timeout("Request timed out.") for _ in range(4)]))
    assert llm.generate_text("classify this", temperature=0.0) == '{"from": "gemini"}'
    assert len(client.requests) == 1  # no retry of the timed-out call, no second OpenAI model
    assert env.gemini_calls == ["g1"]


def test_openai_5xx_is_still_retried_once(env):  # noqa: F811
    class ServerError(Exception):
        pass

    ServerError.__name__ = "InternalServerError"
    client = env.install(FakeOpenAI(error_once=[ServerError("Error code: 500")]))
    assert llm.generate_text("hello", temperature=0.0) == '{"ok": true}'
    assert len(client.requests) == 2


# ---------------------------------------------------------------- summaries: no stale summary across a demo reset

def test_summary_debounce_is_not_shared_by_a_new_incident_with_the_same_id(monkeypatch):
    monkeypatch.setattr(get_settings(), "ai_enabled", False)
    summarizer._last.clear()
    t0 = datetime.now(timezone.utc)
    flood = {"id": 1, "created_at": t0, "type": "flood", "title": "Flooding at Akhbarnagar Underpass",
             "severity": 4, "priority": "P1", "hazards": ["rising_water"]}
    fire = {"id": 1, "created_at": t0 + timedelta(minutes=1), "type": "fire", "title": "Fire at C.G. Road",
            "severity": 3, "priority": "P2", "hazards": []}
    assert "Akhbarnagar" in summarizer.summarize_incident(flood, [])["summary"]
    assert "C.G. Road" in summarizer.summarize_incident(fire, [])["summary"]  # not the old flood's text
    summarizer._last.clear()


# ---------------------------------------------------------------- vision: bounded photo download

def test_photo_download_stops_at_the_size_limit(monkeypatch):
    sent = []

    def body():
        for _ in range(100):
            sent.append(1)
            yield b"x" * 100

    transport = httpx.MockTransport(lambda req: httpx.Response(200, headers={"content-type": "image/jpeg"},
                                                               content=body()))
    real_client = httpx.Client
    monkeypatch.setattr(vision.httpx, "Client", lambda **kw: real_client(transport=transport, **kw))
    monkeypatch.setattr(vision, "_is_public_url", lambda url: True)
    monkeypatch.setattr(vision, "MAX_BYTES", 1000)
    assert vision._load_image("https://example.com/huge.jpg") is None
    assert len(sent) <= 12  # stopped reading just past the limit, not after all 10 kB


def test_photo_download_within_limit_still_works(monkeypatch):
    transport = httpx.MockTransport(lambda req: httpx.Response(200, headers={"content-type": "image/png"},
                                                               content=b"\x89PNG" + b"0" * 50))
    real_client = httpx.Client
    monkeypatch.setattr(vision.httpx, "Client", lambda **kw: real_client(transport=transport, **kw))
    monkeypatch.setattr(vision, "_is_public_url", lambda url: True)
    data, mime = vision._load_image("https://example.com/ok.png")
    assert mime == "image/png" and data.startswith(b"\x89PNG") and len(data) == 54


# ---------------------------------------------------------------- small ones

def test_fallback_language_follows_the_script_not_the_ui_language():
    assert fallback_classify("અખબારનગર અંડરપાસમાં ગાડી ફસાઈ છે", lang_hint="en").lang == "gu"
    assert fallback_classify("वटवा में गैस रिसाव", lang_hint="en").lang == "hi"
    assert fallback_classify("Car stuck in water", lang_hint="gu").lang == "gu"  # no script: the hint stands


def test_whitespace_only_api_keys_do_not_count_as_ai_available(monkeypatch):
    st = get_settings()
    monkeypatch.setattr(st, "ai_enabled", True)
    monkeypatch.setattr(st, "openai_api_key", " \n")
    monkeypatch.setattr(st, "gemini_api_key", "")
    assert st.ai_available is False


def test_analytics_rejects_an_unparseable_since(file_db):
    assert file_db.client.get("/api/analytics/summary", params={"since": "yesterday"}).status_code == 422
    assert file_db.client.get("/api/analytics/summary", params={"since": "2026-09-19T08:00:00Z"}).status_code == 200


# ---------------------------------------------------------------- LLM: a rejected API key stays benched

def _auth_error(name, msg):
    return type(name, (Exception,), {})(msg)


def test_rejected_openai_key_is_benched_for_minutes_not_seconds(env):  # noqa: F811
    rejected = _auth_error("AuthenticationError", "Error code: 401 Incorrect API key")
    client = env.install(FakeOpenAI(error_once=[rejected]))
    assert llm.generate_text("hello", temperature=0.0) == '{"from": "gemini"}'
    wait = llm._cooldown_until[("openai", "gen")] - llm.time.monotonic()
    assert wait > 60  # not retried (and re-failed, adding latency to every report) every 10 s
    assert llm.generate_text("hello again", temperature=0.0) == '{"from": "gemini"}'
    assert len(client.requests) == 1


def test_rejected_gemini_embedding_key_is_benched_for_minutes(env):  # noqa: F811
    env.monkeypatch.setattr(env.st, "embed_providers", "gemini,openai")
    env.install(FakeOpenAI(embed_dim=3))

    def gemini_rejects(p, client, texts):
        if p.name == "gemini":
            raise _auth_error("ClientError", "400 INVALID_ARGUMENT. API key not valid. Please pass a valid API key.")
        return [[1.0, 0.0, 0.0] for _ in texts]

    env.monkeypatch.setattr(llm, "_embed_call", gemini_rejects)
    assert llm.embed_with_model(["x"])[0] == "text-embedding-3-small"
    assert llm._cooldown_until[("gemini", "emb")] - llm.time.monotonic() > 60


def test_ordinary_outage_still_cools_briefly(env):  # noqa: F811
    env.install(FakeOpenAI(error_once=[_auth_error("InternalServerError", "500")] * 4))
    llm.generate_text("hello", temperature=0.0)
    assert llm._cooldown_until[("openai", "gen")] - llm.time.monotonic() <= llm.COOLDOWN_SEC


def test_permission_denied_for_one_model_still_tries_the_fallback_model(env):  # noqa: F811
    client = env.install(FakeOpenAI(error_once=[_auth_error("PermissionDeniedError", "403 model not allowed")]))
    assert llm.generate_text("hello", temperature=0.0) == '{"ok": true}'  # gpt-4.1-nano answered
    assert len(client.requests) == 2
