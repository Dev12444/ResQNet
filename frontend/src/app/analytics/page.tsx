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
  INCIDENT_TYPE_META,
  PLATFORM_STRINGS,
  RESOURCE_KIND_META,
  RISK_META,
  RISK_ORDER,
  TYPE_LABEL_I18N,
  confidenceBand,
} from "@/lib/constants";
import { labels } from "@/lib/i18n";
import {
  computeShortages,
  getDistrictSituations,
  getEval,
  getHotspots,
  getIncidentsWithTrust,
  getPulse,
  getResourceViews,
  getShelters,
} from "@/lib/api";
import { pageStrings, type PageStrings } from "@/lib/pageStrings";
import { useLang } from "@/components/layout/LangProvider";
import { useEnvelope } from "@/components/layout/useEnvelope";
import {
  Badge,
  EmptyState,
  ErrorState,
  LoadingState,
  Panel,
  UnavailableState,
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

/** The period chips, in the interface language (`WINDOWS` keeps the English fallback). */
const WINDOW_LABEL = (t: PageStrings["analytics"]): Record<WindowId, string> => ({
  today: t.today,
  "7d": t.days7,
  "30d": t.days30,
  custom: t.custom,
});

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

/** One figure in the evaluation card. */
function EvalStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-r border-[var(--border)] px-3 py-2 last:border-r-0">
      <p className="text-[11px] uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mono mt-0.5 text-[20px] font-bold leading-none">{value}</p>
    </div>
  );
}

/**
 * Hotspots arrive as bare coordinates. A dispatcher reads district names, not
 * decimal degrees, so each cluster is named for the district centre nearest to
 * it. Plane geometry is accurate enough at this scale to pick a neighbour.
 */
function nearestDistrict(lat: number, lng: number): string {
  let best = GUJARAT_DISTRICTS[0];
  let bestD = Number.POSITIVE_INFINITY;
  for (const d of GUJARAT_DISTRICTS) {
    const dist = (d.lat - lat) ** 2 + (d.lng - lng) ** 2;
    if (dist < bestD) {
      bestD = dist;
      best = d;
    }
  }
  return best.name;
}

