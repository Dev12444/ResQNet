"use client";

/**
 * Trust, corroboration and AI-confidence display.
 *
 * Three rules are enforced here rather than left to each page:
 *   1. Severity and verification are separate axes. A severity-5 incident can
 *      still be UNVERIFIED, and the UI must never imply otherwise.
 *   2. Repeated reports from one person are not independent confirmation, so
 *      unique sources are always shown next to the raw report count.
 *   3. AI numbers are labelled confidence, never certainty or confirmation.
 *
 * Each badge reads the interface language itself. These are rendered from
 * dozens of call sites across every page, and the ones that had no language in
 * scope are exactly why a Gujarati page still showed UNVERIFIED in English.
 */

import type {
  ConflictNote,
  DuplicateState,
  Hazard,
  IncidentType,
  Priority,
  Severity,
  SourceBreakdown,
  VerificationStatus,
} from "@/types";
import {
  CONFIDENCE_META,
  DUPLICATE_STATE_META,
  PRIORITY_COLOR,
  SEVERITY_COLOR,
  TYPE_LABEL_I18N,
  VERIFICATION_META,
  confidenceBand,
} from "@/lib/constants";
import { labels, strings } from "@/lib/i18n";
import { Badge } from "./primitives";
import { useLang } from "./LangProvider";

export function SeverityBadge({ severity }: { severity: Severity }) {
  const { lang } = useLang();
  return (
    <Badge
      label={`SEV ${severity} · ${labels(lang).severity[severity].toUpperCase()}`}
      color={SEVERITY_COLOR[severity]}
    />
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const { lang } = useLang();
  return (
    <Badge
      label={labels(lang).priority[priority]}
      color={PRIORITY_COLOR[priority]}
      variant="tint"
    />
  );
}

export function TypeBadge({ type }: { type: IncidentType }) {
  const { lang } = useLang();
  return (
    <Badge
      label={TYPE_LABEL_I18N[lang][type]}
      color="var(--muted)"
      variant="outline"
    />
  );
}

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const { lang } = useLang();
  const t = labels(lang);
  return (
    <Badge
      label={t.verification[status]}
      color={VERIFICATION_META[status].color}
      variant="tint"
      title={t.verificationNote[status]}
    />
  );
}

export function DuplicateBadge({ state }: { state: DuplicateState }) {
  const { lang } = useLang();
  return (
    <Badge
      label={labels(lang).duplicate[state]}
      color={DUPLICATE_STATE_META[state].color}
      variant="tint"
    />
  );
}

export function HazardList({ hazards, label }: { hazards: Hazard[]; label?: string }) {
  const { lang } = useLang();
  if (hazards.length === 0) {
    return (
      <span className="text-sm text-[var(--muted)]">{strings(lang).trust.noneRecorded}</span>
    );
  }
  return (
    <div className="flex flex-wrap gap-1">
      {label && <span className="sr-only">{label}</span>}
      {hazards.map((h) => (
        <Badge key={h} label={labels(lang).hazard[h]} color="var(--high)" variant="tint" />
      ))}
    </div>
  );
}

/**
 * AI confidence as a labelled bar. The band label does the work; the bar is
 * only there to make comparison across incidents quick.
 */
export function ConfidenceMeter({
  confidence,
  compact = false,
}: {
  confidence: number;
  compact?: boolean;
}) {
  const { lang } = useLang();
  const t = strings(lang).trust;
  const band = confidenceBand(confidence);
  const meta = CONFIDENCE_META[band];
  const pct = Math.round(confidence * 100);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mono text-sm font-semibold" style={{ color: meta.color }}>
          {pct}%
        </span>
        <Badge label={labels(lang).confidence[band]} color={meta.color} variant="tint" />
      </div>
      {!compact && (
        <>
          <div
            className="mt-1.5 h-1.5 w-full bg-[var(--surface-2)]"
            role="meter"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t.aiConfidence}
          >
            <div className="h-full" style={{ width: `${pct}%`, background: meta.color }} />
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">{t.aiConfidenceNote}</p>
        </>
      )}
    </div>
  );
}

/**
 * Evidence line: `7 reports · 5 unique sources · Citizen 2 · 112 Call 1 · …`
 * The gap between the first two numbers is the point of this component.
 */
export function SourceEvidence({ sources }: { sources: SourceBreakdown }) {
  const { lang } = useLang();
  const t = strings(lang).trust;
  const source = labels(lang).source;

  const parts: string[] = [];
  if (sources.citizen) parts.push(`${source.citizen} ${sources.citizen}`);
  if (sources.call) parts.push(`${source.call} ${sources.call}`);
  if (sources.sensor) parts.push(`${source.sensor} ${sources.sensor}`);
  if (sources.field) parts.push(`${source.field} ${sources.field}`);

  const repeated = sources.reports - sources.unique_sources;

  return (
    <div>
      <p className="mono text-sm">
        {t.evidence(sources.reports, sources.unique_sources)}
        {parts.length > 0 && <> · {parts.join(" · ")}</>}
      </p>
      {repeated > 0 && (
        <p className="mt-1 text-xs text-[var(--muted)]">{t.repeats(repeated)}</p>
      )}
    </div>
  );
}

/** Disagreements between sources, shown rather than resolved silently. */
export function ConflictPanel({ conflicts }: { conflicts: ConflictNote[] }) {
  const { lang } = useLang();
  const t = strings(lang).trust;
  if (conflicts.length === 0) return null;
  return (
    <div
      className="border-l-4 px-3 py-2"
      style={{ borderColor: "var(--high)", background: "var(--high-bg)" }}
    >
      <p className="text-sm font-semibold uppercase tracking-wide">{t.conflictTitle}</p>
      <p className="mt-0.5 text-xs text-[var(--muted)]">{t.conflictNote}</p>
      <dl className="mt-2 space-y-2">
        {conflicts.map((conflict) => (
          <div key={conflict.field}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {conflict.field}
            </dt>
            <dd>
              <ul className="mt-0.5 space-y-0.5">
                {conflict.claims.map((claim) => (
                  <li key={`${claim.report_id}-${claim.value}`} className="text-sm">
                    <span>{claim.value}</span>{" "}
                    <span className="mono text-xs text-[var(--muted)]">
                      — {labels(lang).source[claim.source]}, #{claim.report_id}
                    </span>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
