"""Router: analytics. Owner: BE2.

Contract: docs/API_CONTRACT.md §3 "Analytics". All endpoints accept ?since=<ISO time>.
Computation lives in pure `compute_*` functions (lists of ORM objects or dicts) so it is
testable without a database.
"""
from __future__ import annotations

import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

EVAL_RESULTS = Path(__file__).resolve().parent.parent / "data" / "eval_results.json"
GRID_DEG = 0.0045  # ≈ 500 m
INCIDENT_TYPES = ["flood", "fire", "road_accident", "industrial", "medical", "building_collapse", "other"]
RESOURCE_KINDS = ["ambulance", "fire_truck", "rescue_boat", "police", "ndrf_team", "hazmat"]
RESPONSE_BUCKETS = [(60, "0-1 min"), (120, "1-2 min"), (300, "2-5 min"), (None, "5+ min")]


# ---------------------------------------------------------------- helpers

def _get(obj: Any, name: str, default: Any = None) -> Any:
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


def _dt(v: Any) -> datetime | None:
    if v is None:
        return None
    if isinstance(v, str):
        try:
            v = datetime.fromisoformat(v.replace("Z", "+00:00"))
        except ValueError:
            return None
    return v if v.tzinfo else v.replace(tzinfo=timezone.utc)


def _secs(a: Any, b: Any) -> float | None:
    a, b = _dt(a), _dt(b)
    if a is None or b is None:
        return None
    s = (b - a).total_seconds()
    return s if s >= 0 else None


def _since(items: list[Any], since: datetime | None, field: str = "created_at") -> list[Any]:
    if since is None:
        return items
    return [x for x in items if (d := _dt(_get(x, field))) is not None and d >= since]


def _iso(d: datetime) -> str:
    return d.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


# ---------------------------------------------------------------- pure computations

def compute_summary(incidents, reports, resources, assignments) -> dict:
    now = datetime.now(timezone.utc)
    active = [i for i in incidents if _get(i, "status") != "resolved"]
    dispatch = [s for i in incidents if (s := _secs(_get(i, "created_at"), _get(i, "dispatched_at"))) is not None]
    scene = _scene_times(incidents, assignments)
    return {
        "active_incidents": len(active),
        "p1_open": sum(1 for i in active if _get(i, "priority") == "P1"),
        "resolved_today": sum(
            1 for i in incidents if (d := _dt(_get(i, "resolved_at"))) is not None and d.date() == now.date()
        ),
        "total_reports": len(reports),
        "duplicates_merged": max(0, len(reports) - len(incidents)),
        "units_available": sum(1 for r in resources if _get(r, "status") == "available"),
        "units_total": len(resources),
        "avg_time_to_dispatch_sec": round(mean(dispatch)) if dispatch else None,
        "avg_time_to_scene_sec": round(mean(scene.values())) if scene else None,
    }


def _scene_times(incidents, assignments) -> dict[Any, float]:
    """incident id -> seconds from incident creation to first unit on scene.

    Uses assignment.on_scene_at if BE1 adds it, else updated_at of on_scene/completed assignments.
    """
    created = {_get(i, "id"): _get(i, "created_at") for i in incidents}
    out: dict[Any, float] = {}
    for a in assignments:
        if _get(a, "status") not in ("on_scene", "completed"):
            continue
        iid = _get(a, "incident_id")
        t = _get(a, "on_scene_at") or _get(a, "updated_at")
        s = _secs(created.get(iid), t)
        if s is not None and (iid not in out or s < out[iid]):
            out[iid] = s
    return out


def compute_by_type(incidents) -> list[dict]:
    rows = []
    for t in INCIDENT_TYPES:
        items = [i for i in incidents if _get(i, "type") == t]
        if not items:
            continue
        sev = Counter(int(_get(i, "severity") or 0) for i in items)
        rows.append({"type": t, "count": len(items), "by_severity": {str(k): sev.get(k, 0) for k in range(1, 6)}})
    rows.sort(key=lambda r: -r["count"])
    return rows


def compute_response_times(incidents, reports, assignments) -> dict:
    dispatch = {
        _get(i, "id"): s for i in incidents if (s := _secs(_get(i, "created_at"), _get(i, "dispatched_at"))) is not None
    }
    buckets = []
    lo = 0
    for hi, label in RESPONSE_BUCKETS:
        buckets.append({
            "label": label,
            "count": sum(1 for s in dispatch.values() if s >= lo and (hi is None or s < hi)),
        })
        lo = hi or lo

    scene = _scene_times(incidents, assignments)
    by_type = []
    for t in INCIDENT_TYPES:
        ids = [_get(i, "id") for i in incidents if _get(i, "type") == t]
        d = [dispatch[x] for x in ids if x in dispatch]
        s = [scene[x] for x in ids if x in scene]
        if ids:
            by_type.append({
                "type": t,
                "avg_dispatch_sec": round(mean(d)) if d else None,
                "avg_scene_sec": round(mean(s)) if s else None,
            })

    per_min: dict[datetime, dict[str, int]] = defaultdict(lambda: {"incidents": 0, "reports": 0})
    for i in incidents:
        if (d := _dt(_get(i, "created_at"))) is not None:
            per_min[d.replace(second=0, microsecond=0)]["incidents"] += 1
    for r in reports:
        if (d := _dt(_get(r, "created_at"))) is not None:
            per_min[d.replace(second=0, microsecond=0)]["reports"] += 1
    timeline = [{"t": _iso(k), **v} for k, v in sorted(per_min.items())]
    return {"buckets": buckets, "by_type": by_type, "timeline": timeline}


