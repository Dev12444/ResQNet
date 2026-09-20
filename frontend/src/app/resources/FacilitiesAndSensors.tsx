"use client";

/**
 * Facility capacity and sensor health.
 *
 * Bed counts and sensor readings both age badly. A bed count from 30 minutes
 * ago is a hint, not an allocation, and a sensor that has stopped sending
 * heartbeats is not reporting "no problem" — it is reporting nothing. Both
 * panels state which of the two they are showing.
 */

import type { FacilityView, Sensor } from "@/types";
import { SENSOR_HEALTH_META, STALE_AFTER_SEC } from "@/lib/constants";
import { Badge, EmptyState } from "@/components/layout/primitives";
import { FreshnessLabel, formatAge } from "@/components/layout/ConnectionBar";
import { pageStrings } from "@/lib/pageStrings";
import { labels } from "@/lib/i18n";
import { useLang } from "@/components/layout/LangProvider";

export function FacilitiesPanel({ facilities }: { facilities: FacilityView[] }) {
  const { lang } = useLang();
  const t = pageStrings(lang).resources;
  const tm = pageStrings(lang).misc.freshness;
  if (facilities.length === 0) {
    return <EmptyState title={t.noFacilities} />;
  }
  return (
    <ul className="divide-y divide-[var(--border)]">
      {facilities.map((f) => {
        const stale = f.freshness.age_sec > STALE_AFTER_SEC;
        const total = f.beds_total;
        const free = f.beds_available;
        const pct = total && free !== null ? Math.round((free / total) * 100) : null;
        const tight = pct !== null && pct <= 15;
        return (
          <li key={f.id} className="px-3 py-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-semibold">{f.name}</span>
              <span className="text-xs uppercase tracking-wide text-[var(--muted)]">
                {f.kind.replace("_", " ")} · {f.district}
              </span>
            </div>

            {total !== null && free !== null ? (
              <div className="mt-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="mono text-sm">
                    <strong className="font-semibold">{free}</strong> of {total} beds free
                  </span>
                  {tight && <Badge label={t.nearCapacity} color="var(--high)" variant="tint" />}
                </div>
                <div
                  className="mt-1 h-2 w-full bg-[var(--surface-2)]"
                  role="meter"
                  aria-valuenow={free}
                  aria-valuemin={0}
                  aria-valuemax={total}
                  aria-label={`Beds available at ${f.name}`}
                >
                  <div
                    className="h-full"
                    style={{
                      width: `${pct}%`,
                      background: stale
                        ? "var(--faint)"
                        : tight
                          ? "var(--high)"
                          : "var(--ok)",
                    }}
                  />
                </div>
              </div>
            ) : (
              <p className="mt-1 text-sm text-[var(--muted)]">{t.noBedCapacity}</p>
            )}

            <div className="mt-1.5">
              <FreshnessLabel ageSec={f.freshness.age_sec} staleLabel={tm.capacityStale} />
              {stale && (
                <p className="mt-0.5 text-xs" style={{ color: "var(--high)" }}>
                  Confirm by phone before routing a patient — this count is{" "}
                  {formatAge(f.freshness.age_sec)} old and is not guaranteed.
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function SensorsPanel({ sensors }: { sensors: Sensor[] }) {
  const { lang } = useLang();
  const t = pageStrings(lang).resources;
  const enums = labels(lang);
  if (sensors.length === 0) {
    return <EmptyState title={t.noSensors} />;
  }
  return (
    <ul className="divide-y divide-[var(--border)]">
      {sensors.map((s) => {
        const meta = SENSOR_HEALTH_META[s.health];
        const over = s.value !== null && s.value > s.threshold;
        return (
          <li key={s.id} className="px-3 py-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="mono text-sm font-semibold">{s.id}</span>
              <Badge label={enums.sensorHealth[s.health]} color={meta.color} variant="tint" />
            </div>
            <p className="text-sm">{s.label}</p>

            <p className="mono mt-1 text-sm">
              {s.value === null ? (
                <span style={{ color: "var(--faint)" }}>{t.noReading}</span>
              ) : (
                <>
                  <strong
                    className="font-semibold"
                    style={{ color: over ? "var(--critical)" : undefined }}
                  >
                    {s.value} {s.unit}
                  </strong>
                  <span className="text-[var(--muted)]">
                    {" "}
                    / threshold {s.threshold} {s.unit}
                  </span>
                </>
              )}
            </p>

            <dl className="mono mt-1 flex flex-wrap gap-x-4 text-xs text-[var(--muted)]">
              <div>
                <dt className="inline">{t.reading} </dt>
                <dd className="inline">{clock(s.updated_at)}</dd>
              </div>
              <div>
                <dt className="inline">{t.heartbeat} </dt>
                <dd className="inline">{clock(s.last_heartbeat)}</dd>
              </div>
            </dl>

            {s.health === "offline" && (
              <p className="mt-1 text-xs" style={{ color: "var(--high)" }}>
                {t.noHeartbeatNote}
              </p>
            )}
            {s.health === "anomalous" && (
              <p className="mt-1 text-xs" style={{ color: "var(--critical)" }}>
                {t.thresholdNote}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function clock(iso: string): string {
  return new Date(iso).toTimeString().slice(0, 8);
}
