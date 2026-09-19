"""llm.py provider layer with fake OpenAI/Gemini clients — no network. Owner: BE2."""
import types

import pytest

from app.config import get_settings
from app.services import dedup, llm


# ---------------------------------------------------------------- fakes

class FakeOpenAI:
    """Mimics openai.OpenAI().chat.completions.create / embeddings.create."""

    def __init__(self, reply=None, error_once=None, embed_dim=3):
        self.reply = reply or (lambda kw: '{"ok": true}')
        self.error_once = list(error_once or [])
        self.requests = []
        self.embed_dim = embed_dim
        self.chat = types.SimpleNamespace(completions=types.SimpleNamespace(create=self._create))
        self.embeddings = types.SimpleNamespace(create=self._embed)

    def _create(self, **kw):
        self.requests.append(kw)
        if self.error_once:
            raise self.error_once.pop(0)
        usage = types.SimpleNamespace(prompt_tokens=1000, completion_tokens=500)
        msg = types.SimpleNamespace(content=self.reply(kw))
        return types.SimpleNamespace(choices=[types.SimpleNamespace(message=msg)], usage=usage)

    def _embed(self, model, input):
        data = [types.SimpleNamespace(index=i, embedding=[1.0] + [0.0] * (self.embed_dim - 1)) for i, _ in enumerate(input)]
        return types.SimpleNamespace(data=data, usage=types.SimpleNamespace(total_tokens=10))


class BadRequest(Exception):
    def __init__(self, msg):
        super().__init__(f"Error code: 400 - {msg}")


BadRequest.__name__ = "BadRequestError"


@pytest.fixture()
def env(monkeypatch):
    st = get_settings()
    for k, v in {
        "ai_enabled": True, "llm_providers": "openai,gemini", "embed_providers": "openai,gemini",  # explicit order
        "openai_api_key": "sk-test", "openai_model": "gpt-4.1-mini", "openai_fallback_model": "gpt-4.1-nano",
        "openai_rpm": 100, "openai_budget_usd": 8.0,
        "gemini_api_key": "g-test", "gemini_model": "g1", "gemini_fallback_model": "g2", "gemini_rpm": 2,
        "llm_cache_path": "",
    }.items():
        monkeypatch.setattr(st, k, v)
    for name, val in {"_calls": {}, "_benched_until": {}, "_cooldown_until": {}, "_dropped": {},
                      "_spend_mem": {}, "_clients": {}, "_cache": llm.OrderedDict()}.items():
        monkeypatch.setattr(llm, name, val)
    monkeypatch.setattr(llm, "RETRY_BACKOFF_SEC", 0)
    gemini_calls = []

    def fake_gemini(client, model, prompt, system, schema, temperature, image):
        gemini_calls.append(model)
        return '{"from": "gemini"}'

    monkeypatch.setitem(llm._CALLERS, "gemini", fake_gemini)

    def install(openai_client):
        monkeypatch.setattr(llm, "_client_for", lambda p: openai_client if p.name == "openai" else object())
        return openai_client

    return types.SimpleNamespace(st=st, install=install, gemini_calls=gemini_calls, monkeypatch=monkeypatch)


SCHEMA = {
    "type": "object",
    "properties": {
        "type": {"type": "string", "enum": ["flood", "fire"]},
        "severity": {"type": "integer", "minimum": 1, "maximum": 5},
        "people": {"type": ["integer", "null"]},
        "note": {"type": "string"},
    },
    "required": ["type", "severity"],
}


# ---------------------------------------------------------------- tests

def test_openai_is_primary_with_strict_schema(env):
    fake = env.install(FakeOpenAI(reply=lambda kw: '{"type": "flood", "severity": 4, "people": null, "note": null}'))
    out = llm.generate_json("classify", SCHEMA, system="sys")
    assert out["type"] == "flood"
    req = fake.requests[0]
    assert req["model"] == "gpt-4.1-mini" and req["temperature"] == 0.0
    assert req["messages"][0] == {"role": "system", "content": "sys"}
    js = req["response_format"]["json_schema"]
    assert js["strict"] is True
    sch = js["schema"]
    assert sch["additionalProperties"] is False and set(sch["required"]) == {"type", "severity", "people", "note"}
    assert "minimum" not in sch["properties"]["severity"]
    assert sch["properties"]["note"]["type"] == ["string", "null"]  # optional → nullable
    assert "reasoning_effort" not in req  # not a reasoning model
    assert env.gemini_calls == []


def test_unsupported_param_is_dropped_and_retried(env):
    fake = env.install(FakeOpenAI(error_once=[BadRequest("Unsupported parameter: 'temperature'")]))
    assert llm.generate_text("hi") == '{"ok": true}'
    assert "temperature" in fake.requests[0] and "temperature" not in fake.requests[1]
    llm.generate_text("again")
    assert "temperature" not in fake.requests[2]  # remembered for this model


def test_reasoning_models_get_reasoning_effort(env):
    env.monkeypatch.setattr(env.st, "openai_model", "gpt-5-mini")
    fake = env.install(FakeOpenAI())
    llm.generate_text("hi")
    assert fake.requests[0]["reasoning_effort"] == "minimal"


