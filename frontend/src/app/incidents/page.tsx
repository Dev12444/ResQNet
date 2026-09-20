"use client";

/**
 * `/incidents` — public incident register with crowdsourced ground truth.
 *
 * Every citizen-sourced item carries its verification level, and the ResQ
 * Chain timeline shows exactly who confirmed what and when. An unverified
 * report is never presented as an established fact.
 *
 * The dispatcher queue with dispatch controls is FE1's `/dashboard`; this page
 * is the public register and does not duplicate it.
 *
 * Owner: FE2.
 */

import { useCallback, useMemo, useState } from "react";
import { Image as ImageIcon, Mic, Search, Video } from "lucide-react";
import type { DisasterType, GroundTruthLevel, MediaKind } from "@/types";
import {
  DISASTER_META,
  GROUND_TRUTH_META,
  GUJARAT_DISTRICTS,
} from "@/lib/constants";
import { getGroundTruth } from "@/lib/api";
import { pageStrings } from "@/lib/pageStrings";
import { labels } from "@/lib/i18n";
import { useLang } from "@/components/layout/LangProvider";
import { useEnvelope } from "@/components/layout/useEnvelope";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/layout/primitives";
import { DataModeBadge } from "@/components/layout/ConnectionBar";
import { IncidentTimeline } from "@/components/report/IncidentTimeline";
import {
  ConfirmationCount,
  GroundTruthBadge,
} from "@/components/report/VerificationBadge";

const LEVELS = Object.keys(GROUND_TRUTH_META) as GroundTruthLevel[];

const MEDIA_ICON: Record<MediaKind, typeof ImageIcon> = {
  photo: ImageIcon,
  video: Video,
  voice: Mic,
  text: Search,
};

