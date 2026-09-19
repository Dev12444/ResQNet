/**
 * Command-center actions (FE1): dispatch, escalate, alerts, SITREP, simulator, trust.
 * Reads go through `lib/api.ts` (mock fallback); these writes hit the backend and, in mock
 * mode, resolve without a network call so the demo UI still flows.
 */
import { request, USE_MOCK } from "./api";
import type { IncidentTrust, RecommendationsResponse } from "@/types";

export async function dispatchIncident(incidentId: number, resourceIds: number[], facilityId: number | null) {
  if (USE_MOCK) return null;
  return request(`/api/incidents/${incidentId}/dispatch`, {
    method: "POST",
    body: JSON.stringify({ resource_ids: resourceIds, facility_id: facilityId, approved_by: "dispatcher" }),
  });
}

export async function escalateIncident(incidentId: number, note = "Escalated from the command center") {
  if (USE_MOCK) return null;
  return request(`/api/incidents/${incidentId}`, { method: "PATCH", body: JSON.stringify({ status: "escalated", note }) });
}

export async function acknowledgeAlert(alertId: number) {
  if (USE_MOCK) return null;
  return request(`/api/alerts/${alertId}/ack`, { method: "POST", body: "{}" });
}

export async function generateSitrep(): Promise<string> {
  if (USE_MOCK) return "## Situation Report (demo data)\nConnect the backend (NEXT_PUBLIC_USE_MOCK=false) for a live AI SITREP.";
  const r = await request<{ markdown: string }>("/api/ai/sitrep", { method: "POST", body: "{}" });
  return r.markdown;
}

/** Scenario control. Throws ApiError (e.g. 404/405 while BE1's simulator is not deployed). */
export async function simulator(action: "start" | "stop" | "reset") {
  if (USE_MOCK) return null;
  return request(`/api/simulator/${action}`, { method: "POST", body: "{}" });
}

/** Server-side trust (real conflicts between reports); null in mock mode or on error. */
export async function getTrust(incidentId: number): Promise<IncidentTrust | null> {
  if (USE_MOCK) return null;
  try {
    return await request<IncidentTrust>(`/api/incidents/${incidentId}/trust`);
  } catch {
    return null;
  }
}

export type { RecommendationsResponse };
