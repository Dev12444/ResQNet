"""Seed data + reset tests (Task 5). Owner: BE1."""
import json
import os
import subprocess
import sys
from collections import Counter
from pathlib import Path

import pytest
from sqlalchemy import create_engine, event, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models as m
from app.db import Base
from app.seed import DATA_DIR, SeedData, SeedError, SeedResource, load_seed, reset_database
from app.services import recommender

BACKEND = Path(__file__).resolve().parents[1]
# Greater Ahmedabad incl. Gandhinagar side (Apollo, Bhat).
LAT_RANGE, LNG_RANGE = (22.90, 23.20), (72.40, 72.75)
# API_CONTRACT.md §1 capability map.
NEEDED_KINDS = {"rescue_boat", "ndrf_team", "ambulance", "fire_truck", "police", "hazmat"}


@pytest.fixture()
def db():
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)

    @event.listens_for(eng, "connect")
    def _fk(dbapi_conn, _record):
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(eng)
    session = sessionmaker(bind=eng, expire_on_commit=False)()
    yield session
    session.close()
    eng.dispose()


def _count(db, model) -> int:
    return db.scalar(select(func.count()).select_from(model))


# ---------------------------------------------------------------- seed file quality


def test_seed_files_are_valid():
    data = load_seed()
    assert 20 <= len(data.resources) <= 40
    assert len([f for f in data.facilities if f.kind == "hospital"]) >= 8


def test_every_needed_kind_has_units():
    kinds = Counter(r.kind for r in load_seed().resources)
    assert set(kinds) == NEEDED_KINDS
    assert kinds["ambulance"] >= 8 and kinds["rescue_boat"] >= 4 and kinds["fire_truck"] >= 3


def test_workflow_callsigns_present():
    callsigns = {r.callsign for r in load_seed().resources}
    assert {f"108-AMD-{i:02d}" for i in range(1, 11)} <= callsigns


def test_all_locations_inside_ahmedabad():
    data = load_seed()
    for item in [*data.resources, *data.facilities]:
        assert LAT_RANGE[0] < item.lat < LAT_RANGE[1] and LNG_RANGE[0] < item.lng < LNG_RANGE[1], item


def test_facilities_cover_flood_and_hospital_needs():
    data = load_seed()
    kinds = Counter(f.kind for f in data.facilities)
    assert kinds["shelter"] >= 3 and kinds["fire_station"] >= 3
    assert all(f.beds_total is None for f in data.facilities if f.kind == "fire_station")
    assert all(f.beds_available > 0 for f in data.facilities if f.kind in ("hospital", "shelter"))


# ---------------------------------------------------------------- load_seed validation


def _write(tmp_path, resources, facilities):
    (tmp_path / "seed_resources.json").write_text(json.dumps(resources), encoding="utf-8")
    (tmp_path / "seed_facilities.json").write_text(json.dumps(facilities), encoding="utf-8")
    return tmp_path


GOOD_RES = {"callsign": "X-1", "kind": "ambulance", "lat": 23.0, "lng": 72.5}
GOOD_FAC = {"name": "H", "kind": "hospital", "lat": 23.0, "lng": 72.5, "beds_total": 10, "beds_available": 5}


@pytest.mark.parametrize(
    ("resources", "facilities"),
    [
        ([GOOD_RES, GOOD_RES], [GOOD_FAC]),                                        # duplicate callsign
        ([GOOD_RES], [GOOD_FAC, GOOD_FAC]),                                        # duplicate facility
        ([{**GOOD_RES, "kind": "helicopter"}], [GOOD_FAC]),                        # bad kind
        ([{**GOOD_RES, "lat": 123}], [GOOD_FAC]),                                  # bad coordinate
        ([{**GOOD_RES, "colour": "red"}], [GOOD_FAC]),                             # unknown field
        ([GOOD_RES], [{**GOOD_FAC, "beds_available": 11}]),                        # more free beds than total
        ([GOOD_RES], [{**GOOD_FAC, "beds_available": None}]),                      # half-set beds
        ([GOOD_RES], [{**GOOD_FAC, "kind": "fire_station"}]),                      # fire station with beds
        ([], [GOOD_FAC]),                                                          # empty
    ],
)
def test_load_seed_rejects_bad_data(tmp_path, resources, facilities):
    with pytest.raises(SeedError):
        load_seed(_write(tmp_path, resources, facilities))


def test_load_seed_rejects_missing_or_broken_files(tmp_path):
    with pytest.raises(SeedError):
        load_seed(tmp_path)
    (tmp_path / "seed_resources.json").write_text("[{", encoding="utf-8")
    (tmp_path / "seed_facilities.json").write_text("[]", encoding="utf-8")
    with pytest.raises(SeedError):
        load_seed(tmp_path)


# ---------------------------------------------------------------- reset_database


def test_reset_inserts_seed(db):
    data = load_seed()
    counts = reset_database(db)
    assert counts == {"resources": len(data.resources), "facilities": len(data.facilities)}
    assert _count(db, m.Resource) == len(data.resources)
    assert db.scalar(select(func.count()).where(m.Resource.status != "available")) == 0


def test_reset_is_idempotent_and_ids_restart(db):
    reset_database(db)
    first = {r.callsign: r.id for r in db.scalars(select(m.Resource))}
    reset_database(db)
    second = {r.callsign: r.id for r in db.scalars(select(m.Resource))}
    assert first == second and min(second.values()) == 1