def test_strict_schema_rejected_falls_back_to_json_object(env):
    fake = env.install(FakeOpenAI(error_once=[BadRequest("Invalid schema for response_format 'result'")],
                                  reply=lambda kw: '```json\n{"type": "fire", "severity": 2}\n```'))
    out = llm.generate_json("x", SCHEMA)
    assert out == {"type": "fire", "severity": 2}
    assert fake.requests[1]["response_format"] == {"type": "json_object"}
    assert "JSON schema" in fake.requests[1]["messages"][-1]["content"]


def test_openai_rate_limit_rotates_model_then_provider(env):
    class RateLimitError(Exception):
        pass

    fake = env.install(FakeOpenAI(error_once=[RateLimitError("429 Rate limit reached. Please try again in 20s."),
                                              RateLimitError("429 insufficient_quota: check your plan and billing")]))
    assert llm.generate_text("x") == '{"from": "gemini"}'  # both OpenAI models benched → Gemini
    assert [r["model"] for r in fake.requests] == ["gpt-4.1-mini", "gpt-4.1-nano"]
    benched = llm._benched_until
    assert 15 < benched["openai:gpt-4.1-mini"] - llm.time.monotonic() <= 20
    assert benched["openai:gpt-4.1-nano"] - llm.time.monotonic() > 3000  # out of credit → long bench
    assert llm.generate_text("y") == '{"from": "gemini"}'
    assert len(fake.requests) == 2  # benched models are not called again


def test_budget_cap_stops_openai(env):
    env.monkeypatch.setattr(env.st, "openai_budget_usd", 0.001)
    fake = env.install(FakeOpenAI(reply=lambda kw: "first"))
    assert llm.generate_text("a") == "first"   # 1000 in + 500 out tokens on gpt-4.1-mini ≈ $0.0012
    assert llm.spent_usd() > 0.001
    assert llm.generate_text("b") == '{"from": "gemini"}'
    assert len(fake.requests) == 1
    assert llm.spend_status()["openai_over_budget"] is True


def test_model_not_found_is_benched(env):
    class NotFoundError(Exception):
        pass

    fake = env.install(FakeOpenAI(error_once=[NotFoundError("404 The model `gpt-4.1-mini` does not exist")]))
    assert llm.generate_text("a") == '{"ok": true}'  # served by the fallback model
    assert [r["model"] for r in fake.requests] == ["gpt-4.1-mini", "gpt-4.1-nano"]
    llm.generate_text("b")
    assert fake.requests[-1]["model"] == "gpt-4.1-nano"


def test_gemini_only_when_no_openai_key(env):
    env.monkeypatch.setattr(env.st, "openai_api_key", "")
    env.install(FakeOpenAI())
    assert llm.generate_text("a") == '{"from": "gemini"}'
    assert [p.name for p in llm._providers()] == ["gemini"]


def test_gemini_rpm_pacing_then_rules(env):
    env.monkeypatch.setattr(env.st, "llm_providers", "gemini")
    env.install(FakeOpenAI())
    outs = [llm.generate_text(p) for p in "abcde"]
    assert outs[:4] == ['{"from": "gemini"}'] * 4 and outs[4] is None  # 2 rpm × 2 models
    assert env.gemini_calls == ["g1", "g1", "g2", "g2"]
    assert not llm.has_capacity()


def test_server_outage_cools_provider_and_uses_next(env):
    class InternalServerError(Exception):
        pass

    fake = env.install(FakeOpenAI(error_once=[InternalServerError("500")] * 4))
    assert llm.generate_text("a") == '{"from": "gemini"}'
    assert not llm._provider_ok(llm._provider("openai"), "gen")


def test_embeddings_come_from_one_provider_and_dedup_uses_them(env):
    fake = env.install(FakeOpenAI(embed_dim=4))
    model, vecs = llm.embed_with_model(["a", "b"])
    assert model == "text-embedding-3-small" and len(vecs) == 2 and len(vecs[0]) == 4
    model2, by_text = dedup.embed_batch(["a", " a ", "c"])
    assert model2 == "text-embedding-3-small" and set(by_text) == {"a", "c"}
    assert llm.spent_usd() > 0


def test_mismatched_vector_lengths_are_ignored():
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    cand = dedup.Candidate(key=1, type="fire", lat=23.0, lng=72.5, last_at=now, texts=["old"])
    s = dedup.match_score(new_type="fire", new_lat=23.0, new_lng=72.5, new_at=now, new_text="new", cand=cand,
                          vectors={"new": [1.0, 0.0], "old": [1.0, 0.0, 0.0]}, embed_model="x")
    assert s is not None and s >= 0.5  # treated as "no similarity info" → geo/time/type only


def test_embedding_quota_uses_retry_hint_and_next_provider(env):
    class RateLimitError(Exception):
        pass

    fake = env.install(FakeOpenAI(embed_dim=5))
    env.monkeypatch.setattr(env.st, "embed_providers", "gemini,openai")

    def gemini_embed_fails(p, client, texts):
        if p.name == "gemini":
            raise RateLimitError("429 RESOURCE_EXHAUSTED 'retryDelay': '30s'")
        return FakeOpenAI(embed_dim=5)._embed(p.embed_model, texts).data and [[1.0] * 5 for _ in texts]

    env.monkeypatch.setattr(llm, "_embed_call", gemini_embed_fails)
    model, vecs = llm.embed_with_model(["x"])
    assert model == "text-embedding-3-small" and len(vecs[0]) == 5
    wait = llm._cooldown_until[("gemini", "emb")] - llm.time.monotonic()
    assert 25 < wait <= 30
