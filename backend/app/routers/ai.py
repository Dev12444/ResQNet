"""Router: AI endpoints (recommendations, summarize, sitrep). Owner: BE2.

Contract: docs/API_CONTRACT.md §3 "AI".
BE1: include in main.py with `app.include_router(ai.router)`.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.services import advice, llm, recommender, summarizer, trust

router = APIRouter(prefix="/api", tags=["ai"])


def _incident_or_404(db: Session, incident_id: int):
    from app.models import Incident

    inc = db.get(Incident, incident_id)
    if inc is None:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")
    return inc


# The LLM routes below read what they need, then END the DB transaction before calling the model:
# a transaction held open for seconds pins a pooled connection and (on Postgres) keeps table locks
# that make a demo reset's TRUNCATE wait, and every other request then queues behind that TRUNCATE.


@router.get("/incidents/{incident_id}/recommendations")
def get_recommendations(incident_id: int, db: Session = Depends(get_db)) -> dict:
    inc = _incident_or_404(db, incident_id)
    data = recommender.snapshot(db, inc)
    db.rollback()  # read-only request: release the connection before the LLM writes its reasons
    return recommender.recommend_from_snapshot(*data)


@router.get("/ai/advice")
def get_advice(
    type: str = Query("other", description="incident type from the classification"),
    hazards: str = Query("", description="comma list, e.g. trapped_people,rising_water"),
    lang: str = Query("en", pattern="^(en|gu|hi)$"),
) -> dict:
    """Safety tips for the citizen who just reported (fixed, reviewed templates; EN/GU/HI)."""
    return advice.safety_advice(type, [h.strip() for h in hazards.split(",") if h.strip()], lang)


@router.get("/incidents/{incident_id}/advice")
def get_incident_advice(incident_id: int, lang: str = Query("en", pattern="^(en|gu|hi)$"),
                        db: Session = Depends(get_db)) -> dict:
    inc = _incident_or_404(db, incident_id)
    return advice.safety_advice(inc.type, list(inc.hazards or []), lang)


@router.get("/incidents/{incident_id}/trust")
def get_trust(incident_id: int, db: Session = Depends(get_db)) -> dict:
    """Corroboration, conflicts between reports and sensor confirmation (FE2 `IncidentTrust`)."""
    return trust.incident_trust(_incident_or_404(db, incident_id))


@router.post("/incidents/{incident_id}/summarize")
def resummarize(incident_id: int, db: Session = Depends(get_db)) -> dict:
    from app.pipeline import refresh_summary_in_background

    _incident_or_404(db, incident_id)
    db.rollback()
    # BE1's summary writer: LLM with no connection held, writes only the summary columns of this
    # same incident (not one that reused the id after a reset), then broadcasts incident.updated.
    refresh_summary_in_background(db.get_bind(), incident_id, force=True)
    inc = _incident_or_404(db, incident_id)
    return {"ai_summary": inc.ai_summary, "ai_actions": list(inc.ai_actions or [])}


_SITREP_FIELDS = ("code", "type", "severity", "priority", "status", "address", "report_count", "ai_summary", "title")


@router.post("/ai/sitrep")
def generate_sitrep(db: Session = Depends(get_db)) -> dict:
    from app.models import Incident

    incidents = [{k: getattr(i, k) for k in _SITREP_FIELDS}
                 for i in db.query(Incident).filter(Incident.status != "resolved").all()]
    db.rollback()
    return {
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "markdown": summarizer.sitrep(incidents),
        "active_count": len(incidents),
    }


@router.get("/ai/status")
def ai_status() -> dict:
    """Which AI providers/models are usable right now (quota, pacing, OpenAI spend) — handy during the demo."""
    st = get_settings()
    return {
        "ai_enabled": st.ai_available,
        "providers": [p.name for p in llm._providers("gen")],
        "generation_available": llm.available("gen"),
        "embeddings_available": llm.available("emb"),
        "models": llm.quota_status(),
        "embed_providers": [f"{p.name}:{p.embed_model}" for p in llm._providers("emb")],
        # v1 keys kept for existing frontend types
        "embed_model": next((p.embed_model for p in llm._providers("emb")), None),
        "rpm_per_model": next((p.rpm for p in llm._providers("gen")), None),
        **llm.spend_status(),
        "disk_cache": bool(st.llm_cache_path),
        "demo_seed_answers": llm.demo_seed_size(),
    }
