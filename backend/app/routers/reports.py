"""Router: reports. Owner: BE1.

Contract §3 "Reports":
    POST /api/reports                -> 201 {report, incident, merged, classification}
    GET  /api/reports?incident_id=7  -> Report[] newest first
The pipeline itself lives in app/pipeline.py (shared with the scenario simulator).
"""
from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models as m
from app.audit import clean_actor
from app.db import get_db
from app.pipeline import (
    IncidentNotFound,
    ReportProcessingError,
    ingest_report,
    publish_ingest,
    refresh_summary_in_background,
)
from app.schemas import ClassificationOut, IncidentOut, ReportCreate, ReportCreatedResponse, ReportOut, ReportSource
from app.services.escalation import check_incident_in_background

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


@router.post("", status_code=201, response_model=ReportCreatedResponse)
def create_report(
    body: ReportCreate,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    x_actor: str | None = Header(None),
) -> ReportCreatedResponse:
    actor = clean_actor(x_actor, default=body.reporter or body.source)
    try:
        result = ingest_report(db, body, actor)
    except IncidentNotFound as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ReportProcessingError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    report_out = ReportOut.model_validate(result.report)
    incident_out = IncidentOut.model_validate(result.incident)
    publish_ingest(result, report_out, incident_out)
    # Summary runs after the response is sent, keeping report -> dashboard under the 5 s target (PRD §4).
    background.add_task(refresh_summary_in_background, db.get_bind(), result.incident.id)
    # Critical / shortage alerts right away instead of waiting for the next escalation tick.
    background.add_task(check_incident_in_background, db.get_bind(), result.incident.id)
    return ReportCreatedResponse(
        report=report_out,
        incident=incident_out,
        merged=result.merged,
        classification=ClassificationOut.model_validate(result.classification),
    )
