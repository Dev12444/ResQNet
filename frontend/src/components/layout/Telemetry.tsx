"use client";

/**
 * Operational telemetry — the small, constantly-true readouts that make a
 * console feel instrumented rather than illustrated.
 *
 * Everything here is real. The clock is the browser's clock rendered in IST;
 * the sync counter is the measured age of the last successful data read; the
 * grid reference is computed from actual coordinates. Nothing is a decorative
 * number, because a fake readout on an emergency platform is worse than no
 * readout at all.
 */

import { pageStrings } from "@/lib/pageStrings";
import { useLang } from "@/components/layout/LangProvider";
import { useEffect, useState } from "react";

const IST = "Asia/Kolkata";

/**
 * Live IST clock.
 *
 * Renders nothing until mounted: the server has no business guessing what
 * time the operator's machine thinks it is, and rendering a timestamp during
 * SSR guarantees a hydration mismatch one second later.
 */
export function LiveClock({ className = "" }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // Deferred so the first value is not set synchronously in the effect body.
    const start = setTimeout(() => setNow(new Date()), 0);
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearTimeout(start);
      clearInterval(id);
    };
  }, []);

  return (
    <span className={`telemetry tabular-nums ${className}`}>
      <span className="text-[var(--faint)]">{pageStrings(useLang().lang).misc.liveIst} </span>
      <span className="text-[var(--muted)]">
        {now
          ? now.toLocaleTimeString("en-GB", { timeZone: IST, hour12: false })
          : "--:--:--"}
      </span>
    </span>
  );
}

/**
 * Time since a source last answered, as a sync offset.
 *
 * `since` is the ISO timestamp of the last successful read. A null value
 * prints as no-signal rather than as zero — an unknown age must never look
 * like a fresh one.
 */
export function SyncCounter({
  since,
  className = "",
}: {
  since: string | null;
  className?: string;
}) {
  // The wall clock is held in state rather than read during render: reading
  // `Date.now()` in the render body is impure, and a counter that only updates
  // when something else happens to re-render is a lying counter.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const start = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(start);
      clearInterval(id);
    };
  }, []);

  if (!since || now === null) {
    return (
      <span className={`telemetry ${className}`}>
        <span className="text-[var(--faint)]">SYNC </span>
        <span className="text-[var(--muted)]">--:--</span>
      </span>
    );
  }

  const sec = Math.max(0, Math.floor((now - Date.parse(since)) / 1000));
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");

  return (
    <span className={`telemetry tabular-nums ${className}`}>
      <span className="text-[var(--faint)]">SYNC </span>
      <span style={{ color: sec > 300 ? "var(--amber)" : "var(--muted)" }}>
        +{mm}:{ss}
      </span>
    </span>
  );
}

/**
 * Coordinate readout in the convention operators actually speak:
 * degrees to two places with a hemisphere letter, not a signed decimal.
 */
export function Coordinates({
  lat,
  lng,
  className = "",
}: {
  lat: number;
  lng: number;
  className?: string;
}) {
  return (
    <span className={`telemetry tabular-nums ${className}`}>
      {Math.abs(lat).toFixed(2)}°{lat >= 0 ? "N" : "S"} /{" "}
      {Math.abs(lng).toFixed(2)}°{lng >= 0 ? "E" : "W"}
    </span>
  );
}

/**
 * Map grid reference — A1, B3 and so on.
 *
 * A plain lat/lng lattice over the Gujarat bounding box: columns A–F run west
 * to east, rows 1–6 run north to south. It is a spoken shorthand for a region
 * of the map, not a survey grid, and is labelled that way where it appears.
 */
export const MAP_GRID = {
  west: 68.0,
  east: 74.6,
  north: 24.8,
  south: 20.0,
  cols: 6,
  rows: 6,
} as const;

const GRID = MAP_GRID;

export function gridRef(lat: number, lng: number): string {
  const col = Math.min(
    GRID.cols - 1,
    Math.max(0, Math.floor(((lng - GRID.west) / (GRID.east - GRID.west)) * GRID.cols)),
  );
  const row = Math.min(
    GRID.rows - 1,
    Math.max(0, Math.floor(((GRID.north - lat) / (GRID.north - GRID.south)) * GRID.rows)),
  );
  return `${String.fromCharCode(65 + col)}${row + 1}`;
}

/** Small square carrying a grid reference, for map chrome and list rows. */
export function GridChip({ lat, lng }: { lat: number; lng: number }) {
  return (
    <span
      className="mono inline-flex h-[18px] min-w-[22px] items-center justify-center border px-1 text-[10px] font-semibold leading-none"
      style={{
        borderColor: "var(--border-strong)",
        color: "var(--muted)",
        background: "var(--surface-2)",
      }}
      title="Map grid reference"
    >
      {gridRef(lat, lng)}
    </span>
  );
}

/**
 * Network state lamp. The dot animates only while genuinely live, so motion
 * on this element always means "data is moving".
 */
export function NetworkLamp({
  online,
  label,
  tone = "light",
}: {
  online: boolean;
  label: string;
  tone?: "light" | "dark";
}) {
  const colour = online ? "var(--jade)" : "var(--coral)";
  return (
    <span className="flex items-center gap-1.5">
      <span
        aria-hidden
        className={`size-1.5 rounded-full ${online ? "live-dot" : "pulse-critical"}`}
        style={{ background: colour, color: colour }}
      />
      <span
        className="eyebrow"
        style={{ color: tone === "dark" ? "var(--rail-muted)" : "var(--muted)" }}
      >
        {label}
      </span>
    </span>
  );
}
