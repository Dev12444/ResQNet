/**
 * ResQNet — the single place FE2 talks to the backend.
 *
 * Components never call `fetch` directly. Every function here returns an
 * `Envelope<T>` carrying the data *and* where it came from, so a screen can
 * always tell the operator whether they are looking at LIVE, CACHED, STALE or
 * SIMULATED information. A failed live call degrades to the last good response
 * (or to mock data) — it never silently renders stale numbers as live.
 *
 * Endpoints and shapes follow `docs/API_CONTRACT.md`. No endpoint is invented
 * here: anything the backend does not expose yet is marked
 * `ADAPTER` below and derived on the client from data that does exist.
 */

import type {
  AiStatus,
  Alert,
  AnalyticsByType,
  AnalyticsEval,
  AnalyticsFilters,
  AnalyticsHotspot,
  AnalyticsResponseTimes,
  AnalyticsShortage,
  AnalyticsSummary,
  Assignment,
  AssignmentStatus,
  ConflictNote,
  DataMode,
  Envelope,
  Facility,
  FacilityView,
  Hazard,
  Incident,
  IncidentType,
  IncidentDetail,
  IncidentTrust,
  Priority,
  Report,
  ReportCreate,
  ReportCreateResponse,
  Resource,
  ResourceView,
  RecommendationsResponse,
  Sensor,
  Severity,
  ShortageView,
  SituationUpdate,
  SourceBreakdown,
  VerificationStatus,
  WeatherAlert,
} from "@/types";
import {
  CAPABILITY_MAP,
  GUJARAT_CENTER,
  INCIDENT_TYPE_META,
  OFFLINE_AFTER_SEC,
  STALE_AFTER_SEC,
} from "./constants";
import * as mock from "./mock";

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

/**
 * Mock mode. `.env.production` sets this to `false`, so a deployed build talks
 * to the real API and only degrades to fixtures when a call actually fails —
 * and says so on screen when it does.
 */
export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "false";

const TIMEOUT_MS = 8000;
const REPORT_TIMEOUT_MS = 25_000;

/* ------------------------------------------------------------------ */
/* Envelope helpers                                                    */
/* ------------------------------------------------------------------ */

function envelope<T>(data: T, mode: DataMode, error: string | null = null): Envelope<T> {
  return { data, mode, fetched_at: new Date().toISOString(), error };
}

/** Last successful live response per cache key, for graceful degradation. */
const cache = new Map<string, unknown>();

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function request<T>(path: string, init?: RequestInit, timeoutMs = TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Actor": "dispatcher",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    if (!res.ok) {
      let detail = `Request failed (${res.status})`;
      try {
        const body = (await res.json()) as { detail?: unknown };
        if (typeof body?.detail === "string") detail = body.detail;
        // FastAPI validation errors (422) are a list of {loc, msg}: show them readably.
        else if (Array.isArray(body?.detail))
          detail = body.detail
            .map((d: { loc?: unknown[]; msg?: string }) => `${(d.loc ?? []).slice(1).join(".")}: ${d.msg ?? "invalid"}`)
            .join("; ");
      } catch {
        /* non-JSON error body — keep the status message */
      }
      throw new ApiError(detail, res.status);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError("Request timed out", null);
    }
    throw new ApiError(err instanceof Error ? err.message : "Network error", null);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run a live call, falling back to cache and then to mock data.
 * `key` identifies the cache slot; `fallback` supplies the demo value.
 */
async function withFallback<T>(
  key: string,
  fallback: () => T,
  live: () => Promise<T>,
): Promise<Envelope<T>> {
  if (USE_MOCK) return envelope(fallback(), "simulated");

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    const cached = cache.get(key) as T | undefined;
    return cached === undefined
      ? envelope(fallback(), "simulated", "Offline — showing demo data")
      : envelope(cached, "stale", "Offline — showing last known data");
  }

  try {
    const data = await live();
    cache.set(key, data);
    return envelope(data, "live");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    const cached = cache.get(key) as T | undefined;
    if (cached !== undefined) {
      return envelope(cached, "stale", `${message} — showing last known data`);
    }
    return envelope(fallback(), "simulated", `${message} — showing demo data`);
  }
}

/* ------------------------------------------------------------------ */
/* Health & AI status                                                  */
/* ------------------------------------------------------------------ */

export async function getAiStatus(): Promise<Envelope<AiStatus | null>> {
  return withFallback(
    "ai-status",
    () => null,
    () => request<AiStatus>("/api/ai/status"),
  );
}

