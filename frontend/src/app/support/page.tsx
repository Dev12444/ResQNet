"use client";

/**
 * `/support` — help, emergency numbers, accessibility and offline guidance.
 *
 * Also the place that tells people plainly what ResQNet is not: it is not an
 * emergency call, and a report sitting in the device queue has not reached
 * anybody.
 *
 * Owner: FE2.
 */

import { pageStrings } from "@/lib/pageStrings";
import { useLang } from "@/components/layout/LangProvider";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { EmergencyDirectory } from "@/components/layout/EmergencyContacts";
import { readQueue } from "@/lib/api";
import { useNow } from "@/components/layout/ConnectionBar";

export default function SupportPage() {
  const { lang } = useLang();
  const t = pageStrings(lang).support;
  const [open, setOpen] = useState<number | null>(0);
  const now = useNow();
  // Read once the client clock exists, so server and client markup match.
  const queued = now === null ? [] : readQueue();

  return (
    <div className="mx-auto w-full max-w-4xl p-3 sm:p-4">
      <header className="mb-3">
        <h1 className="cmd text-[24px] leading-none">{t.title}</h1>
        <p className="text-sm text-[var(--muted)]">
          {t.lead}
        </p>
      </header>

      {/* The most important thing on the page. */}
      <section
        className="mb-3 border-l-4 px-4 py-3"
        style={{ borderColor: "var(--critical)", background: "var(--critical-bg)" }}
      >
        <h2 className="text-base font-bold">{t.callBanner}</h2>
        <p className="mt-1 text-sm">
          ResQNet supports coordination between citizens, responders and departments. It
          does not replace an emergency call, and submitting a report here does not
          summon help on its own.
        </p>
      </section>

      {queued.length > 0 && (
        <section
          className="mb-3 border-l-4 px-4 py-3"
          style={{ borderColor: "var(--medium)", background: "var(--medium-bg)" }}
        >
          <h2 className="text-sm font-bold">
            {queued.length} submission{queued.length === 1 ? "" : "s"} waiting on this
            device
          </h2>
          <ul className="mono mt-1 space-y-0.5 text-[11px]">
            {queued.map((q) => (
              <li key={q.id}>
                {q.kind.replace("_", " ")} — {q.label} (queued{" "}
                {new Date(q.queuedAt).toTimeString().slice(0, 5)})
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs">
            {t.queuedNote}
          </p>
        </section>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="panel">
          <h2 className="border-b border-[var(--border)] px-3 py-2 text-[13px] font-bold uppercase tracking-wide">
            {t.helplines}
          </h2>
          <div className="p-3">
            <EmergencyDirectory />
          </div>
        </section>

        <div className="flex flex-col gap-3">
          <section className="panel">
            <h2 className="border-b border-[var(--border)] px-3 py-2 text-[13px] font-bold uppercase tracking-wide">
              {t.accessibility}
            </h2>
            <ul className="divide-y divide-[var(--border)] text-[13px]">
              <Item>{t.a11yKeyboard}</Item>
              <Item>{t.a11yColour}</Item>
              <Item>{t.a11yTouch}</Item>
              <Item>{t.a11yVoice}</Item>
              <Item>{t.a11yMotion}</Item>
              <Item>{t.a11yAssistance}</Item>
            </ul>
          </section>

          <section className="panel">
            <h2 className="border-b border-[var(--border)] px-3 py-2 text-[13px] font-bold uppercase tracking-wide">
              {t.networkFails}
            </h2>
            <ul className="divide-y divide-[var(--border)] text-[13px]">
              <Item>
                <strong>{t.call112}</strong> {t.voiceWorks}
              </Item>
              <Item>{t.offlineReports}</Item>
              <Item>{t.staleNote}</Item>
            </ul>
          </section>
        </div>
      </div>

      {/* FAQ */}
      <section className="panel mt-3">
        <h2 className="border-b border-[var(--border)] px-3 py-2 text-[13px] font-bold uppercase tracking-wide">
          {t.faq}
        </h2>
        <ul className="divide-y divide-[var(--border)]">
          {t.faqs.map((faq, i) => {
            const isOpen = open === i;
            return (
              <li key={faq.q}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-[var(--surface-2)]"
                >
                  <ChevronDown
                    className={`size-4 shrink-0 text-[var(--muted)] transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                    aria-hidden
                  />
                  <span className="text-[13px] font-semibold">{faq.q}</span>
                </button>
                {isOpen && (
                  <p className="px-3 pb-3 pl-9 text-[13px] leading-relaxed text-[var(--muted)]">
                    {faq.a}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function Item({ children }: { children: React.ReactNode }) {
  return <li className="px-3 py-2 leading-snug">{children}</li>;
}
