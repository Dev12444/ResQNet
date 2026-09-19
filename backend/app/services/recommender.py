"""Resource recommendation: which units + which facility for an incident. Owner: BE2.

Contract: docs/API_CONTRACT.md §3 (GET /recommendations) and §5 · PRD FR-4.
Score = 0.5·capability_fit + 0.35·(1 − eta/eta_max) + 0.15·load_balance
capability_fit = 0.6·(how important the kind is) + 0.4·(share of wanted unit capabilities it has),
e.g. a fire with people trapped prefers the truck with an aerial ladder / rescue kit.
Deterministic ranking; Gemini only writes the one-line reasons (template fallback).
"""
from __future__ import annotations

import copy
import logging
import math
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
from typing import Any

from app.services import llm

log = logging.getLogger("resqnet.recommender")

# Incident type -> needed resource kinds, most important first (contract §1).
NEEDED_KINDS: dict[str, list[str]] = {
    "flood": ["rescue_boat", "ndrf_team", "ambulance"],
    "fire": ["fire_truck", "ambulance"],
    "road_accident": ["ambulance", "police"],
    "industrial": ["hazmat", "fire_truck", "ambulance"],
    "medical": ["ambulance"],
    "building_collapse": ["ndrf_team", "fire_truck", "ambulance"],
    "other": ["police"],
}
# Average urban speeds (km/h) incl. monsoon traffic; used when BE1's geo.eta_minutes is missing.
SPEED_KMH = {"ambulance": 35, "fire_truck": 30, "police": 40, "rescue_boat": 10, "ndrf_team": 25, "hazmat": 30}
ROAD_FACTOR = 1.35  # straight line -> road distance
TOP_N = 3
W_CAP, W_ETA, W_LOAD = 0.5, 0.35, 0.15

HOSPITAL_TYPES = {"fire", "road_accident", "industrial", "medical", "building_collapse"}
HOSPITAL_HAZARDS = {"injuries", "trapped_people", "gas_leak", "chemical"}
TRAUMA_TYPES = {"road_accident", "building_collapse", "industrial", "fire"}

# Words in the incident title/summary that call for a specialised ambulance or hospital.
_CARDIAC = ("heart", "cardiac", "chest pain", "collapsed", "unconscious", "stroke", "હાર્ટ", "हार्ट", "दिल")
_CHILD = ("child", "children", "baby", "infant", "kid", "school", "બાળક", "बच्च")
# How many extra km a matching specialty is worth when choosing a hospital (time-critical care counts more).
SPECIALTY_KM = {"cardiac": 3.0, "burns": 2.0, "trauma": 1.5, "pediatric": 1.5}
_BURNS = ("burn", "દાઝ", "जल गए", "झुलस")


def _text(incident: Any) -> str:
    return " ".join(str(_get(incident, k) or "") for k in ("title", "ai_summary", "ai_reasoning")).lower()


def wanted_capabilities(incident: Any) -> dict[str, list[str]]:
    """Unit capabilities (seed_resources.json vocabulary) that make a unit a better fit, per kind."""
    type_ = _get(incident, "type", "other")
    hz = set(_get(incident, "hazards") or [])
    sev = _get(incident, "severity") or 3
    text = _text(incident)
    want: dict[str, list[str]] = {}

    amb: list[str] = []
    if any(w in text for w in _CARDIAC):
        amb += ["cardiac", "als"]
    if any(w in text for w in _CHILD):
        amb.append("pediatric")
    if type_ in TRAUMA_TYPES or hz & {"injuries", "trapped_people", "structural"}:
        amb.append("trauma")
    if sev >= 4 and "als" not in amb:
        amb.append("als")
    want["ambulance"] = amb

    fire: list[str] = []
    if "trapped_people" in hz or type_ == "building_collapse":
        fire += ["rescue", "aerial_ladder"]
    if "fire_spread" in hz or type_ in ("fire", "industrial"):
        fire.append("water_tender")
    want["fire_truck"] = fire

    want["rescue_boat"] = ["swift_water"] if ("rising_water" in hz or sev >= 4) else []
    ndrf = []
    if type_ == "flood":
        ndrf.append("flood_rescue")
    if type_ == "building_collapse" or "structural" in hz:
        ndrf.append("collapse_rescue")
    want["ndrf_team"] = ndrf
    hazmat = []
    if "gas_leak" in hz:
        hazmat.append("gas_leak")
    if "chemical" in hz:
        hazmat += ["chemical", "decontamination"]
    want["hazmat"] = hazmat
    police = []
    if type_ == "road_accident" or "blocked_road" in hz:
        police.append("traffic_control")
    if (_get(incident, "people_affected_est") or 0) >= 20 or type_ == "flood" and sev >= 4:
        police.append("crowd_control")
    want["police"] = police
    return {k: list(dict.fromkeys(v)) for k, v in want.items()}


