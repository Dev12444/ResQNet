"""Demo load + race test (Task 15). Owner: BE1.

Plays the demo scenario while several simulated operators hammer the same API at once, then
checks that the database still tells one consistent story:

    simulator     scenario at --speed (default 2x) through the real report pipeline
    citizens      bursts of near-identical reports at one spot, sent in parallel (concurrent merges)
    dispatchers   N dispatchers pick the SAME top incident + recommended units (double-dispatch races)
    field         advance active assignments; some taps are sent twice at once (duplicate taps)
    supervisor    escalates, acknowledges alerts and resolves incidents with units still out
    websocket     one dashboard client stays connected for the whole run (live runs only)

Invariants checked afterwards (exit code 1 if any fails):
    - no 5xx response, simulator finished every event
    - a unit has at most one active assignment; a busy unit has exactly one and points at its incident
    - dispatched / on_scene incidents have active units; resolved ones have none
    - every report belongs to an existing incident and report_count matches
    - at most one critical / auto-escalation / dispatch-SLA alert per incident
    - POST /api/reports p95 under the PRD's 5 s report -> dashboard budget

Usage (from backend/, server running; --reset WIPES the target database first):
    python -m scripts.load_test --base-url http://127.0.0.1:8000 --reset
    python -m scripts.load_test --base-url https://<render-app>.onrender.com --reset --speed 2
"""
from __future__ import annotations

import argparse
import contextlib
import json
import random
import statistics
import sys
import threading
import time
from collections import Counter, defaultdict
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field

import httpx

ALL_STATUSES = "new,triaged,dispatched,on_scene,escalated,resolved"
UNDISPATCHED = ("new", "triaged", "escalated")
ACTIVE = ("assigned", "en_route", "on_scene")
NEXT_STEP = {"assigned": "en_route", "en_route": "on_scene", "on_scene": "completed"}
PRIORITY_RANK = {"P1": 0, "P2": 1, "P3": 2, "P4": 3}
REPORT_P95_BUDGET_SEC = 5.0
BURST_SPOTS = [  # (lat, lng, text) far from the scenario's own incidents
    (23.0395, 72.5140, "Tree fell on a car near Thaltej crossroads, driver hurt"),
    (23.0707, 72.6353, "Wall collapsed at Naroda Patiya, people trapped under debris"),
]


# ---------------------------------------------------------------- recording


@dataclass
class Recorder:
    """Thread-safe log of every request: status codes, latencies and 5xx details."""

    codes: dict[str, Counter] = field(default_factory=lambda: defaultdict(Counter))
    latency: dict[str, list[float]] = field(default_factory=lambda: defaultdict(list))
    server_errors: list[str] = field(default_factory=list)
    worker_errors: list[str] = field(default_factory=list)
    violations: list[str] = field(default_factory=list)  # found while running (e.g. a split burst)
    lock: threading.Lock = field(default_factory=threading.Lock)

    def call(self, client: httpx.Client, method: str, url: str, label: str, **kw) -> httpx.Response | None:
        started = time.perf_counter()
        try:
            resp = client.request(method, url, **kw)
        except httpx.HTTPError as e:
            with self.lock:
                self.codes[label]["network-error"] += 1
                self.server_errors.append(f"{method} {url}: {type(e).__name__}")
            return None
        elapsed = time.perf_counter() - started
        with self.lock:
            self.codes[label][resp.status_code] += 1
            self.latency[label].append(elapsed)
            if resp.status_code >= 500:
                self.server_errors.append(f"{method} {url} -> {resp.status_code}: {resp.text[:200]}")
        return resp

    def json(self, client: httpx.Client, method: str, url: str, label: str, **kw):
        resp = self.call(client, method, url, label, **kw)
        return resp.json() if resp is not None and resp.status_code < 300 else None


def _p(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, round(pct / 100 * (len(ordered) - 1)))]


# ---------------------------------------------------------------- actors


def _loop(stop: threading.Event, rec: Recorder, name: str, interval: float, step: Callable[[], None]) -> None:
    """Run `step` until stopped; an actor bug is recorded (it fails the run) but never kills the others."""
    while not stop.is_set():
        try:
            step()
        except Exception as e:
            with rec.lock:
                rec.worker_errors.append(f"{name}: {type(e).__name__}: {e}")
        stop.wait(interval)


def _open_incidents(client, rec) -> list[dict]:
    return rec.json(client, "GET", "/api/incidents", "GET /api/incidents") or []


