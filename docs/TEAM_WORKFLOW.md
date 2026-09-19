# ResQNet — Team Workflow

**PS-9 · Bit N Build'26 Gujarat Round** · Deadline: **Sun 20 Sep 2026, 4:00 PM IST**
Read first: [PRD.md](PRD.md) (what we build) → this file (who builds what, when, how).

---

## 1. Team & ownership

| Role | Name | Owns (folders) | Mission |
|---|---|---|---|
| **BE1 — Core & Realtime** | Rahi | `backend/app/{main,models,schemas,db,config,ws_manager}.py`, `routers/` (except ai, analytics), `services/{geo,notifier,escalation}.py`, `scripts/seed.py`, `app/data/seed_*.json`, `app/data/scenario_*.json`, `docs/API_CONTRACT.md` | The data spine: every report stored, every change pushed live, alerts fire on time |
| **BE2 — AI & Intelligence** | Dev | `services/{classifier,dedup,recommender,summarizer}.py`, `routers/{ai,analytics}.py`, `scripts/eval.py`, `app/data/eval_incidents.json` | The brain: classify, merge duplicates, recommend resources, summarise, analytics, eval numbers |
| **FE1 — Command Center** | Maansi | `frontend/src/app/dashboard/`, `components/{map,incidents,dispatch,alerts}/`, `lib/ws.ts` | The screen judges stare at: live map, queue, incident drawer, dispatch, alerts |
| **FE2 — Reporting & Insights** | Diya | `frontend/src/app/{page.tsx,report,field,analytics,resources}/`, `components/{report,charts,layout}/`, `lib/{api,mock,constants}.ts`, `types/index.ts`, `docs/DEMO_SCRIPT.md` | Everything else users touch + the pitch |

**Rule:** only edit files you own. Need a change in someone else's file? Ask them in the group, or open a PR and tag them.
**Shared files** (`schemas.py`, `types/index.ts`, `API_CONTRACT.md`): change only after telling the group; update all three together.

---

## 2. One-time setup (everyone, first 20 min)

```bash
git clone https://github.com/Dev12444/ResQNet.git
cd ResQNet
```

**Backend (BE1, BE2 — FE devs too, to run it locally later):**
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # put GEMINI_API_KEY in .env (https://aistudio.google.com/apikey)
uvicorn app.main:app --reload --port 8000   # works once BE1 pushes main.py
```

**Frontend (FE1, FE2):**
```bash
cd frontend
npm install
cp .env.example .env.local  # keep NEXT_PUBLIC_USE_MOCK=true until backend is live
npm run dev                 # http://localhost:3000
```

> ⚠️ Frontend is **Next.js 16** — APIs differ from older versions. Tell your AI assistant: *"Read `frontend/AGENTS.md` and `node_modules/next/dist/docs/` before writing code."*
> Optional UI kit: `npx shadcn@latest init` (FE2 does this once, first hour, then pushes).

Each person gets their **own Gemini API key** (free tier limits are per key).

---

## 3. Git workflow

1. Always start from fresh main: `git checkout main && git pull`
2. Branch: `git checkout -b <role>/<feature>` → e.g. `be2/classifier`, `fe1/map`
3. Commit small & often: `git commit -m "feat(be2): gemini classifier with fallback"`
   Prefixes: `feat`, `fix`, `chore`, `docs`, `style`
4. Push & open PR: `git push -u origin be2/classifier` → `gh pr create --fill` (or on GitHub)
5. Merge fast — one teammate glances (2 min), or self-merge if everyone is busy and it doesn't touch shared files
6. After merging: everyone `git pull origin main` into their branch at every sync point

**Never commit:** `.env`, `.env.local`, API keys, `node_modules`, `.venv`, `*.db`.
**Before PR:** backend starts / `pytest` passes · frontend `npm run build` passes.
**Merge conflict?** Don't force-push. Ping the file owner.

---

## 4. The contract (build against this from minute one)

✅ Full details are in [`docs/API_CONTRACT.md`](API_CONTRACT.md) — **read it; it wins over this summary.** Core shapes:

```ts
type IncidentType = "flood"|"fire"|"road_accident"|"industrial"|"medical"|"building_collapse"|"other";
type IncidentStatus = "new"|"triaged"|"dispatched"|"on_scene"|"resolved"|"escalated";
type Priority = "P1"|"P2"|"P3"|"P4";
type ReportSource = "citizen"|"call"|"sensor"|"field";
type ResourceKind = "ambulance"|"fire_truck"|"rescue_boat"|"police"|"ndrf_team"|"hazmat";

