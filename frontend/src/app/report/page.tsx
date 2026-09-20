"use client";

/**
 * `/report` — the reporting suite.
 *
 * Six report families, a working index (search, filter, sort), a document
 * preview, and real exports. "Print / Save as PDF" drives the browser's own
 * print pipeline against the print stylesheet rather than claiming a generated
 * PDF we do not produce.
 *
 * The citizen SOS form lives at `/report/new`.
 *
 * Owner: FE2.
 */

import { pageStrings } from "@/lib/pageStrings";
import { labels } from "@/lib/i18n";
import { useLang } from "@/components/layout/LangProvider";
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Download, FileText, Search, TriangleAlert } from "lucide-react";
import type { ReportDoc, ReportKind, ReportStatus } from "@/types";
import {
  GUJARAT_DISTRICTS,
  REPORT_KIND_META,
} from "@/lib/constants";
import { getReportDocs } from "@/lib/api";
import { useEnvelope } from "@/components/layout/useEnvelope";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/layout/primitives";
import { DataModeBadge } from "@/components/layout/ConnectionBar";
import {
  SituationReport,
  downloadReportIndexCsv,
} from "@/components/report/SituationReport";

const KINDS = Object.keys(REPORT_KIND_META) as ReportKind[];
const STATUSES: ReportStatus[] = ["published", "draft", "archived"];

type SortKey = "newest" | "oldest" | "title" | "kind";

