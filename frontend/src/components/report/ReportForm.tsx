"use client";

/**
 * Citizen SOS form — mobile first.
 *
 * The essential path is description → send, and it stays under ~20 seconds.
 * Emergency type, urgency, location, media, voice, people affected, special
 * assistance and contact details are all optional, and none of them can block
 * submission: someone reporting an emergency may have denied GPS, no signal
 * for map tiles, a refused microphone, or one free hand.
 *
 * When the device is offline the submission is queued locally and the caller
 * is told plainly that it has NOT reached the control room.
 */

import { useState } from "react";
import type {
  CitizenUrgency,
  DisasterType,
  IncidentType,
  Lang,
  ReportCreate,
  ReportCreateResponse,
  ReportSource,
} from "@/types";
import {
  DISASTER_META,
  disasterLabel,
  PLATFORM_STRINGS,
  SOS_DISASTER_TYPES,
  SPECIAL_ASSISTANCE,
  UI_STRINGS,
} from "@/lib/constants";
import { enqueue, submitReport } from "@/lib/api";
import { EmergencyCallBanner } from "@/components/layout/EmergencyContacts";
import { LanguageToggle } from "./LanguageToggle";
import { LocationPicker, type LocationValue } from "./LocationPicker";
import { PhotoInput } from "./PhotoInput";
import { VoiceInput } from "./VoiceInput";

/**
 * The platform offers nine disaster categories; the dispatcher contract has
 * seven incident types. This is the agreed reduction — cyclone and earthquake
 * have no contract equivalent, so they map to their dominant hazard.
 */
const DISASTER_TO_INCIDENT: Record<DisasterType, IncidentType> = {
  flood: "flood",
  cyclone: "flood",
  fire: "fire",
  earthquake: "building_collapse",
  medical: "medical",
  road_block: "road_accident",
  infrastructure: "building_collapse",
  missing_person: "other",
  heavy_rainfall: "flood",
  other: "other",
};

const URGENCY: { id: CitizenUrgency; label: string; tone: string }[] = [
  { id: "immediate", label: "Life at risk now", tone: "var(--critical)" },
  { id: "urgent", label: "Urgent help needed", tone: "var(--high)" },
  { id: "standard", label: "Needs attention", tone: "var(--medium)" },
];

