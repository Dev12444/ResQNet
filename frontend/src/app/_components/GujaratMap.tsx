"use client";

/**
 * The Gujarat situational map.
 *
 * MapLibre with a real basemap, overlaid with district risk and operational
 * markers. Two honesty constraints shape it:
 *
 *   - The coloured district discs are a RISK OVERLAY positioned at district
 *     centroids, not surveyed administrative boundaries. The legend says so.
 *   - Markers are drawn from the same mock dataset as every other screen, so
 *     the map can never disagree with the panels beside it.
 *
 * Dense markers are collapsed into count bubbles below a zoom threshold so the
 * coastline stays readable.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Map as MapLibreMap, Marker, NavigationControl } from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Crosshair, Grid3x3, Layers, X } from "lucide-react";
import type {
  DistrictSituation,
  MapBaseLayer,
  MapLayer,
  Shelter,
} from "@/types";
import { ensureMapLibreWorker } from "@/components/layout/maplibreWorker";
import { Coordinates, MAP_GRID, gridRef } from "@/components/layout/Telemetry";
import { USE_MOCK } from "@/lib/api";
import {
  DEFAULT_MAP_LAYERS,
  GUJARAT_DISTRICTS,
  MAP_LAYER_META,
  RISK_META,
} from "@/lib/constants";

/* ------------------------------------------------------------------ */
/* Basemap styles                                                      */
/* ------------------------------------------------------------------ */

const VECTOR_STYLE = "https://tiles.openfreemap.org/styles/liberty";

const SATELLITE_ATTRIBUTION =
  "Imagery © Esri, Maxar, Earthstar Geographics";

/** Esri's map services. Imagery, and the transparent reference sheets over it. */
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";

function rasterStyle(withReference: boolean): StyleSpecification {
  const sources: StyleSpecification["sources"] = {
    satellite: {
      type: "raster",
      tiles: [`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`],
      tileSize: 256,
      attribution: SATELLITE_ATTRIBUTION,
    },
  };
  const layers: StyleSpecification["layers"] = [
    {
      id: "satellite",
      type: "raster",
      source: "satellite",
      /*
       * Esri's World Imagery is colour-graded for analysis, which on a screen
       * across a room reads as brown haze: the Arabian Sea goes slate, the
       * Rann goes grey, and the amber markers sit on mud. Lifting saturation
       * and contrast puts the sea back to blue and the cropland back to green,
       * which is what makes the operational overlay legible on top of it.
       * These are display adjustments to a basemap, not to any data.
       */
      paint: {
        "raster-saturation": 0.32,
        "raster-contrast": 0.1,
        "raster-brightness-min": 0.04,
      },
    },
  ];

  if (withReference) {
    /*
     * HYBRID is imagery plus Esri's own reference sheets: transparent tiles
     * carrying the road network, then administrative boundaries and place
     * names. Drawn for exactly this imagery, so they register with it, and
     * they are what makes HYBRID a genuinely different mode from SATELLITE
     * rather than the same picture with a label sheet floated over it.
     */
    sources.roads = {
      type: "raster",
      tiles: [`${ESRI}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`],
      tileSize: 256,
      attribution: SATELLITE_ATTRIBUTION,
    };
    sources.boundaries = {
      type: "raster",
      tiles: [
        `${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`,
      ],
      tileSize: 256,
      attribution: SATELLITE_ATTRIBUTION,
    };
    // Held back a little: over imagery at full strength the reference sheet
    // competes with the operational markers it exists to sit underneath.
    layers.push(
      { id: "roads", type: "raster", source: "roads", paint: { "raster-opacity": 0.8 } },
      {
        id: "boundaries",
        type: "raster",
        source: "boundaries",
        paint: { "raster-opacity": 0.9 },
      },
    );
  }

  return { version: 8, sources, layers };
}

/**
 * One glyph per operational layer, as raw SVG path data.
 *
 * MapLibre markers are DOM elements built outside React, so these cannot be
 * React icon components — they are set as `innerHTML` on the marker's span.
 * Each is drawn on a 24x24 grid and stroked in white over the layer's colour.
 *
 * The glyph replaces the shape coding the markers used to carry (square for a
 * facility, diamond for a mobile unit, circle for an event). A glyph is a
 * strictly better non-colour channel than a silhouette: it survives a
 * photograph of the screen and a colour-blind operator the same way a shape
 * does, and unlike a shape it says *which* facility rather than just that it
 * is one.
 */
const LAYER_GLYPH: Record<MapLayer, string> = {
  cyclone:
    '<path d="M4 7h15M7 11h11M10 15h7M12.5 19h3"/><circle cx="12" cy="11" r="1.6" fill="currentColor" stroke="none"/>',
  flood:
    '<path d="M3 11c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 16c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
  fire: '<path d="M12 3c4 4 5.5 6.5 5.5 9.5a5.5 5.5 0 0 1-11 0c0-1.7.8-3 2-4.2.2 1.8 1 2.7 1.8 2.7 1 0 1.7-1.3 1.7-8z"/>',
  heavy_rainfall:
    '<path d="M7 13a4 4 0 0 1 .6-8 5.5 5.5 0 0 1 10.2 2A3.3 3.3 0 0 1 17.5 13z"/><path d="M8 16.5 7 20M12 16.5 11 20M16 16.5 15 20"/>',
  warning: '<path d="M12 4 21.5 20H2.5z"/><path d="M12 10v4M12 17h.01"/>',
  shelter: '<path d="M3.5 11 12 4.2 20.5 11"/><path d="M6 11v9h12v-9"/><path d="M10.5 20v-5h3v5"/>',
  hospital: '<path d="M4.5 5.5h15v15h-15z"/><path d="M12 9v8M8 13h8"/>',
  response_team:
    '<path d="M2.5 16.5V9h10v7.5"/><path d="M12.5 11h4l3 3.2v2.3h-7z"/><circle cx="6" cy="18" r="1.8"/><circle cx="16" cy="18" r="1.8"/>',
  blocked_road: '<path d="M3.5 7.5h17v4h-17zM3.5 14h17v4h-17z"/><path d="M6 5.5v15M18 5.5v15"/>',
  citizen_report:
    '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.4"/>',
};

