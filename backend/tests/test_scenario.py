"""Demo scenario tests (Task 14 data). Owner: BE1.

The scenario must drive the PRD §11 story deterministically even with AI off
(rule-based fallback, no embeddings): each "group" becomes exactly one incident.
"""
import codecs
import json
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models as m
from app import schemas as s
from app.config import get_settings
from app.db import Base
from app.seed import reset_database
from app.services.triage import apply_to_incident, triage

SCENARIO = Path(__file__).resolve().parents[1] / "app" / "data" / "scenario_ahmedabad_flood.json"
REPORT_FIELDS = set(s.ReportCreate.model_fields)
LAT_RANGE, LNG_RANGE = (22.90, 23.20), (72.40, 72.75)


def _scenario() -> dict:
    return json.loads(SCENARIO.read_text(encoding="utf-8"))


def _report_body(ev: dict) -> s.ReportCreate:
    return s.ReportCreate.model_validate({k: v for k, v in ev.items() if k in REPORT_FIELDS})


# ---------------------------------------------------------------- structure


def test_scenario_header():
    sc = _scenario()
    assert sc["scenario"] == "ahmedabad_flood"
    assert 25 <= len(sc["events"]) <= 40
    assert sc["events"][-1]["t_offset_sec"] <= sc["duration_sec"] <= 240


def test_every_event_is_a_valid_report():
    for ev in _scenario()["events"]:
        body = _report_body(ev)
        assert body.lat is not None and body.lng is not None, ev
        assert LAT_RANGE[0] < body.lat < LAT_RANGE[1] and LNG_RANGE[0] < body.lng < LNG_RANGE[1], ev


def test_only_known_extra_keys():
    allowed = REPORT_FIELDS | {"t_offset_sec", "group"}
    for ev in _scenario()["events"]:
        assert set(ev) <= allowed, set(ev) - allowed


def test_events_are_time_ordered_and_have_source():
    events = _scenario()["events"]
    offsets = [ev["t_offset_sec"] for ev in events]
    assert offsets == sorted(offsets) and offsets[0] == 0
    # warm_cache.py keys the AI cache on text + source, so every event must carry its source.
    assert all(ev.get("source") for ev in events)


def test_prd_story_beats_present():
    groups = Counter(ev["group"] for ev in _scenario()["events"])
    assert groups["akhbarnagar_flood"] == 7
    assert groups["cg_road_fire"] == 3
    assert groups["sg_highway_accident"] == 2
    for g in ("vasna_barrage", "vatva_gas_leak", "maninagar_medical", "behrampura_collapse", "riverfront_waterlogging"):
        assert groups[g] >= 1, g


def test_multilingual_and_multi_source():
    events = _scenario()["events"]
    assert {ev.get("lang") for ev in events if ev.get("text")} == {"en", "gu", "hi"}
    assert {ev["source"] for ev in events} == {"citizen", "call", "sensor", "field"}
    akh_langs = {ev["lang"] for ev in events if ev["group"] == "akhbarnagar_flood"}
    assert akh_langs == {"en", "gu", "hi"}


def test_matches_be2_warm_cache_format():
    """scripts/warm_cache.py reads {"events": [...]} (or a list) and warms items with "text" or "sensor"."""
    sc = _scenario()
    assert isinstance(sc["events"], list)
    assert all(isinstance(ev, dict) and (ev.get("text") or ev.get("sensor")) for ev in sc["events"])


def test_file_is_utf8_without_bom():
    raw = SCENARIO.read_bytes()
    assert not raw.startswith(codecs.BOM_UTF8)
    raw.decode("utf-8")  # Gujarati/Hindi text: readers must open it as UTF-8


# ---------------------------------------------------------------- behaviour with AI off


@pytest.fixture()
def db(monkeypatch):
    monkeypatch.setenv("AI_ENABLED", "false")
    get_settings.cache_clear()
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)

    @event.listens_for(eng, "connect")
    def _fk(dbapi_conn, _record):
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(eng)
    session = sessionmaker(bind=eng, expire_on_commit=False)()
    reset_database(session)
    yield session
    session.close()
    eng.dispose()
    get_settings.cache_clear()


def _ingest(db, body: s.ReportCreate, at: datetime) -> m.Incident:
    """BE2's triage() recipe (services/triage.py docstring), without summary/broadcast."""
    data = body.model_dump()
    data["sensor"] = body.sensor.model_dump() if body.sensor else None
    report = m.Report(**data, created_at=at)
    db.add(report)
    db.flush()
    t = triage(db, report)
    if t.match is None:
        inc = m.Incident(status="new", lat=t.lat, lng=t.lng, address=t.address, report_count=1, created_at=at)
        apply_to_incident(inc, t.classification, is_new=True)
        db.add(inc)
        db.flush()
        inc.code = f"INC-{inc.id:04d}"
    else:
        inc = t.match
        inc.report_count += 1
        apply_to_incident(inc, t.classification, is_new=False)
    report.incident_id = inc.id
    db.commit()
    return inc


def test_each_group_becomes_exactly_one_incident_offline(db):
    if get_settings().ai_available:
        pytest.skip("AI enabled; this test pins the offline (rule-based) behaviour")
    t0 = datetime.now(timezone.utc)
    group_to_incidents: dict[str, set[int]] = defaultdict(set)
    for ev in _scenario()["events"]:
        inc = _ingest(db, _report_body(ev), t0 + timedelta(seconds=ev["t_offset_sec"]))
        group_to_incidents[ev["group"]].add(inc.id)

    split = {g: ids for g, ids in group_to_incidents.items() if len(ids) != 1}
    assert not split, f"groups split across incidents: {split}"
    owners = Counter(next(iter(ids)) for ids in group_to_incidents.values())
    merged = [i for i, n in owners.items() if n > 1]
    assert not merged, f"different groups merged into one incident: {merged}"

    incidents = {i.id: i for i in db.query(m.Incident)}
    akh = incidents[next(iter(group_to_incidents["akhbarnagar_flood"]))]
    vatva = incidents[next(iter(group_to_incidents["vatva_gas_leak"]))]
    assert akh.report_count == 7 and akh.type == "flood" and akh.priority == "P1"
    assert vatva.type == "industrial" and vatva.priority == "P1"  # the undispatched P1 that escalates
