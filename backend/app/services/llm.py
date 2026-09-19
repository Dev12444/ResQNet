"""Thin, failure-safe wrapper around the Gemini API. Owner: BE2.

Every function returns None on any failure (no key, timeout, rate limit, bad JSON),
so callers can fall back to rules. Results are cached in-process by input hash.
"""
from __future__ import annotations

import hashlib
import json
import logging
import time
from collections import OrderedDict
from typing import Any

from app.config import get_settings

log = logging.getLogger("resqnet.llm")

TIMEOUT_MS = 12000  # API minimum is 10 s
_CACHE_MAX = 2000
_cache: OrderedDict[str, Any] = OrderedDict()
_client = None
_client_failed = False
# After a failure, skip that API ("gen" or "emb") for a short cooldown so a dead network
# doesn't add 12 s per report. Separate so an overloaded chat model doesn't disable embeddings.
_cooldown_until: dict[str, float] = {"gen": 0.0, "emb": 0.0}
COOLDOWN_SEC = 10
RETRY_BACKOFF_SEC = 1.0


def _key(*parts: Any) -> str:
    raw = json.dumps(parts, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()


def _cache_get(k: str) -> Any:
    if k in _cache:
        _cache.move_to_end(k)
        return _cache[k]
    return None


def _cache_put(k: str, v: Any) -> None:
    _cache[k] = v
    _cache.move_to_end(k)
    while len(_cache) > _CACHE_MAX:
        _cache.popitem(last=False)


def available(kind: str = "gen") -> bool:
    return get_settings().ai_available and time.monotonic() >= _cooldown_until[kind]


def _transient(e: Exception) -> bool:
    msg = str(e)
    return any(code in msg for code in ("503", "429", "UNAVAILABLE", "RESOURCE_EXHAUSTED", "500", "INTERNAL"))


def _get_client():
    global _client, _client_failed
    if _client is None and not _client_failed:
        try:
            from google import genai
            from google.genai import types

            _client = genai.Client(
                api_key=get_settings().gemini_api_key,
                http_options=types.HttpOptions(timeout=TIMEOUT_MS),
            )
        except Exception as e:  # pragma: no cover - import/config errors
            log.warning("Gemini client init failed: %s", e)
            _client_failed = True
    return _client


def _trip(e: Exception, kind: str) -> None:
    _cooldown_until[kind] = time.monotonic() + COOLDOWN_SEC
    log.warning("Gemini %s failed (%s: %s) — using fallback for %ss", kind, type(e).__name__, str(e)[:200], COOLDOWN_SEC)


# Models that rejected our thinking_level (e.g. "MINIMAL is not supported") — don't send it again.
_no_thinking: set[str] = set()


def _models() -> list[str]:
    st = get_settings()
    return [m for m in dict.fromkeys([st.gemini_model, st.gemini_fallback_model]) if m]


def _gen_config(model: str, system: str | None, schema: dict | None, temperature: float):
    from google.genai import types

    kwargs: dict[str, Any] = {"temperature": temperature}
    if system:
        kwargs["system_instruction"] = system
    if schema is not None:
        kwargs["response_mime_type"] = "application/json"
        kwargs["response_json_schema"] = schema
    level = get_settings().gemini_thinking_level
    if level and model not in _no_thinking:
        kwargs["thinking_config"] = types.ThinkingConfig(thinking_level=level)
    return types.GenerateContentConfig(**kwargs)


def _generate(prompt: str, system: str | None, schema: dict | None, temperature: float) -> str | None:
    """Try each configured model in order. Returns raw response text or None."""
    client = _get_client()
    if client is None:
        return None
    last_err: Exception | None = None
    for model in _models():
        retried = False
        for _attempt in range(3):
            try:
                resp = client.models.generate_content(
                    model=model, contents=prompt, config=_gen_config(model, system, schema, temperature)
                )
                return resp.text
            except Exception as e:
                last_err = e
                if "thinking" in str(e).lower() and model not in _no_thinking:
                    _no_thinking.add(model)  # retry without thinking_config
                    continue
                if _transient(e) and not retried:
                    retried = True
                    time.sleep(RETRY_BACKOFF_SEC)
                    continue
                log.info("Gemini model %s failed (%s), trying next", model, type(e).__name__)
                break
    if last_err is not None:
        _trip(last_err, "gen")
    return None


def generate_json(prompt: str, schema: dict, system: str | None = None, temperature: float = 0.0) -> Any | None:
    """Return parsed JSON matching `schema`, or None."""
    if not available():
        return None
    k = _key("json", _models(), system, prompt, schema, temperature)
    if (hit := _cache_get(k)) is not None:
        return hit
    text = _generate(prompt, system, schema, temperature)
    if text is None:
        return None
    try:
        data = json.loads(text)
    except (TypeError, ValueError) as e:
        log.warning("Gemini returned invalid JSON: %s", e)
        return None
    _cache_put(k, data)
    return data


def generate_text(prompt: str, system: str | None = None, temperature: float = 0.3) -> str | None:
    if not available():
        return None
    k = _key("text", _models(), system, prompt, temperature)
    if (hit := _cache_get(k)) is not None:
        return hit
    text = (_generate(prompt, system, None, temperature) or "").strip()
    if not text:
        return None
    _cache_put(k, text)
    return text


def embed(texts: list[str]) -> list[list[float]] | None:
    """Embed texts (cached per text). Returns None if embeddings are unavailable."""
    if not texts:
        return []
    model = get_settings().gemini_embed_model
    out: list[list[float] | None] = [_cache_get(_key("emb", model, t)) for t in texts]
    missing = [i for i, v in enumerate(out) if v is None]
    if missing:
        if not available("emb"):
            return None
        client = _get_client()
        if client is None:
            return None
        from google.genai import types

        vectors = None
        for attempt in range(2):
            try:
                resp = client.models.embed_content(
                    model=model,
                    contents=[texts[i] for i in missing],
                    config=types.EmbedContentConfig(task_type="SEMANTIC_SIMILARITY"),
                )
                vectors = [e.values for e in resp.embeddings]
                break
            except Exception as e:
                if attempt == 0 and _transient(e):
                    time.sleep(RETRY_BACKOFF_SEC)
                    continue
                _trip(e, "emb")
                return None
        for i, vec in zip(missing, vectors):
            out[i] = vec
            _cache_put(_key("emb", model, texts[i]), vec)
    return out  # type: ignore[return-value]
