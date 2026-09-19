# ResQNet — API Contract

**Source of truth** for backend ↔ frontend and BE1 ↔ BE2.
Mirrors: `backend/app/schemas.py` (Pydantic) · `frontend/src/types/index.ts` (TypeScript).
**Changing anything here?** Update all three files in the same PR and post in the group.

---

## 0. Conventions

| Item | Rule |
|---|---|
| Base URL | local `http://localhost:8000` · prod: Render URL (in `NEXT_PUBLIC_API_URL`) |
| Prefix | all REST endpoints under `/api` (except `/health`, `/ws`) |
| Format | JSON, `Content-Type: application/json`, field names `snake_case` |
| IDs | integers. Incidents also have a human code `INC-0001` |
| Time | ISO-8601 UTC strings, e.g. `"2026-09-19T08:42:10Z"` |
| Coordinates | `lat`, `lng` as decimal degrees (WGS84) |
| Nulls | optional fields are present with `null`, never omitted |
| Errors | `{"detail": "message"}` with 400 / 404 / 409 / 422 / 500 (FastAPI default) |
| Auth | none (demo). Actor for audit = `X-Actor` header, default `"dispatcher"` |
| Lists | no pagination; newest first unless stated |

---

## 1. Enums

```ts
type IncidentType   = "flood" | "fire" | "road_accident" | "industrial" | "medical" | "building_collapse" | "other";
type IncidentStatus = "new" | "triaged" | "dispatched" | "on_scene" | "resolved" | "escalated";
type Priority       = "P1" | "P2" | "P3" | "P4";
type Severity       = 1 | 2 | 3 | 4 | 5;
type ReportSource   = "citizen" | "call" | "sensor" | "field";
type Lang           = "en" | "gu" | "hi";
type ResourceKind   = "ambulance" | "fire_truck" | "rescue_boat" | "police" | "ndrf_team" | "hazmat";
type ResourceStatus = "available" | "assigned" | "busy" | "offline";
type FacilityKind   = "hospital" | "shelter" | "fire_station";
type AssignmentStatus = "assigned" | "en_route" | "on_scene" | "completed" | "cancelled";
type AlertKind      = "critical" | "sla_breach" | "escalation" | "shortage";
type Hazard         = "trapped_people" | "gas_leak" | "fire_spread" | "rising_water" | "electrical"
                    | "structural" | "injuries" | "blocked_road" | "chemical" | "other";
```

Severity colours (FE): `1 #22c55e · 2 #eab308 · 3 #f97316 · 4 #dc2626 · 5 #7f1d1d`

Capability map (which kinds an incident type needs — used by recommender):

| Incident type | Needed kinds (in order) |
|---|---|
| flood | rescue_boat, ndrf_team, ambulance |
| fire | fire_truck, ambulance |
| road_accident | ambulance, police |
| industrial | hazmat, fire_truck, ambulance |
| medical | ambulance |
| building_collapse | ndrf_team, fire_truck, ambulance |
| other | police |

---

## 2. Objects

### Report
```json
{
  "id": 42,
  "source": "citizen",
  "text": "અખબારનગર અંડરપાસમાં ગાડી ફસાઈ છે, પાણી વધી રહ્યું છે",
  "lang": "gu",
  "lat": 23.0496,
  "lng": 72.5621,
  "address": "Akhbarnagar Underpass, Ahmedabad",
  "photo_url": null,
  "reporter": "Citizen app",
  "sensor": null,
  "incident_id": 7,
  "created_at": "2026-09-19T08:42:10Z"
}
```
`sensor` (only when `source = "sensor"`):
```json
{ "sensor_id": "VASNA-WL-01", "metric": "water_level_m", "value": 4.9, "threshold": 4.2, "unit": "m" }
```

