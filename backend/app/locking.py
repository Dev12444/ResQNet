"""Row locks for read -> check -> write endpoints. Owner: BE1.

Lock order for every write that touches an incident and its units:
    [PIPELINE_LOCK or ALERT_LOCK ->] incident row -> assignment rows -> resource rows
Dispatch, PATCH incident, PATCH assignment and the report pipeline's merge all lock the incident
first, so they queue up instead of overwriting each other or deadlocking. PATCH resource locks
only its unit. Take the lock BEFORE reading what you are about to check, then (re)load it.
"""
from __future__ import annotations

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app import models as m


def lock_row(db: Session, model: type[m.Base], row_id: int) -> None:
    """Lock one row until this transaction commits or rolls back.

    Postgres: SELECT ... FOR UPDATE. SQLite has no row locks, and its driver only opens a
    transaction at the first write, so reads made before our write are not protected (two
    requests can both read "open" and both write). A no-op UPDATE takes SQLite's database
    write lock right now instead: other writers wait until we commit, and what we read next
    is current.
    """
    table = model.__table__
    if db.get_bind().dialect.name == "sqlite":
        db.execute(update(table).where(table.c.id == row_id).values(id=table.c.id))
    else:
        db.execute(select(table.c.id).where(table.c.id == row_id).with_for_update())


def lock_incident(db: Session, incident_id: int) -> None:
    """Lock the incident row. Anything read before this call is stale: load the incident after it."""
    lock_row(db, m.Incident, incident_id)
