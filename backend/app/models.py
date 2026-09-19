"""SQLAlchemy models. Owner: BE1.

Source of truth for the data model (PRD §9, API_CONTRACT.md §2).
Enum values are stored as strings and guarded by CHECK constraints so bad
data fails loudly on SQLite and Postgres alike.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    TypeDecorator,
)
from sqlalchemy.ext.mutable import MutableDict, MutableList
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

# ---------------------------------------------------------------- enums (API_CONTRACT.md §1)

INCIDENT_TYPES = ("flood", "fire", "road_accident", "industrial", "medical", "building_collapse", "other")
INCIDENT_STATUSES = ("new", "triaged", "dispatched", "on_scene", "resolved", "escalated")
OPEN_INCIDENT_STATUSES = ("new", "triaged", "dispatched", "on_scene", "escalated")
PRIORITIES = ("P1", "P2", "P3", "P4")
REPORT_SOURCES = ("citizen", "call", "sensor", "field")
RESOURCE_KINDS = ("ambulance", "fire_truck", "rescue_boat", "police", "ndrf_team", "hazmat")
RESOURCE_STATUSES = ("available", "assigned", "busy", "offline")
FACILITY_KINDS = ("hospital", "shelter", "fire_station")
ASSIGNMENT_STATUSES = ("assigned", "en_route", "on_scene", "completed", "cancelled")
ACTIVE_ASSIGNMENT_STATUSES = ("assigned", "en_route", "on_scene")
ALERT_KINDS = ("critical", "sla_breach", "escalation", "shortage")


def _in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN ({', '.join(repr(v) for v in values)})"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator):
    """Timezone-aware UTC datetime on every backend.

    SQLite drops tzinfo, Postgres keeps it; this normalises both ways so
    comparisons never mix naive and aware values. Naive input is assumed UTC.
    """

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect: Any) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    def process_result_value(self, value: datetime | None, dialect: Any) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)


# In-place edits (e.g. incident.hazards.append(...)) are tracked and persisted.
JSONList = MutableList.as_mutable(JSON)
JSONDict = MutableDict.as_mutable(JSON)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, nullable=False)


# ---------------------------------------------------------------- tables


class Incident(TimestampMixin, Base):
    __tablename__ = "incidents"
    __table_args__ = (
        CheckConstraint(_in("type", INCIDENT_TYPES), name="ck_incidents_type"),
        CheckConstraint(_in("status", INCIDENT_STATUSES), name="ck_incidents_status"),
        CheckConstraint(_in("priority", PRIORITIES), name="ck_incidents_priority"),
        CheckConstraint("severity BETWEEN 1 AND 5", name="ck_incidents_severity"),
        CheckConstraint("report_count >= 0", name="ck_incidents_report_count"),
        Index("ix_incidents_status_priority", "status", "priority"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Human code "INC-0001"; assigned from the id right after the first flush.
    code: Mapped[str | None] = mapped_column(String(16), unique=True)
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    severity: Mapped[int] = mapped_column(Integer, nullable=False)
    priority: Mapped[str] = mapped_column(String(2), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="new")
    # Text, not VARCHAR(n): title/address can come from the LLM, and Postgres rejects
    # over-long VARCHAR values — that would roll back (lose) the whole report.
    title: Mapped[str] = mapped_column(Text, nullable=False)
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    address: Mapped[str | None] = mapped_column(Text)

    ai_summary: Mapped[str | None] = mapped_column(Text)
    ai_reasoning: Mapped[str | None] = mapped_column(Text)
    ai_actions: Mapped[list[str]] = mapped_column(JSONList, nullable=False, default=list)
    confidence: Mapped[float | None] = mapped_column(Float)
    hazards: Mapped[list[str]] = mapped_column(JSONList, nullable=False, default=list)
    people_affected_est: Mapped[int | None] = mapped_column(Integer)
    report_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False, default=utcnow, onupdate=utcnow)
    dispatched_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    resolved_at: Mapped[datetime | None] = mapped_column(UTCDateTime)

    reports: Mapped[list[Report]] = relationship(
        back_populates="incident", order_by=lambda: [Report.created_at, Report.id]
    )
    assignments: Mapped[list[Assignment]] = relationship(
        back_populates="incident", order_by=lambda: [Assignment.created_at, Assignment.id], passive_deletes=True
    )
    alerts: Mapped[list[Alert]] = relationship(
        back_populates="incident", order_by=lambda: [Alert.created_at.desc(), Alert.id.desc()], passive_deletes=True
    )

    @property
    def is_open(self) -> bool:
        return self.status in OPEN_INCIDENT_STATUSES

    def __repr__(self) -> str:
        return f"<Incident {self.code or self.id} {self.type} P={self.priority} {self.status}>"


class Report(TimestampMixin, Base):
    __tablename__ = "reports"
    __table_args__ = (
        CheckConstraint(_in("source", REPORT_SOURCES), name="ck_reports_source"),
        Index("ix_reports_incident_created", "incident_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source: Mapped[str] = mapped_column(String(16), nullable=False)
    text: Mapped[str | None] = mapped_column(Text)
    lang: Mapped[str | None] = mapped_column(String(16))
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    address: Mapped[str | None] = mapped_column(Text)
    photo_url: Mapped[str | None] = mapped_column(Text)
    reporter: Mapped[str | None] = mapped_column(String(120))
    sensor: Mapped[dict[str, Any] | None] = mapped_column(JSONDict)
    # Nullable: the raw report is stored before it is linked, so it is never lost.
    incident_id: Mapped[int | None] = mapped_column(ForeignKey("incidents.id", ondelete="SET NULL"))
    # Cached ClassificationResult — the classifier is never called twice for one report.
    ai_json: Mapped[dict[str, Any] | None] = mapped_column(JSONDict)

    incident: Mapped[Incident | None] = relationship(back_populates="reports")

    def __repr__(self) -> str:
        return f"<Report {self.id} {self.source} incident={self.incident_id}>"


class Resource(Base):
    __tablename__ = "resources"
    __table_args__ = (
        CheckConstraint(_in("kind", RESOURCE_KINDS), name="ck_resources_kind"),
        CheckConstraint(_in("status", RESOURCE_STATUSES), name="ck_resources_status"),
        Index("ix_resources_kind_status", "kind", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    callsign: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    capabilities: Mapped[list[str]] = mapped_column(JSONList, nullable=False, default=list)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="available")
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    base: Mapped[str | None] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(20))
    current_incident_id: Mapped[int | None] = mapped_column(ForeignKey("incidents.id", ondelete="SET NULL"))

    assignments: Mapped[list[Assignment]] = relationship(back_populates="resource")

    def __repr__(self) -> str:
        return f"<Resource {self.callsign} {self.kind} {self.status}>"


class Facility(Base):
    __tablename__ = "facilities"
    __table_args__ = (
        CheckConstraint(_in("kind", FACILITY_KINDS), name="ck_facilities_kind"),
        CheckConstraint(
            "beds_available IS NULL OR beds_total IS NULL OR (beds_available >= 0 AND beds_available <= beds_total)",
            name="ck_facilities_beds",
        ),
        Index("ix_facilities_kind", "kind"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    beds_total: Mapped[int | None] = mapped_column(Integer)  # null for fire stations
    beds_available: Mapped[int | None] = mapped_column(Integer)
    specialties: Mapped[list[str]] = mapped_column(JSONList, nullable=False, default=list)

    def __repr__(self) -> str:
        return f"<Facility {self.name} {self.kind}>"


class Assignment(TimestampMixin, Base):
    __tablename__ = "assignments"
    __table_args__ = (
        CheckConstraint(_in("status", ASSIGNMENT_STATUSES), name="ck_assignments_status"),
        CheckConstraint("eta_min IS NULL OR eta_min >= 0", name="ck_assignments_eta"),
        Index("ix_assignments_incident", "incident_id"),
        Index("ix_assignments_resource_status", "resource_id", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False)
    resource_id: Mapped[int] = mapped_column(ForeignKey("resources.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="assigned")
    eta_min: Mapped[int | None] = mapped_column(Integer)
    approved_by: Mapped[str] = mapped_column(String(80), nullable=False, default="dispatcher")
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False, default=utcnow, onupdate=utcnow)
    # First time this unit reached the scene — BE2 analytics uses it for time-to-scene.
    on_scene_at: Mapped[datetime | None] = mapped_column(UTCDateTime)

    incident: Mapped[Incident] = relationship(back_populates="assignments")
    resource: Mapped[Resource] = relationship(back_populates="assignments")

    @property
    def is_active(self) -> bool:
        return self.status in ACTIVE_ASSIGNMENT_STATUSES

    def __repr__(self) -> str:
        return f"<Assignment {self.id} inc={self.incident_id} res={self.resource_id} {self.status}>"


class Alert(TimestampMixin, Base):
    __tablename__ = "alerts"
    __table_args__ = (
        CheckConstraint(_in("kind", ALERT_KINDS), name="ck_alerts_kind"),
        # Escalation loop checks "does this incident already have an alert of this kind?"
        Index("ix_alerts_incident_kind", "incident_id", "kind"),
        Index("ix_alerts_acknowledged_created", "acknowledged", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Nullable: shortage alerts may not belong to one incident.
    incident_id: Mapped[int | None] = mapped_column(ForeignKey("incidents.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    acknowledged: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    incident: Mapped[Incident | None] = relationship(back_populates="alerts")

    @property
    def incident_code(self) -> str | None:
        return self.incident.code if self.incident is not None else None

    def __repr__(self) -> str:
        return f"<Alert {self.id} {self.kind} inc={self.incident_id} ack={self.acknowledged}>"


class AuditLog(TimestampMixin, Base):
    __tablename__ = "audit_log"
    __table_args__ = (Index("ix_audit_log_entity", "entity", "entity_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    actor: Mapped[str] = mapped_column(String(80), nullable=False, default="system")
    action: Mapped[str] = mapped_column(String(40), nullable=False)
    entity: Mapped[str] = mapped_column(String(40), nullable=False)
    entity_id: Mapped[int | None] = mapped_column(Integer)
    payload: Mapped[dict[str, Any] | None] = mapped_column(JSONDict)

    def __repr__(self) -> str:
        return f"<AuditLog {self.actor} {self.action} {self.entity}:{self.entity_id}>"
