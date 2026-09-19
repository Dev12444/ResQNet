"use client";

/**
 * MapLibre worker setup.
 *
 * MapLibre 6 spawns its worker from a separate ESM chunk
 * (`maplibre-gl-worker.mjs`, which in turn imports `maplibre-gl-shared.mjs`).
 * Turbopack does not emit those as fetchable assets, so the worker URL 404s,
 * the dev server answers with its HTML error page, and the browser refuses it
 * with "non-JavaScript MIME type". The worker never starts, the style never
 * parses, and the map renders as a blank canvas with no network activity —
 * no error is thrown, which makes it easy to misdiagnose as a tile problem.
 *
 * The fix is to serve both files ourselves from `public/maplibre/` and point
 * MapLibre at them. They are copied verbatim from the installed package; if
 * `maplibre-gl` is upgraded, re-copy them:
 *
 *   cp node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs \
 *      node_modules/maplibre-gl/dist/maplibre-gl-shared.mjs public/maplibre/
 */

import { setWorkerUrl } from "maplibre-gl";

let configured = false;

/** Idempotent — safe to call from every component that creates a Map. */
export function ensureMapLibreWorker(): void {
  if (configured || typeof window === "undefined") return;
  configured = true;
  try {
    setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
  } catch {
    // If the override fails, MapLibre falls back to its bundled worker path.
    // The map's own error handler surfaces the failure to the user.
  }
}
