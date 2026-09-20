"use client";

/**
 * `/field` — responder view. Mobile first, big targets, glanceable.
 *
 * Owner: FE2.
 *
 * Two things this screen is careful about:
 *   - It separates what was REPORTED from what the unit has VERIFIED on
 *     scene, and names who last changed the picture.
 *   - It never dresses up AI output as fact. Suggested actions are labelled
 *     advisory, the ETA is labelled a straight-line estimate (there is no
 *     routing engine behind it), and no road closure, hospital capacity or
 *     hazard is presented as confirmed unless a person confirmed it.
 */

import { useCallback, useMemo, useState } from "react";
import type {
  Assignment,
  AssignmentStatus,
  QuickAction,
  SituationUpdate,
  VerifiedSeverity,
} from "@/types";
import {
  ASSIGNMENT_FLOW,
  QUICK_ACTIONS,
  SEVERITY_COLOR,
  haversineKm,
} from "@/lib/constants";
import {
  getAssignments,
  getIncident,
  getIncidentTrust,
  submitSituationUpdate,
  updateAssignmentStatus,
} from "@/lib/api";
import { MOCK_VERIFIED_SEVERITY } from "@/lib/mock";
import { pageStrings } from "@/lib/pageStrings";
import { labels } from "@/lib/i18n";
import { useLang } from "@/components/layout/LangProvider";
import { useEnvelope } from "@/components/layout/useEnvelope";
import {
  Badge,
  DataRow,
  EmptyState,
  ErrorState,
  LoadingState,
  Panel,
  PartialDataNote,
  UnavailableState,
  readableOn,
} from "@/components/layout/primitives";
import { DataModeBadge } from "@/components/layout/ConnectionBar";
import {
  ConfidenceMeter,
  ConflictPanel,
  HazardList,
  PriorityBadge,
  SourceEvidence,
  TypeBadge,
  VerificationBadge,
} from "@/components/layout/trust";
import { SituationUpdateForm } from "./SituationUpdateForm";

