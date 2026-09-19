/**
 * Trust, corroboration and AI-confidence display.
 *
 * Three rules are enforced here rather than left to each page:
 *   1. Severity and verification are separate axes. A severity-5 incident can
 *      still be UNVERIFIED, and the UI must never imply otherwise.
 *   2. Repeated reports from one person are not independent confirmation, so
 *      unique sources are always shown next to the raw report count.
 *   3. AI numbers are labelled confidence, never certainty or confirmation.
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
  HAZARD_LABEL,
  INCIDENT_TYPE_META,
  PRIORITY_COLOR,
  PRIORITY_LABEL,
  SEVERITY_COLOR,
  SEVERITY_LABEL,
  SOURCE_META,
  VERIFICATION_META,
  confidenceBand,
} from "@/lib/constants";
import { Badge } from "./primitives";

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <Badge
      label={`SEV ${severity} · ${SEVERITY_LABEL[severity].toUpperCase()}`}
      color={SEVERITY_COLOR[severity]}
    />
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge label={PRIORITY_LABEL[priority]} color={PRIORITY_COLOR[priority]} variant="tint" />;
}

export function TypeBadge({ type }: { type: IncidentType }) {
  return (
    <Badge
      label={INCIDENT_TYPE_META[type].label}
      color="var(--muted)"
      variant="outline"
    />
  );
}

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const meta = VERIFICATION_META[status];
  return <Badge label={meta.label} color={meta.color} variant="tint" title={meta.note} />;
}

export function DuplicateBadge({ state }: { state: DuplicateState }) {
  const meta = DUPLICATE_STATE_META[state];
  return <Badge label={meta.label} color={meta.color} variant="tint" />;
}

export function HazardList({ hazards, label }: { hazards: Hazard[]; label?: string }) {
  if (hazards.length === 0) {
    return <span className="text-sm text-[var(--muted)]">None recorded</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {label && <span className="sr-only">{label}</span>}
      {hazards.map((h) => (
        <Badge key={h} label={HAZARD_LABEL[h]} color="var(--high)" variant="tint" />
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
  const band = confidenceBand(confidence);
  const meta = CONFIDENCE_META[band];
  const pct = Math.round(confidence * 100);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mono text-sm font-semibold" style={{ color: meta.color }}>
          {pct}%
        </span>
        <Badge label={meta.label} color={meta.color} variant="tint" />
      </div>
      {!compact && (
        <>
          <div
            className="mt-1.5 h-1.5 w-full bg-[var(--surface-2)]"
            role="meter"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="AI confidence"
          >
            <div className="h-full" style={{ width: `${pct}%`, background: meta.color }} />
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">
            AI confidence in this classification — not a confirmation that the emergency
            occurred.
          </p>
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
  const parts: string[] = [];
  if (sources.citizen) parts.push(`${SOURCE_META.citizen.short} ${sources.citizen}`);
  if (sources.call) parts.push(`${SOURCE_META.call.short} ${sources.call}`);
  if (sources.sensor) parts.push(`${SOURCE_META.sensor.short} ${sources.sensor}`);
  if (sources.field) parts.push(`${SOURCE_META.field.short} ${sources.field}`);

  const repeated = sources.reports - sources.unique_sources;

  return (
    <div>
      <p className="mono text-sm">
        <strong className="font-semibold">{sources.reports}</strong> report
        {sources.reports === 1 ? "" : "s"} ·{" "}
        <strong className="font-semibold">{sources.unique_sources}</strong> unique source
        {sources.unique_sources === 1 ? "" : "s"}
        {parts.length > 0 && <> · {parts.join(" · ")}</>}
      </p>
      {repeated > 0 && (
        <p className="mt-1 text-xs text-[var(--muted)]">
          {repeated} repeat report{repeated === 1 ? "" : "s"} from an already-counted reporter —
          not independent confirmation.
        </p>
      )}
    </div>
  );
}

/** Disagreements between sources, shown rather than resolved silently. */
export function ConflictPanel({ conflicts }: { conflicts: ConflictNote[] }) {
  if (conflicts.length === 0) return null;
  return (
    <div
      className="border-l-4 px-3 py-2"
      style={{ borderColor: "var(--high)", background: "var(--high-bg)" }}
    >
      <p className="text-sm font-semibold uppercase tracking-wide">Conflicting information</p>
      <p className="mt-0.5 text-xs text-[var(--muted)]">
        Sources disagree. Both accounts are kept until a responder confirms on scene.
      </p>
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
                      — {SOURCE_META[claim.source].short}, report #{claim.report_id}
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
