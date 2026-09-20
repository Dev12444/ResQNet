"use client";

/**
 * The chart set for `/analytics`.
 *
 * Forms are chosen by the job the data does, not by variety:
 *   - counts across named categories → horizontal bars, category on the axis,
 *     one hue, value written on every bar (no legend needed for one series)
 *   - change over time → line, two series, legend + direct end labels
 *   - two measures per category → grouped bars with the validated pair
 *
 * Every bar carries its number, so the figures are readable without hovering
 * and the charts double as their own data table.
 */

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Severity } from "@/types";
import { SEVERITY_COLOR, SEVERITY_LABEL } from "@/lib/constants";
import {
  HUE_PRIMARY,
  SERIES_PAIR,
  axisProps,
  formatDuration,
  gridProps,
  tooltipProps,
} from "./chartTheme";
import { EmptyState } from "@/components/layout/primitives";
import { pageStrings } from "@/lib/pageStrings";
import { useLang } from "@/components/layout/LangProvider";

/* ------------------------------------------------------------------ */
/* Counts across categories                                            */
/* ------------------------------------------------------------------ */

export function CategoryBars({
  data,
  height = 220,
  valueLabel,
}: {
  data: { label: string; value: number }[];
  height?: number;
  valueLabel?: string;
}) {
  const t = pageStrings(useLang().lang).charts;
  if (data.length === 0) return <EmptyState title={t.noData} />;

  return (
    <ResponsiveContainer width="100%" height={Math.max(height, data.length * 28 + 30)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 36, bottom: 4, left: 4 }}>
        <CartesianGrid {...gridProps} vertical horizontal={false} />
        <XAxis type="number" {...axisProps} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={132}
          {...axisProps}
          axisLine={false}
        />
        <Tooltip
          {...tooltipProps}
          formatter={(v: unknown) => [Number(v), valueLabel ?? t.count] as [number, string]}
        />
        <Bar dataKey="value" fill={HUE_PRIMARY} radius={[0, 4, 4, 0]} maxBarSize={18}>
          <LabelList
            dataKey="value"
            position="right"
            className="mono"
            style={{ fill: "var(--foreground)", fontSize: 11, fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/* Severity mix                                                        */
/* ------------------------------------------------------------------ */

/**
 * Severity on the X axis, so POSITION carries the ordering. The contract
 * colours ride along as a redundant cue and each bar states its own count;
 * the chart stays readable if the colours are indistinguishable.
 */
export function SeverityBars({ data }: { data: { severity: Severity; count: number }[] }) {
  const t = pageStrings(useLang().lang).charts;
  if (data.every((d) => d.count === 0)) {
    return <EmptyState title={t.noIncidents} />;
  }
  const rows = data.map((d) => ({
    ...d,
    label: `SEV ${d.severity}`,
    name: SEVERITY_LABEL[d.severity],
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={rows} margin={{ top: 18, right: 8, bottom: 4, left: 4 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} allowDecimals={false} width={28} />
        <Tooltip {...tooltipProps} />
        <Bar dataKey="count" name={t.incidents} radius={[4, 4, 0, 0]} maxBarSize={44}>
          {rows.map((row) => (
            <Cell key={row.severity} fill={SEVERITY_COLOR[row.severity]} />
          ))}
          <LabelList
            dataKey="count"
            position="top"
            className="mono"
            style={{ fill: "var(--foreground)", fontSize: 11, fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/* Change over time                                                    */
/* ------------------------------------------------------------------ */

export function TimelineChart({
  data,
}: {
  data: { t: string; incidents: number; reports: number }[];
}) {
  const t = pageStrings(useLang().lang).charts;
  const tt = pageStrings(useLang().lang).misc.chartTable;
  const [showTable, setShowTable] = useState(false);
  if (data.length === 0) return <EmptyState title={t.noActivity} />;

  const rows = data.map((d) => ({
    ...d,
    label: new Date(d.t).toTimeString().slice(0, 5),
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis {...axisProps} allowDecimals={false} width={28} />
          <Tooltip {...tooltipProps} cursor={{ stroke: "var(--border-strong)" }} />
          <Legend
            wrapperStyle={{ fontSize: 12, color: "var(--muted)" }}
            iconType="plainline"
          />
          <Line
            type="monotone"
            dataKey="reports"
            name={t.reports}
            stroke={SERIES_PAIR[0]}
            strokeWidth={2}
            dot={{ r: 2.5 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="incidents"
            name={t.incidents}
            stroke={SERIES_PAIR[1]}
            strokeWidth={2}
            dot={{ r: 2.5 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>

      <button
        type="button"
        onClick={() => setShowTable((s) => !s)}
        aria-expanded={showTable}
        className="mt-1 text-xs font-semibold underline"
      >
        {showTable ? t.hideTable : t.showTable}
      </button>

      {showTable && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <caption className="sr-only">{tt.caption}</caption>
            <thead>
              <tr className="border-b border-[var(--border-strong)] text-left">
                <th scope="col" className="px-2 py-1">{tt.time}</th>
                <th scope="col" className="px-2 py-1">{tt.reports}</th>
                <th scope="col" className="px-2 py-1">{tt.incidents}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.t} className="border-b border-[var(--border)]">
                  <td className="mono px-2 py-1">{r.label}</td>
                  <td className="mono px-2 py-1">{r.reports}</td>
                  <td className="mono px-2 py-1">{r.incidents}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Two measures per category                                           */
/* ------------------------------------------------------------------ */

export function GroupedBars({
  data,
  seriesA,
  seriesB,
  asDuration = false,
}: {
  data: { label: string; a: number | null; b: number | null }[];
  seriesA: string;
  seriesB: string;
  asDuration?: boolean;
}) {
  const t = pageStrings(useLang().lang).charts;
  if (data.length === 0) return <EmptyState title={t.noData} />;
  const fmt = (v: number) => (asDuration ? formatDuration(v) : String(v));

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 40 + 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 52, bottom: 4, left: 4 }}>
        <CartesianGrid {...gridProps} vertical horizontal={false} />
        <XAxis type="number" {...axisProps} tickFormatter={fmt} />
        <YAxis type="category" dataKey="label" width={128} {...axisProps} axisLine={false} />
        <Tooltip {...tooltipProps} formatter={(v: unknown) => fmt(Number(v))} />
        <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} />
        {/* 2px surface gap between adjacent bars keeps the pair legible. */}
        <Bar
          dataKey="a"
          name={seriesA}
          fill={SERIES_PAIR[0]}
          radius={[0, 4, 4, 0]}
          maxBarSize={12}
        >
          <LabelList
            dataKey="a"
            position="right"
            formatter={(v: unknown) => (v === null || v === undefined ? "—" : fmt(Number(v)))}
            className="mono"
            style={{ fill: "var(--foreground)", fontSize: 10 }}
          />
        </Bar>
        <Bar
          dataKey="b"
          name={seriesB}
          fill={SERIES_PAIR[1]}
          radius={[0, 4, 4, 0]}
          maxBarSize={12}
        >
          <LabelList
            dataKey="b"
            position="right"
            formatter={(v: unknown) => (v === null || v === undefined ? "—" : fmt(Number(v)))}
            className="mono"
            style={{ fill: "var(--foreground)", fontSize: 10 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
