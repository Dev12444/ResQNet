"""Model tests (Task 1). Owner: BE1.

Runs against an isolated in-memory SQLite DB with foreign keys enforced,
matching how app.db configures SQLite.
"""
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine, event, inspect, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models as m
from app.db import Base

TABLES = {"incidents", "reports", "resources", "facilities", "assignments", "alerts", "audit_log"}


@pytest.fixture()
def engine():
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)

    @event.listens_for(eng, "connect")
    def _fk(dbapi_conn, _record):
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(eng)
    yield eng
    eng.dispose()


@pytest.fixture()
def db(engine):
    session = sessionmaker(bind=engine, expire_on_commit=False)()
    yield session
    session.close()


def _incident(**kw) -> m.Incident:
    data = dict(type="flood", severity=4, priority="P1", title="Car trapped in underpass", lat=23.0496, lng=72.5621)
    data.update(kw)
    return m.Incident(**data)


def _resource(**kw) -> m.Resource:
    data = dict(callsign="NDRF-BOAT-01", kind="rescue_boat", lat=23.03, lng=72.577, base="Riverfront")
    data.update(kw)
    return m.Resource(**data)


def test_all_tables_created(engine):
    assert TABLES <= set(inspect(engine).get_table_names())


def test_defaults_applied(db):
    inc = _incident()
    res = _resource()
    db.add_all([inc, res])
    db.flush()
    a = m.Assignment(incident_id=inc.id, resource_id=res.id)
    al = m.Alert(incident_id=inc.id, kind="critical", message="P1 flood")
    db.add_all([a, al])
    db.commit()

    assert inc.status == "new" and inc.report_count == 1
    assert inc.hazards == [] and inc.ai_actions == []
    assert inc.created_at is not None and inc.updated_at is not None
    assert res.status == "available" and res.capabilities == []
    assert a.status == "assigned" and a.approved_by == "dispatcher" and a.on_scene_at is None
    assert al.acknowledged is False


def test_code_assigned_after_flush_and_unique(db):
    inc = _incident()
    db.add(inc)
    db.flush()
    inc.code = f"INC-{inc.id:04d}"
    db.commit()
    assert db.scalar(select(m.Incident.code)) == "INC-0001"

    db.add(_incident(code="INC-0001"))
    with pytest.raises(IntegrityError):
        db.commit()


def test_datetimes_are_utc_aware_after_roundtrip(engine, db):
    ist = timezone(timedelta(hours=5, minutes=30))
    local = datetime(2026, 9, 19, 14, 12, tzinfo=ist)
    db.add(_incident(created_at=local, dispatched_at=datetime(2026, 9, 19, 8, 45)))  # naive = UTC
    db.commit()

    fresh = sessionmaker(bind=engine)()
    inc = fresh.scalars(select(m.Incident)).one()
    assert inc.created_at == datetime(2026, 9, 19, 8, 42, tzinfo=timezone.utc)
    assert inc.created_at.tzinfo is not None
    assert inc.dispatched_at == datetime(2026, 9, 19, 8, 45, tzinfo=timezone.utc)
    fresh.close()


def test_updated_at_changes_on_update(db):
    old = datetime.now(timezone.utc) - timedelta(minutes=5)
    inc = _incident(updated_at=old)
    db.add(inc)
    db.commit()
    inc.status = "triaged"
    db.commit()
    assert inc.updated_at > old


def test_json_list_in_place_mutation_persists(engine, db):
    inc = _incident(hazards=["rising_water"])
    db.add(inc)
    db.commit()
    inc.hazards.append("trapped_people")
    db.commit()

    fresh = sessionmaker(bind=engine)()
    assert fresh.scalars(select(m.Incident)).one().hazards == ["rising_water", "trapped_people"]
    fresh.close()


def test_relationships_and_ordering(db):
    t0 = datetime(2026, 9, 19, 8, 0, tzinfo=timezone.utc)
    inc = _incident()
    db.add(inc)
    db.flush()
    db.add_all([
        m.Report(source="call", text="second", incident_id=inc.id, created_at=t0 + timedelta(minutes=2)),
        m.Report(source="citizen", text="first", incident_id=inc.id, created_at=t0),
        m.Alert(incident_id=inc.id, kind="critical", message="old", created_at=t0),
        m.Alert(incident_id=inc.id, kind="sla_breach", message="new", created_at=t0 + timedelta(minutes=3)),
    ])
    db.commit()
    db.expire_all()

    assert [r.text for r in inc.reports] == ["first", "second"]  # oldest first
    assert [a.message for a in inc.alerts] == ["new", "old"]  # newest first
    assert inc.reports[0].incident is inc


