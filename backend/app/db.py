"""Database engine + session. Owner: BE1.

Local dev: SQLite (default). Production: Postgres on Neon.
Neon's dashboard gives `postgresql://...?sslmode=require`; that is normalised to the
psycopg 3 driver we ship (`postgresql+psycopg://`), since SQLAlchemy would otherwise
look for psycopg2, which is not installed.
"""
from collections.abc import Generator
from typing import Any

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

# Neon suspends idle computes and drops their connections; recycle before that and
# ping on checkout so a request never gets a dead connection.
PG_POOL_RECYCLE_SEC = 300
PG_CONNECT_TIMEOUT_SEC = 10  # covers a Neon cold start without hanging a request forever


def normalize_database_url(url: str) -> str:
    """Map postgres:// and postgresql:// (Neon/Render/Heroku style) to the psycopg 3 driver."""
    url = url.strip()
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


def engine_options(url: str) -> dict[str, Any]:
    """create_engine() kwargs for the given (normalised) URL."""
    if url.startswith("sqlite"):
        return {"connect_args": {"check_same_thread": False}}
    return {
        "pool_pre_ping": True,
        "pool_recycle": PG_POOL_RECYCLE_SEC,
        "pool_size": 5,
        "max_overflow": 5,
        "connect_args": {
            "connect_timeout": PG_CONNECT_TIMEOUT_SEC,
            # Neon's "-pooler" endpoint is PgBouncer in transaction mode; psycopg 3's automatic
            # server-side prepared statements can break there, so keep them off.
            "prepare_threshold": None,
        },
    }


settings = get_settings()
DATABASE_URL = normalize_database_url(settings.database_url)
engine = create_engine(DATABASE_URL, **engine_options(DATABASE_URL))

if engine.dialect.name == "sqlite":

    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_conn, _record) -> None:
        # SQLite ignores foreign keys unless enabled per connection; Postgres always enforces them.
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from app import models  # noqa: F401  (register tables)

    Base.metadata.create_all(bind=engine)
