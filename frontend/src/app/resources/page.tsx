"use client";

/**
 * `/resources` — units, facilities and sensors. Desktop/tablet first.
 *
 * Owner: FE2.
 */

import { pageStrings } from "@/lib/pageStrings";
import { labels } from "@/lib/i18n";
import { useLang } from "@/components/layout/LangProvider";
import { useCallback, useMemo, useState } from "react";
import type { ResourceKind } from "@/types";
import {
  DISTRICTS,
  RESOURCE_VIEW_STATUSES,
  type ResourceViewStatus,
} from "@/lib/constants";
import {
  computeShortages,
  getFacilityViews,
  getIncidents,
  getResourceViews,
  getSensors,
} from "@/lib/api";
import { useEnvelope } from "@/components/layout/useEnvelope";
import {
  Badge,
  ErrorState,
  UnavailableState,
  LoadingState,
  Panel,
  PartialDataNote,
} from "@/components/layout/primitives";
import { DataModeBadge } from "@/components/layout/ConnectionBar";
import { UnitsTable, viewStatus } from "./UnitsTable";
import { FacilitiesPanel, SensorsPanel } from "./FacilitiesAndSensors";

const KINDS: ResourceKind[] = [
  "ambulance",
  "fire_truck",
  "rescue_boat",
  "ndrf_team",
  "hazmat",
  "police",
];

