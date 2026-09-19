"""AI triage for BE1's POST /api/reports pipeline (app/pipeline.py). Owner: BE2.

    from app.services.triage import prepare, triage, apply_to_incident, refresh_summary

    report = save_raw(body)                          # BE1: committed first, never lost
    prep = prepare(report)                           # AI classify + geocode + embed, ~1-2 s, NO DB:
                                                     #   run it OUTSIDE the pipeline lock so concurrent
                                                     #   reports are classified in parallel
    with PIPELINE_LOCK:                              # only the fast, race-sensitive part is serialised
        t = triage(db, report, prepared=prep)        # dedup (+ incident_id hint), milliseconds
        report.lat, report.lng = t.lat, t.lng
        report.lang, report.ai_json = t.classification.lang, t.classification.to_dict()
        if t.match is None:
            incident = Incident(status="new", lat=t.lat, lng=t.lng, address=t.address, report_count=1)
            apply_to_incident(incident, t.classification, is_new=True); db.add(incident); db.flush()
        else:
            incident = t.match
            incident.report_count += 1
            apply_to_incident(incident, t.classification, is_new=False)   # escalates, never downgrades
        report.incident_id = incident.id
        db.commit()
    # broadcast, then in the background: refresh_summary(incident) -> commit -> incident.updated

triage(db, report) without `prepared` still works (it calls prepare() itself).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any

from app.services import dedup, summarizer
from app.services.classifier import ClassificationResult, classify, priority_for
from app.services.gazetteer import CITY_CENTER, geocode

log = logging.getLogger("resqnet.triage")


@dataclass
class TriageResult:
    classification: ClassificationResult
    match: Any | None            # open Incident this report duplicates, or None → create new
    lat: float
    lng: float
    address: str | None
    geocoded: bool               # True if lat/lng came from the gazetteer, not the reporter
    approximate: bool            # True if we fell back to the city centre (show "location unverified")


def _get(obj: Any, name: str, default: Any = None) -> Any:
    return obj.get(name, default) if isinstance(obj, dict) else getattr(obj, name, default)


@dataclass
class Prepared:
    """The slow, DB-free half of triage (AI classification, geocoding, embedding warm-up)."""
    classification: ClassificationResult
    lat: float
    lng: float
    address: str | None
    geocoded: bool
    approximate: bool


def prepare(report: Any) -> Prepared:
    """AI + geocoding for one report. No DB access, thread-safe, never raises.

    Run this OUTSIDE any pipeline lock (it takes ~1-2 s with an LLM), then pass the result to
    triage(db, report, prepared=...) inside the lock; that part is only dedup (milliseconds).
    """
    text = _get(report, "text")
    cls = classify(
        text,
        _get(report, "source", "citizen"),
        sensor=_get(report, "sensor"),
        lang_hint=_get(report, "lang"),
        photo_url=_get(report, "photo_url"),
    )

    lat, lng = _get(report, "lat"), _get(report, "lng")
    address = _get(report, "address")
    geocoded = approximate = False
    if lat is None or lng is None:
        hit = geocode(cls.location_text) or geocode(text) or geocode(_get(report, "address"))
        if hit:
            lat, lng, name = hit
            address = address or name
            geocoded = True
        else:
            lat, lng = CITY_CENTER
            approximate = True
            cls.confidence = round(min(cls.confidence, 0.4), 2)
            cls.reasoning = f"{cls.reasoning} Location not given; placed at city centre for verification.".strip()
    if not address:
        address = cls.location_text
    if text and text.strip():
        try:
            dedup.embed_batch([text])  # warm the per-text embedding cache so dedup under the lock is local
        except Exception as e:  # dedup falls back to geo + time on its own
            log.info("embedding warm-up skipped: %s", e)
    return Prepared(cls, lat, lng, address, geocoded, approximate)


def triage(db, report: Any, prepared: Prepared | None = None) -> TriageResult:
    """Classify, locate and de-duplicate one saved report. Never raises.

    Pass `prepared=prepare(report)` (computed outside your lock) to keep only the fast dedup step
    inside it; without it, prepare() runs here.
    """
    p = prepared if prepared is not None else prepare(report)
    cls, lat, lng, address = p.classification, p.lat, p.lng, p.address
    geocoded, approximate = p.geocoded, p.approximate
    text = _get(report, "text")

    # A report that already names its incident (e.g. a responder's field update from /field)
    # attaches to it directly — no duplicate guessing, even without GPS.
    hinted = _hinted_incident(db, _get(report, "incident_id"))
    if hinted is not None:
        if approximate:
            lat, lng = _get(hinted, "lat") or lat, _get(hinted, "lng") or lng
            address = _get(hinted, "address") or address
            approximate = False
        return TriageResult(cls, hinted, lat, lng, address, geocoded, approximate)

    view = SimpleNamespace(
        id=_get(report, "id"),
        source=_get(report, "source"),
        text=text,
        lat=None if approximate else lat,  # never merge on a made-up location
        lng=None if approximate else lng,
        created_at=_get(report, "created_at") or datetime.now(timezone.utc),
        incident_id=_get(report, "incident_id"),
    )
    match = dedup.find_match(db, view, cls)
    return TriageResult(cls, match, lat, lng, address, geocoded, approximate)


def _hinted_incident(db, incident_id: Any) -> Any | None:
    if not incident_id:
        return None
    try:
        from app.models import Incident

        inc = db.get(Incident, incident_id)
        return inc if inc is not None and _get(inc, "status") != "resolved" else None
    except Exception as e:
        log.info("incident hint %s ignored: %s", incident_id, e)
        return None


def apply_to_incident(incident: Any, cls: ClassificationResult, is_new: bool) -> Any:
    """Write AI-owned fields onto an Incident (new or merged). Does not commit."""
    if is_new:
        incident.type = cls.type
        incident.severity = cls.severity
        incident.hazards = list(cls.hazards)
        incident.title = cls.title
        incident.ai_reasoning = cls.reasoning
        incident.confidence = cls.confidence
        incident.people_affected_est = cls.people_affected_est
    else:
        # Merge: escalate, never downgrade, on new evidence.
        if incident.type == "other" and cls.type != "other":
            incident.type = cls.type
            incident.title = cls.title
        if cls.severity > (incident.severity or 0):
            incident.severity = cls.severity
            incident.ai_reasoning = cls.reasoning
        incident.hazards = list(dict.fromkeys(list(incident.hazards or []) + list(cls.hazards)))
        incident.confidence = round(max(incident.confidence or 0, cls.confidence), 2)
        if cls.people_affected_est and cls.people_affected_est > (incident.people_affected_est or 0):
            incident.people_affected_est = cls.people_affected_est
    incident.priority = priority_for(incident.severity, incident.hazards or [])
    if hasattr(incident, "updated_at"):
        incident.updated_at = datetime.now(timezone.utc)
    return incident


def refresh_summary(incident: Any, force: bool = False) -> dict:
    """Recompute ai_summary / ai_actions from the incident's reports. Does not commit."""
    result = summarizer.summarize_incident(incident, list(getattr(incident, "reports", None) or []), force=force)
    incident.ai_summary = result["summary"]
    incident.ai_actions = result["actions"]
    return result
