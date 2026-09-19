"""Reset the database and load demo seed data. Owner: BE1.

Usage (from backend/):
    python -m scripts.seed          # local SQLite
    python -m scripts.seed --yes    # required for any non-SQLite DB (e.g. Neon) — wipes ALL data there

Idempotent: every run wipes incidents/reports/assignments/alerts/audit log/resources/facilities
and inserts app/data/seed_resources.json + seed_facilities.json in one transaction.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.db import DATABASE_URL, SessionLocal, engine, init_db  # noqa: E402
from app.seed import SeedError, load_seed, reset_database  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Wipe all ResQNet demo data and load the seed files.")
    parser.add_argument("--yes", action="store_true", help="confirm wiping a non-SQLite database (e.g. Neon)")
    args = parser.parse_args(argv)

    target = engine.url.render_as_string(hide_password=True)
    if not DATABASE_URL.startswith("sqlite") and not args.yes:
        print(f"Refusing to wipe {target} without --yes (this deletes ALL data in that database).", file=sys.stderr)
        return 2

    try:
        data = load_seed()
    except SeedError as e:
        print(f"Seed aborted, database untouched: {e}", file=sys.stderr)
        return 1

    init_db()
    with SessionLocal() as db:
        counts = reset_database(db, data)
    print(f"Seeded {target}: {counts['resources']} resources, {counts['facilities']} facilities.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