/** Wraps a glyph in the pin chrome every operational marker shares. */
function markerSvg(glyph: string, px = 13): string {
  return (
    `<svg viewBox="0 0 24 24" width="${px}" height="${px}" fill="none" ` +
    'stroke="currentColor" stroke-width="2.1" stroke-linecap="round" ' +
    'stroke-linejoin="round" aria-hidden="true">' +
    glyph +
    "</svg>"
  );
}

/** The style for a base layer. One mapping, used by init and by the switcher. */
function styleFor(base: MapBaseLayer): StyleSpecification | string {
  return base === "map" ? VECTOR_STYLE : rasterStyle(base === "hybrid");
}

/**
 * Run `cb` once the style is genuinely finished loading.
 *
 * This is the fix for the basemap switch. `styledata` fires on every partial
 * mutation of a style — including the moment `setStyle` installs an empty one
 * — so waiting on a single `styledata` handed the overlay code a map whose
 * sources did not exist yet, and `addSource` threw "Style is not done
 * loading." The throw happened inside an effect, so MAP / SATELLITE / HYBRID
 * appeared to do nothing at all: the style swapped underneath, the overlays
 * never came back, and in development the error overlay covered the page.
 *
 * `isStyleLoaded()` is the only reliable gate, so the events are just prompts
 * to re-check it.
 */
function whenStyleReady(map: MapLibreMap, cb: () => void): () => void {
  let done = false;
  const check = () => {
    if (done || !map.isStyleLoaded()) return;
    done = true;
    map.off("styledata", check);
    map.off("idle", check);
    cb();
  };
  map.on("styledata", check);
  map.on("idle", check);
  check();
  return () => {
    done = true;
    map.off("styledata", check);
    map.off("idle", check);
  };
}

/** What each basemap mode actually shows, on the control that switches it. */
const BASE_TITLE: Record<MapBaseLayer, string> = {
  map: "Street and terrain basemap",
  satellite: "Satellite imagery",
  hybrid: "Satellite imagery with roads, boundaries and place names",
};

/** Gujarat, comfortably framed. */
const GUJARAT_VIEW = { center: [71.5, 22.6] as [number, number], zoom: 6.1 };

/**
 * Clustering, measured in pixels rather than in zoom levels.
 *
 * The old rule collapsed markers below zoom 5.8 and drew every pin
 * individually above it, which meant the default state view stacked a dozen
 * pins on one district centroid. Grouping anything whose projected positions
 * are closer together than this radius fixes that at every zoom: pins that do
 * not collide are never hidden, and pins that do collide become one bubble
 * with a count. The radius is a little over a marker's width, so a group is
 * formed exactly when the icons would have overlapped.
 */
const CLUSTER_RADIUS_PX = 26;

/** Marker diameters, in pixels. Deliberately small: this is a GIS overlay. */
const MARKER_SIZE = 18;
/** The offshore cyclone is the one event allowed to out-rank the rest. */
const MARKER_SIZE_PROMINENT = 24;
/** A count bubble standing in for several markers. */
const CLUSTER_SIZE = 26;

/* ------------------------------------------------------------------ */
/* Marker model                                                        */
/* ------------------------------------------------------------------ */

export interface MapMarkerInput {
  id: string;
  layer: MapLayer;
  lat: number;
  lng: number;
  label: string;
  sublabel?: string;
  district: string;
}