### Incident (list item)
```json
{
  "id": 7,
  "code": "INC-0007",
  "type": "flood",
  "severity": 4,
  "priority": "P1",
  "status": "new",
  "title": "Car trapped in flooded Akhbarnagar underpass",
  "lat": 23.0496,
  "lng": 72.5621,
  "address": "Akhbarnagar Underpass, Ahmedabad",
  "ai_summary": "A car with occupants is trapped in the Akhbarnagar underpass as water levels rise. 7 reports from citizens and 108 calls confirm. Immediate water rescue needed.",
  "ai_reasoning": "Multiple reports mention a trapped vehicle and rising water in an underpass; trapped people → P1.",
  "ai_actions": ["Send rescue boat and NDRF team", "Close underpass to traffic", "Keep ambulance on standby at exit"],
  "confidence": 0.92,
  "hazards": ["trapped_people", "rising_water"],
  "people_affected_est": 3,
  "report_count": 7,
  "created_at": "2026-09-19T08:42:10Z",
  "updated_at": "2026-09-19T08:45:02Z",
  "dispatched_at": null,
  "resolved_at": null
}
```

### IncidentDetail = Incident + relations
```json
{
  "...all Incident fields": "...",
  "reports": [ /* Report[] oldest first */ ],
  "assignments": [ /* Assignment[] with nested resource */ ],
  "alerts": [ /* Alert[] */ ]
}
```

### Resource
```json
{
  "id": 3,
  "callsign": "NDRF-BOAT-02",
  "kind": "rescue_boat",
  "status": "available",
  "lat": 23.0300,
  "lng": 72.5770,
  "base": "Sabarmati Riverfront Post",
  "phone": null,
  "current_incident_id": null
}
```

### Facility
```json
{
  "id": 1,
  "name": "Civil Hospital, Asarwa",
  "kind": "hospital",
  "lat": 23.0536,
  "lng": 72.6037,
  "beds_total": 120,
  "beds_available": 34,
  "specialties": ["trauma", "burns", "general"]
}
```
`beds_*` are `null` for fire stations.

### Assignment
```json
{
  "id": 11,
  "incident_id": 7,
  "resource_id": 3,
  "resource": { /* Resource */ },
  "status": "en_route",
  "eta_min": 9,
  "approved_by": "dispatcher",
  "created_at": "2026-09-19T08:46:00Z",
  "updated_at": "2026-09-19T08:47:30Z"
}
```

### Recommendation
```json
{
  "resource": { /* Resource */ },
  "kind": "rescue_boat",
  "distance_km": 2.4,
  "eta_min": 9,
  "score": 0.87,
  "reason": "Closest available boat; 9 min via river channel."
}
```

### Alert
```json
{
  "id": 5,
  "incident_id": 9,
  "incident_code": "INC-0009",
  "kind": "sla_breach",
  "message": "P1 industrial incident INC-0009 (Vatva GIDC gas leak) not dispatched for 2 min",
  "acknowledged": false,
  "created_at": "2026-09-19T08:50:00Z"
}
```

---

## 3. REST endpoints

### Health
`GET /health` → `200 {"status": "ok", "ai": true, "db": true}` · Owner BE1

---

### Reports — Owner BE1 (pipeline calls BE2 services)

#### `POST /api/reports`
Request:
```json
{
  "source": "citizen",
  "text": "Car stuck in Akhbarnagar underpass, water rising fast!",
  "lang": null,
  "lat": 23.0496,
  "lng": 72.5621,
  "address": null,
  "photo_url": null,
  "reporter": "Citizen app",
  "sensor": null
}
```
- `text` required unless `source = "sensor"` (then `sensor` required)
- `photo_url` (optional): a `data:image/jpeg|png|webp;base64,...` URL (≤ 6 MB — FE should downscale to ~1280 px) or a public `https://` image URL. Analysed by Gemini Vision in parallel; a relevant photo can raise severity by +1
- `lat/lng` optional — if missing, BE2 extracts `location_text` and BE1 geocodes against a small Ahmedabad gazetteer (fallback: city centre + flag low confidence)

Pipeline: save → `classify()` → `find_match()` → create or merge incident → `summarize_incident()` → broadcast WS → respond.

Response `201`:
```json
{
  "report": { /* Report */ },
  "incident": { /* Incident */ },
  "merged": true,
  "classification": {
    "type": "flood", "severity": 4, "priority": "P1", "title": "...",
    "location_text": "Akhbarnagar underpass", "people_affected_est": 3,
    "hazards": ["trapped_people", "rising_water"],
    "reasoning": "...", "confidence": 0.92, "lang": "en", "source_model": "gemini"
  }
}
```
`source_model` is `"openai"`, `"gemini"`, `"fallback"` (keyword rules) or `"rules"` (sensor); `classification.model` is e.g. `"openai:gpt-4.1-mini"` (prefixed `cache:` when served from the AI cache).
`classification.photo` is `null` or `{ "relevant": bool, "type": ..., "severity_hint": 1-5, "hazards": [...], "description": "...", "confidence": 0-1 }`.
Reports without GPS are geocoded from the text (Ahmedabad gazetteer); if that fails the incident is placed at the city centre with `confidence <= 0.4` — FE should show "location unverified".