def test_reset_wipes_all_demo_events(db):
    reset_database(db)
    res = db.scalars(select(m.Resource)).first()
    inc = m.Incident(code="INC-0001", type="flood", severity=4, priority="P1", title="t")
    db.add(inc)
    db.flush()
    res.status, res.current_incident_id = "assigned", inc.id
    db.add_all([
        m.Report(source="citizen", text="x", incident_id=inc.id),
        m.Assignment(incident_id=inc.id, resource_id=res.id),
        m.Alert(incident_id=inc.id, kind="critical", message="x"),
        m.AuditLog(action="dispatch", entity="incident", entity_id=inc.id),
    ])
    db.commit()

    reset_database(db)
    for model in (m.Incident, m.Report, m.Assignment, m.Alert, m.AuditLog):
        assert _count(db, model) == 0, model
    assert db.scalar(select(func.count()).where(m.Resource.status != "available")) == 0

    db.add(m.Incident(type="fire", severity=3, priority="P2", title="t"))
    db.commit()
    assert db.scalar(select(m.Incident.id)) == 1  # INC-0001 again after a demo reset


def test_reset_with_objects_already_loaded_in_session(db):
    """Regression: stale objects from before the wipe must not clash with reseeded rows (same ids)."""
    import warnings

    from sqlalchemy.exc import SAWarning

    reset_database(db)
    old = db.scalars(select(m.Resource)).all()
    inc = m.Incident(type="flood", severity=4, priority="P1", title="t")
    db.add(inc)
    db.commit()
    with warnings.catch_warnings():
        warnings.simplefilter("error", SAWarning)
        reset_database(db)
        db.add(m.Incident(type="fire", severity=3, priority="P2", title="t"))
        db.commit()
    fresh = db.scalars(select(m.Resource)).all()
    assert {r.id for r in fresh} == {r.id for r in old}
    assert not any(r in db for r in old)  # stale objects detached, not reused


def test_reset_is_atomic_on_failure(db):
    reset_database(db)
    before = _count(db, m.Resource)
    dup = SeedResource(callsign="DUP", kind="police", lat=23.0, lng=72.5)
    bad = SeedData(resources=[dup, dup], facilities=load_seed().facilities)  # unique violation on insert
    with pytest.raises(IntegrityError):
        reset_database(db, bad)
    assert _count(db, m.Resource) == before  # old data survived the failed reset


def test_invalid_seed_files_leave_db_untouched(db, tmp_path, monkeypatch):
    reset_database(db)
    before = _count(db, m.Resource)
    monkeypatch.setattr("app.seed.DATA_DIR", _write(tmp_path, [GOOD_RES, GOOD_RES], [GOOD_FAC]))
    with pytest.raises(SeedError):
        reset_database(db, load_seed(tmp_path))
    assert _count(db, m.Resource) == before


# ---------------------------------------------------------------- BE2 recommender on real seed


@pytest.mark.parametrize(
    ("type_", "lat", "lng", "facility_kind"),
    [
        ("flood", 23.0588, 72.5620, "shelter"),          # Akhbarnagar underpass
        ("industrial", 22.9660, 72.6300, "hospital"),    # Vatva GIDC gas leak
        ("fire", 23.0290, 72.5600, "hospital"),          # C.G. Road
        ("building_collapse", 22.9990, 72.5810, "hospital"),  # Behrampura
    ],
)
def test_recommender_finds_units_for_demo_incidents(db, type_, lat, lng, facility_kind):
    reset_database(db)
    inc = m.Incident(code="INC-0001", type=type_, severity=4, priority="P1", title="t", lat=lat, lng=lng, hazards=[])
    db.add(inc)
    db.commit()
    rec = recommender.build_recommendation(inc, db.scalars(select(m.Resource)).all(),
                                           db.scalars(select(m.Facility)).all(), with_llm=False)
    assert rec["shortages"] == []
    assert len(rec["suggested_resource_ids"]) == len(rec["needed_kinds"])
    assert rec["facility"]["facility"]["kind"] == facility_kind


# ---------------------------------------------------------------- CLI


def _run_cli(tmp_path, url, *args):
    env = {**os.environ, "DATABASE_URL": url, "AI_ENABLED": "false"}
    return subprocess.run([sys.executable, "-m", "scripts.seed", *args], cwd=BACKEND, env=env,
                          capture_output=True, text=True, timeout=120)


def test_cli_seeds_sqlite_twice(tmp_path):
    url = f"sqlite:///{(tmp_path / 'cli.db').as_posix()}"
    for _ in range(2):
        r = _run_cli(tmp_path, url)
        assert r.returncode == 0, r.stderr
        assert "25 resources" in r.stdout and "18 facilities" in r.stdout


def test_cli_refuses_remote_db_without_yes_and_hides_password(tmp_path):
    r = _run_cli(tmp_path, "postgresql://neon_user:s3cret-pw@ep-x.neon.tech/neondb?sslmode=require")
    assert r.returncode == 2
    assert "--yes" in r.stderr and "s3cret-pw" not in r.stderr + r.stdout


def test_seed_file_location():
    assert DATA_DIR == BACKEND / "app" / "data"
