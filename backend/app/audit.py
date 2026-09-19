"""Audit log helper. Owner: BE1.

PRD §7: every create / dispatch / status change is recorded in audit_log.
Adds the row to the caller's session; the caller commits (same transaction as the change).
"""
from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app import models as m

MAX_ACTOR_LEN = 80
DEFAULT_ACTOR = "dispatcher"  # contract §0: X-Actor header, default "dispatcher"


def clean_actor(actor: str | None, default: str = DEFAULT_ACTOR) -> str:
    """Trim an X-Actor header value to something safe to store."""
    value = (actor or "").strip()
    return (value or default)[:MAX_ACTOR_LEN]


def record(
    db: Session,
    *,
    actor: str,
    action: str,
    entity: str,
    entity_id: int | None,
    payload: dict[str, Any] | None = None,
) -> m.AuditLog:
    row = m.AuditLog(actor=clean_actor(actor), action=action, entity=entity, entity_id=entity_id, payload=payload)
    db.add(row)
    return row
