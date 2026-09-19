# ResQNet — Product Requirements Document

**Hackathon:** Bit N Build'26 · Gujarat Round · **PS-9: Intelligent Emergency Response & Resource Coordination Platform**
**Team:** 4 members (BE1, BE2, FE1, FE2) · **Deadline:** 20 Sep 2026, 4:00 PM
**Status:** v1.0 (build spec) · **Owner of this doc:** whole team — change it via PR

---

## 1. One-liner

> **ResQNet turns chaotic, multi-source emergency reports into a single live picture — AI classifies, de-duplicates and prioritises every incident, recommends the right team and vehicle, and escalates anything that is slipping — so a control room can respond in minutes, not hours.**

## 2. Problem

During floods, fires, industrial accidents and major road incidents, information reaches authorities from **disconnected sources**: 108/112 calls, citizen messages, IoT sensors (rain/flood gauges, smoke detectors), field teams, hospitals and departments.

Today this causes:
- **Duplicate work** — 15 people report the same waterlogged underpass; 15 tickets are created.
- **Wrong priorities** — a critical industrial gas leak sits behind minor reports in a FIFO queue.
- **Slow / wrong dispatch** — dispatchers manually search which ambulance/boat is free and nearest.
- **No situational picture** — no single live map of what is happening, who is assigned, what is delayed.
- **No learning** — nobody can say which areas flood every year or where resources ran short.

Gujarat context: annual monsoon flooding (Ahmedabad, Surat, Vadodara), chemical/industrial belts (Vatva, Naroda, Ankleshwar, Dahej), cyclones on the coast, dense highway traffic. Reports arrive in **Gujarati, Hindi and English**.

## 3. Users & personas

| Persona | Who | Needs | Where in ResQNet |
|---|---|---|---|
| **Control-room dispatcher** (primary) | Operator at city Emergency Operations Centre | One live queue sorted by true priority; know what to send and approve fast | `/dashboard` |
| **Citizen reporter** | Anyone affected / witness | Report in 20 seconds, in own language, with photo + location | `/report` |
| **Field responder** | Ambulance / fire / NDRF crew lead | See own assignment, navigate, update status in one tap | `/field` |
| **Supervisor / authority** | Municipal commissioner, district collector | Escalations, shortages, overall picture, post-event analytics | `/dashboard`, `/analytics` |

## 4. Goals & success metrics

| Goal | Metric (demo target) |
|---|---|
| Faster triage | Report → classified incident on map in **< 5 s** |
| Less noise | Duplicate reports merged with **≥ 85 % precision** on eval set |
| Correct priority | Incident-type classification **≥ 90 % accuracy**, severity within ±1 on eval set |
| Faster dispatch | Recommended unit + ETA shown instantly; dispatch in **1 click** |
| Nothing slips | Every critical incident unassigned > 2 min (demo SLA) triggers an alert + escalation |
| Insight | Analytics answers: what types, where, response delays, which resources ran short |

(Numbers come from `backend/scripts/eval.py` — quote the real ones in the pitch.)

## 5. Scope

### Must have (MVP — demo breaks without these)
1. Multi-source ingestion: citizen form, simulated call transcript, simulated sensor, field update → one `Report` shape
2. AI classification: type, severity (1–5), priority (P1–P4), location extraction, reasoning + confidence
3. Duplicate detection & merge into one `Incident` with linked reports
4. Resource recommendation (team + vehicle + nearest facility) with ETA and reason
5. Human-approved dispatch + assignment status lifecycle
6. Live dashboard: map, active incidents, severity, assigned teams, response status (WebSocket)
7. Alerts & escalation: critical incidents, SLA breach (delayed response), manual escalate
8. Scenario simulator: "Ahmedabad Monsoon Flood" — deterministic, one button

### Should have
9. AI incident summary + recommended actions for responders
10. Analytics page: by type, response delays, resource shortages, hotspot map
11. Telegram notifications to responders/authorities (live phone buzz in demo)
12. Field responder mobile view
13. Multilingual reports (Gujarati / Hindi / English) — auto-detected, summarised in English

### Could have (only if ahead of schedule)
14. Photo-based severity hint (Gemini Vision)
15. Voice reporting (browser Web Speech API)
16. Road routing ETA via OSRM instead of straight-line estimate
17. Hospital bed capacity auto-decrement on patient dispatch

### Out of scope
Real 108/112 telephony integration, authentication/RBAC beyond a role switcher, production-grade security, native mobile apps.

## 6. Functional requirements (mapped to PS-9 deliverables)

### FR-1 Incident Collection
- `POST /api/reports` accepts `{source, text, lang?, lat?, lng?, address?, photo_url?, reporter?, sensor?}`
- Sources: `citizen`, `call` (transcript text), `sensor` (reading + threshold), `field`
- Every report is stored raw (never lost), then processed by the pipeline
- Citizen form: text, photo upload, "use my location" or drop pin on map, language picker, optional voice