export default function ReportsPage() {
  const { lang } = useLang();
  const t = pageStrings(lang).reports;
  const tc = pageStrings(lang).common;
  const enums = labels(lang);
  const docs = useEnvelope(useCallback(() => getReportDocs(), []));

  const [query, setQuery] = useState("");
  const [kinds, setKinds] = useState<ReportKind[]>([]);
  const [district, setDistrict] = useState("");
  const [status, setStatus] = useState<ReportStatus | "">("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (docs.data ?? []).filter((d) => {
      if (kinds.length && !kinds.includes(d.kind)) return false;
      if (district && d.district !== district) return false;
      if (status && d.status !== status) return false;
      if (!q) return true;
      return `${d.id} ${d.title} ${d.summary} ${d.author} ${d.district ?? ""}`
        .toLowerCase()
        .includes(q);
    });

    return [...list].sort((a, b) => {
      switch (sort) {
        case "oldest":
          return Date.parse(a.generatedAt) - Date.parse(b.generatedAt);
        case "title":
          return a.title.localeCompare(b.title);
        case "kind":
          return enums.reportKind[a.kind].localeCompare(
            enums.reportKind[b.kind],
          );
        default:
          return Date.parse(b.generatedAt) - Date.parse(a.generatedAt);
      }
    });
  }, [docs.data, query, kinds, district, status, sort, enums]);

  const selected: ReportDoc | null = useMemo(() => {
    if (filtered.length === 0) return null;
    return filtered.find((d) => d.id === selectedId) ?? filtered[0];
  }, [filtered, selectedId]);

  const filtersActive =
    query.trim() !== "" || kinds.length > 0 || district !== "" || status !== "";

  if (docs.loading && !docs.data) return <LoadingState label={t.loading} />;
  if (docs.error && !docs.data) {
    return (
      <div className="p-4">
        <ErrorState title={t.loadErrorTitle} detail={docs.error} onRetry={docs.reload} />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4">
      <header className="no-print mb-3 flex flex-wrap items-end justify-between gap-2 border-l-2 border-[var(--teal)] pl-3">
        <div>
          <h1 className="cmd text-[24px] leading-none">{t.title}</h1>
          <p className="text-sm text-[var(--muted)]">
            {t.lead}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DataModeBadge mode={docs.mode} note={docs.error} />
          <button
            type="button"
            onClick={() => downloadReportIndexCsv(filtered)}
            className="inline-flex min-h-9 items-center gap-1.5 border border-[var(--carbon)] bg-[var(--surface)] px-2.5 text-xs font-semibold hover:bg-[var(--surface-2)]"
          >
            <Download className="size-3.5" aria-hidden />
            {t.exportIndex(filtered.length)}
          </button>
          <Link
            href="/report/new"
            className="inline-flex min-h-9 items-center gap-1.5 border border-[var(--coral-deep)] bg-[var(--coral)] px-3 cmd text-xs text-white no-underline"
          >
            <TriangleAlert className="size-3.5" aria-hidden />
            {t.reportEmergency}
          </Link>
        </div>
      </header>

      {/* Report families */}
      <div className="no-print mb-3 grid gap-px bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-3">
        {KINDS.map((kind) => {
          const active = kinds.includes(kind);
          const count = (docs.data ?? []).filter((d) => d.kind === kind).length;
          return (
            <button
              key={kind}
              type="button"
              onClick={() =>
                setKinds((prev) =>
                  prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind],
                )
              }
              aria-pressed={active}
              className={`flex items-start gap-2.5 border-l-4 px-3 py-2.5 text-left ${
                active
                  ? "border-[var(--critical)] bg-[var(--critical-bg)]"
                  : "border-transparent bg-[var(--surface)] hover:bg-[var(--surface-2)]"
              }`}
            >
              <FileText className="mt-0.5 size-4 shrink-0 text-[var(--muted)]" aria-hidden />
              <span className="min-w-0">
                <span className="block text-[13px] font-bold">
                  {enums.reportKind[kind]}
                  <span className="mono ml-1.5 font-normal text-[var(--muted)]">{count}</span>
                </span>
                <span className="block text-[11px] leading-snug text-[var(--muted)]">
                  {enums.reportKindNote[kind]}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Controls */}
      <div className="no-print panel mb-3 flex flex-wrap items-center gap-2 px-3 py-2.5">
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

        <label>
          <span className="sr-only">{t.status}</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ReportStatus | "")}
            className="h-10 border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-sm capitalize"
          >
            <option value="">{t.anyStatus}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t.publicationState[s]}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="sr-only">{t.sort}</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-10 border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-sm"
          >
            <option value="newest">{t.newest}</option>
            <option value="oldest">{t.oldest}</option>
            <option value="title">{t.titleAz}</option>
            <option value="kind">{t.reportType}</option>
          </select>
        </label>

        {filtersActive && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setKinds([]);
              setDistrict("");
              setStatus("");
            }}
            className="h-10 border border-[var(--border-strong)] px-2.5 text-sm font-semibold"
          >
            {tc.clear}
          </button>
        )}
      </div>

      {/* Index + preview */}
      <div className="grid gap-3 lg:grid-cols-[340px_1fr]">
        <section className="no-print panel">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
            <h2 className="cmd text-[13px]">{t.index}</h2>
            <span className="mono text-[11px] text-[var(--muted)]">
              {t.countOf(filtered.length, docs.data?.length ?? 0)}
            </span>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title={t.noMatches}
              hint={t.clearAFilter}
            />
          ) : (
            <ul className="thin-scroll max-h-[560px] divide-y divide-[var(--border)] overflow-y-auto">
              {filtered.map((d) => {
                const active = selected?.id === d.id;
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(d.id)}
                      aria-current={active}
                      className={`block w-full border-l-4 px-3 py-2.5 text-left ${
                        active
                          ? "border-[var(--info)] bg-[var(--info-bg)]"
                          : "border-transparent hover:bg-[var(--surface-2)]"
                      }`}
                    >
                      <span className="mono block text-[10px] font-semibold text-[var(--muted)]">
                        {d.id}
                      </span>
                      <span className="mt-0.5 block text-[13px] font-semibold leading-snug">
                        {d.title}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--muted)]">
                        <span
                          className="px-1"
                          style={{ background: "var(--surface-3)" }}
                        >
                          {enums.reportKind[d.kind]}
                        </span>
                        <span>{d.district ?? t.stateWide}</span>
                        <span aria-hidden>·</span>
                        <span>{d.status}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="panel min-w-0">
          {selected ? (
            <SituationReport doc={selected} />
          ) : (
            <EmptyState title={t.selectOne} />
          )}
        </section>
      </div>
    </div>
  );
}
