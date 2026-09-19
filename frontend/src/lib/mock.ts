/**
 * ResQNet — deterministic demo data.
 *
 * Everything here is pinned to `DEMO_NOW`. No `Math.random()`, no `Date.now()`
 * at module scope: the same render must produce the same screen every time, or
 * a live demo turns into a guessing game.
 *
 * Coverage (one scenario per requirement, so the demo can hit them in order):
 *   Akhbarnagar flood · Vatva gas leak · Ankleshwar fire · S.G. Highway accident
 *   Surat flooding · medical · building collapse · cyclone/coastal
 *   gu/hi/en reports · duplicates + unique sources · conflicting reports
 *   low AI confidence · sensor confirmation + offline sensor · resource shortage
 *   stale resource · field severity correction · SLA delay · facility capacity
 *   resolved incident
 */

import type {
  Alert,
  AnalyticsByType,
  AnalyticsEval,
  AnalyticsHotspot,
  AnalyticsResponseTimes,
  AnalyticsShortage,
  AnalyticsSummary,
  Assignment,
  ConflictNote,
  Facility,
  FacilityView,
  Incident,
  IncidentTrust,
  Recommendation,
  RecommendationsResponse,
  Report,
  Resource,
  ResourceView,
  Sensor,
  VerifiedSeverity,
} from "@/types";
import { OFFLINE_AFTER_SEC, STALE_AFTER_SEC } from "./constants";

/** Pinned demo clock. All timestamps are offsets from this instant. */
export const DEMO_NOW = "2026-09-19T09:15:00Z";

const DEMO_NOW_MS = Date.parse(DEMO_NOW);

/** ISO timestamp `sec` seconds before `DEMO_NOW`. */
export function ago(sec: number): string {
  return new Date(DEMO_NOW_MS - sec * 1000).toISOString().replace(".000", "");
}

/** Age in seconds of an ISO timestamp against the pinned clock. */
export function ageSec(iso: string): number {
  return Math.max(0, Math.round((DEMO_NOW_MS - Date.parse(iso)) / 1000));
}

function freshness(updatedAt: string, simulated = false) {
  const age = ageSec(updatedAt);
  const mode = simulated
    ? ("simulated" as const)
    : age > OFFLINE_AFTER_SEC
      ? ("stale" as const)
      : age > STALE_AFTER_SEC
        ? ("stale" as const)
        : ("live" as const);
  return { updated_at: updatedAt, age_sec: age, mode };
}

/* ------------------------------------------------------------------ */
/* Incidents                                                           */
/* ------------------------------------------------------------------ */

