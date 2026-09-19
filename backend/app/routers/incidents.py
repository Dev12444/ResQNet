"""Router: incidents (read). Owner: BE1.

Contract §3 "Incidents":
    GET /api/incidents        -> Incident[]   (P1 first, then oldest first)
    GET /api/incidents/{id}   -> IncidentDetail, 404 if missing
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.sql import Select

from app import models as m
from app.db import get_db
from app.schemas import IncidentDetail, IncidentOut, IncidentType

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
    incident = db.scalars(incident_detail_query().where(m.Incident.id == incident_id)).one_or_none()
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
