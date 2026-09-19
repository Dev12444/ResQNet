"""WebSocket broadcast manager. Owner: BE1.

Contract §4: server -> client only; every message is {"event", "data", "ts"}.

Usage from any route / background task / service (sync or async, any thread):

    from app.ws_manager import manager
    manager.publish("incident.created", IncidentOut.model_validate(incident))

Design:
- publish() serialises immediately (ORM objects must be read before their session closes)
  and hands the message to the event loop thread-safely; it never blocks or raises on I/O.
- One dispatcher task drains a queue, so every client sees events in publish order.
- Each send has a timeout; clients that fail or stall are dropped without affecting others.
"""
from __future__ import annotations

import asyncio
import contextlib
import json
import logging
from datetime import datetime, timezone
from typing import Any, get_args

from fastapi import WebSocket
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel

from app.schemas import WsEvent, to_utc_iso

log = logging.getLogger("resqnet.ws")

WS_EVENTS: frozenset[str] = frozenset(get_args(WsEvent))
SEND_TIMEOUT_SEC = 5.0
MAX_CLIENTS = 200
MAX_QUEUE = 10_000  # far above demo load; protects memory if the loop is stuck


def _to_jsonable(data: Any) -> Any:
    if isinstance(data, BaseModel):
        return data.model_dump(mode="json")
    if isinstance(data, list):
        return [_to_jsonable(x) for x in data]
    if isinstance(data, dict):
        return {k: _to_jsonable(v) for k, v in data.items()}
    return jsonable_encoder(data)


def build_message(event: str, data: Any, ts: datetime | None = None) -> str:
    """Contract §4 envelope as a JSON string. Raises ValueError for events not in the contract."""
    if event not in WS_EVENTS:
        raise ValueError(f"Unknown WebSocket event {event!r}; contract §4 allows {sorted(WS_EVENTS)}")
    return json.dumps(
        {"event": event, "data": _to_jsonable(data), "ts": to_utc_iso(ts or datetime.now(timezone.utc))},
        ensure_ascii=False,
        allow_nan=False,
    )


class ConnectionManager:
    def __init__(self) -> None:
        self._clients: set[WebSocket] = set()
        self._loop: asyncio.AbstractEventLoop | None = None
        self._queue: asyncio.Queue[str] | None = None
        self._dispatcher: asyncio.Task[None] | None = None

    # ------------------------------------------------------------ lifecycle (called from app lifespan)

    async def start(self) -> None:
        self._loop = asyncio.get_running_loop()
        self._queue = asyncio.Queue(maxsize=MAX_QUEUE)
        self._dispatcher = asyncio.create_task(self._dispatch(), name="ws-dispatcher")

    async def stop(self) -> None:
        if self._dispatcher is not None:
            self._dispatcher.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._dispatcher
        for ws in list(self._clients):
            with contextlib.suppress(Exception):  # already closed
                await ws.close(code=1001)  # going away
        self._clients.clear()
        self._loop = self._queue = self._dispatcher = None

    @property
    def running(self) -> bool:
        return self._dispatcher is not None and not self._dispatcher.done()

    @property
    def client_count(self) -> int:
        return len(self._clients)

    # ------------------------------------------------------------ connections

    async def connect(self, ws: WebSocket) -> bool:
        if len(self._clients) >= MAX_CLIENTS:
            await ws.close(code=1013)  # try again later
            log.warning("WebSocket rejected: %d clients connected", len(self._clients))
            return False
        await ws.accept()
        self._clients.add(ws)
        log.info("WebSocket connected (%d clients)", len(self._clients))
        return True

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self._clients:
            self._clients.discard(ws)
            log.info("WebSocket disconnected (%d clients)", len(self._clients))

    # ------------------------------------------------------------ publishing

    def publish(self, event: str, data: Any) -> None:
        """Queue a broadcast. Safe from any thread; never blocks. Unknown events raise ValueError."""
        message = build_message(event, data)  # validate + serialise now, in the caller's thread
        loop, queue = self._loop, self._queue
        if loop is None or queue is None or loop.is_closed():
            log.debug("WebSocket manager not running; dropped %s", event)
            return
        try:
            running_loop = asyncio.get_running_loop()
        except RuntimeError:
            running_loop = None
        if running_loop is loop:
            self._enqueue(queue, message, event)
        else:
            loop.call_soon_threadsafe(self._enqueue, queue, message, event)

    @staticmethod
    def _enqueue(queue: asyncio.Queue[str], message: str, event: str) -> None:
        try:
            queue.put_nowait(message)
        except asyncio.QueueFull:
            log.error("WebSocket queue full; dropped %s", event)

    async def broadcast_now(self, message: str) -> None:
        """Send one serialised message to every client concurrently; drop clients that fail."""
        clients = list(self._clients)
        if not clients:
            return
        results = await asyncio.gather(
            *(asyncio.wait_for(ws.send_text(message), SEND_TIMEOUT_SEC) for ws in clients),
            return_exceptions=True,
        )
        for ws, result in zip(clients, results, strict=True):
            if isinstance(result, BaseException):
                log.info("Dropping WebSocket client after send failure: %s", type(result).__name__)
                self.disconnect(ws)
                with contextlib.suppress(Exception):  # may already be closed
                    await ws.close(code=1011)

    async def _dispatch(self) -> None:
        assert self._queue is not None
        while True:
            message = await self._queue.get()
            try:
                await self.broadcast_now(message)
            except Exception:  # never let one bad send kill the dispatcher
                log.exception("WebSocket broadcast failed")
            finally:
                self._queue.task_done()

    async def drain(self) -> None:
        """Wait until every queued message has been sent (used by tests and graceful shutdown)."""
        if self._queue is not None:
            await self._queue.join()


manager = ConnectionManager()
