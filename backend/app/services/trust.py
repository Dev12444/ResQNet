"""Incident trust: corroboration, conflicts between reports, sensor confirmation. Owner: BE2.

Returns FE2's `IncidentTrust` shape (frontend/src/types/index.ts) so /dashboard and /report can
show *how well supported* an incident is, independent of how severe it is.

Conflicts are detected deterministically from each report's stored AI classification
(`Report.ai_json`) plus a few text cues — explainable, instant, and free. Every claim cites the
report it came from. Never raises.
"""
from __future__ import annotations

import logging
import re
from datetime import timezone
from typing import Any

log = logging.getLogger("resqnet.trust")

# Two people-count estimates conflict when they differ this much (both relative and absolute).
PEOPLE_RATIO = 2.0
PEOPLE_ABS = 3
SEVERITY_GAP = 2

# "It's over" vs "it's getting worse" in reports about the same incident.
_CONTAINED = re.compile(
    r"\b(put out|extinguished|under control|contained|rescued|no one (?:is )?(?:inside|trapped)|water (?:has )?receded)\b"
    r"|કાબૂમાં|બુઝાઈ|बुझ गई|काबू में|बचा लिया",
    re.I,
)
_WORSENING = re.compile(
    r"\b(spreading|rising|getting worse|out of control|more people|still trapped|increasing)\b"
    r"|ફેલાઈ|વધી રહ્યું|फैल रही|बढ़ रहा|और लोग",
    re.I,
)


def _get(obj: Any, name: str, default: Any = None) -> Any:
    return obj.get(name, default) if isinstance(obj, dict) else getattr(obj, name, default)


def _iso(v: Any) -> str | None:
    if v is None:
        return None
    if isinstance(v, str):
        return v
    if v.tzinfo is None:
        v = v.replace(tzinfo=timezone.utc)
    return v.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _claim(value: str, r: Any) -> dict:
    return {"value": value, "source": _get(r, "source"), "report_id": _get(r, "id"), "at": _iso(_get(r, "created_at"))}


def source_breakdown(reports: list[Any]) -> dict:
    """Counts per source and DISTINCT reporters (five texts from one person = one source)."""
    counts = {"citizen": 0, "call": 0, "sensor": 0, "field": 0}
    seen: set[str] = set()
    for r in reports:
        src = _get(r, "source") or "citizen"
        counts[src] = counts.get(src, 0) + 1
        sensor = _get(r, "sensor") or {}
        seen.add(_get(r, "reporter") or (sensor.get("sensor_id") if isinstance(sensor, dict) else None)
                 or f"{src}:{_get(r, 'id')}")
    return {"reports": len(reports), "unique_sources": len(seen), **counts}


def detect_conflicts(reports: list[Any]) -> list[dict]:
    """Disagreements between reports of one incident. Each conflict lists the competing claims."""
    conflicts: list[dict] = []
    ai = [(r, _get(r, "ai_json") or {}) for r in reports if _get(r, "source") != "sensor"]

    people = [(r, a.get("people_affected_est")) for r, a in ai if isinstance(a.get("people_affected_est"), int)]
    people = [(r, n) for r, n in people if n > 0]
    if len(people) >= 2:
        lo, hi = min(people, key=lambda x: x[1]), max(people, key=lambda x: x[1])
        if hi[1] >= PEOPLE_RATIO * lo[1] and hi[1] - lo[1] >= PEOPLE_ABS:
            conflicts.append({"field": "people_affected",
                              "claims": [_claim(f"{lo[1]} people", lo[0]), _claim(f"{hi[1]} people", hi[0])]})

    sev = [(r, a.get("severity")) for r, a in ai if isinstance(a.get("severity"), int)]
    if len(sev) >= 2:
        lo, hi = min(sev, key=lambda x: x[1]), max(sev, key=lambda x: x[1])
        if hi[1] - lo[1] >= SEVERITY_GAP:
            conflicts.append({"field": "severity",
                              "claims": [_claim(f"severity {lo[1]}", lo[0]), _claim(f"severity {hi[1]}", hi[0])]})

    types: dict[str, Any] = {}
    for r, a in ai:
        t = a.get("type")
        if t and t != "other" and t not in types:
            types[t] = r
    if len(types) >= 2:
        conflicts.append({"field": "type",
                          "claims": [_claim(t.replace("_", " "), r) for t, r in types.items()]})

    contained = [r for r in reports if _CONTAINED.search(_get(r, "text") or "")]
    worsening = [r for r in reports if _WORSENING.search(_get(r, "text") or "")]
    if contained and worsening:
        latest_c = max(contained, key=lambda r: _iso(_get(r, "created_at")) or "")
        latest_w = max(worsening, key=lambda r: _iso(_get(r, "created_at")) or "")
        if latest_c is not latest_w:
            conflicts.append({"field": "situation",
                              "claims": [_claim("contained / over", latest_c), _claim("worsening", latest_w)]})
    return conflicts


def sensor_corroboration(reports: list[Any]) -> dict | None:
    for r in reports:
        s = _get(r, "sensor")
        if _get(r, "source") != "sensor" or not isinstance(s, dict):
            continue
        try:
            value, threshold = float(s.get("value")), float(s.get("threshold"))
        except (TypeError, ValueError):
            continue
        if value >= threshold:
            unit = s.get("unit") or ""
            return {"sensor_id": str(s.get("sensor_id") or "sensor"),
                    "detail": f"{s.get('metric')} {value:g}{unit} against a {threshold:g}{unit} threshold."}
    return None


def verification_status(reports: list[Any], sources: dict, conflicts: list[dict], sensor: dict | None) -> str:
    if conflicts:
        return "conflicting"
    if any(_get(r, "source") == "field" for r in reports):
        return "verified"
    if sources["unique_sources"] >= 2 or sensor is not None:
        return "corroborated"
    return "unverified"


def incident_trust(incident: Any, reports: list[Any] | None = None) -> dict:
    """FE2 `IncidentTrust` for one incident. Never raises."""
    iid = _get(incident, "id")
    try:
        reports = list(reports if reports is not None else (_get(incident, "reports") or []))
        sources = source_breakdown(reports)
        conflicts = detect_conflicts(reports)
        sensor = sensor_corroboration(reports)
        if any(c["field"] in ("type", "situation") for c in conflicts):
            duplicate_state = "review_required"   # reports may describe different events
        elif sources["reports"] > sources["unique_sources"]:
            duplicate_state = "possible_duplicate"  # same reporter repeating themselves
        else:
            duplicate_state = "matched"
        return {
            "incident_id": iid,
            "verification": verification_status(reports, sources, conflicts, sensor),
            "sources": sources,
            "duplicate_state": duplicate_state,
            "sensor_corroboration": sensor,
            "conflicts": conflicts,
        }
    except Exception as e:
        log.exception("incident_trust failed: %s", e)
        return {"incident_id": iid, "verification": "unverified",
                "sources": {"reports": 0, "unique_sources": 0, "citizen": 0, "call": 0, "sensor": 0, "field": 0},
                "duplicate_state": "matched", "sensor_corroboration": None, "conflicts": []}
