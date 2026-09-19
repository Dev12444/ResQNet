/**
 * ResQNet — operational constants.
 *
 * Colour is always paired with a text label: colour alone must never be the
 * only way to read a status (accessibility, and projectors wash out hues).
 */

import type {
  AlertKind,
  AssignmentStatus,
  ConfidenceBand,
  DataMode,
  DuplicateState,
  Hazard,
  IncidentStatus,
  IncidentType,
  Lang,
  Priority,
  QuickAction,
  ReportSource,
  ResourceKind,
  ResourceStatus,
  RoadAccess,
  SensorHealth,
  Severity,
  VerificationStatus,
} from "@/types";

/* ------------------------------------------------------------------ */
/* Geography                                                           */
/* ------------------------------------------------------------------ */

/** Ahmedabad city centre — default map focus. */
export const GUJARAT_CENTER = { lat: 23.0225, lng: 72.5714 } as const;

export const DISTRICTS = [
  "Ahmedabad",
  "Gandhinagar",
  "Surat",
  "Vadodara",
  "Bharuch",
  "Rajkot",
  "Jamnagar",
  "Kutch",
] as const;

export type District = (typeof DISTRICTS)[number];

/** Great-circle distance in km. Mirrors `backend/app/services/geo.py`. */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Average speeds by unit kind, km/h — the same figures BE1 uses. These give a
 * straight-line estimate, NOT a routed one: no road network, traffic or
 * closures are modelled, so every ETA built from this is labelled as an
 * estimate wherever it is displayed.
 */
export const KIND_SPEED_KMH: Record<ResourceKind, number> = {
  ambulance: 35,
  fire_truck: 30,
  police: 40,
  rescue_boat: 10,
  ndrf_team: 25,
  hazmat: 30,
};

export function etaMinutes(distanceKm: number, kind: ResourceKind): number {
  return Math.max(1, Math.round((distanceKm / KIND_SPEED_KMH[kind]) * 60));
}

/* ------------------------------------------------------------------ */
/* Emergency numbers                                                   */
/* ------------------------------------------------------------------ */

export interface EmergencyNumber {
  number: string;
  label: string;
  /** `true` only for 112 — the unified number that takes precedence. */
  primary?: boolean;
}

/**
 * 112 is the unified emergency number and always comes first. The rest are
 * specialised lines; none of them replaces 112.
 */
export const EMERGENCY_NUMBERS: EmergencyNumber[] = [
  { number: "112", label: "Unified Emergency Number", primary: true },
  { number: "100", label: "Police" },
  { number: "101", label: "Fire & Rescue" },
  { number: "108", label: "Emergency Medical" },
  { number: "102", label: "Ambulance" },
  { number: "1070", label: "Disaster / Relief" },
  { number: "1077", label: "District Emergency" },
  { number: "181", label: "Women Helpline" },
  { number: "1098", label: "Child Helpline" },
  { number: "103", label: "Traffic Control" },
  { number: "1090", label: "Crime Stopper" },
];

export const PRIMARY_EMERGENCY_NUMBER = "112";

/* ------------------------------------------------------------------ */
/* Severity                                                            */
/* ------------------------------------------------------------------ */

/** Severity colours are fixed by the contract; do not re-map them. */
export const SEVERITY_COLOR: Record<Severity, string> = {
  1: "#22c55e",
  2: "#eab308",
  3: "#f97316",
  4: "#dc2626",
  5: "#7f1d1d",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  1: "Minor",
  2: "Moderate",
  3: "Serious",
  4: "Severe",
  5: "Catastrophic",
};

/** Foreground colour that stays legible on the matching severity colour. */
export const SEVERITY_TEXT_ON: Record<Severity, string> = {
  1: "#052e16",
  2: "#422006",
  3: "#431407",
  4: "#ffffff",
  5: "#ffffff",
};

/* ------------------------------------------------------------------ */
/* Priority                                                            */
/* ------------------------------------------------------------------ */

