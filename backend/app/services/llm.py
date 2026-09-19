"""Failure-safe LLM layer over OpenAI and Gemini. Owner: BE2.

Providers are tried in the order of LLM_PROVIDERS / EMBED_PROVIDERS (default: openai, then gemini);
within a provider, its models are tried in order. Every public function returns None on any failure
(no key, timeout, quota, bad JSON), so callers fall back to rules.

Protection built in:
- per-model client-side RPM pacing, and "benching" a model that returns 429 (daily quota → 1 h)
- one retry on transient 5xx, then the next model / provider
- unsupported request params (temperature, reasoning_effort, strict JSON schema, thinking) are
  detected from the 400 error and dropped for that model automatically
- OpenAI spend is estimated from token usage and capped at OPENAI_BUDGET_USD
- results cached in memory + SQLite (LLM_CACHE_PATH) so a warmed demo needs no network
"""
from __future__ import annotations

import base64
import gzip
import copy
import hashlib
import json
import logging
import re
import sqlite3
import threading
import time
from collections import OrderedDict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from app.config import get_settings

log = logging.getLogger("resqnet.llm")

TIMEOUT_SEC = 12  # Gemini's API minimum is 10 s
CACHE_VERSION = 3  # bump to invalidate every cached answer (e.g. after a big prompt change)
_CACHE_MAX = 2000
COOLDOWN_SEC = 10
RETRY_BACKOFF_SEC = 1.0
DAILY_BENCH_SEC = 3600

_cache: OrderedDict[str, Any] = OrderedDict()
_cache_lock = threading.Lock()  # prepare() runs in parallel threads: check-then-move/evict must be atomic
# eval.py --no-cache sets this: skip cache reads/writes but keep recording spend.
BYPASS_CACHE = False
# Which "provider:model" produced the last successful answer on this thread ("cache:<provider:model>" if cached).
_last = threading.local()


def last_source() -> str | None:
    return getattr(_last, "source", None)


def _set_source(src: str | None) -> None:
    _last.source = src