export default function FieldPage() {
  const { lang } = useLang();
  const t = pageStrings(lang).field;
  const enums = labels(lang);
  const [unitId, setUnitId] = useState<number | null>(null);
  const [showUpdate, setShowUpdate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState<AssignmentStatus | null>(null);
  const [sentUpdates, setSentUpdates] = useState<SituationUpdate[]>([]);
  const [sentSignals, setSentSignals] = useState<QuickAction[]>([]);

  /**
   * How often the responder's phone re-asks the control room what it is meant
   * to be doing. Five seconds: a dispatch change the responder does not see is
   * the whole failure this screen exists to prevent, and the payload is a
   * handful of rows.
   */
  const POLL_MS = 5000;

  // All assignments, so the unit picker can list units that actually have work.
  const all = useEnvelope(useCallback(() => getAssignments({ active: true }), []), [], {
    pollMs: POLL_MS,
  });

  const assignment = useMemo<Assignment | null>(() => {
    if (!all.data) return null;
    if (unitId === null) return all.data[0] ?? null;
    return all.data.find((a) => a.resource_id === unitId) ?? null;
  }, [all.data, unitId]);

  const incidentId = assignment?.incident_id ?? null;
  const incident = useEnvelope(
    useCallback(
      () =>
        incidentId === null
          ? Promise.resolve({
              data: null,
              mode: "simulated" as const,
              fetched_at: new Date().toISOString(),
              error: null,
            })
          : getIncident(incidentId),
      [incidentId],
    ),
    [incidentId],
    // The incident itself is re-read on the same cadence: severity and status
    // can be revised by the control room while a unit is on the way.
    { pollMs: incidentId === null ? undefined : POLL_MS },
  );
  const trust = useEnvelope(
    useCallback(
      () =>
        incidentId === null
          ? Promise.resolve({
              data: null,
              mode: "simulated" as const,
              fetched_at: new Date().toISOString(),
              error: null,
            })
          : getIncidentTrust(incidentId),
      [incidentId],
    ),
    [incidentId],
  );

  if (all.loading) return <LoadingState label={t.loading} />;

  /**
   * "No assignment" and "could not ask" are the same empty list and must never
   * read the same way. Telling a responder they have nothing to do, when in
   * fact the control room could not be reached, is the most damaging thing
   * this screen could get wrong — so an unreachable server says so, and says
   * to use the radio.
   */
  if (all.mode === "unavailable") {
    return (
      <div className="mx-auto w-full max-w-xl px-3 py-4">
        <ErrorState
          title={t.loadErrorTitle}
          detail={
            all.error ?? t.unreachableDetail
          }
          onRetry={all.reload}
        />
        <p className="mt-2 border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted)]">
          {t.doNotStandDown}{" "}
          <strong className="font-semibold text-[var(--fg)]">112</strong>.
        </p>
      </div>
    );
  }

  if (!all.data || all.data.length === 0) {
    return (
      <div className="mx-auto w-full max-w-xl px-3 py-4">
        <EmptyState
          title={t.noAssignmentTitle}
          hint={t.noAssignmentHint}
        />
      </div>
    );
  }

  const status = localStatus ?? assignment?.status ?? "assigned";
  const inc = incident.data;

  /**
   * Demo-only field verification.
   *
   * These fixtures exist so the walkthrough can show a responder correcting an
   * AI severity. On a live incident they were a lie with operational weight:
   * "field-verified SEV 4" told a responder that somebody had already been to
   * the scene and confirmed it, when nobody had. It is now shown only for data
   * that is itself demo data — never over a record that came from the API.
   */
  const verified: VerifiedSeverity | null =
    inc && incident.mode === "simulated" && Object.hasOwn(MOCK_VERIFIED_SEVERITY, inc.id)
      ? MOCK_VERIFIED_SEVERITY[inc.id]
      : null;
  // A field update sent in this session supersedes anything loaded from the API.
  const ownCorrection = sentUpdates.findLast((u) => u.severity !== null)?.severity ?? null;
  const fieldSeverity = ownCorrection ?? verified?.field_verified ?? null;
  const lastSource = ownCorrection !== null ? "responder" : (verified?.last_source ?? "ai");

  const distanceKm =
    assignment && inc
      ? haversineKm(assignment.resource.lat, assignment.resource.lng, inc.lat, inc.lng)
      : null;

  async function advance(next: AssignmentStatus) {
    if (!assignment) return;
    setBusy(true);
    setActionError(null);
    try {
      const updated = await updateAssignmentStatus(assignment.id, next);
      setLocalStatus(updated.status);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t.statusError);
    } finally {
      setBusy(false);
    }
  }

  const nextStatus = ASSIGNMENT_FLOW[ASSIGNMENT_FLOW.indexOf(status) + 1] ?? null;
  const actionLabel: Record<AssignmentStatus, string> = t.action;

  return (
    <div className="mx-auto w-full max-w-xl px-3 py-4">
      {/* Unit picker — a real responder app would know the unit; this is the demo stand-in. */}
      <label className="mb-3 block">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          {t.yourUnit}
        </span>
        <select
          value={assignment?.resource_id ?? ""}
          onChange={(e) => {
            setUnitId(Number(e.target.value));
            setLocalStatus(null);
            setSentSignals([]);
            setSentUpdates([]);
          }}
          className="mono mt-1 min-h-12 w-full border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-base"
        >
          {all.data.map((a) => (
            <option key={a.id} value={a.resource_id}>
              {a.resource.callsign} — {enums.resourceKind[a.resource.kind]}
            </option>
          ))}
        </select>
      </label>

      {incident.loading && <LoadingState label={t.loadingIncident} />}

      {incident.error && !inc && (
        <ErrorState
          title={t.incidentErrorTitle}
          detail={incident.error}
          onRetry={incident.reload}
        />
      )}

      {inc && assignment && (
        <div className="space-y-4">
          {(incident.mode !== "live" || all.mode !== "live") && (
            <div className="flex items-center gap-2">
              <DataModeBadge mode={incident.mode} note={incident.error} />
              {incident.error && (
                <span className="text-xs text-[var(--muted)]">{incident.error}</span>
              )}
            </div>
          )}

          {/* Headline: what and how urgent. */}
          <header className="border-l-8 bg-[var(--surface)] p-3" style={{ borderColor: SEVERITY_COLOR[fieldSeverity ?? inc.severity] }}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="mono text-sm font-bold">{inc.code}</span>
              <TypeBadge type={inc.type} />
              <PriorityBadge priority={inc.priority} />
              {/* Verification is derived from the reports. When the report
                  endpoint did not answer there are no reports to derive it
                  from, and "unverified" would be our guess presented as the
                  control room's finding. */}
              {trust.data && trust.mode !== "unavailable" && (
                <VerificationBadge status={trust.data.verification} />
              )}
            </div>
            <h1 className="cmd mt-2 text-[20px] leading-tight">{inc.title}</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">{inc.address}</p>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="mono">
                {distanceKm !== null ? `${distanceKm.toFixed(1)} km` : "—"}
              </span>
              <span className="mono">ETA {assignment.eta_min} min</span>
              <span className="text-xs text-[var(--muted)]">
                straight-line estimate — not a routed ETA
              </span>
            </div>

            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${inc.lat},${inc.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex min-h-11 items-center border border-[var(--info)] px-3 text-sm font-semibold"
              style={{ color: "var(--info)" }}
            >
              {t.navigate}
            </a>
          </header>

          {/* Severity: reported vs verified, and who last said so. */}
          <Panel title={t.severity}>
            <div className="grid grid-cols-2 divide-x divide-[var(--border)]">
              <div className="px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{t.reported}</p>
                <p
                  className="mt-1 inline-block px-2 py-0.5 text-sm font-bold"
                  style={{
                    background: SEVERITY_COLOR[verified?.reported ?? inc.severity],
                    color: readableOn(SEVERITY_COLOR[verified?.reported ?? inc.severity]),
                  }}
                >
                  SEV {verified?.reported ?? inc.severity} ·{" "}
                  {enums.severity[verified?.reported ?? inc.severity]}
                </p>
              </div>
              <div className="px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                  {t.fieldVerified}
                </p>
                {fieldSeverity !== null ? (
                  <p
                    className="mt-1 inline-block px-2 py-0.5 text-sm font-bold"
                    style={{
                      background: SEVERITY_COLOR[fieldSeverity],
                      color: readableOn(SEVERITY_COLOR[fieldSeverity]),
                    }}
                  >
                    SEV {fieldSeverity} · {enums.severity[fieldSeverity]}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-[var(--muted)]">{pageStrings(lang).misc.notVerifiedOnScene}</p>
                )}
              </div>
            </div>
            <p className="border-t border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted)]">
              Latest change by:{" "}
              <strong className="font-semibold uppercase">{lastSource}</strong>
            </p>
          </Panel>

          {/* Operational picture. */}
          <Panel title={t.situation}>
            <dl className="px-3 py-2">
              <DataRow label={t.summary}>{inc.ai_summary}</DataRow>
              <DataRow label={t.peopleAffected} mono>
                {inc.people_affected_est ?? t.notEstimated}
              </DataRow>
              <DataRow label={t.hazards}>
                <HazardList hazards={inc.hazards} />
              </DataRow>
              <DataRow label={t.aiConfidence}>
                <ConfidenceMeter confidence={inc.confidence} compact />
              </DataRow>
            </dl>
            <p className="border-t border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)]">
              {t.hazardsCaveat}
            </p>
          </Panel>

          {trust.mode === "unavailable" ? (
            <Panel title={t.evidence}>
              <div className="px-3 py-2">
                <UnavailableState
                  what={pageStrings(lang).primitives.what.incidentReports}
                  note={trust.error}
                  onRetry={trust.reload}
                />
              </div>
            </Panel>
          ) : (
            trust.data && (
            <Panel title={t.evidence}>
              <div className="space-y-2 px-3 py-2">
                <SourceEvidence sources={trust.data.sources} />
                {trust.data.sensor_corroboration && (
                  <p className="mono text-xs text-[var(--muted)]">
                    Sensor {trust.data.sensor_corroboration.sensor_id}:{" "}
                    {trust.data.sensor_corroboration.detail}
                  </p>
                )}
              </div>
              {trust.data.conflicts.length > 0 && (
                <div className="px-3 pb-3">
                  <ConflictPanel conflicts={trust.data.conflicts} />
                </div>
              )}
            </Panel>
            )
          )}

          <Panel title={t.suggestedActions} subtitle={t.suggestedActionsNote}>
            <ul className="divide-y divide-[var(--border)]">
              {inc.ai_actions.map((action) => (
                <li key={action} className="px-3 py-2 text-sm">
                  {action}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title={t.assignedUnits}>
            <ul className="divide-y divide-[var(--border)]">
              {(inc.assignments ?? []).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="mono text-sm font-semibold">{a.resource.callsign}</span>
                  <span className="text-xs text-[var(--muted)]">
                    {enums.resourceKind[a.resource.kind]}
                  </span>
                  <Badge
                    label={enums.assignmentStatus[a.status]}
                    color="var(--info)"
                    variant="tint"
                  />
                </li>
              ))}
              {(inc.assignments ?? []).length === 0 && (
                <li className="px-3 py-2 text-sm text-[var(--muted)]">
                  {t.noOtherUnits}
                </li>
              )}
            </ul>
          </Panel>

          {/* Lifecycle. One big button for the next step. */}
          <section className="border-2 border-[var(--border-strong)] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {t.currentStatus}
            </p>
            <p className="mt-1 text-lg font-bold">{enums.assignmentStatus[status]}</p>

            <ol className="mt-2 flex gap-1">
              {ASSIGNMENT_FLOW.map((s) => {
                const reached = ASSIGNMENT_FLOW.indexOf(s) <= ASSIGNMENT_FLOW.indexOf(status);
                return (
                  <li
                    key={s}
                    className="h-1.5 flex-1"
                    style={{ background: reached ? "var(--ok)" : "var(--border)" }}
                    aria-hidden
                  />
                );
              })}
            </ol>

            {actionError && (
              <p
                role="alert"
                className="mt-2 border-l-4 px-2 py-1.5 text-sm"
                style={{ borderColor: "var(--critical)", background: "var(--critical-bg)" }}
              >
                {actionError}
              </p>
            )}

            {nextStatus ? (
              <button
                type="button"
                onClick={() => void advance(nextStatus)}
                disabled={busy}
                className="mt-3 min-h-16 w-full border-2 border-[var(--foreground)] bg-[var(--foreground)] text-xl font-bold uppercase tracking-wide text-[var(--surface)] disabled:opacity-70"
              >
                {busy ? t.sending : actionLabel[nextStatus]}
              </button>
            ) : (
              <p
                className="mt-3 border-l-4 px-3 py-2 text-sm font-semibold"
                style={{ borderColor: "var(--ok)", background: "var(--ok-bg)" }}
              >
                {t.assignmentComplete}
              </p>
            )}

            <button
              type="button"
              onClick={() => setShowUpdate((s) => !s)}
              aria-expanded={showUpdate}
              className="mt-2 min-h-14 w-full border-2 border-[var(--border-strong)] font-bold uppercase tracking-wide"
            >
              {t.updateSituation}
            </button>
          </section>

          {showUpdate && (
            <SituationUpdateForm
              incident={inc}
              assignment={assignment}
              submitting={busy}
              error={actionError}
              onCancel={() => setShowUpdate(false)}
              onSubmit={async (update) => {
                setBusy(true);
                setActionError(null);
                try {
                  await submitSituationUpdate(update);
                  setSentUpdates((prev) => [...prev, update]);
                  setShowUpdate(false);
                } catch (err) {
                  setActionError(
                    err instanceof Error ? err.message : t.sendError,
                  );
                } finally {
                  setBusy(false);
                }
              }}
            />
          )}

          {/* One-tap signals for hands-busy moments. */}
          <Panel title={t.quickActions} subtitle={t.quickActionsNote}>
            <div className="grid grid-cols-2 gap-px bg-[var(--border)]">
              {QUICK_ACTIONS.map((action) => {
                const sent = sentSignals.includes(action.id);
                const tone =
                  action.tone === "danger"
                    ? "var(--critical)"
                    : action.tone === "warn"
                      ? "var(--high)"
                      : "var(--ok)";
                return (
                  <button
                    key={action.id}
                    type="button"
                    disabled={busy || sent}
                    onClick={async () => {
                      setBusy(true);
                      setActionError(null);
                      try {
                        await submitSituationUpdate({
                          incident_id: inc.id,
                          assignment_id: assignment.id,
                          severity: null,
                          people_affected: null,
                          hazards: [],
                          lat: null,
                          lng: null,
                          road_access: action.id === "road_blocked" ? "blocked" : "unknown",
                          notes: action.label,
                          additional_resources: [],
                          resolved: false,
                          reported_at: new Date().toISOString(),
                        });
                        setSentSignals((prev) => [...prev, action.id]);
                      } catch (err) {
                        setActionError(
                          err instanceof Error ? err.message : t.signalError,
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="min-h-14 bg-[var(--surface)] px-2 text-sm font-semibold disabled:opacity-60"
                    style={{ color: sent ? "var(--muted)" : tone }}
                  >
                    {sent ? `${action.label} ✓` : action.label}
                  </button>
                );
              })}
            </div>
          </Panel>

          {sentUpdates.length > 0 && (
            <PartialDataNote
              what={t.updatesSent(sentUpdates.length)}
            />
          )}
        </div>
      )}
    </div>
  );
}
