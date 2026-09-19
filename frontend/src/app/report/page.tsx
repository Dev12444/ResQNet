"use client";

/**
 * `/report` — citizen emergency reporting. Mobile first.
 *
 * Owner: FE2.
 */

import { useState } from "react";
import type { Lang, ReportCreateResponse } from "@/types";
import { UI_STRINGS } from "@/lib/constants";
import { ReportForm } from "@/components/report/ReportForm";
import { ReportReceipt } from "@/components/report/ReportReceipt";

export default function ReportPage() {
  const [lang, setLang] = useState<Lang>("en");
  const [submission, setSubmission] = useState<{
    result: ReportCreateResponse;
    originalText: string;
    submittedAt: string;
  } | null>(null);

  const t = UI_STRINGS[lang];

  return (
    <div className="mx-auto w-full max-w-xl px-3 py-4">
      {submission ? (
        <ReportReceipt
          result={submission.result}
          lang={lang}
          submittedAt={submission.submittedAt}
          originalText={submission.originalText}
          onNewReport={() => setSubmission(null)}
        />
      ) : (
        <>
          <header className="mb-4">
            <h1 className="text-xl font-bold tracking-tight">{t.reportTitle}</h1>
            <p className="mt-0.5 text-sm text-[var(--muted)]">{t.reportLead}</p>
          </header>
          <ReportForm
            lang={lang}
            onLangChange={setLang}
            onSubmitted={(result, originalText) =>
              setSubmission({
                result,
                originalText,
                submittedAt: new Date().toISOString(),
              })
            }
          />
        </>
      )}
    </div>
  );
}
