"""Alert creation helper. Owner: BE1.

Adds an Alert to the caller's session (caller commits, then calls publish_alert()).
Used by manual escalation (PATCH /api/incidents) and the escalation loop.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models as m
from app.schemas import AlertOut
from app.ws_manager import manager


def open_alert_exists(db: Session, incident_id: int | None, kind: str) -> bool:
    """True if an unacknowledged alert of this kind already exists for the incident (no duplicates)."""
    q = select(m.Alert.id).where(m.Alert.kind == kind, m.Alert.acknowledged.is_(False))
    q = q.where(m.Alert.incident_id.is_(None) if incident_id is None else m.Alert.incident_id == incident_id)
    return db.scalar(q.limit(1)) is not None


def add_alert(db: Session, *, kind: str, message: str, incident: m.Incident | None = None) -> m.Alert:
    alert = m.Alert(kind=kind, message=message, incident_id=incident.id if incident is not None else None)
    alert.incident = incident
    db.add(alert)
    return alert


def publish_alert(alert: m.Alert) -> None:
    """Broadcast after commit (contract §4 alert.created)."""
    manager.publish("alert.created", AlertOut.model_validate(alert))
