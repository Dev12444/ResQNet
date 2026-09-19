"""Router: incidents. Owner: BE1.

Contract §3 "Incidents":
    GET   /api/incidents                -> Incident[]   (P1 first, then oldest first)
    GET   /api/incidents/{id}           -> IncidentDetail, 404 if missing
    PATCH /api/incidents/{id}           {status?, severity?, priority?, note?} -> IncidentDetail
    POST  /api/incidents/{id}/unmerge   {report_id} -> {old, new}

Manual status changes are limited to triaged / escalated / resolved: new, dispatched and
on_scene are derived from reports and assignments (setting them by hand would desync).
"""
from __future__ import annotations

import contextlib
import dataclasses
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.sql import Select

from app import audit
from app import models as m
from app.alerting import ALERT_LOCK, add_alert, open_alert_exists, publish_alert
from app.db import get_db
from app.locking import lock_incident
from app.pipeline import PIPELINE_LOCK, incident_code, refresh_summary_in_background
from app.schemas import (
    AssignmentOut,
    IncidentDetail,
    IncidentOut,
    IncidentPatch,
    IncidentType,
    ResourceOut,
    UnmergeRequest,
    UnmergeResponse,
)
from app.services.classifier import ClassificationResult, priority_for
from app.services.escalation import check_incident_in_background
from app.services.triage import apply_to_incident
from app.ws_manager import manager

router = APIRouter(prefix="/api/incidents", tags=["incidents"])


def parse_status_filter(status: str | None, include_resolved: bool) -> tuple[str, ...]:
    """Comma list of statuses -> validated tuple. Default: every status except resolved."""
    if status is None or not status.strip():
        return m.INCIDENT_STATUSES if include_resolved else m.OPEN_INCIDENT_STATUSES
    wanted = tuple(dict.fromkeys(s.strip() for s in status.split(",") if s.strip()))
    unknown = [s for s in wanted if s not in m.INCIDENT_STATUSES]
    if unknown:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown status {unknown}; allowed: {', '.join(m.INCIDENT_STATUSES)}",
        )
    return wanted


def incident_detail_query() -> Select:
    """Incident with every relation IncidentDetail serialises, in a fixed number of queries (no N+1)."""
    return select(m.Incident).options(
        selectinload(m.Incident.reports),
        selectinload(m.Incident.assignments).selectinload(m.Assignment.resource),
        selectinload(m.Incident.alerts),
    )


def get_incident_or_404(db: Session, incident_id: int) -> m.Incident:
    # populate_existing: if this incident is already in the session (e.g. an endpoint just changed
    # it and appended an alert/assignment in memory), reload its relations in the declared order
    # instead of keeping the stale in-memory lists (alerts must be newest first, contract §2).
    incident = db.scalars(
        incident_detail_query().where(m.Incident.id == incident_id).execution_options(populate_existing=True)
    ).one_or_none()
    if incident is None:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")
    return incident


@router.get("", response_model=list[IncidentOut])
def list_incidents(
    status: str | None = Query(None, description="Comma list, e.g. new,escalated. Default: all except resolved"),
    type: IncidentType | None = Query(None),  # contract query param name (shadows builtin on purpose)
    min_severity: int | None = Query(None, ge=1, le=5),
    include_resolved: bool = Query(False),
    db: Session = Depends(get_db),
) -> list[m.Incident]:
    q = select(m.Incident).where(m.Incident.status.in_(parse_status_filter(status, include_resolved)))
    if type is not None:
        q = q.where(m.Incident.type == type)
    if min_severity is not None:
        q = q.where(m.Incident.severity >= min_severity)
    # "P1" < "P2" < ... sorts correctly as text; ties: oldest first, then id for a stable order.
    q = q.order_by(m.Incident.priority, m.Incident.created_at, m.Incident.id)
    return list(db.scalars(q))


@router.get("/{incident_id}", response_model=IncidentDetail)
def get_incident(incident_id: int, db: Session = Depends(get_db)) -> m.Incident:
    return get_incident_or_404(db, incident_id)


# ---------------------------------------------------------------- PATCH /api/incidents/{id}

MANUAL_STATUSES = ("triaged", "escalated", "resolved")


def _derived_status(incident: m.Incident) -> str:
    """Status implied by the incident's units (used when de-escalating / re-opening)."""
    active = [a for a in incident.assignments if a.is_active]
    if any(a.status == "on_scene" for a in active):
        return "on_scene"
    return "dispatched" if active else "triaged"


def _close_active_assignments(incident: m.Incident, now: datetime) -> list[m.Assignment]:
    """Manual resolve: units on scene are completed, the rest cancelled; all are freed."""
    closed = []
    for a in incident.assignments:
        if not a.is_active:
            continue
        a.status = "completed" if a.status == "on_scene" else "cancelled"
        a.updated_at = now
        if a.resource.current_incident_id == incident.id:
            a.resource.status, a.resource.current_incident_id = "available", None
        closed.append(a)
    return closed


@dataclasses.dataclass
class _PatchResult:
    incident: m.Incident
    closed: list[m.Assignment]
    new_alert: m.Alert | None
    status_changed: bool
    committed: bool


