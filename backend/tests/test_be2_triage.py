"""triage() end-to-end with the pipeline recipe from app/services/triage.py (AI off). Owner: BE2."""
import os
from datetime import datetime, timedelta, timezone

os.environ["AI_ENABLED"] = "false"

import pytest  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

import app.models as real_models  # noqa: E402
from app.services.triage import apply_to_incident, refresh_summary, triage  # noqa: E402
from tests.be2_models import Base, models  # noqa: E402


@pytest.fixture()
def db(monkeypatch):
    if models is not real_models:
        monkeypatch.setattr(real_models, "Incident", models.Incident, raising=False)
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    s = sessionmaker(bind=engine, expire_on_commit=False)()
    yield s
    s.close()


def ingest(db, now, **payload):
    """Exactly the recipe BE1 is given in triage.py's docstring."""
    report = models.Report(created_at=now, **payload)
    db.add(report)
    db.flush()
    t = triage(db, report)
    report.lat, report.lng = t.lat, t.lng
    report.lang = t.classification.lang
    is_new = t.match is None
    if is_new:
        n = db.query(models.Incident).count() + 1
        incident = models.Incident(code=f"INC-{n:04d}", status="new", lat=t.lat, lng=t.lng,
                                   address=t.address, report_count=1, created_at=now)
        apply_to_incident(incident, t.classification, is_new=True)
        db.add(incident)
        db.flush()
    else:
        incident = t.match
        incident.report_count = (incident.report_count or 1) + 1
        apply_to_incident(incident, t.classification, is_new=False)
    report.incident_id = incident.id
    db.flush()
    db.refresh(incident)
    refresh_summary(incident, force=True)
    db.commit()
    return incident, is_new, t


def test_scenario_merges_duplicates_and_keeps_distinct_incidents(db):
    t0 = datetime.now(timezone.utc)
    a, new_a, _ = ingest(db, t0, source="citizen", text="Car stuck in Akhbarnagar underpass, water rising", lat=23.0588, lng=72.5620)
    b, new_b, _ = ingest(db, t0 + timedelta(minutes=1), source="call", text="અખબારનગર અંડરપાસમાં ગાડી ફસાઈ છે", lat=23.0592, lng=72.5617)
    c, new_c, t = ingest(db, t0 + timedelta(minutes=2), source="citizen", text="वटवा जीआईडीसी में गैस रिसाव")  # no GPS
    d, new_d, _ = ingest(db, t0 + timedelta(minutes=3), source="citizen", text="Fire at a shop on CG Road", lat=23.0290, lng=72.5600)

    assert new_a and not new_b and b.id == a.id           # duplicate merged
    assert a.report_count == 2 and len(a.reports) == 2
    assert a.priority == "P1" and "trapped_people" in a.hazards
    assert new_c and t.geocoded and c.address == "Vatva GIDC"   # located from text via gazetteer
    assert c.type == "industrial" and c.priority == "P1"
    assert new_d and d.type == "fire"
    assert a.ai_summary and a.ai_actions
    assert db.query(models.Incident).count() == 3


def test_unlocatable_report_goes_to_city_centre_and_never_merges(db):
    t0 = datetime.now(timezone.utc)
    x, _, tx = ingest(db, t0, source="citizen", text="Help, fire in my building!")
    y, new_y, ty = ingest(db, t0 + timedelta(minutes=1), source="citizen", text="Help, fire in my building!")
    assert tx.approximate and ty.approximate and new_y and x.id != y.id
    assert x.confidence <= 0.4


def test_merge_never_downgrades_severity(db):
    t0 = datetime.now(timezone.utc)
    a, _, _ = ingest(db, t0, source="call", text="Wall collapsed in Behrampura, people under rubble", lat=22.999, lng=72.581)
    sev = a.severity
    b, new_b, _ = ingest(db, t0 + timedelta(minutes=2), source="citizen", text="Behrampura wall fell", lat=22.9992, lng=72.5812)
    assert not new_b and b.severity == sev and b.priority == "P1"
