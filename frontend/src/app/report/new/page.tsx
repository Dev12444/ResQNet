"use client";

/**
 * `/report/new` — citizen SOS. Mobile first.
 *
 * This is the destination of the "Report an Emergency" action. `/report`
 * itself is the government reporting suite.
 *
 * Owner: FE2.
 */

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReportCreateResponse } from "@/types";
import { INCIDENT_TYPE_META, nearestDistrict, UI_STRINGS } from "@/lib/constants";
import { publishIncoming } from "@/lib/liveAlerts";
import { useLang } from "@/components/layout/AppShell";
import { ReportForm } from "@/components/report/ReportForm";
import { ReportReceipt } from "@/components/report/ReportReceipt";

/**
 * Turn an accepted report into an Alert Flash entry.
 *
 * Severity comes from the classifier, not from the reporter. A classified
 * emergency (3 and above) raises the banner; a level 1-2 report is logged and
 * worked without interrupting every open page. Only a level 5 gets the crimson
 * treatment — below that the banner is amber, because an unverified account
 * from one person is not yet an official warning and must not look like one.
 * Provenance stays "citizen report, unverified" until the control room
 * confirms it — see `CriticalAlertBanner`.
 */
function raiseFlash(result: ReportCreateResponse) {
  const { incident } = result;
  const sev = incident.severity;
  if (sev < 3) return;
  const district = nearestDistrict(incident.lat, incident.lng);
  const kind = INCIDENT_TYPE_META[incident.type]?.label ?? "Emergency";
  publishIncoming({
    kind: "citizen",
    severity: sev >= 5 ? "critical" : "high",
    headline: `${kind} reported${district ? ` · ${district.name}` : ""}`,
    detail:
      incident.ai_summary?.trim() ||
      incident.title ||
      "A citizen has reported an emergency. Details are being verified.",
    district: district?.name ?? null,
    source: "a citizen on this device",
    href: "/incidents",
  });
}

export default function NewReportPage() {
  const { lang, setLang } = useLang();
  const [submission, setSubmission] = useState<{
    result: ReportCreateResponse;
    originalText: string;
    submittedAt: string;
    queued: boolean;
  } | null>(null);

  const t = UI_STRINGS[lang];

  return (
    <div className="mx-auto w-full max-w-xl px-3 py-4">
      <Link
        href="/"
        className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--info)] no-underline hover:underline"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Back to overview
      </Link>

      {submission ? (
        <ReportReceipt
          result={submission.result}
          lang={lang}
          submittedAt={submission.submittedAt}
          originalText={submission.originalText}
          queued={submission.queued}
          onNewReport={() => setSubmission(null)}
        />
      ) : (
        <>
          <header className="mb-4">
            <h1 className="cmd text-[24px] leading-none">{t.reportTitle}</h1>
            <p className="mt-0.5 text-sm text-[var(--muted)]">{t.reportLead}</p>
          </header>
          <ReportForm
            lang={lang}
            onLangChange={setLang}
            onSubmitted={(result, originalText, queued) => {
              setSubmission({
                result,
                originalText,
                queued,
                submittedAt: new Date().toISOString(),
              });
              // A report that has actually reached the incident queue raises
              // the Alert Flash banner, so the citizen and anyone else with
              // ResQNet open on this device sees it immediately rather than
              // only on the receipt screen. A queued offline report does not:
              // it has not reached anyone yet, and saying otherwise would be
              // the one lie this platform must never tell.
              if (!queued) raiseFlash(result);
            }}
          />
        </>
      )}
    </div>
  );
}