export const PRIORITY_LABEL: Record<Priority, string> = {
  P1: "P1 — Immediate",
  P2: "P2 — Urgent",
  P3: "P3 — Standard",
  P4: "P4 — Routine",
};

export const PRIORITY_COLOR: Record<Priority, string> = {
  P1: "#dc2626",
  P2: "#f97316",
  P3: "#eab308",
  P4: "#3b82f6",
};

/** Sort order for queues: P1 first. */
export const PRIORITY_RANK: Record<Priority, number> = {
  P1: 0,
  P2: 1,
  P3: 2,
  P4: 3,
};

/* ------------------------------------------------------------------ */
/* Incident type & status                                              */
/* ------------------------------------------------------------------ */

/** `icon` names map to lucide-react exports. */
export const INCIDENT_TYPE_META: Record<
  IncidentType,
  { label: string; icon: string }
> = {
  flood: { label: "Flood", icon: "Waves" },
  fire: { label: "Fire", icon: "Flame" },
  road_accident: { label: "Road Accident", icon: "Car" },
  industrial: { label: "Industrial", icon: "Factory" },
  medical: { label: "Medical", icon: "HeartPulse" },
  building_collapse: { label: "Building Collapse", icon: "Building2" },
  other: { label: "Other", icon: "TriangleAlert" },
};

export const INCIDENT_STATUS_LABEL: Record<IncidentStatus, string> = {
  new: "New",
  triaged: "Triaged",
  dispatched: "Dispatched",
  on_scene: "On Scene",
  resolved: "Resolved",
  escalated: "Escalated",
};

export const INCIDENT_STATUS_COLOR: Record<IncidentStatus, string> = {
  new: "#dc2626",
  triaged: "#f97316",
  dispatched: "#3b82f6",
  on_scene: "#eab308",
  resolved: "#22c55e",
  escalated: "#7f1d1d",
};

/* ------------------------------------------------------------------ */
/* Resources                                                           */
/* ------------------------------------------------------------------ */

export const RESOURCE_KIND_META: Record<
  ResourceKind,
  { label: string; short: string; icon: string }
> = {
  ambulance: { label: "Ambulance", short: "AMB", icon: "Ambulance" },
  fire_truck: { label: "Fire Unit", short: "FIRE", icon: "FireExtinguisher" },
  rescue_boat: { label: "Rescue Boat", short: "BOAT", icon: "Sailboat" },
  police: { label: "Police", short: "POL", icon: "Shield" },
  ndrf_team: { label: "Rescue Team", short: "NDRF", icon: "Users" },
  hazmat: { label: "Hazmat", short: "HAZ", icon: "Biohazard" },
};

export const RESOURCE_STATUS_LABEL: Record<ResourceStatus, string> = {
  available: "Available",
  assigned: "Assigned",
  busy: "Busy",
  offline: "Offline",
};

export const RESOURCE_STATUS_COLOR: Record<ResourceStatus, string> = {
  available: "#22c55e",
  assigned: "#3b82f6",
  busy: "#f97316",
  offline: "#71717a",
};

/**
 * Operational statuses shown on `/resources`. `en_route` and `on_scene` are
 * derived from the unit's active assignment, not from `Resource.status`.
 */
export const RESOURCE_VIEW_STATUSES = [
  "available",
  "assigned",
  "en_route",
  "on_scene",
  "busy",
  "offline",
] as const;

export type ResourceViewStatus = (typeof RESOURCE_VIEW_STATUSES)[number];

export const RESOURCE_VIEW_STATUS_COLOR: Record<ResourceViewStatus, string> = {
  available: "#22c55e",
  assigned: "#3b82f6",
  en_route: "#3b82f6",
  on_scene: "#eab308",
  busy: "#f97316",
  offline: "#71717a",
};

export const RESOURCE_VIEW_STATUS_LABEL: Record<ResourceViewStatus, string> = {
  available: "Available",
  assigned: "Assigned",
  en_route: "En Route",
  on_scene: "On Scene",
  busy: "Busy",
  offline: "Offline",
};

