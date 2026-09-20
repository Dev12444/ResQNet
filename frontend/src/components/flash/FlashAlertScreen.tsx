"use client";

/**
 * The citizen handset experience for a Flash Alert.
 *
 * A full-screen takeover, not a toast. A mass warning has to be unmistakable
 * and unmissable, so it covers the page, carries a siren bar, states the
 * hazard in the largest type on the platform, and offers only the four actions
 * that matter in the next ten minutes.
 *
 * Honesty is built into the surface, not bolted on: the top band says
 * SIMULATION and the foot repeats that ResQNet's frontend does not emit an
 * official cell broadcast. Nobody looking at this screen can mistake it for a
 * real government alert, which matters because it looks exactly like one.
 */

import { pageStrings } from "@/lib/pageStrings";
import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  Hospital,
  Phone,
  Route as RouteIcon,
  ShieldCheck,
  X,
} from "lucide-react";
import type { Lang } from "@/types";
import type { FlashAlert } from "@/types/flash";
import { FLASH_SEVERITY_META, formatReach } from "@/lib/flash";
import { submitSafeCheckIn } from "@/lib/api";

const LANG_LABEL: Record<Lang, string> = {
  en: "English",
  gu: "ગુજરાતી",
  hi: "हिन्दी",
};

export function FlashAlertScreen({
  alert,
  lang,
  onDismiss,
}: {
  alert: FlashAlert;
  lang: Lang;
  onDismiss: () => void;
}) {
  // Opens in the viewer's own language, but every approved language is one tap
  // away — a warning nobody can read is not a warning.
  const [view, setView] = useState<Lang>(
    alert.languages.includes(lang) ? lang : alert.languages[0],
  );
  const [safe, setSafe] = useState<"idle" | "sending" | "sent" | "local">("idle");
  const meta = FLASH_SEVERITY_META[alert.severity];
  const t = pageStrings(lang).flash;

  const markSafe = async () => {
    setSafe("sending");
    try {
      const rec = await submitSafeCheckIn({
        name: "",
        district: alert.target.district ?? "All districts",
        note: `Responded to flash alert ${alert.id}`,
        notifyContacts: true,
      });
      setSafe(rec.synced ? "sent" : "local");
    } catch {
      setSafe("local");
    }
  };

  const issued = alert.sentAt ? new Date(alert.sentAt) : new Date();

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="flash-headline"
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-[rgba(8,18,32,.75)] p-3 backdrop-blur-[2px] sm:items-center"
    >
      <div className="w-full max-w-[420px] overflow-hidden rounded-[10px] border border-[var(--border-strong)] bg-white shadow-[0_24px_70px_rgba(0,0,0,.45)]">
        {/* Siren bar — the only flashing element on the platform */}
        <div
          className="flash-bar flex items-center gap-2 px-3 py-2 text-white"
          style={{ background: meta.color }}
        >
          <AlertTriangle className="size-5 shrink-0" aria-hidden />
          <span className="text-[13px] font-extrabold uppercase tracking-wide">
            {t.emergencyAlert}
          </span>
          <span className="ml-auto rounded-[3px] bg-white/25 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">
            {t.simulation}
          </span>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t.dismissAlert}
            className="rounded p-0.5 text-white/85 hover:bg-white/20 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Severity + language */}
        <div
          className="flex items-center gap-2 border-b border-[var(--hairline)] px-3 py-1.5"
          style={{ background: meta.bg }}
        >
          <span
            className="rounded-[3px] px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-white"
            style={{ background: meta.color }}
          >
            {t.severityLabel[alert.severity]}
          </span>
          <span className="text-[11px] font-semibold text-[var(--foreground)]">
            {t.severityAction[alert.severity]}
          </span>
          <div className="ml-auto flex gap-0.5">
            {alert.languages.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setView(l)}
                lang={l}
                aria-pressed={view === l}
                className={`rounded-[3px] px-1.5 py-0.5 text-[10px] font-bold ${
                  view === l
                    ? "bg-[var(--navy-800)] text-white"
                    : "bg-white text-[var(--muted)] hover:bg-[var(--surface-2)]"
                }`}
              >
                {LANG_LABEL[l]}
              </button>
            ))}
          </div>
        </div>

        {/* The warning itself */}
        <div className="px-4 pb-3 pt-4">
          <h2
            id="flash-headline"
            lang={view}
            className="text-[21px] font-extrabold leading-[1.15]"
            style={{ color: meta.color }}
          >
            {alert.headline[view]}
          </h2>
          <p lang={view} className="mt-2.5 text-[14px] leading-[1.5] text-[var(--foreground)]">
            {alert.body[view]}
          </p>

          <dl className="mt-3.5 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-[var(--hairline)] pt-3">
            <Field label={t.affectedArea} value={alert.target.area} />
            <Field
              label={t.issued}
              value={issued.toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            />
            <Field label={t.source} value={t.sourceValue} />
            <Field
              label={t.estimatedReach}
              value={t.people(formatReach(alert.target.population))}
            />
          </dl>
        </div>

        {/* Actions — each one integrates with a real surface */}
        <div className="grid grid-cols-2 gap-px bg-[var(--border)]">
          <Link
            href="/shelters"
            onClick={onDismiss}
            className="flex items-center justify-center gap-1.5 bg-white px-2 py-3 text-[12px] font-bold text-[var(--navy-800)] no-underline hover:bg-[var(--info-bg)]"
          >
            <RouteIcon className="size-4" aria-hidden /> {t.viewSafeRoute}
          </Link>
          <Link
            href="/shelters"
            onClick={onDismiss}
            className="flex items-center justify-center gap-1.5 bg-white px-2 py-3 text-[12px] font-bold text-[var(--navy-800)] no-underline hover:bg-[var(--info-bg)]"
          >
            <Hospital className="size-4" aria-hidden /> {t.nearestShelter}
          </Link>

          <button
            type="button"
            onClick={markSafe}
            disabled={safe === "sending" || safe === "sent" || safe === "local"}
            className="flex items-center justify-center gap-1.5 bg-white px-2 py-3 text-[12px] font-bold text-[var(--green)] hover:bg-[var(--ok-bg)] disabled:opacity-80"
          >
            {safe === "sent" || safe === "local" ? (
              <>
                <Check className="size-4" aria-hidden /> {t.checkInRecorded}
              </>
            ) : (
              <>
                <ShieldCheck className="size-4" aria-hidden />{" "}
                {safe === "sending" ? t.sending : t.imSafe}
              </>
            )}
          </button>
          <a
            href="tel:112"
            className="flex items-center justify-center gap-1.5 bg-[var(--crimson)] px-2 py-3 text-[12px] font-bold text-white no-underline hover:bg-[var(--crimson-700)]"
          >
            <Phone className="size-4" aria-hidden /> {t.emergency112}
          </a>
        </div>

        {safe === "local" && (
          <p className="border-t border-[var(--hairline)] bg-[var(--medium-bg)] px-3 py-1.5 text-[11px] text-[var(--foreground)]">
            {t.deviceOnlyNote} <strong>{t.notWord}</strong> {t.callNowNote}
          </p>
        )}

        {alert.incidentCode && (
          <div className="flex items-center gap-2 border-t border-[var(--hairline)] px-3 py-1.5">
            <span className="telemetry">{alert.incidentCode}</span>
            <span className="truncate text-[11px] text-[var(--muted)]">
              {alert.incidentTitle}
            </span>
            <Link
              href="/incidents"
              onClick={onDismiss}
              className="ml-auto shrink-0 text-[11px] font-bold text-[var(--navy-600)] no-underline hover:underline"
            >
              {t.viewIncident}
            </Link>
          </div>
        )}

        {/* The disclaimer that makes this honest */}
        <p className="border-t border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[10px] leading-relaxed text-[var(--muted)]">
          <strong className="text-[var(--foreground)]">{t.simulatedAlert}</strong>{" "}
          {t.simulatedAlertNote}
        </p>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow text-[var(--muted)]">{label}</dt>
      <dd className="mt-0.5 text-[12px] font-semibold leading-snug text-[var(--foreground)]">
        {value}
      </dd>
    </div>
  );
}
