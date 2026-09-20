/**
 * ResQNet — shared frontend types.
 *
 * Section 1–5 mirror `docs/API_CONTRACT.md` (source of truth) and
 * `backend/app/schemas.py`. Changing those sections means updating all three
 * files in the same PR and posting in the group.
 *
 * Section 6 holds FE-only view concepts (verification, freshness, connection
 * state, field updates, analytics filters). These are additive: they never
 * change the wire shapes above.
 */

/* ------------------------------------------------------------------ */
/* 1. Enums                                                            */
/* ------------------------------------------------------------------ */

export type IncidentType =
  | "flood"
  | "fire"
  | "road_accident"
  | "industrial"
  | "medical"
  | "building_collapse"
  | "other";

export type IncidentStatus =
  | "new"
  | "triaged"
  | "dispatched"
  | "on_scene"
  | "resolved"
  | "escalated";

export type Priority = "P1" | "P2" | "P3" | "P4";

export type Severity = 1 | 2 | 3 | 4 | 5;

export type ReportSource = "citizen" | "call" | "sensor" | "field";

export type Lang = "en" | "gu" | "hi";

export type ResourceKind =
  | "ambulance"
  | "fire_truck"
  | "rescue_boat"
  | "police"
  | "ndrf_team"
  | "hazmat";

export type ResourceStatus = "available" | "assigned" | "busy" | "offline";

export type FacilityKind = "hospital" | "shelter" | "fire_station";

export type AssignmentStatus =
  | "assigned"
  | "en_route"
  | "on_scene"
  | "completed"
  | "cancelled";

export type AlertKind = "critical" | "sla_breach" | "escalation" | "shortage";

export type Hazard =
  | "trapped_people"
  | "gas_leak"
  | "fire_spread"
  | "rising_water"
  | "electrical"
  | "structural"
  | "injuries"
  | "blocked_road"
  | "chemical"
  | "other";

/** `source_model` on a classification — how the triage result was produced. */
export type SourceModel = "openai" | "gemini" | "fallback" | "rules";

/* ------------------------------------------------------------------ */
/* 2. Objects                                                          */
/* ------------------------------------------------------------------ */

/** Sensor payload, present only when `source === "sensor"`. */
export interface SensorReading {
  sensor_id: string;
  metric: string;
  value: number;
  threshold: number;
  unit: string;
}

export interface Report {
  id: number;
  source: ReportSource;
  /** The citizen's ORIGINAL text, in their own language. Never overwrite this. */
  text: string | null;
  lang: Lang | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  photo_url: string | null;
  reporter: string | null;
  sensor: SensorReading | null;
  incident_id: number | null;
  created_at: string;
}

export interface Incident {
  id: number;
  code: string;
  type: IncidentType;
  severity: Severity;
  priority: Priority;
  status: IncidentStatus;
  title: string;
  lat: number;
  lng: number;
  /**
   * Nullable, matching `IncidentOut.address` on the API and the `Text` column
   * behind it: an incident raised from a sensor reading or a caller who never
   * gave a landmark has no address at all. This was typed `string` and the
   * analytics page took it at its word, so one address-less incident in the
   * live feed crashed the whole route.
   */
  address: string | null;
  ai_summary: string;
  ai_reasoning: string;
  ai_actions: string[];
  /** AI confidence 0..1 — confidence, never certainty. See `confidenceBand()`. */
  confidence: number;
  hazards: Hazard[];
  people_affected_est: number | null;
  report_count: number;
  created_at: string;
  updated_at: string;
  dispatched_at: string | null;
  resolved_at: string | null;
}

export interface IncidentDetail extends Incident {
  reports: Report[];
  assignments: Assignment[];
  alerts: Alert[];
}

export interface Resource {
  id: number;
  callsign: string;
  kind: ResourceKind;
  status: ResourceStatus;
  lat: number;
  lng: number;
  base: string;
  phone: string | null;
  current_incident_id: number | null;
}

export interface Facility {
  id: number;
  name: string;
  kind: FacilityKind;
  lat: number;
  lng: number;
  beds_total: number | null;
  beds_available: number | null;
  specialties: string[];
}