/** Which kinds an incident type needs, in order (contract §1). */
export const CAPABILITY_MAP: Record<IncidentType, ResourceKind[]> = {
  flood: ["rescue_boat", "ndrf_team", "ambulance"],
  fire: ["fire_truck", "ambulance"],
  road_accident: ["ambulance", "police"],
  industrial: ["hazmat", "fire_truck", "ambulance"],
  medical: ["ambulance"],
  building_collapse: ["ndrf_team", "fire_truck", "ambulance"],
  other: ["police"],
};

export const ASSIGNMENT_STATUS_LABEL: Record<AssignmentStatus, string> = {
  assigned: "Assigned",
  en_route: "En Route",
  on_scene: "On Scene",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Forward-only lifecycle used by the big buttons on `/field`. */
export const ASSIGNMENT_FLOW: AssignmentStatus[] = [
  "assigned",
  "en_route",
  "on_scene",
  "completed",
];

/* ------------------------------------------------------------------ */
/* Trust, verification, confidence                                     */
/* ------------------------------------------------------------------ */

export const VERIFICATION_META: Record<
  VerificationStatus,
  { label: string; color: string; note: string }
> = {
  unverified: {
    label: "UNVERIFIED",
    color: "#a1a1aa",
    note: "Single source. Not yet corroborated.",
  },
  corroborated: {
    label: "CORROBORATED",
    color: "#3b82f6",
    note: "Multiple independent sources agree.",
  },
  verified: {
    label: "VERIFIED",
    color: "#22c55e",
    note: "Confirmed on the ground by a responder.",
  },
  conflicting: {
    label: "CONFLICTING",
    color: "#f97316",
    note: "Sources disagree. Needs human review.",
  },
};

export const DUPLICATE_STATE_META: Record<
  DuplicateState,
  { label: string; color: string }
> = {
  matched: { label: "MATCHED", color: "#3b82f6" },
  possible_duplicate: { label: "POSSIBLE DUPLICATE", color: "#eab308" },
  review_required: { label: "REVIEW REQUIRED", color: "#f97316" },
};

/** Confidence thresholds. These are AI confidence, not certainty. */
export const CONFIDENCE_THRESHOLDS = { high: 0.8, review: 0.5 } as const;

export const CONFIDENCE_META: Record<
  ConfidenceBand,
  { label: string; color: string }
> = {
  high: { label: "HIGH CONFIDENCE", color: "#22c55e" },
  review_advised: { label: "REVIEW ADVISED", color: "#eab308" },
  manual_required: { label: "MANUAL VERIFICATION REQUIRED", color: "#f97316" },
};

/** Map a 0..1 AI confidence onto its operational band. */
export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= CONFIDENCE_THRESHOLDS.high) return "high";
  if (confidence >= CONFIDENCE_THRESHOLDS.review) return "review_advised";
  return "manual_required";
}

/* ------------------------------------------------------------------ */
/* Hazards                                                             */
/* ------------------------------------------------------------------ */

export const HAZARD_LABEL: Record<Hazard, string> = {
  trapped_people: "Trapped People",
  gas_leak: "Gas Leak",
  fire_spread: "Fire Spread",
  rising_water: "Rising Water",
  electrical: "Electrical",
  structural: "Structural",
  injuries: "Injuries",
  blocked_road: "Blocked Road",
  chemical: "Chemical",
  other: "Other",
};

export const HAZARD_OPTIONS = Object.keys(HAZARD_LABEL) as Hazard[];

/* ------------------------------------------------------------------ */
/* Sources                                                             */
/* ------------------------------------------------------------------ */

export const SOURCE_META: Record<
  ReportSource,
  { label: string; short: string; icon: string }
> = {
  citizen: { label: "Citizen", short: "Citizen", icon: "User" },
  call: { label: "112 Call", short: "112 Call", icon: "Phone" },
  sensor: { label: "Sensor", short: "Sensor", icon: "Radio" },
  field: { label: "Field", short: "Field", icon: "Radar" },
};

export const ALERT_KIND_META: Record<
  AlertKind,
  { label: string; color: string }