export const MOCK_INCIDENTS: Incident[] = [
  {
    id: 1,
    code: "INC-0001",
    type: "flood",
    severity: 4,
    priority: "P1",
    status: "on_scene",
    title: "Car trapped in flooded Akhbarnagar underpass",
    lat: 23.0496,
    lng: 72.5621,
    address: "Akhbarnagar Underpass, Naranpura, Ahmedabad",
    ai_summary:
      "A car with occupants is trapped in the Akhbarnagar underpass as water rises. Seven reports from five independent sources — citizens, a 112 call, the Vasna water-level sensor and a field unit — describe the same location. Water rescue is on scene.",
    ai_reasoning:
      "Multiple independent reports describe a trapped vehicle and rising water in the same underpass within 12 minutes. Trapped people plus rising water maps to P1 under the deterministic priority rule.",
    ai_actions: [
      "Deploy rescue boat and NDRF team to the underpass mouth",
      "Close the underpass to traffic from both approaches",
      "Hold an ambulance at the Naranpura exit",
    ],
    confidence: 0.92,
    hazards: ["trapped_people", "rising_water", "electrical"],
    people_affected_est: 3,
    report_count: 7,
    created_at: ago(2100),
    updated_at: ago(240),
    dispatched_at: ago(1860),
    resolved_at: null,
  },
  {
    id: 2,
    code: "INC-0002",
    type: "industrial",
    severity: 5,
    priority: "P1",
    status: "triaged",
    title: "Chlorine leak at Vatva GIDC plant",
    lat: 22.9702,
    lng: 72.6289,
    address: "Vatva GIDC Phase 3, Ahmedabad",
    ai_summary:
      "Two workers report a chlorine leak from a storage tank at a Vatva GIDC unit, with a strong smell spreading downwind. No hazmat unit is currently available — this incident has been waiting on dispatch past the P1 target.",
    ai_reasoning:
      "Chemical release in a dense industrial zone with reported breathing difficulty. Gas leak hazard with people affected maps to P1.",
    ai_actions: [
      "Dispatch hazmat unit — none currently available, escalate to district",
      "Evacuate downwind units within 500 m",
      "Stage ambulances upwind at the Phase 3 gate",
    ],
    confidence: 0.88,
    hazards: ["gas_leak", "chemical", "injuries"],
    people_affected_est: 12,
    report_count: 3,
    created_at: ago(900),
    updated_at: ago(180),
    dispatched_at: null,
    resolved_at: null,
  },
  {
    id: 3,
    code: "INC-0003",
    type: "fire",
    severity: 4,
    priority: "P1",
    status: "dispatched",
    title: "Solvent store fire at Ankleshwar GIDC",
    lat: 21.6279,
    lng: 73.0143,
    address: "Ankleshwar GIDC Estate, Bharuch",
    ai_summary:
      "Fire in a solvent storage shed at Ankleshwar GIDC with thick black smoke. Two fire units are en route. Spread to the adjacent godown is the main risk.",
    ai_reasoning:
      "Reported flames plus solvent storage indicates rapid fire spread potential in an industrial estate.",
    ai_actions: [
      "Two fire units to the estate's east gate",
      "Shut the shared solvent line feeding the shed",
      "Keep an ambulance on standby for burn injuries",
    ],
    confidence: 0.85,
    hazards: ["fire_spread", "chemical"],
    people_affected_est: 4,
    report_count: 2,
    created_at: ago(1500),
    updated_at: ago(600),
    dispatched_at: ago(1260),
    resolved_at: null,
  },
  {
    id: 4,
    code: "INC-0004",
    type: "road_accident",
    severity: 3,
    priority: "P2",
    status: "dispatched",
    title: "Multi-vehicle collision on S.G. Highway",
    lat: 23.0364,
    lng: 72.5079,
    address: "S.G. Highway near Thaltej Circle, Ahmedabad",
    ai_summary:
      "A collision on S.G. Highway near Thaltej. Reports disagree on scale: one caller describes two cars and minor injuries, another describes three vehicles including a tempo with a person trapped. Treat the higher estimate as planning basis until a unit confirms.",
    ai_reasoning:
      "Two reports within four minutes at the same stretch. Conflicting vehicle counts and injury severity; classified on the more severe account pending field confirmation.",
    ai_actions: [
      "Ambulance and police to the northbound carriageway",
      "Confirm vehicle count and trapped persons on arrival",
      "Divert traffic at Thaltej Circle if a lane is blocked",
    ],
    confidence: 0.61,
    hazards: ["injuries", "blocked_road"],
    people_affected_est: 5,
    report_count: 2,
    created_at: ago(780),
    updated_at: ago(300),
    dispatched_at: ago(540),
    resolved_at: null,
  },
  {
    id: 5,
    code: "INC-0005",
    type: "flood",
    severity: 3,
    priority: "P2",
    status: "triaged",
    title: "Waterlogging in Udhna, Surat",
    lat: 21.1702,
    lng: 72.8311,
    address: "Udhna Darwaja, Surat",
    ai_summary:
      "Knee-deep waterlogging reported in Udhna after sustained rainfall. One Hindi-language report; no corroboration yet and no sensor coverage in this grid.",
    ai_reasoning:
      "Single citizen report describing standing water without trapped persons. Low corroboration keeps confidence down.",
    ai_actions: [
      "Request municipal pumping unit",
      "Seek corroboration from the Surat control room",
    ],
    confidence: 0.48,
    hazards: ["rising_water"],
    people_affected_est: null,
    report_count: 1,
    created_at: ago(1080),
    updated_at: ago(1080),
    dispatched_at: null,
    resolved_at: null,
  },
  {
    id: 6,
    code: "INC-0006",
    type: "medical",
    severity: 3,
    priority: "P2",
    status: "resolved",
    title: "Cardiac emergency at Maninagar residence",
    lat: 22.9967,
    lng: 72.6023,
    address: "Maninagar East, Ahmedabad",
    ai_summary:
      "Elderly resident with chest pain and breathlessness. Ambulance 108-AMD-04 transported the patient to LG Hospital. Incident closed.",
    ai_reasoning:
      "Single-patient medical call with cardiac symptoms; standard ambulance response.",
    ai_actions: ["Nearest ambulance with cardiac kit", "Pre-alert LG Hospital"],
    confidence: 0.94,
    hazards: ["injuries"],
    people_affected_est: 1,
    report_count: 1,
    created_at: ago(4200),
    updated_at: ago(2400),
    dispatched_at: ago(4080),
    resolved_at: ago(2400),
  },
  {
    id: 7,
    code: "INC-0007",
    type: "building_collapse",
    severity: 4,
    priority: "P1",
    status: "on_scene",
    title: "Compound wall collapse at Behrampura",
    lat: 22.9942,
    lng: 72.5836,
    address: "Behrampura, Ahmedabad",
    ai_summary:
      "A rain-soaked compound wall collapsed onto an adjacent shed. The reporting citizen estimated minor damage; the responding NDRF team found two people trapped under debris and raised the severity on scene.",
    ai_reasoning:
      "Initial text described a fallen wall without casualties. Field verification superseded the initial estimate.",
    ai_actions: [
      "NDRF team with lifting equipment on scene",
      "Second ambulance to the lane entrance",
      "Assess the remaining wall span before entry",
    ],
    confidence: 0.79,
    hazards: ["structural", "trapped_people", "injuries"],
    people_affected_est: 2,
    report_count: 3,
    created_at: ago(1680),
    updated_at: ago(420),
    dispatched_at: ago(1500),
    resolved_at: null,
  },
  {
    id: 8,
    code: "INC-0008",
    type: "flood",
    severity: 4,
    priority: "P1",
    status: "new",
    title: "Coastal surge flooding at Jakhau, Kutch",
    lat: 23.2167,
    lng: 68.7167,
    address: "Jakhau Port Road, Kutch",
    ai_summary:
      "Cyclone-driven surge is flooding the approach road to Jakhau port, cutting off a fishing settlement. Two reports arrived four minutes apart from nearby but distinct locations — flagged for duplicate review rather than merged automatically.",
    ai_reasoning:
      "Coastal surge during an active cyclone warning with a settlement cut off. Geographic proximity is within the flood window but the text describes two different stretches of road.",
    ai_actions: [
      "Confirm whether both reports describe the same stretch",
      "Rescue boat and NDRF team toward the port road",
      "Coordinate with Kutch district emergency (1077)",
    ],
    confidence: 0.73,
    hazards: ["rising_water", "blocked_road"],
    people_affected_est: 40,
    report_count: 2,
    created_at: ago(660),
    updated_at: ago(660),
    dispatched_at: null,
    resolved_at: null,
  },
  {
    id: 9,
    code: "INC-0009",
    type: "fire",
    severity: 2,
    priority: "P3",
    status: "dispatched",
    title: "Shop fire on C.G. Road",
    lat: 23.0276,
    lng: 72.5601,
    address: "C.G. Road, Navrangpura, Ahmedabad",
    ai_summary:
      "Small fire in a shuttered electronics shop on C.G. Road. No injuries reported. One fire unit dispatched.",
    ai_reasoning:
      "Contained fire in a closed unit with no occupants reported; no spread indicators.",
    ai_actions: ["One fire unit", "Isolate the shop's electrical supply"],
    confidence: 0.83,
    hazards: ["electrical", "fire_spread"],
    people_affected_est: 0,
    report_count: 2,
    created_at: ago(2700),
    updated_at: ago(1800),
    dispatched_at: ago(2520),
    resolved_at: null,
  },
  {
    id: 10,
    code: "INC-0010",
    type: "flood",
    severity: 3,
    priority: "P2",
    status: "new",
    title: "Vasna barrage water level above danger mark",
    lat: 23.0072,
    lng: 72.5543,
    address: "Vasna Barrage, Ahmedabad",
    ai_summary:
      "Sensor VASNA-WL-01 reports 4.9 m against a 4.2 m danger mark. No human reports from this location yet — this incident rests on a single sensor and has not been confirmed on the ground.",
    ai_reasoning:
      "Rule-based sensor classification: reading exceeds the configured danger threshold. No corroborating citizen or field report.",
    ai_actions: [
      "Send a field unit to confirm the reading",
      "Warn low-lying settlements downstream",
    ],
    confidence: 0.9,
    hazards: ["rising_water"],
    people_affected_est: null,
    report_count: 1,
    created_at: ago(540),
    updated_at: ago(540),
    dispatched_at: null,
    resolved_at: null,
  },
  {
    id: 11,
    code: "INC-0011",
    type: "road_accident",
    severity: 2,
    priority: "P3",
    status: "resolved",
    title: "Two-wheeler skid on Rajkot ring road",
    lat: 22.2916,
    lng: 70.7929,
    address: "Rajkot Ring Road near Madhapar Chowk",
    ai_summary:
      "Rider with a leg injury after skidding on a wet patch. Treated and transported. Incident closed.",
    ai_reasoning: "Single-casualty road incident with no obstruction reported.",
    ai_actions: ["Ambulance to the ring road", "Clear the wet patch"],
    confidence: 0.87,
    hazards: ["injuries"],
    people_affected_est: 1,
    report_count: 1,
    created_at: ago(6000),
    updated_at: ago(4500),
    dispatched_at: ago(5880),
    resolved_at: ago(4500),
  },
  {
    id: 12,
    code: "INC-0012",
    type: "other",
    severity: 2,
    priority: "P4",
    status: "new",
    title: "Unclear report near Gandhinagar Sector 21",
    lat: 23.2156,
    lng: 72.6369,
    address: "Sector 21, Gandhinagar (approximate)",
    ai_summary:
      "A short, ambiguous message mentioning 'problem near the garden'. No emergency type could be determined and no coordinates were supplied. Needs a human to call the reporter back.",
    ai_reasoning:
      "Text too short to classify. No location fix; placed at sector centroid. Confidence below the manual-verification threshold.",
    ai_actions: ["Call the reporter back", "Do not dispatch on this report alone"],
    confidence: 0.31,
    hazards: [],
    people_affected_est: null,
    report_count: 1,
    created_at: ago(420),
    updated_at: ago(420),
    dispatched_at: null,
    resolved_at: null,
  },
];

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

