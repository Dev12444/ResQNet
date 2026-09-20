"use client";

/**
 * Connection and data-provenance indicators.
 *
 * The rule these enforce: never show stale information as if it were live.
 * When the feed drops we keep the last known data on screen — an operator
 * needs *something* — but we say plainly that it may be stale, and we say when
 * it was last confirmed.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ConnectionStatus, DataMode } from "@/types";
import { DATA_MODE_META, STALE_AFTER_SEC } from "@/lib/constants";
import { labels } from "@/lib/i18n";
import { ping, USE_MOCK } from "@/lib/api";
import { useLang } from "./LangProvider";

/** Poll interval for the reachability probe. */
const PROBE_MS = 20000;

export interface ConnectionState {
  status: ConnectionStatus;
  lastSynced: Date | null;
  /** Force an immediate probe — call after a manual refresh. */
  recheck: () => void;
}

export function useConnectionStatus(): ConnectionState {
  const [status, setStatus] = useState<ConnectionStatus>("live");
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const failures = useRef(0);

  const probe = useCallback(async () => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      failures.current += 1;
      setStatus("offline");
      return;
    }
    const ok = await ping();
    if (ok) {
      failures.current = 0;
      setStatus("live");
      setLastSynced(new Date());
    } else {
      failures.current += 1;
      // One miss is a blip; two in a row means the feed is genuinely down.
      setStatus(failures.current >= 2 ? "offline" : "reconnecting");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Deferred rather than called inline: the first probe must not set state
    // synchronously during the effect body.
    const run = () => {
      if (!cancelled) void probe();
    };
    const first = setTimeout(run, 0);
    const timer = setInterval(run, PROBE_MS);
    const onOffline = () => setStatus("offline");
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

  return { status, lastSynced, recheck: () => void probe() };
}

const CONNECTION_META: Record<ConnectionStatus, { label: string; color: string }> = {
  live: { label: "LIVE", color: "var(--ok)" },
  reconnecting: { label: "RECONNECTING", color: "var(--medium)" },
  offline: { label: "OFFLINE — DATA MAY BE STALE", color: "var(--critical)" },
};

export function ConnectionIndicator({
  state,
  className = "",
}: {
  state: ConnectionState;
  className?: string;
}) {
  const meta = CONNECTION_META[state.status];
  return (
    <div
      className={`flex items-center gap-2 text-xs ${className}`}
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden
        className={`inline-block size-2 shrink-0 rounded-full ${
          state.status === "offline" ? "pulse-critical" : ""
        }`}
        style={{ background: meta.color }}
      />
      <span className="font-semibold uppercase tracking-wide" style={{ color: meta.color }}>
        {meta.label}
      </span>
      {USE_MOCK && (
        <span
          className="font-semibold uppercase tracking-wide"
          style={{ color: "var(--simulated)" }}
        >
          · SIMULATED DATA
        </span>
      )}
      <span className="mono text-[var(--muted)]">
        Last synced: {state.lastSynced ? clockTime(state.lastSynced) : "—"}
      </span>
    </div>
  );
}

/** `HH:MM:SS`, the format the shell advertises. */
export function clockTime(d: Date): string {
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

/**
 * LIVE / CACHED / STALE / SIMULATED, for a single panel's data.
 *
 * Reads the language itself rather than taking it as a prop: this badge sits
 * in eleven different pages, most of which had no language in scope, and
 * threading one through each of them is how it stayed English for so long.
 */
export function DataModeBadge({ mode, note }: { mode: DataMode; note?: string | null }) {
  const { lang } = useLang();
  const meta = DATA_MODE_META[mode];
  const label = labels(lang).dataMode[mode];
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
      style={{ background: `${meta.color}1a`, color: meta.color, border: `1px solid ${meta.color}55` }}
      title={note ?? undefined}
    >
      {label}
    </span>
  );
}

/**
 * Human-readable freshness. Deliberately blunt past the stale threshold: an
 * operator reading "LOCATION STALE" will not mistake it for a live position.
 */
export function FreshnessLabel({
  ageSec,
  staleLabel = "LOCATION STALE",
  offline = false,
}: {
  ageSec: number;
  staleLabel?: string;
  offline?: boolean;
}) {
  if (offline) {
    return (
      <span className="mono text-xs font-semibold" style={{ color: "var(--faint)" }}>
        OFFLINE
      </span>
    );
  }
  if (ageSec > STALE_AFTER_SEC) {
    return (
      <span className="mono text-xs font-semibold" style={{ color: "var(--high)" }}>
        {staleLabel} · {formatAge(ageSec)}
      </span>
    );
  }
  return (
    <span className="mono text-xs text-[var(--muted)]">Updated {formatAge(ageSec)} ago</span>
  );
}

/**
 * A client-side clock for freshness maths.
 *
 * Reading `Date.now()` during render is impure and would also differ between
 * the server and client render. This sets it after mount and ticks it, so
 * every "x min ago" on a page advances together and hydration stays stable.
 */
export function useNow(intervalMs = 30000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [intervalMs]);
  return now;
}

export function formatAge(sec: number): string {
  if (sec < 60) return `${sec} sec`;
  if (sec < 3600) return `${Math.floor(sec / 60)} min`;
  const h = Math.floor(sec / 3600);
  return `${h} hr`;
}