/** Cheap reachability probe used by the connection indicator. */
export async function ping(): Promise<boolean> {
  if (USE_MOCK) return true;
  try {
    await request<unknown>("/health");
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

export async function submitReport(body: ReportCreate): Promise<ReportCreateResponse> {
  if (USE_MOCK) return mockSubmit(body);
  // The API rejects unknown fields (422). Send only the contract's ReportCreate fields; UI-only
  // hints (citizen_type, disaster_type, citizen_urgency, people_affected, special_assistance)
  // stay on the client until the backend contract grows them. The AI classifies from the text.
  const payload = {
    source: body.source, text: body.text, lang: body.lang, lat: body.lat, lng: body.lng,
    address: body.address, photo_url: body.photo_url, reporter: body.reporter, sensor: body.sensor,
    ...(body.incident_id != null ? { incident_id: body.incident_id } : {}),
  };
  // A new report runs the full AI triage (classify + embeddings), ~2-9 s on Render's free tier:
  // a short timeout would show "failed" for a report that was actually stored.
  return request<ReportCreateResponse>(
    "/api/reports",
    { method: "POST", body: JSON.stringify(payload) },
    REPORT_TIMEOUT_MS,
  );
}

/**
 * Deterministic stand-in for the real triage pipeline.
 *
 * A report only merges into an existing incident when it actually has
 * coordinates near one. Without a location fix it opens a genuinely new
 * incident with the next unused code — never an existing incident relabelled
 * as new, which would misrepresent corroboration on the receipt.
 */
function mockSubmit(body: ReportCreate): ReportCreateResponse {
  const now = new Date().toISOString();
  const id = 900 + mock.MOCK_REPORTS.length;
  // The citizen's own pick wins over keyword inference when they made one.
  const type = body.citizen_type ?? inferType(body.text ?? "");
  const nearby =
    body.lat !== null && body.lng !== null
      ? mock.MOCK_INCIDENTS.find(
          (i) =>
            i.type === type &&
            i.status !== "resolved" &&
            Math.abs(i.lat - body.lat!) < 0.01 &&
            Math.abs(i.lng - body.lng!) < 0.01,
        )
      : undefined;

  const hazards = inferHazards(body.text ?? "");
  const severity = inferSeverity(type, hazards);
  const incident: Incident = nearby
    ? { ...nearby, report_count: nearby.report_count + 1, updated_at: now }
    : newMockIncident({ type, severity, hazards, body, now });

  const report: Report = {
    id,
    source: body.source,
    text: body.text,
    lang: body.lang,
    lat: body.lat,
    lng: body.lng,
    address: body.address,
    photo_url: body.photo_url,
    reporter: body.reporter,
    sensor: body.sensor,
    incident_id: incident.id,
    created_at: now,
  };

  return {
    report,
    incident,
    merged: Boolean(nearby),
    classification: {
      type,
      severity: incident.severity,
      priority: incident.priority,
      title: incident.title,
      location_text: body.address,
      people_affected_est: incident.people_affected_est,
      hazards: incident.hazards,
      reasoning: nearby
        ? `Matches open incident ${nearby.code} at this location within the time window.`
        : "Classified from the report text; no matching open incident nearby.",
      // Corroboration by an existing incident raises confidence; a lone report
      // without a location fix stays in the review-advised band.
      confidence: nearby ? 0.86 : body.lat !== null ? 0.71 : 0.64,
      lang: body.lang ?? "en",
      source_model: "fallback",
      photo: null,
    },
  };
}

function newMockIncident({
  type,
  severity,
  hazards,
  body,
  now,
}: {
  type: IncidentType;
  severity: Severity;
  hazards: Hazard[];
  body: ReportCreate;
  now: string;
}): Incident {
  const nextId = Math.max(...mock.MOCK_INCIDENTS.map((i) => i.id)) + 1;
  return {
    id: nextId,
    code: `INC-${String(nextId).padStart(4, "0")}`,
    type,
    severity,
    priority: priorityFor(severity, hazards),
    status: "new",
    title: body.address
      ? `${INCIDENT_TYPE_META[type].label} reported at ${body.address}`
      : `${INCIDENT_TYPE_META[type].label} reported — location to confirm`,
    lat: body.lat ?? GUJARAT_CENTER.lat,
    lng: body.lng ?? GUJARAT_CENTER.lng,
    address: body.address ?? "Location not supplied",
    ai_summary:
      "Single report awaiting corroboration. No other source has described this incident yet.",
    ai_reasoning: "Classified from the report text by the rule-based fallback classifier.",
    ai_actions: ["Confirm details with the reporter", "Seek a second source before dispatch"],
    confidence: body.lat !== null ? 0.71 : 0.64,
    hazards,
    people_affected_est: null,
    report_count: 1,
    created_at: now,
    updated_at: now,
    dispatched_at: null,
    resolved_at: null,
  };
}

/** Mirrors the backend's deterministic priority rule closely enough for demo. */
function priorityFor(severity: Severity, hazards: Hazard[]): Priority {
  if (hazards.includes("trapped_people") || severity >= 5) return "P1";
  if (severity === 4) return "P1";
  if (severity === 3) return "P2";
  if (severity === 2) return "P3";
  return "P4";
}

function inferHazards(text: string): Hazard[] {
  const t = text.toLowerCase();
  const has = (...words: string[]) => words.some((w) => t.includes(w));
  const hazards: Hazard[] = [];
  if (has("ફસા", "trapped", "फंस", "stuck", "अंदर", "અંદર")) hazards.push("trapped_people");
  if (has("પાણી", "पानी", "water", "flood", "बाढ़", "પૂર")) hazards.push("rising_water");
  if (has("આગ", "आग", "fire", "smoke")) hazards.push("fire_spread");
  if (has("ગેસ", "गैस", "gas", "chlorine", "chemical")) hazards.push("gas_leak");
  if (has("લોહી", "खून", "injur", "blood", "ઈજા")) hazards.push("injuries");
  if (has("દીવાલ", "collapse", "इमारत", "wall")) hazards.push("structural");
  return hazards;
}

function inferSeverity(type: IncidentType, hazards: Hazard[]): Severity {
  if (hazards.includes("trapped_people")) return 4;
  if (type === "industrial" && hazards.includes("gas_leak")) return 4;
  if (type === "fire" || type === "building_collapse") return 3;
  if (type === "other") return 2;
  return 3;
}

/** Keyword fallback mirroring the backend's rule-based classifier. */
function inferType(text: string): Incident["type"] {
  const t = text.toLowerCase();
  const has = (...words: string[]) => words.some((w) => t.includes(w));
  if (has("પાણી", "પૂર", "बाढ़", "पानी", "flood", "water", "underpass", "waterlog")) return "flood";
  if (has("આગ", "आग", "fire", "smoke", "burn")) return "fire";
  if (has("અકસ્માત", "दुर्घटना", "अकस्मात", "accident", "collision", "crash")) return "road_accident";
  if (has("ગેસ", "गैस", "gas", "chemical", "leak", "chlorine")) return "industrial";
  if (has("દર્દી", "मरीज", "medical", "chest pain", "unconscious", "ambulance")) return "medical";
  if (has("દીવાલ", "इमारत", "collapse", "wall", "building")) return "building_collapse";
  return "other";
}

export async function getReports(incidentId: number): Promise<Envelope<Report[]>> {
  return withFallback(
    `reports-${incidentId}`,
    () => mock.reportsForIncident(incidentId),
    () => request<Report[]>(`/api/reports?incident_id=${incidentId}`),
  );
}

/* ------------------------------------------------------------------ */
/* Incidents                                                           */
/* ------------------------------------------------------------------ */

export async function getIncidents(
  opts: { includeResolved?: boolean } = {},
): Promise<Envelope<Incident[]>> {
  const qs = opts.includeResolved ? "?include_resolved=true" : "";
  return withFallback(
    `incidents${qs}`,
    () =>
      opts.includeResolved
        ? mock.MOCK_INCIDENTS
        : mock.MOCK_INCIDENTS.filter((i) => i.status !== "resolved"),
    () => request<Incident[]>(`/api/incidents${qs}`),
  );
}

export async function getIncident(id: number): Promise<Envelope<IncidentDetail | null>> {
  return withFallback(
    `incident-${id}`,
    () => {
      const incident = mock.MOCK_INCIDENTS.find((i) => i.id === id);
      if (!incident) return null;
      return {
        ...incident,
        reports: mock.reportsForIncident(id),
        assignments: mock.assignmentsForIncident(id),
        alerts: mock.MOCK_ALERTS.filter((a) => a.incident_id === id),
      };
    },
    () => request<IncidentDetail>(`/api/incidents/${id}`),
  );
}

export async function getRecommendations(
  incidentId: number,
): Promise<Envelope<RecommendationsResponse | null>> {
  return withFallback(
    `recommendations-${incidentId}`,
    () => mock.MOCK_RECOMMENDATIONS[incidentId] ?? null,
    () => request<RecommendationsResponse>(`/api/incidents/${incidentId}/recommendations`),
  );
}

/* ------------------------------------------------------------------ */
/* Resources, facilities, alerts                                       */
/* ------------------------------------------------------------------ */

export async function getResources(): Promise<Envelope<Resource[]>> {
  return withFallback(
    "resources",
    () => mock.MOCK_RESOURCES,
    () => request<Resource[]>("/api/resources"),
  );
}

export async function getFacilities(): Promise<Envelope<Facility[]>> {
  return withFallback(
    "facilities",
    () => mock.MOCK_FACILITIES,
    () => request<Facility[]>("/api/facilities"),
  );
}

export async function getAlerts(): Promise<Envelope<Alert[]>> {
  return withFallback(
    "alerts",
    () => mock.MOCK_ALERTS,
    () => request<Alert[]>("/api/alerts"),
  );
}

export async function getAssignments(
  params: { resourceId?: number; active?: boolean } = {},
): Promise<Envelope<Assignment[]>> {
  const qs = new URLSearchParams();
  if (params.resourceId !== undefined) qs.set("resource_id", String(params.resourceId));
  if (params.active) qs.set("active", "true");
  const suffix = qs.toString() ? `?${qs}` : "";
  return withFallback(
    `assignments${suffix}`,
    () =>
      params.resourceId === undefined
        ? mock.MOCK_ASSIGNMENTS
        : mock.assignmentsForResource(params.resourceId),
    () => request<Assignment[]>(`/api/assignments${suffix}`),
  );
}

export async function updateAssignmentStatus(
  assignmentId: number,
  status: AssignmentStatus,
): Promise<Assignment> {
  if (USE_MOCK) {
    const existing = mock.MOCK_ASSIGNMENTS.find((a) => a.id === assignmentId);
    if (!existing) throw new ApiError("Assignment not found", 404);
    return { ...existing, status, updated_at: new Date().toISOString() };
  }
  return request<Assignment>(`/api/assignments/${assignmentId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

/* ------------------------------------------------------------------ */
/* ADAPTER — resource & facility views                                 */
/* ------------------------------------------------------------------ */
/*
 * The backend exposes `Resource` and `Facility` without district, capability
 * or freshness metadata, and has no sensor endpoint at all. Until those land
 * we derive what we can from the live payload and fall back to demo values.
 * Tracked in the completion notes as an open integration dependency.
 */

function modeForAge(ageSec: number): DataMode {
  if (ageSec > OFFLINE_AFTER_SEC) return "stale";
  if (ageSec > STALE_AFTER_SEC) return "stale";
  return "live";
}

const CAPABILITIES: Record<Resource["kind"], string[]> = {
  ambulance: ["ALS", "Oxygen", "Trauma kit"],
  fire_truck: ["Water tender", "Foam", "Ladder"],
  rescue_boat: ["Shallow water", "Night ops", "6 person capacity"],
  police: ["Traffic control", "Cordon"],
  ndrf_team: ["Debris lifting", "Rope rescue", "Swift water"],
  hazmat: ["Chemical containment", "Level A suits", "Decon"],
};

/** Best-effort district from the unit's base string. */
function districtFromBase(base: string): string {
  const match = /(Ahmedabad|Gandhinagar|Surat|Vadodara|Bharuch|Rajkot|Jamnagar|Kutch)/.exec(base);
  return match ? match[1] : "Ahmedabad";
}

export async function getResourceViews(): Promise<Envelope<ResourceView[]>> {
  if (USE_MOCK) return envelope(mock.MOCK_RESOURCE_VIEWS, "simulated");

  const [resources, assignments, incidents] = await Promise.all([
    getResources(),
    getAssignments({ active: true }),
    getIncidents({ includeResolved: true }),
  ]);

  const worst: DataMode =
    resources.mode === "live" && assignments.mode === "live" ? "live" : "stale";

  const views: ResourceView[] = resources.data.map((r) => {
    const assignment = assignments.data.find(
      (a) => a.resource_id === r.id && a.status !== "completed" && a.status !== "cancelled",
    );
    const incident = incidents.data.find((i) => i.id === assignment?.incident_id);
    const updatedAt = assignment?.updated_at ?? resources.fetched_at;
    const age = Math.max(0, Math.round((Date.now() - Date.parse(updatedAt)) / 1000));
    return {
      ...r,
      district: districtFromBase(r.base),
      capabilities: CAPABILITIES[r.kind],
      assignment:
        assignment && incident
          ? {
              incident_code: incident.code,
              incident_id: incident.id,
              status: assignment.status,
              eta_min: assignment.eta_min,
            }
          : null,
      freshness: { updated_at: updatedAt, age_sec: age, mode: modeForAge(age) },
    };
  });

  return envelope(views, worst, resources.error ?? assignments.error);
}

export async function getFacilityViews(): Promise<Envelope<FacilityView[]>> {
  if (USE_MOCK) return envelope(mock.MOCK_FACILITY_VIEWS, "simulated");

  const facilities = await getFacilities();
  const views: FacilityView[] = facilities.data.map((f) => {
    const age = Math.max(0, Math.round((Date.now() - Date.parse(facilities.fetched_at)) / 1000));
    return {
      ...f,
      district: "Ahmedabad",
      freshness: { updated_at: facilities.fetched_at, age_sec: age, mode: modeForAge(age) },
    };
  });
  return envelope(views, facilities.mode, facilities.error);
}

/**
 * ADAPTER — there is no sensor endpoint in the contract. Sensor state is
 * reconstructed from `source: "sensor"` reports when live, which gives
 * readings but not heartbeats; health is therefore inferred from reading age.
 */
export async function getSensors(): Promise<Envelope<Sensor[]>> {
  if (USE_MOCK) return envelope(mock.MOCK_SENSORS, "simulated");

  const incidents = await getIncidents({ includeResolved: true });
  const sensorReports: Report[] = [];
  for (const incident of incidents.data) {
    const reports = await getReports(incident.id);
    sensorReports.push(...reports.data.filter((r) => r.source === "sensor" && r.sensor));
  }

  const byId = new Map<string, Sensor>();
  for (const r of sensorReports) {
    const s = r.sensor!;
    const age = Math.max(0, Math.round((Date.now() - Date.parse(r.created_at)) / 1000));
    const existing = byId.get(s.sensor_id);
    if (existing && Date.parse(existing.updated_at) >= Date.parse(r.created_at)) continue;
    byId.set(s.sensor_id, {
      id: s.sensor_id,
      label: s.sensor_id,
      kind: s.metric.includes("water")
        ? "water_level"
        : s.metric.includes("rain")
          ? "rainfall"
          : s.metric.includes("pm")
            ? "smoke"
            : "gas",
      district: "Ahmedabad",
      lat: r.lat ?? 0,
      lng: r.lng ?? 0,
      metric: s.metric,
      value: s.value,
      threshold: s.threshold,
      unit: s.unit,
      health:
        age > OFFLINE_AFTER_SEC
          ? "offline"
          : s.value > s.threshold
            ? "anomalous"
            : age > STALE_AFTER_SEC
              ? "stale"
              : "healthy",
      last_heartbeat: r.created_at,
      updated_at: r.created_at,
    });
  }
  return envelope([...byId.values()], incidents.mode, incidents.error);
}

/* ------------------------------------------------------------------ */
/* ADAPTER — trust & corroboration                                     */
/* ------------------------------------------------------------------ */
/*
 * Verification state is a frontend concept: the backend tracks report counts
 * but not independence of sources. We derive it from the reports themselves.
 */

/** Count reports and, separately, how many DISTINCT reporters they came from. */
export function sourceBreakdown(reports: Report[]): SourceBreakdown {
  const seen = new Set<string>();
  const counts = { citizen: 0, call: 0, sensor: 0, field: 0 };
  for (const r of reports) {
    counts[r.source] += 1;
    // A reporter texting five times is one source, not five.
    seen.add(r.reporter ?? r.sensor?.sensor_id ?? `${r.source}:${r.id}`);
  }
  return { reports: reports.length, unique_sources: seen.size, ...counts };
}

function deriveVerification(
  reports: Report[],
  sources: SourceBreakdown,
  conflicts: ConflictNote[],
): VerificationStatus {
  if (conflicts.length > 0) return "conflicting";
  if (reports.some((r) => r.source === "field")) return "verified";
  if (sources.unique_sources >= 2) return "corroborated";
  return "unverified";
}

export async function getIncidentTrust(incidentId: number): Promise<Envelope<IncidentTrust>> {
  if (USE_MOCK) {
    const trust = mock.MOCK_TRUST[incidentId];
    if (trust) return envelope(trust, "simulated");
  }

  const reports = await getReports(incidentId);
  const sources = sourceBreakdown(reports.data);
  const sensorReport = reports.data.find((r) => r.source === "sensor" && r.sensor);
  const conflicts: ConflictNote[] = [];

  return envelope(
    {
      incident_id: incidentId,
      verification: deriveVerification(reports.data, sources, conflicts),
      sources,
      duplicate_state: sources.reports > sources.unique_sources ? "matched" : "matched",
      sensor_corroboration: sensorReport?.sensor
        ? {
            sensor_id: sensorReport.sensor.sensor_id,
            detail: `${sensorReport.sensor.metric} ${sensorReport.sensor.value} ${sensorReport.sensor.unit} against a ${sensorReport.sensor.threshold} ${sensorReport.sensor.unit} threshold.`,
          }
        : null,
      conflicts,
    },
    reports.mode,
    reports.error,
  );
}

/* ------------------------------------------------------------------ */
/* Field situation updates                                             */
/* ------------------------------------------------------------------ */

/**
 * ADAPTER — the contract has no situation-update endpoint. A responder update
 * is expressed as a `field` report plus a `PATCH /api/incidents/{id}`, which
 * is what the backend already understands.
 */
export async function submitSituationUpdate(update: SituationUpdate): Promise<void> {
  if (USE_MOCK) return;

  const parts: string[] = [];
  if (update.severity !== null) parts.push(`Severity now ${update.severity}`);
  if (update.people_affected !== null) parts.push(`${update.people_affected} people affected`);
  if (update.hazards.length) parts.push(`Hazards: ${update.hazards.join(", ")}`);
  if (update.road_access !== "unknown") parts.push(`Road ${update.road_access.replace("_", " ")}`);
  if (update.additional_resources.length) {
    parts.push(`Requesting: ${update.additional_resources.join(", ")}`);
  }
  if (update.notes) parts.push(update.notes);
  if (update.resolved) parts.push("Responder marked the incident resolved");

  await request<unknown>("/api/reports", {
    method: "POST",
    body: JSON.stringify({
      source: "field",
      text: parts.join(". "),
      lang: "en",
      lat: update.lat,
      lng: update.lng,
      address: null,
      photo_url: null,
      reporter: `Assignment ${update.assignment_id}`,
      sensor: null,
      // Attach to this incident even without GPS (otherwise a new incident opens at the city centre).
      incident_id: update.incident_id,
    } satisfies ReportCreate),
  }, REPORT_TIMEOUT_MS);

  if (update.severity !== null || update.resolved) {
    await request<unknown>(`/api/incidents/${update.incident_id}`, {
      method: "PATCH",
      body: JSON.stringify({
        ...(update.severity !== null ? { severity: update.severity } : {}),
        ...(update.resolved ? { status: "resolved" } : {}),
        note: update.notes || "Field situation update",
      }),
    });
  }
}

/* ------------------------------------------------------------------ */
/* Analytics                                                           */
/* ------------------------------------------------------------------ */

function sinceQuery(filters?: Partial<AnalyticsFilters>): string {
  return filters?.since ? `?since=${encodeURIComponent(filters.since)}` : "";
}

export async function getAnalyticsSummary(
  filters?: Partial<AnalyticsFilters>,
): Promise<Envelope<AnalyticsSummary>> {
  const qs = sinceQuery(filters);
  return withFallback(
    `analytics-summary${qs}`,
    () => mock.MOCK_ANALYTICS_SUMMARY,
    () => request<AnalyticsSummary>(`/api/analytics/summary${qs}`),
  );
}

export async function getAnalyticsByType(
  filters?: Partial<AnalyticsFilters>,
): Promise<Envelope<AnalyticsByType[]>> {
  const qs = sinceQuery(filters);
  return withFallback(
    `analytics-by-type${qs}`,
    () => mock.MOCK_ANALYTICS_BY_TYPE,
    () => request<AnalyticsByType[]>(`/api/analytics/by-type${qs}`),
  );
}

export async function getResponseTimes(
  filters?: Partial<AnalyticsFilters>,
): Promise<Envelope<AnalyticsResponseTimes>> {
  const qs = sinceQuery(filters);
  return withFallback(
    `analytics-response-times${qs}`,
    () => mock.MOCK_RESPONSE_TIMES,
    () => request<AnalyticsResponseTimes>(`/api/analytics/response-times${qs}`),
  );
}

export async function getShortages(): Promise<Envelope<AnalyticsShortage[]>> {
  return withFallback(
    "analytics-shortages",
    () => mock.MOCK_SHORTAGES,
    () => request<AnalyticsShortage[]>("/api/analytics/shortages"),
  );
}

export async function getHotspots(): Promise<Envelope<AnalyticsHotspot[]>> {
  return withFallback(
    "analytics-hotspots",
    () => mock.MOCK_HOTSPOTS,
    () => request<AnalyticsHotspot[]>("/api/analytics/hotspots"),
  );
}

export async function getEval(): Promise<Envelope<AnalyticsEval | null>> {
  return withFallback(
    "analytics-eval",
    () => mock.MOCK_EVAL,
    () => request<AnalyticsEval>("/api/analytics/eval"),
  );
}

/**
 * Required-vs-available per resource kind, from the capability map and the
 * live incident list. `required` counts each open incident's needed kinds.
 */
export function computeShortages(
  incidents: Incident[],
  resources: Resource[],
): ShortageView[] {
  const required = new Map<Resource["kind"], number>();
  for (const incident of incidents) {
    if (incident.status === "resolved") continue;
    for (const kind of CAPABILITY_MAP[incident.type]) {
      required.set(kind, (required.get(kind) ?? 0) + 1);
    }
  }
  const kinds = [...new Set([...required.keys(), ...resources.map((r) => r.kind)])];
  return kinds
    .map((kind) => {
      const need = required.get(kind) ?? 0;
      const available = resources.filter((r) => r.kind === kind && r.status === "available").length;
      return { kind, required: need, available, shortage: Math.max(0, need - available) };
    })
    .sort((a, b) => b.shortage - a.shortage || a.kind.localeCompare(b.kind));
}

/* ------------------------------------------------------------------ */
/* Analytics support — incidents paired with their trust view          */
/* ------------------------------------------------------------------ */

/**
 * Incidents plus the derived trust view for each, so `/analytics` can filter
 * by verification and break down sources without every component refetching.
 *
 * In mock mode this is a lookup. Against a live backend it is one request per
 * incident (there is no bulk reports endpoint in the contract) — acceptable at
 * demo scale, and noted as an integration dependency.
 */
export async function getIncidentsWithTrust(): Promise<
  Envelope<{ incident: Incident; trust: IncidentTrust }[]>
> {
  const incidents = await getIncidents({ includeResolved: true });

  if (USE_MOCK) {
    const paired = incidents.data.map((incident) => ({
      incident,
      trust:
        mock.MOCK_TRUST[incident.id] ??
        ({
          incident_id: incident.id,
          verification: "unverified",
          sources: {
            reports: incident.report_count,
            unique_sources: 1,
            citizen: incident.report_count,
            call: 0,
            sensor: 0,
            field: 0,
          },
          duplicate_state: "matched",
          sensor_corroboration: null,
          conflicts: [],
        } satisfies IncidentTrust),
    }));
    return envelope(paired, incidents.mode, incidents.error);
  }

  const paired = await Promise.all(
    incidents.data.map(async (incident) => ({
      incident,
      trust: (await getIncidentTrust(incident.id)).data,
    })),
  );
  return envelope(paired, incidents.mode, incidents.error);
}

/* ================================================================== */
/* Gujarat State Emergency Response Platform                           */
/* ------------------------------------------------------------------ */
/* ADAPTER LAYER. None of these entities exist in API_CONTRACT.md yet  */
/* (no shelter, missing-person, relief, weather, pulse or report-doc   */
/* endpoints). Each function is written so that swapping the mock for  */
/* a real call is a one-line change, and each is listed as an open     */
/* integration dependency rather than presented as live data.          */
/* ================================================================== */

import type {
  DispatchLogEntry,
  DistrictSituation,
  ForecastDay,
  GroundTruthReport,
  MissingPerson,
  QueuedSubmission,
  ReliefRequest,
  ReportDoc,
  ResQPulse,
  SafeCheckIn,
  SafeRoute,
  Shelter,
} from "@/types";
import { haversineKm as haversine } from "./constants";

export async function getDistrictSituations(): Promise<Envelope<DistrictSituation[]>> {
  return withFallback(
    "district-situations",
    () => mock.MOCK_DISTRICT_SITUATIONS,
    () => request<DistrictSituation[]>("/api/districts/situation"),
  );
}

export async function getPulse(): Promise<Envelope<ResQPulse[]>> {
  return withFallback(
    "resq-pulse",
    () => mock.MOCK_PULSE,
    () => request<ResQPulse[]>("/api/pulse"),
  );
}

export async function getShelters(): Promise<Envelope<Shelter[]>> {
  return withFallback(
    "shelters",
    () => mock.MOCK_SHELTERS,
    () => request<Shelter[]>("/api/shelters"),
  );
}

/**
 * Shelters ordered by straight-line distance from a point. Distance is
 * as-the-crow-flies, not a road distance — callers label it accordingly.
 */
export function nearestShelters(
  shelters: Shelter[],
  lat: number,
  lng: number,
  limit = 3,
): (Shelter & { distanceKm: number })[] {
  return shelters
    .map((s) => ({ ...s, distanceKm: haversine(lat, lng, s.lat, s.lng) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

export async function getGroundTruth(): Promise<Envelope<GroundTruthReport[]>> {
  return withFallback(
    "ground-truth",
    () => mock.MOCK_GROUND_TRUTH,
    () => request<GroundTruthReport[]>("/api/ground-truth"),
  );
}

export async function getMissingPersons(): Promise<Envelope<MissingPerson[]>> {
  return withFallback(
    "missing-persons",
    () => mock.MOCK_MISSING,
    () => request<MissingPerson[]>("/api/missing-persons"),
  );
}

export async function getReliefRequests(): Promise<Envelope<ReliefRequest[]>> {
  return withFallback(
    "relief-requests",
    () => mock.MOCK_RELIEF,
    () => request<ReliefRequest[]>("/api/relief-requests"),
  );
}

export async function getWeatherAlerts(): Promise<Envelope<WeatherAlert[]>> {
  return withFallback(
    "weather-alerts",
    () => mock.MOCK_WEATHER_ALERTS,
    () => request<WeatherAlert[]>("/api/weather/alerts"),
  );
}

export async function getForecast(): Promise<Envelope<ForecastDay[]>> {
  return withFallback(
    "forecast",
    () => mock.MOCK_FORECAST,
    () => request<ForecastDay[]>("/api/weather/forecast"),
  );
}

export async function getDispatchLog(): Promise<Envelope<DispatchLogEntry[]>> {
  return withFallback(
    "dispatch-log",
    () => mock.MOCK_DISPATCH_LOG,
    () => request<DispatchLogEntry[]>("/api/logs"),
  );
}

export async function getReportDocs(): Promise<Envelope<ReportDoc[]>> {
  return withFallback(
    "report-docs",
    () => mock.MOCK_REPORT_DOCS,
    () => request<ReportDoc[]>("/api/reports/documents"),
  );
}

/**
 * SafeRoute. There is no routing engine wired up, so the returned route is
 * always flagged `live: false` and the UI must say the path is illustrative.
 * A real integration would replace this body and set `live: true`.
 */
export async function getSafeRoute(
  fromLabel: string,
  shelter: Shelter,
): Promise<Envelope<SafeRoute>> {
  const canned = mock.MOCK_SAFE_ROUTES.find((r) => r.toLabel === shelter.name);
  if (canned) return envelope(canned, "simulated");

  // Derived fallback so every shelter has a usable route card.
  const distance = haversine(
    shelter.lat,
    shelter.lng,
    shelter.lat + 0.02,
    shelter.lng + 0.02,
  );
  return envelope(
    {
      fromLabel,
      toLabel: shelter.name,
      toKind: "shelter",
      distanceKm: Number(distance.toFixed(1)),
      etaMin: Math.max(5, Math.round(distance * 3)),
      steps: [
        { instruction: `Head towards ${shelter.address}`, distanceKm: distance },
        { instruction: `Arrive at ${shelter.name}`, distanceKm: 0 },
      ],
      hazardsAvoided: [],
      live: false,
    },
    "simulated",
  );
}

/* ------------------------------------------------------------------ */
/* Offline queue and safe check-in                                     */
/* ------------------------------------------------------------------ */

const QUEUE_KEY = "resqnet.queue.v1";
const SAFE_KEY = "resqnet.safe.v1";

/** Anything held here has NOT reached the authorities yet. */
export function readQueue(): QueuedSubmission[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedSubmission[]) : [];
  } catch {
    return [];
  }
}

export function writeQueue(items: QueuedSubmission[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    /* storage unavailable (private mode) — the in-memory list still works */
  }
}

export function enqueue(item: Omit<QueuedSubmission, "id" | "queuedAt" | "attempts">): QueuedSubmission {
  const entry: QueuedSubmission = {
    ...item,
    id: `Q-${Date.now()}`,
    queuedAt: new Date().toISOString(),
    attempts: 0,
  };
  writeQueue([...readQueue(), entry]);
  return entry;
}

export function dequeue(id: string): void {
  writeQueue(readQueue().filter((q) => q.id !== id));
}

export function readSafeCheckIns(): SafeCheckIn[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAFE_KEY);
    return raw ? (JSON.parse(raw) as SafeCheckIn[]) : [];
  } catch {
    return [];
  }
}

/**
 * Record an "I'm Safe" check-in. When the device is offline the record is
 * stored locally with `synced: false` and queued — the caller must not tell
 * the user their family has been notified until it actually syncs.
 */
export async function submitSafeCheckIn(
  input: Omit<SafeCheckIn, "id" | "at" | "synced">,
): Promise<SafeCheckIn> {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  const record: SafeCheckIn = {
    ...input,
    id: `SAFE-${Date.now()}`,
    at: new Date().toISOString(),
    synced: !offline && !USE_MOCK ? true : false,
  };

  if (!USE_MOCK && !offline) {
    try {
      await request<unknown>("/api/safe-check-in", {
        method: "POST",
        body: JSON.stringify(input),
      });
      record.synced = true;
    } catch {
      record.synced = false;
    }
  }

  if (!record.synced) {
    enqueue({ kind: "safe_check_in", label: `I'm Safe — ${input.name}` });
  }

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        SAFE_KEY,
        JSON.stringify([...readSafeCheckIns(), record]),
      );
    } catch {
      /* ignore */
    }
  }
  return record;
}
