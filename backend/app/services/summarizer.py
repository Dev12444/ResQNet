"""AI incident summaries, responder action checklists and SITREPs. Owner: BE2.

Contract: docs/API_CONTRACT.md §5 · PRD FR-7.
Summaries are always English even when reports are Gujarati/Hindi.
Never raises; template fallback when Gemini is unavailable.
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any

from app.services import llm

log = logging.getLogger("resqnet.summarizer")

MIN_INTERVAL_SEC = 20  # re-summarise an incident at most this often (PRD)
MAX_REPORTS_IN_PROMPT = 12
_last: dict[Any, tuple[float, dict]] = {}  # incident id -> (monotonic ts, result)

TYPE_ACTIONS: dict[str, list[str]] = {
    "flood": [
        "Send rescue boat with life jackets and ropes",
        "Cut power supply to the waterlogged area",
        "Close the underpass/road and divert traffic",
        "Move residents to the nearest shelter",
    ],
    "fire": [
        "Dispatch fire tender and cordon off 100 m",
        "Evacuate the building and adjacent floors",
        "Check for LPG cylinders and cut electricity",
        "Keep ambulance on standby for burns/smoke inhalation",
    ],
    "road_accident": [
        "Send ambulance and police to the site",
        "Stabilise and triage injured before moving",
        "Divert traffic and clear the lane",
        "Alert nearest trauma centre",
    ],
    "industrial": [
        "Send hazmat team with breathing apparatus",
        "Evacuate 500 m downwind and stop entry",
        "Identify the chemical with plant management",
        "Alert hospitals for chemical exposure cases",
    ],
    "medical": [
        "Dispatch nearest ambulance",
        "Guide caller on first aid until arrival",
        "Pre-alert receiving hospital",
    ],
    "building_collapse": [
        "Send NDRF search & rescue with cutting equipment",
        "Cordon area; check adjacent structures",
        "Cut gas and electricity lines",
        "Set up triage point for rescued victims",
    ],
    "other": ["Send nearest police patrol to verify", "Update control room after verification"],
}

SUMMARY_SYSTEM = """You are the duty officer of Ahmedabad's Emergency Operations Centre.
Write for dispatchers and field crews. Use ONLY facts from the reports; never invent names, numbers or places.
Reports may be in Gujarati or Hindi — always answer in clear English."""

SUMMARY_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string", "description": "Max 3 sentences: what, where, who is at risk, how many reports confirm."},
        "actions": {
            "type": "array",
            "items": {"type": "string"},
            "description": "3-5 concrete, imperative actions for responders, most urgent first, max 12 words each.",
        },
    },
    "required": ["summary", "actions"],
}


def _get(obj: Any, name: str, default: Any = None) -> Any:
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


def _fallback_summary(incident: Any, reports: list[Any]) -> dict:
    type_ = _get(incident, "type", "other")
    n = len(reports) or _get(incident, "report_count", 1) or 1
    where = _get(incident, "address") or "the reported location"
    hazards = _get(incident, "hazards") or []
    first = next((_get(r, "text") for r in reports if _get(r, "text")), None)
    sources = sorted({_get(r, "source") for r in reports if _get(r, "source")})
    parts = [
        f"{(_get(incident, 'title') or type_.replace('_', ' ').title())} at {where} "
        f"(severity {_get(incident, 'severity', '?')}, {_get(incident, 'priority', '?')}).",
        f"{n} report{'s' if n != 1 else ''} received" + (f" via {', '.join(sources)}" if sources else "") + ".",
    ]
    if hazards:
        parts.append(f"Hazards: {', '.join(h.replace('_', ' ') for h in hazards)}.")
    elif first:
        parts.append(f'First report: "{first[:120]}"')
    actions = list(TYPE_ACTIONS.get(type_, TYPE_ACTIONS["other"]))
    if "trapped_people" in hazards:
        actions.insert(0, "Prioritise rescue of trapped people")
    return {"summary": " ".join(parts), "actions": actions[:5]}


def summarize_incident(incident: Any, reports: list[Any], force: bool = False) -> dict:
    """-> {"summary": str, "actions": list[str]}. Never raises."""
    try:
        key = _get(incident, "id")
        now = time.monotonic()
        if not force and key is not None and key in _last and now - _last[key][0] < MIN_INTERVAL_SEC:
            return _last[key][1]

        ordered = sorted(reports, key=lambda r: str(_get(r, "created_at") or ""))[-MAX_REPORTS_IN_PROMPT:]  # str: naive/aware safe
        report_lines = "\n".join(
            f"- [{_get(r, 'source', '?')}, {_get(r, 'lang', '?')}] {(_get(r, 'text') or _sensor_line(r))[:400]}"
            for r in ordered
        )
        prompt = (
            f"Incident {_get(incident, 'code', '')}: type={_get(incident, 'type')}, severity={_get(incident, 'severity')}, "
            f"priority={_get(incident, 'priority')}, location={_get(incident, 'address') or 'unknown'}, "
            f"hazards={', '.join(_get(incident, 'hazards') or []) or 'none'}, total reports={len(reports)}.\n"
            f"Reports:\n{report_lines or '- (none)'}\n\nWrite the summary and responder actions."
        )
        data = llm.generate_json(prompt, SUMMARY_SCHEMA, system=SUMMARY_SYSTEM, temperature=0.2)
        if isinstance(data, dict) and isinstance(data.get("summary"), str) and data["summary"].strip():
            actions = [a.strip() for a in data.get("actions") or [] if isinstance(a, str) and a.strip()][:5]
            result = {"summary": data["summary"].strip(), "actions": actions or _fallback_summary(incident, reports)["actions"]}
        else:
            result = _fallback_summary(incident, reports)
        if key is not None:
            _last[key] = (now, result)
        return result
    except Exception as e:
        log.exception("summarize_incident failed: %s", e)
        return _fallback_summary(incident, reports)


def _sensor_line(r: Any) -> str:
    s = _get(r, "sensor") or {}
    if isinstance(s, dict) and s:
        return f"Sensor {s.get('sensor_id')}: {s.get('metric')}={s.get('value')}{s.get('unit', '')} (threshold {s.get('threshold')})"
    return ""


SITREP_SYSTEM = """You are the duty officer of Ahmedabad's Emergency Operations Centre writing a SITREP
for the Municipal Commissioner and District Collector. Markdown. Be concise and factual; use only the data given."""


def _fallback_sitrep(incidents: list[Any]) -> str:
    now = datetime.now(timezone.utc).strftime("%d %b %Y %H:%M UTC")
    active = [i for i in incidents if _get(i, "status") != "resolved"]
    p1 = [i for i in active if _get(i, "priority") == "P1"]
    lines = [
        f"## Situation Report — {now}",
        f"**Active incidents:** {len(active)} · **P1:** {len(p1)} · "
        f"**Escalated:** {sum(1 for i in active if _get(i, 'status') == 'escalated')}",
        "",
        "| Code | Type | Sev | Priority | Status | Location |",
        "|---|---|---|---|---|---|",
    ]
    for i in sorted(active, key=lambda x: (_get(x, "priority", "P4"), -(_get(x, "severity") or 0))):
        lines.append(
            f"| {_get(i, 'code', '')} | {_get(i, 'type', '')} | {_get(i, 'severity', '')} | {_get(i, 'priority', '')} "
            f"| {_get(i, 'status', '')} | {_get(i, 'address') or '-'} |"
        )
    undispatched = [i for i in p1 if _get(i, "status") in ("new", "triaged", "escalated")]
    if undispatched:
        lines += ["", "**Needs attention:** " + ", ".join(_get(i, "code", "?") for i in undispatched) + " (P1 not yet dispatched)"]
    return "\n".join(lines)


def sitrep(incidents: list[Any]) -> str:
    """Markdown situation report for all active incidents. Never raises."""
    try:
        active = [i for i in incidents if _get(i, "status") != "resolved"]
        if not active:
            return _fallback_sitrep(incidents)
        rows = "\n".join(
            f"- {_get(i, 'code', '')} | {_get(i, 'type')} | sev {_get(i, 'severity')} | {_get(i, 'priority')} | "
            f"{_get(i, 'status')} | {_get(i, 'address') or 'unknown'} | reports {_get(i, 'report_count', 1)} | "
            f"{(_get(i, 'ai_summary') or _get(i, 'title') or '')[:200]}"
            for i in active
        )
        prompt = (
            f"Time: {datetime.now(timezone.utc).strftime('%d %b %Y %H:%M UTC')}\nActive incidents:\n{rows}\n\n"
            "Write a SITREP with sections: '## Situation Report', 'Overview' (2 sentences), 'Critical incidents' "
            "(bullets, P1 first), 'Resource status / gaps', 'Recommended decisions' (3 bullets)."
        )
        text = llm.generate_text(prompt, system=SITREP_SYSTEM, temperature=0.2)
        return text or _fallback_sitrep(incidents)
    except Exception as e:
        log.exception("sitrep failed: %s", e)
        return _fallback_sitrep(incidents)