#### `GET /api/reports?incident_id=7` → `Report[]`

---

### Incidents — Owner BE1

#### `GET /api/incidents`
Query (all optional): `status` (comma list, default = all except `resolved`), `type`, `min_severity`, `include_resolved=true`
→ `Incident[]` sorted by priority (P1 first), then `created_at` oldest first.

#### `GET /api/incidents/{id}` → `IncidentDetail` · 404 if missing

#### `PATCH /api/incidents/{id}`
```json
{ "status": "escalated", "note": "No boat available, escalating to district collector" }
```
All fields optional: `status`, `severity`, `priority`, `note`.
Setting `status: "escalated"` creates an `escalation` alert and sends Telegram.
→ `IncidentDetail`

#### `POST /api/incidents/{id}/unmerge` *(Should)*
`{ "report_id": 44 }` → moves report into a new incident → `{ "old": Incident, "new": Incident }`

---

### AI — Owner BE2 (file: `backend/app/routers/ai.py`)

#### `GET /api/incidents/{id}/recommendations`
→
```json
{
  "incident_id": 7,
  "needed_kinds": ["rescue_boat", "ndrf_team", "ambulance"],
  "recommendations": {
    "rescue_boat": [ /* Recommendation[] top 3 */ ],
    "ndrf_team":   [ /* ... */ ],
    "ambulance":   [ /* ... */ ]
  },
  "suggested_resource_ids": [3, 14, 21],
  "facility": {
    "facility": { /* Facility */ },
    "distance_km": 3.1,
    "reason": "Nearest hospital with trauma beds available (34)."
  },
  "shortages": []
}
```
`suggested_resource_ids` = best one per needed kind (FE pre-ticks these).
`shortages` = kinds with zero available units, e.g. `["hazmat"]`.

#### `POST /api/incidents/{id}/summarize`
Forces a re-summary → `{ "ai_summary": "...", "ai_actions": ["..."] }`

#### `GET /api/incidents/{id}/trust`
How well supported an incident is (independent of severity) — matches FE2 `IncidentTrust`:
```json
{
  "incident_id": 7,
  "verification": "conflicting",
  "sources": { "reports": 4, "unique_sources": 3, "citizen": 2, "call": 1, "sensor": 0, "field": 1 },
  "duplicate_state": "review_required",
  "sensor_corroboration": { "sensor_id": "VASNA-WL-01", "detail": "water_level_m 4.9m against a 4.2m threshold." },
  "conflicts": [
    { "field": "people_affected",
      "claims": [ { "value": "3 people", "source": "citizen", "report_id": 41, "at": "2026-09-19T08:42:10Z" },
                  { "value": "12 people", "source": "call", "report_id": 44, "at": "2026-09-19T08:44:02Z" } ] }
  ]
}
```
- `verification`: `conflicting` (any conflict) > `verified` (a field report) > `corroborated` (≥ 2 distinct reporters or a sensor over threshold) > `unverified`
- `conflicts[].field`: `people_affected` (≥ 2× and ≥ 3 apart) · `severity` (≥ 2 apart) · `type` · `situation` ("contained" vs "worsening")
- `duplicate_state`: `review_required` (type/situation conflict) · `possible_duplicate` (same reporter repeated) · `matched`

#### `GET /api/ai/status`
→ `{ "ai_enabled": true, "providers": ["openai", "gemini"], "generation_available": true, "embeddings_available": true, "models": { "openai:gpt-4.1-mini": { "calls_last_min": 3, "benched_for_sec": 0, "provider_cooling_sec": 0 } }, "embed_providers": ["gemini:gemini-embedding-001", "openai:text-embedding-3-small"], "openai_spent_usd": 0.05, "openai_budget_usd": 8.0, "openai_over_budget": false, "disk_cache": true }`
Debug/demo helper: if every model is benched, the system is running on rule-based fallback.

