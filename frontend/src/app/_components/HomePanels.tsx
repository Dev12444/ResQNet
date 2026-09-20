"use client";

/**
 * The panels that sit around the command map.
 *
 * All of them are ordinary portal cards: white, 1px border, 6px radius, a
 * tinted head with a compact uppercase title. They read from the shared
 * mock/API layer, so the figures here always agree with the map and with the
 * dedicated pages.
 */

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import {
  Activity,
  Building2,
  ChevronRight,
  CircleHelp,
  Clock,
  CloudRain,
  Construction,
  Droplets,
  Flame,
  HeartPulse,
  House,
  Package,
  Radio,
  Search,
  ShieldCheck,
  Tornado,
  TrendingUp,
  Truck,
  TriangleAlert,
  UserSearch,
  Utensils,
  Waves,
} from "lucide-react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  DataMode,
  DisasterType,
  DispatchLogEntry,
  ForecastDay,
  LogKind,
  Lang,
  ResQPulse,
  Shelter,
  WeatherAlert,
} from "@/types";
import {
  DISASTER_META,
  riskLabel,
  PLATFORM_STRINGS,
  RISK_META,
  SHELTER_STATUS_META,
} from "@/lib/constants";
import { axisProps, gridProps, tooltipProps } from "@/components/charts/chartTheme";
import { DataModeBadge } from "@/components/layout/ConnectionBar";

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

