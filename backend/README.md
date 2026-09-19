# ResQNet Backend (FastAPI)

API contract: [`docs/API_CONTRACT.md`](../docs/API_CONTRACT.md) · Architecture: [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)

## Run locally

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate            # Windows  (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
cp .env.example .env              # add OPENAI_API_KEY and/or GEMINI_API_KEY (optional: rules work offline)
python -m scripts.seed            # local SQLite: 25 units, 18 facilities (wipes demo data)
uvicorn app.main:app --reload --port 8000
```

- API docs: http://localhost:8000/docs · health: http://localhost:8000/health
- WebSocket: `ws://localhost:8000/ws` (events in contract §4)
- Python 3.10+ (tested on 3.10 and 3.14)
- No API keys? The demo scenario still gets real AI answers from the shipped cache
  (`app/data/demo_ai_cache.json.gz`); anything else falls back to the offline rules.

## Demo control

```bash
curl -X POST localhost:8000/api/simulator/start -H 'content-type: application/json'      -d '{"scenario":"ahmedabad_flood","speed":2}'     # 30 reports over ~3 min (speed 0.1-20)
curl localhost:8000/api/simulator/status               # {running, events_sent, events_total}
curl -X POST localhost:8000/api/simulator/stop
curl -X POST localhost:8000/api/simulator/reset        # stop + wipe + reseed (dashboards refetch)
```

The simulator feeds `app/data/scenario_<name>.json` through the **same pipeline** as
`POST /api/reports` (triage, dedup, alerts, WebSocket), so what the demo shows is what the API does.
Every event is validated before the run starts; a second `start` while running is a 409.

## Tests

```bash
pytest                                  # SQLite, AI forced off: no API calls, no cost (~30 s)
TEST_POSTGRES_URL=postgresql://postgres@127.0.0.1:5432/resqnet_test   pytest tests/test_db.py tests/test_concurrency_pg.py   # real-Postgres checks + row-lock races
```

`TEST_POSTGRES_URL` must be a **throwaway** database: the tests drop and recreate every table.
Never point it at Neon.

### Load / race test (demo rehearsal)

```bash
python -m scripts.load_test --base-url http://127.0.0.1:8000 --reset            # scenario at 2x
python -m scripts.load_test --base-url https://<service>.onrender.com --reset    # the deployed API
```

Plays the scenario while 3 dispatchers race for the same incidents and units, field units
advance (with double taps), a supervisor escalates / resolves / acknowledges, and bursts of
identical reports arrive in parallel. Afterwards it reads everything back and fails (exit code 1)
on any 5xx, double-booked or leaked unit, incident/unit status mismatch, wrong `report_count`,
split burst, duplicate alert, or `POST /api/reports` p95 over 5 s. `--reset` **wipes the target
database** first. Last local run on Postgres, 2x, AI on (demo cache): 30/30 events, ~1,700
requests, 0 errors, all invariants held, reports p95 ~0.1 s.

## Environment variables

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./resqnet.db` | Neon/Postgres: paste `postgresql://…?sslmode=require` as-is |
| `OPENAI_API_KEY`, `GEMINI_API_KEY` | empty | Either enables AI; none = rule-based fallback |
| `AI_ENABLED` | `true` | `false` forces the offline rules (demo safety switch) |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated exact frontend origins (REST **and** WebSocket) |
| `CORS_ORIGIN_REGEX` | empty | Optional, e.g. `^https://resqnet(-[a-z0-9-]+)?\.vercel\.app$` for Vercel previews |
| `SEED_ON_STARTUP` | `true` | Seeds an **empty** DB at startup; never wipes |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_AUTHORITY_CHAT_ID`, `TELEGRAM_RESPONDER_CHAT_ID` | empty | Empty = notifications off |
| `SLA_P1_DISPATCH_SEC` / `SLA_P2_DISPATCH_SEC` / `SLA_NO_UPDATE_SEC` / `ESCALATION_TICK_SEC` | 120 / 300 / 600 / 15 | Demo SLA timings |
| `AUTO_ESCALATE_AFTER_BREACHES` | `2` | Auto-escalate after N missed dispatch SLA periods (PRD FR-6); `0` = only the dashboard escalates |

BE2's AI settings (models, budgets, cache) are documented in `app/config.py`.

## Seed / reset data

```bash
python -m scripts.seed          # SQLite only; wipes incidents/reports/assignments/alerts/audit + reloads units
python -m scripts.seed --yes    # required for any other DB (e.g. Neon) — deletes ALL data there
```

Incident codes restart at `INC-0001` after a reset.

## Deploy (Render + Neon)

1. **Neon**: create a project → copy the connection string (`postgresql://…neon.tech/neondb?sslmode=require`).
   The pooled (`-pooler`) endpoint also works. Tables are created and seeded on the first start.
