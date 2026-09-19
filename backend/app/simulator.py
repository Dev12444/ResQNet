"""Demo scenario simulator. Owner: BE1.

Plays app/data/scenario_<name>.json through the SAME pipeline as POST /api/reports
(app.pipeline: lock, triage, dedup, audit, WebSocket events), then the same background work
(summary refresh + immediate alert check). One run at a time, driven by an asyncio task.

Timing is absolute (start + t_offset_sec / speed), so a slow AI call on one event does not
push every later event back; summaries and alert checks run alongside, not in between.
"""
from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from pydantic import ValidationError
from sqlalchemy.engine import Connection, Engine
from sqlalchemy.orm import Session

from app.pipeline import ingest_report, publish_ingest, refresh_summary_in_background
from app.schemas import IncidentOut, ReportCreate, ReportOut, SimulatorStatus
from app.services.escalation import check_incident_in_background
from app.ws_manager import manager

log = logging.getLogger("resqnet.simulator")

SCENARIO_DIR = Path(__file__).resolve().parent / "data"
ACTOR = "simulator"
_REPORT_FIELDS = frozenset(ReportCreate.model_fields)


class ScenarioError(ValueError):
    """Scenario file missing or invalid."""


class SimulatorBusy(RuntimeError):
    """A scenario is already running."""


@dataclass(frozen=True)
class ScheduledEvent:
    offset_sec: float
    body: ReportCreate


def load_scenario(name: str, directory: Path | None = None) -> list[ScheduledEvent]:
    """Read + validate every event up front, so a broken file fails before the demo starts."""
    path = (directory or SCENARIO_DIR) / f"scenario_{name}.json"
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as e:
        raise ScenarioError(f"Scenario '{name}' not found") from e
    except (OSError, ValueError) as e:
        raise ScenarioError(f"Scenario '{name}' is not valid JSON: {e}") from e
    items = raw.get("events") if isinstance(raw, dict) else raw
    if not isinstance(items, list) or not items:
        raise ScenarioError(f"Scenario '{name}' has no events")
    events = []
    for i, item in enumerate(items):
        try:
            offset = float(item["t_offset_sec"])
            if offset < 0:
                raise ValueError("t_offset_sec must be >= 0")
            body = ReportCreate.model_validate({k: v for k, v in item.items() if k in _REPORT_FIELDS})
        except (KeyError, TypeError, ValueError, ValidationError) as e:
            raise ScenarioError(f"Scenario '{name}' event #{i}: {e}") from e
        events.append(ScheduledEvent(offset, body))
    return sorted(events, key=lambda ev: ev.offset_sec)


class Simulator:
    def __init__(self) -> None:
        self._task: asyncio.Task[None] | None = None
        self._side_tasks: set[asyncio.Task[Any]] = set()
        self.events_sent = 0
        self.events_total = 0
        self.errors = 0

    # ------------------------------------------------------------ state

    @property
    def running(self) -> bool:
        return self._task is not None and not self._task.done()

    def status(self) -> SimulatorStatus:
        return SimulatorStatus(running=self.running, events_sent=self.events_sent, events_total=self.events_total)

    def broadcast_status(self) -> None:
        manager.publish("simulator.status", self.status())

    # ------------------------------------------------------------ control (call on the event loop)

    async def start(self, events: list[ScheduledEvent], speed: float, bind: Engine | Connection) -> None:
        if self.running:
            raise SimulatorBusy("A scenario is already running; stop it first")
        self.events_sent, self.events_total, self.errors = 0, len(events), 0
        self._task = asyncio.create_task(self._run(events, speed, bind), name="simulator")
        self.broadcast_status()

    async def stop(self) -> None:
        task, self._task = self._task, None
        if task is not None and not task.done():
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task
        self.broadcast_status()

    async def wait(self) -> None:
        """Wait for the current run and its side work (tests)."""
        if self._task is not None:
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
        if self._side_tasks:
            await asyncio.gather(*self._side_tasks, return_exceptions=True)

    # ------------------------------------------------------------ run

    async def _run(self, events: list[ScheduledEvent], speed: float, bind: Engine | Connection) -> None:
        started = time.monotonic()
        try:
            for ev in events:
                delay = started + ev.offset_sec / speed - time.monotonic()
                if delay > 0:
                    await asyncio.sleep(delay)
                incident_id = await asyncio.to_thread(self._ingest, ev.body, bind)
                self.events_sent += 1
                if incident_id is not None:
                    side = asyncio.create_task(asyncio.to_thread(self._after_ingest, bind, incident_id))
                    self._side_tasks.add(side)
                    side.add_done_callback(self._side_tasks.discard)
                self.broadcast_status()
            log.info("Scenario finished: %d events, %d errors", self.events_sent, self.errors)
        finally:
            if self._task is asyncio.current_task():
                self._task = None  # finished (not cancelled): report running=false
                self.broadcast_status()

    def _ingest(self, body: ReportCreate, bind: Engine | Connection) -> int | None:
        """Worker thread: one event through the report pipeline. Errors are logged and skipped."""
        try:
            with Session(bind=bind, expire_on_commit=False) as db:
                result = ingest_report(db, body, ACTOR)
                publish_ingest(result, ReportOut.model_validate(result.report),
                               IncidentOut.model_validate(result.incident))
                return result.incident.id
        except Exception:
            self.errors += 1
            log.exception("Scenario event failed (skipped)")
            return None

    @staticmethod
    def _after_ingest(bind: Engine | Connection, incident_id: int) -> None:
        refresh_summary_in_background(bind, incident_id)
        check_incident_in_background(bind, incident_id)


simulator = Simulator()
