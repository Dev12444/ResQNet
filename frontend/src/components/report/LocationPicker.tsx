"use client";

/**
 * Location capture with three independent paths, in order of effort:
 *   1. GPS via `navigator.geolocation`
 *   2. Drag a pin on a map (loaded only on request)
 *   3. Type the nearest landmark
 *
 * Any one of them is enough. Permission refusal, an insecure origin, a
 * timeout, or a browser with no geolocation at all leaves the citizen on path
 * 3 with a clear explanation — the report always remains submittable.
 */

import dynamic from "next/dynamic";
import { useState } from "react";
import { isSecureContext } from "@/lib/secureContext";

const MapPinPicker = dynamic(() => import("./MapPinPicker"), {
  ssr: false,
  loading: () => (
    <div className="flex h-56 items-center justify-center border border-[var(--border)] text-xs text-[var(--muted)]">
      Loading map…
    </div>
  ),
});

export interface LocationValue {
  lat: number | null;
  lng: number | null;
  address: string;
  /** How the coordinates were obtained — shown to the operator later. */
  source: "gps" | "pin" | "none";
  accuracy_m: number | null;
}

export function LocationPicker({
  value,
  onChange,
  labels,
}: {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  labels: {
    location: string;
    useMyLocation: string;
    locating: string;
    locationDenied: string;
    locationInsecure: string;
    adjustLocation: string;
    landmarkLabel: string;
    landmarkPlaceholder: string;
  };
}) {
  const [status, setStatus] = useState<
    "idle" | "locating" | "denied" | "insecure"
  >("idle");
  const [showMap, setShowMap] = useState(false);

  function locate() {
    // A phone opening this over the LAN on plain HTTP is not a secure context,
    // so the browser refuses before it ever prompts. Saying "denied" there
    // blames the citizen for a refusal they were never offered.
    if (!isSecureContext()) {
      setStatus("insecure");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("denied");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStatus("idle");
        onChange({
          ...value,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          source: "gps",
          accuracy_m: Math.round(pos.coords.accuracy),
        });
      },
      // Covers denial, position-unavailable and timeout alike: the citizen
      // does not need to know which, only that typing still works.
      () => setStatus("denied"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  const hasFix = value.lat !== null && value.lng !== null;

  return (
    <fieldset className="border border-[var(--border)] px-3 py-2.5">
      <legend className="px-1 text-sm font-semibold">{labels.location}</legend>

      <button
        type="button"
        onClick={locate}
        disabled={status === "locating"}
        className="flex min-h-11 w-full items-center justify-center gap-2 border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm font-semibold hover:bg-[var(--surface-2)] disabled:opacity-60"
      >
        {status === "locating" ? labels.locating : labels.useMyLocation}
      </button>

      {hasFix && (
        <p className="mono mt-2 text-xs text-[var(--muted)]">
          {value.lat!.toFixed(5)}, {value.lng!.toFixed(5)}
          {value.accuracy_m !== null && ` · ±${value.accuracy_m} m`}
          {value.source === "pin" && " · pin"}
        </p>
      )}

      {(status === "denied" || status === "insecure") && (
        <p
          role="status"
          className="mt-2 border-l-4 px-2 py-1.5 text-xs"
          style={{ borderColor: "var(--high)", background: "var(--high-bg)" }}
        >
          {status === "insecure" ? labels.locationInsecure : labels.locationDenied}
        </p>
      )}

      <button
        type="button"
        onClick={() => setShowMap((s) => !s)}
        aria-expanded={showMap}
        className="mt-2 min-h-11 w-full border border-[var(--border)] px-3 text-sm hover:bg-[var(--surface-2)]"
      >
        {labels.adjustLocation}
      </button>

      {showMap && (
        <div className="mt-2">
          <MapPinPicker
            lat={value.lat}
            lng={value.lng}
            onChange={(lat, lng) =>
              onChange({ ...value, lat, lng, source: "pin", accuracy_m: null })
            }
          />
        </div>
      )}

      <label className="mt-2 block">
        <span className="block text-xs font-medium text-[var(--muted)]">
          {labels.landmarkLabel}
        </span>
        <input
          type="text"
          value={value.address}
          onChange={(e) => onChange({ ...value, address: e.target.value })}
          placeholder={labels.landmarkPlaceholder}
          className="mt-1 min-h-11 w-full border border-[var(--border-strong)] bg-[var(--surface)] px-2 py-1.5 text-base"
        />
      </label>
    </fieldset>
  );
}