export default function ResourcesPage() {
  const { lang } = useLang();
  const t = pageStrings(lang).resources;
  const enums = labels(lang);
  const tc = pageStrings(lang).common;
  const units = useEnvelope(useCallback(() => getResourceViews(), []));
  const facilities = useEnvelope(useCallback(() => getFacilityViews(), []));
  const sensors = useEnvelope(useCallback(() => getSensors(), []));
  const incidents = useEnvelope(useCallback(() => getIncidents(), []));

  const [query, setQuery] = useState("");
  const [kinds, setKinds] = useState<ResourceKind[]>([]);
  const [statuses, setStatuses] = useState<ResourceViewStatus[]>([]);
  const [district, setDistrict] = useState<string>("");

  const filteredUnits = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (units.data ?? []).filter((u) => {
      if (kinds.length && !kinds.includes(u.kind)) return false;
      if (statuses.length && !statuses.includes(viewStatus(u))) return false;
      if (district && u.district !== district) return false;
      if (!q) return true;
      // Search covers callsign, base, district and capability text.
      return [u.callsign, u.base, u.district, ...u.capabilities]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [units.data, query, kinds, statuses, district]);

  const filteredFacilities = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (facilities.data ?? []).filter((f) => {
      if (district && f.district !== district) return false;
      if (!q) return true;
      return `${f.name} ${f.district} ${f.specialties.join(" ")}`.toLowerCase().includes(q);
    });
  }, [facilities.data, query, district]);

  const filteredSensors = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (sensors.data ?? []).filter((s) => {
      if (district && s.district !== district) return false;
      if (!q) return true;
      return `${s.id} ${s.label} ${s.district} ${s.metric}`.toLowerCase().includes(q);
    });
  }, [sensors.data, query, district]);

  const shortages = useMemo(
    () =>
      incidents.data && units.data
        ? computeShortages(incidents.data, units.data).filter(
            (s) => s.required > 0 || s.shortage > 0,
          )
        : [],
    [incidents.data, units.data],
  );

  const filtersActive =
    query.trim() !== "" || kinds.length > 0 || statuses.length > 0 || district !== "";

  function toggle<T>(list: T[], value: T, set: (next: T[]) => void) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  if (units.loading && !units.data) return <LoadingState label={t.loading} />;

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-4">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-2 border-l-2 border-[var(--teal)] pl-3">
        <div>
          <h1 className="cmd text-[24px] leading-none">{t.title}</h1>
          <p className="text-sm text-[var(--muted)]">
            {t.lead}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DataModeBadge mode={units.mode} note={units.error} />
          <button
            type="button"
            onClick={() => {
              units.reload();
              facilities.reload();
              sensors.reload();
              incidents.reload();
            }}
            className="min-h-9 border border-[var(--border-strong)] px-2.5 text-xs font-semibold hover:bg-[var(--surface-2)]"
          >
            {units.refreshing ? t.refreshing : t.refresh}
          </button>
        </div>
      </header>

      {units.error && units.data && (
        <div className="mb-3">
          <PartialDataNote what={units.error} />
        </div>
      )}
      {units.error && !units.data && (
        <ErrorState title={t.loadErrorTitle} detail={units.error} onRetry={units.reload} />
      )}

      {/* Shortages — demand from open incidents against what is actually free. */}
      {shortages.length > 0 && (
        <Panel
          title={t.capabilityDemand}
          subtitle={t.demandNote}
          className="mb-3"
        >
          <ul className="grid gap-px bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-3">
            {shortages.map((s) => (
              <li key={s.kind} className="bg-[var(--surface)] px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold">
                    {enums.resourceKind[s.kind]}
                  </span>
                  {s.shortage > 0 ? (
                    <Badge label={`SHORTAGE ${s.shortage}`} color="var(--critical)" />
                  ) : (
                    <Badge label={t.covered} color="var(--ok)" variant="tint" />
                  )}
                </div>
                <p className="mono mt-1 text-sm text-[var(--muted)]">
                  Required {s.required} · Available {s.available}
                  {s.shortage > 0 && (
                    <>
                      {" "}
                      · <strong style={{ color: "var(--critical)" }}>SHORTAGE {s.shortage}</strong>
                    </>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* Filters — all of these actually apply to the lists below. */}
      <Panel title={t.filter} className="mb-3">
        <div className="space-y-2.5 px-3 py-2.5">
          <div className="flex flex-wrap gap-2">
            <label className="min-w-56 flex-1">
              <span className="sr-only">{t.searchLabel}</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="min-h-10 w-full border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-sm"
              />
            </label>
            <label>
              <span className="sr-only">{tc.district}</span>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="min-h-10 border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-sm"
              >
                <option value="">{tc.allDistricts}</option>
                {DISTRICTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            {filtersActive && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setKinds([]);
                  setStatuses([]);
                  setDistrict("");
                }}
                className="min-h-10 border border-[var(--border-strong)] px-2.5 text-sm font-semibold"
              >
                {t.clearFilters}
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {KINDS.map((k) => (
              <FilterChip
                key={k}
                label={enums.resourceKind[k]}
                active={kinds.includes(k)}
                onClick={() => toggle(kinds, k, setKinds)}
              />
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {RESOURCE_VIEW_STATUSES.map((s) => (
              <FilterChip
                key={s}
                label={enums.resourceViewStatus[s]}
                active={statuses.includes(s)}
                onClick={() => toggle(statuses, s, setStatuses)}
              />
            ))}
          </div>
        </div>
      </Panel>

      <Panel
        title={t.units}
        subtitle={`${filteredUnits.length} of ${units.data?.length ?? 0} shown`}
        className="mb-3"
      >
        <UnitsTable units={filteredUnits} />
      </Panel>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel
          title={t.facilities}
          subtitle={t.facilitiesNote}
          actions={<DataModeBadge mode={facilities.mode} note={facilities.error} />}
        >
          {facilities.loading && !facilities.data ? (
            <LoadingState />
          ) : facilities.mode === "unavailable" ? (
            /* An empty list here would read as "no hospitals, no shelters",
               which is an answer nobody should act on. Say the endpoint did
               not answer instead. */
            <UnavailableState
              what={pageStrings(lang).primitives.what.facilities}
              note={facilities.error}
              onRetry={facilities.reload}
            />
          ) : (
            <FacilitiesPanel facilities={filteredFacilities} />
          )}
        </Panel>

        <Panel
          title={t.sensors}
          subtitle={t.sensorsNote}
          actions={<DataModeBadge mode={sensors.mode} note={sensors.error} />}
        >
          {sensors.loading && !sensors.data ? (
            <LoadingState />
          ) : (
            <SensorsPanel sensors={filteredSensors} />
          )}
        </Panel>
      </div>
    </div>
  );
}

function FilterChip({
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
      className={`min-h-9 border px-2.5 text-xs font-semibold uppercase tracking-wide ${
        active
          ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--surface)]"
          : "border-[var(--border-strong)] hover:bg-[var(--surface-2)]"
      }`}
    >
      {label}
    </button>
  );
}