### FR-2 Incident Classification (AI)
- Output (strict JSON): `type ∈ {flood, fire, road_accident, industrial, medical, building_collapse, other}`, `severity 1-5`, `priority P1-P4`, `location_text`, `people_affected_est`, `hazards[]`, `reasoning`, `confidence 0-1`, `lang`
- Model: Gemini (`gemini-2.5-flash`) with JSON schema response; temperature 0
- Fallback: keyword + rule classifier if API fails/rate-limited — the pipeline must never block
- Sensor reports: rule-based (e.g. water level > danger mark → flood, severity by margin)
- Priority rule: P1 = severity ≥ 4 **or** hazards include `trapped_people|gas_leak|fire_spread`; P2 = severity 3; P3 = 2; P4 = 1

### FR-3 Duplicate Detection
A new report is merged into an existing **open** incident when **all** hold:
- same `type` (or one is `other`)
- distance ≤ **300 m** (haversine; 1 km for floods — they cover areas)
- time gap ≤ **30 min** from incident's last report
- text similarity: embedding cosine ≥ **0.80** (Gemini `text-embedding-004`) — or, if embeddings unavailable, the first three rules alone

On merge: append report, bump `report_count`, recompute severity = max(existing, new), re-summarise, broadcast `incident.merged`. Dispatcher can **unmerge** (Should).

### FR-4 Resource Recommendation
- Candidate resources: `status = available` and capability matches incident type
  (flood → rescue_boat, ndrf_team, ambulance · fire → fire_truck, ambulance · road_accident → ambulance, police · industrial → fire_truck, hazmat, ambulance · medical → ambulance · building_collapse → ndrf_team, fire_truck, ambulance)
- Score = `0.5·capability_fit + 0.35·(1 − eta/eta_max) + 0.15·load_balance`
- ETA = haversine distance / average speed per kind (ambulance 35 km/h city, boat 10 km/h, etc.) — OSRM optional
- Also recommend nearest **facility** with free beds (hospital) or shelter (flood)
- LLM writes a one-line rationale per recommendation
- Returns top 3 per required kind; dispatcher approves → assignment created

### FR-5 Real-Time Monitoring
- Dashboard map: incidents coloured by severity (1 green → 5 dark red), pulsing if P1 & unassigned, resource markers by kind
- Queue: sort by priority then age; filters by type/status/severity
- Detail drawer: linked reports (with source icons), AI summary, reasoning, confidence, recommended units, assignments timeline
- KPI header: active incidents, P1 open, units available/total, avg response time
- All updates pushed over WebSocket `/ws` (no refresh)

### FR-6 Alerts & Escalation
Background job every 15 s:
- `critical`: new P1 incident → alert immediately
- `sla_breach`: P1 not dispatched within **2 min** (demo value; real = 5), P2 within 5 min; or assigned but no status update within 10 min
- `escalation`: SLA breached twice or manual "Escalate" → incident status `escalated`, notify authority channel
- `shortage`: no available resource of a required kind
Alerts appear as toasts + banner, acknowledgeable, and are sent to Telegram.

### FR-7 AI Assistance
- Incident summary (3 sentences, English, even if reports were Gujarati/Hindi)
- Recommended actions checklist for responders (e.g. "Carry life jackets; road via SG Highway flooded, use S.P. Ring Road")
- Situation brief: one-click "Generate SITREP" summarising all active incidents for the supervisor

### FR-8 Analytics
- Incidents by type (bar), by severity (stacked), over time (line)
- Response delays: time to dispatch / time to on-scene distribution
- Resource shortages: count of `shortage` alerts by kind
- Frequently affected areas: hotspot grid (≈500 m cells) heat layer on the map

### FR-9 Notifications
- Telegram bot: critical/escalation alerts to authority chat; dispatch message to responder chat
- In-app toasts for dispatcher; field view updates live

## 7. Non-functional requirements
- **Latency:** report → on dashboard < 5 s (AI call ~1–2 s)
- **Resilience:** AI failure → fallback classifier; dedup without embeddings; never drop a report
- **Explainability:** every AI output shows reasoning + confidence; every action is in `audit_log`
- **Human-in-the-loop:** AI recommends, human approves dispatch and escalations
- **Deterministic demo:** seeded data + scripted scenario; works offline from AI with fallback
- **Responsive:** `/report` and `/field` usable on a phone
- **Security basics:** API keys only server-side via `.env`; no secrets in git

## 8. Core user flows

**A. Citizen report → dispatch (the golden path, demo this)**
1. Citizen opens `/report`, types in Gujarati "અખબારનગર અંડરપાસમાં ગાડી ફસાઈ છે, પાણી વધી રહ્યું છે", shares location, adds photo
2. Backend stores report → classifier: `flood, severity 4, P1, hazards: [trapped_people]`
3. Dedup: no open flood within 1 km → new incident; broadcast `incident.created`
4. Dashboard: red pulsing pin appears at Akhbarnagar; toast "P1 flood — people trapped"; Telegram buzzes
5. Dispatcher opens drawer → AI summary in English + recommended: NDRF boat team (ETA 9 min), ambulance 108-AMD-07 (ETA 6 min), nearest hospital with beds
6. Click **Approve dispatch** → assignments created → field view of that crew updates
7. Crew taps *En route → On scene → Resolved*; dashboard timeline updates live

