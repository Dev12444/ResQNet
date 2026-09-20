"use client";

/**
 * `/live-map` — the full-screen public GIS view.
 *
 * This is the citizen/state-portal map. The dispatcher control room
 * (`/dashboard`, FE1) is a separate surface with its own queue and dispatch
 * tooling; this page deliberately does not duplicate it.
 *
 * Owner: FE2.
 */

import { pageStrings } from "@/lib/pageStrings";
import { useCallback, useMemo, useState } from "react";
import type { MapMarkerInput } from "../_components/GujaratMap";
import { GujaratMap } from "../_components/GujaratMap";
import { useLang } from "@/components/layout/AppShell";
import { useEnvelope } from "@/components/layout/useEnvelope";
import { LoadingState } from "@/components/layout/primitives";
import { DataModeBadge } from "@/components/layout/ConnectionBar";
import { NearestShelters, PulsePanel } from "../_components/HomePanels";
import {
  getDistrictSituations,
  getPulse,
  nearestShelters,
  getGroundTruth,
  getIncidents,
  getResources,
  getShelters,
  getWeatherAlerts,
  worstMode,
} from "@/lib/api";
import {
  districtByName,
  GUJARAT_CENTER,
  nearestDistrict,
  RISK_META,
  riskLabel,
} from "@/lib/constants";