export function ReportForm({
  lang,
  onLangChange,
  onSubmitted,
}: {
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  onSubmitted: (
    result: ReportCreateResponse,
    originalText: string,
    queued: boolean,
  ) => void;
}) {
  const t = UI_STRINGS[lang];
  const p = PLATFORM_STRINGS[lang];

  const [text, setText] = useState("");
  const [disaster, setDisaster] = useState<DisasterType | null>(null);
  const [urgency, setUrgency] = useState<CitizenUrgency | null>(null);
  const [people, setPeople] = useState("");
  const [assistance, setAssistance] = useState<string[]>([]);
  const [location, setLocation] = useState<LocationValue>({
    lat: null,
    lng: null,
    address: "",
    source: "none",
    accuracy_m: null,
  });
  const [media, setMedia] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState<ReportSource>("citizen");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const textMissing = text.trim().length === 0;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (textMissing) return;

    setSubmitting(true);
    setError(null);
    const originalText = text.trim();
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;

    // Built once so the queued copy is byte-for-byte what the send attempted.
    // Queueing a summary instead of the body is how a report gets lost.
    const body: ReportCreate = {
      source,
      text: originalText,
      lang,
      lat: location.lat,
      lng: location.lng,
      address: location.address.trim() || null,
      photo_url: media,
      reporter: buildReporter(name, phone),
      sensor: null,
      citizen_type: disaster ? DISASTER_TO_INCIDENT[disaster] : null,
      disaster_type: disaster,
      citizen_urgency: urgency,
      people_affected: people.trim() === "" ? null : Number(people),
      special_assistance: assistance,
    };

    try {
      const result = await submitReport(body);
      onSubmitted(result, originalText, offline);
    } catch (err) {
      // A failed send is queued rather than lost, but the caller is told.
      enqueue({ kind: "report", label: originalText.slice(0, 60), payload: body });
      setError(err instanceof Error ? err.message : t.submitError);
    } finally {
      setSubmitting(false);
    }
  }

  function toggleAssistance(id: string) {
    setAssistance((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <EmergencyCallBanner text={t.callBanner} />

      <div>
        <span className="mb-1.5 block text-sm font-semibold">{t.language}</span>
        <LanguageToggle value={lang} onChange={onLangChange} label={t.language} />
      </div>

      {/* The one required field. */}
      <div>
        <label htmlFor="report-text" className="block text-sm font-semibold">
          {t.whatHappening} <span style={{ color: "var(--critical)" }}>*</span>
        </label>
        <textarea
          id="report-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t.describePlaceholder}
          rows={4}
          lang={lang}
          required
          aria-invalid={touched && textMissing}
          aria-describedby={touched && textMissing ? "report-text-error" : undefined}
          className="mt-1.5 w-full border border-[var(--border-strong)] bg-[var(--surface)] px-2.5 py-2 text-base leading-relaxed"
        />
        {touched && textMissing && (
          <p
            id="report-text-error"
            role="alert"
            className="mt-1 text-xs font-medium"
            style={{ color: "var(--critical)" }}
          >
            {t.required}
          </p>
        )}
      </div>

      {/* Emergency type */}
      <div>
        <span className="block text-sm font-semibold">{t.emergencyType}</span>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {SOS_DISASTER_TYPES.map((option) => {
            const active = disaster === option;
            const meta = DISASTER_META[option];
            return (
              <button
                key={option}
                type="button"
                onClick={() => setDisaster(active ? null : option)}
                aria-pressed={active}
                className="flex min-h-12 items-center gap-2 border px-2.5 text-left text-[13px] font-medium"
                style={
                  active
                    ? { borderColor: meta.color, background: `${meta.color}14`, color: meta.color }
                    : { borderColor: "var(--border-strong)" }
                }
              >
                <span
                  aria-hidden
                  className="inline-block size-2.5 shrink-0 rounded-full"
                  style={{ background: meta.color }}
                />
                <span className="truncate">{disasterLabel(option, lang)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Urgency */}
      <fieldset>
        <legend className="text-sm font-semibold">How urgent is it?</legend>
        <div className="mt-1.5 flex flex-col gap-1.5 sm:flex-row">
          {URGENCY.map((u) => {
            const active = urgency === u.id;
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => setUrgency(active ? null : u.id)}
                aria-pressed={active}
                className="min-h-12 flex-1 border px-2 text-sm font-semibold"
                style={
                  active
                    ? { borderColor: u.tone, background: `${u.tone}14`, color: u.tone }
                    : { borderColor: "var(--border-strong)" }
                }
              >
                {u.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">
          This helps the control room order the queue. It does not set the official
          priority — an operator does that.
        </p>
      </fieldset>

      <LocationPicker
        value={location}
        onChange={setLocation}
        labels={{
          location: t.location,
          useMyLocation: t.useMyLocation,
          locating: t.locating,
          locationDenied: t.locationDenied,
          locationUnavailable: t.locationUnavailable,
          locationInsecure: t.locationInsecure,
          adjustLocation: t.adjustLocation,
          landmarkLabel: t.landmarkLabel,
          landmarkPlaceholder: t.landmarkPlaceholder,
        }}
      />

      <PhotoInput
        value={media}
        onChange={setMedia}
        label={`${t.photo} / video`}
        addLabel={t.addPhoto}
        removeLabel={t.removePhoto}
        errorLabel={t.photoError}
      />

      <VoiceInput
        lang={lang}
        onTranscript={(chunk) => setText((prev) => (prev ? `${prev} ${chunk}` : chunk))}
        label={t.voice}
        startLabel={t.startVoice}
        stopLabel={t.stopVoice}
        unsupportedLabel={t.voiceUnsupported}
        insecureLabel={t.voiceInsecure}
        hintLabel={t.voiceHint}
      />

      {/* People affected */}
      <label className="block">
        <span className="text-sm font-semibold">How many people are affected?</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={people}
          onChange={(e) => setPeople(e.target.value)}
          placeholder="Leave blank if you are not sure"
          className="mt-1.5 min-h-12 w-full border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-base"
        />
      </label>

      {/* Special assistance */}
      <fieldset>
        <legend className="text-sm font-semibold">
          Does anyone need special assistance?
        </legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {SPECIAL_ASSISTANCE.map((option) => {
            const active = assistance.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => toggleAssistance(option.id)}
                aria-pressed={active}
                className={`min-h-11 border px-3 text-sm ${
                  active
                    ? "border-[var(--info)] bg-[var(--info-bg)] font-semibold text-[var(--info)]"
                    : "border-[var(--border-strong)]"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <details className="border border-[var(--border)]">
        <summary className="min-h-11 cursor-pointer px-3 py-2.5 text-sm font-semibold">
          {t.contact}
        </summary>
        <div className="space-y-2 px-3 pb-3">
          <label className="block">
            <span className="block text-xs font-medium text-[var(--muted)]">{t.yourName}</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="mt-1 min-h-11 w-full border border-[var(--border-strong)] bg-[var(--surface)] px-2 py-1.5 text-base"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-[var(--muted)]">{t.yourPhone}</span>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              className="mt-1 min-h-11 w-full border border-[var(--border-strong)] bg-[var(--surface)] px-2 py-1.5 text-base"
            />
          </label>
        </div>
      </details>

      {/* Demo aid: lets the same form stand in for a 112 call or a field unit.
          "sensor" is deliberately absent. A sensor report is only valid with a
          sensor block attached, and this form has no sensor to describe, so
          choosing it sent `sensor: null` and the API rejected every one with a
          422. An option that cannot succeed does not belong on a form a
          citizen is using during an emergency. Sensor ingestion belongs to the
          simulator on /dashboard, which has real readings to send. */}
      <details className="border border-dashed border-[var(--border)]">
        <summary className="min-h-11 cursor-pointer px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Demo — submit as
        </summary>
        <div className="flex flex-wrap gap-1.5 px-3 pb-3">
          {(["citizen", "call", "field"] as ReportSource[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setSource(option)}
              aria-pressed={source === option}
              className={`min-h-11 border px-3 text-sm ${
                source === option
                  ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--surface)]"
                  : "border-[var(--border-strong)] bg-[var(--surface)]"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </details>

      {error && (
        <div
          role="alert"
          className="border-l-4 px-3 py-2.5"
          style={{ borderColor: "var(--critical)", background: "var(--critical-bg)" }}
        >
          <p className="text-sm font-semibold">{t.submitError}</p>
          <p className="mono mt-1 text-xs text-[var(--muted)]">{error}</p>
          <p className="mt-1 text-xs">
            Your report has been saved on this device and will be sent when the
            connection returns. If this is life-threatening, call{" "}
            <a href="tel:112" className="font-bold underline">
              112
            </a>{" "}
            now.
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="min-h-14 w-full border border-[var(--coral-deep)] bg-[var(--coral)] px-4 text-lg font-bold uppercase tracking-wide text-white hover:bg-[#9a1b27] disabled:opacity-70"
      >
        {submitting ? t.submitting : error ? t.retry : p.reportEmergency}
      </button>
    </form>
  );
}

/** Contact details are optional; fall back to a generic channel label. */
function buildReporter(name: string, phone: string): string {
  const parts = [name.trim(), phone.trim()].filter(Boolean);
  return parts.length ? `${parts.join(" · ")} (citizen app)` : "Citizen app";
}
