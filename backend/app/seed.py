"""Demo data reset + seed. Owner: BE1.

Used by `python -m scripts.seed` and by `POST /api/simulator/reset`.
`reset_database()` wipes ALL demo data (incidents, reports, assignments, alerts,
audit log, resources, facilities) and loads the seed files, in one transaction.
Seed files are validated before anything is deleted, so bad data never empties the DB.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, model_validator
from sqlalchemy import text
from sqlalchemy.orm import Session

from app import models as m
from app.schemas import FacilityKind, Latitude, Longitude, ResourceKind, ResourceStatus

DATA_DIR = Path(__file__).resolve().parent / "data"
RESOURCES_FILE = "seed_resources.json"
FACILITIES_FILE = "seed_facilities.json"

# Children before parents, so plain DELETEs never violate a foreign key.
_WIPE_ORDER = (m.Alert, m.Assignment, m.Report, m.AuditLog, m.Resource, m.Facility, m.Incident)


class SeedResource(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    callsign: str = Field(min_length=1, max_length=40)
    kind: ResourceKind
    capabilities: list[str] = Field(default_factory=list)
    status: ResourceStatus = "available"
    lat: Latitude
    lng: Longitude
    base: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=20)


class SeedFacility(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    name: str = Field(min_length=1, max_length=200)
    kind: FacilityKind
    lat: Latitude
    lng: Longitude
    beds_total: int | None = Field(default=None, ge=0)
    beds_available: int | None = Field(default=None, ge=0)
    specialties: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def _beds(self) -> SeedFacility:
        if (self.beds_total is None) != (self.beds_available is None):
            raise ValueError(f"{self.name}: beds_total and beds_available must both be set or both be null")
        if self.beds_total is not None and self.beds_available > self.beds_total:
            raise ValueError(f"{self.name}: beds_available > beds_total")
        if self.kind == "fire_station" and self.beds_total is not None:
            raise ValueError(f"{self.name}: fire stations have no beds")
        return self


@dataclass(frozen=True)
class SeedData:
    resources: list[SeedResource]
    facilities: list[SeedFacility]


class SeedError(ValueError):
    """Seed files are missing or invalid."""


def load_seed(data_dir: Path = DATA_DIR) -> SeedData:
    """Read and validate the seed files. Raises SeedError; never touches the DB."""
    try:
        raw_resources = json.loads((data_dir / RESOURCES_FILE).read_text(encoding="utf-8"))
        raw_facilities = json.loads((data_dir / FACILITIES_FILE).read_text(encoding="utf-8"))
        resources = TypeAdapter(list[SeedResource]).validate_python(raw_resources)
        facilities = TypeAdapter(list[SeedFacility]).validate_python(raw_facilities)
    except (OSError, ValueError) as e:  # ValidationError and JSONDecodeError are ValueErrors
        raise SeedError(f"Invalid seed data in {data_dir}: {e}") from e

    for label, keys in (("callsign", [r.callsign for r in resources]), ("facility name", [f.name for f in facilities])):
        dupes = sorted({k for k in keys if keys.count(k) > 1})
        if dupes:
            raise SeedError(f"Duplicate {label}(s) in seed data: {dupes}")
    if not resources or not facilities:
        raise SeedError("Seed data must contain at least one resource and one facility")
    return SeedData(resources, facilities)


def _wipe(db: Session) -> None:
    """Delete every row in the demo tables with raw SQL (same session semantics on both dialects)."""
    tables = [model.__tablename__ for model in _WIPE_ORDER]  # fixed identifiers from our models
    if db.get_bind().dialect.name == "postgresql":
        # RESTART IDENTITY: incident codes start again at INC-0001 after a demo reset.
        db.execute(text(f"TRUNCATE {', '.join(tables)} RESTART IDENTITY CASCADE"))
    else:
        # SQLite integer PKs are rowid aliases (no AUTOINCREMENT): an emptied table restarts at 1.
        for table in tables:
            db.execute(text(f"DELETE FROM {table}"))


def seed_if_empty(db: Session, data: SeedData | None = None) -> dict[str, int] | None:
    """Insert the seed only when there are no resources and no facilities yet. Never deletes.

    Returns inserted counts, or None if the database already had data.
    """
    from sqlalchemy import func, select

    has_data = db.scalar(select(func.count()).select_from(m.Resource)) or db.scalar(
        select(func.count()).select_from(m.Facility)
    )
    if has_data:
        return None
    data = data if data is not None else load_seed()
    try:
        db.add_all(m.Resource(**r.model_dump()) for r in data.resources)
        db.add_all(m.Facility(**f.model_dump()) for f in data.facilities)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {"resources": len(data.resources), "facilities": len(data.facilities)}


def reset_database(db: Session, data: SeedData | None = None) -> dict[str, int]:
    """Wipe all demo data and insert the seed, atomically. Returns inserted counts."""
    data = data if data is not None else load_seed()  # validate before deleting anything
    try:
        _wipe(db)
        # The wipe is raw SQL, so objects loaded earlier are still in the session's identity map;
        # reseeded rows reuse the same ids (RESTART IDENTITY / rowid), so drop the stale objects.
        db.expunge_all()
        db.add_all(m.Resource(**r.model_dump()) for r in data.resources)
        db.add_all(m.Facility(**f.model_dump()) for f in data.facilities)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {"resources": len(data.resources), "facilities": len(data.facilities)}