def _key(*parts: Any) -> str:
    raw = json.dumps((CACHE_VERSION, *parts), ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()


# ============================================================ persistent cache (+ spend ledger)

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
            _disk.execute("CREATE TABLE IF NOT EXISTS spend (provider TEXT PRIMARY KEY, usd REAL NOT NULL)")
            _disk.commit()
        except sqlite3.Error as e:
            log.warning("Disk cache disabled: %s", e)
            _disk_failed = True
    return _disk


# ============================================================ demo seed (read-only, shipped in git)
# AI answers for the demo scenario, exported by scripts/export_demo_cache.py. Render's free tier has
# no shell to run warm_cache.py and its disk is wiped on every deploy, so the seed makes a fresh
# deploy answer the scenario instantly, for free, with exactly the outputs we tested. Keys include
# CACHE_VERSION, so a prompt change silently invalidates the seed instead of serving stale answers.
DEMO_SEED_PATH = Path(__file__).resolve().parent.parent / "data" / "demo_ai_cache.json.gz"
_seed: dict[str, Any] | None = None
_seed_lock = threading.Lock()
# scripts/export_demo_cache.py sets this to a set() to record every cache key a run reads or writes.
RECORD_KEYS: set[str] | None = None


def _seed_get(k: str) -> Any:
    global _seed
    if _seed is None:
        with _seed_lock:
            if _seed is None:
                try:
                    with gzip.open(DEMO_SEED_PATH, "rt", encoding="utf-8") as f:
                        _seed = json.load(f)
                    log.info("Demo AI seed loaded: %d answers", len(_seed))
                except FileNotFoundError:
                    _seed = {}
                except (OSError, ValueError) as e:
                    log.warning("Demo AI seed unreadable, ignoring: %s", e)
                    _seed = {}
    return _seed.get(k)


def demo_seed_size() -> int:
    _seed_get("")  # load on first use
    return len(_seed or {})


def export_entries(keys: set[str]) -> dict[str, Any]:
    """Current cached values for these keys (memory, then disk). Used to build the demo seed."""
    out = {}
    for k in sorted(keys):
        v = _cache_get(k)
        if v is not None:
            out[k] = v
    return out


def _cache_get(k: str) -> Any:
    if BYPASS_CACHE:
        return None
    if RECORD_KEYS is not None:
        RECORD_KEYS.add(k)
    with _cache_lock:
        if k in _cache:
            _cache.move_to_end(k)
            return _cache[k]
    if (v := _seed_get(k)) is not None:
        _mem_put(k, v)
        return v
    conn = _disk_conn()
    if conn is not None:
        try:
            with _disk_lock:
                row = conn.execute("SELECT v FROM cache WHERE k = ?", (k,)).fetchone()
        except sqlite3.Error:
            row = None
        if row is not None:
            v = json.loads(row[0])
            _mem_put(k, v)
            return v
    return None


def _mem_put(k: str, v: Any) -> None:
    with _cache_lock:
        _cache[k] = v
        _cache.move_to_end(k)
        while len(_cache) > _CACHE_MAX:
            _cache.popitem(last=False)


def _cache_put(k: str, v: Any) -> None:
    if BYPASS_CACHE:
        return
    if RECORD_KEYS is not None:
        RECORD_KEYS.add(k)
    _mem_put(k, v)
    conn = _disk_conn()
    if conn is not None:
        try:
            with _disk_lock:
                conn.execute("INSERT OR REPLACE INTO cache (k, v) VALUES (?, ?)", (k, json.dumps(v, ensure_ascii=False)))
                conn.commit()
        except sqlite3.Error as e:
            log.info("Disk cache write failed: %s", e)


# ============================================================ OpenAI spend tracking

# Approximate USD per 1M tokens (input, output). Deliberately on the high side → conservative cap.
_PRICES: list[tuple[str, tuple[float, float]]] = [
    ("gpt-5-nano", (0.05, 0.40)),
    ("gpt-5-mini", (0.25, 2.00)),
    ("gpt-4.1-nano", (0.10, 0.40)),
    ("gpt-4.1-mini", (0.40, 1.60)),
    ("gpt-4o-mini", (0.15, 0.60)),
    ("text-embedding-3-small", (0.02, 0.0)),
    ("text-embedding-3-large", (0.13, 0.0)),
]
_DEFAULT_PRICE = (2.50, 10.00)
_spend_mem: dict[str, float] = {}
_spend_lock = threading.Lock()


def _price(model: str) -> tuple[float, float]:
    return next((p for prefix, p in _PRICES if model.startswith(prefix)), _DEFAULT_PRICE)


def spent_usd(provider: str = "openai") -> float:
    conn = _disk_conn()
    if conn is not None:
        try:
            with _disk_lock:
                row = conn.execute("SELECT usd FROM spend WHERE provider = ?", (provider,)).fetchone()
            return float(row[0]) if row else 0.0
        except sqlite3.Error:
            pass
    return _spend_mem.get(provider, 0.0)


def _record_spend(provider: str, model: str, tokens_in: int, tokens_out: int = 0) -> None:
    p_in, p_out = _price(model)
    usd = (tokens_in * p_in + tokens_out * p_out) / 1_000_000
    with _spend_lock:
        _spend_mem[provider] = _spend_mem.get(provider, 0.0) + usd
        conn = _disk_conn()
        if conn is not None:
            try:
                with _disk_lock:
                    conn.execute(
                        "INSERT INTO spend (provider, usd) VALUES (?, ?) "
                        "ON CONFLICT(provider) DO UPDATE SET usd = usd + excluded.usd",
                        (provider, usd),
                    )
                    conn.commit()
            except sqlite3.Error:
                pass


def _over_budget(provider: str) -> bool:
    if provider != "openai":
        return False
    cap = get_settings().openai_budget_usd
    return cap > 0 and spent_usd("openai") >= cap


# ============================================================ providers

@dataclass(frozen=True)
class Provider:
    name: str
    api_key: str
    models: tuple[str, ...]
    embed_model: str
    rpm: int


def _split(csv: str) -> list[str]:
    return [x for x in dict.fromkeys(p.strip() for p in csv.split(",")) if x]


def _provider(name: str) -> Provider | None:
    st = get_settings()
    if name == "openai" and st.openai_api_key:
        return Provider("openai", st.openai_api_key, tuple(_split(f"{st.openai_model},{st.openai_fallback_model}")),
                        st.openai_embed_model, st.openai_rpm)
    if name == "gemini" and st.gemini_api_key:
        return Provider("gemini", st.gemini_api_key, tuple(_split(f"{st.gemini_model},{st.gemini_fallback_model}")),
                        st.gemini_embed_model, st.gemini_rpm)
    return None


def _embed_models() -> list[str]:
    """Embedding model of every provider in EMBED_PROVIDERS order, whether or not its key is set."""
    st = get_settings()
    models = {"openai": st.openai_embed_model, "gemini": st.gemini_embed_model}
    return [models[n] for n in _split(st.embed_providers) if models.get(n)]


def _providers(kind: str = "gen") -> list[Provider]:
    st = get_settings()
    order = st.llm_providers if kind == "gen" else st.embed_providers
    return [p for name in _split(order) if (p := _provider(name)) is not None]


_clients: dict[str, Any] = {}


def _client_for(p: Provider):
    if p.name not in _clients:
        try:
            if p.name == "openai":
                from openai import OpenAI

                # gzip only: newer SDKs decode brotli with whatever `Brotli` package is installed, and old
                # ones (e.g. Anaconda's 1.0.9) crash with "process() takes no keyword arguments".
                _clients[p.name] = OpenAI(api_key=p.api_key, timeout=TIMEOUT_SEC, max_retries=0,
                                          default_headers={"Accept-Encoding": "gzip, deflate"})
            else:
                from google import genai
                from google.genai import types

                _clients[p.name] = genai.Client(api_key=p.api_key, http_options=types.HttpOptions(timeout=TIMEOUT_SEC * 1000))
        except Exception as e:  # pragma: no cover - import/config errors
            log.warning("%s client init failed: %s", p.name, e)
            _clients[p.name] = None
    return _clients[p.name]


# ============================================================ health: cooldowns, pacing, benching

_cooldown_until: dict[tuple[str, str], float] = {}  # (provider, "gen"|"emb") -> monotonic time
_calls: dict[str, list[float]] = {}                 # "provider:model" -> call times in the last 60 s
_benched_until: dict[str, float] = {}               # "provider:model" -> monotonic time usable again
_dropped: dict[str, set[str]] = {}                  # "provider:model" -> request params it rejected
_quota_lock = threading.Lock()
_RETRY_DELAY = re.compile(r"retry[_ ]?delay['\"]?:\s*['\"]?(\d+(?:\.\d+)?)s", re.I)
_TRY_AGAIN = re.compile(r"try again in (\d+(?:\.\d+)?)\s*(ms|s)", re.I)


def _provider_ok(p: Provider, kind: str) -> bool:
    return time.monotonic() >= _cooldown_until.get((p.name, kind), 0.0) and not _over_budget(p.name)


def available(kind: str = "gen") -> bool:
    """True if AI is enabled and at least one provider for `kind` ("gen"/"emb") is usable now."""
    return get_settings().ai_enabled and any(_provider_ok(p, kind) for p in _providers(kind))


def _trip(p: Provider, kind: str, e: Exception) -> None:
    _cooldown_until[(p.name, kind)] = time.monotonic() + COOLDOWN_SEC
    log.warning("%s %s failed (%s: %s) — skipping it for %ss", p.name, kind, type(e).__name__, str(e)[:200], COOLDOWN_SEC)


def _is_quota(e: Exception) -> bool:
    msg = str(e)
    return "429" in msg or "RESOURCE_EXHAUSTED" in msg or type(e).__name__ == "RateLimitError"


def _is_out_of_credit(e: Exception) -> bool:
    msg = str(e).lower()
    return "insufficient_quota" in msg or "billing" in msg and "429" in msg


def _transient(e: Exception) -> bool:
    msg = str(e)
    return type(e).__name__ in ("APITimeoutError", "APIConnectionError", "InternalServerError", "ReadTimeout") or any(
        c in msg for c in ("500", "502", "503", "504", "UNAVAILABLE", "INTERNAL", "timed out")
    )


def _is_timeout(e: Exception) -> bool:
    """No answer within TIMEOUT_SEC. Unlike a 5xx this is slow to find out and usually provider-wide
    (network, overload), so it is neither retried nor tried on the provider's next model: the report
    moves straight to the next provider (worst case ~12 s per provider instead of ~50 s)."""
    names = ("APITimeoutError", "ReadTimeout", "ConnectTimeout", "TimeoutException")
    return type(e).__name__ in names or "timed out" in str(e).lower()


def _take_slot(p: Provider, model: str) -> bool:
    key, now = f"{p.name}:{model}", time.monotonic()
    with _quota_lock:
        if _benched_until.get(key, 0) > now:
            return False
        recent = [t for t in _calls.get(key, []) if now - t < 60]
        if len(recent) >= max(1, p.rpm):
            _calls[key] = recent
            return False
        recent.append(now)
        _calls[key] = recent
        return True


def _quota_secs(e: Exception) -> float:
    """How long to stay away after a 429: daily quota / no credit → 1 h, else the API's retry hint."""
    msg = str(e)
    if "PerDay" in msg or _is_out_of_credit(e):
        return DAILY_BENCH_SEC
    if m := _RETRY_DELAY.search(msg):
        return max(1.0, float(m.group(1)))
    if m := _TRY_AGAIN.search(msg):
        return max(1.0, float(m.group(1)) / (1000 if m.group(2).lower() == "ms" else 1))
    return 60.0


def _bench(p: Provider, model: str, e: Exception) -> None:
    secs = _quota_secs(e)
    with _quota_lock:
        _benched_until[f"{p.name}:{model}"] = time.monotonic() + secs
    log.warning("%s model %s hit a quota/rate limit — skipping it for %ds", p.name, model, int(secs))


def has_capacity() -> bool:
    """True if some provider/model could take a generation request right now."""
    now = time.monotonic()
    with _quota_lock:
        for p in _providers("gen"):
            if not _provider_ok(p, "gen"):
                continue
            for m in p.models:
                key = f"{p.name}:{m}"
                if _benched_until.get(key, 0) <= now and len([t for t in _calls.get(key, []) if now - t < 60]) < p.rpm:
                    return True
    return False


def quota_status() -> dict:
    now = time.monotonic()
    out: dict[str, Any] = {}
    for p in _providers("gen"):
        for m in p.models:
            key = f"{p.name}:{m}"
            out[key] = {
                "calls_last_min": len([t for t in _calls.get(key, []) if now - t < 60]),
                "benched_for_sec": max(0, int(_benched_until.get(key, 0) - now)),
                "provider_cooling_sec": max(0, int(_cooldown_until.get((p.name, "gen"), 0) - now)),
            }
    return out


def spend_status() -> dict:
    st = get_settings()
    return {"openai_spent_usd": round(spent_usd("openai"), 4), "openai_budget_usd": st.openai_budget_usd,
            "openai_over_budget": _over_budget("openai")}


# ============================================================ request builders

_REASONING_PREFIXES = ("gpt-5", "o1", "o3", "o4")


def _strict_schema(schema: dict) -> dict:
    """Make a JSON schema acceptable to OpenAI strict structured outputs.

    Every property must be required and objects must forbid extra keys; originally-optional
    properties become nullable. Numeric bounds are dropped (we clamp values ourselves).
    """
    s = copy.deepcopy(schema)

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            for k in ("minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "minItems", "maxItems"):
                node.pop(k, None)
            if node.get("type") == "object" and isinstance(node.get("properties"), dict):
                props = node["properties"]
                required = set(node.get("required", []))
                for name, sub in props.items():
                    if name not in required and isinstance(sub, dict):
                        t = sub.get("type")
                        if isinstance(t, str) and t != "null":
                            sub["type"] = [t, "null"]
                        elif isinstance(t, list) and "null" not in t:
                            sub["type"] = [*t, "null"]
                        if "enum" in sub and None not in sub["enum"]:
                            sub["enum"] = [*sub["enum"], None]
                node["required"] = list(props)
                node["additionalProperties"] = False
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)

    walk(s)
    return s


def _openai_call(client, model: str, prompt: str, system: str | None, schema: dict | None,
                 temperature: float, image: tuple[bytes, str] | None) -> str:
    dropped = _dropped.get(f"openai:{model}", set())
    if image is None:
        content: Any = prompt
    else:
        b64 = base64.b64encode(image[0]).decode()
        content = [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": f"data:{image[1]};base64,{b64}", "detail": "low"}},
        ]
    messages: list[dict] = []
    if system:
        messages.append({"role": "system", "content": system})
    kw: dict[str, Any] = {"model": model}
    if "temperature" not in dropped:
        kw["temperature"] = temperature
    effort = get_settings().openai_reasoning_effort
    if effort and model.startswith(_REASONING_PREFIXES) and "reasoning_effort" not in dropped:
        kw["reasoning_effort"] = effort
    if schema is not None:
        if "json_schema" not in dropped:
            kw["response_format"] = {
                "type": "json_schema",
                "json_schema": {"name": "result", "schema": _strict_schema(schema), "strict": True},
            }
        else:
            kw["response_format"] = {"type": "json_object"}
            suffix = "\n\nReturn ONLY a JSON object matching this JSON schema:\n" + json.dumps(schema)
            if isinstance(content, str):
                content = content + suffix
            else:
                content = [{**content[0], "text": content[0]["text"] + suffix}, *content[1:]]
    messages.append({"role": "user", "content": content})
    resp = client.chat.completions.create(messages=messages, **kw)
    usage = getattr(resp, "usage", None)
    if usage is not None:
        _record_spend("openai", model, getattr(usage, "prompt_tokens", 0) or 0, getattr(usage, "completion_tokens", 0) or 0)
    return resp.choices[0].message.content or ""


def _gemini_call(client, model: str, prompt: str, system: str | None, schema: dict | None,
                 temperature: float, image: tuple[bytes, str] | None) -> str:
    from google.genai import types

    dropped = _dropped.get(f"gemini:{model}", set())
    kwargs: dict[str, Any] = {"temperature": temperature}
    if system:
        kwargs["system_instruction"] = system
    if schema is not None:
        kwargs["response_mime_type"] = "application/json"
        kwargs["response_json_schema"] = schema
    level = get_settings().gemini_thinking_level
    if level and "thinking" not in dropped:
        kwargs["thinking_config"] = types.ThinkingConfig(thinking_level=level)
    contents: Any = prompt if image is None else [types.Part.from_bytes(data=image[0], mime_type=image[1]), prompt]
    resp = client.models.generate_content(model=model, contents=contents, config=types.GenerateContentConfig(**kwargs))
    return resp.text or ""


_CALLERS: dict[str, Callable[..., str]] = {"openai": _openai_call, "gemini": _gemini_call}

# (provider, substring of the 400 error) -> param to drop and retry without
_ADAPT = [
    ("gemini", "thinking", "thinking"),
    ("openai", "temperature", "temperature"),
    ("openai", "reasoning_effort", "reasoning_effort"),
    ("openai", "json_schema", "json_schema"),
    ("openai", "response_format", "json_schema"),
]


def _adapt(p: Provider, model: str, e: Exception) -> bool:
    """If the error says a param is unsupported, drop it for this model and return True (retry)."""
    msg = str(e).lower()
    if "400" not in msg and type(e).__name__ not in ("BadRequestError", "ClientError"):
        return False
    key = f"{p.name}:{model}"
    dropped = _dropped.setdefault(key, set())
    for prov, needle, param in _ADAPT:
        if prov == p.name and needle in msg and param not in dropped:
            dropped.add(param)
            log.info("%s rejected '%s' — retrying without it", key, param)
            return True
    return False


def _generate(prompt: str, system: str | None, schema: dict | None, temperature: float,
              image: tuple[bytes, str] | None = None) -> str | None:
    """Try providers → models in order. Returns response text or None."""
    for p in _providers("gen"):
        if not _provider_ok(p, "gen"):
            continue
        client = _client_for(p)
        if client is None:
            continue
        outage: Exception | None = None
        for model in p.models:
            if outage is not None and _is_timeout(outage):
                break  # the provider is not answering: don't spend another TIMEOUT_SEC on its next model
            if not _take_slot(p, model):
                continue
            retried = False
            for _attempt in range(5):
                try:
                    text = _CALLERS[p.name](client, model, prompt, system, schema, temperature, image)
                    if text and text.strip():
                        _set_source(f"{p.name}:{model}")
                        return text
                    break  # empty answer: try next model
                except Exception as e:
                    if _adapt(p, model, e):
                        continue
                    if _is_quota(e):
                        _bench(p, model, e)
                        break
                    if type(e).__name__ == "NotFoundError" or "404" in str(e):
                        with _quota_lock:  # model name not available to this key: stop trying it
                            _benched_until[f"{p.name}:{model}"] = time.monotonic() + DAILY_BENCH_SEC
                        log.warning("%s model %s not found — check the model name in .env", p.name, model)
                        break
                    if _transient(e) and not retried and not _is_timeout(e):
                        retried = True
                        time.sleep(RETRY_BACKOFF_SEC)
                        continue
                    if type(e).__name__ in ("AuthenticationError", "PermissionDeniedError"):
                        log.error("%s rejected the API key: %s", p.name, str(e)[:160])
                    outage = e
                    log.info("%s model %s failed (%s), trying next", p.name, model, type(e).__name__)
                    break
        if outage is not None:
            _trip(p, "gen", outage)
    return None


def _parse_json(text: str | None) -> Any | None:
    if text is None:
        return None
    t = text.strip()
    if t.startswith("```"):  # tolerate fenced JSON from json_object mode
        t = re.sub(r"^```(?:json)?\s*|\s*```$", "", t)
    try:
        return json.loads(t)
    except (TypeError, ValueError) as e:
        log.warning("LLM returned invalid JSON: %s", e)
        return None


# ============================================================ public API

def _cached(k: str) -> Any | None:
    """Cached generation result (and set last_source to 'cache:<who answered originally>')."""
    hit = _cache_get(k)
    if isinstance(hit, dict) and "v" in hit:
        _set_source(f"cache:{hit.get('by') or '?'}")
        return hit["v"]
    return None


def generate_json(prompt: str, schema: dict, system: str | None = None, temperature: float = 0.0) -> Any | None:
    """Return parsed JSON matching `schema`, or None."""
    if not get_settings().ai_enabled:
        return None
    k = _key("json", system, prompt, schema, temperature)
    if (hit := _cached(k)) is not None:  # before provider checks: seed/cache work with no key or network
        return hit
    if not available():
        return None
    _set_source(None)
    data = _parse_json(_generate(prompt, system, schema, temperature))
    if data is not None:
        _cache_put(k, {"v": data, "by": last_source()})
    return data


def generate_json_with_image(
    prompt: str, image: bytes, mime_type: str, schema: dict, system: str | None = None, temperature: float = 0.0
) -> Any | None:
    """Vision variant of generate_json. Returns parsed JSON or None."""
    if not get_settings().ai_enabled or not image:
        return None
    k = _key("img", system, prompt, hashlib.sha256(image).hexdigest(), schema, temperature)
    if (hit := _cached(k)) is not None:
        return hit
    if not available():
        return None
    _set_source(None)
    data = _parse_json(_generate(prompt, system, schema, temperature, image=(image, mime_type)))
    if data is not None:
        _cache_put(k, {"v": data, "by": last_source()})
    return data


def generate_text(prompt: str, system: str | None = None, temperature: float = 0.3) -> str | None:
    if not get_settings().ai_enabled:
        return None
    k = _key("text", system, prompt, temperature)
    if (hit := _cached(k)) is not None:
        return hit
    if not available():
        return None
    _set_source(None)
    text = (_generate(prompt, system, None, temperature) or "").strip()
    if not text:
        return None
    _cache_put(k, {"v": text, "by": last_source()})
    return text


def _embed_call(p: Provider, client, texts: list[str]) -> list[list[float]]:
    if p.name == "openai":
        resp = client.embeddings.create(model=p.embed_model, input=texts)
        usage = getattr(resp, "usage", None)
        if usage is not None:
            _record_spend("openai", p.embed_model, getattr(usage, "total_tokens", 0) or 0)
        return [d.embedding for d in sorted(resp.data, key=lambda d: d.index)]
    from google.genai import types

    resp = client.models.embed_content(
        model=p.embed_model, contents=texts, config=types.EmbedContentConfig(task_type="SEMANTIC_SIMILARITY")
    )
    return [e.values for e in resp.embeddings]


def embed_with_model(texts: list[str]) -> tuple[str, list[list[float]]] | None:
    """Embed texts with ONE provider (vectors from different models are not comparable).

    Returns (embed_model_name, vectors) or None. Uses the first provider that has every text
    cached, else the first provider that answers.
    """
    if not texts:
        return ("", [])
    if not get_settings().ai_enabled:
        return None
    providers = _providers("emb")
    for model in _embed_models():  # fully cached → no network (and no key) needed
        cached = [_cache_get(_key("emb", model, t)) for t in texts]
        if all(v is not None for v in cached):
            return model, cached  # type: ignore[return-value]
    for p in providers:
        if not _provider_ok(p, "emb"):
            continue
        client = _client_for(p)
        if client is None:
            continue
        out: list[list[float] | None] = [_cache_get(_key("emb", p.embed_model, t)) for t in texts]
        missing = [i for i, v in enumerate(out) if v is None]
        try:
            for attempt in range(2):
                try:
                    vectors = _embed_call(p, client, [texts[i] for i in missing])
                    break
                except Exception as e:
                    if attempt == 0 and _transient(e):
                        time.sleep(RETRY_BACKOFF_SEC)
                        continue
                    raise
        except Exception as e:
            if _is_quota(e):
                secs = _quota_secs(e)
                _cooldown_until[(p.name, "emb")] = time.monotonic() + secs
                log.warning("%s embeddings hit a quota — using the next provider for %ds", p.name, int(secs))
            else:
                _trip(p, "emb", e)
            continue
        for i, vec in zip(missing, vectors):
            out[i] = vec
            _cache_put(_key("emb", p.embed_model, texts[i]), vec)
        return p.embed_model, out  # type: ignore[return-value]
    return None


def cached_embeddings(texts: list[str]) -> tuple[str, list[list[float] | None]] | None:
    """Cache-only lookup, never a network call: safe while a lock is held.

    Returns (embed_model, vectors) for the first model (EMBED_PROVIDERS order) that has texts[0]
    cached; other texts' vectors are None when not cached for that model. None if texts[0] has no
    cached vector for any model (or AI is disabled).
    """
    if not texts or not get_settings().ai_enabled:
        return None
    for model in _embed_models():
        first = _cache_get(_key("emb", model, texts[0]))
        if first is not None:
            return model, [first] + [_cache_get(_key("emb", model, t)) for t in texts[1:]]
    return None


def embed(texts: list[str]) -> list[list[float]] | None:
    """Vectors only (see embed_with_model). None if embeddings are unavailable."""
    r = embed_with_model(texts)
    return None if r is None else r[1]