def dispatcher_step(client, rec, name: str, rng: random.Random) -> None:
    """Everyone grabs the most urgent undispatched incident and its suggested units: deliberate races."""
    waiting = [i for i in _open_incidents(client, rec) if i["status"] in UNDISPATCHED]
    if not waiting:
        return
    target = min(waiting, key=lambda i: (PRIORITY_RANK.get(i["priority"], 9), i["id"]))
    recs = rec.json(client, "GET", f"/api/incidents/{target['id']}/recommendations", "GET recommendations")
    ids = (recs or {}).get("suggested_resource_ids") or []
    if not ids:
        free = [r for r in rec.json(client, "GET", "/api/resources", "GET /api/resources") or []
                if r["status"] == "available"]
        ids = [rng.choice(free)["id"]] if free else []
    if ids:
        rec.call(client, "POST", f"/api/incidents/{target['id']}/dispatch", "POST dispatch",
                 json={"resource_ids": ids[:2], "approved_by": name})


def field_step(client, rec, pool: ThreadPoolExecutor, rng: random.Random) -> None:
    active = rec.json(client, "GET", "/api/assignments", "GET /api/assignments", params={"active": "true"}) or []
    for a in active:
        if rng.random() < 0.5:
            continue
        status = "cancelled" if rng.random() < 0.08 else NEXT_STEP[a["status"]]
        taps = 2 if rng.random() < 0.3 else 1  # a double tap sends the same update twice at once
        futures = [pool.submit(rec.call, client, "PATCH", f"/api/assignments/{a['id']}", "PATCH assignment",
                               json={"status": status}) for _ in range(taps)]
        for f in futures:
            f.result()


def supervisor_step(client, rec, rng: random.Random) -> None:
    incidents = _open_incidents(client, rec)
    if incidents and rng.random() < 0.3:
        inc = rng.choice(incidents)
        rec.call(client, "PATCH", f"/api/incidents/{inc['id']}", "PATCH incident",
                 json={"status": "escalated", "note": "load test"}, headers={"X-Actor": "supervisor"})
    busy = [i for i in incidents if i["status"] in ("dispatched", "on_scene")]
    if busy and rng.random() < 0.25:  # resolve while units are still out: closes them concurrently
        inc = rng.choice(busy)
        rec.call(client, "PATCH", f"/api/incidents/{inc['id']}", "PATCH incident",
                 json={"status": "resolved"}, headers={"X-Actor": "supervisor"})
    alerts = rec.json(client, "GET", "/api/alerts", "GET /api/alerts", params={"acknowledged": "false"}) or []
    for alert in alerts[:2]:
        rec.call(client, "POST", f"/api/alerts/{alert['id']}/ack", "POST alert ack")


def citizen_burst(client, rec, pool: ThreadPoolExecutor, lat: float, lng: float, text: str, n: int) -> None:
    """n near-identical reports at once: they must end up in ONE incident."""
    bodies = [{"source": "citizen", "lat": lat + k * 0.0001, "lng": lng, "text": text} for k in range(n)]
    futures = [pool.submit(rec.call, client, "POST", "/api/reports", "POST /api/reports", json=b) for b in bodies]
    responses = [f.result() for f in futures]
    ids = {r.json()["incident"]["id"] for r in responses if r is not None and r.status_code == 201}
    if len(ids) > 1:
        with rec.lock:
            rec.violations.append(f"burst of {n} identical reports split into {len(ids)} incidents {sorted(ids)}")


# ---------------------------------------------------------------- websocket (live runs)


class WsWatcher:
    """One dashboard connection for the whole run; counts events, notes a dropped connection."""

    def __init__(self, base_url: str) -> None:
        self.url = base_url.replace("https://", "wss://").replace("http://", "ws://").rstrip("/") + "/ws"
        self.events: Counter = Counter()
        self.error: str | None = None
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, name="ws-watcher", daemon=True)

    def start(self) -> None:
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        self._thread.join(5)

    def _run(self) -> None:
        try:
            from websockets.sync.client import connect
        except ImportError:
            self.error = "websockets not installed"
            return
        try:
            with connect(self.url, open_timeout=10) as ws:
                while not self._stop.is_set():
                    with contextlib.suppress(TimeoutError):
                        self.events[json.loads(ws.recv(timeout=0.5))["event"]] += 1
        except Exception as e:
            self.error = f"{type(e).__name__}: {e}"


# ---------------------------------------------------------------- invariants