def test_assignment_links_resource_and_alert_exposes_incident_code(db):
    inc = _incident(code="INC-0007")
    res = _resource()
    db.add_all([inc, res])
    db.flush()
    a = m.Assignment(incident_id=inc.id, resource_id=res.id, eta_min=9)
    al = m.Alert(incident_id=inc.id, kind="sla_breach", message="late")
    shortage = m.Alert(kind="shortage", message="No hazmat available")
    db.add_all([a, al, shortage])
    db.commit()

    assert a.resource.callsign == "NDRF-BOAT-01" and a.is_active
    assert inc.assignments == [a] and res.assignments == [a]
    assert al.incident_code == "INC-0007"
    assert shortage.incident_code is None


def test_report_is_stored_before_linking(db):
    r = m.Report(source="sensor", sensor={"sensor_id": "VASNA-WL-01", "value": 4.9, "threshold": 4.2})
    db.add(r)
    db.commit()
    assert r.id is not None and r.incident_id is None and r.sensor["value"] == 4.9


@pytest.mark.parametrize(
    "factory",
    [
        lambda: _incident(type="tsunami"),
        lambda: _incident(status="closed"),
        lambda: _incident(priority="P0"),
        lambda: _incident(severity=6),
        lambda: _incident(severity=0),
        lambda: _resource(kind="helicopter"),
        lambda: _resource(status="sleeping"),
        lambda: m.Report(source="email", text="x"),
        lambda: m.Facility(name="X", kind="school", lat=23.0, lng=72.5),
        lambda: m.Facility(name="X", kind="hospital", lat=23.0, lng=72.5, beds_total=10, beds_available=11),
        lambda: m.Facility(name="X", kind="hospital", lat=23.0, lng=72.5, beds_total=10, beds_available=-1),
        lambda: m.Alert(kind="info", message="x"),
    ],
)
def test_check_constraints_reject_invalid_values(db, factory):
    db.add(factory())
    with pytest.raises(IntegrityError):
        db.commit()


def test_invalid_assignment_status_rejected(db):
    inc, res = _incident(), _resource()
    db.add_all([inc, res])
    db.flush()
    db.add(m.Assignment(incident_id=inc.id, resource_id=res.id, status="lost"))
    with pytest.raises(IntegrityError):
        db.commit()


def test_callsign_unique(db):
    db.add_all([_resource(), _resource()])
    with pytest.raises(IntegrityError):
        db.commit()


def test_foreign_key_enforced(db):
    db.add(m.Assignment(incident_id=999, resource_id=999))
    with pytest.raises(IntegrityError):
        db.commit()


def test_fire_station_has_null_beds(db):
    db.add(m.Facility(name="Danapith Fire Station", kind="fire_station", lat=23.02, lng=72.58))
    db.commit()
    f = db.scalars(select(m.Facility)).one()
    assert f.beds_total is None and f.beds_available is None and f.specialties == []


def test_enum_constants_match_contract():
    assert m.OPEN_INCIDENT_STATUSES == tuple(s for s in m.INCIDENT_STATUSES if s != "resolved")
    assert set(m.ACTIVE_ASSIGNMENT_STATUSES) < set(m.ASSIGNMENT_STATUSES)


def test_audit_log_row(db):
    db.add(m.AuditLog(actor="dispatcher", action="dispatch", entity="incident", entity_id=7, payload={"ids": [3]}))
    db.commit()
    row = db.scalars(select(m.AuditLog)).one()
    assert row.payload == {"ids": [3]} and row.created_at.tzinfo is not None


def test_deleting_incident_cascades_and_unlinks(db):
    inc, res = _incident(), _resource()
    db.add_all([inc, res])
    db.flush()
    rep = m.Report(source="citizen", text="flood", incident_id=inc.id)
    db.add_all([
        rep,
        m.Assignment(incident_id=inc.id, resource_id=res.id),
        m.Alert(incident_id=inc.id, kind="critical", message="x"),
    ])
    db.commit()

    db.delete(inc)
    db.commit()
    db.expire_all()
    assert db.scalar(select(m.Assignment)) is None
    assert db.scalar(select(m.Alert)) is None
    assert db.get(m.Report, rep.id).incident_id is None  # raw report kept, just unlinked
    assert db.get(m.Resource, res.id) is not None


def test_ai_derived_text_columns_are_unbounded():
    """title/address can come from the LLM; Postgres would reject an over-long VARCHAR and lose the report."""
    from sqlalchemy import Text

    for col in (m.Incident.__table__.c.title, m.Incident.__table__.c.address, m.Report.__table__.c.address):
        assert isinstance(col.type, Text) and col.type.length is None, col


def test_long_llm_location_is_stored(db):
    inc = _incident(title="T" * 1000, address="A" * 5000)
    db.add(inc)
    db.commit()
    assert len(db.get(m.Incident, inc.id).address) == 5000