interface Report   { id; source; text; lang; lat; lng; address?; photo_url?; incident_id?; created_at }
interface Incident { id; code; type; severity: 1|2|3|4|5; priority; status; title; lat; lng; address;
                     ai_summary; ai_reasoning; ai_actions: string[]; confidence; hazards: string[];
                     report_count; created_at; updated_at; dispatched_at?; resolved_at? }
interface Resource { id; callsign; kind; status: "available"|"assigned"|"busy"|"offline"; lat; lng; base }
interface Facility { id; name; kind: "hospital"|"shelter"|"fire_station"; lat; lng; beds_total?; beds_available? }
interface Assignment { id; incident_id; resource_id; status: "assigned"|"en_route"|"on_scene"|"completed"|"cancelled"; eta_min; created_at }
interface Recommendation { resource: Resource; eta_min; score; reason }
interface Alert    { id; incident_id?; kind: "critical"|"sla_breach"|"escalation"|"shortage"; message; acknowledged; created_at }
```

| Method | Path | Owner |
|---|---|---|
| POST | `/api/reports` | BE1 (calls BE2 pipeline) |
| GET | `/api/incidents` · `/api/incidents/{id}` (incl. reports + assignments) | BE1 |
| PATCH | `/api/incidents/{id}` (status, escalate, unmerge) | BE1 |
| GET | `/api/incidents/{id}/recommendations` | BE2 |
| POST | `/api/incidents/{id}/dispatch` `{resource_ids[]}` | BE1 |
| PATCH | `/api/assignments/{id}` `{status}` | BE1 |
| GET | `/api/resources` · `/api/facilities` | BE1 |
| GET/POST | `/api/alerts` · `/api/alerts/{id}/ack` | BE1 |
| POST | `/api/ai/sitrep` | BE2 |
| GET | `/api/analytics/{summary,by-type,response-times,shortages,hotspots}` | BE2 |
| POST | `/api/simulator/start` · `/api/simulator/stop` | BE1 |
| WS | `/ws` → `{event, data}` events: `report.created`, `incident.created`, `incident.updated`, `incident.merged`, `assignment.updated`, `alert.created` | BE1 |

---

## 5. Timeline (Sat 10:30 → Sun 16:00)

| When | Phase | Goal |
|---|---|---|
| **Sat 10:30–11:00** | Kickoff | Everyone reads PRD, fills names in §1, setup done, keys in `.env` |
| **Sat 11:00–14:00** | **P1 Foundations** | BE: DB + stub API running · FE: layouts + pages on mock data |
| 🔁 **Sat 14:00 — SYNC 1** (15 min) | | BE1 demos `/api/incidents` + WS; FE switches one screen to real API |
| **Sat 14:00–19:00** | **P2 Golden path** | Report → classify → incident on map → recommend → dispatch works **end-to-end** |
| 🔁 **Sat 19:00 — SYNC 2** (20 min) | | Full golden-path demo on one laptop. Deploy backend (Render) + frontend (Vercel) |
| **Sat 19:00–23:30** | **P3 Complete features** | Dedup, alerts/escalation, simulator, field view, analytics, Telegram |
| 🔁 **Sat 23:30 — SYNC 3** | | Run full scenario on deployed URLs. List bugs. Decide what to cut |
| **Sun 00:00–06:30** | 😴 **Sleep** (at least 5 h — stagger if needed, never all awake zombies) | |
| **Sun 07:00–11:00** | **P4 Polish & wow** | Multilingual, SITREP, eval numbers, UI polish, Could-haves only if Musts are solid |
| 🔁 **Sun 11:00 — SYNC 4: FEATURE FREEZE** | | No new features after this. Only bug fixes |
| **Sun 11:00–14:00** | **P5 Harden & pitch** | Bug bash, seed data, slides, record backup video, rehearse demo 3× |
| **Sun 14:00–15:30** | Final | Final deploy, README screenshots, submission form |
| **Sun 15:30** | **SUBMIT** (30 min buffer before 4 PM) | |

---

## 6. Detailed tasks

Tick boxes in this file via PRs as you go (or just in your head — but tell the group at syncs).

### 🟦 BE1 — Core & Realtime

**P1 Foundations (Sat 11:00–14:00)**
- [ ] `models.py` — all tables from PRD §9 (`Report, Incident, Resource, Facility, Assignment, Alert, AuditLog`); JSON columns for lists
- [ ] `schemas.py` — Pydantic models matching §4 contract (`ReportCreate, ReportOut, IncidentOut, IncidentDetail, ResourceOut, ...`)
- [ ] `main.py` — FastAPI app, CORS from settings, `init_db()` on startup, include all routers, `GET /health`
- [ ] `seed_resources.json` — ~25 units around Ahmedabad (ambulances `108-AMD-01..10`, fire trucks at Danapith/Naranpura/Shahpur fire stations, 4 NDRF rescue boats near Sabarmati, 4 police PCRs, 1 hazmat) with real-ish lat/lng
- [ ] `seed_facilities.json` — ~10 hospitals (Civil Hospital Asarwa, SVP Hospital, VS Hospital, LG Hospital, Sola Civil, Zydus, Apollo Gandhinagar…) with beds, + 4 shelters, + fire stations
- [ ] `scripts/seed.py` — load JSON into DB (idempotent: wipe + insert)
- [ ] Routers returning real DB data: `GET /api/incidents`, `/api/incidents/{id}`, `/api/resources`, `/api/facilities`, `/api/alerts`
- [ ] `ws_manager.py` + `routers/ws.py` — connection manager with `broadcast(event, data)`
- [x] ~~Write `docs/API_CONTRACT.md`~~ (done) → review it by 11:30 and raise changes in the group

**P2 Golden path (Sat 14:00–19:00)**
- [ ] `POST /api/reports` pipeline: save report → `classifier.classify(report)` (BE2) → `dedup.find_match()` (BE2) → create new incident or merge → broadcast → return
- [ ] Until BE2's services land, call a trivial stub so the pipeline runs
- [ ] `POST /api/incidents/{id}/dispatch` → create assignments, set resource `assigned`, incident `dispatched`, `dispatched_at`, audit log, broadcast
- [ ] `PATCH /api/assignments/{id}` → status lifecycle; when all completed → incident `resolved`, free resources
- [ ] `PATCH /api/incidents/{id}` → manual status / escalate
- [ ] `services/geo.py` — `haversine_km()`, `eta_minutes(distance, kind)` (speeds: ambulance 35, fire 30, police 40, boat 10, ndrf 25 km/h) — BE2 uses these
- [ ] `audit_log` entry for every create/dispatch/status change
- [ ] Deploy to Render (`render.yaml`), Postgres on Supabase/Neon (or Render Postgres) — give URL to FE by SYNC 2

**P3 Complete (Sat 19:00–23:30)**
- [ ] `scenario_ahmedabad_flood.json` — ~30 events `{t_offset_sec, source, text, lang, lat, lng}` per PRD §11 (Akhbarnagar ×7 dupes incl. Gujarati, Vasna sensor, C.G. Road fire ×3, Vatva gas leak, S.G. Highway accident ×2, Maninagar medical, Behrampura wall collapse, riverfront waterlogging)
- [ ] `routers/simulator.py` — `start` spawns asyncio task that posts events through the same pipeline on schedule; `stop` cancels; `?speed=2` multiplier
- [ ] `services/escalation.py` — background loop every `ESCALATION_TICK_SEC`: critical / sla_breach / escalation / shortage alerts (PRD FR-6), no duplicate alerts for same incident+kind
- [ ] `services/notifier.py` — Telegram `sendMessage` via httpx; no-op if token empty; message format with emoji, code, type, location, Google Maps link
- [ ] `POST /api/alerts/{id}/ack`

**P4/P5 (Sun)**
- [ ] `tests/test_health.py` + one pipeline test
- [ ] Reset endpoint or script for demo (`POST /api/simulator/reset` → reseed)
- [ ] Load-test the scenario at 2× speed; fix race conditions
- [ ] `backend/README.md` run instructions

**Starter prompt for your AI:** *"Read docs/PRD.md and docs/TEAM_WORKFLOW.md §4 and §6 BE1. Implement models.py, schemas.py and main.py for ResQNet using FastAPI + SQLAlchemy 2.0 + Pydantic v2. Use app/config.py and app/db.py as they exist."*

---

### 🟩 BE2 — AI & Intelligence

**P1 Foundations (Sat 11:00–14:00)**
- [ ] `services/classifier.py`:
  - `classify(text, source, lang_hint=None, sensor=None) -> ClassificationResult`
  - Gemini (`google-genai`, `GEMINI_MODEL`), `response_mime_type="application/json"` + response schema, temperature 0
  - Output: `type, severity, priority, title, location_text, people_affected_est, hazards[], reasoning, confidence, lang`
  - Few-shot examples incl. **Gujarati and Hindi**
  - Deterministic priority rule (PRD FR-2) applied after the LLM
  - `fallback_classify()` — keyword rules (Gujarati/Hindi keywords too: પાણી, આગ, अकस्मात, आग, बाढ़…) used when `settings.ai_available` is false or API errors/times out (5 s)
  - Sensor reports: pure rules (level vs danger mark)
- [ ] `eval_incidents.json` — 50 labelled examples `{text, lang, expected_type, expected_severity, dup_group}` (mix of languages, include tricky ones)
- [ ] Quick CLI test: `python -c "from app.services.classifier import classify; print(classify('...'))"`

**P2 Golden path (Sat 14:00–19:00)**
- [ ] `services/dedup.py` — `find_match(db, report, cls) -> Incident | None` per PRD FR-3 (type, 300 m / 1 km flood, 30 min, cosine ≥ 0.80 with `text-embedding-004`; geo+time only if embeddings fail). Cache embeddings on report
- [ ] `services/recommender.py` — `recommend(db, incident) -> {resources: [...top3 per needed kind], facility}`; capability map + score formula from PRD FR-4 using BE1's `geo.py`; LLM one-line reason (batched, one call per incident) with template fallback
- [ ] `routers/ai.py` (new file, BE2-owned; ask BE1 to `include_router` it in `main.py`): `GET /api/incidents/{id}/recommendations`, `POST /api/incidents/{id}/summarize`, `POST /api/ai/sitrep`
- [ ] `services/summarizer.py` — `summarize_incident(incident, reports) -> {summary, actions[]}` in English; called on create + merge (debounce: max once per 20 s per incident)

**P3 Complete (Sat 19:00–23:30)**
- [ ] `routers/analytics.py` — `summary` (KPIs: active, P1 open, avg time-to-dispatch, units available), `by-type`, `response-times` (dispatched_at − created_at, on_scene times), `shortages` (from alerts), `hotspots` (bucket lat/lng into ~500 m grid → `[{lat, lng, count}]`)
- [ ] `POST /api/ai/sitrep` — situation report for all active incidents (markdown)
- [ ] `scripts/eval.py` — run classifier + dedup over eval set → print type accuracy, severity ±1 accuracy, dedup precision/recall, avg latency. **Save numbers for pitch**

**P4/P5 (Sun)**
- [ ] Tune prompts until eval ≥ 90 % type accuracy; tune dedup thresholds
- [ ] Could: photo severity with Gemini Vision (`photo_url` → hint severity)
- [ ] Rate-limit safety: cache by text hash, retry with backoff once, then fallback
- [ ] Pre-run scenario once so `ai_json` is cached for a fast demo

**Starter prompt:** *"Read docs/PRD.md §6 FR-2/3/4/7 and §10. Implement backend/app/services/classifier.py using the google-genai SDK with structured JSON output, a Gujarati/Hindi/English few-shot prompt, a deterministic priority rule and a keyword fallback. Use get_settings() from app/config.py."*

---

### 🟥 FE1 — Command Center (`/dashboard`)

**P1 Foundations (Sat 11:00–14:00)** — on mock data
- [ ] Dashboard layout: KPI header bar · left incident queue · center map · right drawer (full-height, dark "control room" theme)
- [ ] `components/map/IncidentMap.tsx` — `react-map-gl/maplibre` with free OSM style (e.g. `https://tiles.openfreemap.org/styles/liberty` or a Carto dark style), centered on Ahmedabad `23.0225, 72.5714`, zoom 11. **Must be client component** (`"use client"`), load with dynamic import `ssr:false`
- [ ] Incident markers coloured by severity (1 `#22c55e` → 5 `#7f1d1d`), P1+unassigned pulse animation, icon by type
- [ ] Resource markers (small, by kind), facility markers (hospital +)
- [ ] `components/incidents/IncidentQueue.tsx` — list sorted by priority then age, filters (type/status/severity), click → select + fly map to it

