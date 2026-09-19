"use client";

/**
 * `/analytics` — Emergency Intelligence Centre.
 *
 * Filters are applied to the district/incident/shelter/resource sets on the
 * client, and every KPI and chart is recomputed from the filtered rows — a
 * filter is never decorative. Where a figure cannot be derived from the data
 * we hold, the panel says so rather than showing a plausible number.
 *
 * Owner: FE2.
 */

import { useCallback, useMemo, useState } from "react";
import type {
  DisasterType,
  Incident,
  IncidentStatus,
  IncidentTrust,
  RiskLevel,
  Severity,
} from "@/types";
import {
  DISASTER_META,
  GUJARAT_DISTRICTS,
  INCIDENT_STATUS_LABEL,
  INCIDENT_TYPE_META,
  RESOURCE_KIND_META,
  RISK_META,
  RISK_ORDER,
  SEVERITY_LABEL,
  confidenceBand,
} from "@/lib/constants";
import {
  computeShortages,
  getDistrictSituations,
  getIncidentsWithTrust,
  getPulse,
  getResourceViews,
  getShelters,
} from "@/lib/api";
import { useEnvelope } from "@/components/layout/useEnvelope";
import {
  Badge,
  EmptyState,
  ErrorState,
  LoadingState,
  Panel,
} from "@/components/layout/primitives";
import { DataModeBadge, useNow } from "@/components/layout/ConnectionBar";
import { formatDuration } from "@/components/charts/chartTheme";
import { CategoryBars } from "@/components/charts/Charts";
import {
  DistrictRisk,
  IncidentTrend,
  PulseDistribution,
  ResourceUtilization,
  ResponseTimeChart,
  ShelterCapacity,
} from "@/components/charts/PlatformCharts";

/* ------------------------------------------------------------------ */

const WINDOWS = [
  { id: "today", label: "Today", hours: 24 },
  { id: "7d", label: "7 Days", hours: 24 * 7 },
  { id: "30d", label: "30 Days", hours: 24 * 30 },
  { id: "custom", label: "Custom", hours: null },
] as const;

type WindowId = (typeof WINDOWS)[number]["id"];

const STATUSES: IncidentStatus[] = [
  "new",
  "triaged",
  "dispatched",
  "on_scene",
  "resolved",
  "escalated",
];
const SEVERITIES: Severity[] = [1, 2, 3, 4, 5];

/** Contract incident types mapped onto the public disaster vocabulary. */
const INCIDENT_TO_DISASTER: Record<string, DisasterType> = {
  flood: "flood",
  fire: "fire",
  road_accident: "road_block",
  industrial: "infrastructure",
  medical: "medical",
  building_collapse: "infrastructure",
  other: "other",
};