def _haversine_km(lat1, lng1, lat2, lng2) -> float:
    try:
        from app.services.geo import haversine_km

        return haversine_km(lat1, lng1, lat2, lng2)
    except ImportError:
        pass
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _eta_min(distance_km: float, kind: str) -> int:
    try:
        from app.services.geo import eta_minutes

        return int(eta_minutes(distance_km, kind))
    except ImportError:
        pass
    speed = SPEED_KMH.get(kind, 30)
    road_km = distance_km * (1.0 if kind == "rescue_boat" else ROAD_FACTOR)
    return max(2, math.ceil(road_km / speed * 60) + 2)  # +2 min turnout time


def _get(obj: Any, name: str, default: Any = None) -> Any:
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


def resource_dict(r: Any) -> dict:
    return {
        "id": _get(r, "id"),
        "callsign": _get(r, "callsign"),
        "kind": _get(r, "kind"),
        "status": _get(r, "status"),
        "capabilities": list(_get(r, "capabilities") or []),
        "lat": _get(r, "lat"),
        "lng": _get(r, "lng"),
        "base": _get(r, "base"),
        "phone": _get(r, "phone"),
        "current_incident_id": _get(r, "current_incident_id"),
    }


def facility_dict(f: Any) -> dict:
    return {
        "id": _get(f, "id"),
        "name": _get(f, "name"),
        "kind": _get(f, "kind"),
        "lat": _get(f, "lat"),
        "lng": _get(f, "lng"),
        "beds_total": _get(f, "beds_total"),
        "beds_available": _get(f, "beds_available"),
        "specialties": list(_get(f, "specialties") or []),
    }


def needed_kinds(incident_type: str, hazards: list[str] | None = None) -> list[str]:
    kinds = list(NEEDED_KINDS.get(incident_type, NEEDED_KINDS["other"]))
    hz = set(hazards or [])
    if "injuries" in hz and "ambulance" not in kinds:
        kinds.append("ambulance")
    if {"gas_leak", "chemical"} & hz and "hazmat" not in kinds:
        kinds.insert(0, "hazmat")
    if "blocked_road" in hz and "police" not in kinds:
        kinds.append("police")
    return kinds


def rank_resources(incident: Any, resources: list[Any]) -> dict:
    """Pure ranking (no DB, no LLM). Returns per-kind top-N recommendations + shortages."""
    kinds = needed_kinds(_get(incident, "type", "other"), _get(incident, "hazards"))
    ilat, ilng = _get(incident, "lat"), _get(incident, "lng")
    available = [r for r in resources if _get(r, "status") == "available"]
    per_base = Counter((_get(r, "kind"), _get(r, "base")) for r in available)
    per_kind = Counter(_get(r, "kind") for r in available)
    wanted = wanted_capabilities(incident)

    recs: dict[str, list[dict]] = {}
    shortages: list[str] = []
    for rank, kind in enumerate(kinds):
        pool = [r for r in available if _get(r, "kind") == kind]
        if not pool:
            shortages.append(kind)
            recs[kind] = []
            continue
        kind_fit = max(0.6, 1.0 - 0.15 * rank)
        want = wanted.get(kind, [])
        rows = []
        for r in pool:
            if None in (ilat, ilng, _get(r, "lat"), _get(r, "lng")):
                dist = 5.0  # unknown location: assume mid-city distance
            else:
                dist = _haversine_km(ilat, ilng, _get(r, "lat"), _get(r, "lng"))
            rows.append((r, dist, _eta_min(dist, kind)))
        eta_max = max(max(e for _, _, e in rows), 30)
        out = []
        for r, dist, eta in rows:
            # Prefer taking a unit from a base that still has others of the same kind left.
            load = per_base[(kind, _get(r, "base"))] / per_kind[kind]
            matched = [c for c in want if c in (_get(r, "capabilities") or [])]
            cap_fit = 0.6 * kind_fit + 0.4 * (len(matched) / len(want) if want else 1.0)
            score = W_CAP * cap_fit + W_ETA * (1 - eta / eta_max) + W_LOAD * load
            out.append({
                "resource": resource_dict(r),
                "kind": kind,
                "distance_km": round(dist, 2),
                "eta_min": eta,
                "score": round(score, 3),
                "matched_capabilities": matched,
                "reason": "",
            })
        out.sort(key=lambda x: (-x["score"], x["eta_min"]))
        recs[kind] = out[:TOP_N]
    suggested = [recs[k][0]["resource"]["id"] for k in kinds if recs.get(k)]
    return {"needed_kinds": kinds, "recommendations": recs, "suggested_resource_ids": suggested, "shortages": shortages}


