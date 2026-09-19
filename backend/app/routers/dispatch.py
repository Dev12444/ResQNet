"""Router: dispatch + assignment lifecycle. Owner: BE1.

Contract §3 "Dispatch":
    POST  /api/incidents/{id}/dispatch  {resource_ids, facility_id?, approved_by} -> IncidentDetail
    PATCH /api/assignments/{id}         {status}                                   -> Assignment
    GET   /api/assignments?resource_id=&incident_id=&active=true                   -> Assignment[]

Lifecycle: assigned -> en_route -> on_scene -> completed (forward only; steps may be skipped),
cancelled from any active state. Repeating the current status is a no-op (safe retries).
- first unit on scene -> incident on_scene
- no active units left -> incident resolved (some completed) or back to triaged (all cancelled)
- completed/cancelled units become available again
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import select, update
from sqlalchemy.orm import Session, selectinload

from app import audit
from app import models as m
from app.db import get_db
from app.routers.incidents import get_incident_or_404
from app.schemas import AssignmentOut, AssignmentPatch, DispatchRequest, IncidentDetail, IncidentOut, ResourceOut
from app.services import geo
from app.ws_manager import manager

router = APIRouter(prefix="/api", tags=["dispatch"])

# Position in the forward-only lifecycle; "cancelled" is handled separately.
STEP = {"assigned": 0, "en_route": 1, "on_scene": 2, "completed": 3}
FINISHED = ("completed", "cancelled")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _eta(resource: m.Resource, incident: m.Incident) -> int | None:
    if incident.lat is None or incident.lng is None:
        return None
    return geo.eta_between(resource.lat, resource.lng, incident.lat, incident.lng, resource.kind)


# ---------------------------------------------------------------- dispatch


@router.post("/incidents/{incident_id}/dispatch", response_model=IncidentDetail)
def dispatch(
    incident_id: int,
    body: DispatchRequest,
    db: Session = Depends(get_db),
    x_actor: str | None = Header(None),
) -> m.Incident:
    actor = audit.clean_actor(x_actor, default=body.approved_by)
    incident = db.get(m.Incident, incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")
    if incident.status == "resolved":
        raise HTTPException(status_code=409, detail=f"Incident {incident.code} is already resolved")

    resources = {r.id: r for r in db.scalars(select(m.Resource).where(m.Resource.id.in_(body.resource_ids)))}
    missing = [rid for rid in body.resource_ids if rid not in resources]
    if missing:
        raise HTTPException(status_code=404, detail=f"Resource(s) not found: {missing}")
    if body.facility_id is not None and db.get(m.Facility, body.facility_id) is None:
        raise HTTPException(status_code=404, detail=f"Facility {body.facility_id} not found")

    # Atomic claim: only units still available flip to assigned. If two dispatchers race for
    # the same unit, exactly one UPDATE matches it and the other request gets a 409.
    claimed = db.execute(
        update(m.Resource)
        .where(m.Resource.id.in_(body.resource_ids), m.Resource.status == "available")
        .values(status="assigned", current_incident_id=incident.id)
        .execution_options(synchronize_session=False)
    ).rowcount
    if claimed != len(body.resource_ids):
        db.rollback()
        busy = db.scalars(
            select(m.Resource).where(m.Resource.id.in_(body.resource_ids), m.Resource.status != "available")
        ).all()
        names = ", ".join(f"{r.callsign} ({r.status})" for r in busy) or "unknown"
        raise HTTPException(status_code=409, detail=f"Not available: {names}")

    now = _now()
    assignments = []
    for rid in body.resource_ids:
        resource = resources[rid]
        db.refresh(resource)  # pick up the claimed status
        a = m.Assignment(incident_id=incident.id, resource_id=rid, status="assigned",
                         eta_min=_eta(resource, incident), approved_by=body.approved_by,
                         created_at=now, updated_at=now)
        db.add(a)
        assignments.append(a)
    if incident.status != "on_scene":  # extra units for a crew already on scene don't step it back
        incident.status = "dispatched"
    incident.dispatched_at = incident.dispatched_at or now
    db.flush()
    audit.record(db, actor=actor, action="incident.dispatched", entity="incident", entity_id=incident.id,
                 payload={"code": incident.code, "resource_ids": body.resource_ids,
                          "callsigns": [resources[r].callsign for r in body.resource_ids],
                          "facility_id": body.facility_id, "approved_by": body.approved_by,
                          "assignment_ids": [a.id for a in assignments]})
    db.commit()

    for a in assignments:
        manager.publish("assignment.updated", AssignmentOut.model_validate(a))
        manager.publish("resource.updated", ResourceOut.model_validate(a.resource))
    manager.publish("incident.updated", IncidentOut.model_validate(incident))
    return get_incident_or_404(db, incident.id)


# ---------------------------------------------------------------- assignment lifecycle


def _check_transition(current: str, new: str) -> None:
    if current in FINISHED:
        raise HTTPException(status_code=409, detail=f"Assignment is already {current}")
    if new != "cancelled" and STEP[new] < STEP[current]:
        raise HTTPException(status_code=409, detail=f"Cannot move an assignment from {current} back to {new}")


def _settle_incident(incident: m.Incident, now: datetime) -> None:
    """Derive the incident status from its assignments after one of them changed."""
    active = [a for a in incident.assignments if a.is_active]
    if any(a.status == "on_scene" for a in active) and incident.status in ("new", "triaged", "dispatched",
                                                                          "escalated"):
        incident.status = "on_scene"
    if active:
        return
    if any(a.status == "completed" for a in incident.assignments):
        incident.status = "resolved"
        incident.resolved_at = incident.resolved_at or now
    else:  # every unit was cancelled: the incident still needs help
        incident.status = "triaged"


@router.patch("/assignments/{assignment_id}", response_model=AssignmentOut)
def update_assignment(
    assignment_id: int,
    body: AssignmentPatch,
    db: Session = Depends(get_db),
    x_actor: str | None = Header(None),
) -> m.Assignment:
    actor = audit.clean_actor(x_actor, default="field")
    a = db.scalars(
        select(m.Assignment)
        .options(selectinload(m.Assignment.resource),
                 selectinload(m.Assignment.incident).selectinload(m.Incident.assignments))
        .where(m.Assignment.id == assignment_id)
        .with_for_update()  # serialise concurrent taps on Postgres (no-op on SQLite)
    ).one_or_none()
    if a is None:
        raise HTTPException(status_code=404, detail=f"Assignment {assignment_id} not found")
    if body.status == a.status:
        return a  # idempotent: a retried tap changes nothing
    _check_transition(a.status, body.status)

    now = _now()
    previous = a.status
    incident, resource = a.incident, a.resource
    incident_before = (incident.status, incident.resolved_at)
    a.status = body.status
    a.updated_at = now
    if body.status == "on_scene" and a.on_scene_at is None:
        a.on_scene_at = now
    resource_changed = False
    if body.status in FINISHED and resource.current_incident_id == incident.id:
        resource.status, resource.current_incident_id = "available", None
        resource_changed = True
    _settle_incident(incident, now)
    incident_changed = (incident.status, incident.resolved_at) != incident_before

    audit.record(db, actor=actor, action="assignment.status", entity="assignment", entity_id=a.id,
                 payload={"from": previous, "to": body.status, "incident_id": incident.id,
                          "resource_id": resource.id, "incident_status": incident.status})
    db.commit()

    manager.publish("assignment.updated", AssignmentOut.model_validate(a))
    if resource_changed:
        manager.publish("resource.updated", ResourceOut.model_validate(resource))
    if incident_changed:
        manager.publish("incident.updated", IncidentOut.model_validate(incident))
    return a


@router.get("/assignments", response_model=list[AssignmentOut])
def list_assignments(
    resource_id: int | None = Query(None, gt=0),
    incident_id: int | None = Query(None, gt=0),
    active: bool = Query(False, description="Only assigned / en_route / on_scene"),
    db: Session = Depends(get_db),
) -> list[m.Assignment]:
    q = select(m.Assignment).options(selectinload(m.Assignment.resource))
    if resource_id is not None:
        q = q.where(m.Assignment.resource_id == resource_id)
    if incident_id is not None:
        q = q.where(m.Assignment.incident_id == incident_id)
    if active:
        q = q.where(m.Assignment.status.in_(m.ACTIVE_ASSIGNMENT_STATUSES))
    return list(db.scalars(q.order_by(m.Assignment.created_at.desc(), m.Assignment.id.desc())))
