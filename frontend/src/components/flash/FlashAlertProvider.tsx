"use client";

/**
 * Flash Alert state, held at the shell so a warning can reach a citizen on any
 * page.
 *
 * The one rule this file enforces: **only an operator action reaches `send`.**
 * The AI produces a `FlashRecommendation` (see `lib/flash.ts`) and nothing
 * else; there is no path from a recommendation to a send that does not pass
 * through `send()`, and `send()` is only ever called from the composer's
 * confirm button. Nothing here polls, schedules or auto-approves.
 *
 * Every alert this build produces carries `simulated: true` and is rendered
 * with a SIMULATION banner. ResQNet's frontend cannot emit a cell broadcast;
 * a real deployment would hand the approved alert to NDMA's CAP gateway.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Lang } from "@/types";
import type { FlashAlert, FlashRecommendation } from "@/types/flash";
import { estimateReach, renderCopy } from "@/lib/flash";
import { publishIncoming } from "@/lib/liveAlerts";
import { FlashAlertScreen } from "./FlashAlertScreen";

const OPERATOR = "D. Mehta · State Control Room";
const AUTHORITY = "State Disaster Management Authority";

interface FlashContextValue {
  /** The warning currently on the simulated citizen handset, if any. */
  active: FlashAlert | null;
  /** Everything raised this session, newest first. */
  history: FlashAlert[];
  /** Issue an approved warning. Operator-only — see the note above. */
  send: (draft: Omit<FlashAlert, "id" | "status" | "sentAt" | "simulated">) => void;
  /** Build a draft from an AI recommendation. Does not send. */
  draftFrom: (rec: FlashRecommendation, incident?: { code: string; title: string }) => FlashAlert;
  /** Dismiss the handset takeover without changing the alert's status. */
  dismiss: () => void;
  /** Withdraw a warning that has already gone out. */
  cancel: (id: string) => void;
  /** Re-open a past warning on the simulated handset. */
  replay: (id: string) => void;
  /** Raise the pre-built Kutch cyclone warning, for the demo. */
  simulate: () => void;
}

const FlashContext = createContext<FlashContextValue | null>(null);

export function useFlashAlert(): FlashContextValue {
  const ctx = useContext(FlashContext);
  if (!ctx) throw new Error("useFlashAlert must be used inside FlashAlertProvider");
  return ctx;
}

/** Hours from now, as an ISO string. */
function inHours(h: number): string {
  return new Date(Date.now() + h * 3600_000).toISOString();
}

export function FlashAlertProvider({
  lang,
  children,
}: {
  lang: Lang;
  children: React.ReactNode;
}) {
  const [active, setActive] = useState<FlashAlert | null>(null);
  const [history, setHistory] = useState<FlashAlert[]>([]);

  const draftFrom = useCallback(
    (rec: FlashRecommendation, incident?: { code: string; title: string }): FlashAlert => ({
      id: `FA-${Date.now().toString(36).toUpperCase()}`,
      scenario: rec.scenario,
      severity: rec.severity,
      headline: rec.headline,
      body: rec.body,
      target: rec.target,
      languages: ["en", "gu", "hi"],
      incidentCode: incident?.code ?? null,
      incidentTitle: incident?.title ?? null,
      authority: AUTHORITY,
      operator: null,
      status: "draft",
      createdAt: new Date().toISOString(),
      sentAt: null,
      expiresAt: inHours(6),
      simulated: true,
    }),
    [],
  );

  const send = useCallback(
    (draft: Omit<FlashAlert, "id" | "status" | "sentAt" | "simulated">) => {
      const alert: FlashAlert = {
        ...draft,
        id: `FA-${Date.now().toString(36).toUpperCase()}`,
        status: "sent",
        sentAt: new Date().toISOString(),
        simulated: true,
      };
      setHistory((h) => [alert, ...h]);
      setActive(alert);
      // The handset takeover shows the warning to the operator who approved
      // it. This puts the same warning on the Alert Flash banner, so it is
      // still there on every route after the takeover is dismissed — the
      // citizen-facing half of "a warning was issued".
      if (alert.severity !== "advisory") {
        publishIncoming({
          id: alert.id,
          at: alert.sentAt ?? new Date().toISOString(),
          kind: "official",
          severity: alert.severity === "extreme" ? "critical" : "high",
          headline: alert.headline.en,
          detail: alert.body.en,
          district: alert.target.district,
          source: `${alert.authority} (simulated)`,
          href: "/dashboard",
        });
      }
    },
    [],
  );

  const dismiss = useCallback(() => setActive(null), []);

  const cancel = useCallback((id: string) => {
    setHistory((h) =>
      h.map((a) => (a.id === id ? { ...a, status: "cancelled" as const } : a)),
    );
    setActive((a) => (a && a.id === id ? null : a));
  }, []);

  const replay = useCallback((id: string) => {
    setHistory((h) => {
      const found = h.find((a) => a.id === id);
      if (found) setActive(found);
      return h;
    });
  }, []);

  /** The demo warning: cyclone, Kutch coastal belt. */
  const simulate = useCallback(() => {
    const area = "Kutch Coastal Region";
    const { headline, body } = renderCopy("cyclone", area);
    send({
      scenario: "cyclone",
      severity: "extreme",
      headline,
      body,
      target: {
        scope: "district",
        district: "Kutch",
        area,
        population: estimateReach("Kutch"),
      },
      languages: ["en", "gu", "hi"],
      incidentCode: "INC-GJ-0918-014",
      incidentTitle: "Cyclone landfall expected — Jakhau Coast",
      authority: AUTHORITY,
      operator: OPERATOR,
      createdAt: new Date().toISOString(),
      expiresAt: inHours(6),
    });
  }, [send]);

  /** Escape closes the handset takeover, as any full-screen layer should. */
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active]);

  const value = useMemo(
    () => ({ active, history, send, draftFrom, dismiss, cancel, replay, simulate }),
    [active, history, send, draftFrom, dismiss, cancel, replay, simulate],
  );

  return (
    <FlashContext.Provider value={value}>
      {children}
      {active && (
        <FlashAlertScreen alert={active} lang={lang} onDismiss={dismiss} />
      )}
    </FlashContext.Provider>
  );
}

export { OPERATOR as FLASH_OPERATOR, AUTHORITY as FLASH_AUTHORITY };