def wanted_specialties(incident: Any) -> list[str]:
    """Hospital specialties (seed_facilities.json vocabulary) that suit this incident."""
    type_ = _get(incident, "type", "other")
    hz = set(_get(incident, "hazards") or [])
    text = _text(incident)
    specs: list[str] = []
    if type_ in TRAUMA_TYPES or hz & {"injuries", "trapped_people", "structural"}:
        specs.append("trauma")
    if type_ in ("fire", "industrial") or any(w in text for w in _BURNS):
        specs.append("burns")
    if any(w in text for w in _CARDIAC):
        specs.append("cardiac")
    if any(w in text for w in _CHILD):
        specs.append("pediatric")
    return specs


def pick_facility(incident: Any, facilities: list[Any]) -> dict | None:
    type_ = _get(incident, "type", "other")
    hazards = set(_get(incident, "hazards") or [])
    needs_hospital = type_ in HOSPITAL_TYPES or bool(hazards & HOSPITAL_HAZARDS)
    want = "hospital" if needs_hospital else ("shelter" if type_ == "flood" else "hospital")
    ilat, ilng = _get(incident, "lat"), _get(incident, "lng")

    def usable(f):
        if _get(f, "kind") != want:
            return False
        beds = _get(f, "beds_available")
        return beds is None or beds > 0

    pool = [f for f in facilities if usable(f)] or [f for f in facilities if _get(f, "kind") == "hospital"]
    if not pool or None in (ilat, ilng):
        return None

    wanted_specs = wanted_specialties(incident) if want == "hospital" else []

    def rank(f):
        d = _haversine_km(ilat, ilng, _get(f, "lat"), _get(f, "lng"))
        have = set(_get(f, "specialties") or [])
        return d - sum(SPECIALTY_KM.get(s, 1.0) for s in wanted_specs if s in have), d

    best = min(pool, key=lambda f: rank(f)[0])
    dist = rank(best)[1]
    beds = _get(best, "beds_available")
    specs = [s for s in wanted_specs if s in (_get(best, "specialties") or [])]
    reason = f"Nearest {want}" + (f" with {'/'.join(specs)} care" if specs else "") + (
        f", {beds} beds available." if beds is not None else "."
    )
    return {"facility": facility_dict(best), "distance_km": round(dist, 2), "reason": reason}


def _template_reason(rec: dict, best_eta: int) -> str:
    r = rec["resource"]
    parts = [f"{rec['distance_km']} km away, ETA {rec['eta_min']} min"]
    if rec.get("matched_capabilities"):
        parts.insert(0, "Has " + ", ".join(c.replace("_", " ") for c in rec["matched_capabilities"]))
    if rec["eta_min"] <= best_eta:
        parts.insert(0, f"Fastest available {r['kind'].replace('_', ' ')}")
    if r.get("base"):
        parts.append(f"from {r['base']}")
    return "; ".join(parts) + "."


REASON_SYSTEM = (
    "You are an emergency dispatch assistant in Ahmedabad. For each candidate unit write ONE short "
    "English reason (max 18 words) why it suits this incident, using only the facts given (distance, ETA, "
    "base, kind, capabilities). Be concrete; no fluff."
)
REASON_SCHEMA = {
    "type": "object",
    "properties": {
        "reasons": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"id": {"type": "integer"}, "reason": {"type": "string"}},
                "required": ["id", "reason"],
            },
        }
    },
    "required": ["reasons"],
}


# The dispatcher needs the ranked units now; the LLM only rewords the reasons. If it hasn't answered
# within this budget the template reasons are returned, and the call finishes in the background so its
# answer is cached for the panel's next refresh.
REASON_BUDGET_SEC = 4.0
_REASON_POOL = ThreadPoolExecutor(max_workers=2, thread_name_prefix="reasons")


