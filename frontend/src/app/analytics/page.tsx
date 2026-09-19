"use client";

/**
 * `/analytics` — operational analytics. Desktop/tablet first.
 *
 * Owner: FE2.
 *
 * Filters are applied to the incident set on the client and every chart is
 * recomputed from the filtered set, so a filter is never decorative. Where a
 * figure genuinely cannot be derived from the contract (see the triage-time
 * note below), the panel says so instead of showing a plausible number.
 */

import { useCallback, useMemo, useState } from "react";
import type {
  AnalyticsFilters,
  Incident,
  IncidentTrust,
  IncidentType,
  OperationalInsight,
  ReportSource,
  ResourceKind,
  Severity,
  VerificationStatus,
} from "@/types";
import {
  DISTRICTS,
  INCIDENT_TYPE_META,
  RESOURCE_KIND_META,
  SEVERITY_LABEL,
  SOURCE_META,
  VERIFICATION_META,
  confidenceBand,
} from "@/lib/constants";
import {
  computeShortages,
  getEval,
  getHotspots,
  getIncidentsWithTrust,
  getResourceViews,
  getResponseTimes,
} from "@/lib/api";
import { useEnvelope } from "@/components/layout/useEnvelope";
import {
  Badge,
  EmptyState,
  ErrorState,
  LoadingState,
  Panel,
} from "@/components/layout/primitives";
import { DataModeBadge } from "@/components/layout/ConnectionBar";
import { formatDuration } from "@/components/charts/chartTheme";
import {
  CategoryBars,
  GroupedBars,
  SeverityBars,
  TimelineChart,
} from "@/components/charts/Charts";

const TYPES = Object.keys(INCIDENT_TYPE_META) as IncidentType[];
const SEVERITIES: Severity[] = [1, 2, 3, 4, 5];
const VERIFICATIONS = Object.keys(VERIFICATION_META) as VerificationStatus[];
const SOURCES = Object.keys(SOURCE_META) as ReportSource[];
const KINDS = Object.keys(RESOURCE_KIND_META) as ResourceKind[];

/** Time windows offered by the date filter, in hours before now. */
const WINDOWS: { label: string; hours: number | null }[] = [
  { label: "All data", hours: null },
  { label: "Last 1 h", hours: 1 },
  { label: "Last 6 h", hours: 6 },
  { label: "Last 24 h", hours: 24 },
];

const EMPTY_FILTERS: AnalyticsFilters = {
  since: null,
  until: null,
  districts: [],
  types: [],
  severities: [],
  verifications: [],
  sources: [],
  resourceKinds: [],
};

