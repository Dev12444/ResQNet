"use client";

/**
 * Drag-a-pin location correction.
 *
 * Loaded lazily and only when the citizen chooses to adjust the location — the
 * 20-second reporting path must not wait on map tiles. If the tile server is
 * unreachable the caller keeps the typed-landmark fallback, so this component
 * failing never blocks a report.
 */

import { useEffect, useRef, useState } from "react";
import { Map as MapLibreMap, Marker, NavigationControl } from "maplibre-gl";
import type { MapMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { GUJARAT_CENTER } from "@/lib/constants";

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

export default function MapPinPicker({
  lat,
  lng,
  onChange,
}: {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  // Latest callback, read from map handlers without re-running the init effect.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Only the first coordinates matter — the map owns the pin after that.
  const start = useRef({
    lat: lat ?? GUJARAT_CENTER.lat,
    lng: lng ?? GUJARAT_CENTER.lng,
  });

  useEffect(() => {
    const el = container.current;
    if (!el) return;

    let map: MapLibreMap | null = null;
    let marker: Marker | null = null;
    let cancelled = false;

    const init = () => {
      if (cancelled) return;
      try {
        map = new MapLibreMap({
          container: el,
          style: STYLE_URL,
          center: [start.current.lng, start.current.lat],
          zoom: 15,
          attributionControl: { compact: true },
        });
        map.addControl(new NavigationControl({ showCompass: false }), "top-right");
        map.on("error", () => setFailed(true));

        const pin = new Marker({ draggable: true, color: "#dc2626" })
          .setLngLat([start.current.lng, start.current.lat])
          .addTo(map);
        marker = pin;

        pin.on("dragend", () => {
          const pos = pin.getLngLat();
          onChangeRef.current(pos.lat, pos.lng);
        });

        map.on("click", (event: MapMouseEvent) => {
          pin.setLngLat(event.lngLat);
          onChangeRef.current(event.lngLat.lat, event.lngLat.lng);
        });
      } catch {
        setFailed(true);
      }
    };

    // Deferred so no state is set synchronously during the effect body.
    const timer = setTimeout(init, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      marker?.remove();
      map?.remove();
    };
  }, []);

  if (failed) {
    return (
      <p
        className="border-l-4 px-3 py-2 text-xs"
        style={{ borderColor: "var(--high)", background: "var(--high-bg)" }}
      >
        Map could not load. Type the nearest landmark below instead — your report still works.
      </p>
    );
  }

  return (
    <div>
      <div
        ref={container}
        className="h-56 w-full border border-[var(--border)]"
        role="application"
        aria-label="Drag the pin to correct the location"
      />
      <p className="mt-1 text-xs text-[var(--muted)]">
        Tap the map or drag the pin to correct the location.
      </p>
    </div>
  );
}
