export type IncidentType = 'flood'|'fire'|'road_accident'|'industrial'|'medical'|'building_collapse'|'other';
export type Priority = 'P1'|'P2'|'P3'|'P4';
export type IncidentStatus = 'new'|'triaged'|'dispatched'|'on_scene'|'resolved'|'escalated';
export type ResourceKind = 'ambulance'|'rescue_boat'|'ndrf_team'|'fire_truck'|'police'|'hazmat';

export interface LinkedReport { id:string; source:'citizen'|'call'|'sensor'|'field'; lang:string; time:string; text:string; }
export interface Incident {
  id:string; code:string; type:IncidentType; severity:number; priority:Priority; status:IncidentStatus;
  title:string; address:string; lat:number; lng:number; reportCount:number; createdAt:string;
  aiSummary:string; reasoning:string; confidence:number; hazards:string[]; peopleAffected:number;
  actions:string[]; reports:LinkedReport[];
}
export interface Resource { id:string; callsign:string; kind:ResourceKind; status:'available'|'assigned'|'en_route'|'on_scene'; lat:number; lng:number; eta?:number; }
export interface Facility { id:string; name:string; kind:'hospital'|'shelter'|'fire_station'; lat:number; lng:number; bedsAvailable:number; }
export interface Recommendation { resource:Resource; score:number; eta:number; reason:string; }
export interface Alert { id:string; kind:'critical'|'sla_breach'|'escalation'|'shortage'; message:string; time:string; acknowledged:boolean; incidentId?:string; }
