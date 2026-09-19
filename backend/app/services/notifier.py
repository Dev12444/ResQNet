"""Telegram notifications (PRD FR-9). Owner: BE1.

- Alerts (critical / sla_breach / escalation / shortage) -> authority chat
- Dispatch orders (units, ETAs, map link, top AI actions) -> responder chat

Messages are built in the caller's thread (from already-serialised API objects), then sent
on a small background pool: a slow or unreachable Telegram never delays a request, the
escalation loop or dispatch. Every send has a timeout and never raises. With no bot token
or chat id configured, everything is a silent no-op.

The bot token is part of Telegram's URL. httpx error text includes the URL, so errors are logged
by type / status only; and httpx's own INFO request log would print it too, so a filter on the
"httpx" logger redacts "/bot<token>/" in every record.
"""
from __future__ import annotations

import html
import logging
import re
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import httpx

from app.config import get_settings
from app.schemas import AlertOut, AssignmentOut, IncidentOut

log = logging.getLogger("resqnet.notifier")

API_BASE = "https://api.telegram.org"
TIMEOUT_SEC = 5.0
MAX_RETRY_AFTER_SEC = 5.0
MAX_MESSAGE_LEN = 4096  # Telegram's limit
AUTHORITY_ALERT_KINDS = frozenset({"critical", "sla_breach", "escalation", "shortage"})
ALERT_BADGE = {
    "critical": "🚨 CRITICAL",
    "sla_breach": "⏱️ SLA BREACH",
    "escalation": "🔺 ESCALATED",
    "shortage": "📉 SHORTAGE",
}
KIND_EMOJI = {"ambulance": "🚑", "fire_truck": "🚒", "rescue_boat": "🚤", "police": "🚓",
              "ndrf_team": "🦺", "hazmat": "☣️"}

_BOT_TOKEN_IN_URL = re.compile(r"/bot[^/\s]+/")


class RedactBotToken(logging.Filter):
    """Mask Telegram bot tokens in log records (httpx logs every request URL at INFO)."""

    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        if "/bot" in message:
            record.msg, record.args = _BOT_TOKEN_IN_URL.sub("/bot<redacted>/", message), None
        return True


_redactor = RedactBotToken()
for _name in ("httpx", "httpcore"):
    if not any(isinstance(f, RedactBotToken) for f in logging.getLogger(_name).filters):
        logging.getLogger(_name).addFilter(_redactor)

_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="telegram")
_transport: httpx.BaseTransport | None = None  # tests inject httpx.MockTransport


# ---------------------------------------------------------------- formatting


def _esc(value: Any) -> str:
    return html.escape(str(value), quote=False)


def maps_link(lat: float | None, lng: float | None) -> str | None:
    if lat is None or lng is None:
        return None
    return f"https://www.google.com/maps/search/?api=1&query={lat:.5f},{lng:.5f}"


def _location_line(incident: IncidentOut | None) -> str:
    if incident is None:
        return ""
    place = _esc(incident.address or incident.title)
    link = maps_link(incident.lat, incident.lng)
    return f"\n📍 {place}" + (f" — <a href=\"{link}\">open map</a>" if link else "")


def format_alert(alert: AlertOut, incident: IncidentOut | None) -> str:
    badge = ALERT_BADGE.get(alert.kind, alert.kind.upper())
    code = f" · {_esc(alert.incident_code)}" if alert.incident_code else ""
    head = f"<b>{badge}</b>{code}"
    detail = f"\n{_esc(alert.message)}"
    context = ""
    if incident is not None:
        context = (f"\n{incident.priority} · {_esc(incident.type.replace('_', ' '))} · severity "
                   f"{incident.severity} · status {incident.status} · {incident.report_count} report(s)")
    return _truncate(head + detail + context + _location_line(incident))


def format_dispatch(incident: IncidentOut, assignments: list[AssignmentOut], approved_by: str) -> str:
    units = "\n".join(
        f"{KIND_EMOJI.get(a.resource.kind, '•')} {_esc(a.resource.callsign)}"
        + (f" — ETA {a.eta_min} min" if a.eta_min is not None else "")
        + (f" (from {_esc(a.resource.base)})" if a.resource.base else "")
        for a in assignments
    )
    actions = ""
    if incident.ai_actions:
        actions = "\n<b>Actions</b>\n" + "\n".join(f"• {_esc(x)}" for x in incident.ai_actions[:3])
    head = (f"<b>🚨 DISPATCH · {_esc(incident.code)}</b>\n"
            f"{incident.priority} {_esc(incident.type.replace('_', ' '))} — {_esc(incident.title)}")
    return _truncate(f"{head}\n<b>Units</b>\n{units}{_location_line(incident)}{actions}\n"
                     f"Approved by {_esc(approved_by)}")


def _truncate(text: str) -> str:
    return text if len(text) <= MAX_MESSAGE_LEN else text[: MAX_MESSAGE_LEN - 1] + "…"


# ---------------------------------------------------------------- sending


def send_message(chat_id: str, text: str) -> bool:
    """Send one message synchronously. Returns True on success; never raises; never logs the token."""
    token = get_settings().telegram_bot_token
    if not token or not chat_id:
        return False
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML", "disable_web_page_preview": True}
    try:
        with httpx.Client(timeout=TIMEOUT_SEC, transport=_transport) as client:
            for attempt in (1, 2):
                resp = client.post(f"{API_BASE}/bot{token}/sendMessage", json=payload)
                if resp.status_code == 429 and attempt == 1:  # rate limited: honour a short retry_after once
                    retry_after = _retry_after(resp)
                    if retry_after is not None and retry_after <= MAX_RETRY_AFTER_SEC:
                        time.sleep(retry_after)
                        continue
                if resp.status_code == 200:
                    return True
                log.warning("Telegram sendMessage failed: HTTP %s", resp.status_code)
                return False
    except httpx.HTTPError as e:
        log.warning("Telegram sendMessage failed: %s", type(e).__name__)  # not str(e): it contains the URL
    except Exception as e:  # never let a notification break the caller
        log.warning("Telegram sendMessage failed unexpectedly: %s", type(e).__name__)
    return False


def _retry_after(resp: httpx.Response) -> float | None:
    try:
        return float(resp.json().get("parameters", {}).get("retry_after"))
    except (ValueError, TypeError, AttributeError):
        return None


def _submit(fn, *args) -> None:
    """Fire-and-forget on the background pool (tests replace this to run inline)."""
    try:
        _executor.submit(fn, *args)
    except RuntimeError:  # pool shut down (interpreter exit)
        log.debug("Telegram pool unavailable; notification dropped")


# ---------------------------------------------------------------- public API


def notify_alert(alert: AlertOut, incident: IncidentOut | None = None) -> None:
    """Alert -> authority chat (if configured). Returns immediately."""
    st = get_settings()
    if alert.kind not in AUTHORITY_ALERT_KINDS or not (st.telegram_bot_token and st.telegram_authority_chat_id):
        return
    _submit(send_message, st.telegram_authority_chat_id, format_alert(alert, incident))


def notify_dispatch(incident: IncidentOut, assignments: list[AssignmentOut], approved_by: str) -> None:
    """Dispatch order -> responder chat (if configured). Returns immediately."""
    st = get_settings()
    if not assignments or not (st.telegram_bot_token and st.telegram_responder_chat_id):
        return
    _submit(send_message, st.telegram_responder_chat_id, format_dispatch(incident, assignments, approved_by))
