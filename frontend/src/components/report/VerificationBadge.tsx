/**
 * Ground-truth badges for citizen-sourced content.
 *
 * The three levels are never collapsed or implied: an unverified report is
 * labelled UNVERIFIED wherever it appears, however severe it sounds, and
 * "community confirmed" is never allowed to read as an official confirmation.
 */

import type { ChainStatus, GroundTruthLevel } from "@/types";
import { CHAIN_STATUS_META, GROUND_TRUTH_META } from "@/lib/constants";

export function GroundTruthBadge({
  level,
  showNote = false,
}: {
  level: GroundTruthLevel;
  showNote?: boolean;
}) {
  const meta = GROUND_TRUTH_META[level];
  return (
    <span className="inline-flex flex-col gap-0.5">
      <span
        className="inline-flex w-fit items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
        style={{
          background: `${meta.color}14`,
          color: meta.color,
          border: `1px solid ${meta.color}55`,
        }}
        title={meta.note}
      >
        {meta.label}
      </span>
      {showNote && (
        <span className="text-[11px] leading-tight text-[var(--muted)]">{meta.note}</span>
      )}
    </span>
  );
}

export function ChainStatusBadge({ status }: { status: ChainStatus }) {
  const meta = CHAIN_STATUS_META[status];
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{
        background: `${meta.color}14`,
        color: meta.color,
        border: `1px solid ${meta.color}55`,
      }}
    >
      {meta.label}
    </span>
  );
}

/**
 * Confirmation counter. Shows how many independent people said the same
 * thing — zero is stated explicitly rather than hidden.
 */
export function ConfirmationCount({ count }: { count: number }) {
  return (
    <span className="mono text-[11px] text-[var(--muted)]">
      {count === 0
        ? "no independent confirmations yet"
        : `${count} independent confirmation${count === 1 ? "" : "s"}`}
    </span>
  );
}
