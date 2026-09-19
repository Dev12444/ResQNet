"""AI eval: classification accuracy + dedup precision/recall on app/data/eval_incidents.json. Owner: BE2.

Usage (from backend/):
    python scripts/eval.py            # uses Gemini if GEMINI_API_KEY is set
    python scripts/eval.py --no-ai    # rule-based fallback only
Writes app/data/eval_results.json (served by GET /api/analytics/eval) — quote these numbers in the pitch.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from itertools import combinations
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

DATA = ROOT / "app" / "data" / "eval_incidents.json"
OUT = ROOT / "app" / "data" / "eval_results.json"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-ai", action="store_true", help="force rule-based fallback")
    ap.add_argument("--quiet", action="store_true", help="don't list misclassifications")
    ap.add_argument("--no-cache", action="store_true", help="bypass the cache to measure real latency (costs API calls)")
    ap.add_argument("--no-save", action="store_true", help="print only; don't overwrite eval_results.json")
    args = ap.parse_args()
    if args.no_ai:
        os.environ["AI_ENABLED"] = "false"

    from app.services import classifier, dedup, llm

    llm.BYPASS_CACHE = args.no_cache  # still records OpenAI spend

    rows = json.loads(DATA.read_text())
    t0 = datetime(2026, 9, 19, 8, 0, tzinfo=timezone.utc)

    # ---------- classification
    results, latencies, models, answered_by = [], [], {}, {}
    spend_before = llm.spent_usd()
    for r in rows:
        start = time.perf_counter()
        c = classifier.classify(r["text"], r["source"])
        latencies.append((time.perf_counter() - start) * 1000)
        models[c.source_model] = models.get(c.source_model, 0) + 1
        by = (c.model or c.source_model).removeprefix("cache:")
        answered_by[by] = answered_by.get(by, 0) + 1
        results.append(c)

    n = len(rows)
    type_ok = [c.type == r["expected_type"] for c, r in zip(results, rows)]
    sev_ok = [abs(c.severity - r["expected_severity"]) <= 1 for c, r in zip(results, rows)]
    sev_exact = [c.severity == r["expected_severity"] for c, r in zip(results, rows)]
    # P1 recall: of reports that should be P1 (expected severity >= 4), how many did we flag P1?
    should_p1 = [i for i, r in enumerate(rows) if r["expected_severity"] >= 4]
    p1_recall = sum(results[i].priority == "P1" for i in should_p1) / len(should_p1) if should_p1 else None
    lang_ok = [c.lang == r["lang"] for c, r in zip(results, rows)]

    # ---------- dedup: stream reports in time order, cluster greedily like the live pipeline
    use_emb = llm.available("emb")
    clusters: list[dict] = []  # {"cand": Candidate, "members": [idx]}
    order = sorted(range(n), key=lambda i: rows[i]["t_min"])
    for i in order:
        r, c = rows[i], results[i]
        at = t0 + timedelta(minutes=r["t_min"])
        hit = dedup.best_match(
            new_type=c.type, new_lat=r["lat"], new_lng=r["lng"], new_at=at, new_text=r["text"],
            candidates=[cl["cand"] for cl in clusters], use_embeddings=use_emb,
        )
        if hit:
            cl = next(cl for cl in clusters if cl["cand"] is hit[0])
            cl["members"].append(i)
            cl["cand"].texts.append(r["text"])
            cl["cand"].last_at = at
        else:
            clusters.append({
                "cand": dedup.Candidate(key=i, type=c.type, lat=r["lat"], lng=r["lng"], last_at=at, texts=[r["text"]]),
                "members": [i],
            })
    pred = {i: k for k, cl in enumerate(clusters) for i in cl["members"]}
    tp = fp = fn = 0
    for a, b in combinations(range(n), 2):
        same_true = rows[a]["dup_group"] == rows[b]["dup_group"]
        same_pred = pred[a] == pred[b]
        tp += same_true and same_pred
        fp += same_pred and not same_true
        fn += same_true and not same_pred
    precision = tp / (tp + fp) if tp + fp else 1.0
    recall = tp / (tp + fn) if tp + fn else 1.0

    from_cache = sum(1 for c in results if (c.model or "").startswith("cache:")) > n // 2
    out = {
        "n": n,
        "type_accuracy": round(sum(type_ok) / n, 3),
        "severity_within_1": round(sum(sev_ok) / n, 3),
        "severity_exact": round(sum(sev_exact) / n, 3),
        "p1_recall": round(p1_recall, 3) if p1_recall is not None else None,
        "lang_accuracy": round(sum(lang_ok) / n, 3),
        "dedup_precision": round(precision, 3),
        "dedup_recall": round(recall, 3),
        "true_incidents": len({r["dup_group"] for r in rows}),
        "predicted_incidents": len(clusters),
        # Cached runs are ~0 ms and would mislead the pitch; report null and flag it instead.
        "avg_latency_ms": None if from_cache else round(sum(latencies) / n),
        "from_cache": from_cache,
        "models": models,
        "answered_by": answered_by,
        "embeddings": use_emb,
        "llm_model": max(answered_by, key=answered_by.get) if answered_by else "rules",
        "openai_cost_usd": round(llm.spent_usd() - spend_before, 4),
        "run_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    if not args.no_save:
        OUT.write_text(json.dumps(out, indent=2))

    print(json.dumps(out, indent=2))
    if not args.quiet:
        bad = [(r, c) for r, c, ok in zip(rows, results, type_ok) if not ok]
        bad += [(r, c) for r, c, ok, tok in zip(rows, results, sev_ok, type_ok) if tok and not ok]
        if bad:
            print(f"\nMisses ({len(bad)}):")
            for r, c in bad:
                print(f"  #{r['id']:>2} expected {r['expected_type']}/{r['expected_severity']} "
                      f"got {c.type}/{c.severity} [{c.source_model}] — {r['text'][:70]}")
    print("\n(not saved)" if args.no_save else f"\nSaved → {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