**B. Duplicate storm** — scenario sends 6 more reports about the same underpass from calls/citizens → counter goes 1 → 7, no new pins.

**C. Slipping incident** — an industrial gas-leak P1 at Vatva GIDC is left undispatched → at 2 min SLA alert → escalated → authority Telegram message.

**D. Supervisor** — clicks "Generate SITREP", opens `/analytics` to see hotspots and shortages (e.g. "rescue boats short 3 times").

## 9. Data model
See `backend/app/models.py` (source of truth).

```
Report(id, source, text, lang, lat, lng, address, photo_url, reporter, sensor_json,
       incident_id → Incident, ai_json, created_at)
Incident(id, code "INC-0001", type, severity, priority, status, title, lat, lng, address,
         ai_summary, ai_reasoning, ai_actions[], confidence, hazards[], people_affected_est,
         report_count, created_at, updated_at, dispatched_at, resolved_at)
Resource(id, callsign, kind, capabilities[], status, lat, lng, base, phone)
Facility(id, name, kind hospital|shelter|fire_station, lat, lng, beds_total, beds_available, specialties[])
Assignment(id, incident_id, resource_id, status assigned|en_route|on_scene|completed|cancelled,
           eta_min, approved_by, created_at, updated_at)
Alert(id, incident_id?, kind critical|sla_breach|escalation|shortage, message, acknowledged, created_at)
AuditLog(id, actor, action, entity, entity_id, payload_json, created_at)
```

Status lifecycle: `new → triaged → dispatched → on_scene → resolved` (any → `escalated` → back to flow).

## 10. AI design summary
| Task | Method | Fallback |
|---|---|---|
| Classify | Gemini JSON-schema output, few-shot incl. Gujarati/Hindi | keyword rules |
| Severity/priority | Gemini + deterministic priority rule | rules |
| Dedup | haversine + time window + embedding cosine | geo + time only |
| Recommend | weighted score (deterministic) + LLM rationale | score only, template reason |
| Summary / actions / SITREP | Gemini text | concatenated report text |
| Photo severity (Could) | Gemini Vision | skip |

Prompts live in `backend/app/services/*.py` as constants so BE2 can iterate. Cache AI output per report (`ai_json`) — never call twice for the same report.

## 11. Demo scenario — "Ahmedabad Monsoon Flood"
File: `backend/app/data/scenario_ahmedabad_flood.json` (~30 timed events over ~3 minutes)
- Akhbarnagar underpass flooding — car trapped (7 duplicate reports, mixed Gujarati/English/call)
- Vasna barrage water-level sensor crosses danger mark
- Fire in commercial complex at C.G. Road (3 reports)
- Chemical gas leak at Vatva GIDC (P1 — left undispatched to show SLA escalation)
- Road accident on S.G. Highway near Thaltej (2 reports)
- Medical emergency (elderly, Maninagar) in waterlogged society
- Wall collapse in Behrampura
- Waterlogging reports across Sabarmati riverfront area → hotspot

Run with dashboard "Run scenario" button → `POST /api/simulator/start`.

## 12. Risks & mitigations
| Risk | Mitigation |
|---|---|
| Gemini rate limits / network at venue | fallback classifier; cache; pre-seeded classified data; phone hotspot |
| 4 AI-assisted devs overwriting each other | folder ownership, contract-first types, small PRs, pull often |
| Integration breaks at the end | integrate every sync point (see TEAM_WORKFLOW); frontend has mock mode |
| Live demo failure | deterministic scenario + recorded backup video |
| Scope creep | Must/Should/Could; feature freeze 3 h before deadline |

## 13. Judging pitch angles
1. **Real problem, local**: Gujarat monsoon & industrial belts; multilingual input.
2. **Covers every PS-9 deliverable** end-to-end (show checklist slide).
3. **AI that acts, safely**: classifies, merges, recommends — human approves; everything explained and audited.
4. **Measured**: quote eval accuracy & dedup precision numbers.
5. **Live**: scenario streams in, map lights up, phone buzzes on stage.

## 14. PS-9 deliverable checklist
- [ ] Incident collection (citizen, call, sensor, field)
- [ ] Incident classification + severity + priority
- [ ] Duplicate detection & consolidation
- [ ] Resource recommendation (teams, vehicles, equipment, facilities)
- [ ] Real-time monitoring dashboard
- [ ] Alerts & escalation
- [ ] AI summaries & recommendations
- [ ] Analytics (types, delays, shortages, affected areas)
- [ ] Notifications
