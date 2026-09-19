"""Report ingestion pipeline. Owner: BE1.

Used by POST /api/reports and by the scenario simulator, so both follow the same path:

    raw report saved + committed  ->  prepare() (BE2: AI classify + geocode, no DB, NOT locked)
    ->  [lock] triage(prepared) dedup  ->  create or merge incident  ->  audit  ->  commit [/lock]
    ->  (caller) broadcast
    ->  background: refresh_summary() -> commit -> broadcast incident.updated
        (if BE2's summarizer debounce skipped it: one trailing refresh when the window ends)

Guarantees:
- The raw report is committed before any processing, so it is never lost (PRD §7);
  if processing fails it stays stored, unlinked, and ReportProcessingError is raised.
- Dedup + incident create/merge run under a process-wide lock, so concurrent reports
  about the same event merge instead of racing into duplicate incidents. The slow AI call
  (~1-2 s) runs before the lock, so simultaneous reports are classified in parallel and only
  the millisecond dedup step is serialised (fine for one Render instance; multiple workers
  would need a DB-level lock).
"""
from __future__ import annotations

import logging
import threading
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.engine import Connection, Engine
from sqlalchemy.orm import Session, selectinload

from app import audit
from app import models as m
from app.schemas import IncidentOut, ReportCreate
from app.services import summarizer
from app.services.classifier import ClassificationResult
from app.services.triage import apply_to_incident, prepare, refresh_summary, triage
from app.ws_manager import manager

log = logging.getLogger("resqnet.pipeline")

_PIPELINE_LOCK = threading.Lock()
PIPELINE_LOCK = _PIPELINE_LOCK  # also taken by unmerge (routers/incidents.py)

# BE2's summarizer re-summarises an incident at most once per summarizer.MIN_INTERVAL_SEC and
# returns the cached summary in between. Reports merged inside that window would otherwise never
# be reflected (e.g. "1 report" on a 7-report incident), so one trailing refresh is scheduled.
_trailing_refresh: dict[int, threading.Timer] = {}
_TRAILING_LOCK = threading.Lock()


class IncidentNotFound(LookupError):
    def __init__(self, incident_id: int) -> None:
        super().__init__(f"Incident {incident_id} not found")
        self.incident_id = incident_id


class ReportProcessingError(RuntimeError):
    def __init__(self, report_id: int) -> None:
        super().__init__(f"Report {report_id} was saved but could not be processed")
        self.report_id = report_id


@dataclass(frozen=True)
class IngestResult:
    report: m.Report
    incident: m.Incident
    merged: bool
    classification: ClassificationResult


def incident_code(incident_id: int) -> str:
    return f"INC-{incident_id:04d}"


def _save_raw(db: Session, body: ReportCreate) -> m.Report:
    data = body.model_dump()
    data["sensor"] = body.sensor.model_dump() if body.sensor else None
    report = m.Report(**data)
    db.add(report)
    db.commit()  # stored before any processing: never lost
    return report


def ingest_report(db: Session, body: ReportCreate, actor: str) -> IngestResult:
    """Store, triage and attach one report. Does not broadcast (see publish_ingest).

    Raises IncidentNotFound (hinted incident_id does not exist; nothing stored) or
    ReportProcessingError (report stored, processing failed).
    """
    if body.incident_id is not None and db.get(m.Incident, body.incident_id) is None:
        raise IncidentNotFound(body.incident_id)

    report = _save_raw(db, body)
    report_id = report.id
    try:
        prepared = prepare(report)  # AI + geocoding, no DB: outside the lock so reports classify in parallel
        with _PIPELINE_LOCK:
            t = triage(db, report, prepared=prepared)  # dedup only (milliseconds)
            cls = t.classification
            report.lat, report.lng = t.lat, t.lng
            report.lang = cls.lang
            report.ai_json = cls.to_dict()
            merged = t.match is not None
            if merged:
                incident = t.match
                incident.report_count = (incident.report_count or 1) + 1
                apply_to_incident(incident, cls, is_new=False)
            else:
                incident = m.Incident(status="new", lat=t.lat, lng=t.lng, address=t.address, report_count=1,
                                      created_at=report.created_at)
                apply_to_incident(incident, cls, is_new=True)
                db.add(incident)
                db.flush()
                incident.code = incident_code(incident.id)
            report.incident_id = incident.id
            db.flush()
            audit.record(db, actor=actor, action="report.created", entity="report", entity_id=report.id,
                         payload={"source": report.source, "incident_id": incident.id, "merged": merged,
                                  "type": cls.type, "priority": cls.priority, "source_model": cls.source_model})
            audit.record(db, actor=actor, action="incident.merged" if merged else "incident.created",
                         entity="incident", entity_id=incident.id,
                         payload={"code": incident.code, "report_id": report.id, "report_count": incident.report_count})
            db.commit()
    except Exception as e:
        db.rollback()
        log.exception("Processing failed for report %s (kept, unlinked)", report_id)
        raise ReportProcessingError(report_id) from e
    return IngestResult(report=report, incident=incident, merged=merged, classification=cls)


def publish_ingest(result: IngestResult, report_out, incident_out) -> None:
    """WebSocket events for one ingested report (contract §4), after commit."""
    manager.publish("report.created", report_out)
    if result.merged:
        manager.publish("incident.merged", {"incident": incident_out, "report": report_out})
    else:
        manager.publish("incident.created", incident_out)


def refresh_summary_in_background(bind: Engine | Connection, incident_id: int, force: bool = False) -> None:
    """Background task: recompute the AI summary with its own session, commit, broadcast. Never raises."""
    with Session(bind=bind, expire_on_commit=False) as db:
        try:
            incident = db.scalars(
                select(m.Incident).options(selectinload(m.Incident.reports)).where(m.Incident.id == incident_id)
            ).one_or_none()
            if incident is None:
                return  # e.g. wiped by a demo reset
            before = (incident.ai_summary, list(incident.ai_actions or []))
            refresh_summary(incident, force=force)
            if (incident.ai_summary, list(incident.ai_actions or [])) == before:
                if not force:
                    _schedule_trailing_refresh(bind, incident_id)  # probably debounced: catch up later
                return
            db.commit()
            db.refresh(incident)  # publish the latest row, not values older than a concurrent merge
            manager.publish("incident.updated", IncidentOut.model_validate(incident))
        except Exception:
            db.rollback()
            log.exception("Background summary failed for incident %s", incident_id)


def _schedule_trailing_refresh(bind: Engine | Connection, incident_id: int) -> None:
    """At most one pending catch-up refresh per incident; runs when the debounce window has passed."""
    with _TRAILING_LOCK:
        if incident_id in _trailing_refresh:
            return
        timer = threading.Timer(summarizer.MIN_INTERVAL_SEC, _run_trailing_refresh, args=(bind, incident_id))
        timer.daemon = True  # never blocks shutdown
        _trailing_refresh[incident_id] = timer
        timer.start()


def _run_trailing_refresh(bind: Engine | Connection, incident_id: int) -> None:
    with _TRAILING_LOCK:
        _trailing_refresh.pop(incident_id, None)
    refresh_summary_in_background(bind, incident_id, force=True)


def cancel_trailing_refreshes() -> None:
    """Drop pending catch-up refreshes (app shutdown, demo reset)."""
    with _TRAILING_LOCK:
        for timer in _trailing_refresh.values():
            timer.cancel()
        _trailing_refresh.clear()