> = {
  critical: { label: "Critical", color: "#dc2626" },
  sla_breach: { label: "SLA Breach", color: "#f97316" },
  escalation: { label: "Escalation", color: "#7f1d1d" },
  shortage: { label: "Shortage", color: "#eab308" },
};

/* ------------------------------------------------------------------ */
/* Data freshness & connection                                         */
/* ------------------------------------------------------------------ */

/** Seconds after which a location/reading is shown as STALE. */
export const STALE_AFTER_SEC = 120;
/** Seconds after which a feed is treated as OFFLINE. */
export const OFFLINE_AFTER_SEC = 600;

export const DATA_MODE_META: Record<
  DataMode,
  { label: string; color: string }
> = {
  live: { label: "LIVE", color: "#22c55e" },
  cached: { label: "CACHED", color: "#3b82f6" },
  stale: { label: "STALE", color: "#f97316" },
  simulated: { label: "SIMULATED", color: "#a855f7" },
};

export const SENSOR_HEALTH_META: Record<
  SensorHealth,
  { label: string; color: string }
> = {
  healthy: { label: "HEALTHY", color: "#22c55e" },
  stale: { label: "STALE", color: "#f97316" },
  offline: { label: "OFFLINE", color: "#71717a" },
  anomalous: { label: "ANOMALOUS", color: "#dc2626" },
};

export const ROAD_ACCESS_LABEL: Record<RoadAccess, string> = {
  clear: "Clear",
  partially_blocked: "Partially Blocked",
  blocked: "Blocked",
  unknown: "Unknown",
};

/* ------------------------------------------------------------------ */
/* Field quick actions                                                 */
/* ------------------------------------------------------------------ */

export const QUICK_ACTIONS: { id: QuickAction; label: string; tone: "danger" | "warn" | "ok" }[] = [
  { id: "situation_worse", label: "Situation Worse", tone: "danger" },
  { id: "situation_stable", label: "Situation Stable", tone: "ok" },
  { id: "wrong_location", label: "Wrong Location", tone: "warn" },
  { id: "road_blocked", label: "Road Blocked", tone: "warn" },
  { id: "need_ambulance", label: "Need Ambulance", tone: "danger" },
  { id: "need_fire", label: "Need Fire", tone: "danger" },
  { id: "need_rescue", label: "Need Rescue", tone: "danger" },
  { id: "need_hazmat", label: "Need Hazmat", tone: "danger" },
  { id: "unable_to_reach", label: "Unable To Reach", tone: "warn" },
];

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

export const NAV_LINKS = [
  { href: "/dashboard", label: "Control Room" },
  { href: "/report", label: "Report" },
  { href: "/field", label: "Field" },
  { href: "/resources", label: "Resources" },
  { href: "/analytics", label: "Analytics" },
] as const;

/* ------------------------------------------------------------------ */
/* Languages                                                           */
/* ------------------------------------------------------------------ */

export const LANGS: { code: Lang; label: string; speech: string }[] = [
  { code: "en", label: "English", speech: "en-IN" },
  { code: "gu", label: "ગુજરાતી", speech: "gu-IN" },
  { code: "hi", label: "हिन्दी", speech: "hi-IN" },
];

export const LANG_LABEL: Record<Lang, string> = {
  en: "English",
  gu: "ગુજરાતી",
  hi: "हिन्दी",
};

/**
 * UI strings for the citizen-facing surfaces. Only interface chrome is
 * translated — a citizen's own report text is never translated or replaced.
 */
