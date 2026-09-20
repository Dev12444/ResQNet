"""Active warnings derived from incidents and sensors.

The rule this endpoint exists to keep: a warning may describe only something
ResQNet was actually told about, and it may never be attributed to a weather
authority. The fixtures it replaced carried "IMD Ahmedabad" on fabricated
cyclone bulletins.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models as m
from app.db import Base, get_db
from app.main import app


@pytest.fixture()
def _env():
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)

    @event.listens_for(eng, "connect")
    def _fk(dbapi_conn, _record):
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(eng)
    Session = sessionmaker(bind=eng, expire_on_commit=False)

    def _db():
        s = Session()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[get_db] = _db
    with TestClient(app) as c:
        yield c, Session
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture()
def client(_env):
    return _env[0]


@pytest.fixture()
def db(_env):
    with _env[1]() as s:
        yield s


def _incident(db, **kw):
    defaults = dict(
        code="INC-9001",
        type="flood",
        severity=4,
        priority="P1",
        status="new",
        title="Flooding at Akhbarnagar Underpass",
        lat=23.05,
        lng=72.57,
        address="Akhbarnagar Underpass, Naranpura, Ahmedabad",
        ai_summary="Water rising in the underpass.",
        report_count=1,
        created_at=datetime.now(timezone.utc),
    )
    defaults.update(kw)
    inc = m.Incident(**defaults)
    db.add(inc)
    db.commit()
    return inc


def test_empty_when_nothing_reported(client):
    assert client.get("/api/weather/alerts").json() == []


def test_open_incident_becomes_a_warning(client, db):
    _incident(db)
    body = client.get("/api/weather/alerts").json()
    assert len(body) == 1
    a = body[0]
    assert a["disaster"] == "flood"
    assert a["severity"] == "critical"
    assert a["district"] == "Ahmedabad"
    assert a["headline"] == "Flooding at Akhbarnagar Underpass"


def test_never_attributed_to_a_weather_authority(client, db):
    _incident(db)
    for a in client.get("/api/weather/alerts").json():
        assert a["source"].startswith("ResQNet")
        for name in ("IMD", "India Meteorological", "NDMA", "Met Department"):
            assert name not in a["source"]


def test_resolved_and_minor_incidents_are_not_warnings(client, db):
    _incident(db, code="INC-9002", status="resolved")
    _incident(db, code="INC-9003", severity=2, title="Minor waterlogging")
    assert client.get("/api/weather/alerts").json() == []


def test_sensor_past_threshold_becomes_a_warning(client, db):
    db.add(
        m.Report(
            source="sensor",
            text="Vasna barrage above danger mark",
            address="Vasna Barrage, Ahmedabad",
            sensor={
                "sensor_id": "VASNA-WL-01",
                "metric": "water_level_m",
                "value": 4.9,
                "threshold": 4.2,
                "unit": "m",
            },
            created_at=datetime.now(timezone.utc),
        )
    )
    db.commit()
    body = client.get("/api/weather/alerts").json()
    assert [a["id"] for a in body] == ["WA-SEN-VASNA-WL-01"]
    # The unit suffix is stripped from the metric name, or it reads "water level m at 4.9m".
    assert "water level at 4.9m" in body[0]["detail"]
    assert body[0]["source"] == "ResQNet — sensor VASNA-WL-01"


def test_sensor_below_threshold_is_not_a_warning(client, db):
    db.add(
        m.Report(
            source="sensor",
            text="Sabarmati level normal",
            address="Sabarmati Riverfront, Ahmedabad",
            sensor={
                "sensor_id": "SABAR-WL-03",
                "metric": "water_level_m",
                "value": 3.1,
                "threshold": 4.2,
                "unit": "m",
            },
            created_at=datetime.now(timezone.utc),
        )
    )
    db.commit()
    assert client.get("/api/weather/alerts").json() == []


def test_district_filter(client, db):
    _incident(db, code="INC-9004")
    _incident(db, code="INC-9005", address="Jakhau Port Road, Kutch", title="Coastal surge")
    assert len(client.get("/api/weather/alerts").json()) == 2
    kutch = client.get("/api/weather/alerts", params={"district": "Kutch"}).json()
    assert [a["headline"] for a in kutch] == ["Coastal surge"]


def test_newest_first(client, db):
    now = datetime.now(timezone.utc)
    _incident(db, code="INC-9006", title="Older", created_at=now - timedelta(hours=2))
    _incident(db, code="INC-9007", title="Newer", created_at=now)
    assert [a["headline"] for a in client.get("/api/weather/alerts").json()] == ["Newer", "Older"]
