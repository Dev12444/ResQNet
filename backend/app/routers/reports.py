"""Router: reports. Owner: BE1.

Contract §3 "Reports":
    GET /api/reports?incident_id=7   -> Report[] newest first
(POST /api/reports — the triage pipeline — is Task 8.)
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models as m
from app.db import get_db
from app.schemas import ReportOut, ReportSource

router = APIRouter(prefix="/api/reports", tags=["reports"])

# Contract §0 says "no pagination"; this cap only protects the demo from an unbounded response.
MAX_REPORTS = 1000


@router.get("", response_model=list[ReportOut])
def list_reports(
    incident_id: int | None = Query(None, gt=0),
    source: ReportSource | None = Query(None),
    limit: int = Query(MAX_REPORTS, ge=1, le=MAX_REPORTS),
    db: Session = Depends(get_db),
) -> list[m.Report]:
    q = select(m.Report)
    if incident_id is not None:
        q = q.where(m.Report.incident_id == incident_id)
    if source is not None:
        q = q.where(m.Report.source == source)
    return list(db.scalars(q.order_by(m.Report.created_at.desc(), m.Report.id.desc()).limit(limit)))