export function GujaratMap({
  situations,
  markers,
  selectedDistrict,
  onSelectDistrict,
  shelters,
  className = "",
}: {
  situations: DistrictSituation[];
  markers: MapMarkerInput[];
  selectedDistrict: string | null;
  onSelectDistrict: (district: string | null) => void;
  shelters: Shelter[];
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerObjects = useRef<Marker[]>([]);

  /* Imagery with labels is the default view. A disaster picture is read against
     terrain — coastline, river, built-up area — and a pale vector street map
     throws that away. `map` stays available for a projector or a weak link. */
  const [base, setBase] = useState<MapBaseLayer>("hybrid");
  const [activeLayers, setActiveLayers] = useState<MapLayer[]>(DEFAULT_MAP_LAYERS);
  const [layersOpen, setLayersOpen] = useState(false);
  const [zoom, setZoom] = useState(GUJARAT_VIEW.zoom);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  /* Bumped by RETRY. The map is torn down and rebuilt, which is the only
     recovery that also covers a failure during construction. */
  const [attempt, setAttempt] = useState(0);

  /* The base layer the map is currently *showing*, which is not the same thing
     as the one in state until the style has actually been swapped. Keeping it
     in a ref lets the switcher below run on every render without re-applying a
     style it has already applied. */
  const appliedBase = useRef<MapBaseLayer | null>(null);
  /* The chosen base, readable from init without making init depend on it. */
  const baseRef = useRef(base);

  /* `ready` mirrored into a ref so the load watchdog can read it when it
     fires, rather than capturing a stale value when it is armed. */
  const readyRef = useRef(false);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Cancels the pending "has the new style finished loading yet" watcher. */
  const unwatch = useRef<(() => void) | null>(null);

  const markReady = useCallback((value: boolean) => {
    readyRef.current = value;
    setReady(value);
    if (value) {
      if (watchdog.current) clearTimeout(watchdog.current);
      watchdog.current = null;
      setFailed(false);
    }
  }, []);

  /* A basemap that never finishes loading is indistinguishable from a blank
     rectangle, so it gets a deadline rather than being left to hang. */
  const armWatchdog = useCallback(() => {
    if (watchdog.current) clearTimeout(watchdog.current);
    watchdog.current = setTimeout(() => {
      if (!readyRef.current) setFailed(true);
    }, 15000);
  }, []);

  // Latest callback, read from map handlers without re-running init.
  const selectRef = useRef(onSelectDistrict);
  useEffect(() => {
    selectRef.current = onSelectDistrict;
  });

  /* ---------------- map lifecycle ---------------- */

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    let cancelled = false;
    let map: MapLibreMap | null = null;
    let observer: ResizeObserver | null = null;

    const init = () => {
      if (cancelled) return;
      try {
        ensureMapLibreWorker();
        map = new MapLibreMap({
          container: el,
          // The selected base, not a hardcoded one. Constructing with the
          // vector style and relying on the switcher to correct it left the
          // map showing a street basemap while the control said HYBRID.
          style: styleFor(baseRef.current),
          center: GUJARAT_VIEW.center,
          zoom: GUJARAT_VIEW.zoom,
          minZoom: 5,
          maxZoom: 14,
          attributionControl: { compact: true },
        });
        mapRef.current = map;
        map.addControl(new NavigationControl({ showCompass: false }), "top-left");
        map.on("error", (ev) => {
          const message = String(
            (ev as unknown as { error?: { message?: string } }).error?.message ?? "",
          );
          /* A tile that 404s at the edge of coverage is normal and must never
             blank the map — that is how a single missing tile used to put the
             whole panel into a permanent failure state. A style, sprite or
             glyph that cannot be fetched is different: this basemap will never
             draw, so say so. */
          if (
            !readyRef.current &&
            /style|sprite|glyph|failed to fetch|networkerror/i.test(message)
          ) {
            setFailed(true);
          }
        });
        map.on("load", () => {
          map!.resize();
          appliedBase.current = baseRef.current;
          markReady(true);
        });
        map.on("zoom", () => setZoom(map!.getZoom()));

        // The map is created before the grid has settled its row heights, so
        // the initial canvas can be far shorter than the panel. Track the
        // container instead of relying on the one-shot size at construction.
        //
        // Guarded: `map.resize()` writes to the canvas, which can re-notify
        // the observer. Without the size comparison that becomes a feedback
        // loop that starves the style load and the map never finishes.
        let lastW = el.clientWidth;
        let lastH = el.clientHeight;
        observer = new ResizeObserver(() => {
          const w = el.clientWidth;
          const h = el.clientHeight;
          if (w === lastW && h === lastH) return;
          lastW = w;
          lastH = h;
          map?.resize();
        });
        observer.observe(el);
      } catch {
        setFailed(true);
      }
    };

    armWatchdog();
    const timer = setTimeout(init, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      observer?.disconnect();
      if (watchdog.current) clearTimeout(watchdog.current);
      watchdog.current = null;
      unwatch.current?.();
      unwatch.current = null;
      markerObjects.current.forEach((m) => m.remove());
      markerObjects.current = [];
      map?.remove();
      mapRef.current = null;
      appliedBase.current = null;
      readyRef.current = false;
    };
  }, [attempt, armWatchdog, markReady]);

  /* ---------------- basemap switching ---------------- */

  useEffect(() => {
    const map = mapRef.current;
    // `ready` is a dependency because a base chosen before the first style has
    // loaded would otherwise be dropped on the floor: the effect would bail
    // here and never run again, since `base` had not changed.
    if (!map || !ready) return;
    if (appliedBase.current === base) return;
    appliedBase.current = base;
    markReady(false);
    armWatchdog();
    /* `setStyle` keeps the camera, so centre, zoom and bearing survive the
       switch untouched. The React-held state — selected district, active
       layers, grid — is never involved, and the overlays are re-added by the
       effect below the moment the new style reports itself loaded. */
    map.setStyle(styleFor(base), { diff: false });
    /* Deliberately NOT returned as this effect's cleanup. `markReady(false)`
       above changes `ready`, which is a dependency, so returning the
       unsubscribe would re-run the effect and immediately remove the listener
       that is waiting for the new style — the switch would then hang on
       LOADING MAP until the watchdog called it a failure. The watcher owns its
       own lifetime instead: it unsubscribes when it fires, and the ref lets a
       second switch cancel a first one that is still pending. */
    unwatch.current?.();
    unwatch.current = whenStyleReady(map, () => {
      unwatch.current = null;
      markReady(true);
    });
  }, [base, ready, markReady, armWatchdog]);

  const retry = useCallback(() => {
    setFailed(false);
    markReady(false);
    setAttempt((a) => a + 1);
  }, [markReady]);

  /* ---------------- overlay rendering ---------------- */

  const visibleMarkers = useMemo(
    () => markers.filter((m) => activeLayers.includes(m.layer)),
    [markers, activeLayers],
  );

  /** Markers per district — carried on the risk disc's accessible name. */
  const countByDistrict = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of visibleMarkers) {
      counts.set(m.district, (counts.get(m.district) ?? 0) + 1);
    }
    return counts;
  }, [visibleMarkers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    /* Belt and braces behind `whenStyleReady`: every call below this line
       touches the style, and a style that is mid-swap throws rather than
       no-opping. */
    if (!map.isStyleLoaded()) return;

    markerObjects.current.forEach((m) => m.remove());
    markerObjects.current = [];

    /* ---- Cartographic overlays -----------------------------------
     * The graticule and the cyclone track are real MapLibre layers, not an
     * HTML overlay drawn on top. That matters: a screen-space grid would
     * drift off the ground the moment anyone panned, and a grid reference
     * that does not correspond to a place is worse than none at all. Both
     * are re-added whenever `ready` flips, which covers a basemap switch
     * wiping the style's sources.
     */
    try {
      syncGraticule(map, showGrid);
      syncCycloneTrack(map);
    } catch {
      /* The style went out from under us between the check and the call.
         The next `styledata` re-runs this effect against the new style. */
      return;
    }

    // Grid cell labels. HTML markers rather than a symbol layer, because the
    // satellite style carries no glyph endpoint and a symbol layer would
    // silently render nothing over imagery.
    if (showGrid && zoom < 8.5) {
      const cellW = (MAP_GRID.east - MAP_GRID.west) / MAP_GRID.cols;
      const cellH = (MAP_GRID.north - MAP_GRID.south) / MAP_GRID.rows;
      for (let c = 0; c < MAP_GRID.cols; c++) {
        for (let r = 0; r < MAP_GRID.rows; r++) {
          const lng = MAP_GRID.west + (c + 0.5) * cellW;
          const lat = MAP_GRID.north - (r + 0.5) * cellH;
          const el = document.createElement("span");
          el.textContent = gridRef(lat, lng);
          Object.assign(el.style, {
            font: "600 9px/1 ui-monospace, monospace",
            letterSpacing: "0.08em",
            color: base === "map" ? "rgba(23,33,31,.40)" : "rgba(255,255,255,.55)",
            pointerEvents: "none",
            whiteSpace: "nowrap",
          });
          markerObjects.current.push(
            new Marker({ element: el }).setLngLat([lng, lat]).addTo(map),
          );
        }
      }
    }

    // District risk discs, always drawn.
    for (const s of situations) {
      const el = document.createElement("button");
      el.type = "button";
      const extra = countByDistrict.get(s.district);
      el.setAttribute(
        "aria-label",
        `${s.district}, ${RISK_META[s.risk].label} risk, ${s.activeIncidents} active incidents` +
          (extra ? `, ${extra} markers in district` : ""),
      );
      el.className = "resq-district";
      /* 18px at normal risk up to 30px at critical. The old scale started at
         26 and ran to 54, which buried the district names underneath it — on
         a GIS overlay a marker is a symbol, not an illustration. Selection is
         carried by a ring, never by making the disc bigger. */
      const size = 18 + RISK_META[s.risk].rank * 3;
      const selected = selectedDistrict === s.district;
      // The sizing and the halo live on an inner wrapper. MapLibre positions
      // the marker element itself, so overriding `position` on it collapses
      // the button to a zero-size box with no hit area.
      /* The risk field: a soft disc of the district's risk colour, sized by
         rank, sitting under the marker. It is what makes an elevated district
         legible as an area on the imagery rather than as a single pin — but it
         is deliberately a gradient that fades to nothing, so it tints the
         terrain instead of hiding it. Normal-risk districts get none. */
      const rank = RISK_META[s.risk].rank;
      const field = rank > 0 ? size * (1.6 + rank * 0.45) : 0;
      el.innerHTML = `
        <span style="position:relative;display:block;width:${size}px;height:${size}px;">
          ${
            field
              ? `<span style="position:absolute;left:50%;top:50%;width:${field}px;height:${field}px;
                   margin-left:${-field / 2}px;margin-top:${-field / 2}px;border-radius:9999px;
                   background:radial-gradient(circle, ${RISK_META[s.risk].color}52 0%, ${RISK_META[s.risk].color}24 45%, ${RISK_META[s.risk].color}00 72%);
                   pointer-events:none;"></span>`
              : ""
          }
          ${
            s.risk === "critical"
              ? `<span class="halo" style="position:absolute;inset:0;border-radius:9999px;background:${RISK_META[s.risk].color};opacity:.5"></span>`
              : ""
          }
          <span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
            border-radius:9999px;
            background:${RISK_META[s.risk].color};
            border:2px solid #fff;
            box-shadow:${selected ? `0 0 0 3px ${RISK_META[s.risk].color}, 0 0 0 5px rgba(255,255,255,.55), 0 2px 6px rgba(0,0,0,.5)` : "0 1px 4px rgba(0,0,0,.45)"};
            color:#fff;font-weight:700;font-size:${size >= 26 ? 11 : 10}px;
            font-family:var(--font-condensed),system-ui,sans-serif;">
            ${s.activeIncidents}
          </span>
        </span>`;
      Object.assign(el.style, {
        display: "block",
        cursor: "pointer",
        background: "transparent",
        border: "none",
        padding: "0",
        lineHeight: "0",
        // Markers are stacked in DOM order, so anything added after a disc
        // lands on top of it. The cluster bubble is anchored at the same
        // centroid and was covering the disc's centre, silently eating the
        // click that opens the district panel. The disc is the only control
        // among these markers, so it is lifted above the readouts.
        zIndex: "3",
      });
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        selectRef.current(selectedDistrict === s.district ? null : s.district);
      });

      const marker = new Marker({ element: el }).setLngLat([s.lng, s.lat]).addTo(map);
      markerObjects.current.push(marker);
    }

    // District name labels.
    if (zoom >= 6) {
      for (const d of GUJARAT_DISTRICTS) {
        const el = document.createElement("span");
        el.textContent = d.name;
        Object.assign(el.style, {
          font: "600 10px/1 var(--font-condensed), system-ui, sans-serif",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: base === "map" ? "#17211f" : "#ffffff",
          textShadow:
            base === "map"
              ? "0 0 3px #faf9f5, 0 0 2px #faf9f5"
              : "0 0 3px rgba(0,0,0,.9)",
          transform: "translateY(28px)",
          pointerEvents: "none",
          whiteSpace: "nowrap",
        });
        markerObjects.current.push(
          new Marker({ element: el }).setLngLat([d.lng, d.lat]).addTo(map),
        );
      }
    }

    /* ---- Operational markers -------------------------------------
     * Grouped by how close they land ON SCREEN, so a group forms exactly when
     * the icons would have covered one another and never otherwise. A group of
     * one is drawn as its own pin; a group of several becomes a count bubble
     * that zooms in on click.
     */
    const groups: { lat: number; lng: number; items: MapMarkerInput[] }[] = [];
    const anchors: { x: number; y: number; group: (typeof groups)[number] }[] = [];
    for (const m of visibleMarkers) {
      const point = map.project([m.lng, m.lat]);
      const near = anchors.find(
        (a) => Math.hypot(a.x - point.x, a.y - point.y) < CLUSTER_RADIUS_PX,
      );
      if (near) {
        near.group.items.push(m);
        continue;
      }
      const group = { lat: m.lat, lng: m.lng, items: [m] };
      groups.push(group);
      anchors.push({ x: point.x, y: point.y, group });
    }

    for (const group of groups) {
      if (group.items.length > 1) {
        const el = document.createElement("button");
        el.type = "button";
        el.textContent = String(group.items.length);
        el.setAttribute(
          "aria-label",
          `${group.items.length} markers here — zoom in to separate them`,
        );
        Object.assign(el.style, {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: `${CLUSTER_SIZE}px`,
          height: `${CLUSTER_SIZE}px`,
          padding: "0",
          background: "var(--navy-900)",
          color: "#fff",
          font: "700 11px/1 ui-monospace, monospace",
          border: "2px solid #fff",
          boxShadow: "0 1px 4px rgba(0,0,0,.55)",
          // The same clipped top-right the panels use, so a cluster reads as
          // a ResQNet object rather than a generic map pin.
          clipPath: "polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 0 100%)",
          cursor: "zoom-in",
          // Below the district discs, which are the only markers whose click
          // opens a panel; a cluster must never swallow that click.
          zIndex: "2",
        });
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          map.easeTo({
            center: [group.lng, group.lat],
            zoom: Math.min(map.getZoom() + 1.6, 14),
            duration: 500,
          });
        });
        markerObjects.current.push(
          new Marker({ element: el }).setLngLat([group.lng, group.lat]).addTo(map),
        );
        continue;
      }

      const m = group.items[0];
      const meta = MAP_LAYER_META[m.layer];
      /* One size for ordinary markers, one step up for the cyclone — the only
         event on this map that is physically bigger than a district. */
      const size = m.layer === "cyclone" ? MARKER_SIZE_PROMINENT : MARKER_SIZE;
      const el = document.createElement("span");
      el.title = `${meta.label}: ${m.label}${m.sublabel ? ` — ${m.sublabel}` : ""}`;
      el.innerHTML = markerSvg(
        LAYER_GLYPH[m.layer] ?? LAYER_GLYPH.citizen_report,
        Math.round(size * 0.58),
      );
      Object.assign(el.style, {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "9999px",
        background: meta.color,
        color: "#fff",
        // The white ring is what separates a pin from the terrain under it,
        // and it is what lets these read at 18px instead of 22.
        border: "1.5px solid #fff",
        boxShadow: "0 1px 3px rgba(0,0,0,.5)",
        cursor: "default",
      });
      markerObjects.current.push(
        new Marker({ element: el }).setLngLat([m.lng, m.lat]).addTo(map),
      );
    }
  }, [
    ready,
    situations,
    visibleMarkers,
    countByDistrict,
    selectedDistrict,
    zoom,
    base,
    showGrid,
  ]);

  /* ---------------- controls ---------------- */

  const recenter = useCallback(() => {
    mapRef.current?.flyTo({ ...GUJARAT_VIEW, duration: 600 });
    selectRef.current(null);
  }, []);

  const toggleLayer = (layer: MapLayer) =>
    setActiveLayers((prev) =>
      prev.includes(layer) ? prev.filter((l) => l !== layer) : [...prev, layer],
    );

  const selected = selectedDistrict
    ? situations.find((s) => s.district === selectedDistrict) ?? null
    : null;

  const selectedShelters = selected
    ? shelters.filter((s) => s.district === selected.district)
    : [];

  return (
    <div className={`relative ${className}`}>
      {/* Sized explicitly rather than with `absolute inset-0`: maplibre's own
          stylesheet sets `.maplibregl-map { position: relative }`, which wins
          over the utility class and collapses the element's height. */}
      <div ref={container} className="h-full w-full bg-[var(--surface-3)]" />

      {/* A basemap that is still fetching is a blank rectangle, and a blank
          rectangle on a disaster map reads as a broken product. It says what
          it is doing, and after fifteen seconds it says that it failed and
          offers a way out. */}
      {!ready && !failed && (
        <div className="absolute inset-0 z-[5] flex items-center justify-center bg-[var(--surface-2)]">
          <p className="cmd flex items-center gap-2 text-[12px] tracking-wider text-[var(--muted)]">
            <span
              aria-hidden
              className="size-3 animate-spin rounded-full border-2 border-[var(--border-strong)] border-t-[var(--navy-600)]"
            />
            LOADING MAP…
          </p>
        </div>
      )}

      {failed && (
        <div className="absolute inset-0 z-[6] flex items-center justify-center bg-[var(--surface-2)] p-6 text-center">
          <div>
            <p className="cmd text-[13px] tracking-wider text-[var(--critical)]">
              MAP LOAD ERROR
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              The basemap tiles could not be reached. District risk and incident data
              are still available in the panels on this page and on the Incidents
              screen.
            </p>
            <button
              type="button"
              onClick={retry}
              className="cmd mt-3 border border-[var(--carbon)] bg-[var(--carbon)] px-3 py-1.5 text-[11px] tracking-wider text-white hover:opacity-90"
            >
              RETRY
            </button>
          </div>
        </div>
      )}

      {/* Base layer switch + graticule toggle.
          Exactly one mode is ever active: `base` is a single value, so the
          pressed state and the style applied to the map cannot disagree. */}
      <div className="absolute left-14 top-3 z-10 flex border border-[var(--carbon)] bg-[var(--surface)] shadow-sm">
        {(["map", "satellite", "hybrid"] as MapBaseLayer[]).map((b) => (
          <button
            key={b}
            type="button"
            title={BASE_TITLE[b]}
            onClick={() => {
              baseRef.current = b;
              setBase(b);
            }}
            aria-pressed={base === b}
            className={`cmd border-r border-[var(--border-strong)] px-2.5 py-1.5 text-[11px] last:border-r-0 ${
              base === b
                ? "bg-[var(--carbon)] text-white"
                : "text-[var(--foreground)] hover:bg-[var(--surface-2)]"
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setShowGrid((g) => !g)}
        aria-pressed={showGrid}
        title="Toggle the map grid reference overlay"
        className={`cmd absolute left-14 top-[54px] z-10 flex items-center gap-1.5 border border-[var(--carbon)] px-2 py-1 text-[11px] shadow-sm ${
          showGrid
            ? "bg-[var(--carbon)] text-white"
            : "bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-2)]"
        }`}
      >
        <Grid3x3 className="size-3.5" aria-hidden />
        Grid
      </button>

      {/* Recenter sits under MapLibre's own +/- so the three view controls read
          as one instrument, as on the reference portal. */}
      <button
        type="button"
        onClick={recenter}
        aria-label="Reset the map view"
        title="Reset the map view"
        className="absolute left-3 top-[76px] z-10 flex size-[29px] items-center justify-center rounded-[4px] border border-[var(--border-strong)] bg-white shadow-sm hover:bg-[var(--surface-2)]"
      >
        <Crosshair className="size-4" aria-hidden />
      </button>

      {/* Layers */}
      <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setLayersOpen((o) => !o)}
            aria-expanded={layersOpen}
            className="cmd flex items-center gap-1.5 border border-[var(--carbon)] bg-[var(--surface)] px-2 py-1.5 text-[11px] shadow-sm hover:bg-[var(--surface-2)]"
          >
            <Layers className="size-3.5" aria-hidden />
            Layers
            <span className="mono text-[var(--muted)]">{activeLayers.length}</span>
          </button>
          {layersOpen && (
            <fieldset className="absolute right-0 top-full z-20 mt-1 w-56 border border-[var(--carbon)] bg-[var(--surface)] shadow-lg">
              <legend className="sr-only">Map layers</legend>
              <p className="eyebrow border-b border-[var(--hairline)] bg-[var(--surface-2)] px-2 py-1.5 text-[var(--muted)]">
                Operational Layers
              </p>
              <div className="p-1.5">
              {(Object.keys(MAP_LAYER_META) as MapLayer[]).map((layer) => (
                <label
                  key={layer}
                  className="flex cursor-pointer items-center gap-2 px-1 py-1 text-xs hover:bg-[var(--surface-2)]"
                >
                  <input
                    type="checkbox"
                    checked={activeLayers.includes(layer)}
                    onChange={() => toggleLayer(layer)}
                    className="size-3.5"
                  />
                  <span
                    aria-hidden
                    className="inline-block size-2.5 shrink-0"
                    style={{ background: MAP_LAYER_META[layer].color }}
                  />
                  {MAP_LAYER_META[layer].label}
                </label>
              ))}
              </div>
            </fieldset>
          )}
        </div>
      </div>

      {/* District situation readout.
          Laid out as a plotted card: identity rule, coordinates and grid
          reference, the ResQ Pulse meter, then a 2x2 of counts. This is the
          screen a district commander looks at, so nothing on it is a link to
          somewhere else — every figure is present on its face. */}
      {selected && (
        <aside className="notch absolute right-3 top-24 z-10 w-[19rem] border border-[var(--carbon)] bg-[var(--surface)] shadow-xl">
          <header className="flex items-center gap-2 bg-[var(--carbon)] px-3 py-2">
            <span className="cmd min-w-0 flex-1 truncate text-[15px] leading-none text-white">
              {selected.district}
              <span className="text-[var(--rail-muted)]"> / Sector </span>
              <span className="mono text-[13px]">
                {gridRef(selected.lat, selected.lng)}
              </span>
            </span>
            <span
              aria-hidden
              className="live-dot size-1.5 shrink-0"
              style={{ background: "var(--jade)", color: "var(--jade)" }}
            />
            <span className="eyebrow shrink-0 text-[var(--rail-muted)]">Live</span>
            <button
              type="button"
              onClick={() => onSelectDistrict(null)}
              aria-label="Close district panel"
              className="shrink-0 text-[var(--rail-muted)] hover:text-white"
            >
              <X className="size-4" />
            </button>
          </header>

          <div
            className="flex items-center justify-between gap-2 border-b-2 px-3 py-1.5"
            style={{ borderColor: RISK_META[selected.risk].color }}
          >
            <Coordinates lat={selected.lat} lng={selected.lng} />
            <span
              className="cmd text-[12px]"
              style={{ color: RISK_META[selected.risk].color }}
            >
              {RISK_META[selected.risk].label} Risk
            </span>
          </div>

          {/* ResQ Pulse meter — the same instrument as the home panel, so the
              signature reads identically wherever it appears. */}
          <div className="border-b border-[var(--hairline)] px-3 py-2">
            <div className="flex items-baseline justify-between">
              <span className="eyebrow text-[var(--muted)]">ResQ Pulse</span>
              <span
                className="cmd text-[12px]"
                style={{ color: RISK_META[selected.risk].color }}
              >
                Level {RISK_META[selected.risk].rank + 1} / 5
              </span>
            </div>
            <div
              className="mt-1 flex items-end gap-[2px]"
              role="meter"
              aria-valuenow={RISK_META[selected.risk].rank + 1}
              aria-valuemin={1}
              aria-valuemax={5}
              aria-label={`ResQ Pulse level ${RISK_META[selected.risk].rank + 1} of 5`}
            >
              {Array.from({ length: 20 }, (_, k) => (
                <span
                  key={k}
                  aria-hidden
                  className="h-2.5 flex-1"
                  style={{
                    background:
                      k < Math.round(((RISK_META[selected.risk].rank + 1) / 5) * 20)
                        ? RISK_META[selected.risk].color
                        : "var(--surface-3)",
                  }}
                />
              ))}
            </div>
          </div>

          <p className="px-3 py-2 text-xs leading-relaxed text-[var(--muted)]">
            {selected.headline}
          </p>

          <dl className="grid grid-cols-2 border-t border-[var(--hairline)]">
            <Stat label="Incidents" value={selected.activeIncidents} tone="var(--coral)" />
            <Stat label="Units" value={selected.responseTeams} tone="var(--teal)" />
            <Stat label="Shelters Open" value={selected.sheltersOpen} tone="var(--jade)" />
            <Stat
              label="People Affected"
              value={selected.peopleAffected.toLocaleString("en-IN")}
              tone="var(--foreground)"
            />
          </dl>

          {selectedShelters.length > 0 && (
            <div className="border-t border-[var(--hairline)] px-3 py-2">
              <p className="eyebrow text-[var(--muted)]">Shelters In District</p>
              <ul className="mt-1 space-y-0.5">
                {selectedShelters.map((sh) => (
                  <li key={sh.id} className="mono flex justify-between gap-2 text-[11px]">
                    <span className="truncate">{sh.name}</span>
                    <span className="shrink-0 font-semibold">
                      {sh.occupancy}/{sh.capacity}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="telemetry border-t border-[var(--hairline)] bg-[var(--surface-2)] px-3 py-1.5">
            Updated {new Date(selected.updatedAt).toTimeString().slice(0, 8)} IST
          </p>
        </aside>
      )}

      {/* Legend.
          One compact bar, hazard classes first because that is what an
          operator is actually scanning the map for; the district risk ramp
          follows on a second rule because the discs need explaining. */}
      <div className="notch-sm absolute bottom-3 left-3 right-3 z-10 border border-[var(--carbon)] bg-[var(--surface)]/95 shadow-sm sm:right-auto sm:max-w-sm">
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2.5 py-1.5">
          {LEGEND_LAYERS.map((layer) => (
            <li key={layer} className="flex items-center gap-1.5">
              {/* The same pin the map draws, at the same size — a legend whose
                  swatch does not match its marker is worse than no legend. */}
              <span
                aria-hidden
                className="inline-flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-white text-white shadow-[0_1px_2px_rgba(0,0,0,.35)]"
                style={{ background: MAP_LAYER_META[layer].color }}
                dangerouslySetInnerHTML={{
                  __html: markerSvg(LAYER_GLYPH[layer] ?? LAYER_GLYPH.citizen_report),
                }}
              />
              <span className="cmd text-[10px]">{MAP_LAYER_META[layer].label}</span>
            </li>
          ))}
        </ul>
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--hairline)] bg-[var(--surface-2)] px-2.5 py-1">
          <li className="eyebrow text-[9px] text-[var(--muted)]">District risk</li>
          {(Object.keys(RISK_META) as (keyof typeof RISK_META)[]).map((r) => (
            <li key={r} className="flex items-center gap-1">
              <span
                aria-hidden
                className="inline-block size-2.5 rounded-full border"
                style={{ background: RISK_META[r].fill, borderColor: RISK_META[r].color }}
              />
              <span className="cmd text-[10px]">{RISK_META[r].label}</span>
            </li>
          ))}
        </ul>
        <p className="border-t border-[var(--hairline)] px-2.5 py-1 text-[9px] leading-tight text-[var(--faint)]">
          Discs mark district centroids and show risk posture — they are not
          administrative boundaries.
        </p>
        {/* On a narrow map the marker count rides inside the legend rather
            than as a second floating chip that would overlap it. */}
        <p className="mono border-t border-[var(--hairline)] bg-[var(--surface-2)] px-2.5 py-1 text-[10px] font-semibold sm:hidden">
          {visibleMarkers.length} MARKERS · OVERLAPS GROUPED
        </p>
      </div>

      {/* Live stamp */}
      <MapLiveStamp
        detail={`${visibleMarkers.length} MARKERS · OVERLAPS GROUPED`}
      />
    </div>
  );
}

/** The hazard classes the map legend names, in the reference portal's order. */
const LEGEND_LAYERS: MapLayer[] = ["cyclone", "flood", "fire", "warning", "shelter"];

/**
 * The bottom-right map stamp: feed state, wall clock, marker count.
 *
 * The clock is mount-gated. The server has no business guessing the operator's
 * wall time, and rendering one during SSR guarantees a hydration mismatch a
 * second later.
 *
 * The feed word is the honest one. When the platform is running on mock data
 * the stamp says DEMO DATA in amber and does not pulse — a green LIVE dot over
 * fixture data is exactly the lie this interface is built not to tell.
 */
function MapLiveStamp({ detail }: { detail: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const first = setTimeout(() => setNow(new Date()), 0);
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  const demo = USE_MOCK;

  return (
    <div className="notch-sm absolute bottom-3 right-3 z-10 hidden items-center gap-2 border border-[var(--carbon)] bg-[var(--surface)]/95 px-2 py-1 shadow-sm sm:flex">
      <span
        aria-hidden
        className={`size-1.5 rounded-full ${demo ? "" : "live-dot"}`}
        style={{
          background: demo ? "var(--medium)" : "var(--ok)",
          color: demo ? "var(--medium)" : "var(--ok)",
        }}
      />
      <span
        className="cmd text-[10px]"
        style={{ color: demo ? "var(--amber-600)" : "var(--ok)" }}
      >
        {demo ? "Demo data" : "Live"}
      </span>
      <span aria-hidden className="h-3 w-px bg-[var(--hairline)]" />
      <span className="mono text-[10px] font-semibold">
        {now
          ? `${now.toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}, ${now.toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })}`
          : "—"}
      </span>
      <span aria-hidden className="h-3 w-px bg-[var(--hairline)]" />
      <span className="mono text-[10px] font-semibold text-[var(--muted)]">{detail}</span>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: string;
}) {
  return (
    <div className="border-b border-r border-[var(--hairline)] px-3 py-1.5 last:border-r-0 [&:nth-child(2n)]:border-r-0">
      <dt className="eyebrow text-[var(--muted)]">{label}</dt>
      <dd className="mono mt-0.5 text-[17px] font-semibold leading-none" style={{ color: tone }}>
        {value}
      </dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cartographic overlays                                               */
/* ------------------------------------------------------------------ */

const GRATICULE_SOURCE = "resq-graticule";
const TRACK_SOURCE = "resq-track";

/**
 * The map grid, as real geography.
 *
 * Meridians and parallels on the MAP_GRID lattice, added as a MapLibre source
 * so they pan and zoom with the ground. `showGrid` toggles visibility rather
 * than removing the layer, which avoids churning the style on every click.
 */
function syncGraticule(map: MapLibreMap, visible: boolean): void {
  const lines: [number, number][][] = [];
  for (let c = 0; c <= MAP_GRID.cols; c++) {
    const lng = MAP_GRID.west + (c / MAP_GRID.cols) * (MAP_GRID.east - MAP_GRID.west);
    lines.push([
      [lng, MAP_GRID.south],
      [lng, MAP_GRID.north],
    ]);
  }
  for (let r = 0; r <= MAP_GRID.rows; r++) {
    const lat = MAP_GRID.south + (r / MAP_GRID.rows) * (MAP_GRID.north - MAP_GRID.south);
    lines.push([
      [MAP_GRID.west, lat],
      [MAP_GRID.east, lat],
    ]);
  }

  const data: GeoJSON.Feature<GeoJSON.MultiLineString> = {
    type: "Feature",
    properties: {},
    geometry: { type: "MultiLineString", coordinates: lines },
  };

  if (!map.getSource(GRATICULE_SOURCE)) {
    map.addSource(GRATICULE_SOURCE, { type: "geojson", data });
    map.addLayer({
      id: GRATICULE_SOURCE,
      type: "line",
      source: GRATICULE_SOURCE,
      paint: {
        "line-color": "#17211f",
        "line-opacity": 0.16,
        "line-width": 1,
        "line-dasharray": [3, 3],
      },
    });
  }
  if (map.getLayer(GRATICULE_SOURCE)) {
    map.setLayoutProperty(
      GRATICULE_SOURCE,
      "visibility",
      visible ? "visible" : "none",
    );
  }
}

/**
 * Projected cyclone track towards the Kutch coast.
 *
 * Dashed, in amber, because it is a FORECAST track from the demo dataset and
 * not an observed position. It is drawn on the map for the same reason it is
 * drawn on a real operations wall — the shape of the approach is the thing
 * people reason about — but it is never styled like observed data, and the
 * radar panel it belongs to carries the DEMO DATA tag.
 */
function syncCycloneTrack(map: MapLibreMap): void {
  const track: [number, number][] = [
    [66.4, 20.4],
    [67.3, 21.3],
    [68.2, 22.2],
    [69.0, 22.9],
    [69.6, 23.4],
    [69.86, 23.73],
  ];

  const data: GeoJSON.Feature<GeoJSON.LineString> = {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: track },
  };

  if (!map.getSource(TRACK_SOURCE)) {
    map.addSource(TRACK_SOURCE, { type: "geojson", data });
    map.addLayer({
      id: `${TRACK_SOURCE}-line`,
      type: "line",
      source: TRACK_SOURCE,
      paint: {
        "line-color": "#e5a72e",
        "line-width": 2,
        "line-dasharray": [2, 2],
      },
    });
  }
}