export default function AnalyticsPage() {
  const { lang } = useLang();
  const t = pageStrings(lang).analytics;
  const tc = pageStrings(lang).common;
  // Incident types come from BE2's enum; `TYPE_LABEL_I18N` is the translated map.
  const incidentTypeLabel = TYPE_LABEL_I18N[lang];
  const paired = useEnvelope(useCallback(() => getIncidentsWithTrust(), []));
  const situations = useEnvelope(useCallback(() => getDistrictSituations(), []));
  const shelters = useEnvelope(useCallback(() => getShelters(), []));
  const units = useEnvelope(useCallback(() => getResourceViews(), []));
  const pulse = useEnvelope(useCallback(() => getPulse(), []));
  /**
   * The two analytics endpoints the backend actually serves, read directly
   * rather than recomputed here. Everything else on this page is derived from
   * the incident rows in view, which is right for anything the filters should
   * affect — but the AI evaluation and the reporting hotspots are properties
   * of the whole corpus and of the model, not of the current selection, so
   * they come from the API and ignore the filters on purpose.
   */
  const evaluation = useEnvelope(useCallback(() => getEval(), []));
  const hotspots = useEnvelope(useCallback(() => getHotspots(), []));
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
          label: incidentTypeLabel[type as keyof typeof INCIDENT_TYPE_META],
          value: incidents.filter((i) => i.type === type).length,
        }))
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value),
    [incidents, incidentTypeLabel],
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
        label: incidentTypeLabel[type as keyof typeof INCIDENT_TYPE_META],
        dispatch: v.d.length ? avg(v.d) : null,
        resolve: v.r.length ? avg(v.r) : null,
      }))
      .filter((d) => d.dispatch !== null || d.resolve !== null);
  }, [incidents, incidentTypeLabel]);

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
        label: labels(lang).resourceKind[kind],
        committed: list.length - available,
        available,
      };
    });
  }, [scopedUnits, lang]);

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
    () => deriveInsights(rows, scopedSituations, scopedUnits, scopedShelters, now, t, labels(lang).resourceKind),
    [rows, scopedSituations, scopedUnits, scopedShelters, now, t, lang],
  );

  const filtersActive =
    districts.length > 0 ||
    disasters.length > 0 ||
    severities.length > 0 ||
    statuses.length > 0 ||
    windowId !== "30d";

  if (paired.loading && !paired.data) return <LoadingState label={t.loading} />;
  if (paired.error && !paired.data) {
    return (
      <div className="p-4">
        <ErrorState
          title={t.loadError}
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
          <p className="eyebrow mb-1 text-[var(--teal)]">{pageStrings(lang).misc.stateOperations}</p>
          <h1 className="cmd text-[24px] leading-none">{t.title}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {t.scope(incidents.length, paired.data?.length ?? 0, scopedSituations.length)}
          </p>
        </div>
        <DataModeBadge mode={paired.mode} note={paired.error} />
      </header>

      {/* KPIs */}
      <div className="mb-3 grid gap-px bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <Kpi label={t.activeIncidents} value={kpis.active} tone="var(--critical)" />
        <Kpi label={t.resolved} value={kpis.resolved} tone="var(--ok)" />
        <Kpi
          label={t.peopleAffected}
          value={kpis.affected.toLocaleString("en-IN")}
          tone="var(--foreground)"
        />
        <Kpi
          label={t.avgResponse}
          value={kpis.avgDispatch === null ? "—" : formatDuration(kpis.avgDispatch)}
          tone="var(--info)"
          note={kpis.avgDispatch === null ? t.noDispatches : t.reportToDispatch}
        />
        <Kpi label={t.teamsDeployed} value={kpis.teams} tone="var(--info)" />
        {/* These two read like measurements but are computed from fixtures,
            so the caption says so in the tile rather than only in a badge
            further down the page — a KPI is the thing people screenshot. */}
        <Kpi
          label={t.shelterOccupancy}
          value={kpis.shelterPct === null ? "—" : `${kpis.shelterPct}%`}
          tone={kpis.shelterPct !== null && kpis.shelterPct >= 85 ? "var(--high)" : "var(--ok)"}
          note={`${kpis.occupancy.toLocaleString("en-IN")} of ${kpis.capacity.toLocaleString(
            "en-IN",
          )}${shelters.mode === "live" ? "" : t.demoFigures}`}
        />
        <Kpi
          label={t.highestRisk}
          value={PLATFORM_STRINGS[lang].risk[kpis.worstRisk]}
          tone={RISK_META[kpis.worstRisk].color}
          note={[
            kpis.utilisation === null ? null : `Units committed: ${kpis.utilisation}%`,
            situations.mode === "live" ? null : t.demoDistrictRisk,
          ]
            .filter(Boolean)
            .join(" · ") || undefined}
        />
      </div>

      {/*
        AI evaluation and reporting hotspots, straight from /api/analytics/*.
        These are the only two panels on the page that are not derived from the
        filtered rows, because neither is a property of the selection.
      */}
      <div className="mb-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel
          title={t.accuracyTitle}
          subtitle={t.accuracyNote}
          actions={<DataModeBadge mode={evaluation.mode} note={evaluation.error} />}
        >
          {evaluation.mode === "unavailable" || !evaluation.data ? (
            <UnavailableState
              what={pageStrings(lang).primitives.what.evaluationRun}
              note={evaluation.error}
              onRetry={evaluation.reload}
            />
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4">
                <EvalStat
                  label={t.typeAccuracy}
                  value={`${Math.round(evaluation.data.type_accuracy * 100)}%`}
                />
                <EvalStat
                  label={t.severityWithin1}
                  value={`${Math.round(evaluation.data.severity_within_1 * 100)}%`}
                />
                <EvalStat
                  label={t.dedupPrecision}
                  value={`${Math.round(evaluation.data.dedup_precision * 100)}%`}
                />
                <EvalStat
                  label={t.dedupRecall}
                  value={`${Math.round(evaluation.data.dedup_recall * 100)}%`}
                />
              </div>
              <p className="border-t border-[var(--border)] px-3 py-1.5 text-[11px] text-[var(--muted)]">
                {evaluation.data.n.toLocaleString("en-IN")} labelled cases
                {evaluation.data.avg_latency_ms !== null &&
                  ` · ${Math.round(evaluation.data.avg_latency_ms)} ms average`}{" "}
                · run {new Date(evaluation.data.run_at).toLocaleString("en-IN")}
              </p>
              <p className="border-t border-[var(--border)] px-3 py-1.5 text-[11px] text-[var(--faint)]">
                Accuracy on a test set is not accuracy on the next real report.
                Every classification stays advisory and an operator confirms it.
              </p>
            </>
          )}
        </Panel>

        <Panel
          title={t.hotspots}
          subtitle={t.hotspotsNote}
          actions={<DataModeBadge mode={hotspots.mode} note={hotspots.error} />}
        >
          {hotspots.mode === "unavailable" ? (
            <UnavailableState
              what={pageStrings(lang).primitives.what.hotspotClusters}
              note={hotspots.error}
              onRetry={hotspots.reload}
            />
          ) : !hotspots.data || hotspots.data.length === 0 ? (
            <EmptyState title={t.noClusters} />
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {[...hotspots.data]
                .sort((a, b) => b.count - a.count)
                .slice(0, 6)
                .map((h) => {
                  const disaster = INCIDENT_TO_DISASTER[h.top_type] ?? "other";
                  const meta = DISASTER_META[disaster];
                  const share = h.count / Math.max(...hotspots.data!.map((x) => x.count));
                  return (
                    <li
                      key={`${h.lat},${h.lng}`}
                      className="flex items-center gap-2 px-3 py-1.5"
                    >
                      <span className="w-28 shrink-0 text-[12px] font-semibold">
                        {nearestDistrict(h.lat, h.lng)}
                      </span>
                      <span className="w-24 shrink-0 text-[11px] text-[var(--muted)]">
                        {pageStrings(lang).disaster[disaster]}
                      </span>
                      <span
                        className="h-2.5 min-w-[2px]"
                        style={{
                          width: `${Math.round(share * 100)}%`,
                          background: meta.color,
                        }}
                        aria-hidden
                      />
                      <span className="mono ml-auto shrink-0 text-[12px] font-bold">
                        {h.count}
                      </span>
                    </li>
                  );
                })}
            </ul>
          )}
        </Panel>
      </div>

      {/* Filters */}
      <Panel title={t.filters} className="mb-3">
        <div className="space-y-2 px-3 py-2.5">
          <FilterRow label={t.period}>
            {WINDOWS.map((w) => (
              <Chip
                key={w.id}
                label={WINDOW_LABEL(t)[w.id]}
                active={windowId === w.id}
                onClick={() => setWindowId(w.id)}
              />
            ))}
            {windowId === "custom" && (
              <label className="flex items-center gap-1.5 text-xs">
                <span className="sr-only">{t.customDays}</span>
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

          <FilterRow label={tc.district}>
            {GUJARAT_DISTRICTS.map((d) => (
              <Chip
                key={d.id}
                label={d.name}
                active={districts.includes(d.name)}
                onClick={() => toggle(districts, d.name, setDistricts)}
              />
            ))}
          </FilterRow>

          <FilterRow label={t.disaster}>
            {(Object.keys(DISASTER_META) as DisasterType[])
              .filter((d) => d !== "heavy_rainfall" && d !== "missing_person")
              .map((d) => (
                <Chip
                  key={d}
                  label={pageStrings(lang).disaster[d]}
                  active={disasters.includes(d)}
                  onClick={() => toggle(disasters, d, setDisasters)}
                />
              ))}
          </FilterRow>

          <FilterRow label={t.severity}>
            {SEVERITIES.map((s) => (
              <Chip
                key={s}
                label={`SEV ${s} · ${labels(lang).severity[s]}`}
                active={severities.includes(s)}
                onClick={() => toggle(severities, s, setSeverities)}
              />
            ))}
          </FilterRow>

          <FilterRow label={t.status}>
            {STATUSES.map((s) => (
              <Chip
                key={s}
                label={labels(lang).incidentStatus[s]}
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
        title={t.observations}
        subtitle={t.observationsNote}
        className="mb-3"
      >
        {insights.length === 0 ? (
          <EmptyState title={t.nothingNotable} />
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {insights.map((i) => (
              <li key={i.id} className="flex flex-wrap gap-x-3 gap-y-1 px-3 py-2">
                <Badge
                  label={t.insightSeverity[i.severity]}
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
        <Panel title={t.trend} subtitle={t.trendNote}>
          <div className="px-2 py-2">
            <IncidentTrend data={trend} />
          </div>
        </Panel>

        <Panel title={t.incidentType} subtitle={t.incidentTypeNote}>
          <div className="px-2 py-2">
            <CategoryBars data={byType} valueLabel={t.table.incidents} />
          </div>
        </Panel>

        <Panel
          title={t.districtRisk}
          subtitle={t.districtRiskNote}
        >
          <div className="px-2 py-2">
            <DistrictRisk data={riskSeries} />
          </div>
        </Panel>

        <Panel
          title={t.responseTime}
          subtitle={t.responseTimeNote}
        >
          <div className="px-2 py-2">
            <ResponseTimeChart data={responseByType} />
            <p className="px-1 pt-1 text-[11px] text-[var(--muted)]">
              {t.noTriageNote}
            </p>
          </div>
        </Panel>

        {/* Shelters, pulse and the district table are drawn from fixtures:
            the API has no /api/shelters, /api/pulse or /api/districts/situation,
            so these three panels never become live no matter what the backend
            is doing. They carry their provenance badge for the same reason the
            live panels do — a chart that cannot say where its numbers came
            from is a chart nobody should quote. */}
        <Panel
          title={t.shelterCapacity}
          subtitle={t.shelterCapacityNote}
          actions={<DataModeBadge mode={shelters.mode} note={shelters.error} />}
        >
          <div className="px-2 py-2">
            <ShelterCapacity data={shelterSeries} />
          </div>
        </Panel>

        <Panel title={t.utilisation} subtitle={t.utilisationNote}>
          <div className="px-2 py-2">
            <ResourceUtilization data={utilisationSeries} />
          </div>
        </Panel>

        <Panel
          title={t.pulseDistribution}
          subtitle={t.pulseDistributionNote}
          actions={<DataModeBadge mode={pulse.mode} note={pulse.error} />}
        >
          <div className="px-2 py-2">
            <PulseDistribution data={pulseSeries} />
          </div>
        </Panel>

        <Panel
          title={t.districtComparison}
          actions={<DataModeBadge mode={situations.mode} note={situations.error} />}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <caption className="sr-only">{t.districtTableCaption}</caption>
              <thead>
                <tr className="border-b-2 border-[var(--border-strong)] text-left">
                  {[t.table.district, t.table.risk, t.table.incidents, t.table.shelters,
                    t.table.teams, t.table.affected, t.table.avgDispatch].map(
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
                        {PLATFORM_STRINGS[lang].risk[d.risk]}
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
  t: PageStrings["analytics"],
  kindLabel: Record<keyof typeof RESOURCE_KIND_META, string>,
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
      headline: t.insight.p1NotDispatched(undispatchedP1.length),
      detail: t.insight.waitingLongest(oldest.incident.code),
      evidence: `${oldest.incident.code} · ${t.insight.minutes(Math.round((clock - Date.parse(oldest.incident.created_at)) / 60000))} · ${oldest.incident.address}`,
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
      headline: t.insight.shortage(kindLabel[s.kind]),
      detail: s.available === 0 ? t.insight.shortageNone : t.insight.shortageSome,
      evidence: t.insight.shortageEvidence(s.required, s.available, s.shortage),
    });
  }

  const critical = situations.filter((s) => s.risk === "critical");
  if (critical.length > 0) {
    out.push({
      id: "critical-districts",
      severity: "critical",
      headline: t.insight.criticalDistricts(critical.length),
      detail: t.insight.criticalDistrictsNote,
      evidence: critical
        .map((s) => `${s.district} (${t.insight.sheltersOpen(s.sheltersOpen)})`)
        .join(", "),
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
      headline: t.insight.sheltersFull(full.length, nearFull.length),
      detail: t.insight.sheltersFullNote,
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
      headline: t.insight.conflicting(conflicting.length),
      detail: t.insight.conflictingNote,
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
      headline: t.insight.lowConfidence(lowConfidence.length),
      detail: t.insight.lowConfidenceNote,
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
      headline: t.insight.unverifiedSevere(unverifiedSevere.length),
      detail: t.insight.unverifiedSevereNote,
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
