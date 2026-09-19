"""Router: demo scenario simulator. Owner: BE1.

Contract §3 "Simulator":
    POST /api/simulator/start  {scenario, speed}  -> {running, events_total}   (409 if already running)
    POST /api/simulator/stop                      -> {running: false}
    POST /api/simulator/reset                     -> {ok: true}   stops the run, wipes demo data, reseeds
    GET  /api/simulator/status                    -> {running, events_sent, events_total}
"""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app import audit
from app.db import get_db
from app.pipeline import PIPELINE_LOCK, bump_reset_epoch, cancel_trailing_refreshes
from app.schemas import OkResponse, SimulatorStart, SimulatorStarted, SimulatorStatus, SimulatorStopped
from app.seed import reset_database
from app.simulator import ScenarioError, SimulatorBusy, load_scenario, simulator

router = APIRouter(prefix="/api/simulator", tags=["simulator"])


@router.post("/start", response_model=SimulatorStarted)
async def start(
    body: SimulatorStart | None = None,
    db: Session = Depends(get_db),
) -> SimulatorStarted:
    body = body or SimulatorStart()
    try:
        events = load_scenario(body.scenario)
    except ScenarioError as e:
        status = 404 if "not found" in str(e) else 422
        raise HTTPException(status_code=status, detail=str(e)) from e
    try:
        await simulator.start(events, body.speed, db.get_bind())
    except SimulatorBusy as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
    return SimulatorStarted(running=True, events_total=len(events))


@router.post("/stop", response_model=SimulatorStopped)
async def stop() -> SimulatorStopped:
    await simulator.stop()
    return SimulatorStopped(running=False)


@router.get("/status", response_model=SimulatorStatus)
async def status() -> SimulatorStatus:
    return simulator.status()


def _reset(db: Session, actor: str) -> None:
    with PIPELINE_LOCK:  # never wipe in the middle of a report being merged
        reset_database(db)
        bump_reset_epoch()  # reports still in their AI step are discarded, not attached to the new data
        audit.record(db, actor=actor, action="demo.reset", entity="database", entity_id=None)
        db.commit()


@router.post("/reset", response_model=OkResponse)
async def reset(
    db: Session = Depends(get_db),
    x_actor: str | None = Header(None),
) -> OkResponse:
    await simulator.stop()
    cancel_trailing_refreshes()  # pending summary refreshes point at incidents that are about to vanish
    await asyncio.to_thread(_reset, db, audit.clean_actor(x_actor))
    simulator.events_sent = simulator.events_total = 0
    simulator.broadcast_status()  # zeroed simulator.status tells dashboards to refetch
    return OkResponse(ok=True)
