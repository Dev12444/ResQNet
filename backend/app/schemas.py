"""Pydantic request/response schemas. Owner: BE1.

Mirrors docs/API_CONTRACT.md (source of truth) and frontend/src/types/index.ts.
Changing a shape here? Update all three in the same PR and tell the group.

Conventions (contract §0):
- snake_case fields; optional fields are always present as null, never omitted
- datetimes serialised as ISO-8601 UTC with a trailing "Z"
- request bodies reject unknown fields (422) so contract drift fails loudly
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Any, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, PlainSerializer, model_validator

# ---------------------------------------------------------------- enums (contract §1)
# Kept as explicit Literals for type checkers / OpenAPI; tests assert they match app.models.

IncidentType = Literal["flood", "fire", "road_accident", "industrial", "medical", "building_collapse", "other"]
IncidentStatus = Literal["new", "triaged", "dispatched", "on_scene", "resolved", "escalated"]
Priority = Literal["P1", "P2", "P3", "P4"]
Severity = Annotated[int, Field(ge=1, le=5)]
ReportSource = Literal["citizen", "call", "sensor", "field"]
Lang = Literal["en", "gu", "hi"]
ResourceKind = Literal["ambulance", "fire_truck", "rescue_boat", "police", "ndrf_team", "hazmat"]
ResourceStatus = Literal["available", "assigned", "busy", "offline"]
FacilityKind = Literal["hospital", "shelter", "fire_station"]
AssignmentStatus = Literal["assigned", "en_route", "on_scene", "completed", "cancelled"]
AlertKind = Literal["critical", "sla_breach", "escalation", "shortage"]
Hazard = Literal[
    "trapped_people", "gas_leak", "fire_spread", "rising_water", "electrical",
    "structural", "injuries", "blocked_road", "chemical", "other",
]

Latitude = Annotated[float, Field(ge=-90, le=90)]
Longitude = Annotated[float, Field(ge=-180, le=180)]

MAX_TEXT_LEN = 5_000
# Contract §3: photo_url is a base64 data URL of an image <= 6 MB, or a public https:// URL.
# 6 MB of bytes is ~8.4 M base64 characters, plus the "data:image/...;base64," prefix.
MAX_PHOTO_BYTES = 6 * 1024 * 1024
MAX_PHOTO_URL_LEN = (MAX_PHOTO_BYTES + 2) // 3 * 4 + 64
PHOTO_DATA_URL_PREFIXES = tuple(f"data:image/{t};base64," for t in ("jpeg", "jpg", "png", "webp"))


def _check_photo_url(value: str | None) -> str | None:
    if value is None or value == "":
        return None
    if value.startswith(PHOTO_DATA_URL_PREFIXES) or value.startswith("https://"):
        return value
    raise ValueError("photo_url must be a data:image/jpeg|png|webp;base64 URL or an https:// URL")


PhotoUrl = Annotated[str, Field(max_length=MAX_PHOTO_URL_LEN), AfterValidator(_check_photo_url)]


def to_utc_iso(value: datetime) -> str:
    """ISO-8601 UTC with 'Z'. Naive datetimes are treated as UTC."""
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


UTCDatetime = Annotated[datetime, PlainSerializer(to_utc_iso, return_type=str, when_used="json")]


class RequestModel(BaseModel):
    # allow_inf_nan=False: Python's JSON parser accepts NaN/Infinity literals; they would
    # corrupt sensor maths and are rejected by Postgres JSON / JSON responses (500).
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, allow_inf_nan=False)


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------- reports


class SensorReading(RequestModel):
    sensor_id: str = Field(min_length=1, max_length=64)
    metric: str = Field(min_length=1, max_length=64)  # e.g. "water_level_m", "gas_ppm", "smoke"
    value: float
    threshold: float = Field(gt=0)
    unit: str | None = Field(default=None, max_length=16)


class ReportCreate(RequestModel):
    source: ReportSource
    text: str | None = Field(default=None, max_length=MAX_TEXT_LEN)
    lang: Lang | None = None  # hint only; classifier detects the real language
    lat: Latitude | None = None
    lng: Longitude | None = None
    address: str | None = Field(default=None, max_length=300)
    photo_url: PhotoUrl | None = None
    reporter: str | None = Field(default=None, max_length=120)
    sensor: SensorReading | None = None
    # Contract v1.3: a /field responder update names its incident and attaches to it directly
    # (no duplicate matching; the incident's location is used when the report has no GPS).
    incident_id: int | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def _check_consistency(self) -> ReportCreate:
        if self.text == "":
            self.text = None
        if self.source == "sensor":
            if self.sensor is None:
                raise ValueError("sensor is required when source is 'sensor'")
        else:
            if self.sensor is not None:
                raise ValueError("sensor is only allowed when source is 'sensor'")
            if self.text is None:
                raise ValueError("text is required unless source is 'sensor'")
        if (self.lat is None) != (self.lng is None):
            raise ValueError("lat and lng must be provided together")
        return self


class ReportOut(ORMModel):
    id: int
    source: ReportSource
    text: str | None
    lang: str | None
    lat: float | None
    lng: float | None
    address: str | None
    photo_url: str | None
    reporter: str | None
    sensor: dict[str, Any] | None
    incident_id: int | None
    created_at: UTCDatetime


# ---------------------------------------------------------------- resources & facilities


class ResourceOut(ORMModel):
    id: int
    callsign: str
    kind: ResourceKind
    status: ResourceStatus
    lat: float
    lng: float
    base: str | None
    phone: str | None
    current_incident_id: int | None


class ResourcePatch(RequestModel):
    status: ResourceStatus


class FacilityOut(ORMModel):
    id: int
    name: str
    kind: FacilityKind
    lat: float
    lng: float
    beds_total: int | None
    beds_available: int | None
    specialties: list[str]


# ---------------------------------------------------------------- assignments & dispatch


class AssignmentOut(ORMModel):
    id: int
    incident_id: int
    resource_id: int
    resource: ResourceOut
    status: AssignmentStatus
    eta_min: int | None
    approved_by: str
    created_at: UTCDatetime
    updated_at: UTCDatetime


class AssignmentPatch(RequestModel):
    status: AssignmentStatus


class DispatchRequest(RequestModel):
    resource_ids: list[int] = Field(min_length=1, max_length=20)
    facility_id: int | None = None
    approved_by: str = Field(default="dispatcher", min_length=1, max_length=80)

    @model_validator(mode="after")
    def _unique_ids(self) -> DispatchRequest:
        if len(set(self.resource_ids)) != len(self.resource_ids):
            raise ValueError("resource_ids must not contain duplicates")
        return self


# ---------------------------------------------------------------- alerts


class AlertOut(ORMModel):
    id: int
    incident_id: int | None
    incident_code: str | None
    kind: AlertKind
    message: str
    acknowledged: bool
    created_at: UTCDatetime


# ---------------------------------------------------------------- incidents


class IncidentOut(ORMModel):
    id: int
    code: str | None
    type: IncidentType
    severity: int
    priority: Priority
    status: IncidentStatus
    title: str
    lat: float | None
    lng: float | None
    address: str | None
    ai_summary: str | None
    ai_reasoning: str | None
    ai_actions: list[str]
    confidence: float | None
    hazards: list[str]
    people_affected_est: int | None
    report_count: int
    created_at: UTCDatetime
    updated_at: UTCDatetime
    dispatched_at: UTCDatetime | None
    resolved_at: UTCDatetime | None


class IncidentDetail(IncidentOut):
    reports: list[ReportOut]  # oldest first
    assignments: list[AssignmentOut]
    alerts: list[AlertOut]  # newest first


class IncidentPatch(RequestModel):
    status: IncidentStatus | None = None
    severity: Severity | None = None
    priority: Priority | None = None
    note: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def _not_empty(self) -> IncidentPatch:
        if self.status is None and self.severity is None and self.priority is None and not self.note:
            raise ValueError("provide at least one of status, severity, priority, note")
        return self


class UnmergeRequest(RequestModel):
    report_id: int = Field(gt=0)


class UnmergeResponse(BaseModel):
    old: IncidentOut
    new: IncidentOut


# ---------------------------------------------------------------- pipeline response


class PhotoAssessmentOut(BaseModel):
    """Gemini Vision result for a report photo (contract §3 `classification.photo`).

    Output-only: no range checks here — this is serialised after the DB commit, so a
    strict check would turn a saved report into a 500. BE2's vision service clamps values.
    """

    relevant: bool
    type: str | None
    severity_hint: int | None
    hazards: list[str]
    description: str
    confidence: float


class ClassificationOut(BaseModel):
    """Mirror of services.classifier.ClassificationResult (contract §5).

    Output-only (serialised after commit), so ranges are not re-validated; the values that
    reach the DB are guarded by the Incident CHECK constraints instead.
    """

    model_config = ConfigDict(from_attributes=True)

    type: str
    severity: int
    priority: str
    title: str
    location_text: str | None
    people_affected_est: int | None
    hazards: list[str]
    reasoning: str
    confidence: float
    lang: str
    source_model: str  # "openai" | "gemini" | "fallback" (keyword rules) | "rules" (sensor)
    model: str | None = None  # e.g. "openai:gpt-4.1-mini"; "cache:" prefix when served from the AI cache
    photo: PhotoAssessmentOut | None = None


class ReportCreatedResponse(BaseModel):
    report: ReportOut
    incident: IncidentOut
    merged: bool
    classification: ClassificationOut


# ---------------------------------------------------------------- health & simulator


class HealthOut(BaseModel):
    status: Literal["ok", "degraded"]
    ai: bool
    db: bool


class SimulatorStart(RequestModel):
    scenario: str = Field(default="ahmedabad_flood", pattern=r"^[a-z0-9_]{1,64}$")
    speed: float = Field(default=1.0, gt=0, le=20)


class SimulatorStatus(BaseModel):
    running: bool
    events_sent: int
    events_total: int


class SimulatorStarted(BaseModel):
    running: bool
    events_total: int


class SimulatorStopped(BaseModel):
    running: bool


class OkResponse(BaseModel):
    ok: bool


# ---------------------------------------------------------------- websocket (contract §4)

WsEvent = Literal[
    "report.created", "incident.created", "incident.updated", "incident.merged",
    "assignment.updated", "resource.updated", "alert.created", "simulator.status",
]


class WsMessage(BaseModel):
    event: WsEvent
    data: Any
    ts: UTCDatetime
