"""Incident classification: type, severity, priority, hazards, location. Owner: BE2.

Contract: docs/API_CONTRACT.md §5. `classify()` never raises — Gemini first,
keyword/rule fallback on any failure. Sensor readings are always rule-based.
"""
from __future__ import annotations

import logging
import re
from dataclasses import asdict, dataclass, field

from app.services import llm
from app.services.gazetteer import find_place

log = logging.getLogger("resqnet.classifier")

INCIDENT_TYPES = ["flood", "fire", "road_accident", "industrial", "medical", "building_collapse", "other"]
HAZARDS = [
    "trapped_people", "gas_leak", "fire_spread", "rising_water", "electrical",
    "structural", "injuries", "blocked_road", "chemical", "other",
]
# Any of these forces P1 regardless of severity (PRD FR-2).
CRITICAL_HAZARDS = {"trapped_people", "gas_leak", "fire_spread"}

TYPE_LABELS = {
    "flood": "Flooding", "fire": "Fire", "road_accident": "Road accident", "industrial": "Industrial incident",
    "medical": "Medical emergency", "building_collapse": "Building collapse", "other": "Emergency",
}


@dataclass
class ClassificationResult:
    type: str
    severity: int
    priority: str
    title: str
    location_text: str | None
    people_affected_est: int | None
    hazards: list[str] = field(default_factory=list)
    reasoning: str = ""
    confidence: float = 0.5
    lang: str = "en"
    source_model: str = "fallback"

    def to_dict(self) -> dict:
        return asdict(self)


# ---------------------------------------------------------------- helpers

def detect_lang(text: str | None) -> str:
    """Script-based language guess: Gujarati / Devanagari (Hindi) / English."""
    if not text:
        return "en"
    gu = len(re.findall(r"[઀-૿]", text))
    hi = len(re.findall(r"[ऀ-ॿ]", text))
    if gu == 0 and hi == 0:
        return "en"
    return "gu" if gu >= hi else "hi"


def priority_for(severity: int, hazards: list[str]) -> str:
    if severity >= 4 or CRITICAL_HAZARDS.intersection(hazards):
        return "P1"
    return {3: "P2", 2: "P3"}.get(severity, "P4")


def _clamp_sev(v) -> int:
    try:
        return max(1, min(5, int(round(float(v)))))
    except (TypeError, ValueError):
        return 3


def _make_title(type_: str, location: str | None, text: str | None) -> str:
    label = TYPE_LABELS.get(type_, "Emergency")
    if location:
        return f"{label} at {location}"[:60]
    if text:
        snippet = re.sub(r"\s+", " ", text).strip()
        return f"{label}: {snippet}"[:60]
    return label


# ---------------------------------------------------------------- fallback (rules)

