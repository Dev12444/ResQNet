"""Router: WebSocket /ws. Owner: BE1.

Contract §4: server -> client only. Messages from the client are read (to detect
disconnects) and ignored. Clients should reconnect with backoff and refetch
/api/incidents after reconnecting. Keep-alive pings are handled by uvicorn.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.config import get_settings
from app.ws_manager import manager

log = logging.getLogger("resqnet.ws")

router = APIRouter(tags=["websocket"])


def origin_allowed(origin: str | None) -> bool:
    """Browsers always send Origin; allow only the frontend origins (same list as CORS).
    Non-browser clients (scripts, wscat) send none and are allowed."""
    return origin is None or origin in get_settings().cors_list


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    if not origin_allowed(ws.headers.get("origin")):
        log.warning("WebSocket rejected: origin %r not in CORS_ORIGINS", ws.headers.get("origin"))
        await ws.close(code=1008)  # policy violation
        return
    if not await manager.connect(ws):
        return
    try:
        while True:
            await ws.receive_text()  # ignore client messages; returns/raises on disconnect
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(ws)