export default function AnalyticsPage() {
  const paired = useEnvelope(useCallback(() => getIncidentsWithTrust(), []));
  const units = useEnvelope(useCallback(() => getResourceViews(), []));
  const responseTimes = useEnvelope(useCallback(() => getResponseTimes(), []));
  const hotspots = useEnvelope(useCallback(() => getHotspots(), []));
  const evalResult = useEnvelope(useCallback(() => getEval(), []));

  const [filters, setFilters] = useState<AnalyticsFilters>(EMPTY_FILTERS);
  const [windowHours, setWindowHours] = useState<number | null>(null);

  /* ---------------- filtering ---------------- */

  const districtOf = useCallback(
    (incident: Incident): string => {
      const match = DISTRICTS.find((d) => incident.address.includes(d));
      return match ?? "Ahmedabad";
    },
    [],
  );

  const rows = useMemo(() => {
    const all = paired.data ?? [];
    const cutoff =
      windowHours === null
        ? null
        : Date.parse(all[0]?.incident.updated_at ?? new Date().toISOString()) -
          windowHours * 3600_000;

    return all.filter(({ incident, trust }) => {
      if (cutoff !== null && Date.parse(incident.created_at) < cutoff) return false;
      if (filters.types.length && !filters.types.includes(incident.type)) return false;
      if (filters.severities.length && !filters.severities.includes(incident.severity)) {
        return false;
      }
      if (filters.verifications.length && !filters.verifications.includes(trust.verification)) {
        return false;
      }
      if (filters.districts.length && !filters.districts.includes(districtOf(incident))) {
        return false;
      }
      if (filters.sources.length) {
        // Keep incidents that carry at least one report from a selected source.
        const hasSource = filters.sources.some((s) => trust.sources[s] > 0);
        if (!hasSource) return false;
      }
      return true;
    });
  }, [paired.data, filters, windowHours, districtOf]);

  const filteredIncidents = useMemo(() => rows.map((r) => r.incident), [rows]);

  /** Resource filter narrows the unit set, not the incident set. */
  const filteredUnits = useMemo(() => {
    const all = units.data ?? [];
    return filters.resourceKinds.length
      ? all.filter((u) => filters.resourceKinds.includes(u.kind))
      : all;
  }, [units.data, filters.resourceKinds]);

  /* ---------------- derived series ---------------- */

  const byType = useMemo(
    () =>
      TYPES.map((type) => ({
        label: INCIDENT_TYPE_META[type].label,
        value: filteredIncidents.filter((i) => i.type === type).length,
      })).filter((d) => d.value > 0),
    [filteredIncidents],
  );

  const bySeverity = useMemo(
    () =>
      SEVERITIES.map((severity) => ({
        severity,
        count: filteredIncidents.filter((i) => i.severity === severity).length,
      })),
    [filteredIncidents],
  );

  const byVerification = useMemo(
    () =>
      VERIFICATIONS.map((v) => ({
        label: VERIFICATION_META[v].label,
        value: rows.filter((r) => r.trust.verification === v).length,
      })).filter((d) => d.value > 0),
    [rows],
  );

  const bySource = useMemo(() => {
    const totals: Record<ReportSource, number> = { citizen: 0, call: 0, sensor: 0, field: 0 };
    for (const { trust } of rows) {
      for (const s of SOURCES) totals[s] += trust.sources[s];
    }
    return SOURCES.map((s) => ({ label: SOURCE_META[s].label, value: totals[s] })).filter(
      (d) => d.value > 0,
    );
  }, [rows]);

  const timeline = useMemo(() => {
    if (filteredIncidents.length === 0) return [];
    // Bucket per 5 minutes across the filtered window.
    const buckets = new Map<number, { incidents: number; reports: number }>();
    for (const incident of filteredIncidents) {
      const key = Math.floor(Date.parse(incident.created_at) / 300_000) * 300_000;
      const entry = buckets.get(key) ?? { incidents: 0, reports: 0 };
      entry.incidents += 1;
      entry.reports += incident.report_count;
      buckets.set(key, entry);
    }
    return [...buckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([t, v]) => ({ t: new Date(t).toISOString(), ...v }));
  }, [filteredIncidents]);

  /** Report → dispatch and report → resolution, computed per incident type. */
  const responseByType = useMemo(() => {
    const groups = new Map<IncidentType, { dispatch: number[]; resolve: number[] }>();
    for (const incident of filteredIncidents) {
      const entry = groups.get(incident.type) ?? { dispatch: [], resolve: [] };
      const created = Date.parse(incident.created_at);
      if (incident.dispatched_at) {
        entry.dispatch.push((Date.parse(incident.dispatched_at) - created) / 1000);
      }
      if (incident.resolved_at) {
        entry.resolve.push((Date.parse(incident.resolved_at) - created) / 1000);
      }
      groups.set(incident.type, entry);
    }
    return [...groups.entries()]
      .map(([type, v]) => ({
        label: INCIDENT_TYPE_META[type].label,
        a: v.dispatch.length ? avg(v.dispatch) : null,
        b: v.resolve.length ? avg(v.resolve) : null,
      }))
      .filter((d) => d.a !== null || d.b !== null);
  }, [filteredIncidents]);

  const shortages = useMemo(
    () =>
      filteredUnits.length
        ? computeShortages(filteredIncidents, filteredUnits).filter((s) => s.required > 0)
        : [],
    [filteredIncidents, filteredUnits],
  );

  const districtStats = useMemo(() => {
    const groups = new Map<
      string,
      { incidents: number; p1: number; resolved: number; dispatch: number[] }
    >();
    for (const incident of filteredIncidents) {
      const d = districtOf(incident);
      const entry = groups.get(d) ?? { incidents: 0, p1: 0, resolved: 0, dispatch: [] };
      entry.incidents += 1;
      if (incident.priority === "P1") entry.p1 += 1;
      if (incident.status === "resolved") entry.resolved += 1;
      if (incident.dispatched_at) {
        entry.dispatch.push(
          (Date.parse(incident.dispatched_at) - Date.parse(incident.created_at)) / 1000,
        );
      }
      groups.set(d, entry);
    }
    return [...groups.entries()]
      .map(([district, v]) => ({
        district,
        incidents: v.incidents,
        p1: v.p1,
        resolved: v.resolved,
        avgDispatch: v.dispatch.length ? avg(v.dispatch) : null,
      }))
      .sort((a, b) => b.incidents - a.incidents);
  }, [filteredIncidents, districtOf]);

  const insights = useMemo(
    () => deriveInsights(rows, shortages, districtOf),
    [rows, shortages, districtOf],
  );

  const filtersActive =
    windowHours !== null ||
    filters.types.length > 0 ||
    filters.severities.length > 0 ||
    filters.verifications.length > 0 ||
    filters.districts.length > 0 ||
    filters.sources.length > 0 ||
    filters.resourceKinds.length > 0;

  function toggle<K extends keyof AnalyticsFilters>(
    key: K,
    value: AnalyticsFilters[K] extends (infer U)[] ? U : never,
  ) {
    setFilters((prev) => {
      const list = prev[key] as unknown[];
      const next = list.includes(value)
        ? list.filter((v) => v !== value)
        : [...list, value];
      return { ...prev, [key]: next };
    });
  }

  if (paired.loading && !paired.data) return <LoadingState label="Loading analytics…" />;
  if (paired.error && !paired.data) {
    return (
      <div className="mx-auto w-full max-w-7xl px-3 py-4">
        <ErrorState
          title="Could not load analytics"
          detail={paired.error}
          onRetry={paired.reload}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-4">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-[var(--muted)]">
            {filteredIncidents.length} of {paired.data?.length ?? 0} incidents in view
          </p>
        </div>
        <DataModeBadge mode={paired.mode} note={paired.error} />
      </header>

      {/* Filters — one row above the charts, all of them wired. */}
      <Panel title="Filters" className="mb-3">
        <div className="space-y-2 px-3 py-2.5">
          <FilterRow label="Window">
            {WINDOWS.map((w) => (
              <Chip
                key={w.label}
                label={w.label}
                active={windowHours === w.hours}
                onClick={() => setWindowHours(w.hours)}
              />
            ))}
          </FilterRow>
          <FilterRow label="District">
            {DISTRICTS.map((d) => (
              <Chip
                key={d}
                label={d}
                active={filters.districts.includes(d)}
                onClick={() => toggle("districts", d)}
              />
            ))}
          </FilterRow>
          <FilterRow label="Type">
            {TYPES.map((t) => (
              <Chip
                key={t}
                label={INCIDENT_TYPE_META[t].label}
                active={filters.types.includes(t)}
                onClick={() => toggle("types", t)}
              />
            ))}
          </FilterRow>
          <FilterRow label="Severity">
            {SEVERITIES.map((s) => (
              <Chip
                key={s}
                label={`SEV ${s}`}
                active={filters.severities.includes(s)}
                onClick={() => toggle("severities", s)}
              />
            ))}
          </FilterRow>
          <FilterRow label="Verification">
            {VERIFICATIONS.map((v) => (
              <Chip
                key={v}
                label={VERIFICATION_META[v].label}
                active={filters.verifications.includes(v)}
                onClick={() => toggle("verifications", v)}
              />
            ))}
          </FilterRow>
          <FilterRow label="Source">
            {SOURCES.map((s) => (
              <Chip
                key={s}
                label={SOURCE_META[s].label}
                active={filters.sources.includes(s)}
                onClick={() => toggle("sources", s)}
              />
            ))}
          </FilterRow>
          <FilterRow label="Resource">
            {KINDS.map((k) => (
              <Chip
                key={k}
                label={RESOURCE_KIND_META[k].label}
                active={filters.resourceKinds.includes(k)}
                onClick={() => toggle("resourceKinds", k)}
              />
            ))}
          </FilterRow>
          {filtersActive && (
            <button
              type="button"
              onClick={() => {
                setFilters(EMPTY_FILTERS);
                setWindowHours(null);
              }}
              className="min-h-9 border border-[var(--border-strong)] px-2.5 text-xs font-semibold"
            >
              Clear all filters
            </button>
          )}
        </div>
      </Panel>

      {/* Insights, derived from the filtered set. */}
      <Panel
        title="Observations"
        subtitle="Computed from the incidents currently in view."
        className="mb-3"
      >
        {insights.length === 0 ? (
          <EmptyState title="Nothing notable in this selection" />
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {insights.map((insight) => (
              <li key={insight.id} className="flex flex-wrap gap-x-3 gap-y-1 px-3 py-2">
                <Badge
                  label={insight.severity}
                  color={
                    insight.severity === "critical"
                      ? "var(--critical)"
                      : insight.severity === "warning"
                        ? "var(--high)"
                        : "var(--info)"
                  }
                  variant="tint"
                />
                <div className="min-w-56 flex-1">
                  <p className="text-sm font-semibold">{insight.headline}</p>
                  <p className="text-sm text-[var(--muted)]">{insight.detail}</p>
                  <p className="mono mt-0.5 text-xs text-[var(--faint)]">{insight.evidence}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Incidents by type">
          <div className="px-2 py-2">
            <CategoryBars data={byType} valueLabel="Incidents" />
          </div>
        </Panel>

        <Panel
          title="Severity mix"
          subtitle="Severity on the axis; colour is a redundant cue, not the only one."
        >
          <div className="px-2 py-2">
            <SeverityBars data={bySeverity} />
          </div>
        </Panel>

        <Panel title="Incidents and reports over time">
          <div className="px-2 py-2">
            <TimelineChart data={timeline} />
          </div>
        </Panel>

        <Panel
          title="Verification mix"
          subtitle="How well corroborated the incidents in view are."
        >
          <div className="px-2 py-2">
            <CategoryBars data={byVerification} valueLabel="Incidents" height={160} />
          </div>
        </Panel>

        <Panel title="Reports by source" subtitle="Counts reports, not unique reporters.">
          <div className="px-2 py-2">
            <CategoryBars data={bySource} valueLabel="Reports" height={160} />
          </div>
        </Panel>

        <Panel
          title="Response times by type"
          subtitle="Report → dispatch and report → resolution, from incident timestamps."
        >
          <div className="px-2 py-2">
            <GroupedBars
              data={responseByType}
              seriesA="Report → dispatch"
              seriesB="Report → resolved"
              asDuration
            />
          </div>
        </Panel>

        <Panel
          title="Dispatch → on scene"
          subtitle="From the backend analytics endpoint — not affected by the filters above."
          actions={<DataModeBadge mode={responseTimes.mode} note={responseTimes.error} />}
        >
          <div className="px-2 py-2">
            {responseTimes.loading && !responseTimes.data ? (
              <LoadingState />
            ) : (
              <GroupedBars
                data={(responseTimes.data?.by_type ?? []).map((r) => ({
                  label: INCIDENT_TYPE_META[r.type].label,
                  a: r.avg_dispatch_sec,
                  b: r.avg_scene_sec,
                }))}
                seriesA="Avg dispatch"
                seriesB="Avg on scene"
                asDuration
              />
            )}
            <p className="mt-2 text-xs text-[var(--muted)]">
              Report → triage time is not shown: the incident contract has no `triaged_at`
              timestamp, so it cannot be derived. Raised with BE1.
            </p>
          </div>
        </Panel>

        <Panel
          title="Capability demand"
          subtitle="Required counts each open incident's needed unit types against units available."
        >
          {shortages.length === 0 ? (
            <EmptyState title="No open demand in this selection" />
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {shortages.map((s) => (
                <li key={s.kind} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <span className="min-w-28 text-sm font-semibold">
                    {RESOURCE_KIND_META[s.kind].label}
                  </span>
                  <span className="mono text-sm text-[var(--muted)]">
                    Required {s.required} · Available {s.available}
                  </span>
                  {s.shortage > 0 ? (
                    <Badge label={`SHORTAGE ${s.shortage}`} color="var(--critical)" />
                  ) : (
                    <Badge label="COVERED" color="var(--ok)" variant="tint" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* District comparison — a table, because it is four measures per row. */}
      <Panel title="District comparison" className="mt-3">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <caption className="sr-only">Incident counts and dispatch times per district</caption>
            <thead>
              <tr className="border-b-2 border-[var(--border-strong)] text-left">
                <th scope="col" className="px-2 py-1.5 text-xs font-semibold uppercase">District</th>
                <th scope="col" className="px-2 py-1.5 text-xs font-semibold uppercase">Incidents</th>
                <th scope="col" className="px-2 py-1.5 text-xs font-semibold uppercase">P1</th>
                <th scope="col" className="px-2 py-1.5 text-xs font-semibold uppercase">Resolved</th>
                <th scope="col" className="px-2 py-1.5 text-xs font-semibold uppercase">Avg dispatch</th>
              </tr>
            </thead>
            <tbody>
              {districtStats.map((d) => (
                <tr key={d.district} className="border-b border-[var(--border)]">
                  <td className="px-2 py-1.5">{d.district}</td>
                  <td className="mono px-2 py-1.5">{d.incidents}</td>
                  <td className="mono px-2 py-1.5">{d.p1}</td>
                  <td className="mono px-2 py-1.5">{d.resolved}</td>
                  <td className="mono px-2 py-1.5">{formatDuration(d.avgDispatch)}</td>
                </tr>
              ))}
              {districtStats.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-2 py-4 text-center text-[var(--muted)]">
                    No incidents in this selection.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Panel
          title="Reported incident hotspots"
          subtitle="Where reports cluster — reporting density, not validated risk."
          actions={<DataModeBadge mode={hotspots.mode} note={hotspots.error} />}
        >
          {hotspots.loading && !hotspots.data ? (
            <LoadingState />
          ) : (
            <>
              <CategoryBars
                data={(hotspots.data ?? []).map((h) => ({
                  label: `${h.lat.toFixed(3)}, ${h.lng.toFixed(3)}`,
                  value: h.count,
                }))}
                valueLabel="Reports"
              />
              <p className="px-3 pb-3 text-xs text-[var(--muted)]">
                A cluster means people reported from there. Areas with fewer reports are not
                necessarily safer — they may simply report less.
              </p>
            </>
          )}
        </Panel>

        <Panel
          title="Classifier evaluation"
          subtitle="From BE2's last eval run over the labelled set."
          actions={<DataModeBadge mode={evalResult.mode} note={evalResult.error} />}
        >
          {evalResult.data ? (
            <dl className="grid grid-cols-2 gap-px bg-[var(--border)]">
              <Stat label="Type accuracy" value={pct(evalResult.data.type_accuracy)} />
              <Stat label="Severity ±1" value={pct(evalResult.data.severity_within_1)} />
              <Stat label="Dedup precision" value={pct(evalResult.data.dedup_precision)} />
              <Stat label="Dedup recall" value={pct(evalResult.data.dedup_recall)} />
              <Stat label="Avg latency" value={`${evalResult.data.avg_latency_ms} ms`} />
              <Stat label="Examples" value={String(evalResult.data.n)} />
            </dl>
          ) : (
            <EmptyState title="No eval results yet" hint="BE2 publishes these after a run." />
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Insight derivation                                                  */
/* ------------------------------------------------------------------ */

/**
 * Concrete observations only. Each one names the numbers it came from so a
 * reader can check it — no generic commentary.
 */
function deriveInsights(
  rows: { incident: Incident; trust: IncidentTrust }[],
  shortages: { kind: ResourceKind; required: number; available: number; shortage: number }[],
  districtOf: (incident: Incident) => string,
): OperationalInsight[] {
  const out: OperationalInsight[] = [];
  const now = Math.max(...rows.map((r) => Date.parse(r.incident.updated_at)), Date.now());

  // P1 incidents still undispatched.
  const undispatchedP1 = rows.filter(
    (r) => r.incident.priority === "P1" && r.incident.dispatched_at === null,
  );
  if (undispatchedP1.length > 0) {
    const oldest = undispatchedP1.reduce((a, b) =>
      Date.parse(a.incident.created_at) < Date.parse(b.incident.created_at) ? a : b,
    );
    const waited = Math.round((now - Date.parse(oldest.incident.created_at)) / 60000);
    out.push({
      id: "sla",
      kind: "sla_breach",
      severity: "critical",
      headline: `${undispatchedP1.length} P1 incident${undispatchedP1.length === 1 ? "" : "s"} not yet dispatched`,
      detail: `${oldest.incident.code} has been waiting longest.`,
      evidence: `${oldest.incident.code} · created ${waited} min ago · ${oldest.incident.address}`,
    });
  }

  // Unmet capability demand.
  for (const s of shortages.filter((s) => s.shortage > 0)) {
    out.push({
      id: `shortage-${s.kind}`,
      kind: "shortage",
      severity: s.available === 0 ? "critical" : "warning",
      headline: `${RESOURCE_KIND_META[s.kind].label} shortage`,
      detail:
        s.available === 0
          ? `No ${RESOURCE_KIND_META[s.kind].label.toLowerCase()} units are available anywhere in view.`
          : `Open incidents need more units of this type than are free.`,
      evidence: `Required ${s.required} · Available ${s.available} · Shortage ${s.shortage}`,
    });
  }

  // Incidents whose sources disagree.
  const conflicting = rows.filter((r) => r.trust.verification === "conflicting");
  if (conflicting.length > 0) {
    out.push({
      id: "conflicts",
      kind: "conflict",
      severity: "warning",
      headline: `${conflicting.length} incident${conflicting.length === 1 ? "" : "s"} with conflicting reports`,
      detail: "Sources disagree on scale or location. Field confirmation needed before scaling the response.",
      evidence: conflicting.map((r) => r.incident.code).join(", "),
    });
  }

  // Classifications a human should look at.
  const lowConfidence = rows.filter(
    (r) => confidenceBand(r.incident.confidence) === "manual_required",
  );
  if (lowConfidence.length > 0) {
    out.push({
      id: "low-confidence",
      kind: "coverage",
      severity: "warning",
      headline: `${lowConfidence.length} report${lowConfidence.length === 1 ? "" : "s"} below the manual-verification threshold`,
      detail: "The classifier could not read these with confidence. A person should call back.",
      evidence: lowConfidence
        .map((r) => `${r.incident.code} ${Math.round(r.incident.confidence * 100)}%`)
        .join(", "),
    });
  }

  // Uncorroborated incidents at high severity.
  const unverifiedSevere = rows.filter(
    (r) => r.trust.verification === "unverified" && r.incident.severity >= 3,
  );
  if (unverifiedSevere.length > 0) {
    out.push({
      id: "unverified-severe",
      kind: "coverage",
      severity: "info",
      headline: `${unverifiedSevere.length} severe incident${unverifiedSevere.length === 1 ? "" : "s"} resting on a single source`,
      detail: "Severity is high but nothing has corroborated the report yet.",
      evidence: unverifiedSevere
        .map((r) => `${r.incident.code} SEV ${r.incident.severity} (${SEVERITY_LABEL[r.incident.severity]})`)
        .join(", "),
    });
  }

  // Concentration of one type in one district.
  const floodByDistrict = new Map<string, number>();
  for (const r of rows.filter((r) => r.incident.type === "flood")) {
    const d = districtOf(r.incident);
    floodByDistrict.set(d, (floodByDistrict.get(d) ?? 0) + r.incident.report_count);
  }
  const topFlood = [...floodByDistrict.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topFlood && topFlood[1] >= 5) {
    out.push({
      id: "flood-trend",
      kind: "trend",
      severity: "warning",
      headline: `Flood reporting concentrated in ${topFlood[0]}`,
      detail: "The largest share of flood-related reports in view comes from this district.",
      evidence: `${topFlood[1]} of ${[...floodByDistrict.values()].reduce((a, b) => a + b, 0)} flood reports, across ${floodByDistrict.size} district${floodByDistrict.size === 1 ? "" : "s"}`,
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

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--surface)] px-3 py-2">
      <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</dt>
      <dd className="mono mt-0.5 text-lg font-semibold">{value}</dd>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
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
      className={`min-h-8 border px-2 text-xs font-semibold ${
        active
          ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--surface)]"
          : "border-[var(--border-strong)] hover:bg-[var(--surface-2)]"
      }`}
    >
      {label}
    </button>
  );
}
