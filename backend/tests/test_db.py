"""DB engine config tests. Owner: BE1.

The Postgres test runs only when TEST_POSTGRES_URL is set, e.g. a local server or a
Neon branch: TEST_POSTGRES_URL=postgresql://user:pass@host/db?sslmode=require
It creates and then drops the ResQNet tables in that database — never point it at production.
"""
import os

import pytest
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import sessionmaker

from app import db as app_db
from app import models as m

NEON = "postgresql://alex:secret@ep-cool-darkness-123456-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        (NEON, NEON.replace("postgresql://", "postgresql+psycopg://", 1)),
        ("postgres://u:p@host:5432/db", "postgresql+psycopg://u:p@host:5432/db"),
        ("  postgresql://u:p@host/db  ", "postgresql+psycopg://u:p@host/db"),
        ("postgresql+psycopg://u:p@host/db", "postgresql+psycopg://u:p@host/db"),
        ("sqlite:///./resqnet.db", "sqlite:///./resqnet.db"),
        ("sqlite://", "sqlite://"),
    ],
)
def test_normalize_database_url(url, expected):
    assert app_db.normalize_database_url(url) == expected


def test_neon_url_builds_psycopg3_engine_without_connecting():
    url = app_db.normalize_database_url(NEON)
    eng = create_engine(url, **app_db.engine_options(url))
    assert eng.dialect.name == "postgresql" and eng.dialect.driver == "psycopg"
    assert eng.url.query["sslmode"] == "require"
    eng.dispose()


def test_postgres_engine_options_are_neon_safe():
    opts = app_db.engine_options("postgresql+psycopg://u:p@h/db")
    assert opts["pool_pre_ping"] is True
    assert 0 < opts["pool_recycle"] <= 300
    assert opts["connect_args"]["prepare_threshold"] is None
    assert opts["connect_args"]["connect_timeout"] > 0


def test_sqlite_engine_options():
    assert app_db.engine_options("sqlite://") == {"connect_args": {"check_same_thread": False}}


def test_app_engine_enforces_sqlite_foreign_keys():
    if app_db.engine.dialect.name != "sqlite":
        pytest.skip("app engine is not SQLite")
    with app_db.engine.connect() as conn:
        assert conn.execute(text("PRAGMA foreign_keys")).scalar() == 1


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRES_URL"), reason="TEST_POSTGRES_URL not set")
def test_real_postgres_roundtrip():
    url = app_db.normalize_database_url(os.environ["TEST_POSTGRES_URL"])
    eng = create_engine(url, **app_db.engine_options(url))
    app_db.Base.metadata.drop_all(eng)
    app_db.Base.metadata.create_all(eng)
    try:
        session = sessionmaker(bind=eng, expire_on_commit=False)()
        inc = m.Incident(type="flood", severity=4, priority="P1", title="T" * 500, address="A" * 2000,
                         hazards=["rising_water"])
        session.add(inc)
        session.flush()
        inc.code = f"INC-{inc.id:04d}"
        session.add(m.Report(source="sensor", incident_id=inc.id,
                             sensor={"sensor_id": "VASNA-WL-01", "value": 4.9, "threshold": 4.2}))
        session.commit()
        # Repeat the same statement past psycopg's default prepare threshold (5).
        for _ in range(8):
            assert session.scalar(select(m.Incident.code).where(m.Incident.id == inc.id)) == "INC-0001"
        got = session.get(m.Incident, inc.id)
        assert got.created_at.tzinfo is not None and len(got.address) == 2000
        session.close()
    finally:
        app_db.Base.metadata.drop_all(eng)
        eng.dispose()
