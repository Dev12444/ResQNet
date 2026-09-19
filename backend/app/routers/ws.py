"""Router: WebSocket /ws. Owner: BE1.

Contract §4: server -> client only. Messages from the client are read (to detect
disconnects) and ignored. Clients should reconnect with backoff and refetch
/api/incidents after reconnecting. Keep-alive pings are handled by uvicorn.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, WebSocket

from app.config import get_settings
from app.ws_manager import manager

log = logging.getLogger("resqnet.ws")

router = APIRouter(tags=["websocket"])


def origin_allowed(origin: str | None) -> bool:
    """Browsers always send Origin; allow only the frontend origins (same rule as CORS, incl.
    CORS_ORIGIN_REGEX). Non-browser clients (scripts, wscat) send none and are allowed."""
    return origin is None or get_settings().origin_allowed(origin)


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    if not origin_allowed(ws.headers.get("origin")):
        log.warning("WebSocket rejected: origin %r not in CORS_ORIGINS", ws.headers.get("origin"))
        await ws.close(code=1008)  # policy violation
        return
    if not await manager.connect(ws):
        return
    try:
        # Client messages (text or binary) are ignored; receive() also reports the disconnect.
        while (await ws.receive())["type"] != "websocket.disconnect":
            pass
    finally:
        manager.disconnect(ws)