2. **Render**: *New → Blueprint* → select this repo → Render reads [`backend/render.yaml`](render.yaml).
3. Fill the `sync: false` variables in the dashboard: `DATABASE_URL` (Neon), `OPENAI_API_KEY` /
   `GEMINI_API_KEY`, `CORS_ORIGINS` (the Vercel URL), optionally `CORS_ORIGIN_REGEX` and the Telegram values.
   **Never commit these.**
4. Deploy, then check `https://<service>.onrender.com/health` → `{"status":"ok","ai":true,"db":true}`.
5. Frontend: set `NEXT_PUBLIC_API_URL=https://<service>.onrender.com` (the WebSocket is the same host, `wss://…/ws`).

**Operational notes**
- Runs **exactly one worker** on purpose (in-memory pipeline + alert locks, WebSocket clients,
  summary timers). Scale up the instance, not the worker count.
- Render **free** instances sleep after ~15 min idle; the first request then takes ~1 min.
  Open `/health` a few minutes before a demo.
- The AI disk cache (`.cache/`) is on Render's ephemeral disk and is cleared on each deploy.
- Schema changes: tables are created with `create_all` (no migrations). After a model change on an
  existing database, drop the tables (or use a fresh Neon branch) and let startup recreate + seed them.

## Concurrency (why the demo can't double-book)

| Race | Guard |
|---|---|
| Two reports about one event arrive together | `PIPELINE_LOCK` around dedup + create/merge (`app/pipeline.py`) |
| Two dispatchers pick the same unit | Atomic `UPDATE resources … WHERE status='available'`; the loser gets a 409 |
| Dispatch / resolve / field tap on one incident | Row lock on the incident first (`lock_incident`), then assignments, then resources: one order everywhere, so no lost updates and no deadlocks |
| Escalation loop vs. a new report's alert check vs. manual escalation | `ALERT_LOCK` around "already alerted?" → insert → commit (`app/alerting.py`); taken **before** any row lock |
| Loop auto-escalates while a dispatch commits | Conditional `UPDATE … WHERE status IN ('new','triaged')`: the dispatch wins |
| Double tap on a unit status | Idempotent (same status = no-op) + forward-only lifecycle (409 on a step back) |

Row locks are Postgres-only (SQLite serialises writes on its own); the races are reproduced
deterministically in `tests/test_concurrency_pg.py` and each guard was verified by removing it
and watching its test fail.

## Troubleshooting

- **Every request takes ~0.2-2 s locally on Windows**: `localhost` tries IPv6 first; use `127.0.0.1`.
- **`/health` says `"db": false`** (HTTP 503): wrong `DATABASE_URL`, or Neon is waking up; retry in a few seconds.
- **WebSocket closes with 1008**: the page's origin is not in `CORS_ORIGINS` / `CORS_ORIGIN_REGEX`.
- **Dashboard shows old data after a reset**: it should refetch on the zeroed `simulator.status` event; reload the page.

## Layout (BE1 = core & realtime, BE2 = AI)

```
app/main.py            app, lifespan (DB init, seed, WS hub, escalation loop), CORS, /health
app/models.py, db.py   SQLAlchemy models + engine (SQLite / Postgres URL handling)
app/schemas.py         request/response models (contract v1.3)
app/pipeline.py        report ingest: triage -> dedup -> create/merge -> audit -> WS
app/simulator.py       demo scenario player
app/alerting.py        alert creation + publish (WS + Telegram)
app/ws_manager.py      WebSocket hub (ordered, thread-safe publish)
app/routers/           REST endpoints (ai.py / analytics.py are BE2's)
app/services/          escalation, notifier, geo (BE1) · classifier, dedup, llm, recommender, ... (BE2)
scripts/               seed, load_test (BE1) · eval, warm_cache, export_demo_cache (BE2)
```