export const UI_STRINGS = {
  en: {
    reportTitle: "Report an Emergency",
    reportLead: "Tell us what is happening. Keep it short.",
    callBanner:
      "Immediate danger? Call 112. ResQNet reporting supports coordination and does not replace emergency calling.",
    call112: "CALL 112",
    language: "Language",
    whatHappening: "What is happening?",
    describePlaceholder: "Describe the emergency in your own words",
    emergencyType: "Emergency type",
    location: "Location",
    useMyLocation: "Use My Location",
    locating: "Finding your location…",
    locationDenied:
      "Location unavailable. Type the nearest landmark instead — your report still works.",
    adjustLocation: "Adjust location",
    landmarkLabel: "Nearest landmark or address",
    landmarkPlaceholder: "e.g. Akhbarnagar underpass, Naranpura",
    photo: "Photo (optional)",
    addPhoto: "Add Photo",
    removePhoto: "Remove",
    photoError: "Could not read that image. You can submit without it.",
    voice: "Voice (optional)",
    startVoice: "Speak",
    stopVoice: "Stop",
    voiceUnsupported: "Voice input is not available on this browser.",
    voiceHint: "You can edit the transcribed text before sending.",
    contact: "Your details (optional)",
    yourName: "Name",
    yourPhone: "Phone",
    submit: "SEND REPORT",
    submitting: "Sending…",
    submitError: "Could not send. Check your connection and try again.",
    retry: "Try Again",
    received: "Report received",
    yourWords: "Your report, as you wrote it",
    operationalReading: "Operational interpretation",
    reportId: "Report ID",
    submittedAt: "Submitted",
    newReport: "Send another report",
    required: "Required",
  },
  gu: {
    reportTitle: "કટોકટીની જાણ કરો",
    reportLead: "શું થઈ રહ્યું છે તે જણાવો. ટૂંકમાં લખો.",
    callBanner:
      "તાત્કાલિક જોખમ છે? 112 પર કૉલ કરો. ResQNet રિપોર્ટિંગ સંકલનમાં મદદ કરે છે, તે કટોકટી કૉલનો વિકલ્પ નથી.",
    call112: "112 પર કૉલ કરો",
    language: "ભાષા",
    whatHappening: "શું થઈ રહ્યું છે?",
    describePlaceholder: "તમારા પોતાના શબ્દોમાં કટોકટી વર્ણવો",
    emergencyType: "કટોકટીનો પ્રકાર",
    location: "સ્થળ",
    useMyLocation: "મારું સ્થાન વાપરો",
    locating: "તમારું સ્થાન શોધી રહ્યા છીએ…",
    locationDenied:
      "સ્થાન ઉપલબ્ધ નથી. નજીકનું સ્થળ લખો — તમારો રિપોર્ટ તો પણ કામ કરશે.",
    adjustLocation: "સ્થાન સુધારો",
    landmarkLabel: "નજીકનું સ્થળ અથવા સરનામું",
    landmarkPlaceholder: "દા.ત. અખબારનગર અંડરપાસ, નારણપુરા",
    photo: "ફોટો (વૈકલ્પિક)",
    addPhoto: "ફોટો ઉમેરો",
    removePhoto: "કાઢી નાખો",
    photoError: "આ ફોટો વાંચી શકાયો નથી. તમે ફોટા વગર મોકલી શકો છો.",
    voice: "અવાજ (વૈકલ્પિક)",
    startVoice: "બોલો",
    stopVoice: "બંધ કરો",
    voiceUnsupported: "આ બ્રાઉઝરમાં અવાજ ઇનપુટ ઉપલબ્ધ નથી.",
    voiceHint: "મોકલતા પહેલાં તમે લખાણ સુધારી શકો છો.",
    contact: "તમારી વિગતો (વૈકલ્પિક)",
    yourName: "નામ",
    yourPhone: "ફોન",
    submit: "રિપોર્ટ મોકલો",
    submitting: "મોકલી રહ્યા છીએ…",
    submitError: "મોકલી શકાયું નથી. કનેક્શન તપાસીને ફરી પ્રયાસ કરો.",
    retry: "ફરી પ્રયાસ કરો",
    received: "રિપોર્ટ મળ્યો",
    yourWords: "તમારો રિપોર્ટ, તમારા શબ્દોમાં",
    operationalReading: "કામગીરી માટેનું અર્થઘટન",
    reportId: "રિપોર્ટ ID",
    submittedAt: "મોકલ્યો",
    newReport: "બીજો રિપોર્ટ મોકલો",
    required: "જરૂરી",
  },
  hi: {
    reportTitle: "आपातकाल की सूचना दें",
    reportLead: "बताइए क्या हो रहा है। संक्षेप में लिखें।",
    callBanner:
      "तत्काल खतरा है? 112 पर कॉल करें। ResQNet रिपोर्टिंग समन्वय में मदद करती है, यह आपातकालीन कॉल का विकल्प नहीं है।",
    call112: "112 पर कॉल करें",
    language: "भाषा",
    whatHappening: "क्या हो रहा है?",
    describePlaceholder: "अपने शब्दों में आपातकाल बताएं",
    emergencyType: "आपातकाल का प्रकार",
    location: "स्थान",
    useMyLocation: "मेरा स्थान उपयोग करें",
    locating: "आपका स्थान खोजा जा रहा है…",
    locationDenied:
      "स्थान उपलब्ध नहीं है। पास का लैंडमार्क लिखें — आपकी रिपोर्ट फिर भी जाएगी।",
    adjustLocation: "स्थान ठीक करें",
    landmarkLabel: "पास का लैंडमार्क या पता",
    landmarkPlaceholder: "जैसे अखबारनगर अंडरपास, नारणपुरा",
    photo: "फ़ोटो (वैकल्पिक)",
    addPhoto: "फ़ोटो जोड़ें",
    removePhoto: "हटाएं",
    photoError: "यह फ़ोटो पढ़ी नहीं जा सकी। आप बिना फ़ोटो के भेज सकते हैं।",
    voice: "आवाज़ (वैकल्पिक)",
    startVoice: "बोलें",
    stopVoice: "रोकें",
    voiceUnsupported: "इस ब्राउज़र में आवाज़ इनपुट उपलब्ध नहीं है।",
    voiceHint: "भेजने से पहले आप लिखा हुआ ठीक कर सकते हैं।",
    contact: "आपकी जानकारी (वैकल्पिक)",
    yourName: "नाम",
    yourPhone: "फ़ोन",
    submit: "रिपोर्ट भेजें",
    submitting: "भेजी जा रही है…",
    submitError: "भेजी नहीं जा सकी। कनेक्शन जांचकर फिर कोशिश करें।",
    retry: "फिर कोशिश करें",
    received: "रिपोर्ट मिल गई",
    yourWords: "आपकी रिपोर्ट, आपके शब्दों में",
    operationalReading: "संचालन हेतु व्याख्या",
    reportId: "रिपोर्ट ID",
    submittedAt: "भेजी गई",
    newReport: "दूसरी रिपोर्ट भेजें",
    required: "आवश्यक",
  },
} as const;