# Keywords per type in English / Gujarati / Hindi (lowercase; substring match).
TYPE_KEYWORDS: dict[str, list[str]] = {
    "industrial": [
        "gas leak", "chemical", "factory", "gidc", "boiler", "toxic", "ammonia", "chlorine", "reactor", "plant explosion",
        "industrial", "fumes", "બોઈલર", "જીઆઈડીસી", "જીઆઇડીસી", "जीआईडीसी", "इंडस्ट्रियल", "क्लोरीन",
        "ગેસ લીક", "કેમિકલ", "ફેક્ટરી", "ગેસ ગળતર", "गैस रिसाव", "गैस लीक", "केमिकल", "फैक्ट्री", "रसायन",
    ],
    "building_collapse": [
        "collapse", "collapsed", "wall fell", "wall fall", "building fell", "roof fell", "debris", "under rubble",
        "cracks in", "big cracks", "tilting", "દરાર", "તિરાડ", "दरार",
        "ધરાશાયી", "દીવાલ પડી", "મકાન પડ્યું", "ઇમારત", "ढह", "दीवार गिर", "इमारत गिर", "मलबा",
    ],
    "fire": [
        "fire", "smoke", "burning", "flames", "blaze", "short circuit", "cylinder blast", "cylinder",
        "સિલિન્ડર", "सिलेंडर",
        "આગ", "ધુમાડો", "સળગ", "आग", "धुआं", "धुआँ", "जल रहा", "लपटें",
    ],
    "flood": [
        "flood", "water logging", "waterlogging", "waterlogged", "water level", "submerged", "underpass", "drowning",
        "heavy rain", "overflow", "boat", "knee deep", "waist deep", "open drain", "drain", "swept away",
        "ગટર", "નાળું", "नाला", "नाली",
        "પાણી", "પૂર", "ભરાયા", "ડૂબ", "વરસાદ", "बाढ़", "पानी", "जलभराव", "डूब", "बारिश",
    ],
    "road_accident": [
        "accident", "collision", "collided", "crash", "hit by", "hit a", "overturned", "truck", "bike", "car hit",
        "pile-up", "highway", "pedestrian", "બાઈક", "બાઇક", "સ્લિપ", "ટ્રક", "बाइक", "ट्रक",
        "અકસ્માત", "ટક્કર", "એક્સિડન્ટ", "दुर्घटना", "हादसा", "टक्कर", "एक्सीडेंट",
    ],
    "medical": [
        "heart attack", "unconscious", "breathing", "chest pain", "pregnant", "labour", "labor pain", "ambulance",
        "fainted", "stroke", "bleeding", "elderly", "patient",
        "બેભાન", "હાર્ટ એટેક", "દર્દી", "શ્વાસ", "બીમાર", "बेहोश", "दिल का दौरा", "मरीज", "सांस", "बीमार",
    ],
}
# Order matters when several match: the more specific / dangerous type wins.
TYPE_ORDER = ["industrial", "building_collapse", "fire", "road_accident", "medical", "flood"]

HAZARD_KEYWORDS: dict[str, list[str]] = {
    "trapped_people": [
        "trapped", "stuck", "stranded", "can't get out", "cannot get out", "inside", "under rubble", "rescue",
        "ફસાઈ", "ફસાયા", "ફસાયેલ", "દબાયા", "फंसे", "फँसे", "फंसा", "फँसा", "फंसी", "फँसी", "दबे",
        "can't see him", "can't see her", "missing", "swept", "family inside", "children trapped",
    ],
    "gas_leak": ["gas leak", "gas smell", "leaking gas", "ગેસ લીક", "ગેસ ગળતર", "गैस रिसाव", "गैस लीक"],
    "fire_spread": ["spreading", "spread to", "out of control", "whole building", "ફેલાઈ", "फैल"],
    "rising_water": ["rising", "increasing", "level", "overflow", "વધી રહ્યું", "વધે છે", "बढ़ रहा", "बढ़ रहा"],
    "electrical": ["electric", "current", "wire", "transformer", "shock", "કરંટ", "વાયર", "करंट", "तार"],
    "structural": ["crack", "collapse", "wall", "roof", "દીવાલ", "દિવાલ", "दीवार", "छत"],
    "injuries": [
        "injured", "injury", "bleeding", "hurt", "wounded", "fracture", "unconscious", "casualt",
        "ઘાયલ", "ઈજા", "ઇજા", "લોહી", "घायल", "चोट", "खून",
    ],
    "blocked_road": ["blocked", "jam", "road closed", "traffic", "tree fell", "રસ્તો બંધ", "ટ્રાફિક", "रास्ता बंद", "जाम"],
    "chemical": ["chemical", "toxic", "fumes", "acid", "ammonia", "chlorine", "કેમિકલ", "ઝેરી", "केमिकल", "जहरीली"],
}

BASE_SEVERITY = {
    "industrial": 3, "building_collapse": 4, "fire": 3, "road_accident": 3, "medical": 3, "flood": 2, "other": 2,
}