def check_invariants(client: httpx.Client, rec: Recorder) -> list[str]:
    """Read the whole state back through the API and return every broken rule."""
    problems: list[str] = []
    get = lambda url, **p: rec.json(client, "GET", url, "GET (final check)", params=p) or []  # noqa: E731
    incidents = {i["id"]: i for i in get("/api/incidents", status=ALL_STATUSES)}
    resources = {r["id"]: r for r in get("/api/resources")}
    assignments = get("/api/assignments")
    reports = get("/api/reports", limit=1000)
    alerts = get("/api/alerts")

    active_by_unit: dict[int, list[dict]] = defaultdict(list)
    active_by_incident: dict[int, list[dict]] = defaultdict(list)
    for a in assignments:
        if a["status"] in ACTIVE:
            active_by_unit[a["resource_id"]].append(a)
            active_by_incident[a["incident_id"]].append(a)

    for rid, r in resources.items():
        mine = active_by_unit.get(rid, [])
        if len(mine) > 1:
            problems.append(f"{r['callsign']} has {len(mine)} active assignments (double dispatch)")
        if r["status"] in ("assigned", "en_route", "on_scene") and len(mine) != 1:
            problems.append(f"{r['callsign']} is {r['status']} with {len(mine)} active assignments (leaked unit)")
        if r["status"] == "available" and mine:
            problems.append(f"{r['callsign']} is available but still has an active assignment")
        if len(mine) == 1 and r.get("current_incident_id") != mine[0]["incident_id"]:
            problems.append(f"{r['callsign']} current_incident_id={r.get('current_incident_id')} "
                            f"but is assigned to incident {mine[0]['incident_id']}")

    for iid, inc in incidents.items():
        n_active = len(active_by_incident.get(iid, []))
        if inc["status"] in ("dispatched", "on_scene") and n_active == 0:
            problems.append(f"{inc['code']} is {inc['status']} with no active units")
        if inc["status"] == "resolved" and n_active:
            problems.append(f"{inc['code']} is resolved but has {n_active} active units")
        if inc["status"] == "resolved" and not inc.get("resolved_at"):
            problems.append(f"{inc['code']} is resolved without resolved_at")
        if inc["status"] != "resolved" and inc.get("resolved_at"):
            problems.append(f"{inc['code']} is {inc['status']} but has resolved_at set")

    per_incident = Counter(r["incident_id"] for r in reports)
    for rid in {r["incident_id"] for r in reports} - incidents.keys():
        problems.append(f"reports point at missing incident {rid}")
    for iid, inc in incidents.items():
        if inc["report_count"] != per_incident.get(iid, 0):
            problems.append(f"{inc['code']} report_count={inc['report_count']} but has {per_incident.get(iid, 0)}")

    once = Counter()
    for a in alerts:
        if a["incident_id"] is None:
            continue
        if a["kind"] == "critical":
            once[(a["incident_id"], "critical")] += 1
        elif a["kind"] == "escalation" and "automatically" in a["message"]:
            once[(a["incident_id"], "auto-escalation")] += 1
        elif a["kind"] == "sla_breach" and "not dispatched for" in a["message"]:
            once[(a["incident_id"], "dispatch SLA breach")] += 1
    for (iid, kind), n in once.items():
        if n > 1:
            problems.append(f"{n} {kind} alerts for incident {iid} (should be one)")
    return problems


# ---------------------------------------------------------------- run


@dataclass
class LoadResult:
    problems: list[str]
    recorder: Recorder
    simulator: dict
    incidents: int
    ws_events: Counter | None = None
    ws_error: str | None = None
    duration_sec: float = 0.0

    @property
    def ok(self) -> bool:
        return not self.problems


