"use client";

/**
 * Flash Alert History — the audit trail for mass warnings.
 *
 * Every warning raised in this session, with who approved it and where it was
 * aimed. An alert that cannot be audited afterwards is not a governable
 * capability, so the operator column is never blank for a SENT row.
 *
 * SIMULATE FLASH ALERT raises the pre-built Kutch cyclone warning for the
 * demonstration; every row is badged DEMO because this build cannot produce
 * anything else.
 */

import { useState } from "react";
import { Eye, PlayCircle, Siren, XCircle } from "lucide-react";
import { FLASH_SCENARIO_META, FLASH_SEVERITY_META, FLASH_STATUS_META, formatReach } from "@/lib/flash";
import { useFlashAlert } from "./FlashAlertProvider";
import { FlashAlertComposer } from "./FlashAlertComposer";

export function FlashAlertHistory({ compact = false }: { compact?: boolean }) {
  const { history, replay, cancel, simulate } = useFlashAlert();
  const [composing, setComposing] = useState(false);

  return (
    <section className="panel flex min-h-0 flex-col">
      <div className="panel-head">
        <Siren className="size-4 shrink-0 text-[var(--crimson)]" aria-hidden />
        <h2 className="cmd text-[12px]">Flash Alert History</h2>
        <span className="telemetry ml-auto">{history.length} raised</span>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-[var(--hairline)] px-2.5 py-2">
        <button
          type="button"
          onClick={() => setComposing(true)}
          className="flex h-8 items-center gap-1.5 rounded-[4px] border border-[var(--crimson-700)] bg-[var(--crimson)] px-2.5 text-[11px] font-bold text-white hover:bg-[var(--crimson-700)]"
        >
          <Siren className="size-3.5" aria-hidden /> SEND FLASH ALERT
        </button>
        <button
          type="button"
          onClick={simulate}
          className="flex h-8 items-center gap-1.5 rounded-[4px] border border-[var(--border-strong)] bg-white px-2.5 text-[11px] font-bold text-[var(--navy-700)] hover:bg-[var(--info-bg)]"
        >
          <PlayCircle className="size-3.5" aria-hidden /> SIMULATE FLASH ALERT
        </button>
      </div>

      {history.length === 0 ? (
        <p className="px-3 py-5 text-center text-[12px] text-[var(--muted)]">
          No warnings raised in this session. Use{" "}
          <strong>Simulate Flash Alert</strong> to run the Kutch cyclone
          demonstration.
        </p>
      ) : (
        <div className="thin-scroll min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 bg-[var(--surface-2)]">
              <tr>
                {["Time", "Incident", "District", "Severity", "Target area", "Lang", "Status", "Operator", ""]
                  .filter((h) => !compact || !["Target area", "Operator"].includes(h))
                  .map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="eyebrow whitespace-nowrap border-b border-[var(--border)] px-2 py-1.5 text-[var(--muted)]"
                    >
                      {h}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {history.map((a) => {
                const sev = FLASH_SEVERITY_META[a.severity];
                const st = FLASH_STATUS_META[a.status];
                return (
                  <tr key={a.id} className="border-b border-[var(--hairline)] last:border-b-0">
                    <td className="mono whitespace-nowrap px-2 py-1.5 text-[11px]">
                      {new Date(a.sentAt ?? a.createdAt).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-2 py-1.5 text-[11.5px]">
                      <span className="mono block">{a.incidentCode ?? "—"}</span>
                      <span className="block text-[10.5px] text-[var(--muted)]">
                        {FLASH_SCENARIO_META[a.scenario].label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-[11.5px] font-semibold">
                      {a.target.district ?? "All districts"}
                    </td>
                    <td className="px-2 py-1.5">
                      <span
                        className="rounded-[3px] px-1.5 py-0.5 text-[9.5px] font-bold text-white"
                        style={{ background: sev.color }}
                      >
                        {sev.label}
                      </span>
                    </td>
                    {!compact && (
                      <td className="px-2 py-1.5 text-[11.5px]">
                        {a.target.area}
                        <span className="telemetry mt-0.5 block">
                          ~{formatReach(a.target.population)} reached
                        </span>
                      </td>
                    )}
                    <td className="mono whitespace-nowrap px-2 py-1.5 text-[10.5px] uppercase">
                      {a.languages.join(" · ")}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5">
                      <span
                        className="text-[10.5px] font-bold"
                        style={{ color: st.color }}
                      >
                        {st.label}
                      </span>
                      <span className="ml-1 rounded-[2px] bg-[var(--surface-3)] px-1 text-[8.5px] font-bold uppercase text-[var(--muted)]">
                        Demo
                      </span>
                    </td>
                    {!compact && (
                      <td className="px-2 py-1.5 text-[11px] text-[var(--muted)]">
                        {a.operator ?? "—"}
                      </td>
                    )}
                    <td className="whitespace-nowrap px-2 py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => replay(a.id)}
                        title="Show this warning on the simulated handset"
                        className="rounded p-1 text-[var(--navy-600)] hover:bg-[var(--info-bg)]"
                      >
                        <Eye className="size-3.5" />
                        <span className="sr-only">Replay {a.id}</span>
                      </button>
                      {a.status === "sent" && (
                        <button
                          type="button"
                          onClick={() => cancel(a.id)}
                          title="Withdraw this warning"
                          className="rounded p-1 text-[var(--crimson)] hover:bg-[var(--critical-bg)]"
                        >
                          <XCircle className="size-3.5" />
                          <span className="sr-only">Cancel {a.id}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="border-t border-[var(--hairline)] bg-[var(--surface-2)] px-2.5 py-1.5 text-[10px] leading-relaxed text-[var(--muted)]">
        Every entry is a simulation. ResQNet&apos;s frontend does not emit cell
        broadcasts — an approved warning would be handed to the NDMA Common
        Alerting Protocol gateway in a live deployment.
      </p>

      {composing && <FlashAlertComposer onClose={() => setComposing(false)} />}
    </section>
  );
}
