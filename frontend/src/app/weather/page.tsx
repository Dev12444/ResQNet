"use client";

/**
 * `/weather` — alerts, radar schematic and forecast.
 *
 * No meteorological feed is connected. Everything on this page is labelled
 * DEMO DATA with its source and issue time, because a weather page that looks
 * authoritative while showing invented numbers is worse than no page at all.
 *
 * Owner: FE2.
 */

import { PLATFORM_STRINGS } from "@/lib/constants";
import { pageStrings } from "@/lib/pageStrings";
import { useLang } from "@/components/layout/LangProvider";
import { useCallback, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RiskLevel } from "@/types";
import { DISASTER_META, GUJARAT_DISTRICTS, RISK_META } from "@/lib/constants";
import { getForecast, getWeatherAlerts } from "@/lib/api";
import { useEnvelope } from "@/components/layout/useEnvelope";
import {
  EmptyState,
  ErrorState,
  UnavailableState,
  LoadingState,
} from "@/components/layout/primitives";
import { DataModeBadge } from "@/components/layout/ConnectionBar";
import { FlashAlertHistory } from "@/components/flash/FlashAlertHistory";
import {
  HUE_PRIMARY,
  SERIES_PAIR,
  axisProps,
  gridProps,
  tooltipProps,
} from "@/components/charts/chartTheme";

const SEVERITIES: RiskLevel[] = ["critical", "high", "moderate", "watch", "normal"];

