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

TIMEOUT_MS = 8000
_CACHE_MAX = 2000
_cache: OrderedDict[str, Any] = OrderedDict()
_client = None
_client_failed = False
# After a failure, skip the API for a short cooldown so a dead network doesn't add 8 s per report.
_cooldown_until = 0.0
COOLDOWN_SEC = 20


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


def available() -> bool:
    return get_settings().ai_available and time.monotonic() >= _cooldown_until


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


def _trip(e: Exception, what: str) -> None:
    global _cooldown_until
    _cooldown_until = time.monotonic() + COOLDOWN_SEC
    log.warning("Gemini %s failed (%s: %s) — using fallback for %ss", what, type(e).__name__, e, COOLDOWN_SEC)


def _gen_config(system: str | None, schema: dict | None, temperature: float):
    from google.genai import types

    model = get_settings().gemini_model
    kwargs: dict[str, Any] = {"temperature": temperature}
    if system:
        kwargs["system_instruction"] = system
    if schema is not None:
        kwargs["response_mime_type"] = "application/json"
        kwargs["response_json_schema"] = schema
    # Flash 2.5 thinks by default; disabling it cuts latency a lot and we don't need it.
    if "2.5-flash" in model:
        kwargs["thinking_config"] = types.ThinkingConfig(thinking_budget=0)
    return types.GenerateContentConfig(**kwargs)


def generate_json(prompt: str, schema: dict, system: str | None = None, temperature: float = 0.0) -> Any | None:
    """Return parsed JSON matching `schema`, or None."""
    if not available():
        return None
    k = _key("json", get_settings().gemini_model, system, prompt, schema, temperature)
    if (hit := _cache_get(k)) is not None:
        return hit
    client = _get_client()
    if client is None:
        return None
    try:
        resp = client.models.generate_content(
            model=get_settings().gemini_model,
            contents=prompt,
            config=_gen_config(system, schema, temperature),
        )
        data = json.loads(resp.text)
    except Exception as e:
        _trip(e, "generate_json")
        return None
    _cache_put(k, data)
    return data


def generate_text(prompt: str, system: str | None = None, temperature: float = 0.3) -> str | None:
    if not available():
        return None
    k = _key("text", get_settings().gemini_model, system, prompt, temperature)
    if (hit := _cache_get(k)) is not None:
        return hit
    client = _get_client()
    if client is None:
        return None
    try:
        resp = client.models.generate_content(
            model=get_settings().gemini_model,
            contents=prompt,
            config=_gen_config(system, None, temperature),
        )
        text = (resp.text or "").strip()
    except Exception as e:
        _trip(e, "generate_text")
        return None
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
        if not available():
            return None
        client = _get_client()
        if client is None:
            return None
        try:
            from google.genai import types

            resp = client.models.embed_content(
                model=model,
                contents=[texts[i] for i in missing],
                config=types.EmbedContentConfig(task_type="SEMANTIC_SIMILARITY"),
            )
            vectors = [e.values for e in resp.embeddings]
        except Exception as e:
            _trip(e, "embed")
            return None
        for i, vec in zip(missing, vectors):
            out[i] = vec
            _cache_put(_key("emb", model, texts[i]), vec)
    return out  # type: ignore[return-value]
