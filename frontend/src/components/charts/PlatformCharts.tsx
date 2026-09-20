"use client";

/**
 * Named charts for the Emergency Intelligence Centre.
 *
 * These sit on the same primitives and the same validated palette as
 * `Charts.tsx` — see `chartTheme.ts` for why the two-series pair is what it is
 * and why risk/severity are encoded by position plus text rather than colour
 * alone.
 *
 * Every chart here states its title, its units, and its empty state.
 */

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RiskLevel } from "@/types";
import { RISK_META } from "@/lib/constants";
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
/* Incident trend                                                      */
/* ------------------------------------------------------------------ */

export function IncidentTrend({
  data,
}: {
  data: { label: string; incidents: number; reports: number }[];
}) {
  const t = pageStrings(useLang().lang).charts;
  if (data.length === 0) return <EmptyState title={t.noActivity} />;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: -16 }}>
        <defs>
          <linearGradient id="trendReports" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES_PAIR[0]} stopOpacity={0.28} />
            <stop offset="100%" stopColor={SERIES_PAIR[0]} stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="trendIncidents" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES_PAIR[1]} stopOpacity={0.28} />
            <stop offset="100%" stopColor={SERIES_PAIR[1]} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={32} allowDecimals={false} />
        <Tooltip {...tooltipProps} />
        <Legend wrapperStyle={{ fontSize: 11, color: "var(--muted)" }} iconType="plainline" />
        <Area
          type="monotone"
          dataKey="reports"
          name={t.reports}
          stroke={SERIES_PAIR[0]}
          strokeWidth={2}
          fill="url(#trendReports)"
        />
        <Area
          type="monotone"
          dataKey="incidents"
          name={t.incidents}
          stroke={SERIES_PAIR[1]}
          strokeWidth={2}
          fill="url(#trendIncidents)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/* Response times                                                      */
/* ------------------------------------------------------------------ */

