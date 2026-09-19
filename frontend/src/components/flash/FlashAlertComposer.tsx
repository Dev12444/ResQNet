"use client";

/**
 * Flash Alert composer — the control-room half of the warning workflow.
 *
 * The screen an authorised operator sees before a mass warning goes out. It
 * shows every consequential field at once, because the decision is made on
 * this screen and scrolling to find the target area is how the wrong district
 * gets warned:
 *
 *   INCIDENT · SEVERITY · AFFECTED AREA · TARGET POPULATION
 *   LANGUAGES · MESSAGE · ISSUING AUTHORITY · EXPIRY
 *
 * Where the AI got involved, it is shown as a recommendation with its
 * rationale and confidence, and the operator has to look at it to dismiss it.
 * The model cannot send: `send()` is called from the confirm button and from
 * nowhere else in the codebase.
 *
 * The confirm step is deliberately two-stage — PREVIEW ALERT first, then SEND.
 * The preview renders exactly what a citizen will see, in every approved
 * language, so nobody approves wording they have not read.
 */

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Check,
  Clock3,
  Eye,
  MapPin,
  Send,
  Users,
  X,
} from "lucide-react";
import type { Lang } from "@/types";
import type { FlashScenario, FlashSeverity } from "@/types/flash";
import {
  FLASH_SCENARIO_META,
  FLASH_SEVERITY_META,
  estimateReach,
  formatReach,
  renderCopy,
} from "@/lib/flash";
import type { FlashRecommendation } from "@/types/flash";
import { GUJARAT_DISTRICTS } from "@/lib/constants";
import { FLASH_AUTHORITY, FLASH_OPERATOR, useFlashAlert } from "./FlashAlertProvider";

const LANG_LABEL: Record<Lang, string> = {
  en: "English",
  gu: "ગુજરાતી",
  hi: "हिन्दी",
};
const ALL_LANGS: Lang[] = ["en", "gu", "hi"];