/**
 * INC-0001 carries 7 reports from 5 unique sources. Reports 2 and 3 are the
 * same reporter texting twice — they raise `report_count` but NOT
 * `unique_sources`.
 */
export const MOCK_REPORTS: Report[] = [
  {
    id: 1,
    source: "citizen",
    text: "અખબારનગર અંડરપાસમાં ગાડી ફસાઈ છે, પાણી ઝડપથી વધી રહ્યું છે. અંદર લોકો છે.",
    lang: "gu",
    lat: 23.0496,
    lng: 72.5621,
    address: "Akhbarnagar Underpass, Naranpura",
    photo_url: null,
    reporter: "+91 98•••••99 (citizen app)",
    sensor: null,
    incident_id: 1,
    created_at: ago(2100),
  },
  {
    id: 2,
    source: "citizen",
    text: "પાણી હજી વધી રહ્યું છે, જલદી કોઈને મોકલો",
    lang: "gu",
    lat: 23.0497,
    lng: 72.562,
    address: "Akhbarnagar Underpass, Naranpura",
    photo_url: null,
    reporter: "+91 98•••••99 (citizen app)",
    sensor: null,
    incident_id: 1,
    created_at: ago(1980),
  },
  {
    id: 3,
    source: "citizen",
    text: "કોઈ આવ્યું નથી, ગાડીમાં ત્રણ જણ છે",
    lang: "gu",
    lat: 23.0496,
    lng: 72.5622,
    address: "Akhbarnagar Underpass, Naranpura",
    photo_url: null,
    reporter: "+91 98•••••99 (citizen app)",
    sensor: null,
    incident_id: 1,
    created_at: ago(1920),
  },
  {
    id: 4,
    source: "call",
    text: "112 call: caller reports a white hatchback stuck in the Akhbarnagar underpass, water up to the windows, three occupants.",
    lang: "en",
    lat: 23.0495,
    lng: 72.5619,
    address: "Akhbarnagar Underpass, Naranpura",
    photo_url: null,
    reporter: "112 Control Room, Ahmedabad",
    sensor: null,
    incident_id: 1,
    created_at: ago(2040),
  },
  {
    id: 5,
    source: "citizen",
    text: "अंडरपास में पानी भर गया है, गाड़ी डूब रही है। दोनों तरफ से रास्ता बंद करो।",
    lang: "hi",
    lat: 23.0499,
    lng: 72.5625,
    address: "Akhbarnagar Underpass, Naranpura",
    photo_url: null,
    reporter: "+91 79•••••14 (citizen app)",
    sensor: null,
    incident_id: 1,
    created_at: ago(1860),
  },
  {
    id: 6,
    source: "sensor",
    text: null,
    lang: null,
    lat: 23.0072,
    lng: 72.5543,
    address: "Vasna Barrage",
    photo_url: null,
    reporter: null,
    sensor: {
      sensor_id: "VASNA-WL-01",
      metric: "water_level_m",
      value: 4.9,
      threshold: 4.2,
      unit: "m",
    },
    incident_id: 1,
    created_at: ago(1800),
  },
  {
    id: 7,
    source: "field",
    text: "NDRF-BOAT-02 on scene. Vehicle confirmed, three occupants on the roof, water still rising. Requesting second boat.",
    lang: "en",
    lat: 23.0496,
    lng: 72.5621,
    address: "Akhbarnagar Underpass, Naranpura",
    photo_url: null,
    reporter: "NDRF-BOAT-02",
    sensor: null,
    incident_id: 1,
    created_at: ago(240),
  },

  /* INC-0002 — Vatva gas leak */
  {
    id: 8,
    source: "citizen",
    text: "વટવા GIDC માં ગેસ લીક થયો છે, ખૂબ તીવ્ર વાસ આવે છે, શ્વાસ લેવામાં તકલીફ થાય છે",
    lang: "gu",
    lat: 22.9702,
    lng: 72.6289,
    address: "Vatva GIDC Phase 3",
    photo_url: null,
    reporter: "+91 96•••••07 (citizen app)",
    sensor: null,
    incident_id: 2,
    created_at: ago(900),
  },
  {
    id: 9,
    source: "call",
    text: "112 call: plant supervisor reports chlorine release from a storage tank, around 12 workers evacuating.",
    lang: "en",
    lat: 22.9705,
    lng: 72.6291,
    address: "Vatva GIDC Phase 3",
    photo_url: null,
    reporter: "112 Control Room, Ahmedabad",
    sensor: null,
    incident_id: 2,
    created_at: ago(840),
  },
  {
    id: 10,
    source: "sensor",
    text: null,
    lang: null,
    lat: 22.9708,
    lng: 72.6295,
    address: "Vatva GIDC Phase 3",
    photo_url: null,
    reporter: null,
    sensor: {
      sensor_id: "VATVA-GAS-02",
      metric: "cl2_ppm",
      value: 3.4,
      threshold: 1.0,
      unit: "ppm",
    },
    incident_id: 2,
    created_at: ago(780),
  },

  /* INC-0004 — S.G. Highway, conflicting accounts */
  {
    id: 11,
    source: "call",
    text: "112 call: two cars hit each other near Thaltej Circle, looks like minor injuries only, traffic still moving.",
    lang: "en",
    lat: 23.0364,
    lng: 72.5079,
    address: "S.G. Highway near Thaltej Circle",
    photo_url: null,
    reporter: "112 Control Room, Ahmedabad",
    sensor: null,
    incident_id: 4,
    created_at: ago(780),
  },
  {
    id: 12,
    source: "citizen",
    text: "S.G. Highway પર ત્રણ ગાડીઓ અથડાઈ, એક ટેમ્પોમાં માણસ ફસાયો છે, લોહી નીકળે છે",
    lang: "gu",
    lat: 23.0366,
    lng: 72.5082,
    address: "S.G. Highway near Thaltej Circle",
    photo_url: null,
    reporter: "+91 90•••••51 (citizen app)",
    sensor: null,
    incident_id: 4,
    created_at: ago(540),
  },

  /* INC-0005 — Surat, Hindi, low confidence */
  {
    id: 13,
    source: "citizen",
    text: "उधना दरवाजा के पास घुटनों तक पानी भर गया है, दुकानें बंद हो गई हैं",
    lang: "hi",
    lat: 21.1702,
    lng: 72.8311,
    address: "Udhna Darwaja, Surat",
    photo_url: null,
    reporter: "+91 94•••••88 (citizen app)",
    sensor: null,
    incident_id: 5,
    created_at: ago(1080),
  },

  /* INC-0007 — Behrampura, field correction */
  {
    id: 14,
    source: "citizen",
    text: "બહેરામપુરામાં કમ્પાઉન્ડની દીવાલ પડી ગઈ છે, બાજુના શેડ પર પડી છે",
    lang: "gu",
    lat: 22.9942,
    lng: 72.5836,
    address: "Behrampura, Ahmedabad",
    photo_url: null,
    reporter: "+91 87•••••33 (citizen app)",
    sensor: null,
    incident_id: 7,
    created_at: ago(1680),
  },
  {
    id: 15,
    source: "call",
    text: "112 call: neighbour reports a wall has come down onto a shed, unsure if anyone was inside.",
    lang: "en",
    lat: 22.9943,
    lng: 72.5838,
    address: "Behrampura, Ahmedabad",
    photo_url: null,
    reporter: "112 Control Room, Ahmedabad",
    sensor: null,
    incident_id: 7,
    created_at: ago(1620),
  },
  {
    id: 16,
    source: "field",
    text: "NDRF-TEAM-01: two people trapped under the debris, both responsive. Raising severity to 4. Need second ambulance.",
    lang: "en",
    lat: 22.9942,
    lng: 72.5836,
    address: "Behrampura, Ahmedabad",
    photo_url: null,
    reporter: "NDRF-TEAM-01",
    sensor: null,
    incident_id: 7,
    created_at: ago(420),
  },

  /* INC-0008 — Kutch coastal, possible duplicate */
  {
    id: 17,
    source: "citizen",
    text: "જખૌ પોર્ટ રોડ પર દરિયાનું પાણી ચઢી ગયું છે, ગામ સુધી પહોંચાતું નથી",
    lang: "gu",
    lat: 23.2167,
    lng: 68.7167,
    address: "Jakhau Port Road, Kutch",
    photo_url: null,
    reporter: "+91 99•••••76 (citizen app)",
    sensor: null,
    incident_id: 8,
    created_at: ago(660),
  },
  {
    id: 18,
    source: "call",
    text: "112 call: water across the road about two kilometres before the port, fishing hamlet cut off.",
    lang: "en",
    lat: 23.2049,
    lng: 68.7231,
    address: "Jakhau approach road, Kutch",
    photo_url: null,
    reporter: "112 Control Room, Bhuj",
    sensor: null,
    incident_id: 8,
    created_at: ago(420),
  },

  /* INC-0010 — sensor-only */
  {
    id: 19,
    source: "sensor",
    text: null,
    lang: null,
    lat: 23.0072,
    lng: 72.5543,
    address: "Vasna Barrage",
    photo_url: null,
    reporter: null,
    sensor: {
      sensor_id: "VASNA-WL-01",
      metric: "water_level_m",
      value: 4.9,
      threshold: 4.2,
      unit: "m",
    },
    incident_id: 10,
    created_at: ago(540),
  },

  /* INC-0012 — unclassifiable */
  {
    id: 20,
    source: "citizen",
    text: "બગીચા પાસે પ્રોબ્લેમ છે",
    lang: "gu",
    lat: null,
    lng: null,
    address: null,
    photo_url: null,
    reporter: "+91 63•••••09 (citizen app)",
    sensor: null,
    incident_id: 12,
    created_at: ago(420),
  },
];

