"use client";

/**
 * Unit roster.
 *
 * The operational status shown here is not simply `Resource.status`: a unit
 * that is `assigned` may actually be EN ROUTE or ON SCENE, which is what a
 * dispatcher needs to see. Location freshness is shown on every row, because
 * an ETA computed from a 40-minute-old position is not an ETA.
 */

import { pageStrings } from "@/lib/pageStrings";
import { labels } from "@/lib/i18n";
import { useLang } from "@/components/layout/LangProvider";
import type { ResourceView } from "@/types";
import {
  RESOURCE_VIEW_STATUS_COLOR,
  type ResourceViewStatus,
} from "@/lib/constants";
import { Badge, EmptyState } from "@/components/layout/primitives";
import { FreshnessLabel } from "@/components/layout/ConnectionBar";

/** Assignment state outranks the raw resource status where they disagree. */
export function viewStatus(unit: ResourceView): ResourceViewStatus {
  if (unit.status === "offline") return "offline";
  if (unit.assignment?.status === "en_route") return "en_route";
  if (unit.assignment?.status === "on_scene") return "on_scene";
  if (unit.status === "assigned") return "assigned";
  if (unit.status === "busy") return "busy";
  return "available";
}

export function UnitsTable({ units }: { units: ResourceView[] }) {
  const { lang } = useLang();
  const t = pageStrings(lang).resources;
  const enums = labels(lang);
  if (units.length === 0) {
    return <EmptyState title={t.noUnits} hint={t.clearAFilter} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <caption className="sr-only">
          {t.tableCaption}
        </caption>
        <thead>
          <tr className="border-b-2 border-[var(--border-strong)] text-left">
            <Th>{t.callsign}</Th>
            <Th>{t.kind}</Th>
            <Th>{t.status}</Th>
            <Th>{t.assignment}</Th>
            <Th>{t.eta}</Th>
            <Th>{pageStrings(lang).common.district}</Th>
            <Th>{t.base}</Th>
            <Th>{t.capabilities}</Th>
            <Th>{t.locationUpdated}</Th>
          </tr>
        </thead>
        <tbody>
          {units.map((unit) => {
            const status = viewStatus(unit);
            const offline = status === "offline";
            return (
              <tr
                key={unit.id}
                className="border-b border-[var(--border)] align-top hover:bg-[var(--surface-2)]"
              >
                <td className="mono px-2 py-1.5 font-semibold">{unit.callsign}</td>
                <td className="px-2 py-1.5">{enums.resourceKind[unit.kind]}</td>
                <td className="px-2 py-1.5">
                  <Badge
                    label={enums.resourceViewStatus[status]}
                    color={RESOURCE_VIEW_STATUS_COLOR[status]}
                    variant="tint"
                  />
                </td>
                <td className="mono px-2 py-1.5">
                  {unit.assignment ? unit.assignment.incident_code : "—"}
                </td>
                <td className="mono px-2 py-1.5">
                  {unit.assignment ? (
                    offline ? (
                      <span style={{ color: "var(--faint)" }}>unknown</span>
                    ) : (
                      <>
                        {unit.assignment.eta_min} min
                        <span className="block text-[10px] uppercase text-[var(--muted)]">
                          estimate
                        </span>
                      </>
                    )
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-2 py-1.5">{unit.district}</td>
                <td className="px-2 py-1.5 text-[var(--muted)]">{unit.base}</td>
                <td className="px-2 py-1.5 text-xs text-[var(--muted)]">
                  {unit.capabilities.join(" · ")}
                </td>
                <td className="px-2 py-1.5">
                  <FreshnessLabel ageSec={unit.freshness.age_sec} offline={offline} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide">
      {children}
    </th>
  );
}