export function FlashAlertComposer({
  onClose,
  recommendation,
  incident,
}: {
  onClose: () => void;
  /** Present when the AI proposed this warning. Advisory only. */
  recommendation?: FlashRecommendation | null;
  incident?: { code: string; title: string } | null;
}) {
  const { send } = useFlashAlert();

  const [scenario, setScenario] = useState<FlashScenario>(
    recommendation?.scenario ?? "cyclone",
  );
  const [severity, setSeverity] = useState<FlashSeverity>(
    recommendation?.severity ?? "extreme",
  );
  const [district, setDistrict] = useState<string | null>(
    recommendation?.target.district ?? "Kutch",
  );
  const [area, setArea] = useState(
    recommendation?.target.area ?? "Kutch Coastal Region",
  );
  const [languages, setLanguages] = useState<Lang[]>(ALL_LANGS);
  const [expiryHours, setExpiryHours] = useState(6);
  const [stage, setStage] = useState<"compose" | "preview">("compose");
  /* Expiry is measured from when the composer opened, not from each render. */
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setOpenedAt(Date.now()), 0);
    return () => clearTimeout(t);
  }, []);
  const [previewLang, setPreviewLang] = useState<Lang>("en");

  const copy = useMemo(() => renderCopy(scenario, area || "the affected area"), [scenario, area]);
  const reach = useMemo(() => estimateReach(district), [district]);
  const sevMeta = FLASH_SEVERITY_META[severity];

  const valid = area.trim().length > 2 && languages.length > 0;

  const toggleLang = (l: Lang) =>
    setLanguages((ls) => (ls.includes(l) ? ls.filter((x) => x !== l) : [...ls, l]));

  const confirmSend = () => {
    send({
      scenario,
      severity,
      headline: copy.headline,
      body: copy.body,
      target: {
        scope: district ? "district" : "state",
        district,
        area: area.trim(),
        population: reach,
      },
      languages,
      incidentCode: incident?.code ?? null,
      incidentTitle: incident?.title ?? null,
      authority: FLASH_AUTHORITY,
      operator: FLASH_OPERATOR,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + expiryHours * 3600_000).toISOString(),
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="flash-composer-title"
      className="fixed inset-0 z-[150] flex items-start justify-center overflow-y-auto bg-[rgba(8,18,32,.66)] p-3 backdrop-blur-[3px] sm:items-center"
    >
      <div className="w-full max-w-[720px] overflow-hidden rounded-[8px] border border-[var(--border-strong)] bg-white shadow-[var(--shadow-pop)]">
        {/* Head */}
        <div className="flex items-start gap-3 border-b-[3px] border-[var(--crimson)] bg-[var(--navy-800)] px-4 py-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[var(--crimson-300)]" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="eyebrow text-[var(--crimson-300)]">
              Mass Warning · Authorised Operators Only
            </p>
            <h2 id="flash-composer-title" className="mt-1 text-[18px] font-bold text-white">
              ResQNet Flash Alert
            </h2>
          </div>
          <span className="shrink-0 rounded-[3px] bg-white/15 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white">
            Simulation
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded p-1 text-white/80 hover:bg-white/15 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        {stage === "compose" ? (
          <div className="max-h-[70vh] overflow-y-auto thin-scroll">
            {/* The AI's recommendation, if there was one */}
            {recommendation && (
              <div className="flex gap-2.5 border-b border-[var(--hairline)] bg-[var(--info-bg)] px-4 py-2.5">
                <Bot className="mt-0.5 size-4 shrink-0 text-[var(--navy-600)]" aria-hidden />
                <div className="min-w-0">
                  <p className="eyebrow text-[var(--navy-700)]">
                    AI Recommendation · {Math.round(recommendation.confidence * 100)}% confidence
                  </p>
                  <p className="mt-1 text-[12px] leading-snug text-[var(--foreground)]">
                    {recommendation.rationale}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-[var(--navy-700)]">
                    The model cannot issue a warning. You are the issuing authority.
                  </p>
                </div>
              </div>
            )}

            {/* Incident */}
            <Row label="Incident">
              {incident ? (
                <span className="flex flex-wrap items-baseline gap-2">
                  <span className="mono text-[12px] font-semibold">{incident.code}</span>
                  <span className="text-[12px] text-[var(--muted)]">{incident.title}</span>
                </span>
              ) : (
                <span className="text-[12px] text-[var(--muted)]">
                  Not raised from an incident — standalone warning
                </span>
              )}
            </Row>

            {/* Scenario */}
            <Row label="Scenario">
              <select
                value={scenario}
                onChange={(e) => {
                  const next = e.target.value as FlashScenario;
                  setScenario(next);
                  setSeverity(FLASH_SCENARIO_META[next].severity);
                }}
                className="h-8 w-full max-w-[280px] rounded-[4px] border border-[var(--border-strong)] bg-white px-2 text-[12px]"
              >
                {(Object.keys(FLASH_SCENARIO_META) as FlashScenario[]).map((s) => (
                  <option key={s} value={s}>
                    {FLASH_SCENARIO_META[s].label}
                  </option>
                ))}
              </select>
            </Row>

            {/* Severity */}
            <Row label="Severity">
              <div className="flex flex-wrap gap-1.5">
                {(["extreme", "serious", "advisory"] as FlashSeverity[]).map((s) => {
                  const m = FLASH_SEVERITY_META[s];
                  const on = severity === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSeverity(s)}
                      aria-pressed={on}
                      className="rounded-[4px] border px-2.5 py-1 text-[11px] font-bold"
                      style={{
                        borderColor: on ? m.color : "var(--border-strong)",
                        background: on ? m.color : "white",
                        color: on ? "#fff" : "var(--muted)",
                      }}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </Row>

            {/* Target */}
            <Row label="Affected area">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={district ?? "__state"}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDistrict(v === "__state" ? null : v);
                    setArea(v === "__state" ? "All districts (state-wide)" : `${v} district`);
                  }}
                  className="h-8 rounded-[4px] border border-[var(--border-strong)] bg-white px-2 text-[12px]"
                >
                  <option value="__state">All districts (state-wide)</option>
                  {GUJARAT_DISTRICTS.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <input
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="Refine the area, e.g. coastal belt and low-lying villages"
                  aria-label="Affected area description"
                  className="h-8 min-w-[220px] flex-1 rounded-[4px] border border-[var(--border-strong)] bg-white px-2 text-[12px]"
                />
              </div>
              {!district && (
                <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--crimson)]">
                  <AlertTriangle className="size-3.5" aria-hidden />
                  State-wide warnings reach every district. Confirm this is intended.
                </p>
              )}
            </Row>

            {/* Reach */}
            <Row label="Target population">
              <span className="flex items-center gap-2">
                <Users className="size-4 text-[var(--navy-600)]" aria-hidden />
                <span className="mono text-[15px] font-bold">{formatReach(reach)}</span>
                <span className="text-[11px] text-[var(--muted)]">
                  people — estimated from district population, not a device register
                </span>
              </span>
            </Row>

            {/* Languages */}
            <Row label="Languages">
              <div className="flex flex-wrap gap-1.5">
                {ALL_LANGS.map((l) => {
                  const on = languages.includes(l);
                  return (
                    <button
                      key={l}
                      type="button"
                      lang={l}
                      onClick={() => toggleLang(l)}
                      aria-pressed={on}
                      className={`flex items-center gap-1.5 rounded-[4px] border px-2.5 py-1 text-[12px] font-semibold ${
                        on
                          ? "border-[var(--navy-600)] bg-[var(--info-bg)] text-[var(--navy-800)]"
                          : "border-[var(--border-strong)] bg-white text-[var(--muted)]"
                      }`}
                    >
                      {on && <Check className="size-3" aria-hidden />}
                      {LANG_LABEL[l]}
                    </button>
                  );
                })}
              </div>
            </Row>

            {/* Message */}
            <Row label="Message">
              <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-2)] p-2.5">
                <p className="text-[13px] font-bold" style={{ color: sevMeta.color }}>
                  {copy.headline.en}
                </p>
                <p className="mt-1 text-[12px] leading-snug text-[var(--foreground)]">
                  {copy.body.en}
                </p>
                <p className="mt-2 text-[10.5px] text-[var(--muted)]">
                  Wording is pre-authored per language and reviewed on the preview
                  step — it is never machine-translated at send time.
                </p>
              </div>
            </Row>

            {/* Authority + expiry */}
            <Row label="Issuing authority">
              <span className="text-[12px] font-semibold">{FLASH_AUTHORITY}</span>
              <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                Approving operator: {FLASH_OPERATOR}
              </p>
            </Row>

            <Row label="Expiry">
              <span className="flex items-center gap-2">
                <Clock3 className="size-4 text-[var(--navy-600)]" aria-hidden />
                <select
                  value={expiryHours}
                  onChange={(e) => setExpiryHours(Number(e.target.value))}
                  className="h-8 rounded-[4px] border border-[var(--border-strong)] bg-white px-2 text-[12px]"
                >
                  {[3, 6, 12, 24].map((h) => (
                    <option key={h} value={h}>
                      {h} hours
                    </option>
                  ))}
                </select>
                <span className="telemetry">
                  {openedAt === null
                    ? "—"
                    : `Until ${new Date(
                        openedAt + expiryHours * 3600_000,
                      ).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`}
                </span>
              </span>
            </Row>
          </div>
        ) : (
          /* ---- Preview ---- */
          <div className="max-h-[70vh] overflow-y-auto thin-scroll px-4 py-3">
            <div className="mb-2 flex items-center gap-2">
              <p className="eyebrow text-[var(--muted)]">
                Exactly what a citizen will see
              </p>
              <div className="ml-auto flex gap-0.5">
                {languages.map((l) => (
                  <button
                    key={l}
                    type="button"
                    lang={l}
                    onClick={() => setPreviewLang(l)}
                    aria-pressed={previewLang === l}
                    className={`rounded-[3px] px-2 py-1 text-[11px] font-bold ${
                      previewLang === l
                        ? "bg-[var(--navy-800)] text-white"
                        : "bg-[var(--surface-2)] text-[var(--muted)]"
                    }`}
                  >
                    {LANG_LABEL[l]}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-[8px] border border-[var(--border-strong)]">
              <div
                className="flex items-center gap-2 px-3 py-2 text-white"
                style={{ background: sevMeta.color }}
              >
                <AlertTriangle className="size-4" aria-hidden />
                <span className="text-[12px] font-extrabold uppercase tracking-wide">
                  Emergency Alert
                </span>
                <span className="ml-auto rounded-[3px] bg-white/25 px-1.5 py-0.5 text-[9px] font-bold uppercase">
                  Simulation
                </span>
              </div>
              <div className="px-3 py-3">
                <p
                  lang={previewLang}
                  className="text-[18px] font-extrabold leading-tight"
                  style={{ color: sevMeta.color }}
                >
                  {copy.headline[previewLang]}
                </p>
                <p lang={previewLang} className="mt-2 text-[13px] leading-relaxed">
                  {copy.body[previewLang]}
                </p>
                <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
                  <MapPin className="size-3.5" aria-hidden /> {area} ·{" "}
                  {formatReach(reach)} people · expires in {expiryHours}h
                </p>
              </div>
            </div>

            <p className="mt-3 rounded-[4px] border border-[var(--border)] bg-[var(--medium-bg)] px-3 py-2 text-[11.5px] leading-relaxed">
              <strong>This will not reach a real phone.</strong> ResQNet&apos;s
              frontend cannot emit a cell broadcast. Sending records the warning
              in Flash Alert History and displays it on the simulated citizen
              handset so the workflow can be demonstrated end to end.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5">
          <button
            type="button"
            onClick={stage === "preview" ? () => setStage("compose") : onClose}
            className="h-9 rounded-[4px] border border-[var(--border-strong)] bg-white px-3 text-[12px] font-bold text-[var(--muted)] hover:bg-[var(--surface-2)]"
          >
            {stage === "preview" ? "BACK" : "CANCEL"}
          </button>

          {stage === "compose" ? (
            <button
              type="button"
              disabled={!valid}
              onClick={() => {
                setPreviewLang(languages[0]);
                setStage("preview");
              }}
              className="ml-auto flex h-9 items-center gap-2 rounded-[4px] border border-[var(--navy-600)] bg-[var(--navy-600)] px-3.5 text-[12px] font-bold text-white disabled:opacity-45"
            >
              <Eye className="size-4" aria-hidden /> PREVIEW ALERT
            </button>
          ) : (
            <button
              type="button"
              onClick={confirmSend}
              className="ml-auto flex h-9 items-center gap-2 rounded-[4px] border border-[var(--crimson-700)] bg-[var(--crimson)] px-3.5 text-[12px] font-bold text-white hover:bg-[var(--crimson-700)]"
            >
              <Send className="size-4" aria-hidden /> SEND FLASH ALERT
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 border-b border-[var(--hairline)] px-4 py-2.5 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-3">
      <span className="eyebrow pt-1 text-[var(--muted)]">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
