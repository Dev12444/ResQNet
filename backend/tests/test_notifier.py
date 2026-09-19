"""Telegram notifier tests (Task 13). Owner: BE1.

A fake Telegram API (httpx.MockTransport) records every call; nothing leaves the machine.
"""
import json
import logging
import time
from datetime import datetime, timezone

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models as m
from app import pipeline
from app.config import get_settings
from app.db import Base, get_db
from app.main import app
from app.schemas import AlertOut, AssignmentOut, IncidentOut, ResourceOut
from app.seed import reset_database
from app.services import notifier, summarizer

TOKEN = "123456:SECRET-BOT-TOKEN"
AUTHORITY, RESPONDERS = "-1001111", "-1002222"
NOW = datetime(2026, 9, 19, 8, 0, tzinfo=timezone.utc)


class FakeTelegram:
    def __init__(self, statuses=None, raise_exc=None, delay=0.0):
        self.calls: list[dict] = []
        self.statuses = list(statuses or [])
        self.raise_exc = raise_exc
        self.delay = delay

    def __call__(self, request: httpx.Request) -> httpx.Response:
        if self.delay:
            time.sleep(self.delay)
        if self.raise_exc:
            raise self.raise_exc(f"connect failed for {request.url}", request=request)
        body = json.loads(request.content)
        self.calls.append({"url": str(request.url), **body})
        status = self.statuses.pop(0) if self.statuses else 200
        if status == 429:
            return httpx.Response(429, json={"ok": False, "parameters": {"retry_after": 0.01}})
        return httpx.Response(status, json={"ok": status == 200})

    def texts(self, chat):
        return [c["text"] for c in self.calls if c["chat_id"] == chat]


@pytest.fixture()
def tg(monkeypatch):
    monkeypatch.setenv("AI_ENABLED", "false")
    monkeypatch.setenv("LLM_CACHE_PATH", "")
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", TOKEN)
    monkeypatch.setenv("TELEGRAM_AUTHORITY_CHAT_ID", AUTHORITY)
    monkeypatch.setenv("TELEGRAM_RESPONDER_CHAT_ID", RESPONDERS)
    get_settings.cache_clear()
    summarizer._last.clear()
    fake = FakeTelegram()
    monkeypatch.setattr(notifier, "_transport", httpx.MockTransport(fake))
    monkeypatch.setattr(notifier, "_submit", lambda fn, *args: fn(*args))  # run inline for assertions
    yield fake
    pipeline.cancel_trailing_refreshes()
    get_settings.cache_clear()
    summarizer._last.clear()


def _incident_out(**kw) -> IncidentOut:
    data = dict(id=7, code="INC-0007", type="flood", severity=4, priority="P1", status="new",
                title="Car trapped in Akhbarnagar underpass", lat=23.0588, lng=72.562,
                address="Akhbarnagar Underpass", ai_summary=None, ai_reasoning=None,
                ai_actions=["Send rescue boat", "Close underpass", "Ambulance at exit", "4th action"],
                confidence=0.9, hazards=["trapped_people"], people_affected_est=2, report_count=3,
                created_at=NOW, updated_at=NOW, dispatched_at=None, resolved_at=None)
    data.update(kw)
    return IncidentOut(**data)


def _alert_out(kind="critical", message="P1 flood INC-0007 at Akhbarnagar Underpass") -> AlertOut:
    return AlertOut(id=1, incident_id=7, incident_code="INC-0007", kind=kind, message=message,
                    acknowledged=False, created_at=NOW)


# ---------------------------------------------------------------- formatting


def test_alert_message_format():
    text = notifier.format_alert(_alert_out(), _incident_out())
    assert text.startswith("<b>🚨 CRITICAL</b> · INC-0007")
    assert "P1 · flood · severity 4 · status new · 3 report(s)" in text
    assert "📍 Akhbarnagar Underpass" in text
    assert "https://www.google.com/maps/search/?api=1&amp;query=" not in text  # link kept raw in href
    assert 'href="https://www.google.com/maps/search/?api=1&query=23.05880,72.56200"' in text


def test_user_text_is_html_escaped():
    evil = _incident_out(title="<script>alert(1)</script>", address="A & B <b>", ai_actions=["<i>x</i>"])
    text = notifier.format_alert(_alert_out(message="Fire at <C.G. Road> & more"), evil)
    assert "<script>" not in text and "&lt;C.G. Road&gt; &amp; more" in text and "A &amp; B &lt;b&gt;" in text


def test_dispatch_message_format():
    res = ResourceOut(id=3, callsign="NDRF-BOAT-01", kind="rescue_boat", status="assigned", lat=23.03,
                      lng=72.577, base="Sabarmati Riverfront Post", phone=None, current_incident_id=7)
    a = AssignmentOut(id=11, incident_id=7, resource_id=3, resource=res, status="assigned", eta_min=9,
                      approved_by="dispatcher", created_at=NOW, updated_at=NOW)
    text = notifier.format_dispatch(_incident_out(), [a], "dispatcher")
    assert text.startswith("<b>🚨 DISPATCH · INC-0007</b>")
    assert "🚤 NDRF-BOAT-01 — ETA 9 min (from Sabarmati Riverfront Post)" in text
    assert "• Send rescue boat" in text and "4th action" not in text  # top 3 actions only
    assert text.endswith("Approved by dispatcher")


def test_long_messages_are_truncated():
    text = notifier.format_alert(_alert_out(message="x" * 5000), None)
    assert len(text) == notifier.MAX_MESSAGE_LEN and text.endswith("…")


def test_no_map_link_without_coordinates():
    assert "open map" not in notifier.format_alert(_alert_out(), _incident_out(lat=None, lng=None))