def _llm_reasons(incident: Any, all_recs: list[dict]) -> dict[Any, str]:
    """{resource id: one-line reason} from the LLM ({} on failure). Reads its inputs only."""
    lines = [
        f'- id={rec["resource"]["id"]} {rec["resource"]["callsign"]} ({rec["kind"]}), base {rec["resource"]["base"]}, '
        f'{rec["distance_km"]} km, ETA {rec["eta_min"]} min, score {rec["score"]}, '
        f'capabilities {", ".join(rec["resource"].get("capabilities") or []) or "standard"}'
        + (f' (matches {", ".join(rec["matched_capabilities"])})' if rec.get("matched_capabilities") else "")
        for rec in all_recs
    ]
    prompt = (
        f"Incident: {_get(incident, 'title') or _get(incident, 'type')} "
        f"(type {_get(incident, 'type')}, severity {_get(incident, 'severity')}, "
        f"hazards {', '.join(_get(incident, 'hazards') or []) or 'none'}, at {_get(incident, 'address') or 'unknown'}).\n"
        "Candidates:\n" + "\n".join(lines)
    )
    data = llm.generate_json(prompt, REASON_SCHEMA, system=REASON_SYSTEM, temperature=0.2)
    if not isinstance(data, dict):
        return {}
    return {x.get("id"): x.get("reason") for x in data.get("reasons", []) if isinstance(x, dict)}


def _add_reasons(incident: Any, ranked: dict) -> None:
    all_recs = [rec for recs in ranked["recommendations"].values() for rec in recs]
    if not all_recs:
        return
    for kind, recs in ranked["recommendations"].items():
        best_eta = min((x["eta_min"] for x in recs), default=0)
        for rec in recs:
            rec["reason"] = _template_reason(rec, best_eta)
    # The worker gets its own copies: if it outlives the budget it must not touch the response.
    future = _REASON_POOL.submit(_llm_reasons, dict(incident) if isinstance(incident, dict) else incident,
                                 copy.deepcopy(all_recs))
    try:
        by_id = future.result(timeout=REASON_BUDGET_SEC)
    except FutureTimeout:
        log.info("LLM reasons for incident %s not ready in %ss; template reasons returned",
                 _get(incident, "id"), REASON_BUDGET_SEC)
        return
    except Exception as e:  # reasons are cosmetic: never fail the recommendation
        log.info("LLM reasons failed: %s", e)
        return
    for rec in all_recs:
        reason = by_id.get(rec["resource"]["id"])
        if isinstance(reason, str) and reason.strip():
            rec["reason"] = reason.strip()[:160]


def build_recommendation(incident: Any, resources: list[Any], facilities: list[Any], with_llm: bool = True) -> dict:
    ranked = rank_resources(incident, resources)
    if with_llm:
        _add_reasons(incident, ranked)
    else:
        for recs in ranked["recommendations"].values():
            best_eta = min((x["eta_min"] for x in recs), default=0)
            for rec in recs:
                rec["reason"] = _template_reason(rec, best_eta)
    return {
        "incident_id": _get(incident, "id"),
        **ranked,
        "facility": pick_facility(incident, facilities),
    }


_INCIDENT_FIELDS = ("id", "type", "severity", "hazards", "lat", "lng", "title", "address", "ai_summary",
                    "ai_reasoning", "people_affected_est")


def snapshot(db, incident: Any) -> tuple[dict, list[dict], list[dict]]:
    """Plain-dict copies of everything the recommender reads, so the caller can end its DB
    transaction before the (slow) LLM step: (incident, resources, facilities)."""
    from app.models import Facility, Resource  # BE1's models

    inc = {k: _get(incident, k) for k in _INCIDENT_FIELDS}
    inc["hazards"] = list(inc["hazards"] or [])
    resources = [resource_dict(r) for r in db.query(Resource).all()]
    return inc, resources, [facility_dict(f) for f in db.query(Facility).all()]


def _empty(incident: Any) -> dict:
    return {
        "incident_id": _get(incident, "id"),
        "needed_kinds": needed_kinds(_get(incident, "type", "other")),
        "recommendations": {},
        "suggested_resource_ids": [],
        "facility": None,
        "shortages": [],
    }


def recommend_from_snapshot(incident: dict, resources: list[dict], facilities: list[dict]) -> dict:
    """build_recommendation on snapshot() output (no DB). Never raises."""
    try:
        return build_recommendation(incident, resources, facilities)
    except Exception as e:
        log.exception("recommend failed: %s", e)
        return _empty(incident)


def recommend(db, incident: Any) -> dict:
    """Contract §5 entry point: shape = GET /api/incidents/{id}/recommendations. Never raises."""
    try:
        return recommend_from_snapshot(*snapshot(db, incident))
    except Exception as e:
        log.exception("recommend failed: %s", e)
        return _empty(incident)
