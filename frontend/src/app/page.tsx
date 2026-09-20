"use client";

/**
 * Home — the state operations picture, laid out to the portal reference.
 *
 *   ┌──────────────────────────────────────────────────┐
 *   │ search · REPORT AN EMERGENCY · I AM SAFE · date   │
 *   ├───────────────────────────────┬──────────────────┤
 *   │                               │ LIVE ALERTS      │
 *   │      LIVE GUJARAT GIS         ├──────────────────┤
 *   │      COMMAND MAP              │ CLOSE ONES       │
 *   │      (the dominant element)   ├──────────────────┤
 *   │                               │ LOCATION ACCESS  │
 *   ├───────────────┬───────────────┼──────────────────┤
 *   │ DISPATCH/LOGS │ RADAR+FORECAST│ WEATHER TREND    │
 *   └───────────────┴───────────────┴──────────────────┘
 *
 * The map holds roughly 60% of the workspace and is the only element with a
 * floor height. There is no page title and no KPI strip on this screen —
 * both would push the map down and turn the portal into a dashboard. The
 * operational counters live on the console at `/dashboard`, where they belong
 * to a workflow.
 *
 * Secondary capabilities stay on their own routes and are reached from the
 * rail; nothing is crammed onto this screen.
 */

import { pageStrings } from "@/lib/pageStrings";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, TriangleAlert } from "lucide-react";
import type { MapMarkerInput } from "./_components/GujaratMap";
import { GujaratMap } from "./_components/GujaratMap";
import {
  DispatchLogPanel,
  LiveAlerts,
  RadarForecast,
  SearchBar,
  WeatherTrend,
} from "./_components/HomePanels";
import { CloseOnesCard, LocationPermissionCard } from "./_components/CitizenCards";
import { ImSafeCard } from "./_components/ImSafe";
import { useLang } from "@/components/layout/AppShell";
import { useEnvelope } from "@/components/layout/useEnvelope";
import { LoadingState } from "@/components/layout/primitives";
import {
  getDispatchLog,
  getDistrictSituations,
  getForecast,
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
  PLATFORM_STRINGS,
  RISK_META,
} from "@/lib/constants";

