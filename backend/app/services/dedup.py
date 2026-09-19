"""Duplicate detection: merge a new report into an existing open incident. Owner: BE2.

Contract: docs/API_CONTRACT.md §5 · PRD FR-3.
A report matches an open incident when ALL hold:
  1. compatible type (same, or either side is "other")
  2. within radius (300 m; 1 km for floods — they cover areas)
  3. incident's last activity within 30 min
  4. text similarity (embedding cosine) >= threshold — skipped if embeddings are unavailable
The best-scoring candidate wins. Never raises; returns None on any problem.
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from app.services import llm

log = logging.getLogger("resqnet.dedup")

RADIUS_KM = 0.3
FLOOD_RADIUS_KM = 1.0
TIME_WINDOW = timedelta(minutes=30)
SIM_THRESHOLD = 0.80
# Very close reports need less text agreement (people describe the same scene very differently,
# and cross-language embeddings score lower).
CLOSE_KM = 0.15
CLOSE_SIM_THRESHOLD = 0.60
# Without coordinates we only merge on very strong text similarity.
NO_GEO_SIM_THRESHOLD = 0.90
MAX_REPORTS_COMPARED = 5
OPEN_STATUSES = ("new", "triaged", "dispatched", "on_scene", "escalated")


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    try:
        from app.services.geo import haversine_km as _h  # BE1's implementation, if present

        return _h(lat1, lng1, lat2, lng2)
    except ImportError:
        pass
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


def embed(text: str) -> list[float] | None:
    """Embedding for one text (cached). None if unavailable."""
    if not text or not text.strip():
        return None
    vecs = llm.embed([text.strip()])
    return vecs[0] if vecs else None


def _utc(dt: datetime | None) -> datetime:
    if dt is None:
        return datetime.now(timezone.utc)
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _types_compatible(a: str, b: str) -> bool:
    return a == b or a == "other" or b == "other"


@dataclass
class Candidate:
    """Minimal view of an incident for matching (works for ORM objects and eval dicts)."""
    key: Any
    type: str
    lat: float | None
    lng: float | None
    last_at: datetime
    texts: list[str]


def match_score(
    *,
    new_type: str,
    new_lat: float | None,
    new_lng: float | None,
    new_at: datetime,
    new_text: str | None,
    cand: Candidate,
    use_embeddings: bool = True,
) -> float | None:
    """Return a 0..1 match score if `cand` is a duplicate target, else None."""
    if not _types_compatible(new_type, cand.type):
        return None
    if abs(_utc(new_at) - _utc(cand.last_at)) > TIME_WINDOW:
        return None

    radius = FLOOD_RADIUS_KM if "flood" in (new_type, cand.type) else RADIUS_KM
    has_geo = None not in (new_lat, new_lng, cand.lat, cand.lng)
    dist = haversine_km(new_lat, new_lng, cand.lat, cand.lng) if has_geo else None
    if dist is not None and dist > radius:
        return None

    sim = None
    if use_embeddings and new_text and cand.texts:
        new_vec = embed(new_text)
        if new_vec is not None:
            sims = [cosine(new_vec, v) for t in cand.texts[-MAX_REPORTS_COMPARED:] if (v := embed(t)) is not None]
            sim = max(sims) if sims else None

    if dist is None:
        # No location on one side: only merge on near-identical text.
        if sim is None or sim < NO_GEO_SIM_THRESHOLD:
            return None
        return round(sim * 0.9, 3)

    geo_score = 1.0 - dist / radius
    if sim is None:
        # Embeddings unavailable → geo + time + type only (PRD fallback).
        return round(0.5 + 0.5 * geo_score, 3)
    needed = CLOSE_SIM_THRESHOLD if dist <= CLOSE_KM else SIM_THRESHOLD
    if sim < needed:
        return None
    return round(0.6 * sim + 0.4 * geo_score, 3)


def best_match(
    *,
    new_type: str,
    new_lat: float | None,
    new_lng: float | None,
    new_at: datetime,
    new_text: str | None,
    candidates: list[Candidate],
    use_embeddings: bool = True,
) -> tuple[Candidate, float] | None:
    best: tuple[Candidate, float] | None = None
    if use_embeddings and new_text:
        # Warm the embedding cache with ONE batched API call instead of one per text.
        texts = [new_text.strip()] + [t.strip() for c in candidates for t in c.texts[-MAX_REPORTS_COMPARED:] if t]
        llm.embed(list(dict.fromkeys(t for t in texts if t))[:100])  # API batch limit
    for c in candidates:
        s = match_score(
            new_type=new_type, new_lat=new_lat, new_lng=new_lng, new_at=new_at,
            new_text=new_text, cand=c, use_embeddings=use_embeddings,
        )
        if s is not None and (best is None or s > best[1]):
            best = (c, s)
    return best


def _incident_candidate(inc: Any) -> Candidate:
    reports = list(getattr(inc, "reports", None) or [])
    texts = [r.text for r in reports if getattr(r, "text", None)]
    last_at = getattr(inc, "updated_at", None) or getattr(inc, "created_at", None)
    if reports:
        times = [getattr(r, "created_at", None) for r in reports]
        times = [_utc(t) for t in times if t is not None]
        if times:
            last_at = max(times)
    return Candidate(
        key=inc, type=inc.type, lat=getattr(inc, "lat", None), lng=getattr(inc, "lng", None),
        last_at=_utc(last_at), texts=texts,
    )


def _open_incidents(db) -> list[Any]:
    from app.models import Incident  # BE1's model

    cutoff = datetime.now(timezone.utc) - TIME_WINDOW - timedelta(minutes=5)
    q = db.query(Incident).filter(Incident.status.in_(OPEN_STATUSES))
    items = q.all()
    # Filter in Python so naive/aware datetime differences between SQLite and Postgres don't matter.
    return [i for i in items if _utc(getattr(i, "updated_at", None) or getattr(i, "created_at", None)) >= cutoff]


def find_match(db, report: Any, cls: Any) -> Any | None:
    """Return the open Incident this report duplicates, or None. Never raises.

    `report` needs .text/.lat/.lng/.created_at; `cls` is a ClassificationResult.
    Pass the report BEFORE linking it to an incident (it must not match itself).
    """
    try:
        if getattr(report, "source", None) == "sensor":
            text = None  # sensor readings have no meaningful text; geo/time/type only
        else:
            text = getattr(report, "text", None)
        candidates = [
            _incident_candidate(i) for i in _open_incidents(db) if i.id != getattr(report, "incident_id", None)
        ]
        if not candidates:
            return None
        hit = best_match(
            new_type=cls.type,
            new_lat=getattr(report, "lat", None),
            new_lng=getattr(report, "lng", None),
            new_at=_utc(getattr(report, "created_at", None)),
            new_text=text,
            candidates=candidates,
        )
        if hit:
            log.info("Report merged into incident %s (score %.2f)", getattr(hit[0].key, "id", "?"), hit[1])
            return hit[0].key
        return None
    except Exception as e:
        log.exception("find_match failed, treating as new incident: %s", e)
        return None
