"""End-to-end AI dry run: reports → triage → incidents → recommendations → trust → insights. Owner: BE2.

Runs the exact pipeline recipe from app/services/triage.py against a throwaway SQLite DB seeded with
BE1's real resources/facilities, so the whole AI chain can be checked before (and independently of)
the POST /api/reports router. Also a reference implementation for BE1's pipeline.

Usage (from backend/):
    python -m scripts.dry_run                       # BE1 scenario if it has events, else the eval set
    python -m scripts.dry_run path/to/events.json   # list of {text, source, lat?, lng?, sensor?, t_offset_sec|t_min}
    python -m scripts.dry_run --no-ai               # keyword rules only (free, offline)
    python -m scripts.dry_run --json out.json       # also dump incidents + recommendations for FE mocks

Never touches DATABASE_URL.
"""
from __future__ import annotations

import argparse
import json
import sys
import tempfile
import time
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
DATA = ROOT / "app" / "data"


def _events(path: Path | None) -> tuple[str, list[dict]]:
    candidates = [path] if path else [DATA / "scenario_ahmedabad_flood.json", DATA / "eval_incidents.json"]
    for p in candidates:
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, ValueError) as e:
            if path:
                sys.exit(f"cannot read {p}: {e}")
            continue
        if isinstance(data, dict):
            data = data.get("events") or data.get("reports") or []
        events = [x for x in data if isinstance(x, dict) and (x.get("text") or x.get("sensor"))]
        if events:
            return p.name, events
    sys.exit("no events found")


def _offset_sec(ev: dict) -> float:
    if "t_offset_sec" in ev:
        return float(ev["t_offset_sec"])
    return float(ev.get("t_min", 0)) * 60


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("file", nargs="?", type=Path)
    ap.add_argument("--no-ai", action="store_true", help="keyword rules only")
    ap.add_argument("--json", type=Path, help="write incidents + recommendations here")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    from app.config import get_settings

    st = get_settings()
    if args.no_ai:
        st.ai_enabled = False

    from sqlalchemy import create_engine, select
    from sqlalchemy.orm import sessionmaker

    from app import models as m
    from app.db import Base
    from app.seed import reset_database
    from app.services import insights, llm, recommender, trust
    from app.services.triage import apply_to_incident, refresh_summary, triage

    name, events = _events(args.file)
    events.sort(key=_offset_sec)
    tmp = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
    engine = create_engine(f"sqlite:///{tmp.name}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)()
    counts = reset_database(db)
    print(f"{name}: {len(events)} events · seeded {counts} · AI {'on' if st.ai_available else 'off (rules)'}")

    t0 = datetime.now(timezone.utc) - timedelta(seconds=_offset_sec(events[-1]) + 60)
    seq = 0
    answered = Counter()
    lat_ms: list[float] = []
    for ev in events:
        now = t0 + timedelta(seconds=_offset_sec(ev))
        report = m.Report(source=ev.get("source", "citizen"), text=ev.get("text"), lang=ev.get("lang"),
                          lat=ev.get("lat"), lng=ev.get("lng"), sensor=ev.get("sensor"),
                          reporter=ev.get("reporter"), created_at=now)
        db.add(report)
        db.flush()
        start = time.perf_counter()
        t = triage(db, report)
        lat_ms.append((time.perf_counter() - start) * 1000)
        cls = t.classification
        answered[cls.model or cls.source_model] += 1
        report.lat, report.lng, report.lang, report.ai_json = t.lat, t.lng, cls.lang, cls.to_dict()
        if t.match is None:
            seq += 1
            incident = m.Incident(code=f"INC-{seq:04d}", status="new", lat=t.lat, lng=t.lng, address=t.address,
                                  report_count=1, created_at=now, type=cls.type, severity=cls.severity,
                                  priority=cls.priority, title=cls.title)
            apply_to_incident(incident, cls, is_new=True)
            db.add(incident)
            db.flush()
        else:
            incident = t.match
            incident.report_count = (incident.report_count or 1) + 1
            apply_to_incident(incident, cls, is_new=False)
        report.incident_id = incident.id
        db.flush()
        db.refresh(incident)
        refresh_summary(incident, force=True)
        db.commit()
        if not args.quiet:
            verb = "NEW  " if t.match is None else "MERGE"
            where = "≈centre" if t.approximate else ("geocoded" if t.geocoded else "gps")
            print(f"  +{_offset_sec(ev) / 60:5.1f}m {verb} {incident.code} {cls.type:17} S{cls.severity} {cls.priority}"
                  f"  [{where:8}] {(ev.get('text') or ev.get('sensor', {}).get('sensor_id', ''))[:60]}")

    incidents = db.scalars(select(m.Incident).order_by(m.Incident.id)).all()
    resources = db.scalars(select(m.Resource)).all()
    facilities = db.scalars(select(m.Facility)).all()
    reports = db.scalars(select(m.Report)).all()

    print(f"\n{len(events)} reports → {len(incidents)} incidents "
          f"(P1: {sum(i.priority == 'P1' for i in incidents)}) · triage avg {sum(lat_ms) / len(lat_ms):.0f} ms · "
          f"answered by {dict(answered)}")
    groups = {}
    for ev, r in zip(events, sorted(reports, key=lambda r: r.id)):
        if ev.get("dup_group") or ev.get("group"):
            groups.setdefault(ev.get("dup_group") or ev["group"], set()).add(r.incident_id)
    if groups:
        split = {g: len(ids) for g, ids in groups.items() if len(ids) > 1}
        owners = Counter(i for ids in groups.values() for i in ids)
        mixed = [i for i, n in owners.items() if n > 1]
        print(f"dup groups: {len(groups)} labelled → {len(split)} split {split or ''} · {len(mixed)} incidents mix groups")

    dump = []
    for inc in incidents:
        rec = recommender.build_recommendation(inc, resources, facilities, with_llm=not args.no_ai)
        tr = trust.incident_trust(inc, [r for r in reports if r.incident_id == inc.id])
        units = ", ".join(
            f"{recs[0]['resource']['callsign']}({recs[0]['eta_min']}m{'+' + '/'.join(recs[0]['matched_capabilities']) if recs[0]['matched_capabilities'] else ''})"
            for recs in rec["recommendations"].values() if recs)
        fac = rec["facility"]["facility"]["name"] if rec["facility"] else "-"
        print(f"\n{inc.code} {inc.priority} S{inc.severity} {inc.type} ×{inc.report_count} · {inc.address or ''} · "
              f"trust={tr['verification']}{' ⚠' + ','.join(c['field'] for c in tr['conflicts']) if tr['conflicts'] else ''}")
        print(f"  {inc.title}")
        if inc.ai_summary:
            print(f"  summary: {inc.ai_summary}")
        print(f"  units: {units or '-'}{' · SHORT: ' + ','.join(rec['shortages']) if rec['shortages'] else ''} · → {fac}")
        dump.append({"incident": {c.name: getattr(inc, c.name) for c in inc.__table__.columns},
                     "recommendation": rec, "trust": tr})

    ins = insights.compute_insights(incidents, reports, resources)
    print(f"\ninsights ({len(ins)}):")
    for i in ins:
        print(f"  [{i['severity']}] {i['headline']}")
    spend = llm.spend_status()
    print(f"\nOpenAI spend so far: ${spend.get('openai_spent_usd', 0):.4f} of ${spend.get('openai_budget_usd', 0):.2f}")

    if args.json:
        args.json.write_text(json.dumps({"incidents": dump, "insights": ins}, default=str, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"wrote {args.json}")
    db.close()
    Path(tmp.name).unlink(missing_ok=True)


if __name__ == "__main__":
    main()
