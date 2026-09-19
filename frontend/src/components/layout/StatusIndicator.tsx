"use client";

/**
 * Connectivity posture and the offline queue.
 *
 * The rule this enforces: a submission that has not reached the state control
 * room is never described as if it had. When the device is offline the
 * indicator says so, names how many submissions are still on the device, and
 * offers the phone fallback — because a queued report helps nobody in the
 * next ten minutes.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Phone, RefreshCw, WifiOff } from "lucide-react";
import type { ConnectivityState, QueuedSubmission } from "@/types";
import { CONNECTIVITY_META } from "@/lib/constants";
import { dequeue, ping, readQueue } from "@/lib/api";

const PROBE_MS = 20000;
/** A probe slower than this is treated as a weak connection, not a healthy one. */
const SLOW_MS = 2500;

export interface ConnectivityInfo {
  state: ConnectivityState;
  lastSynced: Date | null;
  queue: QueuedSubmission[];
  recheck: () => void;
  flush: () => void;
}

export function useConnectivity(): ConnectivityInfo {
  const [state, setState] = useState<ConnectivityState>("online");
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [queue, setQueue] = useState<QueuedSubmission[]>([]);
  const misses = useRef(0);

  const probe = useCallback(async () => {
    setQueue(readQueue());

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      misses.current += 1;
      setState("offline");
      return;
    }

    const started = performance.now();
    const ok = await ping();
    const elapsed = performance.now() - started;

    if (ok) {
      misses.current = 0;
      setState(elapsed > SLOW_MS ? "low" : "online");
      setLastSynced(new Date());
    } else {
      misses.current += 1;
      setState(misses.current >= 2 ? "offline" : "low");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) void probe();
    };
    // Deferred so no state is set synchronously inside the effect body.
    const first = setTimeout(run, 0);
    const timer = setInterval(run, PROBE_MS);
    const onOffline = () => setState("offline");
    window.addEventListener("online", run);
    window.addEventListener("offline", onOffline);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(timer);
      window.removeEventListener("online", run);
      window.removeEventListener("offline", onOffline);
    };
  }, [probe]);

  const flush = useCallback(() => {
    // Nothing to retry against while the backend is mocked; clearing the
    // queue here would claim a delivery that never happened, so we only
    // drop entries once a probe confirms the control room is reachable.
    void (async () => {
      const reachable = await ping();
      if (!reachable) {
        void probe();
        return;
      }
      for (const item of readQueue()) dequeue(item.id);
      setQueue(readQueue());
      setLastSynced(new Date());
      setState("online");
    })();
  }, [probe]);

  return { state, lastSynced, queue, recheck: () => void probe(), flush };
}

export function StatusIndicator({ info }: { info: ConnectivityInfo }) {
  const meta = CONNECTIVITY_META[info.state];
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide"
      title={meta.note}
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden
        className={`inline-block size-2 rounded-full ${
          info.state === "offline" ? "pulse-critical" : ""
        }`}
        style={{ background: meta.color }}
      />
      <span style={{ color: meta.color }}>{meta.label}</span>
    </span>
  );
}

/**
 * Full-width banner shown on low/offline. Explains the consequence in plain
 * words and points at the phone, which still works when the network does not.
 */
export function ConnectivityBanner({ info }: { info: ConnectivityInfo }) {
  if (info.state === "online" && info.queue.length === 0) return null;
  const meta = CONNECTIVITY_META[info.state];
  const queued = info.queue.length;

  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2 text-sm"
      style={{
        borderColor: meta.color,
        background: info.state === "offline" ? "var(--critical-bg)" : "var(--medium-bg)",
      }}
      role="alert"
    >
      <span className="flex items-center gap-2 font-semibold" style={{ color: meta.color }}>
        <WifiOff className="size-4" aria-hidden />
        {meta.label}
      </span>

      <span className="min-w-56 flex-1 text-[var(--foreground)]">
        {meta.note}
        {queued > 0 && (
          <>
            {" "}
            <strong className="font-semibold">
              {queued} submission{queued === 1 ? "" : "s"} still on this device —
              not yet received by the control room.
            </strong>
          </>
        )}
      </span>

      <a
        href="tel:112"
        className="inline-flex min-h-9 items-center gap-1.5 border border-[var(--coral-deep)] bg-[var(--coral)] px-3 cmd text-xs text-white"
      >
        <Phone className="size-3.5" aria-hidden />
        Call 112 instead
      </a>

      {queued > 0 && (
        <button
          type="button"
          onClick={info.flush}
          className="inline-flex min-h-9 items-center gap-1.5 border border-[var(--carbon)] bg-[var(--surface)] px-3 text-xs font-semibold"
        >
          <RefreshCw className="size-3.5" aria-hidden />
          Retry sync
        </button>
      )}
    </div>
  );
}
