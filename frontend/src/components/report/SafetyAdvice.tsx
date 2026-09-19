"use client";

/**
 * "What to do now" for the citizen, right after they report: fixed, vetted safety tips and
 * helplines in their language from BE2's `GET /api/ai/advice` (templates, not generated text,
 * so nothing unsafe is invented). Renders nothing in mock mode or if the call fails.
 */

import { useEffect, useState } from "react";
import { request, USE_MOCK } from "@/lib/api";
import type { IncidentType, Lang } from "@/types";

interface Advice {
  lang: Lang;
  headline: string;
  tips: string[];
  helplines: { number: string; label: string }[];
}

const TITLE: Record<Lang, string> = {
  en: "Until help arrives",
  gu: "મદદ આવે ત્યાં સુધી",
  hi: "मदद आने तक",
};

export function SafetyAdvice({ type, hazards, lang }: { type: IncidentType; hazards: string[]; lang: Lang }) {
  const [advice, setAdvice] = useState<Advice | null>(null);

  useEffect(() => {
    if (USE_MOCK) return;
    let alive = true;
    const q = new URLSearchParams({ type, hazards: hazards.join(","), lang });
    request<Advice>(`/api/ai/advice?${q}`)
      .then((a) => alive && setAdvice(a))
      .catch(() => undefined); // advice is a bonus: never block the receipt
    return () => {
      alive = false;
    };
  }, [type, hazards, lang]);

  if (!advice || advice.lang !== lang) return null;

  return (
    <section
      lang={lang}
      aria-label={TITLE[lang]}
      className="border-l-4 px-3 py-3"
      style={{ borderColor: "var(--warn, #f59e0b)", background: "var(--surface)" }}
    >
      <h2 className="text-base font-bold">{TITLE[lang]}</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">{advice.headline}</p>
      <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
        {advice.tips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        {advice.helplines.map((h) => (
          <a
            key={h.number}
            href={`tel:${h.number}`}
            className="inline-flex min-h-10 items-center gap-1.5 border border-[var(--border-strong)] px-3 text-sm font-semibold"
          >
            <span className="mono">{h.number}</span>
            <span className="text-xs text-[var(--muted)]">{h.label}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