export function reportsForIncident(incidentId: number): Report[] {
  return MOCK_REPORTS.filter((r) => r.incident_id === incidentId).sort(
    (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
  );
}

/* ------------------------------------------------------------------ */
/* Trust / verification view-models                                    */
/* ------------------------------------------------------------------ */

const SG_HIGHWAY_CONFLICTS: ConflictNote[] = [
  {
    field: "Vehicles involved",
    claims: [
      { value: "2 cars", source: "call", report_id: 11, at: ago(780) },
      { value: "3 vehicles incl. a tempo", source: "citizen", report_id: 12, at: ago(540) },
    ],
  },
  {
    field: "Trapped persons",
    claims: [
      { value: "None — minor injuries", source: "call", report_id: 11, at: ago(780) },
      { value: "One person trapped, bleeding", source: "citizen", report_id: 12, at: ago(540) },
    ],
  },
];

export const MOCK_TRUST: Record<number, IncidentTrust> = {
  1: {
    incident_id: 1,
    verification: "verified",
    sources: { reports: 7, unique_sources: 5, citizen: 4, call: 1, sensor: 1, field: 1 },
    duplicate_state: "matched",
    sensor_corroboration: {
      sensor_id: "VASNA-WL-01",
      detail: "Water level 4.9 m against a 4.2 m danger mark, 30 min before the call.",
    },
    conflicts: [],
  },
  2: {
    incident_id: 2,
    verification: "corroborated",
    sources: { reports: 3, unique_sources: 3, citizen: 1, call: 1, sensor: 1, field: 0 },
    duplicate_state: "matched",
    sensor_corroboration: {
      sensor_id: "VATVA-GAS-02",
      detail: "Chlorine 3.4 ppm against a 1.0 ppm threshold.",
    },
    conflicts: [],
  },
  3: {
    incident_id: 3,
    verification: "corroborated",
    sources: { reports: 2, unique_sources: 2, citizen: 1, call: 1, sensor: 0, field: 0 },
    duplicate_state: "matched",
    sensor_corroboration: null,
    conflicts: [],
  },
  4: {
    incident_id: 4,
    verification: "conflicting",
    sources: { reports: 2, unique_sources: 2, citizen: 1, call: 1, sensor: 0, field: 0 },
    duplicate_state: "matched",
    sensor_corroboration: null,
    conflicts: SG_HIGHWAY_CONFLICTS,
  },
  5: {
    incident_id: 5,
    verification: "unverified",
    sources: { reports: 1, unique_sources: 1, citizen: 1, call: 0, sensor: 0, field: 0 },
    duplicate_state: "matched",
    sensor_corroboration: null,
    conflicts: [],
  },
  6: {
    incident_id: 6,
    verification: "verified",
    sources: { reports: 1, unique_sources: 1, citizen: 0, call: 1, sensor: 0, field: 0 },
    duplicate_state: "matched",
    sensor_corroboration: null,
    conflicts: [],
  },
  7: {
    incident_id: 7,
    verification: "verified",
    sources: { reports: 3, unique_sources: 3, citizen: 1, call: 1, sensor: 0, field: 1 },
    duplicate_state: "matched",
    sensor_corroboration: null,
    conflicts: [],
  },
  8: {
    incident_id: 8,
    verification: "corroborated",
    sources: { reports: 2, unique_sources: 2, citizen: 1, call: 1, sensor: 0, field: 0 },
    duplicate_state: "review_required",
    sensor_corroboration: null,
    conflicts: [
      {
        field: "Location",
        claims: [
          { value: "At the port road", source: "citizen", report_id: 17, at: ago(660) },
          { value: "2 km before the port", source: "call", report_id: 18, at: ago(420) },
        ],
      },
    ],
  },
  9: {
    incident_id: 9,
    verification: "corroborated",
    sources: { reports: 2, unique_sources: 2, citizen: 2, call: 0, sensor: 0, field: 0 },
    duplicate_state: "matched",
    sensor_corroboration: null,
    conflicts: [],
  },
  10: {
    incident_id: 10,
    verification: "unverified",
    sources: { reports: 1, unique_sources: 1, citizen: 0, call: 0, sensor: 1, field: 0 },
    duplicate_state: "matched",
    sensor_corroboration: {
      sensor_id: "VASNA-WL-01",
      detail: "Sole source. No human confirmation yet.",
    },
    conflicts: [],
  },
  11: {
    incident_id: 11,
    verification: "verified",
    sources: { reports: 1, unique_sources: 1, citizen: 1, call: 0, sensor: 0, field: 0 },
    duplicate_state: "matched",
    sensor_corroboration: null,
    conflicts: [],
  },
  12: {
    incident_id: 12,
    verification: "unverified",
    sources: { reports: 1, unique_sources: 1, citizen: 1, call: 0, sensor: 0, field: 0 },
    duplicate_state: "possible_duplicate",
    sensor_corroboration: null,
    conflicts: [],
  },
};

/** Where reported severity and field-verified severity diverge. */
export const MOCK_VERIFIED_SEVERITY: Record<number, VerifiedSeverity> = {
  1: { reported: 4, field_verified: 4, last_source: "responder", updated_at: ago(240) },
  4: { reported: 3, field_verified: null, last_source: "ai", updated_at: ago(540) },
  7: { reported: 3, field_verified: 4, last_source: "responder", updated_at: ago(420) },
  10: { reported: 3, field_verified: null, last_source: "sensor", updated_at: ago(540) },
};

/* ------------------------------------------------------------------ */
/* Resources                                                           */
/* ------------------------------------------------------------------ */

type ResourceSeed = [
  id: number,
  callsign: string,
  kind: Resource["kind"],
  status: Resource["status"],
  lat: number,
  lng: number,
  base: string,
  district: string,
  updatedAgoSec: number,
  incidentId: number | null,
];

const RESOURCE_SEED: ResourceSeed[] = [
  [1, "108-AMD-01", "ambulance", "assigned", 23.0501, 72.5635, "Naranpura EMS Post", "Ahmedabad", 45, 1],
  [2, "108-AMD-02", "ambulance", "available", 23.0536, 72.6037, "Civil Hospital Asarwa", "Ahmedabad", 30, null],
  [3, "108-AMD-03", "ambulance", "available", 23.0339, 72.5121, "Thaltej EMS Post", "Ahmedabad", 25, null],
  [4, "108-AMD-04", "ambulance", "available", 22.9975, 72.6011, "LG Hospital Maninagar", "Ahmedabad", 60, null],
  [5, "108-AMD-05", "ambulance", "assigned", 23.0366, 72.5085, "Thaltej EMS Post", "Ahmedabad", 40, 4],
  [6, "108-AMD-06", "ambulance", "available", 23.0721, 72.5301, "Sola Civil Hospital", "Ahmedabad", 35, null],
  [7, "108-AMD-07", "ambulance", "assigned", 22.9945, 72.5839, "Behrampura EMS Post", "Ahmedabad", 50, 7],
  [8, "108-AMD-08", "ambulance", "busy", 23.0225, 72.5714, "Shahpur EMS Post", "Ahmedabad", 90, null],
  [9, "108-AMD-09", "ambulance", "offline", 23.0451, 72.6402, "Naroda EMS Post", "Ahmedabad", 1450, null],
  [10, "108-AMD-10", "ambulance", "available", 23.2156, 72.6369, "Gandhinagar Sector 21", "Gandhinagar", 55, null],
  [11, "108-SRT-01", "ambulance", "available", 21.1702, 72.8311, "Udhna EMS Post, Surat", "Surat", 70, null],
  [12, "108-BRC-01", "ambulance", "available", 21.6285, 73.0151, "Ankleshwar EMS Post", "Bharuch", 65, null],
  [13, "FIRE-AMD-01", "fire_truck", "available", 23.0258, 72.5873, "Danapith Fire Station", "Ahmedabad", 40, null],
  [14, "FIRE-AMD-02", "fire_truck", "assigned", 23.0281, 72.5608, "Naranpura Fire Station", "Ahmedabad", 35, 9],
  [15, "FIRE-AMD-03", "fire_truck", "available", 23.0412, 72.5952, "Shahpur Fire Station", "Ahmedabad", 45, null],
  [16, "FIRE-BRC-01", "fire_truck", "assigned", 21.6279, 73.0143, "Ankleshwar GIDC Fire Station", "Bharuch", 30, 3],
  [17, "FIRE-BRC-02", "fire_truck", "assigned", 21.6301, 73.0166, "Ankleshwar GIDC Fire Station", "Bharuch", 38, 3],
  [18, "NDRF-BOAT-01", "rescue_boat", "available", 23.03, 72.577, "Sabarmati Riverfront Post", "Ahmedabad", 50, null],
  [19, "NDRF-BOAT-02", "rescue_boat", "assigned", 23.0496, 72.5621, "Sabarmati Riverfront Post", "Ahmedabad", 20, 1],
  [20, "NDRF-BOAT-03", "rescue_boat", "offline", 21.1655, 72.8302, "Surat Riverfront Post", "Surat", 2100, null],
  [21, "NDRF-BOAT-04", "rescue_boat", "available", 22.3012, 70.8011, "Rajkot Reserve Post", "Rajkot", 800, null],
  [22, "NDRF-TEAM-01", "ndrf_team", "assigned", 22.9942, 72.5836, "NDRF Camp Gandhinagar", "Ahmedabad", 25, 7],
  [23, "NDRF-TEAM-02", "ndrf_team", "assigned", 23.0496, 72.5621, "NDRF Camp Gandhinagar", "Gandhinagar", 30, 1],
  [24, "PCR-AMD-01", "police", "assigned", 23.0364, 72.5079, "Thaltej Police Station", "Ahmedabad", 35, 4],
  [25, "HAZMAT-GJ-01", "hazmat", "busy", 22.3095, 73.1812, "Vadodara Hazmat Depot", "Vadodara", 120, null],
];

export const MOCK_RESOURCES: Resource[] = RESOURCE_SEED.map(
  ([id, callsign, kind, status, lat, lng, base, , , incidentId]) => ({
    id,
    callsign,
    kind,
    status,
    lat,
    lng,
    base,
    phone: null,
    current_incident_id: incidentId,
  }),
);

const CAPABILITIES: Record<Resource["kind"], string[]> = {
  ambulance: ["ALS", "Oxygen", "Trauma kit"],
  fire_truck: ["Water tender", "Foam", "Ladder"],
  rescue_boat: ["Shallow water", "Night ops", "6 person capacity"],
  police: ["Traffic control", "Cordon"],
  ndrf_team: ["Debris lifting", "Rope rescue", "Swift water"],
  hazmat: ["Chemical containment", "Level A suits", "Decon"],
};

const ASSIGNMENT_BY_RESOURCE: Record<number, { status: Assignment["status"]; eta: number }> = {
  1: { status: "on_scene", eta: 6 },
  5: { status: "en_route", eta: 4 },
  7: { status: "on_scene", eta: 8 },
  14: { status: "on_scene", eta: 5 },
  16: { status: "on_scene", eta: 3 },
  17: { status: "en_route", eta: 7 },
  19: { status: "on_scene", eta: 9 },
  22: { status: "on_scene", eta: 11 },
  23: { status: "en_route", eta: 14 },
  24: { status: "on_scene", eta: 6 },
};

export const MOCK_RESOURCE_VIEWS: ResourceView[] = RESOURCE_SEED.map(
  ([id, callsign, kind, status, lat, lng, base, district, updatedAgo, incidentId]) => {
    const assignment = ASSIGNMENT_BY_RESOURCE[id];
    const incident = MOCK_INCIDENTS.find((i) => i.id === incidentId);
    return {
      id,
      callsign,
      kind,
      status,
      lat,
      lng,
      base,
      phone: null,
      current_incident_id: incidentId,
      district,
      capabilities: CAPABILITIES[kind],
      assignment:
        assignment && incident
          ? {
              incident_code: incident.code,
              incident_id: incident.id,
              status: assignment.status,
              eta_min: assignment.eta,
            }
          : null,
      freshness: freshness(ago(updatedAgo)),
    };
  },
);

/* ------------------------------------------------------------------ */
/* Assignments                                                         */
/* ------------------------------------------------------------------ */

export const MOCK_ASSIGNMENTS: Assignment[] = Object.entries(ASSIGNMENT_BY_RESOURCE).map(
  ([resourceIdStr, { status, eta }], index) => {
    const resourceId = Number(resourceIdStr);
    const resource = MOCK_RESOURCES.find((r) => r.id === resourceId)!;
    return {
      id: 100 + index,
      incident_id: resource.current_incident_id!,
      resource_id: resourceId,
      resource,
      status,
      eta_min: eta,
      approved_by: "dispatcher",
      created_at: ago(1800 - index * 60),
      updated_at: ago(300 - index * 10),
    };
  },
);

export function assignmentsForIncident(incidentId: number): Assignment[] {
  return MOCK_ASSIGNMENTS.filter((a) => a.incident_id === incidentId);
}

export function assignmentsForResource(resourceId: number): Assignment[] {
  return MOCK_ASSIGNMENTS.filter((a) => a.resource_id === resourceId);
}

/* ------------------------------------------------------------------ */
/* Facilities                                                          */
/* ------------------------------------------------------------------ */

type FacilitySeed = [
  id: number,
  name: string,
  kind: Facility["kind"],
  lat: number,
  lng: number,
  bedsTotal: number | null,
  bedsAvailable: number | null,
  specialties: string[],
  district: string,
  updatedAgoSec: number,
];

const FACILITY_SEED: FacilitySeed[] = [
  [1, "Civil Hospital, Asarwa", "hospital", 23.0536, 72.6037, 120, 34, ["trauma", "burns", "general"], "Ahmedabad", 90],
  [2, "SVP Hospital, Ellisbridge", "hospital", 23.0258, 72.5731, 80, 12, ["trauma", "cardiac"], "Ahmedabad", 150],
  [3, "V.S. Hospital, Paldi", "hospital", 23.0121, 72.5665, 60, 7, ["general", "orthopaedic"], "Ahmedabad", 1800],
  [4, "LG Hospital, Maninagar", "hospital", 22.9975, 72.6011, 90, 21, ["cardiac", "general"], "Ahmedabad", 120],
  [5, "Sola Civil Hospital", "hospital", 23.0721, 72.5301, 70, 18, ["trauma", "general"], "Ahmedabad", 240],
  [6, "Zydus Hospital, S.G. Highway", "hospital", 23.0301, 72.5106, 50, 4, ["trauma", "cardiac", "burns"], "Ahmedabad", 75],
  [7, "Apollo Hospital, Gandhinagar", "hospital", 23.1912, 72.6291, 65, 22, ["cardiac", "neuro"], "Gandhinagar", 300],
  [8, "New Civil Hospital, Surat", "hospital", 21.1926, 72.8241, 110, 29, ["trauma", "general"], "Surat", 420],
  [9, "Naranpura Municipal Shelter", "shelter", 23.0489, 72.5595, 200, 146, ["flood relief"], "Ahmedabad", 600],
  [10, "Jakhau Coastal Shelter", "shelter", 23.2201, 68.7189, 150, 150, ["cyclone relief"], "Kutch", 3600],
];

export const MOCK_FACILITIES: Facility[] = FACILITY_SEED.map(
  ([id, name, kind, lat, lng, bedsTotal, bedsAvailable, specialties]) => ({
    id,
    name,
    kind,
    lat,
    lng,
    beds_total: bedsTotal,
    beds_available: bedsAvailable,
    specialties,
  }),
);

export const MOCK_FACILITY_VIEWS: FacilityView[] = FACILITY_SEED.map(
  ([id, name, kind, lat, lng, bedsTotal, bedsAvailable, specialties, district, updatedAgo]) => ({
    id,
    name,
    kind,
    lat,
    lng,
    beds_total: bedsTotal,
    beds_available: bedsAvailable,
    specialties,
    district,
    freshness: freshness(ago(updatedAgo)),
  }),
);

/* ------------------------------------------------------------------ */
/* Sensors                                                             */
/* ------------------------------------------------------------------ */

export const MOCK_SENSORS: Sensor[] = [
  {
    id: "VASNA-WL-01",
    label: "Vasna Barrage water level",
    kind: "water_level",
    district: "Ahmedabad",
    lat: 23.0072,
    lng: 72.5543,
    metric: "water_level_m",
    value: 4.9,
    threshold: 4.2,
    unit: "m",
    health: "anomalous",
    last_heartbeat: ago(20),
    updated_at: ago(45),
  },
  {
    id: "VATVA-GAS-02",
    label: "Vatva GIDC chlorine",
    kind: "gas",
    district: "Ahmedabad",
    lat: 22.9708,
    lng: 72.6295,
    metric: "cl2_ppm",
    value: 3.4,
    threshold: 1.0,
    unit: "ppm",
    health: "anomalous",
    last_heartbeat: ago(15),
    updated_at: ago(60),
  },
  {
    id: "SABAR-WL-03",
    label: "Sabarmati riverfront level",
    kind: "water_level",
    district: "Ahmedabad",
    lat: 23.03,
    lng: 72.577,
    metric: "water_level_m",
    value: 3.1,
    threshold: 4.2,
    unit: "m",
    health: "healthy",
    last_heartbeat: ago(25),
    updated_at: ago(40),
  },
  {
    id: "UDHNA-WL-01",
    label: "Udhna storm drain level",
    kind: "water_level",
    district: "Surat",
    lat: 21.1702,
    lng: 72.8311,
    metric: "water_level_m",
    value: 1.8,
    threshold: 2.5,
    unit: "m",
    health: "stale",
    last_heartbeat: ago(300),
    updated_at: ago(900),
  },
  {
    id: "ANKL-SMK-01",
    label: "Ankleshwar GIDC smoke",
    kind: "smoke",
    district: "Bharuch",
    lat: 21.6279,
    lng: 73.0143,
    metric: "pm25_ugm3",
    value: null,
    threshold: 150,
    unit: "µg/m³",
    health: "offline",
    last_heartbeat: ago(5400),
    updated_at: ago(5400),
  },
  {
    id: "JAKH-RAIN-01",
    label: "Jakhau rainfall",
    kind: "rainfall",
    district: "Kutch",
    lat: 23.2201,
    lng: 68.7189,
    metric: "rain_mm_hr",
    value: 42,
    threshold: 30,
    unit: "mm/hr",
    health: "anomalous",
    last_heartbeat: ago(35),
    updated_at: ago(50),
  },
];

/* ------------------------------------------------------------------ */
/* Alerts                                                              */
/* ------------------------------------------------------------------ */

export const MOCK_ALERTS: Alert[] = [
  {
    id: 1,
    incident_id: 2,
    incident_code: "INC-0002",
    kind: "sla_breach",
    message:
      "P1 industrial incident INC-0002 (Vatva GIDC chlorine leak) not dispatched for 15 min — no hazmat unit available",
    acknowledged: false,
    created_at: ago(180),
  },
  {
    id: 2,
    incident_id: 2,
    incident_code: "INC-0002",
    kind: "shortage",
    message: "No hazmat unit available in Ahmedabad. Nearest is HAZMAT-GJ-01 (Vadodara), currently busy.",
    acknowledged: false,
    created_at: ago(300),
  },
  {
    id: 3,
    incident_id: 1,
    incident_code: "INC-0001",
    kind: "critical",
    message: "INC-0001 Akhbarnagar underpass — three occupants confirmed on vehicle roof, water still rising",
    acknowledged: true,
    created_at: ago(240),
  },
  {
    id: 4,
    incident_id: 8,
    incident_code: "INC-0008",
    kind: "escalation",
    message: "INC-0008 Jakhau coastal surge — 40 people cut off, escalated to Kutch district emergency",
    acknowledged: false,
    created_at: ago(400),
  },
  {
    id: 5,
    incident_id: 7,
    incident_code: "INC-0007",
    kind: "critical",
    message: "INC-0007 Behrampura — field team raised severity from 3 to 4, two people trapped",
    acknowledged: false,
    created_at: ago(420),
  },
];

/* ------------------------------------------------------------------ */
/* Recommendations                                                     */
/* ------------------------------------------------------------------ */

function rec(resourceId: number, distanceKm: number, etaMin: number, score: number, reason: string): Recommendation {
  const resource = MOCK_RESOURCES.find((r) => r.id === resourceId)!;
  return { resource, kind: resource.kind, distance_km: distanceKm, eta_min: etaMin, score, reason };
}

export const MOCK_RECOMMENDATIONS: Record<number, RecommendationsResponse> = {
  1: {
    incident_id: 1,
    needed_kinds: ["rescue_boat", "ndrf_team", "ambulance"],
    recommendations: {
      rescue_boat: [rec(18, 2.4, 9, 0.87, "Closest available boat; shallow-water capable.")],
      ndrf_team: [rec(23, 4.1, 14, 0.81, "Team already mobilised for the Naranpura sector.")],
      ambulance: [rec(2, 3.2, 7, 0.78, "Trauma-equipped, closest with beds at destination.")],
    },
    suggested_resource_ids: [18, 23, 2],
    facility: {
      facility: MOCK_FACILITIES[0],
      distance_km: 3.1,
      reason: "Nearest hospital with trauma beds available (34).",
    },
    shortages: [],
  },
  2: {
    incident_id: 2,
    needed_kinds: ["hazmat", "fire_truck", "ambulance"],
    recommendations: {
      hazmat: [],
      fire_truck: [rec(13, 5.8, 12, 0.72, "Nearest tender with foam capability.")],
      ambulance: [rec(4, 4.0, 9, 0.75, "Closest available unit upwind of the plume.")],
    },
    suggested_resource_ids: [13, 4],
    facility: {
      facility: MOCK_FACILITIES[3],
      distance_km: 4.2,
      reason: "Nearest hospital with capacity; 21 beds free.",
    },
    shortages: ["hazmat"],
  },
};

/* ------------------------------------------------------------------ */
/* Analytics                                                           */
/* ------------------------------------------------------------------ */

export const MOCK_ANALYTICS_SUMMARY: AnalyticsSummary = {
  active_incidents: 10,
  p1_open: 4,
  resolved_today: 2,
  total_reports: 20,
  duplicates_merged: 6,
  units_available: 11,
  units_total: 25,
  avg_time_to_dispatch_sec: 188,
  avg_time_to_scene_sec: 642,
};

export const MOCK_ANALYTICS_BY_TYPE: AnalyticsByType[] = [
  { type: "flood", count: 4, by_severity: { "1": 0, "2": 0, "3": 2, "4": 2, "5": 0 } },
  { type: "fire", count: 2, by_severity: { "1": 0, "2": 1, "3": 0, "4": 1, "5": 0 } },
  { type: "road_accident", count: 2, by_severity: { "1": 0, "2": 1, "3": 1, "4": 0, "5": 0 } },
  { type: "industrial", count: 1, by_severity: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 1 } },
  { type: "medical", count: 1, by_severity: { "1": 0, "2": 0, "3": 1, "4": 0, "5": 0 } },
  { type: "building_collapse", count: 1, by_severity: { "1": 0, "2": 0, "3": 0, "4": 1, "5": 0 } },
  { type: "other", count: 1, by_severity: { "1": 0, "2": 1, "3": 0, "4": 0, "5": 0 } },
];