export default function LiveMapPage() {
  const situations = useEnvelope(useCallback(() => getDistrictSituations(), []));
  const shelters = useEnvelope(useCallback(() => getShelters(), []));
  const incidents = useEnvelope(useCallback(() => getIncidents(), []));
  const groundTruth = useEnvelope(useCallback(() => getGroundTruth(), []));
  const resources = useEnvelope(useCallback(() => getResources(), []));
  const alerts = useEnvelope(useCallback(() => getWeatherAlerts(), []));
  const pulse = useEnvelope(useCallback(() => getPulse(), []));

  const [district, setDistrict] = useState<string | null>(null);
  const { lang } = useLang();
  const m = pageStrings(lang).misc;

  /* Shelters closest to whatever the operator has selected, so the list below
     the map always describes the area on screen. */
  const nearest = useMemo(() => {
    const info = district ? districtByName(district) : null;
    const point = info ?? GUJARAT_CENTER;
    return nearestShelters(shelters.data ?? [], point.lat, point.lng, 3);
  }, [shelters.data, district]);

  const markers = useMemo<MapMarkerInput[]>(() => {
    const out: MapMarkerInput[] = [];
    for (const s of shelters.data ?? [])
      out.push({
        id: `sh-${s.id}`,
        layer: "shelter",
        lat: s.lat,
        lng: s.lng,
        label: s.name,
        sublabel: `${s.occupancy}/${s.capacity}`,
        district: s.district,
      });
    for (const i of incidents.data ?? [])
      out.push({
        id: `inc-${i.id}`,
        layer: i.type === "fire" ? "fire" : i.type === "flood" ? "flood" : "citizen_report",
        lat: i.lat,
        lng: i.lng,
        label: i.title,
        sublabel: i.code,
        district: districtOf(i.address, i.lat, i.lng),
      });
    for (const g of groundTruth.data ?? [])
      out.push({
        id: `gt-${g.id}`,
        layer: g.disaster === "road_block" ? "blocked_road" : "citizen_report",
        lat: g.lat,
        lng: g.lng,
        label: g.location,
        sublabel: g.level.replace("_", " "),
        district: g.district,
      });
    for (const r of resources.data ?? [])
      out.push({
        id: `u-${r.id}`,
        layer: "response_team",
        lat: r.lat,
        lng: r.lng,
        label: r.callsign,
        sublabel: r.status,
        district: districtOf(r.base),
      });
    for (const a of alerts.data ?? []) {
      const info = districtByName(a.district);
      if (info)
        out.push({
          id: `al-${a.id}`,
          layer: a.disaster === "cyclone" ? "cyclone" : "warning",
          lat: info.lat + 0.25,
          lng: info.lng - 0.25,
          label: a.headline,
          district: a.district,
        });
    }
    return out;
  }, [shelters.data, incidents.data, groundTruth.data, resources.data, alerts.data]);

  const ranked = useMemo(
    () =>
      [...(situations.data ?? [])].sort(
        (a, b) =>
          RISK_META[b.risk].rank - RISK_META[a.risk].rank ||
          b.activeIncidents - a.activeIncidents,
      ),
    [situations.data],
  );

  if (situations.loading && !situations.data) {
    return <LoadingState label="Loading the map…" />;
  }

  return (
    <div className="p-3 sm:p-4">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-2 border-l-2 border-[var(--teal)] pl-3">
        <div>
          <h1 className="cmd text-[24px] leading-none">{m.liveMap}</h1>
          <p className="text-sm text-[var(--muted)]">
            {m.liveMapIntro}
          </p>
        </div>
        <DataModeBadge mode={situations.mode} note={situations.error} />
      </header>

      <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
        <GujaratMap
          className="panel h-[520px] overflow-hidden lg:h-[calc(100dvh-220px)]"
          situations={situations.data ?? []}
          markers={markers}
          selectedDistrict={district}
          onSelectDistrict={setDistrict}
          shelters={shelters.data ?? []}
          mode={worstMode(
            situations.mode,
            shelters.mode,
            groundTruth.mode,
            incidents.mode,
            resources.mode,
            alerts.mode,
          )}
          situationsMode={situations.mode}
        />

        <div className="flex min-w-0 flex-col gap-3">
        <PulsePanel pulse={pulse.data ?? []} lang={lang} />

        <section className="panel flex min-h-0 flex-col">
          <div className="panel-head">
            <h2 className="cmd text-[12px]">{m.districtsByRisk}</h2>
            <span className="telemetry ml-auto">{m.inView(ranked.length)}</span>
          </div>
          <ul className="thin-scroll flex-1 divide-y divide-[var(--border)] overflow-y-auto">
            {ranked.map((s) => {
              const meta = RISK_META[s.risk];
              const active = district === s.district;
              return (
                <li key={s.district}>
                  <button
                    type="button"
                    onClick={() => setDistrict(active ? null : s.district)}
                    aria-current={active}
                    className={`flex w-full items-center gap-2 border-l-4 px-3 py-2 text-left ${
                      active ? "bg-[var(--surface-2)]" : "hover:bg-[var(--surface-2)]"
                    }`}
                    style={{ borderLeftColor: meta.color }}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold">{s.district}</span>
                      <span
                        className="text-[10px] font-bold uppercase tracking-wide"
                        style={{ color: meta.color }}
                      >
                        {riskLabel(s.risk, lang)}
                      </span>
                    </span>
                    <span className="mono shrink-0 text-right text-[11px] text-[var(--muted)]">
                      <span className="block font-bold text-[var(--foreground)]">
                        {s.activeIncidents}
                      </span>
                      {m.incidentsLabel}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <NearestShelters shelters={nearest} lang={lang} />
        </div>
      </div>
    </div>
  );
}

/**
 * Best-effort district from a free-text address or base name.
 *
 * `text` is nullable because `Incident.address` is: an incident raised from a
 * sensor reading, or from a caller who never named a landmark, has no address
 * at all. When there is no usable text the district is taken from the marker's
 * own coordinates instead of defaulting to Ahmedabad, which would file a Kutch
 * incident under the wrong district on a map whose whole job is where things
 * are.
 */
function districtOf(text: string | null, lat?: number, lng?: number): string {
  const m = text
    ? /(Ahmedabad|Gandhinagar|Surat|Vadodara|Bharuch|Rajkot|Jamnagar|Kutch|Narmada|Navsari|Valsad|Bhavnagar|Junagadh|Amreli|Patan|Mehsana|Banaskantha)/.exec(
        text,
      )
    : null;
  if (m) return m[1];
  if (lat !== undefined && lng !== undefined) {
    return nearestDistrict(lat, lng)?.name ?? "Ahmedabad";
  }
  return "Ahmedabad";
}