def run_load(
    client: httpx.Client,
    *,
    speed: float = 2.0,
    dispatchers: int = 3,
    burst_size: int = 6,
    reset: bool = False,
    seed: int = 7,
    ws_base_url: str | None = None,
    timeout_sec: float = 600.0,
    settle_sec: float = 2.0,
    poll_sec: float = 0.4,
) -> LoadResult:
    rec = Recorder()
    rng = random.Random(seed)
    if reset:
        resp = rec.call(client, "POST", "/api/simulator/reset", "POST reset", headers={"X-Actor": "load-test"})
        if resp is None or resp.status_code != 200:
            raise RuntimeError(f"reset failed: {None if resp is None else resp.status_code}")

    ws = WsWatcher(ws_base_url) if ws_base_url else None
    if ws:
        ws.start()
        time.sleep(0.5)

    started = time.monotonic()
    start = rec.call(client, "POST", "/api/simulator/start", "POST simulator start",
                     json={"scenario": "ahmedabad_flood", "speed": speed})
    if start is None or start.status_code != 200:
        raise RuntimeError(f"simulator start failed: {None if start is None else start.text}")
    total = start.json()["events_total"]

    stop = threading.Event()
    pool = ThreadPoolExecutor(max_workers=16, thread_name_prefix="load")
    actors = [threading.Thread(target=_loop, name=f"dispatcher-{k}", daemon=True,
                               args=(stop, rec, f"dispatcher-{k}", poll_sec,
                                     lambda k=k: dispatcher_step(client, rec, f"load-dispatcher-{k}",
                                                                 random.Random(seed + k))))
              for k in range(dispatchers)]
    actors.append(threading.Thread(target=_loop, name="field", daemon=True, args=(
        stop, rec, "field", poll_sec, lambda: field_step(client, rec, pool, random.Random(rng.random())))))
    actors.append(threading.Thread(target=_loop, name="supervisor", daemon=True, args=(
        stop, rec, "supervisor", poll_sec * 3, lambda: supervisor_step(client, rec, random.Random(rng.random())))))
    for t in actors:
        t.start()

    status: dict = {}
    try:
        bursts = list(BURST_SPOTS)
        next_burst = time.monotonic() + 1.0
        while time.monotonic() - started < timeout_sec:
            if bursts and time.monotonic() >= next_burst:
                citizen_burst(client, rec, pool, *bursts.pop(0), n=burst_size)
                next_burst = time.monotonic() + 3.0
            status = rec.json(client, "GET", "/api/simulator/status", "GET simulator status") or status
            if status and not status.get("running") and not bursts:
                break
            time.sleep(poll_sec)
    finally:
        stop.set()
        for t in actors:
            t.join(30)
        pool.shutdown(wait=True)
    time.sleep(settle_sec)  # background summaries / alert checks for the last events
    if ws:
        ws.stop()

    problems = list(rec.server_errors) + list(rec.worker_errors) + list(rec.violations)
    if status.get("running") or status.get("events_sent") != total:
        problems.append(f"simulator did not finish: {status}")
    problems += check_invariants(client, rec)
    report_times = rec.latency.get("POST /api/reports", [])
    if _p(report_times, 95) > REPORT_P95_BUDGET_SEC:
        problems.append(f"POST /api/reports p95 {_p(report_times, 95):.2f}s > {REPORT_P95_BUDGET_SEC}s")
    if ws and ws.error:
        problems.append(f"websocket: {ws.error}")
    incidents = len(rec.json(client, "GET", "/api/incidents", "GET (final check)",
                             params={"status": ALL_STATUSES}) or [])
    return LoadResult(problems=problems, recorder=rec, simulator=status, incidents=incidents,
                      ws_events=ws.events if ws else None, ws_error=ws.error if ws else None,
                      duration_sec=time.monotonic() - started)


def print_report(result: LoadResult) -> None:
    rec = result.recorder
    print(f"\nRun: {result.duration_sec:.1f}s  simulator={result.simulator}  incidents={result.incidents}")
    print(f"{'endpoint':<26}{'calls':>7}{'p50 ms':>9}{'p95 ms':>9}  status codes")
    for label in sorted(rec.codes):
        times = rec.latency.get(label, [])
        codes = " ".join(f"{c}x{n}" for c, n in sorted(rec.codes[label].items(), key=str))
        print(f"{label:<26}{sum(rec.codes[label].values()):>7}{_p(times, 50) * 1000:>9.0f}"
              f"{_p(times, 95) * 1000:>9.0f}  {codes}")
    if result.ws_events is not None:
        suffix = f"  error: {result.ws_error}" if result.ws_error else ""
        print(f"websocket events: {dict(result.ws_events)}{suffix}")
    if result.problems:
        print(f"\nFAILED - {len(result.problems)} problem(s):")
        for p in result.problems:
            print(f"  - {p}")
    else:
        print("\nOK - no server errors, all invariants hold")
    if rec.latency:
        allt = [t for ts in rec.latency.values() for t in ts]
        print(f"({len(allt)} requests, median {statistics.median(allt) * 1000:.0f} ms)")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    # 127.0.0.1, not localhost: on Windows "localhost" tries IPv6 first and adds ~0.2-2 s per connection.
    ap.add_argument("--base-url", default="http://127.0.0.1:8000")
    ap.add_argument("--speed", type=float, default=2.0, help="scenario speed (demo runs at 1-2x)")
    ap.add_argument("--dispatchers", type=int, default=3)
    ap.add_argument("--burst-size", type=int, default=6)
    ap.add_argument("--reset", action="store_true", help="wipe + reseed the target database first")
    ap.add_argument("--no-ws", action="store_true", help="skip the WebSocket watcher")
    args = ap.parse_args(argv)
    with httpx.Client(base_url=args.base_url, timeout=30) as client:
        result = run_load(client, speed=args.speed, dispatchers=args.dispatchers, burst_size=args.burst_size,
                          reset=args.reset, ws_base_url=None if args.no_ws else args.base_url)
    print_report(result)
    return 0 if result.ok else 1


if __name__ == "__main__":
    sys.exit(main())
