"""WebSocket tests (Task 7). Owner: BE1."""
import asyncio
import threading
import time
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app import schemas as s
from app import ws_manager as wsm
from app.config import get_settings
from app.main import app
from app.ws_manager import ConnectionManager, build_message, manager


@pytest.fixture()
def client():
    with TestClient(app) as c:  # runs the lifespan: manager.start()/stop()
        yield c


def _wait_for(predicate, timeout=3.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return True
        time.sleep(0.02)
    return False


def _connected(n):
    return _wait_for(lambda: manager.client_count == n)


# ---------------------------------------------------------------- envelope


def test_message_envelope_matches_contract():
    ts = datetime(2026, 9, 19, 8, 42, 11, tzinfo=timezone.utc)
    msg = build_message("incident.created", {"id": 7, "code": "INC-0007"}, ts)
    assert msg == '{"event": "incident.created", "data": {"id": 7, "code": "INC-0007"}, "ts": "2026-09-19T08:42:11Z"}'


def test_pydantic_models_are_serialised_with_utc_z():
    report = s.ReportOut(id=1, source="citizen", text="અખબારનગર", lang="gu", lat=23.0, lng=72.5, address=None,
                         photo_url=None, reporter=None, sensor=None, incident_id=7,
                         created_at=datetime(2026, 9, 19, 8, 42, 10, tzinfo=timezone.utc))
    msg = build_message("incident.merged", {"incident": {"id": 7}, "report": report})
    assert '"created_at": "2026-09-19T08:42:10Z"' in msg and "અખબારનગર" in msg


def test_unknown_event_and_nan_rejected_in_caller():
    with pytest.raises(ValueError, match="Unknown WebSocket event"):
        build_message("incident.deleted", {})
    with pytest.raises(ValueError):
        build_message("incident.updated", {"confidence": float("nan")})


def test_every_contract_event_is_allowed():
    assert wsm.WS_EVENTS == {"report.created", "incident.created", "incident.updated", "incident.merged",
                             "assignment.updated", "resource.updated", "alert.created", "simulator.status"}


def test_publish_when_not_running_is_a_silent_noop():
    ConnectionManager().publish("incident.updated", {"id": 1})  # no loop bound: nothing to do, no error


# ---------------------------------------------------------------- end to end


def test_client_receives_published_event(client):
    with client.websocket_connect("/ws") as ws:
        assert _connected(1)
        manager.publish("incident.created", {"id": 1, "code": "INC-0001"})
        msg = ws.receive_json()
        assert msg["event"] == "incident.created" and msg["data"] == {"id": 1, "code": "INC-0001"}
        assert msg["ts"].endswith("Z")


def test_client_binary_and_text_frames_are_ignored(client):
    """Clients never need to send anything, but a binary frame must not kill their connection."""
    with client.websocket_connect("/ws") as ws:
        assert _connected(1)
        ws.send_bytes(b"\x00\x01binary")
        ws.send_text("ping")
        manager.publish("incident.created", {"id": 1})
        assert ws.receive_json()["event"] == "incident.created"
        assert manager.client_count == 1


def test_all_clients_receive_and_order_is_preserved(client):
    with client.websocket_connect("/ws") as a, client.websocket_connect("/ws") as b:
        assert _connected(2)
        for i in range(50):
            manager.publish("incident.updated", {"seq": i})
        for ws in (a, b):
            assert [ws.receive_json()["data"]["seq"] for _ in range(50)] == list(range(50))


def test_publish_from_worker_threads(client):
    """Sync routes and background tasks run in threads; every event must still arrive."""
    with client.websocket_connect("/ws") as ws:
        assert _connected(1)
        threads = [threading.Thread(target=manager.publish, args=("alert.created", {"n": n})) for n in range(20)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        assert sorted(ws.receive_json()["data"]["n"] for _ in range(20)) == list(range(20))


def test_disconnected_client_does_not_affect_others(client):
    with client.websocket_connect("/ws") as keep:
        with client.websocket_connect("/ws"):
            assert _connected(2)
        assert _connected(1)  # server noticed the close
        manager.publish("resource.updated", {"id": 3, "status": "offline"})
        assert keep.receive_json()["data"] == {"id": 3, "status": "offline"}


def test_client_messages_are_ignored(client):
    with client.websocket_connect("/ws") as ws:
        ws.send_text("hello server")
        manager.publish("simulator.status", {"running": False, "events_sent": 0, "events_total": 30})
        assert ws.receive_json()["event"] == "simulator.status"


def test_allowed_origin_connects(client):
    origin = get_settings().cors_list[0]
    with client.websocket_connect("/ws", headers={"Origin": origin}) as ws:
        manager.publish("incident.updated", {"id": 1})
        assert ws.receive_json()["data"] == {"id": 1}


def test_foreign_origin_rejected(client):
    with (
        pytest.raises(WebSocketDisconnect) as exc,
        client.websocket_connect("/ws", headers={"Origin": "https://evil.example"}) as ws,
    ):
        ws.receive_json()
    assert exc.value.code == 1008


def test_rest_and_ws_coexist(client):
    with client.websocket_connect("/ws"):
        assert client.get("/health").json()["status"] == "ok"


# ---------------------------------------------------------------- slow / broken clients (unit)


class _FakeWS:
    def __init__(self, behaviour: str):
        self.behaviour, self.sent, self.closed = behaviour, [], None

    async def send_text(self, text):
        if self.behaviour == "hang":
            await asyncio.sleep(60)
        if self.behaviour == "error":
            raise RuntimeError("socket broken")
        self.sent.append(text)

    async def close(self, code=1000):
        self.closed = code


def test_stalled_and_broken_clients_are_dropped(monkeypatch):
    monkeypatch.setattr(wsm, "SEND_TIMEOUT_SEC", 0.2)

    async def scenario():
        mgr = ConnectionManager()
        good, hang, broken = _FakeWS("ok"), _FakeWS("hang"), _FakeWS("error")
        mgr._clients.update({good, hang, broken})
        started = time.monotonic()
        await mgr.broadcast_now(build_message("incident.updated", {"id": 1}))
        elapsed = time.monotonic() - started
        await mgr.broadcast_now(build_message("incident.updated", {"id": 2}))
        return mgr, good, hang, broken, elapsed

    mgr, good, hang, broken, elapsed = asyncio.run(scenario())
    assert elapsed < 1.0  # a stalled client costs at most the timeout, not forever
    assert len(good.sent) == 2
    assert mgr.client_count == 1 and hang.closed == 1011 and broken.closed == 1011


def test_dispatcher_survives_and_drains():
    async def scenario():
        mgr = ConnectionManager()
        await mgr.start()
        good = _FakeWS("ok")
        mgr._clients.add(good)
        for i in range(5):
            mgr.publish("incident.updated", {"seq": i})  # same-loop path
        await mgr.drain()
        assert mgr.running
        await mgr.stop()
        return good, mgr

    good, mgr = asyncio.run(scenario())
    assert [m.split('"seq": ')[1][0] for m in good.sent] == ["0", "1", "2", "3", "4"]
    assert not mgr.running and good.closed == 1001
