"use client";

/**
 * Citizen reporting form — mobile first.
 *
 * The essential path is description → send. Everything else (type, location,
 * photo, voice, contact details) is optional and none of it can block
 * submission, because a person reporting an emergency may have no GPS
 * permission, no signal for tiles, a denied microphone, or one free hand.
 */

import { useState } from "react";
import type { IncidentType, Lang, ReportCreateResponse, ReportSource } from "@/types";
import { TYPE_LABEL_I18N, UI_STRINGS } from "@/lib/constants";
import { submitReport } from "@/lib/api";
import { EmergencyCallBanner } from "@/components/layout/EmergencyContacts";
import { LanguageToggle } from "./LanguageToggle";
import { LocationPicker, type LocationValue } from "./LocationPicker";
import { PhotoInput } from "./PhotoInput";
import { VoiceInput } from "./VoiceInput";

const TYPES: IncidentType[] = [
  "flood",
  "fire",
  "road_accident",
  "industrial",
  "medical",
  "building_collapse",
  "other",
];

export function ReportForm({
  lang,
  onLangChange,
  onSubmitted,
}: {
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  onSubmitted: (result: ReportCreateResponse, originalText: string) => void;
}) {
  const t = UI_STRINGS[lang];

  const [text, setText] = useState("");
  const [type, setType] = useState<IncidentType | null>(null);
  const [location, setLocation] = useState<LocationValue>({
    lat: null,
    lng: null,
    address: "",
    source: "none",
    accuracy_m: null,
  });
  const [photo, setPhoto] = useState<string | null>(null);
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
    try {
      const result = await submitReport({
        source,
        text: originalText,
        lang,
        lat: location.lat,
        lng: location.lng,
        address: location.address.trim() || null,
        photo_url: photo,
        reporter: buildReporter(name, phone),
        sensor: null,
        citizen_type: type,
      });
      onSubmitted(result, originalText);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.submitError);
    } finally {
      setSubmitting(false);
    }
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

      <div>
        <span className="block text-sm font-semibold">{t.emergencyType}</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {TYPES.map((option) => {
            const active = type === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setType(active ? null : option)}
                aria-pressed={active}
                className={`min-h-11 border px-3 text-sm font-medium ${
                  active
                    ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--surface)]"
                    : "border-[var(--border-strong)] bg-[var(--surface)] hover:bg-[var(--surface-2)]"
                }`}
              >
                {TYPE_LABEL_I18N[lang][option]}
              </button>
            );
          })}
        </div>
      </div>

      <LocationPicker
        value={location}
        onChange={setLocation}
        labels={{
          location: t.location,
          useMyLocation: t.useMyLocation,
          locating: t.locating,
          locationDenied: t.locationDenied,
          adjustLocation: t.adjustLocation,
          landmarkLabel: t.landmarkLabel,
          landmarkPlaceholder: t.landmarkPlaceholder,
        }}
      />

      <PhotoInput
        value={photo}
        onChange={setPhoto}
        label={t.photo}
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
        hintLabel={t.voiceHint}
      />

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

      {/* Demo aid: lets the same form stand in for a 112 call or sensor feed. */}
      <details className="border border-dashed border-[var(--border)]">
        <summary className="min-h-11 cursor-pointer px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Demo — submit as
        </summary>
        <div className="flex flex-wrap gap-1.5 px-3 pb-3">
          {(["citizen", "call", "sensor", "field"] as ReportSource[]).map((option) => (
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
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="min-h-14 w-full border-2 border-[#7f1d1d] bg-[var(--critical)] px-4 text-lg font-bold uppercase tracking-wide text-white hover:bg-[#b91c1c] disabled:opacity-70"
      >
        {submitting ? t.submitting : error ? t.retry : t.submit}
      </button>
    </form>
  );
}

/** Contact details are optional; fall back to a generic channel label. */
function buildReporter(name: string, phone: string): string {
  const parts = [name.trim(), phone.trim()].filter(Boolean);
  return parts.length ? `${parts.join(" · ")} (citizen app)` : "Citizen app";
}
