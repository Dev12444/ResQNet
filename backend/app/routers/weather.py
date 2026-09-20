"""Router: active warnings.

    GET /api/weather/alerts -> WeatherAlert[] newest first

The frontend has always had an Active Warnings panel, but there was no
endpoint behind it, so the panel showed a bare 404 on every deployment. The
fixtures that would otherwise have filled it attribute CRITICAL cyclone
warnings to "IMD Ahmedabad", and shipping those raised a fabricated emergency
banner across a live build — so the frontend deliberately renders nothing
rather than invent a meteorological bulletin.

This endpoint fills the panel without inventing anything. ResQNet is not a
weather service and does not forecast: what it does have is incidents people
actually reported and sensor readings that actually crossed their thresholds.
Those are promoted to warnings here, and every one is attributed to ResQNet
itself, naming the evidence it came from. Nothing carries an authority's name,
and nothing describes weather that has not already been reported.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models as m
from app.db import get_db
from app.schemas import WeatherAlertOut

router = APIRouter(prefix="/api/weather", tags=["weather"])

# The public disaster vocabulary the citizen pages filter on, keyed by the
# contract's incident types. Mirrors INCIDENT_TO_DISASTER on the frontend.
_DISASTER_BY_TYPE = {
    "flood": "flood",
    "fire": "fire",
    "road_accident": "road_block",
    "industrial": "infrastructure",
    "medical": "medical",
    "building_collapse": "infrastructure",
    "other": "other",
}

# Severity 1-5 onto the five-step risk ladder the warning cards colour by.
_RISK_BY_SEVERITY = {5: "critical", 4: "critical", 3: "high", 2: "moderate", 1: "watch"}

# District centroids, mirroring GUJARAT_DISTRICTS on the frontend. The name is
# matched against the incident's address first; where the address names no
# district — "Akhbarnagar Underpass", "Maninagar", or nothing at all — the
# coordinates decide, because filing four warnings out of five under a literal
# "Gujarat" makes the district filter on /weather useless.
_DISTRICTS: list[tuple[str, float, float]] = [
    ("Kutch", 23.7337, 69.8597),
    ("Banaskantha", 24.1722, 72.4383),
    ("Patan", 23.8493, 72.1266),
    ("Mehsana", 23.5880, 72.3693),
    ("Gandhinagar", 23.2156, 72.6369),
    ("Ahmedabad", 23.0225, 72.5714),
    ("Jamnagar", 22.4707, 70.0577),
    ("Rajkot", 22.3039, 70.8022),
    ("Junagadh", 21.5222, 70.4579),
    ("Amreli", 21.6032, 71.2221),
    ("Bhavnagar", 21.7645, 72.1519),
    ("Vadodara", 22.3072, 73.1812),
    ("Bharuch", 21.7051, 72.9959),
    ("Narmada", 21.8700, 73.5000),
    ("Surat", 21.1702, 72.8311),
    ("Navsari", 20.9467, 72.9520),
    ("Valsad", 20.5992, 72.9342),
]

# Incidents below this are ordinary operational traffic, not something a
# citizen page should raise as a standing warning.
_MIN_SEVERITY = 3


def _district_of(address: str | None, lat: float | None = None, lng: float | None = None) -> str:
    """District by name in the address, else the nearest centroid, else Gujarat."""
    if address:
        low = address.lower()
        # Longest name first, so "Banaskantha" cannot lose to a shorter substring.
        for name, _, _ in sorted(_DISTRICTS, key=lambda d: -len(d[0])):
            if name.lower() in low:
                return name
    if lat is not None and lng is not None:
        # Plane geometry is accurate enough at this scale to pick a neighbour,
        # the same approximation the analytics hotspots use.
        return min(_DISTRICTS, key=lambda d: (d[1] - lat) ** 2 + (d[2] - lng) ** 2)[0]
    return "Gujarat"


@router.get("/alerts", response_model=list[WeatherAlertOut])
def list_weather_alerts(
    district: str | None = Query(None, max_length=64),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Active warnings derived from open incidents and threshold-crossing sensors."""
    out: list[dict] = []

    open_incidents = db.scalars(
        select(m.Incident)
        .where(m.Incident.status != "resolved", m.Incident.severity >= _MIN_SEVERITY)
        .order_by(m.Incident.created_at.desc())
    ).all()

    for inc in open_incidents:
        out.append(
            {
                "id": f"WA-INC-{inc.id}",
                "disaster": _DISASTER_BY_TYPE.get(inc.type, "other"),
                "severity": _RISK_BY_SEVERITY.get(inc.severity, "watch"),
                "district": _district_of(inc.address, inc.lat, inc.lng),
                "headline": inc.title,
                # The AI summary is already a plain-language account of what was
                # reported. Where it has not been written yet, say what is known
                # rather than padding with invented forecast language.
                "detail": inc.ai_summary
                or f"{inc.report_count} report(s) received. Severity {inc.severity}, priority {inc.priority}.",
                "issued_at": inc.created_at,
                "source": f"ResQNet — reported incident {inc.code}",
            }
        )

    # Sensor readings past their own threshold. These are the closest thing the
    # platform has to a genuine environmental warning, because the number came
    # off an instrument rather than out of a model.
    sensor_reports = db.scalars(
        select(m.Report)
        .where(m.Report.source == "sensor", m.Report.sensor.is_not(None))
        .order_by(m.Report.created_at.desc())
    ).all()

    seen: set[str] = set()
    for rep in sensor_reports:
        s = rep.sensor or {}
        sid = str(s.get("sensor_id") or "")
        value, threshold = s.get("value"), s.get("threshold")
        if not sid or sid in seen or value is None or threshold is None:
            continue
        seen.add(sid)
        if value <= threshold:
            continue
        # Metric names carry their unit as a suffix ("water_level_m"), which
        # reads as "water level m at 4.9m" if passed straight through.
        metric = str(s.get("metric") or "reading")
        for suffix in ("_m", "_mm", "_ppm", "_c", "_kph", "_pct"):
            if metric.endswith(suffix):
                metric = metric[: -len(suffix)]
                break
        unit = str(s.get("unit") or "")
        out.append(
            {
                "id": f"WA-SEN-{sid}",
                "disaster": "flood" if "water" in metric or "rain" in metric else "infrastructure",
                "severity": "critical" if value >= threshold * 1.15 else "high",
                "district": _district_of(rep.address, rep.lat, rep.lng),
                "headline": f"{sid} above threshold",
                "detail": (
                    f"{metric.replace('_', ' ')} at {value}{unit} against a "
                    f"threshold of {threshold}{unit}."
                ),
                "issued_at": rep.created_at,
                "source": f"ResQNet — sensor {sid}",
            }
        )

    if district:
        out = [a for a in out if a["district"].lower() == district.lower()]

    out.sort(key=lambda a: a["issued_at"] or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return out
