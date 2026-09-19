"use client";

/**
 * UPDATE SITUATION — the responder's correction channel.
 *
 * What a unit sees on scene outranks what the report said and what the model
 * inferred. This form is how that correction gets back into the system, so it
 * covers every field the initial classification could have got wrong.
 */

import { useState } from "react";
import type {
  Assignment,
  Hazard,
  Incident,
  ResourceKind,
  RoadAccess,
  Severity,
  SituationUpdate,
} from "@/types";
import {
  HAZARD_LABEL,
  HAZARD_OPTIONS,
  RESOURCE_KIND_META,
  ROAD_ACCESS_LABEL,
  SEVERITY_COLOR,
  SEVERITY_LABEL,
} from "@/lib/constants";
import { readableOn } from "@/components/layout/primitives";
import { isSecureContext } from "@/lib/secureContext";

const SEVERITIES: Severity[] = [1, 2, 3, 4, 5];
const ROAD_OPTIONS: RoadAccess[] = ["clear", "partially_blocked", "blocked", "unknown"];
const KINDS: ResourceKind[] = [
  "ambulance",
  "fire_truck",
  "rescue_boat",
  "police",
  "ndrf_team",
  "hazmat",
];

export function SituationUpdateForm({
  incident,
  assignment,
  onSubmit,
  onCancel,
  submitting,
  error,
}: {
  incident: Incident;
  assignment: Assignment;
  onSubmit: (update: SituationUpdate) => void;
  onCancel: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const [severity, setSeverity] = useState<Severity | null>(null);
  const [people, setPeople] = useState("");
  const [hazards, setHazards] = useState<Hazard[]>(incident.hazards);
  const [road, setRoad] = useState<RoadAccess>("unknown");
  const [notes, setNotes] = useState("");
  const [extra, setExtra] = useState<ResourceKind[]>([]);
  const [resolved, setResolved] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  function useMyPosition() {
    // A responder's phone on the LAN over plain HTTP gets no prompt at all.
    if (!isSecureContext()) {
      setLocError(
        "This page is not on a secure (HTTPS) connection, so the browser blocks location. Describe the position in the notes instead.",
      );
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocError("Location unavailable on this device. Describe it in the notes instead.");
      return;
    }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocError("Could not get a fix. Describe the correct location in the notes.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function toggle<T>(list: T[], value: T, set: (next: T[]) => void) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  return (
    <form
      className="space-y-4 border-2 border-[var(--border-strong)] bg-[var(--surface)] p-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          incident_id: incident.id,
          assignment_id: assignment.id,
          severity,
          people_affected: people.trim() === "" ? null : Number(people),
          hazards,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          road_access: road,
          notes: notes.trim(),
          additional_resources: extra,
          resolved,
          reported_at: new Date().toISOString(),
        });
      }}
    >
      <h2 className="text-base font-bold uppercase tracking-wide">Update situation</h2>
      <p className="-mt-2 text-xs text-[var(--muted)]">
        What you record here replaces the reported picture. Leave a field blank to keep the
        current value.
      </p>

      <fieldset>
        <legend className="text-sm font-semibold">Severity as you find it</legend>
        <p className="text-xs text-[var(--muted)]">
          Reported: SEV {incident.severity} · {SEVERITY_LABEL[incident.severity]}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {SEVERITIES.map((s) => {
            const active = severity === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSeverity(active ? null : s)}
                aria-pressed={active}
                className="min-h-12 min-w-16 border-2 px-2 text-sm font-bold"
                style={
                  active
                    ? {
                        background: SEVERITY_COLOR[s],
                        color: readableOn(SEVERITY_COLOR[s]),
                        borderColor: SEVERITY_COLOR[s],
                      }
                    : { borderColor: "var(--border-strong)" }
                }
              >
                SEV {s}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="block">
        <span className="text-sm font-semibold">People affected</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={people}
          onChange={(e) => setPeople(e.target.value)}
          placeholder={
            incident.people_affected_est === null
              ? "Not estimated"
              : `Reported: ${incident.people_affected_est}`
          }
          className="mt-1 min-h-12 w-full border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-base"
        />
      </label>

      <fieldset>
        <legend className="text-sm font-semibold">Hazards present</legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {HAZARD_OPTIONS.map((h) => {
            const active = hazards.includes(h);
            return (
              <button
                key={h}
                type="button"
                onClick={() => toggle(hazards, h, setHazards)}
                aria-pressed={active}
                className={`min-h-11 border px-2.5 text-sm ${
                  active
                    ? "border-[var(--high)] bg-[var(--high-bg)] font-semibold text-[var(--high)]"
                    : "border-[var(--border-strong)]"
                }`}
              >
                {HAZARD_LABEL[h]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold">Road access</legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {ROAD_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoad(r)}
              aria-pressed={road === r}
              className={`min-h-11 border px-2.5 text-sm ${
                road === r
                  ? "border-[var(--foreground)] bg-[var(--foreground)] font-semibold text-[var(--surface)]"
                  : "border-[var(--border-strong)]"
              }`}
            >
              {ROAD_ACCESS_LABEL[r]}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <span className="text-sm font-semibold">Corrected location</span>
        <button
          type="button"
          onClick={useMyPosition}
          disabled={locating}
          className="mt-1.5 min-h-12 w-full border border-[var(--border-strong)] px-3 text-sm font-semibold hover:bg-[var(--surface-2)] disabled:opacity-60"
        >
          {locating ? "Getting fix…" : "Use my current position"}
        </button>
        {coords && (
          <p className="mono mt-1 text-xs text-[var(--muted)]">
            {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </p>
        )}
        {locError && (
          <p className="mt-1 text-xs" style={{ color: "var(--high)" }}>
            {locError}
          </p>
        )}
      </div>

      <fieldset>
        <legend className="text-sm font-semibold">Additional resources needed</legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {KINDS.map((k) => {
            const active = extra.includes(k);
            return (
              <button
                key={k}
                type="button"
                onClick={() => toggle(extra, k, setExtra)}
                aria-pressed={active}
                className={`min-h-11 border px-2.5 text-sm ${
                  active
                    ? "border-[var(--info)] bg-[var(--info-bg)] font-semibold text-[var(--info)]"
                    : "border-[var(--border-strong)]"
                }`}
              >
                {RESOURCE_KIND_META[k].label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="block">
        <span className="text-sm font-semibold">Notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="What the control room needs to know"
          className="mt-1 w-full border border-[var(--border-strong)] bg-[var(--surface)] px-2 py-1.5 text-base"
        />
      </label>

      <label className="flex min-h-12 items-center gap-2.5 border border-[var(--border-strong)] px-3">
        <input
          type="checkbox"
          checked={resolved}
          onChange={(e) => setResolved(e.target.checked)}
          className="size-5"
        />
        <span className="text-sm font-semibold">Incident resolved at this location</span>
      </label>

      {error && (
        <p
          role="alert"
          className="border-l-4 px-3 py-2 text-sm"
          style={{ borderColor: "var(--critical)", background: "var(--critical-bg)" }}
        >
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-14 flex-1 border border-[var(--border-strong)] px-3 font-semibold"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="min-h-14 flex-[2] border-2 border-[var(--foreground)] bg-[var(--foreground)] px-3 font-bold uppercase tracking-wide text-[var(--surface)] disabled:opacity-70"
        >
          {submitting ? "Sending…" : "Send update"}
        </button>
      </div>
    </form>
  );
}
