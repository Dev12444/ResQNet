"""BE2 router tests (ai + analytics) against an in-memory SQLite DB. Owner: BE2.

If BE1's real `app.models` isn't implemented yet, a stand-in with the contract's
field names is injected so these routes can still be exercised end-to-end.
"""
import os
import sys
from datetime import datetime, timedelta, timezone

os.environ["AI_ENABLED"] = "false"

import pytest  # noqa: E402
from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

import app.models as real_models  # noqa: E402
from tests.be2_models import Base, models  # noqa: E402


@pytest.fixture()
def client(monkeypatch):
    if models is not real_models:
        for name in ("Incident", "Report", "Resource", "Facility", "Assignment", "Alert"):
            monkeypatch.setattr(real_models, name, getattr(models, name), raising=False)
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, expire_on_commit=False)
    _seed(Session())

    from app.db import get_db
    from app.routers import ai, analytics

    app = FastAPI()
    app.include_router(ai.router)
    app.include_router(analytics.router)

    def _db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _db
    return TestClient(app)


def _seed(db):
    now = datetime.now(timezone.utc)
    t0 = now - timedelta(minutes=10)
    inc = models.Incident(
        id=1, code="INC-0001", type="flood", severity=4, priority="P1", status="dispatched",
        title="Car trapped in Akhbarnagar underpass", lat=23.0588, lng=72.5620, address="Akhbarnagar Underpass",
        hazards=["trapped_people", "rising_water"], report_count=2, created_at=t0, updated_at=now,
        dispatched_at=t0 + timedelta(seconds=80),
    )
    db.add(inc)
    db.add_all([
        models.Report(id=1, source="citizen", text="Car stuck in Akhbarnagar underpass", lang="en",
                      lat=23.0588, lng=72.5620, incident_id=1, created_at=t0),
        models.Report(id=2, source="call", text="અખબારનગર અંડરપાસમાં ગાડી ફસાઈ છે", lang="gu",
                      lat=23.0590, lng=72.5622, incident_id=1, created_at=t0 + timedelta(minutes=1)),
        models.Resource(id=1, callsign="NDRF-BOAT-01", kind="rescue_boat", status="available",
                        lat=23.03, lng=72.577, base="Riverfront"),
        models.Resource(id=2, callsign="108-AMD-01", kind="ambulance", status="available",
                        lat=23.05, lng=72.60, base="Civil Hospital"),
        models.Facility(id=1, name="Civil Hospital, Asarwa", kind="hospital", lat=23.0536, lng=72.6037,
                        beds_total=120, beds_available=34, specialties=["trauma"]),
        models.Assignment(id=1, incident_id=1, resource_id=1, status="on_scene", eta_min=9,
                          created_at=t0 + timedelta(seconds=80), updated_at=t0 + timedelta(seconds=600)),
        models.Alert(id=1, incident_id=1, kind="shortage", message="No ndrf_team available", created_at=now),
    ])
    db.commit()
    db.close()


def test_recommendations(client):
    r = client.get("/api/incidents/1/recommendations")
    assert r.status_code == 200
    body = r.json()
    assert body["incident_id"] == 1
    assert body["suggested_resource_ids"] == [1, 2]
    assert "ndrf_team" in body["shortages"]
    assert body["facility"]["facility"]["name"].startswith("Civil")


def test_recommendations_404(client):
    assert client.get("/api/incidents/999/recommendations").status_code == 404


def test_summarize_and_sitrep(client):
    r = client.post("/api/incidents/1/summarize")
    assert r.status_code == 200 and r.json()["ai_summary"] and r.json()["ai_actions"]
    s = client.post("/api/ai/sitrep")
    assert s.status_code == 200 and s.json()["active_count"] == 1 and "INC-0001" in s.json()["markdown"]


def test_ai_status(client):
    body = client.get("/api/ai/status").json()
    assert body["ai_enabled"] is False and "models" in body


def test_analytics_endpoints(client):
    s = client.get("/api/analytics/summary").json()
    assert s["active_incidents"] == 1 and s["duplicates_merged"] == 1 and s["avg_time_to_dispatch_sec"] == 80
    assert client.get("/api/analytics/by-type").json()[0]["type"] == "flood"
    assert client.get("/api/analytics/response-times").json()["buckets"][1]["count"] == 1
    assert client.get("/api/analytics/shortages").json()[0]["kind"] == "ndrf_team"
    assert client.get("/api/analytics/hotspots").json()[0]["count"] == 2
    assert "type_accuracy" in client.get("/api/analytics/eval").json()
    future = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    assert client.get("/api/analytics/summary", params={"since": future}).json()["total_reports"] == 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(pytest.main([__file__, "-q"]))
