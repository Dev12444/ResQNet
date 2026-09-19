"""Router: alerts (read). Owner: BE1.

Contract §3 "Alerts":
    GET /api/alerts?acknowledged=false   -> Alert[] newest first
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app import models as m
from app.db import get_db
from app.schemas import AlertKind, AlertOut

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertOut])
def list_alerts(
    acknowledged: bool | None = Query(None),
    kind: AlertKind | None = Query(None),
    incident_id: int | None = Query(None, gt=0),
    db: Session = Depends(get_db),
) -> list[m.Alert]:
    # Eager-load the incident: AlertOut.incident_code reads it (would be one query per alert otherwise).
    q = select(m.Alert).options(selectinload(m.Alert.incident))
    if acknowledged is not None:
        q = q.where(m.Alert.acknowledged.is_(acknowledged))
    if kind is not None:
        q = q.where(m.Alert.kind == kind)
    if incident_id is not None:
        q = q.where(m.Alert.incident_id == incident_id)
    return list(db.scalars(q.order_by(m.Alert.created_at.desc(), m.Alert.id.desc())))