# ---------------------------------------------------------------- sending


def test_send_posts_html_message(tg):
    assert notifier.send_message(AUTHORITY, "<b>hi</b>") is True
    (call,) = tg.calls
    assert call["url"].endswith(f"/bot{TOKEN}/sendMessage")
    assert call["chat_id"] == AUTHORITY and call["parse_mode"] == "HTML" and call["disable_web_page_preview"]


def test_rate_limit_retried_once(tg):
    tg.statuses = [429, 200]
    assert notifier.send_message(AUTHORITY, "x") is True and len(tg.calls) == 2


def test_failures_return_false_and_never_log_the_token(tg, monkeypatch, caplog):
    tg.statuses = [500]
    with caplog.at_level(logging.WARNING, logger="resqnet.notifier"):
        assert notifier.send_message(AUTHORITY, "x") is False
        monkeypatch.setattr(notifier, "_transport", httpx.MockTransport(FakeTelegram(raise_exc=httpx.ConnectError)))
        assert notifier.send_message(AUTHORITY, "x") is False  # network error: no exception escapes
    assert "HTTP 500" in caplog.text and "ConnectError" in caplog.text
    assert TOKEN not in caplog.text and "SECRET" not in caplog.text


def test_disabled_without_token_or_chat(monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "")
    get_settings.cache_clear()
    sent = []
    monkeypatch.setattr(notifier, "_submit", lambda fn, *a: sent.append(a))
    try:
        notifier.notify_alert(_alert_out(), _incident_out())
        assert notifier.send_message("123", "x") is False
        assert sent == []
    finally:
        get_settings.cache_clear()


def test_notify_returns_immediately_even_if_telegram_is_slow(monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", TOKEN)
    monkeypatch.setenv("TELEGRAM_AUTHORITY_CHAT_ID", AUTHORITY)
    get_settings.cache_clear()
    slow = FakeTelegram(delay=1.0)
    monkeypatch.setattr(notifier, "_transport", httpx.MockTransport(slow))
    try:
        started = time.monotonic()
        notifier.notify_alert(_alert_out(), _incident_out())  # real background pool
        assert time.monotonic() - started < 0.2
        deadline = time.monotonic() + 5
        while not slow.calls and time.monotonic() < deadline:
            time.sleep(0.05)
        assert len(slow.calls) == 1  # still delivered in the background
    finally:
        get_settings.cache_clear()


# ---------------------------------------------------------------- end to end through the API


@pytest.fixture()
def client(tg):
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)

    @event.listens_for(eng, "connect")
    def _fk(dbapi_conn, _record):
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(eng)
    Session = sessionmaker(bind=eng, expire_on_commit=False)
    with Session() as db:
        reset_database(db)

    def _db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _db
    with TestClient(app) as c:
        yield c, Session
    app.dependency_overrides.clear()
    eng.dispose()


def test_p1_report_buzzes_authority_and_dispatch_buzzes_responders(client, tg):
    c, Session = client
    body = {"source": "citizen", "lat": 23.0588, "lng": 72.562,
            "text": "Car stuck in Akhbarnagar underpass, two people inside"}
    inc = c.post("/api/reports", json=body).json()["incident"]
    (critical,) = tg.texts(AUTHORITY)
    assert "🚨 CRITICAL" in critical and "INC-0001" in critical and "open map" in critical

    with Session() as db:
        boat = db.scalars(select(m.Resource.id).where(m.Resource.callsign == "NDRF-BOAT-01")).one()
    c.post(f"/api/incidents/{inc['id']}/dispatch", json={"resource_ids": [boat], "approved_by": "Rahi"})
    (order,) = tg.texts(RESPONDERS)
    assert "DISPATCH · INC-0001" in order and "NDRF-BOAT-01 — ETA" in order and "Approved by Rahi" in order


def test_manual_escalation_buzzes_authority(client, tg):
    c, _ = client
    inc = c.post("/api/reports", json={"source": "citizen", "lat": 22.966, "lng": 72.63,
                                       "text": "Gas leak at Vatva GIDC factory, workers fainting"}).json()["incident"]
    c.patch(f"/api/incidents/{inc['id']}", json={"status": "escalated", "note": "no hazmat"},
            headers={"X-Actor": "supervisor"})
    kinds = [t.split("</b>")[0] for t in tg.texts(AUTHORITY)]
    assert kinds == ["<b>🚨 CRITICAL", "<b>🔺 ESCALATED"]
    assert "escalated by supervisor: no hazmat" in tg.texts(AUTHORITY)[1]


def test_telegram_outage_never_breaks_the_api(client, tg, monkeypatch):
    c, _ = client
    monkeypatch.setattr(notifier, "_transport", httpx.MockTransport(FakeTelegram(raise_exc=httpx.ConnectTimeout)))
    r = c.post("/api/reports", json={"source": "citizen", "lat": 23.0588, "lng": 72.562,
                                     "text": "Car stuck in Akhbarnagar underpass, two people inside"})
    assert r.status_code == 201


def test_httpx_request_log_does_not_leak_the_token(tg, caplog):
    """httpx logs every request URL at INFO; Telegram URLs contain the bot token."""
    with caplog.at_level(logging.DEBUG):
        assert notifier.send_message(AUTHORITY, "x") is True
    assert "api.telegram.org/bot<redacted>/sendMessage" in caplog.text
    assert TOKEN not in caplog.text and "SECRET" not in caplog.text


def test_redaction_leaves_other_logs_alone(caplog):
    with caplog.at_level(logging.INFO, logger="httpx"):
        logging.getLogger("httpx").info("HTTP Request: POST https://api.openai.com/v1/responses 200")
    assert "https://api.openai.com/v1/responses" in caplog.text
