"""Alerts + escalation (PRD FR-6). Owner: BE1.

evaluate() is a pure-ish rule pass over open incidents (adds alerts / escalates in the given
session; the caller commits). run_tick() wraps it with a session, commit and broadcasts, and
EscalationLoop runs it every ESCALATION_TICK_SEC. A new report is also checked immediately.

Alerts (each fires once; see the dedup rules per kind):
- critical     P1 incident                                  once per incident, ever
- sla_breach   P1 not dispatched in SLA_P1_DISPATCH_SEC,    once per incident
               P2 in SLA_P2_DISPATCH_SEC
- sla_breach   active unit with no status update for        once per unit per incident
               SLA_NO_UPDATE_SEC
- escalation   dispatch SLA missed AUTO_ESCALATE_AFTER_BREACHES   once per incident; a human
               times -> status "escalated" (0 = never automatic)   de-escalation is respected
- shortage     a needed unit kind has 0 available           while an unacknowledged one exists
Shortage messages name the kind in words ("No rescue boats available ...") — BE2 analytics
matches "rescue_boat" or "rescue boat" in the message.
"""
from __future__ import annotations

import asyncio
import contextlib
import logging
from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.orm.attributes import set_committed_value

from app import models as m
from app.alerting import ALERT_LOCK, add_alert, publish_alert
from app.config import Settings, get_settings
from app.schemas import IncidentOut
from app.services.recommender import needed_kinds
from app.ws_manager import manager

log = logging.getLogger("resqnet.escalation")

KIND_PLURAL = {
    "ambulance": "ambulances",
    "fire_truck": "fire trucks",
    "rescue_boat": "rescue boats",
    "police": "police units",
    "ndrf_team": "NDRF teams",
    "hazmat": "hazmat units",
}
UNDISPATCHED = ("new", "triaged", "escalated")
DISPATCH_BREACH_MARK = "not dispatched for"
NO_UPDATE_MARK = "No status update from"


@dataclass
class TickResult:
    alerts: list[m.Alert] = field(default_factory=list)
    escalated: list[m.Incident] = field(default_factory=list)