export default function WeatherPage() {
  const { lang } = useLang();
  const t = pageStrings(lang).weather;
  const tc = pageStrings(lang).common;
  const alerts = useEnvelope(useCallback(() => getWeatherAlerts(), []));
  const forecast = useEnvelope(useCallback(() => getForecast(), []));

  const [district, setDistrict] = useState("");
  const [severities, setSeverities] = useState<RiskLevel[]>([]);

  const filtered = useMemo(
    () =>
      (alerts.data ?? [])
        .filter((a) => {
          if (district && a.district !== district) return false;
          if (severities.length && !severities.includes(a.severity)) return false;
          return true;
        })
        .sort(
          (a, b) =>
            RISK_META[b.severity].rank - RISK_META[a.severity].rank ||
            Date.parse(b.issuedAt) - Date.parse(a.issuedAt),
        ),
    [alerts.data, district, severities],
  );

  if (alerts.loading && !alerts.data) return <LoadingState label={t.loading} />;
  if (alerts.error && !alerts.data) {
    return (
      <div className="p-4">
        <ErrorState
          title={t.loadError}
          detail={alerts.error}
          onRetry={alerts.reload}
        />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-2 border-l-2 border-[var(--teal)] pl-3">
        <div>
          <h1 className="cmd text-[24px] leading-none">{t.title}</h1>
          <p className="text-sm text-[var(--muted)]">
            {t.lead}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
            style={{ background: "var(--medium-bg)", color: "var(--medium)" }}
          >
            {t.demoNote}
          </span>
          <DataModeBadge mode={alerts.mode} note={alerts.error} />
        </div>
      </header>

      {/* Filters */}
      <div className="panel mb-3 flex flex-wrap items-center gap-2 px-3 py-2.5">
        <label>
          <span className="sr-only">{tc.district}</span>
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="h-10 border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-sm"
          >
            <option value="">{tc.allDistricts}</option>
            {GUJARAT_DISTRICTS.map((d) => (
              <option key={d.id} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {SEVERITIES.map((s) => {
            const meta = RISK_META[s];
            const active = severities.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() =>
                  setSeverities((p) =>
                    p.includes(s) ? p.filter((x) => x !== s) : [...p, s],
                  )
                }
                aria-pressed={active}
                className="min-h-9 border px-2.5 text-xs font-bold uppercase"
                style={
                  active
                    ? { borderColor: meta.color, background: `${meta.color}14`, color: meta.color }
                    : { borderColor: "var(--border-strong)" }
                }
              >
                {PLATFORM_STRINGS[lang].risk[s]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Alerts */}
        <section className="panel">
          <h2 className="border-b border-[var(--border)] px-3 py-2 text-[13px] font-bold uppercase tracking-wide">
            {t.activeWarnings}
          </h2>
          {alerts.mode === "unavailable" ? (
            <UnavailableState
              what={pageStrings(lang).primitives.what.warningFeed}
              note={alerts.error}
              onRetry={alerts.reload}
            />
          ) : filtered.length === 0 ? (
            <EmptyState title={t.noWarnings} />
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {filtered.map((a) => {
                const meta = RISK_META[a.severity];
                const disaster = DISASTER_META[a.disaster];
                return (
                  <li key={a.id} className="border-l-4 px-3 py-3" style={{ borderLeftColor: meta.color }}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="px-1.5 py-0.5 text-[10px] font-bold uppercase"
                        style={{ background: meta.color, color: "#fff" }}
                      >
                        {PLATFORM_STRINGS[lang].risk[a.severity]}
                      </span>
                      <span
                        className="px-1.5 py-0.5 text-[10px] font-bold uppercase"
                        style={{ background: `${disaster.color}14`, color: disaster.color }}
                      >
                        {pageStrings(lang).disaster[a.disaster]}
                      </span>
                      <span className="mono text-[11px] text-[var(--muted)]">
                        {a.district}
                      </span>
                    </div>
                    <p className="mt-1 text-[14px] font-semibold">{a.headline}</p>
                    <p className="mt-0.5 text-[13px] text-[var(--muted)]">{a.detail}</p>
                    <p className="mono mt-1 text-[11px] text-[var(--faint)]">
                      Issued {new Date(a.issuedAt).toTimeString().slice(0, 5)} · {a.source}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Forecast */}
        <div className="flex flex-col gap-3">
          <section className="panel">
            <h2 className="border-b border-[var(--border)] px-3 py-2 text-[13px] font-bold uppercase tracking-wide">
              {t.rainfall7d}
            </h2>
            <div className="px-2 py-2">
              <p className="px-1 text-[11px] text-[var(--muted)]">{t.mmPerDay}</p>
              <ResponsiveContainer width="100%" height={170}>
                <BarChart
                  data={forecast.data ?? []}
                  margin={{ top: 16, right: 8, bottom: 0, left: -18 }}
                >
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="day" {...axisProps} />
                  <YAxis {...axisProps} width={32} />
                  <Tooltip
                    {...tooltipProps}
                    formatter={(v: unknown) => [`${Number(v)} mm`, t.rainfall]}
                  />
                  <Bar dataKey="rainfallMm" fill={HUE_PRIMARY} radius={[4, 4, 0, 0]} maxBarSize={28}>
                    <LabelList
                      dataKey="rainfallMm"
                      position="top"
                      className="mono"
                      style={{ fill: "var(--foreground)", fontSize: 10, fontWeight: 600 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="panel">
            <h2 className="border-b border-[var(--border)] px-3 py-2 text-[13px] font-bold uppercase tracking-wide">
              {t.windTemp}
            </h2>
            <div className="px-2 py-2">
              <p className="px-1 text-[11px] text-[var(--muted)]">
                {t.windTempNote}
              </p>
              <ResponsiveContainer width="100%" height={170}>
                <LineChart
                  data={forecast.data ?? []}
                  margin={{ top: 8, right: 8, bottom: 0, left: -18 }}
                >
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="day" {...axisProps} />
                  <YAxis {...axisProps} width={32} />
                  <Tooltip {...tooltipProps} />
                  <Line
                    type="monotone"
                    dataKey="windKph"
                    name={t.windKph}
                    stroke={SERIES_PAIR[0]}
                    strokeWidth={2}
                    dot={{ r: 2.5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="maxTempC"
                    name={t.maxC}
                    stroke={SERIES_PAIR[1]}
                    strokeWidth={2}
                    dot={{ r: 2.5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              <p className="px-1 pt-1 text-[11px] text-[var(--muted)]">
                <span style={{ color: SERIES_PAIR[0] }}>—</span> {t.windKph}{"  "}
                <span style={{ color: SERIES_PAIR[1] }}>—</span> {t.maxC}
              </p>
            </div>
          </section>
        </div>
      </div>

      {/* Warnings this platform raised, as opposed to the meteorological
          warnings above that it received. Same page because a citizen looking
          for "what am I being warned about" should not have to know which
          system produced the warning. The audit trail is public on purpose: a
          mass-warning capability nobody can inspect afterwards is not a
          governable one. This is also the only entry point to the composer —
          without it the flash alert system could display a warning but nothing
          could raise one. */}
      <div className="mt-3">
        <FlashAlertHistory />
      </div>

      <p className="mt-3 text-[11px] text-[var(--faint)]">
        {t.sourceNote}
      </p>
    </div>
  );
}
