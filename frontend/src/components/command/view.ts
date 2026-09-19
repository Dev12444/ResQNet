/**
 * Command-center view model (FE1). The dashboard components render these shapes; `toView*` adapts
 * the API contract types (`@/types`, snake_case, numeric ids) into them in one place.
 */
import type {
  Alert as ApiAlert,
  Facility as ApiFacility,
  Incident as ApiIncident,
  IncidentType,
  Priority,
  IncidentStatus,
  Report as ApiReport,
  Resource as ApiResource,
  ResourceKind,
} from "@/types";

export type { IncidentType, Priority, IncidentStatus, ResourceKind };

export interface LinkedReport { id: string; source: "citizen" | "call" | "sensor" | "field"; lang: string; time: string; text: string }
export interface Incident {
  id: string; code: string; type: IncidentType; severity: number; priority: Priority; status: IncidentStatus;
  title: string; address: string; lat: number; lng: number; reportCount: number; createdAt: string;
  aiSummary: string; reasoning: string; confidence: number; hazards: string[]; peopleAffected: number;
  actions: string[]; reports: LinkedReport[];
}
export interface Resource { id: string; callsign: string; kind: ResourceKind; status: string; lat: number; lng: number }
export interface Facility { id: string; name: string; kind: "hospital" | "shelter" | "fire_station"; lat: number; lng: number; bedsAvailable: number }
export interface Alert { id: string; kind: "critical" | "sla_breach" | "escalation" | "shortage"; message: string; time: string; acknowledged: boolean; incidentId?: string }

/** "12:30" in the viewer's local time; "" for missing timestamps. */
export function clock(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function toViewReport(r: ApiReport): LinkedReport {
  const sensor = r.sensor ? `${r.sensor.sensor_id}: ${r.sensor.metric} ${r.sensor.value}${r.sensor.unit ?? ""} (threshold ${r.sensor.threshold})` : "";
  return { id: String(r.id), source: r.source, lang: r.lang ?? (r.source === "sensor" ? "sensor" : "?"), time: clock(r.created_at), text: r.text ?? sensor };
}

export function toViewIncident(i: ApiIncident, reports: ApiReport[] = []): Incident {
  return {
    id: String(i.id), code: i.code, type: i.type, severity: i.severity, priority: i.priority, status: i.status,
    title: i.title, address: i.address ?? "", lat: i.lat, lng: i.lng, reportCount: i.report_count,
    createdAt: clock(i.created_at), aiSummary: i.ai_summary ?? "", reasoning: i.ai_reasoning ?? "",
    confidence: i.confidence ?? 0, hazards: i.hazards ?? [], peopleAffected: i.people_affected_est ?? 0,
    actions: i.ai_actions ?? [], reports: reports.map(toViewReport),
  };
}

export function toViewResource(r: ApiResource): Resource {
  return { id: String(r.id), callsign: r.callsign, kind: r.kind, status: r.status, lat: r.lat, lng: r.lng };
}

export function toViewFacility(f: ApiFacility): Facility {
  return { id: String(f.id), name: f.name, kind: f.kind, lat: f.lat, lng: f.lng, bedsAvailable: f.beds_available ?? 0 };
}

export function toViewAlert(a: ApiAlert): Alert {
  return {
    id: String(a.id), kind: a.kind as Alert["kind"], message: a.message, time: clock(a.created_at),
    acknowledged: a.acknowledged, incidentId: a.incident_id != null ? String(a.incident_id) : undefined,
  };
}

/** Priority first, then oldest first: what a dispatcher should look at next. */
export function byUrgency(a: ApiIncident, b: ApiIncident): number {
  return a.priority.localeCompare(b.priority) || a.created_at.localeCompare(b.created_at);
}
