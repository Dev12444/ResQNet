"""FastAPI entrypoint. Owner: BE1.

Run locally:  uvicorn app.main:app --reload --port 8000   (from backend/)
Docs:         http://localhost:8000/docs
"""
from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import SessionLocal, get_db, init_db
from app.pipeline import cancel_trailing_refreshes
from app.routers import ai, alerts, analytics, dispatch, incidents, reports, resources, ws
from app.schemas import HealthOut
from app.seed import seed_if_empty
from app.ws_manager import manager

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("resqnet.main")

settings = get_settings()


def startup_seed() -> None:
    """Seed an empty database (first deploy). Failures are logged, never fatal: the API still starts."""
    if not settings.seed_on_startup:
        return
    try:
        with SessionLocal() as db:
            counts = seed_if_empty(db)
        if counts:
            log.info("Empty database seeded: %(resources)d resources, %(facilities)d facilities", counts)
    except Exception:
        log.exception("Startup seeding failed; run `python -m scripts.seed` manually")


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    init_db()
    startup_seed()
    await manager.start()
    log.info("ResQNet API started (ai_available=%s)", settings.ai_available)
    try:
        yield
    finally:
        cancel_trailing_refreshes()
        await manager.stop()


app = FastAPI(
    title="ResQNet API",
    version="1.0.0",
    description="Intelligent Emergency Response & Resource Coordination (PS-9). Contract: docs/API_CONTRACT.md",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_origin_regex=settings.cors_origin_regex or None,
    allow_credentials=False,  # no cookies/auth in the demo; keeps "*"-style headers valid
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["*"],  # includes X-Actor (audit actor, contract §0)
)


@app.exception_handler(Exception)
async def unhandled_error(request: Request, exc: Exception) -> JSONResponse:
    # Contract §0: errors are {"detail": "..."}; never leak internals to the client.
    log.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/health", response_model=HealthOut, tags=["health"])
def health(db: Session = Depends(get_db)) -> JSONResponse:
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        log.exception("Health check: database unreachable")
        db_ok = False
    body = HealthOut(status="ok" if db_ok else "degraded", ai=settings.ai_available, db=db_ok)
    # 503 lets Render's health check restart/hold traffic when the DB is down.
    return JSONResponse(status_code=200 if db_ok else 503, content=body.model_dump())


# BE1 routers (contract §3).
app.include_router(incidents.router)
app.include_router(reports.router)
app.include_router(resources.router)
app.include_router(alerts.router)
app.include_router(dispatch.router)
app.include_router(ws.router)
# BE2 routers (contract §3 AI + Analytics).
app.include_router(ai.router)
app.include_router(analytics.router)