export interface Assignment {
  id: number;
  incident_id: number;
  resource_id: number;
  resource: Resource;
  status: AssignmentStatus;
  eta_min: number;
  approved_by: string;
  created_at: string;
  updated_at: string;
}

export interface Recommendation {
  resource: Resource;
  kind: ResourceKind;
  distance_km: number;
  eta_min: number;
  score: number;
  /** Unit capabilities this incident calls for, e.g. ["aerial_ladder", "rescue"] (show as chips). */
  matched_capabilities?: string[];
  reason: string;
}

export interface Alert {
  id: number;
  incident_id: number | null;
  incident_code: string | null;
  kind: AlertKind;
  message: string;
  acknowledged: boolean;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/* 3. Request / response shapes                                        */
/* ------------------------------------------------------------------ */

/** Body of `POST /api/reports`. */
export interface ReportCreate {
  source: ReportSource;
  text: string | null;
  lang: Lang | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  /** `data:image/...;base64,...` (<= 6 MB, downscale to ~1280px) or https URL. */
  photo_url: string | null;
  reporter: string | null;
  sensor: SensorReading | null;
  /**
   * PENDING CONTRACT ADDITION — the type the citizen picked on `/report`, as a
   * hint for the classifier. `ReportCreate` has no such field yet, so this is
   * sent additively and ignored by the current backend. Raised with the group;
   * until BE1 adds it, the citizen's selection only affects the client-side
   * reading shown on the receipt.
   */
  citizen_type?: IncidentType | null;
  /** `/field` updates: attach to this open incident directly (contract v1.3). */
  incident_id?: number | null;
  /**
   * PENDING CONTRACT ADDITIONS — captured on the SOS form because responders
   * need them, but `ReportCreate` has no fields for them yet. Sent additively
   * and ignored by the current backend; raised with BE1. The citizen's `text`
   * is never rewritten to smuggle these in.
   */
  disaster_type?: DisasterType | null;
  citizen_urgency?: CitizenUrgency | null;
  people_affected?: number | null;
  special_assistance?: string[];
}

/** How urgent the reporter believes the situation is. Advisory, not a priority. */
export type CitizenUrgency = "immediate" | "urgent" | "standard";

/** Gemini Vision analysis of an attached photo. Advisory only. */
export interface PhotoAnalysis {
  relevant: boolean;
  type: IncidentType | null;
  severity_hint: Severity | null;
  hazards: Hazard[];
  description: string;
  confidence: number;
}

export interface Classification {
  type: IncidentType;
  severity: Severity;
  priority: Priority;
  title: string;
  location_text: string | null;
  people_affected_est: number | null;
  hazards: Hazard[];
  reasoning: string;
  confidence: number;
  lang: Lang;
  source_model: SourceModel;
  photo?: PhotoAnalysis | null;
}

/** `201` response of `POST /api/reports`. */
export interface ReportCreateResponse {
  report: Report;
  incident: Incident;
  merged: boolean;
  classification: Classification;
}

export interface RecommendationsResponse {
  incident_id: number;
  needed_kinds: ResourceKind[];
  recommendations: Partial<Record<ResourceKind, Recommendation[]>>;
  suggested_resource_ids: number[];
  facility: {
    facility: Facility;
    distance_km: number;
    reason: string;
  } | null;
  shortages: ResourceKind[];
}

export interface AiStatus {
  ai_enabled: boolean;
  generation_available: boolean;
  embeddings_available: boolean;
  models: Record<string, { calls_last_min: number; benched_for_sec: number }>;
  embed_model: string;
  rpm_per_model: number;
  disk_cache: boolean;
}

export interface Sitrep {
  generated_at: string;
  markdown: string;
  active_count: number;
}

export interface HealthResponse {
  status: string;
  ai: boolean;
  db: boolean;
}

/* ------------------------------------------------------------------ */
/* 4. Analytics                                                        */
/* ------------------------------------------------------------------ */

export interface AnalyticsSummary {
  active_incidents: number;
  p1_open: number;
  resolved_today: number;
  total_reports: number;
  duplicates_merged: number;
  units_available: number;
  units_total: number;
  avg_time_to_dispatch_sec: number | null;
  avg_time_to_scene_sec: number | null;
}

export interface AnalyticsByType {
  type: IncidentType;
  count: number;
  /** Keys are severity 1..5 as strings, per the contract. */
  by_severity: Record<string, number>;
}

export interface ResponseTimeBucket {
  label: string;
  count: number;
}

export interface ResponseTimeByType {
  type: IncidentType;
  avg_dispatch_sec: number | null;
  avg_scene_sec: number | null;
}

export interface TimelinePoint {
  t: string;
  incidents: number;
  reports: number;
}

export interface AnalyticsResponseTimes {
  buckets: ResponseTimeBucket[];
  by_type: ResponseTimeByType[];
  timeline: TimelinePoint[];
}

export interface AnalyticsShortage {
  kind: ResourceKind;
  shortage_alerts: number;
  available: number;
  total: number;
}

/** A reporting-density cluster. Density of REPORTS — not validated risk. */
export interface AnalyticsHotspot {
  lat: number;
  lng: number;
  count: number;
  top_type: IncidentType;
}

export interface AnalyticsEval {
  n: number;
  type_accuracy: number;
  severity_within_1: number;
  dedup_precision: number;
  dedup_recall: number;
  avg_latency_ms: number | null;
  run_at: string;
}

/* ------------------------------------------------------------------ */
/* 5. WebSocket                                                        */
/* ------------------------------------------------------------------ */

export interface SimulatorStatus {
  running: boolean;
  events_sent: number;
  events_total: number;
}

export type WsEventMap = {
  "report.created": Report;
  "incident.created": Incident;
  "incident.updated": Incident;
  "incident.merged": { incident: Incident; report: Report };
  "assignment.updated": Assignment;
  "resource.updated": Resource;
  "alert.created": Alert;
  "simulator.status": SimulatorStatus;
};

export type WsEventName = keyof WsEventMap;

export type WsMessage<K extends WsEventName = WsEventName> = {
  [E in K]: { event: E; data: WsEventMap[E]; ts: string };
}[K];

/* ------------------------------------------------------------------ */
/* 6. FE view concepts (additive — not wire shapes)                    */
/* ------------------------------------------------------------------ */

/**
 * How well corroborated an incident is. Independent of severity: a severity-5
 * incident can be UNVERIFIED, and a severity-1 incident can be VERIFIED.
 */
export type VerificationStatus =
  | "unverified"
  | "corroborated"
  | "verified"
  | "conflicting";

/** Duplicate-review state for a report against an existing incident. */
export type DuplicateState = "matched" | "possible_duplicate" | "review_required";

/** AI confidence band. Labels must read as confidence, not proof. */
export type ConfidenceBand = "high" | "review_advised" | "manual_required";

/** Live-data transport state, shown in the shell. */
export type ConnectionStatus = "live" | "reconnecting" | "offline";

/** Provenance of the data currently on screen. */
export type DataMode =
  | "live"
  | "cached"
  | "stale"
  | "simulated"
  /**
   * Live mode, the server did not answer, and there is nothing real to
   * show. Distinct from "simulated" on purpose: simulated means "these are
   * demo figures", unavailable means "we have no figures". Screens that
   * would otherwise fill with fixtures during a demo show an explanation
   * instead — an invented incident on a live dashboard is worse than a
   * blank one.
   */
  | "unavailable";

/**
 * Counts of corroborating evidence. `unique_sources` is what makes an incident
 * credible — repeated reports from ONE reporter are not independent
 * confirmation, so `reports` can exceed `unique_sources`.
 */
export interface SourceBreakdown {
  reports: number;
  unique_sources: number;
  citizen: number;
  call: number;
  sensor: number;
  field: number;
}

/** Freshness of a single record (resource location, bed count, sensor reading). */
export interface DataFreshness {
  /** ISO timestamp of the last confirmed update. */
  updated_at: string;
  /** Seconds since `updated_at`, computed against a pinned clock. */
  age_sec: number;
  mode: DataMode;
}

/** Health of a telemetry sensor feeding corroboration. */
export type SensorHealth = "healthy" | "stale" | "offline" | "anomalous";

export interface Sensor {
  id: string;
  label: string;
  kind: "water_level" | "gas" | "smoke" | "rainfall";
  district: string;
  lat: number;
  lng: number;
  metric: string;
  value: number | null;
  threshold: number;
  unit: string;
  health: SensorHealth;
  /** ISO timestamp of last heartbeat, independent of last reading. */
  last_heartbeat: string;
  updated_at: string;
}

/** A conflict between reports about the same incident. Shown, never hidden. */
export interface ConflictNote {
  field: string;
  claims: { value: string; source: ReportSource; report_id: number; at: string }[];
}

/**
 * Verification/corroboration view-model derived from an incident's reports.
 * Assembled in `lib/api.ts`, not scattered through components.
 */
export interface IncidentTrust {
  incident_id: number;
  verification: VerificationStatus;
  sources: SourceBreakdown;
  duplicate_state: DuplicateState;
  /** Set when a sensor reading independently corroborates the reports. */
  sensor_corroboration: { sensor_id: string; detail: string } | null;
  conflicts: ConflictNote[];
}

/** Severity as verified on the ground, which may differ from the reported one. */
export interface VerifiedSeverity {
  reported: Severity;
  field_verified: Severity | null;
  /** Who last changed the operational picture. */
  last_source: "ai" | "citizen" | "sensor" | "dispatcher" | "responder";
  updated_at: string;
}

export type RoadAccess = "clear" | "partially_blocked" | "blocked" | "unknown";

/** Payload of the responder's UPDATE SITUATION form on `/field`. */
export interface SituationUpdate {
  incident_id: number;
  assignment_id: number;
  severity: Severity | null;
  people_affected: number | null;
  hazards: Hazard[];
  lat: number | null;
  lng: number | null;
  road_access: RoadAccess;
  notes: string;
  additional_resources: ResourceKind[];
  resolved: boolean;
  reported_at: string;
}

/** One-tap responder signals. */
export type QuickAction =
  | "situation_worse"
  | "situation_stable"
  | "wrong_location"
  | "road_blocked"
  | "need_ambulance"
  | "need_fire"
  | "need_rescue"
  | "need_hazmat"
  | "unable_to_reach";

/** Filter state for `/analytics`. Every field is actually applied. */
export interface AnalyticsFilters {
  since: string | null;
  until: string | null;
  districts: string[];
  types: IncidentType[];
  severities: Severity[];
  verifications: VerificationStatus[];
  sources: ReportSource[];
  resourceKinds: ResourceKind[];
}

/** A concrete, data-derived observation. No generic AI marketing copy. */
export interface OperationalInsight {
  id: string;
  kind: "sla_breach" | "trend" | "shortage" | "conflict" | "coverage";
  severity: "critical" | "warning" | "info";
  headline: string;
  detail: string;
  /** The numbers this insight was computed from, so it can be checked. */
  evidence: string;
}

/** Resource row enriched with assignment + freshness for `/resources`. */
export interface ResourceView extends Resource {
  district: string;
  capabilities: string[];
  /** Present when the unit is committed to an incident. */
  assignment: {
    incident_code: string;
    incident_id: number;
    status: AssignmentStatus;
    eta_min: number;
  } | null;
  freshness: DataFreshness;
}

export interface FacilityView extends Facility {
  district: string;
  freshness: DataFreshness;
}

/** Demand vs supply for one resource kind, per the shortage display. */
export interface ShortageView {
  kind: ResourceKind;
  required: number;
  available: number;
  /** `required - available`, floored at 0. */
  shortage: number;
}

/** Envelope for any FE2 data fetch — carries provenance and partial failures. */
export interface Envelope<T> {
  data: T;
  mode: DataMode;
  fetched_at: string;
  /** Set when the live call failed and this is fallback/cached data. */
  error: string | null;
}

/** Stages shown to a citizen after submitting a report. */
export type ReportStage =
  | "received"
  | "ai_triage"
  | "evidence_check"
  | "incident_linked"
  | "operational_review";

export interface ReportReceipt {
  report_id: number;
  incident_code: string | null;
  /** True when this report was linked to an already-known incident. */
  linked_to_existing: boolean;
  stage: ReportStage;
  submitted_at: string;
  classification: Classification | null;
  verification: VerificationStatus;
}

/* ================================================================== */
/* 7. Gujarat State Emergency Response Platform                        */
/* ------------------------------------------------------------------ */
/* Public-facing state platform concepts, layered on top of the        */
/* dispatcher contract above. These are FE-owned view models: nothing  */
/* here changes a wire shape in sections 1-5.                          */
/* ================================================================== */

/** District-level risk posture, lowest to highest. */
export type RiskLevel = "normal" | "watch" | "moderate" | "high" | "critical";

/** Disaster categories used across the public platform. */
export type DisasterType =
  | "cyclone"
  | "flood"
  | "fire"
  | "earthquake"
  | "medical"
  | "road_block"
  | "infrastructure"
  | "missing_person"
  | "heavy_rainfall"
  | "other";

/** Map layers a user can toggle on the Gujarat GIS view. */
export type MapLayer =
  | "cyclone"
  | "flood"
  | "fire"
  | "heavy_rainfall"
  | "warning"
  | "shelter"
  | "hospital"
  | "response_team"
  | "blocked_road"
  | "citizen_report";

export type MapBaseLayer = "map" | "satellite" | "hybrid";

/**
 * Trust ladder shown on citizen-sourced content. Distinct from the
 * dispatcher-side `VerificationStatus`: this is the public wording.
 */
export type GroundTruthLevel =
  | "unverified"
  | "community_confirmed"
  | "authority_verified";

/** ResQ Chain - the four stages the platform promises end to end. */
export type ResQChainStage = "reported" | "verified" | "responding" | "resolved";

/** Finer-grained status shown on an incident's chain timeline. */
export type ChainStatus =
  | "unverified"
  | "community_confirmed"
  | "authority_verified"
  | "assigned"
  | "response_en_route"
  | "resolved";

export interface ChainEvent {
  status: ChainStatus;
  at: string;
  actor: string;
  note: string | null;
}

/** Network posture. Drives the offline queue and the status indicator. */
export type ConnectivityState = "online" | "low" | "offline";

/* ------------------------------------------------------------------ */
/* Districts                                                           */
/* ------------------------------------------------------------------ */

export interface DistrictInfo {
  id: string;
  name: string;
  nameGu: string;
  nameHi: string;
  lat: number;
  lng: number;
}

/** Live situation for one district, shown when its map region is clicked. */
export interface DistrictSituation {
  district: string;
  risk: RiskLevel;
  headline: string;
  activeIncidents: number;
  sheltersOpen: number;
  responseTeams: number;
  peopleAffected: number;
  lat: number;
  lng: number;
  updatedAt: string;
}

/**
 * ResQ Pulse - district-level live emergency intelligence, the signature
 * rollup. Every number here is a count of something real in the data set.
 */
export interface ResQPulse {
  district: string;
  level: RiskLevel;
  headline: string;
  reports: number;
  blockedRoads: number;
  sheltersActive: number;
  responseTeams: number;
  priorityArea: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Shelters                                                            */
/* ------------------------------------------------------------------ */

export type ShelterStatus = "open" | "near_capacity" | "full" | "closed";

export interface Shelter {
  id: string;
  name: string;
  district: string;
  address: string;
  lat: number;
  lng: number;
  status: ShelterStatus;
  occupancy: number;
  capacity: number;
  amenities: {
    food: boolean;
    water: boolean;
    medical: boolean;
    accessible: boolean;
  };
  contact: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Citizen ground truth                                                */
/* ------------------------------------------------------------------ */

export type MediaKind = "photo" | "video" | "voice" | "text";

/** A citizen-submitted observation, before and after verification. */
export interface GroundTruthReport {
  id: string;
  disaster: DisasterType;
  district: string;
  location: string;
  lat: number;
  lng: number;
  text: string;
  lang: Lang;
  media: MediaKind[];
  level: GroundTruthLevel;
  confirmations: number;
  submittedAt: string;
  chain: ChainEvent[];
}

/* ------------------------------------------------------------------ */
/* Missing persons                                                     */
/* ------------------------------------------------------------------ */

export type MissingStatus = "missing" | "potential_match" | "located" | "reunited";

/**
 * Deliberately minimal. An age band rather than a date of birth, no contact
 * details and no home address - enough to help identify someone, not enough
 * to expose them.
 */
export interface MissingPerson {
  id: string;
  name: string;
  ageBand: string;
  district: string;
  lastSeenLocation: string;
  lastSeenAt: string;
  status: MissingStatus;
  description: string;
  hasPhoto: boolean;
  reportedAt: string;
  caseOfficer: string;
}

/* ------------------------------------------------------------------ */
/* Volunteers and relief requests                                      */
/* ------------------------------------------------------------------ */

export type ReliefKind = "food" | "water" | "medical" | "rescue" | "transport";
export type ReliefStatus = "open" | "claimed" | "in_transit" | "delivered";

export interface ReliefRequest {
  id: string;
  kind: ReliefKind;
  quantity: number;
  unit: string;
  priority: Priority;
  district: string;
  location: string;
  status: ReliefStatus;
  claimedBy: string | null;
  requestedAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Weather                                                             */
/* ------------------------------------------------------------------ */

export interface WeatherAlert {
  id: string;
  disaster: DisasterType;
  severity: RiskLevel;
  district: string;
  headline: string;
  detail: string;
  issuedAt: string;
  source: string;
}

export interface ForecastDay {
  day: string;
  rainfallMm: number;
  maxTempC: number;
  windKph: number;
}

/* ------------------------------------------------------------------ */
/* Dispatch log                                                        */
/* ------------------------------------------------------------------ */

export type LogKind =
  | "incident"
  | "unit"
  | "shelter"
  | "verification"
  | "weather"
  | "resource";

export interface DispatchLogEntry {
  id: string;
  at: string;
  kind: LogKind;
  severity: "info" | "warning" | "critical";
  district: string | null;
  unit: string | null;
  message: string;
}

/* ------------------------------------------------------------------ */
/* SafeRoute                                                           */
/* ------------------------------------------------------------------ */

export interface RouteStep {
  instruction: string;
  distanceKm: number;
}

/**
 * A route to a shelter or hospital. `live` is false whenever the path was
 * not computed by a real routing engine - the UI must say so rather than
 * implying the roads were checked.
 */
export interface SafeRoute {
  fromLabel: string;
  toLabel: string;
  toKind: "shelter" | "hospital";
  distanceKm: number;
  etaMin: number;
  steps: RouteStep[];
  hazardsAvoided: string[];
  live: boolean;
}

/* ------------------------------------------------------------------ */
/* Safe check-in                                                       */
/* ------------------------------------------------------------------ */

export interface SafeCheckIn {
  id: string;
  name: string;
  district: string;
  note: string;
  notifyContacts: boolean;
  at: string;
  /** False while the check-in is only stored on this device. */
  synced: boolean;
}

/* ------------------------------------------------------------------ */
/* Reports suite                                                       */
/* ------------------------------------------------------------------ */

export type ReportKind =
  | "situation"
  | "incident"
  | "district"
  | "response_performance"
  | "resource"
  | "after_action";

export type ReportStatus = "draft" | "published" | "archived";

export interface ReportSection {
  heading: string;
  body: string;
  /** Optional tabular block rendered as a bordered table. */
  table?: { columns: string[]; rows: string[][] };
}

export interface ReportDoc {
  id: string;
  kind: ReportKind;
  title: string;
  district: string | null;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  author: string;
  status: ReportStatus;
  summary: string;
  sections: ReportSection[];
}

/* ------------------------------------------------------------------ */
/* Offline queue                                                       */
/* ------------------------------------------------------------------ */

/** A submission held on the device because the network was unavailable. */
export interface QueuedSubmission {
  id: string;
  kind: "report" | "safe_check_in" | "relief_request";
  label: string;
  queuedAt: string;
  attempts: number;
  /**
   * The exact body to resend. Without it an entry is a note that something was
   * once typed, not a report that can still be delivered — and the queue used
   * to hold nothing else, so "queued" meant the text was discarded as soon as
   * the connection returned.
   *
   * Optional because entries written by older builds are still in people's
   * browsers and must be handled rather than silently dropped.
   */
  payload?: ReportCreate;
  /** Why the last resend attempt failed, shown to whoever is waiting. */
  lastError?: string | null;
  /**
   * Set on an entry that cannot be resent — no stored body. It is kept and
   * shown, never quietly deleted: the citizen has to know to send it again.
   */
  undeliverable?: boolean;
}
