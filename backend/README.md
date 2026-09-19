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

## Tests

```bash
pytest                                  # SQLite, AI forced off: no API calls, no cost
TEST_POSTGRES_URL=postgresql://... pytest tests/test_db.py   # optional real-Postgres check
```

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
- Runs **exactly one worker** on purpose (in-memory pipeline lock, WebSocket clients, summary timers).
  Scale up the instance, not the worker count.
- Render **free** instances sleep after ~15 min idle; the first request then takes ~1 min.
  Open `/health` a few minutes before a demo.
- The AI disk cache (`.cache/`) is on Render's ephemeral disk and is cleared on each deploy.
- Schema changes: tables are created with `create_all` (no migrations). After a model change on an
  existing database, drop the tables (or use a fresh Neon branch) and let startup recreate + seed them.
