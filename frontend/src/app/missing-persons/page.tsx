"use client";

/**
 * `/missing-persons` — missing and found register.
 *
 * Privacy is the constraint that shapes this page. The register carries an age
 * band rather than a date of birth, no contact details, and no home address —
 * enough for a member of the public to recognise someone, not enough to profile
 * them. Cases that reach "Reunited" are collapsed by default.
 *
 * Owner: FE2.
 */

import { pageStrings } from "@/lib/pageStrings";
import { labels } from "@/lib/i18n";
import { useLang } from "@/components/layout/LangProvider";
import { useCallback, useMemo, useState } from "react";
import { Search, UserSearch } from "lucide-react";
import type { MissingStatus } from "@/types";
import { GUJARAT_DISTRICTS, MISSING_STATUS_META } from "@/lib/constants";
import { getMissingPersons } from "@/lib/api";
import { useEnvelope } from "@/components/layout/useEnvelope";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/layout/primitives";
import { DataModeBadge } from "@/components/layout/ConnectionBar";

const STATUSES = Object.keys(MISSING_STATUS_META) as MissingStatus[];

export default function MissingPersonsPage() {
  const { lang } = useLang();
  const t = pageStrings(lang).missing;
  const enums = labels(lang);
  const tc = pageStrings(lang).common;
  const people = useEnvelope(useCallback(() => getMissingPersons(), []));

  const [query, setQuery] = useState("");
  const [district, setDistrict] = useState("");
  const [statuses, setStatuses] = useState<MissingStatus[]>([]);
  const [showResolved, setShowResolved] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (people.data ?? [])
      .filter((p) => {
        if (!showResolved && p.status === "reunited") return false;
        if (statuses.length && !statuses.includes(p.status)) return false;
        if (district && p.district !== district) return false;
        if (!q) return true;
        return `${p.name} ${p.lastSeenLocation} ${p.district} ${p.description}`
          .toLowerCase()
          .includes(q);
      })
      .sort(
        (a, b) =>
          STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status) ||
          Date.parse(b.reportedAt) - Date.parse(a.reportedAt),
      );
  }, [people.data, query, district, statuses, showResolved]);

  const counts = useMemo(() => {
    const out = { missing: 0, potential_match: 0, located: 0, reunited: 0 };
    for (const p of people.data ?? []) out[p.status] += 1;
    return out;
  }, [people.data]);

  if (people.loading && !people.data) return <LoadingState label={t.loading} />;
  if (people.error && !people.data) {
    return (
      <div className="p-4">
        <ErrorState
          title={t.loadErrorTitle}
          detail={people.error}
          onRetry={people.reload}
        />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-2 border-l-2 border-[var(--teal)] pl-3">
        <div>
          <h1 className="cmd text-[24px] leading-none">{t.title}</h1>
          <p className="text-sm text-[var(--muted)]">
            {t.ladder}
          </p>
        </div>
        <DataModeBadge mode={people.mode} note={people.error} />
      </header>

      <div className="mb-3 grid gap-px bg-[var(--border)] sm:grid-cols-4">
        {STATUSES.map((s) => {
          const meta = MISSING_STATUS_META[s];
          const active = statuses.includes(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() =>
                setStatuses((prev) =>
                  prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
                )
              }
              aria-pressed={active}
              className={`border-l-4 bg-[var(--surface)] px-3 py-2.5 text-left ${
                active ? "bg-[var(--surface-2)]" : "hover:bg-[var(--surface-2)]"
              }`}
              style={{ borderLeftColor: meta.color }}
            >
              <span className="mono block text-xl font-bold" style={{ color: meta.color }}>
                {counts[s]}
              </span>
              <span className="block text-[11px] font-bold uppercase tracking-wide">
                {enums.missingStatus[s]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="panel mb-3 flex flex-wrap items-center gap-2 px-3 py-2.5">
        <label className="relative min-w-56 flex-1">
          <span className="sr-only">{t.searchLabel}</span>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="h-10 w-full border border-[var(--border-strong)] bg-[var(--surface)] pl-8 pr-2 text-sm"
          />
        </label>

        <label>
          <span className="sr-only">{tc.district}</span>
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="h-10 border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-sm"
          >
            <option value="">{tc.allDistricts}</option>
            {GUJARAT_DISTRICTS.map((d) => (
              <option key={d.id} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex h-10 items-center gap-2 border border-[var(--border-strong)] px-2.5 text-sm">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
            className="size-4"
          />
          {t.showReunited}
        </label>
      </div>

      <section className="panel">
        {filtered.length === 0 ? (
          <EmptyState
            title={t.noMatches}
            hint={t.reunitedHidden}
          />
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {filtered.map((p) => {
              const meta = MISSING_STATUS_META[p.status];
              return (
                <li key={p.id} className="flex gap-3 px-3 py-3">
                  <span
                    aria-hidden
                    className="flex size-14 shrink-0 items-center justify-center bg-[var(--surface-3)] text-[var(--faint)]"
                  >
                    <UserSearch className="size-6" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="mono text-[11px] text-[var(--muted)]">{p.id}</span>
                      <span className="text-[14px] font-semibold">{p.name}</span>
                      <span className="text-xs text-[var(--muted)]">age {p.ageBand}</span>
                      <span
                        className="px-1.5 py-0.5 text-[10px] font-bold uppercase"
                        style={{ background: `${meta.color}14`, color: meta.color }}
                      >
                        {enums.missingStatus[p.status]}
                      </span>
                    </div>

                    <p className="mt-1 text-[13px]">{p.description}</p>

                    <dl className="mono mt-1.5 flex flex-wrap gap-x-5 gap-y-0.5 text-[11px] text-[var(--muted)]">
                      <span>
                        <dt className="inline">{t.lastSeenAt} </dt>
                        <dd className="inline">
                          {p.lastSeenLocation}, {p.district}
                        </dd>
                      </span>
                      <span>
                        <dt className="inline">{t.at} </dt>
                        <dd className="inline">
                          {new Date(p.lastSeenAt).toTimeString().slice(0, 5)}
                        </dd>
                      </span>
                      <span>
                        <dt className="inline">{t.caseOfficer} </dt>
                        <dd className="inline">{p.caseOfficer}</dd>
                      </span>
                    </dl>

                    {!p.hasPhoto && (
                      <p className="mt-1 text-[11px] text-[var(--faint)]">
                        {t.noPhoto}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <p className="border-t border-[var(--border)] px-3 py-2 text-[11px] leading-snug text-[var(--faint)]">
          This register shows only what is needed to help identify someone. Contact
          details, addresses and dates of birth are held by the case officer and are not
          published here. If you recognise someone, call the district emergency line on{" "}
          <a href="tel:1077" className="font-semibold underline">
            1077
          </a>
          .
        </p>
      </section>
    </div>
  );
}
