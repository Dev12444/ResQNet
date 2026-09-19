"""Router: resources + facilities (read). Owner: BE1.

Contract §3 "Resources & Facilities":
    GET /api/resources?kind=&status=   -> Resource[]
    GET /api/facilities?kind=          -> Facility[]
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models as m
from app.db import get_db
from app.schemas import FacilityKind, FacilityOut, ResourceKind, ResourceOut, ResourceStatus

router = APIRouter(prefix="/api", tags=["resources"])


@router.get("/resources", response_model=list[ResourceOut])
def list_resources(
    kind: ResourceKind | None = Query(None),
    status: ResourceStatus | None = Query(None),
    db: Session = Depends(get_db),
) -> list[m.Resource]:
    q = select(m.Resource)
    if kind is not None:
        q = q.where(m.Resource.kind == kind)
    if status is not None:
        q = q.where(m.Resource.status == status)
    return list(db.scalars(q.order_by(m.Resource.kind, m.Resource.callsign)))


@router.get("/facilities", response_model=list[FacilityOut])
def list_facilities(
    kind: FacilityKind | None = Query(None),
    db: Session = Depends(get_db),
) -> list[m.Facility]:
    q = select(m.Facility)
    if kind is not None:
        q = q.where(m.Facility.kind == kind)
    return list(db.scalars(q.order_by(m.Facility.kind, m.Facility.name)))