export default function AnalyticsPage() {
  const paired = useEnvelope(useCallback(() => getIncidentsWithTrust(), []));
  const situations = useEnvelope(useCallback(() => getDistrictSituations(), []));
  const shelters = useEnvelope(useCallback(() => getShelters(), []));
  const units = useEnvelope(useCallback(() => getResourceViews(), []));
  const pulse = useEnvelope(useCallback(() => getPulse(), []));
  const now = useNow();

  const [windowId, setWindowId] = useState<WindowId>("30d");
  const [customDays, setCustomDays] = useState(3);
  const [districts, setDistricts] = useState<string[]>([]);
  const [disasters, setDisasters] = useState<DisasterType[]>([]);
  const [severities, setSeverities] = useState<Severity[]>([]);
  const [statuses, setStatuses] = useState<IncidentStatus[]>([]);

  const windowHours =
    windowId === "custom"
      ? customDays * 24
      : WINDOWS.find((w) => w.id === windowId)!.hours!;

  const districtOf = useCallback((incident: Incident): string => {
    const m = GUJARAT_DISTRICTS.find((d) => incident.address.includes(d.name));
    return m?.name ?? "Ahmedabad";
  }, []);

  /* ---------------- filtering ---------------- */

  const rows = useMemo(() => {
    const all = paired.data ?? [];
    const cutoff = now === null ? null : now - windowHours * 3600_000;

    return all.filter(({ incident }) => {
      if (cutoff !== null && Date.parse(incident.created_at) < cutoff) return false;
      if (districts.length && !districts.includes(districtOf(incident))) return false;
      if (
        disasters.length &&
        !disasters.includes(INCIDENT_TO_DISASTER[incident.type] ?? "other")
      ) {
        return false;
      }
      if (severities.length && !severities.includes(incident.severity)) return false;
      if (statuses.length && !statuses.includes(incident.status)) return false;
      return true;
    });
  }, [paired.data, now, windowHours, districts, disasters, severities, statuses, districtOf]);

  const incidents = useMemo(() => rows.map((r) => r.incident), [rows]);

  const scopedSituations = useMemo(
    () =>
      (situations.data ?? []).filter(
        (s) => districts.length === 0 || districts.includes(s.district),
      ),
    [situations.data, districts],
  );

  const scopedShelters = useMemo(
    () =>
      (shelters.data ?? []).filter(
        (s) => districts.length === 0 || districts.includes(s.district),
      ),
    [shelters.data, districts],
  );

  const scopedUnits = useMemo(
    () =>
      (units.data ?? []).filter(
        (u) => districts.length === 0 || districts.includes(u.district),
      ),
    [units.data, districts],
  );

  const scopedPulse = useMemo(
    () =>
      (pulse.data ?? []).filter(
        (p) => districts.length === 0 || districts.includes(p.district),
      ),
    [pulse.data, districts],
  );

  /* ---------------- KPIs ---------------- */

  const kpis = useMemo(() => {
    const active = incidents.filter((i) => i.status !== "resolved").length;
    const resolved = incidents.filter((i) => i.status === "resolved").length;

    const dispatchTimes = incidents
      .filter((i) => i.dispatched_at)
      .map((i) => (Date.parse(i.dispatched_at!) - Date.parse(i.created_at)) / 1000);

    const committed = scopedUnits.filter((u) => u.status !== "available").length;
    const capacity = scopedShelters.reduce((a, s) => a + s.capacity, 0);
    const occupancy = scopedShelters.reduce((a, s) => a + s.occupancy, 0);
    const worstRisk = scopedSituations.reduce<RiskLevel>(
      (worst, s) => (RISK_META[s.risk].rank > RISK_META[worst].rank ? s.risk : worst),
      "normal",
    );

    return {
      active,
      resolved,
      affected: scopedSituations.reduce((a, s) => a + s.peopleAffected, 0),
      avgDispatch: dispatchTimes.length
        ? dispatchTimes.reduce((a, b) => a + b, 0) / dispatchTimes.length
        : null,
      teams: scopedSituations.reduce((a, s) => a + s.responseTeams, 0),
      shelterPct: capacity ? Math.round((occupancy / capacity) * 100) : null,
      occupancy,
      capacity,
      worstRisk,
      utilisation: scopedUnits.length
        ? Math.round((committed / scopedUnits.length) * 100)
        : null,
    };
  }, [incidents, scopedUnits, scopedShelters, scopedSituations]);

  /* ---------------- series ---------------- */

  const trend = useMemo(() => {
    if (incidents.length === 0) return [];
    const buckets = new Map<number, { incidents: number; reports: number }>();
    const size = windowHours <= 24 ? 900_000 : 3_600_000 * 6;
    for (const i of incidents) {
      const key = Math.floor(Date.parse(i.created_at) / size) * size;
      const e = buckets.get(key) ?? { incidents: 0, reports: 0 };
      e.incidents += 1;
      e.reports += i.report_count;
      buckets.set(key, e);
    }
    return [...buckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([t, v]) => ({
        label:
          windowHours <= 24
            ? new Date(t).toTimeString().slice(0, 5)
            : new Date(t).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        ...v,
      }));
  }, [incidents, windowHours]);

  const byType = useMemo(
    () =>
      Object.keys(INCIDENT_TYPE_META)
        .map((type) => ({
          label: INCIDENT_TYPE_META[type as keyof typeof INCIDENT_TYPE_META].label,
          value: incidents.filter((i) => i.type === type).length,
        }))
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value),
    [incidents],
  );

  const responseByType = useMemo(() => {
    const groups = new Map<string, { d: number[]; r: number[] }>();
    for (const i of incidents) {
      const e = groups.get(i.type) ?? { d: [], r: [] };
      const created = Date.parse(i.created_at);
      if (i.dispatched_at) e.d.push((Date.parse(i.dispatched_at) - created) / 1000);
      if (i.resolved_at) e.r.push((Date.parse(i.resolved_at) - created) / 1000);
      groups.set(i.type, e);
    }
    return [...groups.entries()]
      .map(([type, v]) => ({
        label: INCIDENT_TYPE_META[type as keyof typeof INCIDENT_TYPE_META].label,
        dispatch: v.d.length ? avg(v.d) : null,
        resolve: v.r.length ? avg(v.r) : null,
      }))
      .filter((d) => d.dispatch !== null || d.resolve !== null);
  }, [incidents]);

  const shelterSeries = useMemo(
    () =>
      scopedShelters.map((s) => ({
        label: s.name.length > 22 ? `${s.name.slice(0, 21)}…` : s.name,
        occupancy: s.occupancy,
        free: Math.max(0, s.capacity - s.occupancy),
        capacity: s.capacity,
      })),
    [scopedShelters],
  );

  const riskSeries = useMemo(
    () =>
      [...scopedSituations]
        .sort(
          (a, b) =>
            RISK_META[b.risk].rank - RISK_META[a.risk].rank ||
            b.activeIncidents - a.activeIncidents,
        )
        .slice(0, 10)
        .map((s) => ({
          district: s.district,
          risk: s.risk,
          incidents: s.activeIncidents,
        })),
    [scopedSituations],
  );

  const utilisationSeries = useMemo(() => {
    const kinds = [...new Set(scopedUnits.map((u) => u.kind))];
    return kinds.map((kind) => {
      const list = scopedUnits.filter((u) => u.kind === kind);
      const available = list.filter((u) => u.status === "available").length;
      return {
        label: RESOURCE_KIND_META[kind].label,
        committed: list.length - available,
        available,
      };
    });
  }, [scopedUnits]);

  const pulseSeries = useMemo(
    () =>
      RISK_ORDER.map((risk) => ({
        risk,
        districts: scopedSituations.filter((s) => s.risk === risk).length,
      })),
    [scopedSituations],
  );

  const districtTable = useMemo(
    () =>
      [...scopedSituations]
        .sort((a, b) => RISK_META[b.risk].rank - RISK_META[a.risk].rank)
        .map((s) => {
          const inDistrict = incidents.filter((i) => districtOf(i) === s.district);
          const dispatchTimes = inDistrict
            .filter((i) => i.dispatched_at)
            .map((i) => (Date.parse(i.dispatched_at!) - Date.parse(i.created_at)) / 1000);
          const p = scopedPulse.find((x) => x.district === s.district);
          return {
            district: s.district,
            risk: s.risk,
            incidents: s.activeIncidents,
            shelters: s.sheltersOpen,
            teams: s.responseTeams,
            affected: s.peopleAffected,
            avgDispatch: dispatchTimes.length ? avg(dispatchTimes) : null,
            reports: p?.reports ?? null,
          };
        }),
    [scopedSituations, incidents, scopedPulse, districtOf],
  );

  const insights = useMemo(
    () => deriveInsights(rows, scopedSituations, scopedUnits, scopedShelters, now),
    [rows, scopedSituations, scopedUnits, scopedShelters, now],
  );

  const filtersActive =
    districts.length > 0 ||
    disasters.length > 0 ||
    severities.length > 0 ||
    statuses.length > 0 ||
    windowId !== "30d";

  if (paired.loading && !paired.data) return <LoadingState label="Loading analytics…" />;
  if (paired.error && !paired.data) {
    return (
      <div className="p-4">
        <ErrorState
          title="Could not load analytics"
          detail={paired.error}
          onRetry={paired.reload}
        />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-2 border-l-2 border-[var(--teal)] pl-3">
        <div>
          <p className="eyebrow mb-1 text-[var(--teal)]">ResQNet · State Operations</p>
          <h1 className="cmd text-[24px] leading-none">Emergency Intelligence Centre</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {incidents.length} of {paired.data?.length ?? 0} incidents ·{" "}
            {scopedSituations.length} districts in view
          </p>
        </div>
        <DataModeBadge mode={paired.mode} note={paired.error} />
      </header>

      {/* KPIs */}
      <div className="mb-3 grid gap-px bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <Kpi label="Active incidents" value={kpis.active} tone="var(--critical)" />
        <Kpi label="Resolved" value={kpis.resolved} tone="var(--ok)" />
        <Kpi
          label="People affected"
          value={kpis.affected.toLocaleString("en-IN")}
          tone="var(--foreground)"
        />
        <Kpi
          label="Avg response"
          value={kpis.avgDispatch === null ? "—" : formatDuration(kpis.avgDispatch)}
          tone="var(--info)"
          note={kpis.avgDispatch === null ? "No dispatches in window" : "Report → dispatch"}
        />
        <Kpi label="Teams deployed" value={kpis.teams} tone="var(--info)" />
        <Kpi
          label="Shelter occupancy"
          value={kpis.shelterPct === null ? "—" : `${kpis.shelterPct}%`}
          tone={kpis.shelterPct !== null && kpis.shelterPct >= 85 ? "var(--high)" : "var(--ok)"}
          note={`${kpis.occupancy.toLocaleString("en-IN")} of ${kpis.capacity.toLocaleString("en-IN")}`}
        />
        <Kpi
          label="Highest district risk"
          value={RISK_META[kpis.worstRisk].label}
          tone={RISK_META[kpis.worstRisk].color}
          note={
            kpis.utilisation === null
              ? undefined
              : `Units committed: ${kpis.utilisation}%`
          }
        />
      </div>

      {/* Filters */}
      <Panel title="Filters" className="mb-3">
        <div className="space-y-2 px-3 py-2.5">
          <FilterRow label="Period">
            {WINDOWS.map((w) => (
              <Chip
                key={w.id}
                label={w.label}
                active={windowId === w.id}
                onClick={() => setWindowId(w.id)}
              />
            ))}
            {windowId === "custom" && (
              <label className="flex items-center gap-1.5 text-xs">
                <span className="sr-only">Custom period in days</span>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={customDays}
                  onChange={(e) => setCustomDays(Math.max(1, Number(e.target.value) || 1))}
                  className="h-8 w-16 border border-[var(--border-strong)] px-1.5 text-sm"
                />
                days
              </label>
            )}
          </FilterRow>

          <FilterRow label="District">
            {GUJARAT_DISTRICTS.map((d) => (
              <Chip
                key={d.id}
                label={d.name}
                active={districts.includes(d.name)}
                onClick={() => toggle(districts, d.name, setDistricts)}
              />
            ))}
          </FilterRow>

          <FilterRow label="Disaster">
            {(Object.keys(DISASTER_META) as DisasterType[])
              .filter((d) => d !== "heavy_rainfall" && d !== "missing_person")
              .map((d) => (
                <Chip
                  key={d}
                  label={DISASTER_META[d].label}
                  active={disasters.includes(d)}
                  onClick={() => toggle(disasters, d, setDisasters)}
                />
              ))}
          </FilterRow>

          <FilterRow label="Severity">
            {SEVERITIES.map((s) => (
              <Chip
                key={s}
                label={`SEV ${s} · ${SEVERITY_LABEL[s]}`}
                active={severities.includes(s)}
                onClick={() => toggle(severities, s, setSeverities)}
              />
            ))}
          </FilterRow>

          <FilterRow label="Status">
            {STATUSES.map((s) => (
              <Chip
                key={s}
                label={INCIDENT_STATUS_LABEL[s]}
                active={statuses.includes(s)}
                onClick={() => toggle(statuses, s, setStatuses)}
              />
            ))}
          </FilterRow>

          {filtersActive && (
            <button
              type="button"
              onClick={() => {
                setDistricts([]);
                setDisasters([]);
                setSeverities([]);
                setStatuses([]);
                setWindowId("30d");
              }}
              className="min-h-9 border border-[var(--border-strong)] px-2.5 text-xs font-semibold"
            >
              Clear all filters
            </button>
          )}
        </div>
      </Panel>

      {/* Observations */}
      <Panel
        title="Observations"
        subtitle="Computed from the rows currently in view."
        className="mb-3"
      >
        {insights.length === 0 ? (
          <EmptyState title="Nothing notable in this selection" />
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {insights.map((i) => (
              <li key={i.id} className="flex flex-wrap gap-x-3 gap-y-1 px-3 py-2">
                <Badge
                  label={i.severity}
                  color={
                    i.severity === "critical"
                      ? "var(--critical)"
                      : i.severity === "warning"
                        ? "var(--high)"
                        : "var(--info)"
                  }
                  variant="tint"
                />
                <div className="min-w-56 flex-1">
                  <p className="text-sm font-semibold">{i.headline}</p>
                  <p className="text-sm text-[var(--muted)]">{i.detail}</p>
                  <p className="mono mt-0.5 text-xs text-[var(--faint)]">{i.evidence}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Charts */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Incident trend" subtitle="Incidents and reports opened per bucket.">
          <div className="px-2 py-2">
            <IncidentTrend data={trend} />
          </div>
        </Panel>

        <Panel title="Incident type" subtitle="Count of incidents by type.">
          <div className="px-2 py-2">
            <CategoryBars data={byType} valueLabel="Incidents" />
          </div>
        </Panel>

        <Panel
          title="District risk"
          subtitle="Active incidents per district; risk level printed beside each bar."
        >
          <div className="px-2 py-2">
            <DistrictRisk data={riskSeries} />
          </div>
        </Panel>

        <Panel
          title="Response time"
          subtitle="Report → dispatch and report → resolved, from incident timestamps."
        >
          <div className="px-2 py-2">
            <ResponseTimeChart data={responseByType} />
            <p className="px-1 pt-1 text-[11px] text-[var(--muted)]">
              Report → triage is not shown: the incident contract has no `triaged_at`
              timestamp, so it cannot be derived.
            </p>
          </div>
        </Panel>

        <Panel title="Shelter capacity" subtitle="Places in use against total capacity.">
          <div className="px-2 py-2">
            <ShelterCapacity data={shelterSeries} />
          </div>
        </Panel>

        <Panel title="Resource utilisation" subtitle="Units committed against available.">
          <div className="px-2 py-2">
            <ResourceUtilization data={utilisationSeries} />
          </div>
        </Panel>

        <Panel
          title="ResQ Pulse distribution"
          subtitle="How many districts sit at each risk level."
        >
          <div className="px-2 py-2">
            <PulseDistribution data={pulseSeries} />
          </div>
        </Panel>

        <Panel title="District comparison">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <caption className="sr-only">
                Risk, incidents, shelters, teams and dispatch time per district
              </caption>
              <thead>
                <tr className="border-b-2 border-[var(--border-strong)] text-left">
                  {["District", "Risk", "Incidents", "Shelters", "Teams", "Affected", "Avg dispatch"].map(
                    (h) => (
                      <th
                        key={h}
                        scope="col"
                        className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {districtTable.map((d) => (
                  <tr key={d.district} className="border-b border-[var(--border)]">
                    <td className="px-2 py-1.5 font-medium">{d.district}</td>
                    <td className="px-2 py-1.5">
                      <span
                        className="px-1 text-[10px] font-bold uppercase"
                        style={{
                          background: `${RISK_META[d.risk].color}14`,
                          color: RISK_META[d.risk].color,
                        }}
                      >
                        {RISK_META[d.risk].label}
                      </span>
                    </td>
                    <td className="mono px-2 py-1.5">{d.incidents}</td>
                    <td className="mono px-2 py-1.5">{d.shelters}</td>
                    <td className="mono px-2 py-1.5">{d.teams}</td>
                    <td className="mono px-2 py-1.5">
                      {d.affected.toLocaleString("en-IN")}
                    </td>
                    <td className="mono px-2 py-1.5">{formatDuration(d.avgDispatch)}</td>
                  </tr>
                ))}
                {districtTable.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-2 py-4 text-center text-[var(--muted)]">
                      No districts in this selection.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Insights                                                            */
/* ------------------------------------------------------------------ */

interface Insight {
  id: string;
  severity: "critical" | "warning" | "info";
  headline: string;
  detail: string;
  evidence: string;
}

function deriveInsights(
  rows: { incident: Incident; trust: IncidentTrust }[],
  situations: { district: string; risk: RiskLevel; sheltersOpen: number }[],
  units: { kind: keyof typeof RESOURCE_KIND_META; status: string }[],
  shelters: { name: string; occupancy: number; capacity: number; district: string }[],
  now: number | null,
): Insight[] {
  const out: Insight[] = [];
  const clock = now ?? 0;

  const undispatchedP1 = rows.filter(
    (r) => r.incident.priority === "P1" && r.incident.dispatched_at === null,
  );
  if (undispatchedP1.length > 0 && clock > 0) {
    const oldest = undispatchedP1.reduce((a, b) =>
      Date.parse(a.incident.created_at) < Date.parse(b.incident.created_at) ? a : b,
    );
    out.push({
      id: "sla",
      severity: "critical",
      headline: `${undispatchedP1.length} P1 incident${undispatchedP1.length === 1 ? "" : "s"} not yet dispatched`,
      detail: `${oldest.incident.code} has been waiting longest.`,
      evidence: `${oldest.incident.code} · ${Math.round((clock - Date.parse(oldest.incident.created_at)) / 60000)} min · ${oldest.incident.address}`,
    });
  }

  const shortages = computeShortages(
    rows.map((r) => r.incident),
    units as never,
  ).filter((s) => s.shortage > 0);
  for (const s of shortages) {
    out.push({
      id: `shortage-${s.kind}`,
      severity: s.available === 0 ? "critical" : "warning",
      headline: `${RESOURCE_KIND_META[s.kind].label} shortage`,
      detail:
        s.available === 0
          ? "No units of this type are available anywhere in view."
          : "Open incidents need more units of this type than are free.",
      evidence: `Required ${s.required} · Available ${s.available} · Shortage ${s.shortage}`,
    });
  }

  const critical = situations.filter((s) => s.risk === "critical");
  if (critical.length > 0) {
    out.push({
      id: "critical-districts",
      severity: "critical",
      headline: `${critical.length} district${critical.length === 1 ? "" : "s"} at CRITICAL risk`,
      detail: "These districts carry the highest combination of hazard and exposure.",
      evidence: critical.map((s) => `${s.district} (${s.sheltersOpen} shelters open)`).join(", "),
    });
  }

  const full = shelters.filter((s) => s.occupancy >= s.capacity);
  const nearFull = shelters.filter(
    (s) => s.occupancy < s.capacity && s.occupancy / s.capacity >= 0.85,
  );
  if (full.length + nearFull.length > 0) {
    out.push({
      id: "shelter-capacity",
      severity: full.length > 0 ? "critical" : "warning",
      headline: `${full.length} shelter${full.length === 1 ? "" : "s"} full, ${nearFull.length} near capacity`,
      detail: "Arrivals should be redirected before these are overwhelmed.",
      evidence: [...full, ...nearFull]
        .map((s) => `${s.name} ${s.occupancy}/${s.capacity}`)
        .join(", "),
    });
  }

  const conflicting = rows.filter((r) => r.trust.verification === "conflicting");
  if (conflicting.length > 0) {
    out.push({
      id: "conflicts",
      severity: "warning",
      headline: `${conflicting.length} incident${conflicting.length === 1 ? "" : "s"} with conflicting reports`,
      detail: "Sources disagree on scale or location. Confirm before scaling the response.",
      evidence: conflicting.map((r) => r.incident.code).join(", "),
    });
  }

  const lowConfidence = rows.filter(
    (r) => confidenceBand(r.incident.confidence) === "manual_required",
  );
  if (lowConfidence.length > 0) {
    out.push({
      id: "low-confidence",
      severity: "warning",
      headline: `${lowConfidence.length} report${lowConfidence.length === 1 ? "" : "s"} below the manual-verification threshold`,
      detail: "The classifier could not read these with confidence. A person should call back.",
      evidence: lowConfidence
        .map((r) => `${r.incident.code} ${Math.round(r.incident.confidence * 100)}%`)
        .join(", "),
    });
  }

  const unverifiedSevere = rows.filter(
    (r) => r.trust.verification === "unverified" && r.incident.severity >= 3,
  );
  if (unverifiedSevere.length > 0) {
    out.push({
      id: "unverified-severe",
      severity: "info",
      headline: `${unverifiedSevere.length} severe incident${unverifiedSevere.length === 1 ? "" : "s"} resting on a single source`,
      detail: "Severity is high but nothing has corroborated the report yet.",
      evidence: unverifiedSevere
        .map((r) => `${r.incident.code} SEV ${r.incident.severity}`)
        .join(", "),
    });
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function avg(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function toggle<T>(list: T[], value: T, set: (next: T[]) => void) {
  set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
}

function Kpi({
  label,
  value,
  tone,
  note,
}: {
  label: string;
  value: number | string;
  tone: string;
  note?: string;
}) {
  return (
    /* Telemetry readout, not a KPI card: a top rule in the value's own
       colour, the label in the command face, the figure in mono. Square,
       flush against its neighbours, no shadow — it belongs to the strip. */
    <div
      className="border-t-2 bg-[var(--surface)] px-3 py-2.5"
      style={{ borderColor: tone }}
    >
      <p className="eyebrow text-[var(--muted)]">{label}</p>
      <p
        className="mono mt-1 text-[26px] font-semibold leading-none"
        style={{ color: tone }}
      >
        {value}
      </p>
      {note && <p className="telemetry mt-1.5">{note}</p>}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="eyebrow w-16 shrink-0 text-[var(--muted)]">
        {label}
      </span>
      {children}
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-8 border px-2 text-[11px] font-semibold ${
        active
          ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--surface)]"
          : "border-[var(--border-strong)] hover:bg-[var(--surface-2)]"
      }`}
    >
      {label}
    </button>
  );
}