export function SearchBar({
  lang,
  value,
  onChange,
}: {
  lang: Lang;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="relative block min-w-0 flex-1">
      <span className="sr-only">{PLATFORM_STRINGS[lang].searchPlaceholder}</span>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={PLATFORM_STRINGS[lang].searchPlaceholder}
        className="h-10 w-full rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface-2)] pl-9 pr-3 text-[13px] placeholder:text-[var(--faint)] focus:bg-white"
      />
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Live alerts                                                         */
/* ------------------------------------------------------------------ */

/**
 * The hazard glyph for a disaster class.
 *
 * `DISASTER_META` names the icon rather than importing it, so that the
 * constants file stays free of React. This is the one place that name is
 * resolved back to a component.
 */
const DISASTER_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  Tornado,
  Waves,
  Flame,
  Activity,
  HeartPulse,
  Construction,
  Building2,
  UserSearch,
  CloudRain,
  CircleHelp,
};

function DisasterGlyph({ disaster }: { disaster: DisasterType }) {
  const Icon = DISASTER_ICONS[DISASTER_META[disaster].icon] ?? CircleHelp;
  return <Icon className="size-[17px]" />;
}

export function LiveAlerts({ alerts, lang }: { alerts: WeatherAlert[]; lang: Lang }) {
  const t = PLATFORM_STRINGS[lang];
  return (
    <section className="panel flex min-h-0 flex-col">
      <PanelHeader
        title={t.liveAlerts}
        href="/weather"
        viewAll={t.viewAll}
        accent="var(--crimson)"
        live
        meta={`${alerts.length} active`}
      />
      {alerts.length === 0 ? (
        <p className="px-3 py-5 text-center text-[12px] text-[var(--muted)]">
          No active alerts.
        </p>
      ) : (
        <ul className="thin-scroll max-h-[288px] flex-1 divide-y divide-[var(--hairline)] overflow-y-auto">
          {alerts.slice(0, 5).map((a) => {
            const meta = DISASTER_META[a.disaster];
            const risk = RISK_META[a.severity];
            return (
              <li key={a.id} className="flex items-start gap-2.5 px-2.5 py-2">
                <span
                  aria-hidden
                  className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-white shadow-[0_1px_3px_rgba(38,50,56,.3)]"
                  /* A filled badge carrying the hazard's own glyph. A tinted
                     ring around a dot was too quiet to scan down a rail at
                     arm's length, which is how this panel is actually read. */
                  style={{ background: meta.color }}
                >
                  <DisasterGlyph disaster={a.disaster} />
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-[12.5px] font-bold leading-tight"
                    style={{ color: risk.color }}
                  >
                    {a.headline}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                    {a.district} · {riskLabel(a.severity, lang)}
                  </p>
                </div>
                <span className="telemetry shrink-0">{relativeTime(a.issuedAt)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Nearest shelters                                                    */
/* ------------------------------------------------------------------ */

export function NearestShelters({
  shelters,
  lang,
}: {
  shelters: (Shelter & { distanceKm: number })[];
  lang: Lang;
}) {
  const t = PLATFORM_STRINGS[lang];
  return (
    <section className="panel flex min-h-0 flex-col">
      <PanelHeader
        title={t.nearestShelters}
        href="/shelters"
        viewAll={t.viewAll}
        accent="var(--green)"
      />
      <ul className="thin-scroll flex-1 divide-y divide-[var(--hairline)] overflow-y-auto">
        {shelters.map((s) => {
          const meta = SHELTER_STATUS_META[s.status];
          const pct = Math.min(
            100,
            Math.round((s.occupancy / Math.max(1, s.capacity)) * 100),
          );
          return (
            <li key={s.id}>
              <Link
                href={`/shelters?focus=${s.id}` as Route}
                className="block px-2.5 py-2 no-underline hover:bg-[var(--surface-2)]"
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck
                    className="size-3.5 shrink-0 text-[var(--green)]"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold">
                    {s.name}
                  </span>
                  <span
                    className="shrink-0 rounded-[3px] px-1 py-0.5 text-[9.5px] font-bold"
                    style={{ background: `${meta.color}1f`, color: meta.color }}
                  >
                    {meta.label}
                  </span>
                </div>

                {/* Occupancy as a bar — a ratio is read faster than two numbers */}
                <div className="mt-1.5 flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-3)]"
                  >
                    <span
                      className="block h-full"
                      style={{ width: `${pct}%`, background: meta.color }}
                    />
                  </span>
                  <span className="mono shrink-0 text-[11px] font-bold">
                    {s.occupancy}/{s.capacity}
                  </span>
                </div>

                <div className="mt-1 flex items-center gap-2">
                  <span className="telemetry">{s.distanceKm.toFixed(1)} KM</span>
                  <span className="ml-auto flex gap-2 text-[9.5px] uppercase tracking-wide text-[var(--faint)]">
                    {s.amenities.food && (
                      <span className="flex items-center gap-0.5">
                        <Utensils className="size-3" aria-hidden /> Food
                      </span>
                    )}
                    {s.amenities.water && (
                      <span className="flex items-center gap-0.5">
                        <Droplets className="size-3" aria-hidden /> Water
                      </span>
                    )}
                    {s.amenities.medical && (
                      <span className="flex items-center gap-0.5">
                        <HeartPulse className="size-3" aria-hidden /> Med
                      </span>
                    )}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-[var(--hairline)] px-2.5 py-1.5 text-[10px] text-[var(--faint)]">
        Distances are straight-line from the selected district centre, not road
        distance.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* ResQ Pulse                                                          */
/* ------------------------------------------------------------------ */

/**
 * ResQ Pulse — the platform's district readout.
 *
 * Drawn as a segmented gauge rather than a coloured badge, with the level
 * printed beside it as "LEVEL n / 5": the meter is the memorable part, the
 * text is the part that survives colour-blindness, a projector or a photograph
 * of a screen. Only the topmost lit segment animates, and only at CRITICAL,
 * so motion on this component always means one thing.
 */
export function PulsePanel({ pulse, lang }: { pulse: ResQPulse[]; lang: Lang }) {
  const t = PLATFORM_STRINGS[lang];
  const [index, setIndex] = useState(0);
  const current = pulse[index];
  if (!current) return null;
  const meta = RISK_META[current.level];

  return (
    <section className="panel">
      <div className="panel-head">
        <Radio className="size-3.5 shrink-0" style={{ color: meta.color }} aria-hidden />
        <h2 className="cmd text-[12px]">{t.resqPulse}</h2>
        <span className="telemetry ml-auto">District index</span>
      </div>

      <div className="no-scrollbar flex overflow-x-auto border-b border-[var(--hairline)]">
        {pulse.map((p, i) => (
          <button
            key={p.district}
            type="button"
            onClick={() => setIndex(i)}
            aria-current={i === index}
            className={`shrink-0 border-r border-[var(--hairline)] px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
              i === index
                ? "bg-[var(--navy-800)] text-white"
                : "text-[var(--muted)] hover:bg-[var(--surface-2)]"
            }`}
          >
            {p.district}
          </button>
        ))}
      </div>

      <div className="px-2.5 py-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[15px] font-bold">{current.district}</span>
          <span className="cmd text-[12px]" style={{ color: meta.color }}>
            {riskLabel(current.level, lang)}
          </span>
        </div>

        <PulseGauge rank={meta.rank} colour={meta.color} />

        <p className="mt-2 text-[11.5px] leading-snug text-[var(--muted)]">
          {current.headline}
        </p>

        <dl className="mt-2 grid grid-cols-2 gap-x-4">
          <PulseStat label="Reports" value={current.reports} />
          <PulseStat label="Blocked roads" value={current.blockedRoads} />
          <PulseStat label="Shelters active" value={current.sheltersActive} />
          <PulseStat label="Response teams" value={current.responseTeams} />
        </dl>

        <p
          className="mt-2 rounded-[4px] border-l-[3px] bg-[var(--surface-2)] px-2 py-1.5"
          style={{ borderLeftColor: meta.color }}
        >
          <span className="eyebrow block text-[var(--muted)]">Priority area</span>
          <span className="mt-0.5 block text-[12px] font-bold">
            {current.priorityArea}
          </span>
        </p>
      </div>
    </section>
  );
}

const PULSE_SEGMENTS = 22;

function PulseGauge({ rank, colour }: { rank: number; colour: string }) {
  // RISK_META ranks run 0 (normal) to 4 (critical). NORMAL still lights part of
  // the meter, so an unlit gauge always means "no reading", never "calm".
  const lit = Math.round(((rank + 1) / 5) * PULSE_SEGMENTS);
  return (
    <div className="mt-1.5">
      <div
        className="flex items-end gap-[2px]"
        role="meter"
        aria-valuenow={rank + 1}
        aria-valuemin={1}
        aria-valuemax={5}
        aria-label={`ResQ Pulse level ${rank + 1} of 5`}
      >
        {Array.from({ length: PULSE_SEGMENTS }, (_, i) => {
          const on = i < lit;
          return (
            <span
              key={i}
              aria-hidden
              className={`flex-1 rounded-[1px] ${
                on && rank === 4 && i === lit - 1 ? "pulse-critical" : ""
              }`}
              style={{
                height: 6 + (i / PULSE_SEGMENTS) * 10,
                background: on ? colour : "var(--surface-3)",
              }}
            />
          );
        })}
      </div>
      <p className="telemetry mt-1">Level {rank + 1} / 5 · composite posture</p>
    </div>
  );
}

function PulseStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-dashed border-[var(--border)] py-1">
      <dt className="text-[11px] text-[var(--muted)]">{label}</dt>
      <dd className="mono text-[14px] font-bold">{String(value).padStart(2, "0")}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dispatch log                                                        */
/* ------------------------------------------------------------------ */

/**
 * The stamp a geo-portal puts at the right of every panel head: how old the
 * thing you are reading is.
 *
 * Mount-gated. The server has no business guessing the operator's wall clock,
 * and emitting one during SSR guarantees a hydration mismatch a second later.
 *
 * `demo` puts the amber tag in front of the time. A timestamp on fixture data
 * without that tag would be the most quietly dishonest thing on the screen —
 * it looks exactly like a freshness guarantee.
 */
function PanelStamp({ demo = false }: { demo?: boolean }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const first = setTimeout(() => setNow(new Date()), 0);
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  return (
    <span className="ml-auto flex shrink-0 items-center gap-1.5">
      {demo && (
        <span
          className="rounded-[3px] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
          style={{ background: "var(--medium-bg)", color: "var(--amber-600)" }}
        >
          Demo data
        </span>
      )}
      <Clock className="hidden size-3 shrink-0 text-[var(--faint)] sm:block" aria-hidden />
      <span className="mono hidden whitespace-nowrap text-[10px] text-[var(--muted)] sm:inline">
        {now
          ? `${now.toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
            })}, ${now.toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })}`
          : "\u2014"}
      </span>
    </span>
  );
}

/**
 * What each class of log event looks like.
 *
 * The glyph carries the kind of event; the badge colour carries its severity,
 * falling back to the kind's own colour for routine traffic. Two channels, so
 * neither one has to do all the work.
 */
const LOG_KIND_META: Record<
  LogKind,
  { Icon: ComponentType<{ className?: string }>; color: string; label: string }
> = {
  incident: { Icon: TriangleAlert, color: "var(--crimson)", label: "Incident" },
  unit: { Icon: Truck, color: "var(--navy-600)", label: "Unit" },
  shelter: { Icon: House, color: "var(--green)", label: "Shelter" },
  verification: { Icon: ShieldCheck, color: "var(--blue)", label: "Verification" },
  weather: { Icon: CloudRain, color: "var(--amber)", label: "Weather" },
  resource: { Icon: Package, color: "var(--teal)", label: "Resource" },
};

export function DispatchLogPanel({
  entries,
  lang,
  compact = false,
  mode,
  note,
}: {
  entries: DispatchLogEntry[];
  lang: Lang;
  compact?: boolean;
  /**
   * Where these lines came from. There is no `/api/logs` in the contract, so
   * in practice this is always the fixture set — and a dispatch log is read
   * as a record of things that happened. It says which it is.
   */
  mode?: DataMode;
  note?: string | null;
}) {
  const t = PLATFORM_STRINGS[lang];
  const [filter, setFilter] = useState("");

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = q
      ? entries.filter((e) =>
          `${e.message} ${e.district ?? ""} ${e.unit ?? ""} ${e.kind} ${e.severity}`
            .toLowerCase()
            .includes(q),
        )
      : entries;
    return compact ? list.slice(0, 12) : list;
  }, [entries, filter, compact]);

  return (
    <section className="panel flex min-h-0 flex-col">
      <div className="panel-head">
        <Radio className="size-3.5 shrink-0 text-[var(--navy-600)]" aria-hidden />
        <h2 className="cmd min-w-0 text-[12px] sm:shrink-0 sm:whitespace-nowrap">{t.dispatchLogs}</h2>
        {mode && <DataModeBadge mode={mode} note={note} />}
        <PanelStamp />
      </div>

      {!compact && (
        <div className="border-b border-[var(--hairline)] px-2.5 py-2">
          <label className="block">
            <span className="sr-only">
              Filter log by incident, district, unit or severity
            </span>
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by incident, district, unit or severity..."
              className="h-8 w-full rounded-[4px] border border-[var(--border-strong)] bg-white px-2 text-[12px]"
            />
          </label>
        </div>
      )}

      <ol className="thin-scroll m-0 max-h-[236px] min-h-[160px] flex-1 list-none overflow-y-auto p-0">
        {shown.length === 0 && (
          <li className="px-2.5 py-4 text-center text-[11.5px] text-[var(--muted)]">
            No log entries match that filter.
          </li>
        )}
        {shown.map((e, i) => (
          <li
            key={e.id}
            className={`flex items-start gap-2 border-b border-[var(--hairline)] px-2.5 py-[5px] last:border-b-0 ${
              i === 0 ? "incoming" : ""
            }`}
          >
            <LogBadge kind={e.kind} severity={e.severity} />
            <span className="min-w-0 flex-1 text-[11.5px] leading-snug">
              {e.unit && (
                <span className="mono mr-1 font-bold text-[var(--navy-700)]">
                  {e.unit}
                </span>
              )}
              {e.message}
            </span>
            <span className="mono shrink-0 pt-px text-[10px] text-[var(--faint)]">
              {new Date(e.at).toTimeString().slice(0, 5)}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Filled circular badge for one log row: glyph = kind, colour = severity. */
function LogBadge({
  kind,
  severity,
}: {
  kind: LogKind;
  severity: DispatchLogEntry["severity"];
}) {
  const meta = LOG_KIND_META[kind] ?? LOG_KIND_META.incident;
  const colour =
    severity === "critical"
      ? "var(--crimson)"
      : severity === "warning"
        ? "var(--amber)"
        : meta.color;
  return (
    <span
      className="mt-px flex size-[22px] shrink-0 items-center justify-center rounded-full text-white"
      style={{ background: colour }}
      title={`${meta.label} \u00b7 ${severity}`}
    >
      <meta.Icon className="size-[13px]" />
      <span className="sr-only">
        {meta.label}, {severity}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Radar & forecast                                                    */
/* ------------------------------------------------------------------ */

export function RadarForecast({
  forecast,
  lang,
}: {
  forecast: ForecastDay[];
  lang: Lang;
}) {
  const t = PLATFORM_STRINGS[lang];
  const legend: { label: string; color: string; Icon: ComponentType<{ className?: string }> }[] = [
    { label: "Cyclone", color: "var(--crimson)", Icon: Tornado },
    { label: "Flood", color: "var(--blue)", Icon: Waves },
    { label: "Fire", color: "var(--high)", Icon: Flame },
    { label: "Heavy rain", color: "var(--navy-600)", Icon: CloudRain },
    { label: "Thunderstorm", color: "var(--amber)", Icon: Activity },
  ];

  return (
    <section className="panel flex min-h-0 flex-col">
      <div className="panel-head">
        <CloudRain className="size-3.5 shrink-0 text-[var(--blue)]" aria-hidden />
        <h2 className="cmd min-w-0 text-[12px] sm:shrink-0 sm:whitespace-nowrap">{t.radarForecast}</h2>
        <PanelStamp demo />
      </div>

      <div className="grid flex-1 grid-cols-[minmax(0,1fr)_104px] gap-2 p-2">
        <RadarSweep />
        <ul className="flex flex-col justify-center gap-1.5">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-1.5 text-[11px]">
              <span
                aria-hidden
                className="flex size-[18px] shrink-0 items-center justify-center rounded-full text-white"
                style={{ background: l.color }}
              >
                <l.Icon className="size-[11px]" />
              </span>
              <span className="truncate">{l.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="border-t border-[var(--hairline)] px-2.5 py-1.5 text-[10px] leading-snug text-[var(--faint)]">
        Source: IMD, NDMA — no live meteorological feed is connected. Figures
        shown are demo values. Forecast peak {Math.max(...forecast.map((f) => f.rainfallMm), 0)} mm.
      </p>
    </section>
  );
}

/**
 * Cyclone schematic with a sweep and a projected track.
 *
 * Explicitly a schematic and labelled as such on its face. The sweep is the
 * one piece of atmosphere in the interface and it earns its place by making
 * "this surface is updating" legible at a glance — but the caption stops
 * anyone reading the shapes underneath as observation data.
 */
function RadarSweep() {
  return (
    <div className="relative overflow-hidden rounded-[4px] border border-[var(--border)] bg-[#0b1f38]">
      <svg
        viewBox="0 0 200 130"
        className="h-[132px] w-full"
        role="img"
        aria-label="Schematic of the cyclone system over the Arabian Sea with its projected track towards the Kutch coast"
      >
        <defs>
          <radialGradient id="resq-eye" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#ffd9a0" />
            <stop offset="35%" stopColor="#d2601c" />
            <stop offset="70%" stopColor="#1565c0" />
            <stop offset="100%" stopColor="#0b1f38" />
          </radialGradient>
          <linearGradient id="resq-sweep" x1="50%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#4a9de8" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#4a9de8" stopOpacity="0" />
          </linearGradient>
          {/* Keeps the precipitation inside the radar's range ring rather than
              letting the bands run off the edge of the panel. */}
          <clipPath id="resq-radar-clip">
            <circle cx="70" cy="64" r="46" />
          </clipPath>
        </defs>

        <rect width="200" height="130" fill="#0b1f38" />

        {[46, 35, 24, 14].map((r, i) => (
          <circle
            key={r}
            cx="70"
            cy="64"
            r={r}
            fill="none"
            stroke="#2a63a8"
            strokeOpacity={0.25 + i * 0.1}
            strokeWidth="1"
          />
        ))}
        <line x1="24" y1="64" x2="116" y2="64" stroke="#2a63a8" strokeOpacity="0.22" />
        <line x1="70" y1="18" x2="70" y2="110" stroke="#2a63a8" strokeOpacity="0.22" />

        {/*
         * Precipitation field, drawn as spiral bands on the reflectivity ramp
         * every Indian television bulletin uses: green for light returns,
         * amber for moderate, orange for intense, red at the core. Three
         * stroke widths on the same two spiral arms, widest and coolest
         * underneath, so the bands nest the way real returns do.
         */}
        <g fill="none" strokeLinecap="round" clipPath="url(#resq-radar-clip)">
          <g stroke="#15803d" strokeWidth="19" opacity="0.5">
            <path d="M70 64 C 56 40, 28 46, 24 72" />
            <path d="M70 64 C 84 88, 112 82, 116 56" />
          </g>
          <g stroke="#2f9e4f" strokeWidth="13" opacity="0.62">
            <path d="M70 64 C 58 44, 34 49, 30 70" />
            <path d="M70 64 C 82 84, 106 79, 110 58" />
          </g>
          <g stroke="#d4a017" strokeWidth="8" opacity="0.72">
            <path d="M70 64 C 60 48, 40 52, 36 68" />
            <path d="M70 64 C 80 80, 100 76, 104 60" />
          </g>
          <g stroke="#dd6b12" strokeWidth="4.5" opacity="0.8">
            <path d="M70 64 C 62 52, 46 55, 43 66" />
            <path d="M70 64 C 78 76, 94 73, 97 62" />
          </g>
        </g>

        <g style={{ transformOrigin: "70px 64px" }} className="sweep">
          <path d="M70 64 L116 64 A46 46 0 0 0 102 31 Z" fill="url(#resq-sweep)" />
        </g>

        {/* The core and the eye */}
        <circle cx="70" cy="64" r="13" fill="#c3241f" opacity="0.85" />
        <circle cx="70" cy="64" r="7" fill="url(#resq-eye)" opacity="0.95" />
        <circle cx="70" cy="64" r="3" fill="#0b1f38" />
        <circle cx="70" cy="64" r="3" fill="none" stroke="#ffe3b0" strokeWidth="1.2" />

        {/* Projected track — dashed, because a forecast is not an observation */}
        <path
          d="M70 64 Q 100 57, 126 70 T 168 96"
          fill="none"
          stroke="#e8a33c"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
        <circle cx="126" cy="70" r="2.4" fill="#e8a33c" />
        <circle cx="168" cy="96" r="2.4" fill="#e8a33c" />
        <text x="128" y="64" fill="#e8a33c" fontSize="7" fontWeight="600">+12H</text>
        <text x="150" y="112" fill="#e8a33c" fontSize="7" fontWeight="600">+24H</text>

        <text x="6" y="14" fill="#8ba4c4" fontSize="7.5" fontWeight="600">ARABIAN SEA</text>
        <text x="146" y="124" fill="#8ba4c4" fontSize="7.5" fontWeight="600">MAINLAND</text>
        <text x="88" y="62" fill="#fff" fontSize="7.5" fontWeight="700">KUTCH</text>
      </svg>
      <p className="absolute bottom-1 right-1.5 text-[8.5px] font-semibold uppercase tracking-wide text-[#8ba4c4]">
        Schematic — not a radar composite
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Weather trend                                                       */
/* ------------------------------------------------------------------ */

/**
 * Seven-day trend for the lower-right slot.
 *
 * Two series on one axis: rainfall in millimetres and wind in km/h, which
 * share a 0–100 range closely enough to be read together. Both are named in
 * the legend beneath, because a chart whose lines are identified by colour
 * alone is unreadable to part of the audience.
 */
export function WeatherTrend({ forecast }: { forecast: ForecastDay[] }) {
  return (
    <section className="panel flex min-h-0 flex-col">
      <div className="panel-head">
        <TrendingUp className="size-3.5 shrink-0 text-[var(--navy-600)]" aria-hidden />
        <h2 className="cmd min-w-0 text-[12px] sm:shrink-0 sm:whitespace-nowrap">Weather Trend</h2>
        <PanelStamp demo />
      </div>

      <div className="flex-1 px-1.5 pb-1 pt-2">
        <ResponsiveContainer width="100%" height={148}>
          <ComposedChart
            data={forecast}
            margin={{ top: 4, right: 10, bottom: 0, left: -22 }}
          >
            <defs>
              {/*
               * A wash under each series, not a solid block. Two filled areas
               * on one axis would hide each other, so the fill fades out
               * entirely before it reaches the baseline and the line itself
               * stays the thing you read.
               */}
              <linearGradient id="resq-rain-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--blue)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--blue)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="resq-wind-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--crimson)" stopOpacity={0.24} />
                <stop offset="100%" stopColor="var(--crimson)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="day" {...axisProps} />
            <YAxis {...axisProps} width={34} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} />
            <Tooltip {...tooltipProps} />
            <Area
              type="monotone"
              dataKey="windKph"
              name="Wind (kph)"
              stroke="var(--crimson)"
              strokeWidth={2}
              fill="url(#resq-wind-fill)"
              dot={{ r: 2.5, strokeWidth: 0, fill: "var(--crimson)" }}
              activeDot={{ r: 4 }}
            />
            <Area
              type="monotone"
              dataKey="rainfallMm"
              name="Rainfall (mm)"
              stroke="var(--blue)"
              strokeWidth={2}
              fill="url(#resq-rain-fill)"
              dot={{ r: 2.5, strokeWidth: 0, fill: "var(--blue)" }}
              activeDot={{ r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="flex items-center gap-3 border-t border-[var(--hairline)] px-2.5 py-1.5 text-[10.5px] text-[var(--muted)]">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-3.5" style={{ background: "var(--blue)" }} />
          Rainfall mm
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-3.5" style={{ background: "var(--crimson)" }} />
          Wind kph
        </span>
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

function PanelHeader({
  title,
  href,
  viewAll,
  accent,
  meta,
  live = false,
}: {
  title: string;
  href: string;
  viewAll: string;
  accent: string;
  /** Small right-aligned context string, e.g. a count. */
  meta?: string;
  /** Shows the live lamp — only where the panel's source genuinely moves. */
  live?: boolean;
}) {
  return (
    <div className="panel-head">
      <span
        aria-hidden
        className="h-3 w-[3px] shrink-0 rounded-full"
        style={{ background: accent }}
      />
      <h2 className="cmd shrink-0 text-[12px]">{title}</h2>
      {live && (
        <span
          aria-hidden
          className="live-dot size-1.5 shrink-0 rounded-full"
          style={{ background: accent }}
        />
      )}
      {meta && <span className="telemetry truncate">{meta}</span>}
      <Link
        href={href as Route}
        className="ml-auto flex shrink-0 items-center gap-0.5 text-[11px] font-bold text-[var(--navy-600)] no-underline hover:underline"
      >
        {viewAll}
        <ChevronRight className="size-3" aria-hidden />
      </Link>
    </div>
  );
}

/** "2 hrs ago" / "4 min ago", computed against the pinned demo clock. */
export function relativeTime(iso: string): string {
  const diff = Math.max(0, Date.now() - Date.parse(iso));
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  return `${Math.round(hrs / 24)} d ago`;
}

export { gridProps };
