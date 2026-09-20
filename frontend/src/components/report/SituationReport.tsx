"use client";

/**
 * Government report renderer.
 *
 * Deliberately document-shaped rather than dashboard-shaped: masthead,
 * reference number, period, numbered sections, bordered tables, and a
 * signature block. The print stylesheet in `globals.css` strips the
 * application chrome, so "Print / Save as PDF" produces a clean document.
 */

import { Download, Printer } from "lucide-react";
import type { ReportDoc } from "@/types";
import { PLATFORM_TAGLINE, REPORT_KIND_META } from "@/lib/constants";
import { pageStrings } from "@/lib/pageStrings";
import { useLang } from "@/components/layout/LangProvider";

export function SituationReport({ doc }: { doc: ReportDoc }) {
  const t = pageStrings(useLang().lang).reports;
  return (
    <article className="bg-[var(--surface)]">
      {/* Toolbar — hidden when printing. */}
      <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
          {REPORT_KIND_META[doc.kind].label}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex min-h-9 items-center gap-1.5 border border-[var(--border-strong)] px-2.5 text-xs font-semibold hover:bg-[var(--surface-2)]"
          >
            <Printer className="size-3.5" aria-hidden />
            {t.print}
          </button>
          <button
            type="button"
            onClick={() => downloadReportCsv(doc)}
            className="inline-flex min-h-9 items-center gap-1.5 border border-[var(--border-strong)] px-2.5 text-xs font-semibold hover:bg-[var(--surface-2)]"
          >
            <Download className="size-3.5" aria-hidden />
            {t.exportCsv}
          </button>
        </div>
      </div>

      <div className="px-5 py-5 sm:px-8 sm:py-7">
        {/* Masthead */}
        <header className="border-b-2 border-[var(--foreground)] pb-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
            {t.docMasthead}
          </p>
          <p className="text-[11px] uppercase tracking-wide text-[var(--muted)]">
            {PLATFORM_TAGLINE}
          </p>
          <h1 className="mt-2 text-xl font-bold leading-tight">{doc.title}</h1>

          <dl className="mono mt-2.5 grid grid-cols-2 gap-x-6 gap-y-0.5 text-[11px] sm:grid-cols-4">
            <Meta label={t.docReference} value={doc.id} />
            <Meta
              label={t.docPeriod}
              value={`${date(doc.periodStart)} \u2013 ${date(doc.periodEnd)}`}
            />
            <Meta label={t.docGenerated} value={dateTime(doc.generatedAt)} />
            <Meta label={t.docIssuedBy} value={doc.author} />
          </dl>
        </header>

        {/* Executive summary */}
        <section className="mt-5">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--muted)]">
            {t.docSummary}
          </h2>
          <p className="mt-1.5 text-[14px] leading-relaxed">{doc.summary}</p>
        </section>

        {/* Body */}
        {doc.sections.map((section) => (
          <section key={section.heading} className="mt-5">
            <h2 className="text-[14px] font-bold">{section.heading}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--foreground)]">
              {section.body}
            </p>

            {section.table && (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr>
                      {section.table.columns.map((c) => (
                        <th
                          key={c}
                          scope="col"
                          className="border border-[var(--border-strong)] bg-[var(--surface-2)] px-2 py-1 text-left font-bold"
                        >
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.table.rows.map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td
                            key={j}
                            className={`border border-[var(--border)] px-2 py-1 ${
                              j > 0 ? "mono" : ""
                            }`}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}

        {/* Signature block */}
        <footer className="mt-8 border-t border-[var(--border)] pt-3">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <p className="mono text-[11px] text-[var(--muted)]">
              {t.docGeneratedBy(dateTime(doc.generatedAt))}
              <br />
              {t.docStatus(doc.status.toUpperCase())}
            </p>
            <div className="text-right">
              <div className="h-8 w-44 border-b border-[var(--foreground)]" />
              <p className="mt-1 text-[11px] text-[var(--muted)]">
                {t.docSignatory(doc.author)}
              </p>
            </div>
          </div>
          <p className="mt-3 text-[10px] leading-snug text-[var(--faint)]">
            {t.docFootnote}
          </p>
        </footer>
      </div>
    </article>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="uppercase tracking-wide text-[var(--faint)]">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

function date(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function dateTime(iso: string): string {
  return `${date(iso)} ${new Date(iso).toTimeString().slice(0, 5)}`;
}

/* ------------------------------------------------------------------ */
/* CSV export                                                          */
/* ------------------------------------------------------------------ */

function csvCell(value: string): string {
  // Quote anything containing a delimiter, quote or newline, per RFC 4180.
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Flattens the document to CSV: metadata rows, then each section, expanding
 * any table into real rows so the numbers survive the export.
 */
export function reportToCsv(doc: ReportDoc): string {
  const rows: string[][] = [
    ["Reference", doc.id],
    ["Title", doc.title],
    ["Kind", REPORT_KIND_META[doc.kind].label],
    ["District", doc.district ?? "State-wide"],
    ["Period start", doc.periodStart],
    ["Period end", doc.periodEnd],
    ["Generated", doc.generatedAt],
    ["Issued by", doc.author],
    ["Status", doc.status],
    [],
    ["Summary", doc.summary],
    [],
  ];

  for (const section of doc.sections) {
    rows.push(["Section", section.heading]);
    rows.push(["", section.body]);
    if (section.table) {
      rows.push(section.table.columns);
      for (const r of section.table.rows) rows.push(r);
    }
    rows.push([]);
  }

  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

export function downloadReportCsv(doc: ReportDoc): void {
  // BOM so Excel opens the Gujarati/Hindi content in the right encoding.
  const blob = new Blob(["﻿", reportToCsv(doc)], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${doc.id}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Export a whole listing, one row per report. */
export function downloadReportIndexCsv(docs: ReportDoc[]): void {
  const header = [
    "Reference",
    "Kind",
    "Title",
    "District",
    "Period start",
    "Period end",
    "Generated",
    "Issued by",
    "Status",
  ];
  const body = docs.map((d) => [
    d.id,
    REPORT_KIND_META[d.kind].label,
    d.title,
    d.district ?? "State-wide",
    d.periodStart,
    d.periodEnd,
    d.generatedAt,
    d.author,
    d.status,
  ]);
  const csv = [header, ...body].map((r) => r.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `resqnet-reports-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
