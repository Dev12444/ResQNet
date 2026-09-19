"""Deploy configuration tests (Task 11). Owner: BE1."""
import logging
from pathlib import Path

import pytest
import yaml
from sqlalchemy import create_engine, event, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.main as main_mod
from app import models as m
from app.config import Settings, get_settings
from app.db import Base
from app.routers.ws import origin_allowed
from app.seed import load_seed, seed_if_empty

BACKEND = Path(__file__).resolve().parents[1]
VERCEL_REGEX = r"^https://resqnet(-[a-z0-9-]+)?\.vercel\.app$"


# ---------------------------------------------------------------- render.yaml


@pytest.fixture(scope="module")
def blueprint():
    return yaml.safe_load((BACKEND / "render.yaml").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def service(blueprint):
    (svc,) = blueprint["services"]
    return svc


def test_render_service_basics(service):
    assert service["type"] == "web" and service["runtime"] == "python"
    assert service["rootDir"] == "backend"
    assert service["healthCheckPath"] == "/health"
    assert service["buildCommand"] == "pip install -r requirements.txt"


def test_render_runs_exactly_one_worker_behind_proxy(service):
    cmd = service["startCommand"]
    assert cmd.startswith("uvicorn app.main:app ")
    assert "--workers 1" in cmd, "in-memory lock/WebSocket state requires a single process"
    assert "--port $PORT" in cmd and "--host 0.0.0.0" in cmd and "--proxy-headers" in cmd
    assert "*" not in cmd, "a literal * is glob-expanded by the shell and breaks uvicorn's arguments"


def test_render_secrets_are_never_committed(service):
    secret_keys = {"DATABASE_URL", "OPENAI_API_KEY", "GEMINI_API_KEY", "TELEGRAM_BOT_TOKEN",
                   "TELEGRAM_AUTHORITY_CHAT_ID", "TELEGRAM_RESPONDER_CHAT_ID", "CORS_ORIGINS", "CORS_ORIGIN_REGEX"}
    env = {v["key"]: v for v in service["envVars"]}
    for key in secret_keys:
        assert env[key].get("sync") is False and "value" not in env[key], key


def test_render_env_vars_exist_in_settings(service):
    fields = {name.upper() for name in Settings.model_fields}
    for var in service["envVars"]:
        assert var["key"] in fields | {"PYTHON_VERSION", "FORWARDED_ALLOW_IPS"}, var["key"]


def test_python_version_is_supported(service):
    version = next(v["value"] for v in service["envVars"] if v["key"] == "PYTHON_VERSION")
    major, minor, _ = (int(x) for x in version.split("."))
    assert (major, minor) >= (3, 10)


# ---------------------------------------------------------------- CORS origin rule (REST + WS)


@pytest.mark.parametrize(
    ("origin", "allowed"),
    [
        ("http://localhost:3000", True),
        ("https://resqnet.vercel.app", True),
        ("https://resqnet-git-fe1-map-maansi.vercel.app", True),
        ("https://resqnet.vercel.app.evil.com", False),  # suffix trick
        ("https://evilresqnet.vercel.app", False),       # prefix trick
        ("http://resqnet.vercel.app", False),             # wrong scheme
    ],
)
def test_origin_rule_with_regex(origin, allowed):
    s = Settings(cors_origins="http://localhost:3000", cors_origin_regex=VERCEL_REGEX)
    assert s.origin_allowed(origin) is allowed


def test_origin_rule_without_regex_is_exact_list_only():
    s = Settings(cors_origins="http://localhost:3000,https://resqnet.vercel.app", cors_origin_regex="")
    assert s.origin_allowed("https://resqnet.vercel.app")
    assert not s.origin_allowed("https://resqnet-preview.vercel.app")


def test_websocket_uses_the_same_rule(monkeypatch):
    monkeypatch.setenv("CORS_ORIGIN_REGEX", VERCEL_REGEX)
    get_settings.cache_clear()
    try:
        assert origin_allowed("https://resqnet-git-main-team.vercel.app")
        assert not origin_allowed("https://attacker.example")
        assert origin_allowed(None)  # non-browser clients send no Origin
    finally:
        get_settings.cache_clear()


def test_cors_middleware_receives_the_regex_setting():
    cors = next(mw for mw in main_mod.app.user_middleware if mw.cls.__name__ == "CORSMiddleware")
    assert cors.kwargs["allow_origins"] == main_mod.settings.cors_list
    assert cors.kwargs["allow_origin_regex"] == (main_mod.settings.cors_origin_regex or None)


# ---------------------------------------------------------------- first-start seeding


@pytest.fixture()
def Session():
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)

    @event.listens_for(eng, "connect")
    def _fk(dbapi_conn, _record):
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(eng)
    yield sessionmaker(bind=eng, expire_on_commit=False)
    eng.dispose()


def _count(Session, model):
    with Session() as db:
        return db.scalar(select(func.count()).select_from(model))


def test_seed_if_empty_seeds_once_and_never_wipes(Session):
    data = load_seed()
    with Session() as db:
        assert seed_if_empty(db) == {"resources": len(data.resources), "facilities": len(data.facilities)}
        db.add(m.Incident(code="INC-0001", type="flood", severity=4, priority="P1", title="live incident"))
        db.commit()
        assert seed_if_empty(db) is None  # already has data: untouched
    assert _count(Session, m.Resource) == len(data.resources)
    assert _count(Session, m.Incident) == 1  # live data survived a restart


def test_startup_seed_uses_setting(Session, monkeypatch):
    monkeypatch.setattr(main_mod, "SessionLocal", Session)
    monkeypatch.setattr(main_mod.settings, "seed_on_startup", False)
    main_mod.startup_seed()
    assert _count(Session, m.Resource) == 0
    monkeypatch.setattr(main_mod.settings, "seed_on_startup", True)
    main_mod.startup_seed()
    assert _count(Session, m.Resource) == len(load_seed().resources)


def test_startup_seed_failure_is_logged_not_fatal(Session, monkeypatch, caplog):
    def broken():
        raise RuntimeError("database unreachable")

    monkeypatch.setattr(main_mod, "SessionLocal", broken)
    monkeypatch.setattr(main_mod.settings, "seed_on_startup", True)
    with caplog.at_level(logging.ERROR, logger="resqnet.main"):
        main_mod.startup_seed()  # must not raise: the API should still come up
    assert "Startup seeding failed" in caplog.text


def test_proxy_trust_comes_from_env_not_the_command(service):
    env = {v["key"]: v.get("value") for v in service["envVars"]}
    assert env["FORWARDED_ALLOW_IPS"] == "*"