export const MOCK_RESPONSE_TIMES: AnalyticsResponseTimes = {
  buckets: [
    { label: "0-1 min", count: 2 },
    { label: "1-2 min", count: 3 },
    { label: "2-5 min", count: 2 },
    { label: "5+ min", count: 1 },
  ],
  by_type: [
    { type: "flood", avg_dispatch_sec: 240, avg_scene_sec: 720 },
    { type: "fire", avg_dispatch_sec: 180, avg_scene_sec: 540 },
    { type: "road_accident", avg_dispatch_sec: 240, avg_scene_sec: 480 },
    { type: "medical", avg_dispatch_sec: 120, avg_scene_sec: 420 },
    { type: "building_collapse", avg_dispatch_sec: 180, avg_scene_sec: 600 },
    { type: "industrial", avg_dispatch_sec: null, avg_scene_sec: null },
  ],
  timeline: Array.from({ length: 12 }, (_, i) => ({
    t: ago(3600 - i * 300),
    incidents: [1, 1, 2, 2, 1, 3, 2, 1, 2, 1, 1, 1][i],
    reports: [1, 2, 4, 3, 2, 5, 3, 2, 3, 1, 2, 1][i],
  })),
};

export const MOCK_SHORTAGES: AnalyticsShortage[] = [
  { kind: "hazmat", shortage_alerts: 3, available: 0, total: 1 },
  { kind: "rescue_boat", shortage_alerts: 2, available: 2, total: 4 },
  { kind: "ndrf_team", shortage_alerts: 1, available: 0, total: 2 },
  { kind: "ambulance", shortage_alerts: 0, available: 7, total: 12 },
  { kind: "fire_truck", shortage_alerts: 0, available: 2, total: 5 },
  { kind: "police", shortage_alerts: 0, available: 0, total: 1 },
];

