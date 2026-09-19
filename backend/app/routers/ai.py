"""Router: AI endpoints (recommendations, summarize, sitrep). Owner: BE2.

Contract: docs/API_CONTRACT.md §3 "AI".
BE1: include in main.py with `app.include_router(ai.router)`.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.services import llm, recommender, summarizer

router = APIRouter(prefix="/api", tags=["ai"])


def _incident_or_404(db: Session, incident_id: int):
    from app.models import Incident

    inc = db.get(Incident, incident_id)
    if inc is None:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")
    return inc


@router.get("/incidents/{incident_id}/recommendations")
def get_recommendations(incident_id: int, db: Session = Depends(get_db)) -> dict:
    inc = _incident_or_404(db, incident_id)
    return recommender.recommend(db, inc)


@router.post("/incidents/{incident_id}/summarize")
def resummarize(incident_id: int, db: Session = Depends(get_db)) -> dict:
    inc = _incident_or_404(db, incident_id)
    result = summarizer.summarize_incident(inc, list(getattr(inc, "reports", None) or []), force=True)
    inc.ai_summary = result["summary"]
    inc.ai_actions = result["actions"]
    if hasattr(inc, "updated_at"):
        inc.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"ai_summary": result["summary"], "ai_actions": result["actions"]}


@router.post("/ai/sitrep")
def generate_sitrep(db: Session = Depends(get_db)) -> dict:
    from app.models import Incident

    incidents = db.query(Incident).filter(Incident.status != "resolved").all()
    return {
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "markdown": summarizer.sitrep(incidents),
        "active_count": len(incidents),
    }


@router.get("/ai/status")
def ai_status() -> dict:
    """Which Gemini models are usable right now (quota/pacing) — handy during the demo."""
    st = get_settings()
    return {
        "ai_enabled": st.ai_available,
        "generation_available": llm.available("gen"),
        "embeddings_available": llm.available("emb"),
        "models": llm.quota_status(),
        "embed_model": st.gemini_embed_model,
        "rpm_per_model": st.gemini_rpm,
        "disk_cache": bool(st.llm_cache_path),
    }
