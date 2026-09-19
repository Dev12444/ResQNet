"use client";

/**
 * "I'm Safe" check-in.
 *
 * The confirmation wording is the whole point of this component: if the
 * check-in only reached this device, it says so plainly rather than telling
 * someone their family has been notified when nothing was sent.
 */

import { useEffect, useState } from "react";
import { Check, ShieldCheck, X } from "lucide-react";
import type { Lang, SafeCheckIn } from "@/types";
import { GUJARAT_DISTRICTS, PLATFORM_STRINGS } from "@/lib/constants";
import { submitSafeCheckIn } from "@/lib/api";
import { readCloseOneContacts, readCloseOnes } from "./CitizenCards";

export function ImSafeCard({ lang }: { lang: Lang }) {
  const t = PLATFORM_STRINGS[lang];
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        /* Solid green, as on the reference: the safe check-in is the one
           reassuring action on a page otherwise built out of warnings, and an
           outlined button put it a tier below the crimson report button. */
        className="flex h-12 w-full items-center gap-3 border border-[var(--jade)] bg-[var(--jade)] px-3 text-left text-white transition-colors hover:brightness-110"
      >
        <span
          aria-hidden
          className="notch-sm flex size-8 shrink-0 items-center justify-center bg-white/20"
        >
          <ShieldCheck className="size-4 text-white" />
        </span>
        <span className="min-w-0">
          <span className="cmd block text-[14px] leading-tight">{t.imSafe}</span>
          <span className="block truncate text-[11px] leading-tight opacity-85">
            {t.imSafeSub}
          </span>
        </span>
      </button>

      {open && <ImSafeDialog lang={lang} onClose={() => setOpen(false)} />}
    </>
  );
}

function ImSafeDialog({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const t = PLATFORM_STRINGS[lang];
  const [name, setName] = useState("");
  const [district, setDistrict] = useState("Ahmedabad");
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  /* The dialog names the contacts it would actually reach, rather than
     offering to notify a list that may be empty. Read after mount so the
     server-rendered markup is not built from this device's storage. */
  const [contacts, setContacts] = useState<{ name: string }[]>([]);

  useEffect(() => {
    const id = setTimeout(() => {
      setContacts(readCloseOneContacts());
      setNotify(readCloseOnes());
    }, 0);
    return () => clearTimeout(id);
  }, []);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SafeCheckIn | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      setResult(
        await submitSafeCheckIn({
          name: name.trim(),
          district,
          note: note.trim(),
          notifyContacts: notify && contacts.length > 0,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record the check-in");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="imsafe-title"
    >
      <div className="w-full max-w-md border border-[var(--border-strong)] bg-[var(--surface)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h2 id="imsafe-title" className="text-sm font-bold uppercase tracking-wide">
            {t.imSafe}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--muted)]">
            <X className="size-5" />
          </button>
        </div>

        {result ? (
          <div className="px-4 py-5">
            <div
              className="flex items-start gap-3 border-l-4 px-3 py-3"
              style={{
                borderColor: result.synced ? "var(--ok)" : "var(--medium)",
                background: result.synced ? "var(--ok-bg)" : "var(--medium-bg)",
              }}
            >
              <Check
                className="mt-0.5 size-5 shrink-0"
                style={{ color: result.synced ? "var(--ok)" : "var(--medium)" }}
                aria-hidden
              />
              <div>
                <p className="text-sm font-semibold">
                  {result.synced
                    ? "Check-in recorded"
                    : "Saved on this device only"}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {result.synced
                    ? notify
                      ? "Your listed contacts will be notified that you are safe."
                      : "Your status is recorded. No contacts were notified."
                    : "There is no connection right now, so this has NOT reached the control room or your contacts. It will be sent automatically when you are back online."}
                </p>
              </div>
            </div>

            <dl className="mono mt-3 space-y-1 text-xs">
              <Row label="Name" value={result.name} />
              <Row label="District" value={result.district} />
              <Row label="Recorded" value={new Date(result.at).toTimeString().slice(0, 8)} />
            </dl>

            <button
              type="button"
              onClick={onClose}
              className="mt-4 h-11 w-full border border-[var(--border-strong)] font-semibold"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3 px-4 py-4">
            <label className="block">
              <span className="text-xs font-semibold">Your name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                className="mt-1 h-11 w-full border border-[var(--border-strong)] px-2 text-base"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold">District you are in</span>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="mt-1 h-11 w-full border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-base"
              >
                {GUJARAT_DISTRICTS.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold">Message (optional)</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="At the shelter with my family"
                className="mt-1 w-full border border-[var(--border-strong)] px-2 py-1.5 text-base"
              />
            </label>

            <label className="flex min-h-11 items-center gap-2.5 border border-[var(--border-strong)] px-3">
              <input
                type="checkbox"
                checked={notify && contacts.length > 0}
                disabled={contacts.length === 0}
                onChange={(e) => setNotify(e.target.checked)}
                className="size-4"
              />
              <span className="text-sm">
                {contacts.length > 0 ? (
                  <>
                    Notify my close ones
                    <span className="text-[var(--muted)]">
                      {" "}
                      &mdash; {contacts.map((c) => c.name).join(", ")}
                    </span>
                  </>
                ) : (
                  <span className="text-[var(--muted)]">
                    No close ones saved. Add them on the home screen first.
                  </span>
                )}
              </span>
            </label>

            {error && (
              <p role="alert" className="text-xs" style={{ color: "var(--critical)" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="h-12 w-full border-2 border-[#0f7a37] bg-[var(--ok)] font-bold uppercase tracking-wide text-white disabled:opacity-70"
            >
              {submitting ? "Recording…" : "Mark me safe"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
