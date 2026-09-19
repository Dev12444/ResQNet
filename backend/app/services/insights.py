"""Operational insights: concrete, data-derived observations for /dashboard and /analytics. Owner: BE2.

Returns FE2's `OperationalInsight[]` (frontend/src/types/index.ts). No LLM and no marketing copy:
every insight carries the numbers it was computed from in `evidence`, so a judge or dispatcher
can check it. Kinds: sla_breach, shortage, coverage, trend, conflict. Never raises.
"""
from __future__ import annotations

import logging
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any

from app.config import get_settings
from app.services import recommender, trust

log = logging.getLogger("resqnet.insights")

OPEN = ("new", "triaged", "dispatched", "on_scene", "escalated")
UNDISPATCHED = ("new", "triaged", "escalated")
TREND_WINDOW = timedelta(minutes=10)
TREND_MIN_REPORTS = 3
TREND_RATIO = 2.0
TREND_MIN_INCIDENTS = 2  # distinct incidents of the type in the window
# A P1/P2 incident whose nearest suitable unit is further than this is under-covered.
# Boats/NDRF move slowly through floodwater, so they get a wider allowance (avoids flagging every flood).
COVERAGE_ETA_MIN = {"rescue_boat": 35, "ndrf_team": 35}
COVERAGE_ETA_DEFAULT = 20
_RANK = {"critical": 0, "warning": 1, "info": 2}
TYPE_LABEL = {
    "flood": "Flood", "fire": "Fire", "road_accident": "Road accident", "industrial": "Industrial",
    "medical": "Medical", "building_collapse": "Building collapse", "other": "Other",
}


def _get(obj: Any, name: str, default: Any = None) -> Any:
    return obj.get(name, default) if isinstance(obj, dict) else getattr(obj, name, default)


def _dt(v: Any) -> datetime | None:
    if v is None:
        return None
    if isinstance(v, str):
        try:
            v = datetime.fromisoformat(v.replace("Z", "+00:00"))
        except ValueError:
            return None
    return v if v.tzinfo else v.replace(tzinfo=timezone.utc)


def _dur(sec: float) -> str:
    sec = int(sec)
    return f"{sec // 60}m {sec % 60:02d}s" if sec >= 60 else f"{sec}s"


_KIND_LABELS = {"ndrf_team": "NDRF team", "hazmat": "hazmat unit", "police": "police unit"}


def _kind_label(kind: str, plural: bool = False) -> str:
    label = _KIND_LABELS.get(kind, kind.replace("_", " "))
    return label + "s" if plural else label


def _cap(s: str) -> str:
    return s[:1].upper() + s[1:]  # keeps "NDRF" intact, unlike str.capitalize()


def sla_breaches(incidents: list[Any], now: datetime) -> list[dict]:
    st = get_settings()
    limits = {"P1": st.sla_p1_dispatch_sec, "P2": st.sla_p2_dispatch_sec}
    out = []
    for i in incidents:
        limit = limits.get(_get(i, "priority"))
        created = _dt(_get(i, "created_at"))
        if limit is None or created is None or _get(i, "status") not in UNDISPATCHED:
            continue
        waited = (now - created).total_seconds()
        if waited <= limit:
            continue
        code = _get(i, "code") or f"#{_get(i, 'id')}"
        out.append({
            "id": f"sla_breach:{code}",
            "kind": "sla_breach",
            "severity": "critical" if _get(i, "priority") == "P1" else "warning",
            "headline": f"{code} ({_get(i, 'priority')} {TYPE_LABEL.get(_get(i, 'type'), 'incident').lower()}) "
                        f"waiting {_dur(waited)} for dispatch",
            "detail": f"{_get(i, 'title') or 'Incident'} at {_get(i, 'address') or 'unknown location'} has no unit "
                      f"assigned. Dispatch or escalate now.",
            "evidence": f"created {created.strftime('%H:%M:%S')} UTC; {_get(i, 'priority')} dispatch SLA {limit}s; "
                        f"waited {int(waited)}s",
        })
    return out


def shortages(incidents: list[Any], resources: list[Any]) -> list[dict]:
    """Demand (open, undispatched incidents needing a kind) vs supply (available units of that kind)."""
    demand: Counter[str] = Counter()
    for i in incidents:
        if _get(i, "status") in UNDISPATCHED:
            for k in recommender.needed_kinds(_get(i, "type") or "other", _get(i, "hazards") or [])[:1]:
                demand[k] += 1  # primary need only — secondary kinds are nice-to-have
    available = Counter(_get(r, "kind") for r in resources if _get(r, "status") == "available")
    total = Counter(_get(r, "kind") for r in resources)
    out = []
    for kind, need in demand.most_common():
        have = available.get(kind, 0)
        if need <= have:
            continue
        short = need - have
        out.append({
            "id": f"shortage:{kind}",
            "kind": "shortage",
            "severity": "critical" if have == 0 else "warning",
            "headline": f"{_cap(_kind_label(kind, plural=True))} short by {short}",
            "detail": f"{need} open incident{'s' if need != 1 else ''} need a {_kind_label(kind)} first, "
                      f"but only {have} {'is' if have == 1 else 'are'} available. Request mutual aid or re-prioritise.",
            "evidence": f"demand {need} (primary need of undispatched incidents); available {have} of {total.get(kind, 0)}",
        })
    return out