#### `POST /api/ai/sitrep`
Request `{}` → `{ "generated_at": "...", "markdown": "## Situation Report\n..." , "active_count": 9 }`

---

### Dispatch — Owner BE1

#### `POST /api/incidents/{id}/dispatch`
```json
{ "resource_ids": [3, 14, 21], "facility_id": 1, "approved_by": "dispatcher" }
```
- 409 if any resource is not `available`
- Creates `Assignment` per resource (status `assigned`, `eta_min` from `geo.eta_minutes`), resources → `assigned`, incident → `dispatched`, `dispatched_at` set, audit log, Telegram to responder chat, WS `assignment.updated` + `incident.updated`
→ `IncidentDetail`

#### `PATCH /api/assignments/{id}`
`{ "status": "on_scene" }` (order: assigned → en_route → on_scene → completed; `cancelled` any time)
- first `on_scene` → incident `on_scene`
- all assignments `completed` → incident `resolved`, `resolved_at` set, resources → `available`
→ `Assignment`

#### `GET /api/assignments?resource_id=3&active=true` → `Assignment[]` (used by `/field`)

---

### Resources & Facilities — Owner BE1

- `GET /api/resources?kind=ambulance&status=available` → `Resource[]`
- `PATCH /api/resources/{id}` `{ "status": "offline" }` → `Resource`
- `GET /api/facilities?kind=hospital` → `Facility[]`

---

### Alerts — Owner BE1

- `GET /api/alerts?acknowledged=false` → `Alert[]` newest first
- `POST /api/alerts/{id}/ack` → `Alert`

---

### Analytics — Owner BE2 (file: `backend/app/routers/analytics.py`)

All accept optional `?since=<ISO time>` (default: all data).

#### `GET /api/analytics/summary`
```json
{
  "active_incidents": 9, "p1_open": 2, "resolved_today": 4, "total_reports": 31,
  "duplicates_merged": 14, "units_available": 17, "units_total": 25,
  "avg_time_to_dispatch_sec": 94, "avg_time_to_scene_sec": 610
}
```

#### `GET /api/analytics/by-type`
```json
[ { "type": "flood", "count": 5, "by_severity": { "1": 0, "2": 1, "3": 1, "4": 2, "5": 1 } } ]
```

#### `GET /api/analytics/response-times`
```json
{
  "buckets": [ { "label": "0-1 min", "count": 3 }, { "label": "1-2 min", "count": 4 }, { "label": "2-5 min", "count": 2 }, { "label": "5+ min", "count": 1 } ],
  "by_type": [ { "type": "fire", "avg_dispatch_sec": 70, "avg_scene_sec": 540 } ],
  "timeline": [ { "t": "2026-09-19T08:40:00Z", "incidents": 3, "reports": 7 } ]
}
```
`timeline` is bucketed per minute (demo) — good for a line chart.

#### `GET /api/analytics/shortages`
```json
[ { "kind": "rescue_boat", "shortage_alerts": 3, "available": 0, "total": 4 } ]
```

#### `GET /api/analytics/hotspots`
```json
[ { "lat": 23.0475, "lng": 72.5650, "count": 9, "top_type": "flood" } ]
```
Grid ≈ 500 m (round lat/lng to 0.0045°). FE renders as MapLibre heatmap.

#### `GET /api/analytics/insights`
Data-derived observations, most urgent first — matches FE2 `OperationalInsight[]`. No LLM; `evidence` has the numbers.
```json
[ { "id": "sla_breach:INC-0009", "kind": "sla_breach", "severity": "critical",
    "headline": "INC-0009 (P1 industrial) waiting 4m 10s for dispatch",
    "detail": "Gas leak at Vatva GIDC has no unit assigned. Dispatch or escalate now.",
    "evidence": "created 08:46:00 UTC; P1 dispatch SLA 120s; waited 250s" } ]
```
`kind`: `sla_breach` · `shortage` (primary need of undispatched incidents > available units) · `coverage` (nearest suitable unit ETA > 20 min; 35 for boats/NDRF) · `conflict` · `trend` (≥ 3 reports and ≥ 2× the previous 10 min).

