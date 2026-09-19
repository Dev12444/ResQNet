"""Stand-in models (contract field names) used by BE2 tests until BE1's app.models exists. Owner: BE2."""
from sqlalchemy import JSON, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import declarative_base, relationship
import types

import app.models as real_models  # noqa: E402

if hasattr(real_models, "Incident"):
    models = real_models
    from app.db import Base
else:
    Base = declarative_base()

    class Incident(Base):
        __tablename__ = "incidents"
        id = Column(Integer, primary_key=True)
        code = Column(String)
        type = Column(String)
        severity = Column(Integer)
        priority = Column(String)
        status = Column(String, default="new")
        title = Column(String)
        lat = Column(Float)
        lng = Column(Float)
        address = Column(String)
        hazards = Column(JSON, default=list)
        ai_summary = Column(Text)
        ai_actions = Column(JSON, default=list)
        report_count = Column(Integer, default=1)
        confidence = Column(Float)
        ai_reasoning = Column(Text)
        people_affected_est = Column(Integer)
        created_at = Column(DateTime(timezone=True))
        updated_at = Column(DateTime(timezone=True))
        dispatched_at = Column(DateTime(timezone=True))
        resolved_at = Column(DateTime(timezone=True))
        reports = relationship("Report", back_populates="incident")

    class Report(Base):
        __tablename__ = "reports"
        id = Column(Integer, primary_key=True)
        source = Column(String)
        text = Column(Text)
        lang = Column(String)
        lat = Column(Float)
        lng = Column(Float)
        sensor = Column(JSON)
        photo_url = Column(Text)
        address = Column(String)
        incident_id = Column(Integer, ForeignKey("incidents.id"))
        created_at = Column(DateTime(timezone=True))
        incident = relationship("Incident", back_populates="reports")

    class Resource(Base):
        __tablename__ = "resources"
        id = Column(Integer, primary_key=True)
        callsign = Column(String)
        kind = Column(String)
        status = Column(String)
        lat = Column(Float)
        lng = Column(Float)
        base = Column(String)
        phone = Column(String)
        current_incident_id = Column(Integer)

    class Facility(Base):
        __tablename__ = "facilities"
        id = Column(Integer, primary_key=True)
        name = Column(String)
        kind = Column(String)
        lat = Column(Float)
        lng = Column(Float)
        beds_total = Column(Integer)
        beds_available = Column(Integer)
        specialties = Column(JSON, default=list)

    class Assignment(Base):
        __tablename__ = "assignments"
        id = Column(Integer, primary_key=True)
        incident_id = Column(Integer)
        resource_id = Column(Integer)
        status = Column(String)
        eta_min = Column(Integer)
        created_at = Column(DateTime(timezone=True))
        updated_at = Column(DateTime(timezone=True))

    class Alert(Base):
        __tablename__ = "alerts"
        id = Column(Integer, primary_key=True)
        incident_id = Column(Integer)
        kind = Column(String)
        message = Column(Text)
        acknowledged = Column(Integer, default=0)
        created_at = Column(DateTime(timezone=True))

    models = types.SimpleNamespace(
        Incident=Incident, Report=Report, Resource=Resource, Facility=Facility, Assignment=Assignment, Alert=Alert
    )


