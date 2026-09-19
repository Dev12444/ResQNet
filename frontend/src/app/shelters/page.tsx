"use client";

/**
 * `/shelters` — shelter intelligence and SafeRoute.
 *
 * Two honesty rules here:
 *   - Occupancy is a last-reported figure with its own age, never a
 *     reservation. A stale count says so.
 *   - SafeRoute is clearly labelled as an illustrative path. No routing engine
 *     is connected, so the steps are not a checked road route and the page
 *     says that rather than implying roads were verified.
 *
 * Owner: FE2.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Accessibility,
  Droplets,
  HeartPulse,
  Navigation,
  Phone,
  Search,
  Utensils,
} from "lucide-react";
import type { SafeRoute, Shelter, ShelterStatus } from "@/types";
import {
  GUJARAT_DISTRICTS,
  SHELTER_STATUS_META,
  STALE_AFTER_SEC,
} from "@/lib/constants";
import { getSafeRoute, getShelters } from "@/lib/api";
import { useEnvelope } from "@/components/layout/useEnvelope";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/layout/primitives";
import {
  DataModeBadge,
  FreshnessLabel,
  useNow,
} from "@/components/layout/ConnectionBar";

const STATUSES = Object.keys(SHELTER_STATUS_META) as ShelterStatus[];

export default function SheltersPage() {
  const shelters = useEnvelope(useCallback(() => getShelters(), []));
  const now = useNow();

  const [query, setQuery] = useState("");
  const [district, setDistrict] = useState("");
  const [statuses, setStatuses] = useState<ShelterStatus[]>([]);
  const [needs, setNeeds] = useState<string[]>([]);
  const [route, setRoute] = useState<SafeRoute | null>(null);
  const [routeFor, setRouteFor] = useState<string | null>(null);

  /* `?district=` — how the critical-alert banner's FIND SHELTER action arrives
     here. Read from `window.location` rather than `useSearchParams` so this
     route keeps its static prerender and needs no Suspense boundary; the value
     is matched against the real district list so a hand-typed query string
     can never leave the select showing something that filters to nothing. */
  useEffect(() => {
    const t = setTimeout(() => {
      const wanted = new URLSearchParams(window.location.search).get("district");
      if (!wanted) return;
      const match = GUJARAT_DISTRICTS.find(
        (d) => d.name.toLowerCase() === wanted.toLowerCase(),
      );
      if (match) setDistrict(match.name);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (shelters.data ?? []).filter((s) => {
      if (district && s.district !== district) return false;
      if (statuses.length && !statuses.includes(s.status)) return false;
      if (needs.includes("food") && !s.amenities.food) return false;
      if (needs.includes("water") && !s.amenities.water) return false;
      if (needs.includes("medical") && !s.amenities.medical) return false;
      if (needs.includes("accessible") && !s.amenities.accessible) return false;
      if (!q) return true;
      return `${s.name} ${s.address} ${s.district}`.toLowerCase().includes(q);
    });
  }, [shelters.data, query, district, statuses, needs]);

  const totals = useMemo(() => {
    const list = filtered;
    return {
      capacity: list.reduce((a, s) => a + s.capacity, 0),
      occupancy: list.reduce((a, s) => a + s.occupancy, 0),
      open: list.filter((s) => s.status === "open").length,
    };
  }, [filtered]);

  async function showRoute(shelter: Shelter) {
    setRouteFor(shelter.id);
    const env = await getSafeRoute(`${shelter.district} district centre`, shelter);
    setRoute(env.data);
  }

  if (shelters.loading && !shelters.data) return <LoadingState label="Loading shelters…" />;
  if (shelters.error && !shelters.data) {
    return (
      <div className="p-4">
        <ErrorState
          title="Could not load shelters"
          detail={shelters.error}
          onRetry={shelters.reload}
        />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-2 border-l-2 border-[var(--teal)] pl-3">
        <div>
          <h1 className="cmd text-[24px] leading-none">Shelters</h1>
          <p className="text-sm text-[var(--muted)]">
            {totals.open} open · {totals.occupancy.toLocaleString("en-IN")} of{" "}
            {totals.capacity.toLocaleString("en-IN")} places in use
          </p>
        </div>
        <DataModeBadge mode={shelters.mode} note={shelters.error} />
      </header>

      {/* Filters */}
      <div className="panel mb-3 flex flex-wrap items-center gap-2 px-3 py-2.5">
        <label className="relative min-w-56 flex-1">
          <span className="sr-only">Search shelters</span>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or address..."
            className="h-10 w-full border border-[var(--border-strong)] bg-[var(--surface)] pl-8 pr-2 text-sm"
          />
        </label>

        <label>
          <span className="sr-only">District</span>
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="h-10 border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-sm"
          >
            <option value="">All districts</option>
            {GUJARAT_DISTRICTS.map((d) => (
              <option key={d.id} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => (
            <Chip
              key={s}
              label={SHELTER_STATUS_META[s].label}
              active={statuses.includes(s)}
              onClick={() =>
                setStatuses((prev) =>
                  prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
                )
              }
            />
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {[
            { id: "food", label: "Food" },
            { id: "water", label: "Water" },
            { id: "medical", label: "Medical" },
            { id: "accessible", label: "Accessible" },
          ].map((n) => (
            <Chip
              key={n.id}
              label={n.label}
              active={needs.includes(n.id)}
              onClick={() =>
                setNeeds((prev) =>
                  prev.includes(n.id) ? prev.filter((x) => x !== n.id) : [...prev, n.id],
                )
              }
            />
          ))}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="panel">
          {filtered.length === 0 ? (
            <EmptyState
              title="No shelters match these filters"
              hint="Clear a filter to widen the search."
            />
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {filtered.map((s) => {
                const meta = SHELTER_STATUS_META[s.status];
                const pct = Math.round((s.occupancy / s.capacity) * 100);
                // Ages stay 0 until the client clock is available, so the
                // server and client render identically.
                const age =
                  now === null
                    ? 0
                    : Math.max(0, Math.round((now - Date.parse(s.updatedAt)) / 1000));
                const stale = age > STALE_AFTER_SEC;
                return (
                  <li key={s.id} className="px-3 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold">{s.name}</p>
                        <p className="text-xs text-[var(--muted)]">
                          {s.address} · {s.district}
                        </p>
                      </div>
                      <span
                        className="px-1.5 py-0.5 text-[10px] font-bold uppercase"
                        style={{ background: `${meta.color}14`, color: meta.color }}
                      >
                        {meta.label}
                      </span>
                    </div>

                    <div className="mt-2">
                      <div className="flex items-baseline justify-between">
                        <span className="mono text-[13px]">
                          <strong>{s.occupancy}</strong> / {s.capacity} places ({pct}%)
                        </span>
                        <FreshnessLabel ageSec={age} staleLabel="OCCUPANCY STALE" />
                      </div>
                      <div
                        className="mt-1 h-2 w-full bg-[var(--surface-3)]"
                        role="meter"
                        aria-valuenow={s.occupancy}
                        aria-valuemin={0}
                        aria-valuemax={s.capacity}
                        aria-label={`Occupancy at ${s.name}`}
                      >
                        <div
                          className="h-full"
                          style={{
                            width: `${Math.min(100, pct)}%`,
                            background: stale ? "var(--faint)" : meta.color,
                          }}
                        />
                      </div>
                      {stale && (
                        <p className="mt-1 text-[11px]" style={{ color: "var(--high)" }}>
                          This count is {Math.round(age / 60)} min old — confirm by phone
                          before sending people here.
                        </p>
                      )}
                    </div>

                    <ul className="mt-2 flex flex-wrap gap-3 text-[11px] text-[var(--muted)]">
                      <Amenity ok={s.amenities.food} icon={Utensils} label="Food" />
                      <Amenity ok={s.amenities.water} icon={Droplets} label="Water" />
                      <Amenity ok={s.amenities.medical} icon={HeartPulse} label="Medical" />
                      <Amenity
                        ok={s.amenities.accessible}
                        icon={Accessibility}
                        label="Accessible"
                      />
                    </ul>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <a
                        href={`tel:${s.contact.replace(/\s/g, "")}`}
                        className="inline-flex min-h-9 items-center gap-1.5 border border-[var(--carbon)] px-2.5 text-xs font-semibold no-underline"
                      >
                        <Phone className="size-3.5" aria-hidden />
                        {s.contact}
                      </a>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-9 items-center gap-1.5 border border-[var(--carbon)] px-2.5 text-xs font-semibold no-underline"
                      >
                        Directions
                      </a>
                      <button
                        type="button"
                        onClick={() => void showRoute(s)}
                        className="inline-flex min-h-9 items-center gap-1.5 border border-[var(--info)] px-2.5 text-xs font-semibold"
                        style={{ color: "var(--info)" }}
                      >
                        <Navigation className="size-3.5" aria-hidden />
                        SafeRoute
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* SafeRoute panel */}
        <section className="panel h-fit">
          <h2 className="border-b border-[var(--border)] px-3 py-2 text-[13px] font-bold uppercase tracking-wide">
            SafeRoute
          </h2>
          {route && routeFor ? (
            <div className="px-3 py-2.5">
              <p
                className="mb-2 border-l-4 px-2 py-1.5 text-[11px] leading-snug"
                style={{ borderColor: "var(--medium)", background: "var(--medium-bg)" }}
              >
                <strong>Illustrative route.</strong> No live routing engine is connected,
                so these steps have not been checked against current road conditions.
                Follow official instructions on the ground.
              </p>

              <p className="text-sm font-semibold">{route.toLabel}</p>
              <p className="mono text-[11px] text-[var(--muted)]">
                from {route.fromLabel}
              </p>
              <p className="mono mt-1 text-[13px]">
                {route.distanceKm} km · about {route.etaMin} min
              </p>

              <ol className="mt-2 space-y-1.5">
                {route.steps.map((step, i) => (
                  <li key={i} className="flex gap-2 text-[13px]">
                    <span className="mono shrink-0 text-[var(--muted)]">{i + 1}.</span>
                    <span>
                      {step.instruction}
                      {step.distanceKm > 0 && (
                        <span className="mono text-[11px] text-[var(--muted)]">
                          {" "}
                          ({step.distanceKm.toFixed(1)} km)
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>

              {route.hazardsAvoided.length > 0 && (
                <div className="mt-2 border-t border-[var(--border)] pt-2">
                  <p className="eyebrow text-[var(--muted)]">
                    Known hazards routed around
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {route.hazardsAvoided.map((h) => (
                      <li key={h} className="text-[12px]" style={{ color: "var(--high)" }}>
                        {h}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-[10px] text-[var(--faint)]">
                    Only hazards already reported to ResQNet are considered. Others may
                    exist.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              title="No route selected"
              hint="Choose SafeRoute on a shelter to see a suggested way there."
            />
          )}
        </section>
      </div>
    </div>
  );
}

function Amenity({
  ok,
  icon: Icon,
  label,
}: {
  ok: boolean;
  icon: typeof Utensils;
  label: string;
}) {
  return (
    <li
      className="flex items-center gap-1"
      style={{ color: ok ? "var(--ok)" : "var(--faint)" }}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
      {!ok && <span className="sr-only"> not available</span>}
      {!ok && <span aria-hidden>✕</span>}
    </li>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-9 border px-2.5 text-xs font-semibold ${
        active
          ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--surface)]"
          : "border-[var(--border-strong)] hover:bg-[var(--surface-2)]"
      }`}
    >
      {label}
    </button>
  );
}