export function ResponseTimeChart({
  data,
}: {
  data: { label: string; dispatch: number | null; resolve: number | null }[];
}) {
  const t = pageStrings(useLang().lang).charts;
  if (data.length === 0) return <EmptyState title={t.noCompleted} />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 38 + 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 4 }}>
        <CartesianGrid {...gridProps} vertical horizontal={false} />
        <XAxis type="number" {...axisProps} tickFormatter={(v: number) => formatDuration(v)} />
        <YAxis type="category" dataKey="label" width={118} {...axisProps} axisLine={false} />
        <Tooltip {...tooltipProps} formatter={(v: unknown) => formatDuration(Number(v))} />
        <Legend wrapperStyle={{ fontSize: 11, color: "var(--muted)" }} />
        <Bar
          dataKey="dispatch"
          name={t.reportToDispatch}
          fill={SERIES_PAIR[0]}
          radius={[0, 4, 4, 0]}
          maxBarSize={11}
        >
          <LabelList
            dataKey="dispatch"
            position="right"
            formatter={(v: unknown) =>
              v === null || v === undefined ? "—" : formatDuration(Number(v))
            }
            className="mono"
            style={{ fill: "var(--foreground)", fontSize: 10 }}
          />
        </Bar>
        <Bar
          dataKey="resolve"
          name={t.reportToResolved}
          fill={SERIES_PAIR[1]}
          radius={[0, 4, 4, 0]}
          maxBarSize={11}
        >
          <LabelList
            dataKey="resolve"
            position="right"
            formatter={(v: unknown) =>
              v === null || v === undefined ? "—" : formatDuration(Number(v))
            }
            className="mono"
            style={{ fill: "var(--foreground)", fontSize: 10 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/* Shelter capacity                                                    */
/* ------------------------------------------------------------------ */

export function ShelterCapacity({
  data,
}: {
  data: { label: string; occupancy: number; free: number; capacity: number }[];
}) {
  const t = pageStrings(useLang().lang).charts;
  if (data.length === 0) return <EmptyState title={t.noShelters} />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 30 + 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 44, bottom: 4, left: 4 }}>
        <CartesianGrid {...gridProps} vertical horizontal={false} />
        <XAxis type="number" {...axisProps} allowDecimals={false} />
        <YAxis type="category" dataKey="label" width={150} {...axisProps} axisLine={false} />
        <Tooltip {...tooltipProps} />
        <Legend wrapperStyle={{ fontSize: 11, color: "var(--muted)" }} />
        {/* Stacked to capacity, so the free remainder is visible at a glance. */}
        <Bar
          dataKey="occupancy"
          name={t.inUse}
          stackId="cap"
          fill={SERIES_PAIR[0]}
          maxBarSize={16}
        />
        <Bar
          dataKey="free"
          name={t.free}
          stackId="cap"
          fill="var(--border-strong)"
          radius={[0, 4, 4, 0]}
          maxBarSize={16}
        >
          <LabelList
            dataKey="capacity"
            position="right"
            className="mono"
            style={{ fill: "var(--muted)", fontSize: 10 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/* District risk                                                       */
/* ------------------------------------------------------------------ */

/**
 * District on the axis, incident count as the bar length, risk as a redundant
 * colour with its label printed beside it. Adjacent risk steps are not
 * reliably separable by colour, so the text carries the meaning.
 */
export function DistrictRisk({
  data,
}: {
  data: { district: string; risk: RiskLevel; incidents: number }[];
}) {
  const t = pageStrings(useLang().lang).charts;
  if (data.length === 0) return <EmptyState title={t.noDistricts} />;
  const rows = data.map((d) => ({ ...d, riskLabel: RISK_META[d.risk].label }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 26 + 40)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 92, bottom: 4, left: 4 }}>
        <CartesianGrid {...gridProps} vertical horizontal={false} />
        <XAxis type="number" {...axisProps} allowDecimals={false} />
        <YAxis type="category" dataKey="district" width={94} {...axisProps} axisLine={false} />
        <Tooltip
          {...tooltipProps}
          formatter={(v: unknown) => [Number(v), t.activeIncidents]}
        />
        <Bar dataKey="incidents" radius={[0, 4, 4, 0]} maxBarSize={16}>
          {rows.map((row) => (
            <Cell key={row.district} fill={RISK_META[row.risk].color} />
          ))}
          <LabelList
            dataKey="riskLabel"
            position="right"
            className="mono"
            style={{ fill: "var(--muted)", fontSize: 9, fontWeight: 700 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/* Resource utilisation                                                */
/* ------------------------------------------------------------------ */

export function ResourceUtilization({
  data,
}: {
  data: { label: string; committed: number; available: number }[];
}) {
  const t = pageStrings(useLang().lang).charts;
  if (data.length === 0) return <EmptyState title={t.noUnits} />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 32 + 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 28, bottom: 4, left: 4 }}>
        <CartesianGrid {...gridProps} vertical horizontal={false} />
        <XAxis type="number" {...axisProps} allowDecimals={false} />
        <YAxis type="category" dataKey="label" width={104} {...axisProps} axisLine={false} />
        <Tooltip {...tooltipProps} />
        <Legend wrapperStyle={{ fontSize: 11, color: "var(--muted)" }} />
        <Bar
          dataKey="committed"
          name={t.committed}
          stackId="u"
          fill={HUE_PRIMARY}
          maxBarSize={16}
        />
        <Bar
          dataKey="available"
          name={t.available}
          stackId="u"
          fill="var(--ok)"
          radius={[0, 4, 4, 0]}
          maxBarSize={16}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/* ResQ Pulse distribution                                             */
/* ------------------------------------------------------------------ */

export function PulseDistribution({
  data,
}: {
  data: { risk: RiskLevel; districts: number }[];
}) {
  const t = pageStrings(useLang().lang).charts;
  const rows = data.filter((d) => d.districts > 0);
  if (rows.length === 0) return <EmptyState title={t.noDistricts} />;

  return (
    <ResponsiveContainer width="100%" height={190}>
      <BarChart
        data={data.map((d) => ({ ...d, label: RISK_META[d.risk].label }))}
        margin={{ top: 18, right: 8, bottom: 4, left: -20 }}
      >
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...axisProps} tick={{ fill: "var(--muted)", fontSize: 9 }} />
        <YAxis {...axisProps} width={30} allowDecimals={false} />
        <Tooltip {...tooltipProps} formatter={(v: unknown) => [Number(v), t.districts]} />
        <Bar dataKey="districts" name={t.districts} radius={[4, 4, 0, 0]} maxBarSize={44}>
          {data.map((d) => (
            <Cell key={d.risk} fill={RISK_META[d.risk].color} />
          ))}
          <LabelList
            dataKey="districts"
            position="top"
            className="mono"
            style={{ fill: "var(--foreground)", fontSize: 11, fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
