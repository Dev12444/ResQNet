"""Thin, failure-safe wrapper around the Gemini API. Owner: BE2.

Every function returns None on any failure (no key, timeout, rate limit, bad JSON),
so callers can fall back to rules. Results are cached in-process by input hash.
"""
from __future__ import annotations

import hashlib
import json
import logging
import re
import sqlite3
import threading
import time
from collections import OrderedDict
from pathlib import Path
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


# Persistent cache so AI results survive restarts (fast, offline-safe demo after `scripts/warm_cache.py`).
# Set LLM_CACHE_PATH="" to disable. Path is relative to the backend/ working directory; gitignored (*.sqlite3).
_disk: sqlite3.Connection | None = None
_disk_lock = threading.Lock()
_disk_failed = False


def _disk_conn() -> sqlite3.Connection | None:
    global _disk, _disk_failed
    path = get_settings().llm_cache_path
    if _disk is None and not _disk_failed and path:
        try:
            Path(path).parent.mkdir(parents=True, exist_ok=True)
            _disk = sqlite3.connect(path, check_same_thread=False)
            _disk.execute("CREATE TABLE IF NOT EXISTS cache (k TEXT PRIMARY KEY, v TEXT NOT NULL)")
            _disk.commit()
        except sqlite3.Error as e:
            log.warning("Disk cache disabled: %s", e)
            _disk_failed = True
    return _disk


def _cache_get(k: str) -> Any:
    if k in _cache:
        _cache.move_to_end(k)
        return _cache[k]
    conn = _disk_conn()
    if conn is not None:
        try:
            with _disk_lock:
                row = conn.execute("SELECT v FROM cache WHERE k = ?", (k,)).fetchone()
        except sqlite3.Error:
            row = None
        if row is not None:
            v = json.loads(row[0])
            _cache[k] = v
            return v
    return None


def _cache_put(k: str, v: Any) -> None:
    _cache[k] = v
    _cache.move_to_end(k)
    while len(_cache) > _CACHE_MAX:
        _cache.popitem(last=False)
    conn = _disk_conn()
    if conn is not None:
        try:
            with _disk_lock:
                conn.execute("INSERT OR REPLACE INTO cache (k, v) VALUES (?, ?)", (k, json.dumps(v, ensure_ascii=False)))
                conn.commit()
        except sqlite3.Error as e:
            log.info("Disk cache write failed: %s", e)


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
    names = [st.gemini_model, *st.gemini_fallback_model.split(",")]
    return [m for m in dict.fromkeys(n.strip() for n in names) if m]


# ---- quota handling: pace each model client-side and bench models that hit 429s
_calls: dict[str, list[float]] = {}       # model -> monotonic timestamps of calls in the last 60 s
_benched_until: dict[str, float] = {}     # model -> monotonic time it may be used again
_quota_lock = threading.Lock()
DAILY_BENCH_SEC = 3600                    # daily quota gone: skip the model for an hour (then re-probe)
_RETRY_DELAY = re.compile(r"retryDelay['\"]?:\s*['\"]?(\d+(?:\.\d+)?)s")


def _take_slot(model: str) -> bool:
    """Reserve a request slot for `model` under the RPM budget. False = skip this model for now."""
    now = time.monotonic()
    with _quota_lock:
        if _benched_until.get(model, 0) > now:
            return False
        recent = [t for t in _calls.get(model, []) if now - t < 60]
        if len(recent) >= max(1, get_settings().gemini_rpm):
            _calls[model] = recent
            return False
        recent.append(now)
        _calls[model] = recent
        return True


def _bench(model: str, e: Exception) -> None:
    msg = str(e)
    if "PerDay" in msg:
        secs = DAILY_BENCH_SEC
    else:
        m = _RETRY_DELAY.search(msg)
        secs = float(m.group(1)) if m else 60.0
    with _quota_lock:
        _benched_until[model] = time.monotonic() + secs
    log.warning("Gemini model %s hit its quota — skipping it for %ds", model, int(secs))


def has_capacity() -> bool:
    """True if at least one model could take a request right now (not benched, under its RPM)."""
    now = time.monotonic()
    rpm = max(1, get_settings().gemini_rpm)
    with _quota_lock:
        return any(
            _benched_until.get(m, 0) <= now and len([t for t in _calls.get(m, []) if now - t < 60]) < rpm
            for m in _models()
        )


def quota_status() -> dict:
    """For debugging / the /health endpoint: which models are usable right now."""
    now = time.monotonic()
    return {
        m: {
            "calls_last_min": len([t for t in _calls.get(m, []) if now - t < 60]),
            "benched_for_sec": max(0, int(_benched_until.get(m, 0) - now)),
        }
        for m in _models()
    }


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


def _generate(prompt: Any, system: str | None, schema: dict | None, temperature: float) -> str | None:
    """Try each configured model in order. `prompt` is a string or a list of Parts. Returns text or None."""
    client = _get_client()
    if client is None:
        return None
    last_err: Exception | None = None
    for model in _models():
        if not _take_slot(model):
            continue
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
                if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                    _bench(model, e)  # quota: move straight to the next model
                    break
                if _transient(e) and not retried:
                    retried = True
                    time.sleep(RETRY_BACKOFF_SEC)
                    continue
                log.info("Gemini model %s failed (%s), trying next", model, type(e).__name__)
                break
    # Only cool down the whole API on real outages; quota/pacing skips are handled per model.
    if last_err is not None and not ("429" in str(last_err) or "RESOURCE_EXHAUSTED" in str(last_err)):
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


def generate_json_with_image(
    prompt: str, image: bytes, mime_type: str, schema: dict, system: str | None = None, temperature: float = 0.0
) -> Any | None:
    """Multimodal variant of generate_json (Gemini Vision). Returns parsed JSON or None."""
    if not available() or not image:
        return None
    k = _key("img", _models(), system, prompt, hashlib.sha256(image).hexdigest(), schema, temperature)
    if (hit := _cache_get(k)) is not None:
        return hit
    from google.genai import types

    parts = [types.Part.from_bytes(data=image, mime_type=mime_type), prompt]
    text = _generate(parts, system, schema, temperature)
    if text is None:
        return None
    try:
        data = json.loads(text)
    except (TypeError, ValueError) as e:
        log.warning("Gemini vision returned invalid JSON: %s", e)
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
