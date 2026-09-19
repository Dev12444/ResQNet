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

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { EmergencyDirectory } from "@/components/layout/EmergencyContacts";
import { readQueue } from "@/lib/api";
import { useNow } from "@/components/layout/ConnectionBar";

const FAQS: { q: string; a: string }[] = [
  {
    q: "Does reporting here replace calling 112?",
    a: "No. 112 reaches emergency services directly and is always the fastest route to help. ResQNet coordinates the response around your report — it does not dispatch anyone on its own, and an operator reviews every report before a unit is sent.",
  },
  {
    q: "What happens after I submit a report?",
    a: "Your report is received, classified, checked against other reports from the same area, and either linked to a known incident or opened as a new one. A control-room operator then reviews it. You can see each of these stages on the confirmation screen, along with your report reference.",
  },
  {
    q: "What if I have no network?",
    a: "Your report is saved on this device and sent automatically when the connection returns. Until it sends, it has NOT reached the control room — the banner at the top of the screen will say so and show how many submissions are waiting. If the situation is life-threatening, call 112 by phone instead.",
  },
  {
    q: "Why does my report say UNVERIFIED?",
    a: "It means yours is the only account so far. Reports become CORROBORATED when other independent sources describe the same thing, and AUTHORITY VERIFIED when a responding unit or district officer confirms it on the ground. Repeated messages from the same person do not count as independent confirmation.",
  },
  {
    q: "The AI confidence figure — what does it mean?",
    a: "It is the classifier's confidence in its own reading of your report: the type, the severity and the hazards. It is not a judgement about whether the emergency is real, and it never decides the response. Anything below 50% is flagged for manual verification.",
  },
  {
    q: "Can I report on behalf of someone else?",
    a: "Yes. Describe what you saw and where. If the person needs special assistance — elderly, a child, a wheelchair user, or someone needing medical support — tick the relevant option so responders arrive prepared.",
  },
  {
    q: "Is my personal information published?",
    a: "No. Contact details you provide go to the control room only. The public missing-persons register shows an age band and last-seen location, never addresses, phone numbers or dates of birth.",
  },
  {
    q: "Are shelter bed counts guaranteed?",
    a: "No. They are the last figure reported by that shelter, shown with its age. If a count is more than a couple of minutes old the page says so and advises confirming by phone before travelling.",
  },
];

export default function SupportPage() {
  const [open, setOpen] = useState<number | null>(0);
  const now = useNow();
  // Read once the client clock exists, so server and client markup match.
  const queued = now === null ? [] : readQueue();

  return (
    <div className="mx-auto w-full max-w-4xl p-3 sm:p-4">
      <header className="mb-3">
        <h1 className="cmd text-[24px] leading-none">Support</h1>
        <p className="text-sm text-[var(--muted)]">
          Emergency numbers, how ResQNet works, and accessibility options.
        </p>
      </header>

      {/* The most important thing on the page. */}
      <section
        className="mb-3 border-l-4 px-4 py-3"
        style={{ borderColor: "var(--critical)", background: "var(--critical-bg)" }}
      >
        <h2 className="text-base font-bold">In an emergency, call 112</h2>
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
            These have not reached the control room yet. They will send automatically
            when the connection returns.
          </p>
        </section>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="panel">
          <h2 className="border-b border-[var(--border)] px-3 py-2 text-[13px] font-bold uppercase tracking-wide">
            Emergency numbers
          </h2>
          <div className="p-3">
            <EmergencyDirectory />
          </div>
        </section>

        <div className="flex flex-col gap-3">
          <section className="panel">
            <h2 className="border-b border-[var(--border)] px-3 py-2 text-[13px] font-bold uppercase tracking-wide">
              Accessibility
            </h2>
            <ul className="divide-y divide-[var(--border)] text-[13px]">
              <Item>
                Every screen works with a keyboard alone. Focus is always visible, and a
                &ldquo;Skip to main content&rdquo; link is the first stop on every page.
              </Item>
              <Item>
                Status is never carried by colour alone — every coloured badge also
                states its meaning in words.
              </Item>
              <Item>
                Emergency controls use large touch targets and the reporting form works
                one-handed on a phone.
              </Item>
              <Item>
                The reporting form supports voice input in Gujarati, Hindi and English
                where the browser allows it, and you can always edit the transcript
                before sending.
              </Item>
              <Item>
                Animation is limited to two indicators and is disabled entirely if your
                device requests reduced motion.
              </Item>
              <Item>
                Special assistance options — elderly, child, wheelchair, medical — are on
                the reporting form so responders arrive prepared.
              </Item>
            </ul>
          </section>

          <section className="panel">
            <h2 className="border-b border-[var(--border)] px-3 py-2 text-[13px] font-bold uppercase tracking-wide">
              If the network fails
            </h2>
            <ul className="divide-y divide-[var(--border)] text-[13px]">
              <Item>
                <strong>Call 112.</strong> A voice call works on a weak signal that will
                not carry a data connection.
              </Item>
              <Item>
                Reports you submit offline are saved on this device and sent when the
                connection returns. The banner tells you how many are waiting.
              </Item>
              <Item>
                The last data you loaded stays on screen and is marked STALE rather than
                being presented as current.
              </Item>
            </ul>
          </section>
        </div>
      </div>

      {/* FAQ */}
      <section className="panel mt-3">
        <h2 className="border-b border-[var(--border)] px-3 py-2 text-[13px] font-bold uppercase tracking-wide">
          Common questions
        </h2>
        <ul className="divide-y divide-[var(--border)]">
          {FAQS.map((faq, i) => {
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