export type UiStringKey = keyof (typeof UI_STRINGS)["en"];

/** Emergency type labels, translated for the citizen form. */
export const TYPE_LABEL_I18N: Record<Lang, Record<IncidentType, string>> = {
  en: {
    flood: "Flood / Water",
    fire: "Fire",
    road_accident: "Road Accident",
    industrial: "Gas / Chemical",
    medical: "Medical",
    building_collapse: "Building Collapse",
    other: "Other",
  },
  gu: {
    flood: "પૂર / પાણી",
    fire: "આગ",
    road_accident: "માર્ગ અકસ્માત",
    industrial: "ગેસ / રસાયણ",
    medical: "તબીબી",
    building_collapse: "મકાન ધરાશાયી",
    other: "અન્ય",
  },
  hi: {
    flood: "बाढ़ / पानी",
    fire: "आग",
    road_accident: "सड़क दुर्घटना",
    industrial: "गैस / रसायन",
    medical: "चिकित्सा",
    building_collapse: "इमारत गिरना",
    other: "अन्य",
  },
};

/** Report lifecycle stages shown on the receipt, in order. */
export const REPORT_STAGES = [
  { id: "received", label: "Received" },
  { id: "ai_triage", label: "AI Triage" },
  { id: "evidence_check", label: "Evidence Check" },
  { id: "incident_linked", label: "Incident Linked / New" },
  { id: "operational_review", label: "Operational Review" },
] as const;