export const MOCK_HOTSPOTS: AnalyticsHotspot[] = [
  { lat: 23.0495, lng: 72.562, count: 7, top_type: "flood" },
  { lat: 22.9702, lng: 72.6289, count: 3, top_type: "industrial" },
  { lat: 23.0364, lng: 72.5079, count: 2, top_type: "road_accident" },
  { lat: 22.9942, lng: 72.5836, count: 3, top_type: "building_collapse" },
  { lat: 23.2167, lng: 68.7167, count: 2, top_type: "flood" },
  { lat: 21.1702, lng: 72.8311, count: 1, top_type: "flood" },
  { lat: 21.6279, lng: 73.0143, count: 2, top_type: "fire" },
];

export const MOCK_EVAL: AnalyticsEval = {
  n: 50,
  type_accuracy: 0.94,
  severity_within_1: 0.9,
  dedup_precision: 0.9,
  dedup_recall: 0.86,
  avg_latency_ms: 1180,
  run_at: ago(7200),
};

/** District rollup used by the analytics comparison table. */
export const MOCK_DISTRICT_STATS = [
  { district: "Ahmedabad", incidents: 7, p1: 3, avg_dispatch_sec: 196, resolved: 1 },
  { district: "Kutch", incidents: 1, p1: 1, avg_dispatch_sec: null, resolved: 0 },
  { district: "Surat", incidents: 1, p1: 0, avg_dispatch_sec: null, resolved: 0 },
  { district: "Bharuch", incidents: 1, p1: 1, avg_dispatch_sec: 240, resolved: 0 },
  { district: "Rajkot", incidents: 1, p1: 0, avg_dispatch_sec: 120, resolved: 1 },
  { district: "Gandhinagar", incidents: 1, p1: 0, avg_dispatch_sec: null, resolved: 0 },
];
