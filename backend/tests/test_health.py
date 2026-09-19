"""App entrypoint + health check tests (Task 4). Owner: BE1."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import get_settings
from app.db import Base, get_db
from app.main import app


@pytest.fixture()
def client():
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)

    @event.listens_for(eng, "connect")
    def _fk(dbapi_conn, _record):
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(eng)
    Session = sessionmaker(bind=eng, expire_on_commit=False)

    def _db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _db
    with TestClient(app, raise_server_exceptions=False) as c:  # runs the lifespan (init_db)
        yield c
    app.dependency_overrides.clear()
    eng.dispose()


def test_health_ok(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "ai": get_settings().ai_available, "db": True}


def test_health_reports_db_down_with_503(client):
    class BrokenSession:
        def execute(self, *_a, **_kw):
            raise RuntimeError("connection refused")

        def close(self):
            pass

    app.dependency_overrides[get_db] = lambda: BrokenSession()
    r = client.get("/health")
    assert r.status_code == 503
    assert r.json()["status"] == "degraded" and r.json()["db"] is False


def test_openapi_docs_available(client):
    assert client.get("/docs").status_code == 200
    spec = client.get("/openapi.json").json()
    assert spec["info"]["title"] == "ResQNet API"


def test_be2_routers_registered(client):
    paths = {route.path for route in app.routes}
    assert "/api/incidents/{incident_id}/recommendations" in paths
    assert "/api/ai/sitrep" in paths
    assert "/api/analytics/summary" in paths


def test_cors_allows_configured_frontend_origin(client):
    origin = get_settings().cors_list[0]
    r = client.options(
        "/health",
        headers={"Origin": origin, "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "x-actor"},
    )
    assert r.status_code == 200
    assert r.headers["access-control-allow-origin"] == origin


def test_cors_rejects_unknown_origin(client):
    r = client.options("/health", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in r.headers


def test_unknown_route_is_json_404(client):
    r = client.get("/api/does-not-exist")
    assert r.status_code == 404 and r.json() == {"detail": "Not Found"}


def test_unhandled_error_is_generic_json_500(client):
    @app.get("/__boom_test")
    def _boom():
        raise RuntimeError("secret internal detail")

    try:
        r = client.get("/__boom_test")
        assert r.status_code == 500
        assert r.json() == {"detail": "Internal server error"}
        assert "secret" not in r.text
    finally:
        app.router.routes = [rt for rt in app.router.routes if getattr(rt, "path", None) != "/__boom_test"]