def _minutes(seconds: float) -> str:
    mins = int(seconds // 60)
    return f"{mins} min" if mins >= 1 else f"{int(seconds)} s"


def _where(inc: m.Incident) -> str:
    return inc.address or inc.title or "unknown location"


def _dispatch_sla(inc: m.Incident, st: Settings) -> int | None:
    return {"P1": st.sla_p1_dispatch_sec, "P2": st.sla_p2_dispatch_sec}.get(inc.priority)


def _escalate_if_still_undispatched(db: Session, inc: m.Incident, now: datetime) -> bool:
    """Conditional UPDATE: a dispatch (or resolve) committed since this tick read the incident wins.

    A plain attribute write would overwrite it and leave an "escalated" incident with units out.
    """
    changed = db.execute(
        update(m.Incident)
        .where(m.Incident.id == inc.id, m.Incident.status.in_(("new", "triaged")))
        .values(status="escalated", updated_at=now)
        .execution_options(synchronize_session=False)
    ).rowcount
    if changed:  # keep the in-memory row in step without marking it dirty (no second UPDATE)
        set_committed_value(inc, "status", "escalated")
        set_committed_value(inc, "updated_at", now)
    return bool(changed)


def evaluate(
    db: Session,
    now: datetime | None = None,
    settings: Settings | None = None,
    incident_ids: list[int] | None = None,
) -> TickResult:
    """Apply every rule to open incidents (or just `incident_ids`). Adds to `db`; does not commit."""
    st = settings or get_settings()
    now = now or datetime.now(timezone.utc)
    q = (
        select(m.Incident)
        .options(selectinload(m.Incident.assignments).selectinload(m.Assignment.resource))
        .where(m.Incident.status.in_(m.OPEN_INCIDENT_STATUSES))
    )
    if incident_ids is not None:
        q = q.where(m.Incident.id.in_(incident_ids))
    incidents = list(db.scalars(q.order_by(m.Incident.id)))
    result = TickResult()
    if not incidents:
        return result

    # One query each for existing alerts and unit availability (no per-incident queries).
    alerts_by_incident: dict[int, list[m.Alert]] = {}
    for a in db.scalars(select(m.Alert).where(m.Alert.incident_id.in_([i.id for i in incidents]))):
        alerts_by_incident.setdefault(a.incident_id, []).append(a)
    available = Counter(
        dict(db.execute(select(m.Resource.kind, func.count()).where(m.Resource.status == "available")
                        .group_by(m.Resource.kind)).all())
    )

    def fire(kind: str, message: str, inc: m.Incident) -> None:
        alert = add_alert(db, kind=kind, message=message, incident=inc)
        alerts_by_incident.setdefault(inc.id, []).append(alert)
        result.alerts.append(alert)

    def has(inc: m.Incident, kind: str, contains: str = "", only_open: bool = False) -> bool:
        return any(a.kind == kind and contains in a.message and not (only_open and a.acknowledged)
                   for a in alerts_by_incident.get(inc.id, []))

    for inc in incidents:
        label = f"{inc.priority} {inc.type.replace('_', ' ')} {inc.code}"
        active = [a for a in inc.assignments if a.is_active]
        undispatched = inc.status in UNDISPATCHED and not active

        if inc.priority == "P1" and not has(inc, "critical"):
            hazards = f" — {', '.join(h.replace('_', ' ') for h in inc.hazards)}" if inc.hazards else ""
            fire("critical", f"{label} at {_where(inc)}{hazards}", inc)

        sla = _dispatch_sla(inc, st)
        if undispatched and sla and inc.created_at is not None:
            waited = (now - inc.created_at).total_seconds()
            breaches = int(waited // sla) if sla > 0 else 0
            if breaches >= 1 and not has(inc, "sla_breach", DISPATCH_BREACH_MARK):
                fire("sla_breach", f"{label} ({_where(inc)}) {DISPATCH_BREACH_MARK} {_minutes(waited)}", inc)
            auto = st.auto_escalate_after_breaches
            if (auto > 0 and breaches >= auto and inc.status != "escalated" and not has(inc, "escalation")
                    and _escalate_if_still_undispatched(db, inc, now)):
                result.escalated.append(inc)
                fire("escalation", f"{label} escalated automatically: {DISPATCH_BREACH_MARK} "
                                   f"{_minutes(waited)} ({breaches} SLA periods missed)", inc)

        for a in active:
            quiet = (now - a.updated_at).total_seconds() if a.updated_at else 0
            mark = f"{NO_UPDATE_MARK} {a.resource.callsign} on {inc.code}"
            if quiet >= st.sla_no_update_sec and not has(inc, "sla_breach", mark):
                fire("sla_breach", f"{mark} for {_minutes(quiet)} (status {a.status})", inc)

        if undispatched:
            for kind in needed_kinds(inc.type, list(inc.hazards or [])):
                words = KIND_PLURAL.get(kind, kind)
                if available[kind] == 0 and not has(inc, "shortage", f"No {words} available", only_open=True):
                    fire("shortage", f"No {words} available for {inc.code} ({inc.type.replace('_', ' ')})", inc)
    return result


def run_tick(
    session_factory: Callable[[], Session],
    now: datetime | None = None,
    incident_ids: list[int] | None = None,
) -> TickResult:
    """One evaluation with its own session: commit, then broadcast. Never raises."""
    try:
        with session_factory() as db:
            with ALERT_LOCK:  # dedup check -> insert -> commit must not interleave with another check
                result = evaluate(db, now=now, incident_ids=incident_ids)
                if not result.alerts and not result.escalated:
                    return result
                db.commit()
            for inc in result.escalated:
                manager.publish("incident.updated", IncidentOut.model_validate(inc))
            for alert in result.alerts:
                publish_alert(alert)
                log.info("Alert %s: %s", alert.kind, alert.message)
            return result
    except Exception:
        log.exception("Escalation tick failed")
        return TickResult()


def check_incident_in_background(bind, incident_id: int) -> None:
    """Background task after a report: immediate critical/shortage alerts for that incident."""
    run_tick(lambda: Session(bind=bind, expire_on_commit=False), incident_ids=[incident_id])


class EscalationLoop:
    """Runs run_tick() every ESCALATION_TICK_SEC in a worker thread (never blocks the event loop)."""

    def __init__(self) -> None:
        self._task: asyncio.Task[None] | None = None

    async def start(self, session_factory: Callable[[], Session], tick_sec: float) -> None:
        if tick_sec <= 0:
            log.info("Escalation loop disabled (ESCALATION_TICK_SEC <= 0)")
            return
        self._task = asyncio.create_task(self._run(session_factory, tick_sec), name="escalation-loop")

    async def _run(self, session_factory: Callable[[], Session], tick_sec: float) -> None:
        while True:
            await asyncio.sleep(tick_sec)
            await asyncio.to_thread(run_tick, session_factory)

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
            self._task = None

    @property
    def running(self) -> bool:
        return self._task is not None and not self._task.done()


loop = EscalationLoop()