def coverage_gaps(incidents: list[Any], resources: list[Any]) -> list[dict]:
    """High-priority incidents whose nearest suitable available unit is far away."""
    out = []
    for i in incidents:
        if _get(i, "status") not in UNDISPATCHED or _get(i, "priority") not in ("P1", "P2"):
            continue
        lat, lng = _get(i, "lat"), _get(i, "lng")
        if lat is None or lng is None:
            continue
        kind = recommender.needed_kinds(_get(i, "type") or "other", _get(i, "hazards") or [])[0]
        pool = [r for r in resources if _get(r, "status") == "available" and _get(r, "kind") == kind]
        if not pool:
            continue  # already reported as a shortage
        best = min(
            ((recommender._haversine_km(lat, lng, _get(r, "lat"), _get(r, "lng")), r) for r in pool),
            key=lambda x: x[0],
        )
        eta = recommender._eta_min(best[0], kind)
        limit = COVERAGE_ETA_MIN.get(kind, COVERAGE_ETA_DEFAULT)
        if eta <= limit:
            continue
        code = _get(i, "code") or f"#{_get(i, 'id')}"
        out.append({
            "id": f"coverage:{code}",
            "kind": "coverage",
            "severity": "warning",
            "headline": f"{code}: nearest {_kind_label(kind)} is {eta} min away",
            "detail": f"No {_kind_label(kind)} is stationed near {_get(i, 'address') or 'this incident'}. "
                      f"Consider pre-positioning a unit or dispatching the closest alternative.",
            "evidence": f"{_get(best[1], 'callsign')} at {best[0]:.1f} km, ETA {eta} min (threshold {limit} min)",
        })
    return out


def trends(incidents: list[Any], reports: list[Any], now: datetime) -> list[dict]:
    """Report volume per incident type: last 10 min vs the 10 min before."""
    type_of = {_get(i, "id"): _get(i, "type") for i in incidents}
    cur: Counter[str] = Counter()
    prev: Counter[str] = Counter()
    cur_incidents: dict[str, set] = {}
    for r in reports:
        t, at = type_of.get(_get(r, "incident_id")), _dt(_get(r, "created_at"))
        if not t or at is None:
            continue
        age = now - at
        if age <= TREND_WINDOW:
            cur[t] += 1
            cur_incidents.setdefault(t, set()).add(_get(r, "incident_id"))
        elif age <= 2 * TREND_WINDOW:
            prev[t] += 1
    out = []
    for t, n in cur.most_common():
        before = prev.get(t, 0)
        if n < TREND_MIN_REPORTS or n < TREND_RATIO * max(before, 1):
            continue
        if len(cur_incidents.get(t, ())) < TREND_MIN_INCIDENTS:
            continue  # many reports about ONE incident is corroboration, not a trend
        change = "new surge" if before == 0 else f"{n / before:.1f}x"
        out.append({
            "id": f"trend:{t}",
            "kind": "trend",
            "severity": "warning" if n >= 2 * TREND_MIN_REPORTS else "info",
            "headline": f"{TYPE_LABEL.get(t, t)} reports rising ({change} in 10 min)",
            "detail": f"{n} {TYPE_LABEL.get(t, t).lower()} reports in the last 10 minutes. Expect more incidents of "
                      f"this type; check unit availability.",
            "evidence": f"{n} reports in last 10 min vs {before} in the 10 min before",
        })
    return out


def conflicts(incidents: list[Any], reports_by_incident: dict[Any, list[Any]]) -> list[dict]:
    out = []
    for i in incidents:
        if _get(i, "status") not in OPEN:
            continue
        found = trust.detect_conflicts(reports_by_incident.get(_get(i, "id"), []))
        if not found:
            continue
        code = _get(i, "code") or f"#{_get(i, 'id')}"
        fields = ", ".join(c["field"].replace("_", " ") for c in found)
        first = found[0]["claims"]
        out.append({
            "id": f"conflict:{code}",
            "kind": "conflict",
            "severity": "warning",
            "headline": f"{code}: reports disagree on {fields}",
            "detail": "Verify with the caller or field team before acting on the higher/lower figure.",
            "evidence": "; ".join(f"report {c['report_id']} ({c['source']}): {c['value']}" for c in first),
        })
    return out


def compute_insights(
    incidents: list[Any], reports: list[Any], resources: list[Any], now: datetime | None = None
) -> list[dict]:
    """All insights, most urgent first. Never raises."""
    now = now or datetime.now(timezone.utc)
    by_incident: dict[Any, list[Any]] = {}
    for r in reports:
        by_incident.setdefault(_get(r, "incident_id"), []).append(r)
    items: list[dict] = []
    for fn in (
        lambda: sla_breaches(incidents, now),
        lambda: shortages(incidents, resources),
        lambda: coverage_gaps(incidents, resources),
        lambda: conflicts(incidents, by_incident),
        lambda: trends(incidents, reports, now),
    ):
        try:
            items.extend(fn())
        except Exception as e:  # one broken rule must not hide the others
            log.exception("insight rule failed: %s", e)
    return sorted(items, key=lambda x: _RANK.get(x["severity"], 3))