**P2 Golden path (Sat 14:00–19:00)**
- [ ] `components/incidents/IncidentDrawer.tsx` — title, badges (type, severity, priority, status), AI summary, reasoning + confidence bar, actions checklist, linked reports list (source icon + language + time), timeline
- [ ] `components/dispatch/RecommendationPanel.tsx` — top recommendations with ETA, score, reason; checkboxes; **Approve Dispatch** button → POST dispatch; nearest facility card
- [ ] `lib/ws.ts` — WebSocket client with auto-reconnect; a `useLiveEvents()` hook updating incident/resource/alert state (use a simple store: React context or `zustand`)
- [ ] Switch from mock to real API when `NEXT_PUBLIC_USE_MOCK=false`

**P3 Complete (Sat 19:00–23:30)**
- [ ] `components/alerts/` — toast stack for new alerts (colour by kind), sound on `critical`, persistent red escalation banner, ack button
- [ ] Merge animation: when `incident.merged`, the pin pulses and report count ticks up
- [ ] "Escalate" + status change buttons in drawer
- [ ] **Run Scenario / Stop / Reset** control (top bar) → simulator endpoints
- [ ] KPI header live: active, P1 open, units available/total, avg response time (from `/api/analytics/summary`)

**P4/P5 (Sun)**
- [ ] "Generate SITREP" button → modal with markdown
- [ ] Polish: loading/empty states, keyboard shortcut (↑↓ in queue), smooth flyTo
- [ ] Test at 1366×768 and projector resolution; hide dev junk
- [ ] Record the backup demo video with FE2

