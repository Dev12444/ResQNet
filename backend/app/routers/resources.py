"""Router: resources + facilities. Owner: BE1.

Contract §3 "Resources & Facilities":
    GET   /api/resources?kind=&status=   -> Resource[]
    PATCH /api/resources/{id} {status}   -> Resource   (available / busy / offline)
    GET   /api/facilities?kind=          -> Facility[]
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import audit
from app import models as m
from app.db import get_db
from app.schemas import FacilityKind, FacilityOut, ResourceKind, ResourceOut, ResourcePatch, ResourceStatus
from app.ws_manager import manager

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


@router.patch("/resources/{resource_id}", response_model=ResourceOut)
def update_resource(
    resource_id: int,
    body: ResourcePatch,
    db: Session = Depends(get_db),
    x_actor: str | None = Header(None),
) -> m.Resource:
    """Mark a unit available / busy / offline. 'assigned' belongs to dispatch, and a unit with an
    active assignment must be released through PATCH /api/assignments first."""
    resource = db.get(m.Resource, resource_id)
    if resource is None:
        raise HTTPException(status_code=404, detail=f"Resource {resource_id} not found")
    if body.status == resource.status:
        return resource
    if body.status == "assigned":
        raise HTTPException(status_code=409, detail="Units are assigned through POST /api/incidents/{id}/dispatch")
    if resource.status == "assigned":
        raise HTTPException(
            status_code=409,
            detail=f"{resource.callsign} is on an active assignment; complete or cancel it first",
        )
    previous = resource.status
    resource.status = body.status
    audit.record(db, actor=audit.clean_actor(x_actor), action="resource.status", entity="resource",
                 entity_id=resource.id, payload={"callsign": resource.callsign, "from": previous, "to": body.status})
    db.commit()
    manager.publish("resource.updated", ResourceOut.model_validate(resource))
    return resource