export default function HomePage() {
  const { lang } = useLang();
  const t = PLATFORM_STRINGS[lang];

  const situations = useEnvelope(useCallback(() => getDistrictSituations(), []));
  const alerts = useEnvelope(useCallback(() => getWeatherAlerts(), []));
  const shelters = useEnvelope(useCallback(() => getShelters(), []));
  const logs = useEnvelope(useCallback(() => getDispatchLog(), []));
  const forecast = useEnvelope(useCallback(() => getForecast(), []));
  const incidents = useEnvelope(useCallback(() => getIncidents(), []));
  const groundTruth = useEnvelope(useCallback(() => getGroundTruth(), []));
  const resources = useEnvelope(useCallback(() => getResources(), []));

  const [query, setQuery] = useState("");
  /* Named per layer, and only when that layer is not live, so the note
     disappears by itself the day an endpoint appears behind one of them. */
  /* The corner stamp speaks for the whole map, so it takes the weakest of
     everything drawn on it rather than the best. */
  const mapMode = useMemo(
    () =>
      worstMode(
        situations.mode,
        shelters.mode,
        groundTruth.mode,
        incidents.mode,
        resources.mode,
        alerts.mode,
      ),
    [situations.mode, shelters.mode, groundTruth.mode, incidents.mode, resources.mode, alerts.mode],
  );

  const demoLayers = useMemo(() => {
    const names: string[] = [];
    if (situations.mode !== "live") names.push("district risk shading");
    if (shelters.mode !== "live") names.push("shelter locations");
    if (groundTruth.mode !== "live") names.push("ground-truth pins");
    return names;
  }, [situations.mode, shelters.mode, groundTruth.mode]);

  const [district, setDistrict] = useState<string | null>(null);
  /* Whether the operator has chosen a district themselves. Until they have,
     the map opens on the one that most needs attention — an operations screen
     that opens on nothing wastes the first ten seconds of every shift. Once
     they click, their choice stands, including clicking a district off. */
  const [touched, setTouched] = useState(false);
  const [wideScreen, setWideScreen] = useState(false);

  // Matches the `lg` breakpoint the layout switches at. Read after mount —
  // the server cannot know the viewport, and guessing it would mismatch.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setWideScreen(mq.matches);
    const first = setTimeout(apply, 0);
    mq.addEventListener("change", apply);
    return () => {
      clearTimeout(first);
      mq.removeEventListener("change", apply);
    };
  }, []);

  const selectDistrict = useCallback((next: string | null) => {
    setTouched(true);
    setDistrict(next);
  }, []);

  /* Markers are assembled from the same data the panels use, so the map can
     never show a different picture from the lists beside it. */
  const markers = useMemo<MapMarkerInput[]>(() => {
    const out: MapMarkerInput[] = [];

    for (const s of shelters.data ?? []) {
      out.push({
        id: `shelter-${s.id}`,
        layer: "shelter",
        lat: s.lat,
        lng: s.lng,
        label: s.name,
        sublabel: `${s.occupancy}/${s.capacity}`,
        district: s.district,
      });
    }

    for (const i of incidents.data ?? []) {
      const layer =
        i.type === "fire" ? "fire" : i.type === "flood" ? "flood" : "citizen_report";
      out.push({
        id: `incident-${i.id}`,
        layer,
        lat: i.lat,
        lng: i.lng,
        label: i.title,
        sublabel: i.code,
        district: districtFromAddress(i.address, i.lat, i.lng),
      });
    }

    for (const g of groundTruth.data ?? []) {
      out.push({
        id: `gt-${g.id}`,
        layer: g.disaster === "road_block" ? "blocked_road" : "citizen_report",
        lat: g.lat,
        lng: g.lng,
        label: g.location,
        sublabel: g.level.replace("_", " "),
        district: g.district,
      });
    }

    for (const r of resources.data ?? []) {
      out.push({
        id: `unit-${r.id}`,
        layer: "response_team",
        lat: r.lat,
        lng: r.lng,
        label: r.callsign,
        sublabel: r.status,
        district: districtFromAddress(r.base, r.lat, r.lng),
      });
    }

    for (const a of alerts.data ?? []) {
      const info = districtByName(a.district);
      if (!info) continue;
      out.push({
        id: `alert-${a.id}`,
        layer: a.disaster === "cyclone" ? "cyclone" : "warning",
        lat: info.lat + 0.25,
        lng: info.lng - 0.25,
        label: a.headline,
        district: a.district,
      });
    }

    return out;
  }, [shelters.data, incidents.data, groundTruth.data, resources.data, alerts.data]);

  /* Search narrows the map and the alert list together. */
  const matchedDistrict = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return (
      (situations.data ?? []).find((s) => s.district.toLowerCase().includes(q))
        ?.district ?? null
    );
  }, [query, situations.data]);

  /* Highest risk first, then most active incidents. */
  const worstDistrict = useMemo(() => {
    const list = situations.data ?? [];
    if (list.length === 0) return null;
    return [...list].sort(
      (a, b) =>
        RISK_META[b.risk].rank - RISK_META[a.risk].rank ||
        b.activeIncidents - a.activeIncidents,
    )[0].district;
  }, [situations.data]);

  /* Two different questions, and conflating them hides data.
     `focusDistrict` aims the map, and may be a district nobody asked for.
     `chosenDistrict` is a district the operator actually asked for, and is the
     only thing allowed to filter the panels — otherwise the rail would open
     showing one alert out of five because the map picked Kutch by itself. */
  const chosenDistrict = matchedDistrict ?? (touched ? district : null);
  /* Auto-focus is a desktop affordance. On a phone the district card is the
     full width of the map, so opening one by ourselves would hand the user a
     screen with no map on it. There, the map opens clear and the card appears
     only when they tap a district. */
  const focusDistrict =
    chosenDistrict ?? (touched || !wideScreen ? null : worstDistrict);

  const focusPoint = useMemo(() => {
    const info = focusDistrict ? districtByName(focusDistrict) : null;
    return info ?? { lat: GUJARAT_CENTER.lat, lng: GUJARAT_CENTER.lng };
  }, [focusDistrict]);

  const filteredAlerts = useMemo(() => {
    const list = alerts.data ?? [];
    return chosenDistrict ? list.filter((a) => a.district === chosenDistrict) : list;
  }, [alerts.data, chosenDistrict]);

  if (situations.loading && !situations.data) {
    return <LoadingState label="Loading the state picture…" />;
  }

  return (
    <div className="p-2 sm:p-2.5">
      {/* ---- Action bar ------------------------------------------------ */}
      <div className="panel mb-2 flex flex-col gap-2 p-2 sm:flex-row sm:items-center">
        <SearchBar lang={lang} value={query} onChange={setQuery} />

        <Link
          href="/report/new"
          className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--crimson-700)] bg-[var(--crimson)] px-4 text-[13px] font-bold text-white no-underline transition-colors hover:bg-[var(--crimson-700)] sm:w-56"
        >
          <TriangleAlert className="size-[18px]" aria-hidden />
          {t.reportEmergency}
        </Link>

        <div className="shrink-0 sm:w-52">
          <ImSafeCard lang={lang} />
        </div>

        <span className="hidden shrink-0 items-center gap-1.5 border-l border-[var(--border)] pl-3 text-[11.5px] text-[var(--muted)] xl:flex">
          <CalendarClock className="size-3.5" aria-hidden />
          <LiveStamp />
        </span>
      </div>

      {query && !matchedDistrict && (
        <p
          role="status"
          className="panel mb-2 border-l-[3px] border-l-[var(--amber)] px-3 py-1.5 text-[12px]"
        >
          No district matches &ldquo;{query}&rdquo;. Showing the whole state.
        </p>
      )}

      {/* The map draws several layers from several sources, and three of them
          have no endpoint behind them at all — there is no /api/districts/situation,
          /api/shelters or /api/ground-truth in the contract, so they are
          fixtures in every build, live or not. A single badge on the map would
          be read as covering everything on it, so the layers are named
          individually instead. The incident, unit and alert layers beside them
          are real. */}
      {demoLayers.length > 0 && (
        <p
          role="note"
          className="panel mb-2 border-l-[3px] border-l-[var(--amber)] px-3 py-1.5 text-[12px] text-[var(--muted)]"
        >
          <strong className="font-semibold text-[var(--foreground)]">{pageStrings(lang).misc.demoDataOnMap}</strong>{" "}
          {demoLayers.join(", ")}. These are illustrative and are not coming from the
          control room. Incidents, units and alerts on the map are not demo data.
        </p>
      )}

      {/* ---- Map + right rail ------------------------------------------ */}
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_296px] xl:grid-cols-[minmax(0,1fr)_320px]">
        <GujaratMap
          className="panel h-[420px] overflow-hidden lg:h-[556px]"
          situations={situations.data ?? []}
          markers={markers}
          selectedDistrict={focusDistrict}
          onSelectDistrict={selectDistrict}
          shelters={shelters.data ?? []}
          mode={mapMode}
          situationsMode={situations.mode}
        />

        {/* Location first. Everything below it — the alerts that matter to
            you, the shelters behind FIND SHELTER, SafeRoute — is better with a
            location fix than without one, so the ask belongs above the things
            it improves rather than at the bottom of a column nobody scrolls. */}
        <div className="flex min-w-0 flex-col gap-2">
          <LocationPermissionCard />
          <LiveAlerts alerts={filteredAlerts} lang={lang} />
          <CloseOnesCard lang={lang} />
        </div>
      </div>

      {/* ---- Lower operational band ------------------------------------ */}
      <div className="mt-2 grid gap-2 lg:grid-cols-3">
        <DispatchLogPanel
          entries={logs.data ?? []}
          lang={lang}
          compact
          mode={logs.mode}
          note={logs.error}
        />
        <RadarForecast forecast={forecast.data ?? []} lang={lang} />
        <WeatherTrend forecast={forecast.data ?? []} />
      </div>

      {/* Focus point is reported so the coordinates under the map always match
          whatever the operator has selected. */}
      <p className="telemetry mt-1.5 px-0.5">
        Focus: {focusDistrict ?? "All districts"} · {focusPoint.lat.toFixed(2)}°N /{" "}
        {focusPoint.lng.toFixed(2)}°E
      </p>
    </div>
  );
}

/**
 * Date and time for the action bar.
 *
 * Renders a placeholder until mounted: the server has no business guessing the
 * operator's wall clock, and emitting a timestamp during SSR guarantees a
 * hydration mismatch a second later.
 */
function LiveStamp() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // Deferred so the first value is not set synchronously in the effect body.
    const first = setTimeout(() => setNow(new Date()), 0);
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  if (!now) return <span className="mono">—</span>;
  return (
    <span className="mono">
      {now.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })}
      , {now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
    </span>
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
function districtFromAddress(
  text: string | null,
  lat?: number,
  lng?: number,
): string {
  const match = text
    ? /(Ahmedabad|Gandhinagar|Surat|Vadodara|Bharuch|Rajkot|Jamnagar|Kutch|Narmada|Navsari|Valsad|Bhavnagar|Junagadh|Amreli|Patan|Mehsana|Banaskantha)/.exec(
        text,
      )
    : null;
  if (match) return match[1];
  if (lat !== undefined && lng !== undefined) {
    return nearestDistrict(lat, lng)?.name ?? "Ahmedabad";
  }
  return "Ahmedabad";
}