**Starter prompt:** *"Read frontend/AGENTS.md first (Next.js 16). Then read docs/TEAM_WORKFLOW.md §4 and §6 FE1. Build the /dashboard page with a MapLibre map via react-map-gl/maplibre centered on Ahmedabad, incident markers coloured by severity, and an incident queue, using mock data from src/lib/mock.ts and types from src/types/index.ts."*

---

### 🟨 FE2 — Reporting & Insights

**P1 Foundations (Sat 11:00–14:00)** — do the shared stuff FIRST (FE1 depends on it)
- [ ] **By 11:45:** `types/index.ts` — the §4 contract as TS types → push, tell FE1
- [ ] **By 12:30:** `lib/mock.ts` — ~12 incidents across Ahmedabad (use PRD §11 locations), 25 resources, 10 facilities, 5 alerts, sample recommendations → push
- [ ] `lib/api.ts` — typed fetch wrapper using `NEXT_PUBLIC_API_URL`; returns mock when `NEXT_PUBLIC_USE_MOCK=true`
- [ ] `lib/constants.ts` — severity colours, type labels/icons (lucide), status labels
- [ ] (optional) `npx shadcn@latest init` + button, badge, card, dialog, toast → push early
- [ ] `components/layout/` — top nav (ResQNet logo, links: Dashboard · Report · Field · Analytics · Resources)
- [ ] Landing `/` — hero ("One live picture for every emergency"), 3 feature cards, buttons → Dashboard / Report an emergency

