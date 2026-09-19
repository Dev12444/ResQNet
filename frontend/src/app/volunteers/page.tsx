"use client";

/**
 * `/volunteers` — relief requests and NGO coordination.
 *
 * Requests move Open → Claimed → In Transit → Delivered. Claiming is a real
 * state change held on the device for the demo; the page says so rather than
 * implying the control room has been notified.
 *
 * Owner: FE2.
 */

import { useCallback, useMemo, useState } from "react";
import {
  BriefcaseMedical,
  Droplets,
  LifeBuoy,
  Search,
  Truck,
  Utensils,
} from "lucide-react";
import type { ReliefKind, ReliefRequest, ReliefStatus } from "@/types";
import {
  GUJARAT_DISTRICTS,
  PRIORITY_COLOR,
  PRIORITY_LABEL,
  RELIEF_KIND_META,
  RELIEF_STATUS_META,
} from "@/lib/constants";
import { getReliefRequests } from "@/lib/api";
import { useEnvelope } from "@/components/layout/useEnvelope";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/layout/primitives";
import { DataModeBadge } from "@/components/layout/ConnectionBar";

const KINDS = Object.keys(RELIEF_KIND_META) as ReliefKind[];
const STATUSES = Object.keys(RELIEF_STATUS_META) as ReliefStatus[];

const KIND_ICON = {
  food: Utensils,
  water: Droplets,
  medical: BriefcaseMedical,
  rescue: LifeBuoy,
  transport: Truck,
} as const;

/** Forward-only lifecycle for a request. */
const NEXT_STATUS: Record<ReliefStatus, ReliefStatus | null> = {
  open: "claimed",
  claimed: "in_transit",
  in_transit: "delivered",
  delivered: null,
};

export default function VolunteersPage() {
  const requests = useEnvelope(useCallback(() => getReliefRequests(), []));

  const [query, setQuery] = useState("");
  const [district, setDistrict] = useState("");
  const [kinds, setKinds] = useState<ReliefKind[]>([]);
  const [statuses, setStatuses] = useState<ReliefStatus[]>([]);
  /** Local-only claims, so the page can demonstrate the lifecycle. */
  const [overrides, setOverrides] = useState<Record<string, ReliefStatus>>({});

  const merged: ReliefRequest[] = useMemo(
    () =>
      (requests.data ?? []).map((r) =>
        overrides[r.id] ? { ...r, status: overrides[r.id], claimedBy: r.claimedBy ?? "You" } : r,
      ),
    [requests.data, overrides],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return merged
      .filter((r) => {
        if (kinds.length && !kinds.includes(r.kind)) return false;
        if (statuses.length && !statuses.includes(r.status)) return false;
        if (district && r.district !== district) return false;
        if (!q) return true;
        return `${r.id} ${r.location} ${r.district} ${r.claimedBy ?? ""}`
          .toLowerCase()
          .includes(q);
      })
      .sort(
        (a, b) =>
          STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status) ||
          a.priority.localeCompare(b.priority),
      );
  }, [merged, query, district, kinds, statuses]);

  const openCount = merged.filter((r) => r.status === "open").length;

  if (requests.loading && !requests.data) {
    return <LoadingState label="Loading relief requests…" />;
  }
  if (requests.error && !requests.data) {
    return (
      <div className="p-4">
        <ErrorState
          title="Could not load relief requests"
          detail={requests.error}
          onRetry={requests.reload}
        />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-2 border-l-2 border-[var(--teal)] pl-3">
        <div>
          <h1 className="cmd text-[24px] leading-none">Volunteers &amp; NGOs</h1>
          <p className="text-sm text-[var(--muted)]">
            {openCount} unclaimed request{openCount === 1 ? "" : "s"} across{" "}
            {new Set(merged.map((r) => r.district)).size} districts
          </p>
        </div>
        <DataModeBadge mode={requests.mode} note={requests.error} />
      </header>

      <div className="panel mb-3 flex flex-wrap items-center gap-2 px-3 py-2.5">
        <label className="relative min-w-56 flex-1">
          <span className="sr-only">Search relief requests</span>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search location, reference or organisation..."
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
          {KINDS.map((k) => (
            <Chip
              key={k}
              label={RELIEF_KIND_META[k].label}
              active={kinds.includes(k)}
              onClick={() =>
                setKinds((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))
              }
            />
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => (
            <Chip
              key={s}
              label={RELIEF_STATUS_META[s].label}
              active={statuses.includes(s)}
              onClick={() =>
                setStatuses((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]))
              }
            />
          ))}
        </div>
      </div>

      <section className="panel">
        {filtered.length === 0 ? (
          <EmptyState title="No requests match these filters" />
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {filtered.map((r) => {
              const meta = RELIEF_STATUS_META[r.status];
              const kindMeta = RELIEF_KIND_META[r.kind];
              const Icon = KIND_ICON[r.kind];
              const next = NEXT_STATUS[r.status];
              return (
                <li key={r.id} className="flex flex-wrap items-start gap-3 px-3 py-3">
                  <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center bg-[var(--surface-3)] text-[var(--muted)]"
                  >
                    <Icon className="size-5" />
                  </span>

                  <div className="min-w-48 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="mono text-[11px] text-[var(--muted)]">{r.id}</span>
                      <span className="text-[14px] font-semibold">
                        {r.quantity.toLocaleString("en-IN")} {r.unit} — {kindMeta.label}
                      </span>
                      <span
                        className="px-1.5 py-0.5 text-[10px] font-bold uppercase"
                        style={{
                          background: `${PRIORITY_COLOR[r.priority]}14`,
                          color: PRIORITY_COLOR[r.priority],
                        }}
                      >
                        {PRIORITY_LABEL[r.priority]}
                      </span>
                    </div>
                    <p className="mono mt-0.5 text-[11px] text-[var(--muted)]">
                      {r.location} · {r.district}
                      {r.claimedBy && ` · claimed by ${r.claimedBy}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className="px-1.5 py-0.5 text-[10px] font-bold uppercase"
                      style={{ background: `${meta.color}14`, color: meta.color }}
                    >
                      {meta.label}
                    </span>
                    {next && (
                      <button
                        type="button"
                        onClick={() =>
                          setOverrides((prev) => ({ ...prev, [r.id]: next }))
                        }
                        className="min-h-9 border border-[var(--border-strong)] px-2.5 text-xs font-semibold hover:bg-[var(--surface-2)]"
                      >
                        Mark {RELIEF_STATUS_META[next].label}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <p className="border-t border-[var(--border)] px-3 py-2 text-[11px] text-[var(--faint)]">
          Status changes made here are held on this device for the demonstration. They
          are not yet sent to the state control room — the coordination endpoint is an
          open integration.
        </p>
      </section>
    </div>
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