_NUM_PEOPLE = re.compile(
    r"(\d{1,4})\s*(?:\+\s*)?(?:people|persons|person|residents|families|kids|children|workers|passengers|લોકો|માણસ|लोग|व्यक्ति)",
    re.I,
)
_WORD_NUM = {"two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "ten": 10, "dozen": 12, "many": 10, "several": 5}


def _people_estimate(t: str) -> int | None:
    if m := _NUM_PEOPLE.search(t):
        return int(m.group(1))
    for w, n in _WORD_NUM.items():
        if re.search(rf"\b{w}\b\s+(people|persons|families|workers|children|kids)", t):
            return n
    return None


_EXPLOSION = ("explosion", "exploded", "blast", "ફાટ્યું", "ફાટ્યો", "વિસ્ફોટ", "फटा", "विस्फोट", "धमाका")
_MINOR = ("minor", "small scratch", "scratches", "slightly", "નાની ઈજા", "નાની ઇજા", "મામૂલી", "मामूली", "हल्की चोट")
_CONTAINED = ("already put out", "put out", "extinguished", "under control", "કાબૂમાં", "बुझ गई", "काबू में")

# Negated mentions ("nobody hurt", "કોઈ ઘાયલ નથી", "कोई घायल नहीं") must not count as hazards.
_NEGATED = re.compile(
    r"\b(?:no|nobody|no one|not|none|without|zero)\b[^.,;!?]{0,20}?"
    r"(?:hurt|injured|injury|injuries|trapped|stuck|casualt\w*|bleeding)"
    r"|(?:ઘાયલ|ઈજા|ઇજા|ફસાયેલ)[^.,;!?]{0,10}?નથી"
    r"|(?:घायल|चोट|फंसा|फँसा)[^.,;!?]{0,10}?नहीं",
)


def fallback_classify(text: str | None, lang_hint: str | None = None) -> ClassificationResult:
    t = _NEGATED.sub(" ", (text or "").lower())
    scores = {ty: sum(1 for kw in kws if kw in t) for ty, kws in TYPE_KEYWORDS.items()}
    best = max(scores.values()) if scores else 0
    if best == 0:
        type_ = "other"
    else:
        # highest score; ties broken by TYPE_ORDER (more dangerous first)
        type_ = min((ty for ty, s in scores.items() if s == best), key=TYPE_ORDER.index)

    hazards = [hz for hz, kws in HAZARD_KEYWORDS.items() if any(kw in t for kw in kws)]
    if type_ == "industrial" and "chemical" not in hazards and any(k in t for k in ("chemical", "toxic", "કેમિકલ", "केमिकल")):
        hazards.append("chemical")
    if type_ != "flood" and "rising_water" in hazards:
        hazards.remove("rising_water")  # "rising" alone is only meaningful for water

    sev = BASE_SEVERITY[type_]
    if "trapped_people" in hazards or "gas_leak" in hazards:
        sev += 2
    elif "injuries" in hazards or "fire_spread" in hazards or ("chemical" in hazards and type_ != "industrial"):
        sev += 1
    if any(k in t for k in _EXPLOSION):
        sev += 1
    if any(k in t for k in _CONTAINED):
        sev -= 2
    elif any(k in t for k in _MINOR):
        sev -= 2
    if "rising_water" in hazards and type_ == "flood" and sev < 4:
        sev += 1
    people = _people_estimate(t)
    if people and people >= 10:
        sev += 1
    sev = _clamp_sev(sev)

    location = find_place(text)
    return ClassificationResult(
        type=type_,
        severity=sev,
        priority=priority_for(sev, hazards),
        title=_make_title(type_, location, text),
        location_text=location,
        people_affected_est=people,
        hazards=hazards,
        reasoning=f"Rule-based: matched {best} '{type_}' keyword(s)"
        + (f"; hazards: {', '.join(hazards)}" if hazards else "")
        + ".",
        confidence=round(min(0.75, 0.35 + 0.1 * best), 2) if best else 0.2,
        lang=lang_hint or detect_lang(text),
        source_model="fallback",
    )


# ---------------------------------------------------------------- sensors (rules only)

SENSOR_TYPES = {
    "water_level_m": "flood", "rainfall_mm_hr": "flood",
    "smoke_ppm": "fire", "temperature_c": "fire",
    "gas_ppm": "industrial", "ammonia_ppm": "industrial", "chlorine_ppm": "industrial",
}


def classify_sensor(sensor: dict) -> ClassificationResult:
    metric = str(sensor.get("metric", ""))
    type_ = SENSOR_TYPES.get(metric, "other")
    try:
        value = float(sensor.get("value"))
        threshold = float(sensor.get("threshold"))
        ratio = value / threshold if threshold else 1.0
    except (TypeError, ValueError):
        value, threshold, ratio = None, None, 1.0

    if ratio < 1.0:
        sev = 1
    elif ratio < 1.1:
        sev = 3
    elif ratio < 1.25:
        sev = 4
    else:
        sev = 5
    hazards = {"flood": ["rising_water"], "industrial": ["gas_leak", "chemical"], "fire": ["fire_spread"]}.get(type_, [])
    if ratio < 1.0:
        hazards = []
    sid = sensor.get("sensor_id", "sensor")
    unit = sensor.get("unit", "")
    location = find_place(str(sid).replace("-", " ")) or find_place(sensor.get("location"))
    reading = f"{metric}={value}{unit} vs threshold {threshold}{unit}" if value is not None else metric
    return ClassificationResult(
        type=type_,
        severity=sev,
        priority=priority_for(sev, hazards) if ratio >= 1.0 else "P4",
        title=_make_title(type_, location, f"Sensor {sid} alarm"),
        location_text=location,
        people_affected_est=None,
        hazards=hazards,
        reasoning=f"Sensor {sid}: {reading} (x{ratio:.2f} of threshold).",
        confidence=0.95 if value is not None else 0.5,
        lang="en",
        source_model="rules",
    )


# ---------------------------------------------------------------- Gemini

SYSTEM_PROMPT = """You are the triage engine of an emergency control room in Ahmedabad, Gujarat, India.
You receive ONE raw emergency report (citizen message, 108/112 call transcript, or field-team update).
Reports may be in English, Gujarati (ગુજરાતી), Hindi (हिंदी) or mixed. Classify it.

Rules:
- type: flood | fire | road_accident | industrial | medical | building_collapse | other
  (industrial = gas leak / chemical / factory accident; flood includes waterlogging and people stuck in water)
- severity 1-5: 1 minor/no danger, 2 limited property risk, 3 risk to people or several affected,
  4 life-threatening / people trapped / spreading, 5 mass-casualty or city-scale threat.
- hazards: choose only from the allowed list; include trapped_people whenever anyone is stuck/stranded/under debris.
- title: short English headline, max 60 characters, include the place if known.
- location_text: the place/landmark mentioned (transliterate to English, e.g. "Akhbarnagar underpass"), else null.
- people_affected_est: integer estimate if the report implies it, else null.
- reasoning: one English sentence explaining type and severity.
- confidence: 0-1, lower if the report is vague.
- lang: language of the report: en | gu | hi.
Do not invent facts that are not in the report."""

FEW_SHOT = """Examples:
Report (citizen): "અખબારનગર અંડરપાસમાં ગાડી ફસાઈ છે, અંદર ત્રણ લોકો છે, પાણી વધી રહ્યું છે"
-> {"type":"flood","severity":4,"hazards":["trapped_people","rising_water"],"title":"Car with 3 trapped in flooded Akhbarnagar underpass","location_text":"Akhbarnagar underpass","people_affected_est":3,"reasoning":"Vehicle with occupants trapped in rising floodwater is life-threatening.","confidence":0.93,"lang":"gu"}

Report (call): "वटवा जीआईडीसी की फैक्ट्री में गैस रिसाव हुआ है, मजदूरों को सांस लेने में तकलीफ है"
-> {"type":"industrial","severity":5,"hazards":["gas_leak","chemical","injuries"],"title":"Gas leak at Vatva GIDC factory, workers affected","location_text":"Vatva GIDC","people_affected_est":10,"reasoning":"Toxic gas leak with workers already having breathing problems risks mass casualties.","confidence":0.9,"lang":"hi"}

Report (citizen): "Small branch fell on the road near Paldi, one lane blocked, nobody hurt"
-> {"type":"other","severity":1,"hazards":["blocked_road"],"title":"Fallen branch blocking lane in Paldi","location_text":"Paldi","people_affected_est":0,"reasoning":"Minor obstruction with no injuries.","confidence":0.85,"lang":"en"}

Report (call): "Two bikes collided on SG Highway near Thaltej, one person bleeding badly and unconscious"
-> {"type":"road_accident","severity":4,"hazards":["injuries","blocked_road"],"title":"Bike collision on SG Highway, rider unconscious","location_text":"Thaltej, SG Highway","people_affected_est":2,"reasoning":"Unconscious, heavily bleeding victim needs urgent medical care.","confidence":0.9,"lang":"en"}"""

RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "type": {"type": "string", "enum": INCIDENT_TYPES},
        "severity": {"type": "integer", "minimum": 1, "maximum": 5},
        "hazards": {"type": "array", "items": {"type": "string", "enum": HAZARDS}},
        "title": {"type": "string"},
        "location_text": {"type": ["string", "null"]},
        "people_affected_est": {"type": ["integer", "null"]},
        "reasoning": {"type": "string"},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        "lang": {"type": "string", "enum": ["en", "gu", "hi"]},
    },
    "required": ["type", "severity", "hazards", "title", "location_text", "reasoning", "confidence", "lang"],
}