**P2 Golden path (Sat 14:00–19:00)**
- [ ] `/report` citizen form (mobile-first): language toggle **ગુજરાતી / हिंदी / English** (UI labels translated), description textarea, "Use my location" (`navigator.geolocation`) + small map to drop/drag pin, photo upload (base64 or skip upload and send filename for demo), submit → POST `/api/reports`
- [ ] Success screen: "Report received — ID INC-0012, classified as Flood · Severity 4 · Help is being arranged"
- [ ] Also a "Simulate call / sensor" tab (source selector) for demo purposes

**P3 Complete (Sat 19:00–23:30)**
- [ ] `/field` responder view (mobile): pick unit from dropdown (demo), shows current assignment card: incident, address, AI actions checklist, "Navigate" (Google Maps link), big buttons **En route → On scene → Completed** → PATCH assignment; live via WS
- [ ] `/analytics` — Recharts: incidents by type (bar), severity over time (line/stacked), response-time distribution (bar), shortages (bar), hotspot map (MapLibre heatmap layer from `/api/analytics/hotspots`), KPI cards; shows **eval numbers** card from BE2
- [ ] `/resources` — tables: units (kind, status badge, base) and hospitals (beds available/total bar)

**P4/P5 (Sun)**
- [ ] Voice input on `/report` (Web Speech API, `lang="gu-IN" | "hi-IN" | "en-IN"`) — Could
- [ ] `docs/DEMO_SCRIPT.md` — 2-min pitch + click-by-click demo (PRD §8 flows A→D) + backup plan
- [ ] Slides (5–7): Problem · Solution · Live demo · Architecture · AI & eval numbers · PS-9 checklist · Impact/next steps
- [ ] Record backup video (screen recording of full demo, 2–3 min)
- [ ] README: screenshots, live URLs, team

