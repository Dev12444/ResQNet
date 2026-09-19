"""Pre-compute AI results for the demo so the live run is instant and survives network hiccups. Owner: BE2.

Runs classify() + embeddings for every text in the demo scenario (BE1's
app/data/scenario_ahmedabad_flood.json) and the eval set, storing results in the persistent
LLM cache (LLM_CACHE_PATH, default backend/.cache/llm_cache.sqlite3).

Usage (from backend/):  python scripts/warm_cache.py [extra.json ...]
Each JSON file is a list of objects with at least "text" (and optionally "source", "sensor").
Run it again after editing the scenario — cached texts are skipped automatically.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

DEFAULT_FILES = [
    ROOT / "app" / "data" / "scenario_ahmedabad_flood.json",
    ROOT / "app" / "data" / "eval_incidents.json",
]


def _items(path: Path) -> list[dict]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        print(f"  skip {path.name}: {e}")
        return []
    if isinstance(data, dict):  # allow {"events": [...]}
        data = data.get("events") or data.get("reports") or []
    return [x for x in data if isinstance(x, dict) and (x.get("text") or x.get("sensor"))]


def main() -> None:
    from app.config import get_settings
    from app.services import classifier, llm

    st = get_settings()
    if not st.ai_available:
        sys.exit("No OPENAI_API_KEY or GEMINI_API_KEY, or AI_ENABLED=false — nothing to warm.")
    if not st.llm_cache_path:
        sys.exit("LLM_CACHE_PATH is empty — results would not persist.")

    files = [Path(p) for p in sys.argv[1:]] or DEFAULT_FILES
    total = fallback = 0
    start = time.perf_counter()
    for path in files:
        items = _items(path)
        print(f"{path.name}: {len(items)} texts")
        texts = []
        for it in items:
            waited = 0
            while not llm.has_capacity() and waited < 90:  # stay under provider RPM limits instead of falling back
                time.sleep(2)
                waited += 2
            c = classifier.classify(it.get("text"), it.get("source", "citizen"), sensor=it.get("sensor"))
            total += 1
            fallback += c.source_model == "fallback"
            if it.get("text"):
                texts.append(it["text"].strip())
        for i in range(0, len(texts), 100):
            if llm.embed(texts[i:i + 100]) is None:
                print("  ! embeddings unavailable right now — re-run later")
    print(f"\nWarmed {total} reports in {time.perf_counter() - start:.1f}s "
          f"({fallback} fell back to rules — re-run to retry those). Cache: {st.llm_cache_path}")


if __name__ == "__main__":
    main()