def _gemini_classify(text: str, source: str, lang_hint: str | None) -> ClassificationResult | None:
    prompt = f'{FEW_SHOT}\n\nNow classify this report ({source}):\n"{text}"'
    data = llm.generate_json(prompt, RESPONSE_SCHEMA, system=SYSTEM_PROMPT)
    if not isinstance(data, dict):
        return None
    try:
        type_ = data.get("type") if data.get("type") in INCIDENT_TYPES else "other"
        sev = _clamp_sev(data.get("severity"))
        hazards = [h for h in (data.get("hazards") or []) if h in HAZARDS]
        location = data.get("location_text") or find_place(text)
        people = data.get("people_affected_est")
        return ClassificationResult(
            type=type_,
            severity=sev,
            priority=priority_for(sev, hazards),
            title=(data.get("title") or _make_title(type_, location, text))[:60],
            location_text=location,
            people_affected_est=int(people) if isinstance(people, (int, float)) else None,
            hazards=hazards,
            reasoning=str(data.get("reasoning") or ""),
            confidence=round(max(0.0, min(1.0, float(data.get("confidence", 0.7)))), 2),
            lang=data.get("lang") if data.get("lang") in ("en", "gu", "hi") else (lang_hint or detect_lang(text)),
            source_model="gemini",
        )
    except Exception as e:  # malformed model output
        log.warning("Bad Gemini classification payload %r: %s", data, e)
        return None


# ---------------------------------------------------------------- public API

def classify(
    text: str | None,
    source: str,
    sensor: dict | None = None,
    lang_hint: str | None = None,
) -> ClassificationResult:
    """Classify one report. Never raises."""
    try:
        if source == "sensor" and sensor:
            return classify_sensor(sensor)
        if not text or not text.strip():
            return fallback_classify(text, lang_hint)
        return _gemini_classify(text.strip(), source, lang_hint) or fallback_classify(text, lang_hint)
    except Exception as e:  # last-resort guard — the pipeline must never break
        log.exception("classify() failed: %s", e)
        return ClassificationResult(
            type="other", severity=3, priority="P2", title=_make_title("other", None, text),
            location_text=None, people_affected_est=None, hazards=[],
            reasoning="Classification error; defaulted to P2 for human review.", confidence=0.1,
            lang=lang_hint or detect_lang(text), source_model="fallback",
        )