**Starter prompt:** *"Read frontend/AGENTS.md first (Next.js 16). Then read docs/TEAM_WORKFLOW.md §4 and §6 FE2. Create src/types/index.ts with the contract types, then src/lib/mock.ts with realistic Ahmedabad incidents, resources and facilities, then src/lib/api.ts with a typed fetch wrapper that returns mock data when NEXT_PUBLIC_USE_MOCK=true."*

---

## 7. Dependencies (who is waiting on whom)

| Needed by | Needs | From | By |
|---|---|---|---|
| FE1, FE2 | `API_CONTRACT.md` | — | ✅ done |
| FE1 | `types/index.ts`, `lib/mock.ts` | FE2 | Sat 12:30 |
| BE1 pipeline | `classify()`, `find_match()` function signatures (stubs OK) | BE2 | Sat 13:00 |
| BE2 recommender | `geo.py` (`haversine_km`, `eta_minutes`), seeded resources | BE1 | Sat 15:00 |
| FE1 live map | WS events + real endpoints | BE1 | SYNC 1 (14:00) |
| FE1 drawer | `/recommendations` endpoint | BE2 | Sat 17:00 |
| FE2 analytics | analytics endpoints | BE2 | Sat 22:00 |
| Everyone | deployed backend + frontend URLs | BE1 / FE2 | SYNC 2 (19:00) |
| Pitch | eval numbers | BE2 | Sun 11:00 |

Blocked? Mock it and move on — never wait idle. Post blockers in the group immediately.

---

## 8. Sync meeting format (15 min max)

1. Each person: ✅ done · 🔨 doing · 🚧 blocked (30 s each)
2. Everyone `git pull origin main`, run the app, try the golden path together
3. Decide cuts (use PRD §5 Must/Should/Could)
4. Update deadlines if needed

---

## 9. Definition of done (a task is done when…)

- Merged to `main`, and `main` still starts (backend) / builds (frontend)
- Works against the **real** backend (not just mock) — by SYNC 3
- No console errors, no hardcoded `localhost` (use env vars)
- Handles empty / loading / error state (FE) or bad input with 4xx (BE)

---

## 10. Demo-day rules

- Demo from **deployed URLs**, laptop on charger, phone hotspot as backup internet
- Reset data before demo (`Reset` button) → run scenario
- Have the backup video open in a tab
- One person drives the laptop (FE1), one talks (FE2), BE1 shows phone Telegram alert, BE2 answers AI/eval questions
- Speak to PS-9 deliverables explicitly — judges tick boxes