def compute_shortages(alerts, resources) -> list[dict]:
    counts: Counter[str] = Counter()
    for a in alerts:
        if _get(a, "kind") != "shortage":
            continue
        msg = (_get(a, "message") or "").lower()
        for k in RESOURCE_KINDS:
            if k in msg or k.replace("_", " ") in msg:
                counts[k] += 1
    rows = []
    for k in RESOURCE_KINDS:
        pool = [r for r in resources if _get(r, "kind") == k]
        if not pool and not counts[k]:
            continue
        rows.append({
            "kind": k,
            "shortage_alerts": counts[k],
            "available": sum(1 for r in pool if _get(r, "status") == "available"),
            "total": len(pool),
        })
    rows.sort(key=lambda r: (-r["shortage_alerts"], r["available"]))
    return rows


def compute_hotspots(incidents, reports) -> list[dict]:
    """~500 m grid; weight = number of reports (fall back to incidents)."""
    cells: dict[tuple[int, int], dict] = {}
    inc_type = {_get(i, "id"): _get(i, "type") for i in incidents}
    points = [(r, _get(r, "lat"), _get(r, "lng"), inc_type.get(_get(r, "incident_id"))) for r in reports]
    if not any(lat is not None for _, lat, _, _ in points):
        points = [(i, _get(i, "lat"), _get(i, "lng"), _get(i, "type")) for i in incidents]
    for _, lat, lng, t in points:
        if lat is None or lng is None:
            continue
        key = (round(lat / GRID_DEG), round(lng / GRID_DEG))
        c = cells.setdefault(key, {"lat": 0.0, "lng": 0.0, "count": 0, "types": Counter()})
        c["lat"] += lat
        c["lng"] += lng
        c["count"] += 1
        if t:
            c["types"][t] += 1
    out = [
        {
            "lat": round(c["lat"] / c["count"], 5),
            "lng": round(c["lng"] / c["count"], 5),
            "count": c["count"],
            "top_type": c["types"].most_common(1)[0][0] if c["types"] else "other",
        }
        for c in cells.values()
    ]
    out.sort(key=lambda x: -x["count"])
    return out


# ---------------------------------------------------------------- DB access

def _load(db: Session, since: datetime | None) -> dict[str, list[Any]]:
    from app.models import Alert, Assignment, Incident, Report, Resource

    return {
        "incidents": _since(db.query(Incident).all(), since),
        "reports": _since(db.query(Report).all(), since),
        "resources": db.query(Resource).all(),
        "assignments": _since(db.query(Assignment).all(), since),
        "alerts": _since(db.query(Alert).all(), since),
    }


def _parse_since(since: str | None) -> datetime | None:
    return _dt(since) if since else None


# ---------------------------------------------------------------- endpoints

@router.get("/summary")
def summary(since: str | None = Query(None), db: Session = Depends(get_db)) -> dict:
    d = _load(db, _parse_since(since))
    return compute_summary(d["incidents"], d["reports"], d["resources"], d["assignments"])


@router.get("/by-type")
def by_type(since: str | None = Query(None), db: Session = Depends(get_db)) -> list[dict]:
    return compute_by_type(_load(db, _parse_since(since))["incidents"])


@router.get("/response-times")
def response_times(since: str | None = Query(None), db: Session = Depends(get_db)) -> dict:
    d = _load(db, _parse_since(since))
    return compute_response_times(d["incidents"], d["reports"], d["assignments"])


@router.get("/shortages")
def shortages(since: str | None = Query(None), db: Session = Depends(get_db)) -> list[dict]:
    d = _load(db, _parse_since(since))
    return compute_shortages(d["alerts"], d["resources"])


@router.get("/hotspots")
def hotspots(since: str | None = Query(None), db: Session = Depends(get_db)) -> list[dict]:
    d = _load(db, _parse_since(since))
    return compute_hotspots(d["incidents"], d["reports"])


@router.get("/insights")
def insights(db: Session = Depends(get_db)) -> list[dict]:
    """Data-derived operational insights (FE2 `OperationalInsight[]`), most urgent first."""
    from app.models import Incident, Report, Resource
    from app.services.insights import OPEN, compute_insights

    incidents = db.query(Incident).filter(Incident.status.in_(OPEN)).all()
    ids = [i.id for i in incidents]
    reports = db.query(Report).filter(Report.incident_id.in_(ids)).all() if ids else []
    return compute_insights(incidents, reports, db.query(Resource).all())


@router.get("/eval")
def eval_results() -> dict:
    if not EVAL_RESULTS.exists():
        return {"n": 0, "type_accuracy": None, "severity_within_1": None, "dedup_precision": None,
                "dedup_recall": None, "avg_latency_ms": None, "run_at": None}
    return json.loads(EVAL_RESULTS.read_text())
