/**
 * ResQ Chain — Report → Verify → Respond → Resolve.
 *
 * Shows the four stages with their timestamps, and every status change
 * underneath with who made it. Stages that have not happened are drawn as
 * pending rather than omitted, so the gap in a stalled incident is visible.
 */

import type { ChainEvent } from "@/types";
import { CHAIN_STAGES, CHAIN_STATUS_META } from "@/lib/constants";

export function IncidentTimeline({ chain }: { chain: ChainEvent[] }) {
  const reachedStages = new Set(chain.map((e) => CHAIN_STATUS_META[e.status].stage));

  return (
    <div>
      {/* Stage rail */}
      <ol className="flex items-stretch border-b border-[var(--border)]">
        {CHAIN_STAGES.map((stage, i) => {
          const done = reachedStages.has(stage.id);
          return (
            <li key={stage.id} className="flex flex-1 items-center gap-1.5 px-2 py-2">
              <span
                aria-hidden
                className="flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                style={{
                  background: done ? "var(--ok)" : "var(--surface-2)",
                  color: done ? "#ffffff" : "var(--muted)",
                  border: done ? "none" : "1px solid var(--border-strong)",
                }}
              >
                {done ? "✓" : i + 1}
              </span>
              <span
                className={`text-[11px] font-bold uppercase tracking-wide ${
                  done ? "" : "text-[var(--muted)]"
                }`}
              >
                {stage.label}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Events */}
      <ol className="divide-y divide-[var(--border)]">
        {chain.map((event, i) => {
          const meta = CHAIN_STATUS_META[event.status];
          return (
            <li key={`${event.status}-${i}`} className="flex gap-3 px-3 py-2">
              <span className="mono w-16 shrink-0 pt-0.5 text-[11px] text-[var(--muted)]">
                {new Date(event.at).toTimeString().slice(0, 5)}
              </span>
              <span
                aria-hidden
                className="mt-1.5 size-2 shrink-0 rounded-full"
                style={{ background: meta.color }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold" style={{ color: meta.color }}>
                  {meta.label}
                </p>
                <p className="text-xs text-[var(--muted)]">{event.actor}</p>
                {event.note && (
                  <p className="mt-0.5 text-xs text-[var(--foreground)]">{event.note}</p>
                )}
              </div>
            </li>
          );
        })}
        {chain.length === 0 && (
          <li className="px-3 py-4 text-center text-sm text-[var(--muted)]">
            No status changes recorded yet.
          </li>
        )}
      </ol>
    </div>
  );
}
