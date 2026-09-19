"""llm.py quota handling: pacing, benching on 429, model rotation — with a fake Gemini client. Owner: BE2."""
import types

import pytest

from app.config import get_settings
from app.services import llm


class FakeModels:
    def __init__(self, behaviour):
        self.behaviour = behaviour  # model -> callable(prompt) returning text or raising
        self.calls = []

    def generate_content(self, model, contents, config):
        self.calls.append(model)
        return types.SimpleNamespace(text=self.behaviour[model](contents))


@pytest.fixture()
def fake(monkeypatch):
    st = get_settings()
    monkeypatch.setattr(st, "ai_enabled", True)
    monkeypatch.setattr(st, "gemini_api_key", "test")
    monkeypatch.setattr(st, "gemini_model", "m1")
    monkeypatch.setattr(st, "gemini_fallback_model", "m2, m3")
    monkeypatch.setattr(st, "gemini_rpm", 2)
    monkeypatch.setattr(st, "llm_cache_path", "")
    monkeypatch.setattr(llm, "_calls", {})
    monkeypatch.setattr(llm, "_benched_until", {})
    monkeypatch.setattr(llm, "_cooldown_until", {"gen": 0.0, "emb": 0.0})
    monkeypatch.setattr(llm, "_cache", llm.OrderedDict())
    monkeypatch.setattr(llm, "RETRY_BACKOFF_SEC", 0)

    def install(behaviour):
        client = types.SimpleNamespace(models=FakeModels(behaviour))
        monkeypatch.setattr(llm, "_get_client", lambda: client)
        return client.models

    return install


def ok(text):
    return lambda _prompt: text


def raise_(msg):
    def f(_prompt):
        raise RuntimeError(msg)
    return f


def test_models_parse_comma_list(fake):
    assert llm._models() == ["m1", "m2", "m3"]


def test_daily_quota_benches_model_and_rotates(fake):
    m = fake({"m1": raise_("429 RESOURCE_EXHAUSTED GenerateRequestsPerDayPerProjectPerModel-FreeTier"),
              "m2": ok("hello"), "m3": ok("x")})
    assert llm.generate_text("a") == "hello"
    assert llm._benched_until["m1"] > 0
    assert llm.generate_text("b") == "hello"
    assert m.calls == ["m1", "m2", "m2"]  # m1 not retried while benched
    assert llm.available()                 # a quota hit must not trip the global cooldown


def test_rpm_pacing_moves_to_next_model(fake):
    m = fake({"m1": ok("one"), "m2": ok("two"), "m3": ok("three")})
    outs = [llm.generate_text(p) for p in ("a", "b", "c", "d", "e", "f")]
    assert outs == ["one", "one", "two", "two", "three", "three"]  # rpm=2 per model, 3 models
    assert llm.generate_text("g") is None  # all budgets used → caller falls back to rules
    assert m.calls == ["m1", "m1", "m2", "m2", "m3", "m3"]  # no wasted API call for "g"


def test_retry_delay_is_respected(fake):
    fake({"m1": raise_("429 RESOURCE_EXHAUSTED ... 'retryDelay': '7s'"), "m2": ok("ok"), "m3": ok("ok")})
    llm.generate_text("a")
    assert 5 < llm._benched_until["m1"] - llm.time.monotonic() <= 7


def test_server_outage_trips_cooldown(fake):
    fake({"m1": raise_("503 UNAVAILABLE"), "m2": raise_("503 UNAVAILABLE"), "m3": raise_("503 UNAVAILABLE")})
    assert llm.generate_text("a") is None
    assert not llm.available()
