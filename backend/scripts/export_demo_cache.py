"""Export the AI answers the demo needs into app/data/demo_ai_cache.json.gz (committed). Owner: BE2.

Runs the scenario through the full AI pipeline (scripts/dry_run.py: classify, embeddings, merges,
summaries, recommendation reasons) while recording every cache key it touches, then writes only
those entries. llm.py reads this file before calling any model, so a fresh Render deploy (no shell,
disk wiped on deploy) answers the demo instantly, for free, with exactly the outputs we tested.

Usage (from backend/):  python -m scripts.export_demo_cache [events.json ...]
Re-run after changing prompts or bumping llm.CACHE_VERSION (old seed keys stop matching anyway).
Contains model outputs and embeddings only; no keys, no personal data.
"""
from __future__ import annotations

import gzip
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
DEFAULT = [ROOT / "app" / "data" / "scenario_ahmedabad_flood.json"]


def _round(v):
    if isinstance(v, float):
        return round(v, 6)  # embeddings: 6 decimals changes cosine by < 1e-5, halves the file
    if isinstance(v, list):
        return [_round(x) for x in v]
    if isinstance(v, dict):
        return {k: _round(x) for k, x in v.items()}
    return v


def main() -> None:
    from app.config import get_settings
    from app.services import llm
    from scripts import dry_run

    if not get_settings().ai_available:
        sys.exit("AI is off (no key or AI_ENABLED=false): nothing worth exporting.")
    files = [Path(p) for p in sys.argv[1:]] or DEFAULT
    llm.RECORD_KEYS = set()
    for f in files:
        sys.argv = ["dry_run", str(f), "--quiet"]
        dry_run.main()
    keys, llm.RECORD_KEYS = llm.RECORD_KEYS, None
    entries = {k: _round(v) for k, v in llm.export_entries(keys).items()}
    fallback = [k for k, v in entries.items() if isinstance(v, dict) and v.get("by") in (None, "?")]
    with gzip.open(llm.DEMO_SEED_PATH, "wt", encoding="utf-8", compresslevel=9) as out:
        json.dump(entries, out, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    size = llm.DEMO_SEED_PATH.stat().st_size / 1024
    print(f"\nwrote {llm.DEMO_SEED_PATH.relative_to(ROOT)}: {len(entries)} answers "
          f"({len(keys) - len(entries)} keys had no answer, {len(fallback)} unattributed), {size:.0f} KB")


if __name__ == "__main__":
    main()