export default function IncidentsPage() {
  const { lang } = useLang();
  const t = pageStrings(lang);
  const enums = labels(lang);
  const reports = useEnvelope(useCallback(() => getGroundTruth(), []));

  const [query, setQuery] = useState("");
  const [levels, setLevels] = useState<GroundTruthLevel[]>([]);
  const [types, setTypes] = useState<DisasterType[]>([]);
  const [district, setDistrict] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const availableTypes = useMemo(
    () => [...new Set((reports.data ?? []).map((r) => r.disaster))],
    [reports.data],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (reports.data ?? [])
      .filter((r) => {
        if (levels.length && !levels.includes(r.level)) return false;
        if (types.length && !types.includes(r.disaster)) return false;
        if (district && r.district !== district) return false;
        if (!q) return true;
        return `${r.id} ${r.location} ${r.text} ${r.district}`.toLowerCase().includes(q);
      })
      .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt));
  }, [reports.data, query, levels, types, district]);

  const selected = useMemo(
    () => filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  const counts = useMemo(() => {
    const out: Record<GroundTruthLevel, number> = {
      unverified: 0,
      community_confirmed: 0,
      authority_verified: 0,
    };
    for (const r of reports.data ?? []) out[r.level] += 1;
    return out;
  }, [reports.data]);

  if (reports.loading && !reports.data) return <LoadingState label={t.incidents.loading} />;
  if (reports.error && !reports.data) {
    return (
      <div className="p-4">
        <ErrorState
          title={t.incidents.loadError}
          detail={reports.error}
          onRetry={reports.reload}
        />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-2 border-l-2 border-[var(--teal)] pl-3">
        <div>
          <h1 className="cmd text-[24px] leading-none">{t.incidents.title}</h1>
          <p className="text-sm text-[var(--muted)]">{t.incidents.lead}</p>
        </div>
        <DataModeBadge mode={reports.mode} note={reports.error} />
      </header>

      {/* Verification mix — the headline number is how much is unconfirmed. */}
      <div className="mb-3 grid gap-px bg-[var(--border)] sm:grid-cols-3">
        {LEVELS.map((level) => {
          const meta = GROUND_TRUTH_META[level];
          const active = levels.includes(level);
          return (
            <button
              key={level}
              type="button"
              onClick={() =>
                setLevels((prev) =>
                  prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level],
                )
              }
              aria-pressed={active}
              className={`border-l-4 bg-[var(--surface)] px-3 py-2.5 text-left ${
                active ? "bg-[var(--surface-2)]" : "hover:bg-[var(--surface-2)]"
              }`}
              style={{ borderLeftColor: meta.color }}
            >
              <span className="mono block text-xl font-bold" style={{ color: meta.color }}>
                {counts[level]}
              </span>
              <span className="block text-[11px] font-bold uppercase tracking-wide">
                {enums.groundTruth[level]}
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-[var(--muted)]">
                {enums.groundTruthNote[level]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="panel mb-3 flex flex-wrap items-center gap-2 px-3 py-2.5">
        <label className="relative min-w-56 flex-1">
          <span className="sr-only">{t.incidents.searchLabel}</span>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.incidents.searchPlaceholder}
            className="h-10 w-full border border-[var(--border-strong)] bg-[var(--surface)] pl-8 pr-2 text-sm"
          />
        </label>

        <label>
          <span className="sr-only">{t.common.district}</span>
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="h-10 border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-sm"
          >
            <option value="">{t.common.allDistricts}</option>
            {GUJARAT_DISTRICTS.map((d) => (
              <option key={d.id} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap gap-1.5">
          {availableTypes.map((type) => {
            const meta = DISASTER_META[type];
            const active = types.includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() =>
                  setTypes((prev) =>
                    prev.includes(type) ? prev.filter((x) => x !== type) : [...prev, type],
                  )
                }
                aria-pressed={active}
                className="flex min-h-9 items-center gap-1.5 border px-2 text-xs font-semibold"
                style={
                  active
                    ? { borderColor: meta.color, background: `${meta.color}14`, color: meta.color }
                    : { borderColor: "var(--border-strong)" }
                }
              >
                <span
                  aria-hidden
                  className="inline-block size-2 rounded-full"
                  style={{ background: meta.color }}
                />
                {t.disaster[type]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Register */}
        <section className="panel">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
            <h2 className="cmd text-[13px]">{t.incidents.register}</h2>
            <span className="mono text-[11px] text-[var(--muted)]">
              {t.common.of(filtered.length, reports.data?.length ?? 0)}
            </span>
          </div>

          {filtered.length === 0 ? (
            <EmptyState title={t.incidents.noMatches} />
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {filtered.map((r) => {
                const meta = DISASTER_META[r.disaster];
                const active = selected?.id === r.id;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      aria-current={active}
                      className={`block w-full px-3 py-2.5 text-left ${
                        active ? "bg-[var(--info-bg)]" : "hover:bg-[var(--surface-2)]"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="mono text-[11px] font-semibold text-[var(--muted)]">
                          {r.id}
                        </span>
                        <span
                          className="px-1 text-[10px] font-bold uppercase"
                          style={{ background: `${meta.color}14`, color: meta.color }}
                        >
                          {t.disaster[r.disaster]}
                        </span>
                        <GroundTruthBadge level={r.level} />
                        <span className="ml-auto flex gap-1 text-[var(--muted)]">
                          {r.media.map((m) => {
                            const Icon = MEDIA_ICON[m];
                            return <Icon key={m} className="size-3.5" aria-label={m} />;
                          })}
                        </span>
                      </div>

                      {/* The citizen's own words, in their own script. */}
                      <p lang={r.lang} className="mt-1 text-[13px] leading-snug">
                        {r.text}
                      </p>
                      <p className="mono mt-1 text-[11px] text-[var(--muted)]">
                        {r.location} · {r.district} ·{" "}
                        {new Date(r.submittedAt).toTimeString().slice(0, 5)}
                      </p>
                      <p className="mt-0.5">
                        <ConfirmationCount count={r.confirmations} />
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Chain detail */}
        <section className="panel min-w-0">
          <h2 className="border-b border-[var(--border)] px-3 py-2 text-[13px] font-bold uppercase tracking-wide">
            {t.incidents.chain}
          </h2>
          {selected ? (
            <>
              <div className="border-b border-[var(--border)] px-3 py-2.5">
                <p className="mono text-[11px] text-[var(--muted)]">{selected.id}</p>
                <p className="text-sm font-semibold">{selected.location}</p>
                <p className="mt-1">
                  <GroundTruthBadge level={selected.level} showNote />
                </p>
              </div>
              <IncidentTimeline chain={selected.chain} />
            </>
          ) : (
            <EmptyState title={t.incidents.selectOne} />
          )}
        </section>
      </div>
    </div>
  );
}