#### `GET /api/analytics/eval`
Returns the last `scripts/eval.py` result (saved to `app/data/eval_results.json`):
```json
{ "n": 50, "type_accuracy": 0.94, "severity_within_1": 0.9, "dedup_precision": 0.9, "dedup_recall": 0.86, "avg_latency_ms": 1180, "run_at": "..." }
```

---

### Simulator — Owner BE1

- `POST /api/simulator/start` `{ "scenario": "ahmedabad_flood", "speed": 1.0 }` → `{ "running": true, "events_total": 30 }`
- `POST /api/simulator/stop` → `{ "running": false }`
- `POST /api/simulator/reset` → wipes reports/incidents/assignments/alerts, reseeds resources → `{ "ok": true }`
- `GET /api/simulator/status` → `{ "running": true, "events_sent": 12, "events_total": 30 }`

---

## 4. WebSocket — Owner BE1

`WS /ws` · server → client only. Every message:
```json
{ "event": "incident.created", "data": { ... }, "ts": "2026-09-19T08:42:11Z" }
```

| event | data | when |
|---|---|---|
| `report.created` | `Report` | every accepted report |
| `incident.created` | `Incident` | new incident |
| `incident.updated` | `Incident` | any field / status change, re-summary |
| `incident.merged` | `{ "incident": Incident, "report": Report }` | report merged into existing incident |
| `assignment.updated` | `Assignment` | created or status change |
| `resource.updated` | `Resource` | status change |
| `alert.created` | `Alert` | new alert |
| `simulator.status` | `{ running, events_sent, events_total }` | every simulator event |

Client should reconnect with backoff (1 s → 5 s) and refetch `/api/incidents` after reconnect.

---

## 5. Internal Python contract (BE1 ↔ BE2)

BE1's pipeline and routers import these. **BE2 pushes stubs with these exact signatures by Sat 13:00**, then fills them in.

```python
# app/services/classifier.py
@dataclass
class ClassificationResult:
    type: str                 # IncidentType
    severity: int             # 1..5
    priority: str             # "P1".."P4" (deterministic rule applied)
    title: str                # <= 60 chars, English
    location_text: str | None
    people_affected_est: int | None
    hazards: list[str]
    reasoning: str
    confidence: float         # 0..1
    lang: str                 # "en" | "gu" | "hi"
    source_model: str         # "gemini" | "fallback"

def classify(text: str | None, source: str, sensor: dict | None = None,
             lang_hint: str | None = None) -> ClassificationResult: ...

# app/services/dedup.py
def embed(text: str) -> list[float] | None: ...          # None if unavailable
def find_match(db: Session, report: Report, cls: ClassificationResult) -> Incident | None: ...

# app/services/recommender.py
def recommend(db: Session, incident: Incident) -> dict: ...   # shape = GET /recommendations response

# app/services/summarizer.py
def summarize_incident(incident: Incident, reports: list[Report]) -> dict: ...
    # -> {"summary": str, "actions": list[str]}
def sitrep(incidents: list[Incident]) -> str: ...             # markdown

# app/services/triage.py  (BE2 — one call for the whole AI part of POST /api/reports; recipe in its docstring)
def triage(db: Session, report: Report) -> TriageResult: ...  # .classification .match .lat .lng .address .geocoded .approximate
def apply_to_incident(incident: Incident, cls: ClassificationResult, is_new: bool) -> Incident: ...
def refresh_summary(incident: Incident, force: bool = False) -> dict: ...

# app/services/geo.py  (BE1 — BE2 uses)
def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float: ...
def eta_minutes(distance_km: float, kind: str) -> int: ...
```

Rules:
- Services **never raise** to the pipeline — on any error return a fallback result.
- Services **don't commit** the DB session and don't broadcast; BE1's router does.
- Any LLM call has a 12 s timeout, one retry on 5xx, then the next model, then the next provider (OpenAI → Gemini), then rules.

---

## 6. Change log
| Date | Change | By |
|---|---|---|
| 2026-09-19 | v1 | team |
| 2026-09-19 | `photo_url` formats, `classification.photo`, geocoding note, `GET /api/ai/status`, `triage.py` internal API | BE2 |
| 2026-09-19 | OpenAI primary provider: `source_model` values, `classification.model`, `/api/ai/status` shape | BE2 |
| 2026-09-19 | `GET /api/incidents/{id}/trust`, `GET /api/analytics/insights`; hotspot `top_type` never null | BE2 |
