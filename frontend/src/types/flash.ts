/**
 * ResQNet Flash Alert — types for the mass emergency-warning workflow.
 *
 * IMPORTANT, and stated in the interface wherever an alert appears:
 * this is a DEMONSTRATION of the workflow. ResQNet's frontend does not and
 * cannot emit an official cell broadcast. A real deployment would hand an
 * approved alert to the Common Alerting Protocol gateway operated by NDMA;
 * here the approved alert is rendered to the operator and to a simulated
 * citizen handset so the chain of authority can be demonstrated end to end.
 */

import type { Lang } from "@/types";

/** Warning severity. Drives the colour and the wording of the handset alert. */
export type FlashSeverity = "extreme" | "serious" | "advisory";

/** Lifecycle of a warning. Nothing is ever sent from DRAFT. */
export type FlashStatus = "draft" | "ready" | "sent" | "expired" | "cancelled";

/** The hazard families a warning can be raised for. */
export type FlashScenario =
  | "cyclone"
  | "flash_flood"
  | "extreme_rain"
  | "major_fire"
  | "chemical_leak"
  | "earthquake"
  | "dam_river"
  | "building_collapse"
  | "industrial_accident"
  | "evacuation"
  | "p1_life_threat";

/** Where the warning is aimed. State-wide is deliberately harder to select. */
export interface FlashTarget {
  /** `district` names one district; `state` covers all of Gujarat. */
  scope: "district" | "state";
  /** District name when scope is `district`; empty for state-wide. */
  district: string | null;
  /** Free-text refinement, e.g. "Coastal belt and low-lying areas". */
  area: string;
  /** Estimated people reached. A demo estimate, labelled as one on screen. */
  population: number;
}

/** The message body, held per language rather than machine-translated. */
export type FlashMessage = Record<Lang, string>;

export interface FlashAlert {
  id: string;
  scenario: FlashScenario;
  severity: FlashSeverity;
  headline: FlashMessage;
  body: FlashMessage;
  target: FlashTarget;
  /** Languages the operator approved for broadcast. */
  languages: Lang[];
  /** The incident this warning was raised from, if any. */
  incidentCode: string | null;
  incidentTitle: string | null;
  /** Who issued it. Never a model — always a named authority. */
  authority: string;
  /** Operator who approved the send. Null until approved. */
  operator: string | null;
  status: FlashStatus;
  /** ISO timestamps. */
  createdAt: string;
  sentAt: string | null;
  expiresAt: string;
  /**
   * True for every alert this build can produce. Kept explicit rather than
   * implied so the flag has to be carried into any future real integration.
   */
  simulated: true;
}

/** What the AI may produce. It is a recommendation and nothing more. */
export interface FlashRecommendation {
  scenario: FlashScenario;
  severity: FlashSeverity;
  target: FlashTarget;
  headline: FlashMessage;
  body: FlashMessage;
  /** Why the model thinks a warning is warranted. Shown to the operator. */
  rationale: string;
  /** Model confidence 0..1 — confidence, never authority. */
  confidence: number;
}