def _apply_patch(db: Session, incident_id: int, body: IncidentPatch, actor: str) -> _PatchResult:
    lock_incident(db, incident_id)
    incident = get_incident_or_404(db, incident_id)
    now = datetime.now(timezone.utc)
    before = {"status": incident.status, "severity": incident.severity, "priority": incident.priority}

    if body.status is not None and body.status != incident.status:
        if body.status not in MANUAL_STATUSES:
            raise HTTPException(
                status_code=409,
                detail=f"Status '{body.status}' is set automatically; "
                       f"manual changes allow {', '.join(MANUAL_STATUSES)}",
            )
        if body.status == "escalated" and incident.status == "resolved":
            raise HTTPException(status_code=409, detail=f"Incident {incident.code} is resolved; re-open it first")

    if body.severity is not None:
        incident.severity = body.severity
        incident.priority = priority_for(body.severity, list(incident.hazards or []))
    if body.priority is not None:  # an explicit priority wins over the derived one
        incident.priority = body.priority

    closed: list[m.Assignment] = []
    new_alert = None
    if body.status is not None and body.status != incident.status:
        if body.status == "resolved":
            closed = _close_active_assignments(incident, now)
            incident.status, incident.resolved_at = "resolved", now
        elif body.status == "escalated":
            incident.status = "escalated"
            if not open_alert_exists(db, incident.id, "escalation"):
                note = f": {body.note}" if body.note else ""
                new_alert = add_alert(db, kind="escalation", incident=incident,
                                      message=f"{incident.code} ({incident.type}, {incident.priority}) "
                                              f"escalated by {actor}{note}")
        else:  # "triaged": de-escalate / re-open; falls back to what the units imply
            incident.status = _derived_status(incident)
            incident.resolved_at = None

    after = {"status": incident.status, "severity": incident.severity, "priority": incident.priority}
    if after == before and not body.note:
        return _PatchResult(incident, [], None, status_changed=False, committed=False)  # no audit, no broadcast

    audit.record(db, actor=actor, action="incident.updated", entity="incident", entity_id=incident.id,
                 payload={"code": incident.code, "before": before, "after": after, "note": body.note,
                          "closed_assignment_ids": [a.id for a in closed]})
    db.commit()
    return _PatchResult(incident, closed, new_alert, status_changed=after != before, committed=True)


@router.patch("/{incident_id}", response_model=IncidentDetail)
def update_incident(
    incident_id: int,
    body: IncidentPatch,
    db: Session = Depends(get_db),
    x_actor: str | None = Header(None),
) -> m.Incident:
    # Escalating is check-then-insert on alerts: hold ALERT_LOCK (taken before the row lock, the
    # same order as the escalation loop) so it can't interleave with an automatic escalation.
    lock = ALERT_LOCK if body.status == "escalated" else contextlib.nullcontext()
    with lock:
        result = _apply_patch(db, incident_id, body, audit.clean_actor(x_actor))
    if not result.committed:
        return result.incident

    for a in result.closed:
        manager.publish("assignment.updated", AssignmentOut.model_validate(a))
        manager.publish("resource.updated", ResourceOut.model_validate(a.resource))
    if result.new_alert is not None:
        publish_alert(result.new_alert)
    if result.status_changed:
        manager.publish("incident.updated", IncidentOut.model_validate(result.incident))
    return get_incident_or_404(db, incident_id)


# ---------------------------------------------------------------- POST /api/incidents/{id}/unmerge


def _classification_from_report(report: m.Report) -> ClassificationResult | None:
    """Rebuild the report's own classification from its cached ai_json (None if unavailable)."""
    data = report.ai_json or {}
    names = {f.name for f in dataclasses.fields(ClassificationResult)}
    try:
        return ClassificationResult(**{k: v for k, v in data.items() if k in names})
    except TypeError:  # missing required fields: fall back to the parent incident's values
        return None


@router.post("/{incident_id}/unmerge", response_model=UnmergeResponse)
def unmerge_report(
    incident_id: int,
    body: UnmergeRequest,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    x_actor: str | None = Header(None),
) -> UnmergeResponse:
    """Move one wrongly-merged report into its own new incident (dispatcher correction)."""
    actor = audit.clean_actor(x_actor)
    with PIPELINE_LOCK:  # don't race a report being merged into this incident right now
        old = get_incident_or_404(db, incident_id)
        report = next((r for r in old.reports if r.id == body.report_id), None)
        if report is None:
            raise HTTPException(status_code=404, detail=f"Report {body.report_id} is not part of {old.code}")
        if len(old.reports) < 2:
            raise HTTPException(status_code=409, detail=f"{old.code} has only one report; nothing to unmerge")

        new = m.Incident(status="new", lat=report.lat, lng=report.lng, address=report.address or old.address,
                         report_count=1, created_at=report.created_at)
        cls = _classification_from_report(report)
        if cls is not None:
            apply_to_incident(new, cls, is_new=True)
        else:
            new.type, new.severity, new.priority = old.type, old.severity, old.priority
            new.title, new.hazards = old.title, list(old.hazards or [])
        db.add(new)
        db.flush()
        new.code = incident_code(new.id)
        report.incident_id = new.id
        old.report_count = max(1, (old.report_count or 1) - 1)
        old.updated_at = datetime.now(timezone.utc)
        audit.record(db, actor=actor, action="incident.unmerged", entity="incident", entity_id=old.id,
                     payload={"code": old.code, "report_id": report.id, "new_incident_id": new.id,
                              "new_code": new.code})
        db.commit()

    old_out, new_out = IncidentOut.model_validate(old), IncidentOut.model_validate(new)
    manager.publish("incident.updated", old_out)
    manager.publish("incident.created", new_out)
    for inc_id in (old.id, new.id):
        background.add_task(refresh_summary_in_background, db.get_bind(), inc_id, True)
    # A split-off P1 gets its critical alert now, like a new report, not at the next loop tick.
    background.add_task(check_incident_in_background, db.get_bind(), new.id)
    return UnmergeResponse(old=old_out, new=new_out)
