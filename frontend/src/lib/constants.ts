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
  1: "#2f8a67",
  2: "#e5a72e",
  3: "#d97534",
  4: "#e84d3d",
  5: "#8f2417",
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
  1: "#0d2a1d",
  2: "#3a2a08",
  3: "#3d1a0a",
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
  P1: "#e84d3d",
  P2: "#d97534",
  P3: "#e5a72e",
  P4: "#278ba8",
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
  new: "#e84d3d",
  triaged: "#d97534",
  dispatched: "#278ba8",
  on_scene: "#e5a72e",
  resolved: "#2f8a67",
  escalated: "#8f2417",
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
  available: "#2f8a67",
  assigned: "#278ba8",
  busy: "#d97534",
  offline: "#78877c",
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
  available: "#2f8a67",
  assigned: "#278ba8",
  en_route: "#278ba8",
  on_scene: "#e5a72e",
  busy: "#d97534",
  offline: "#78877c",
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
    color: "#a8b8aa",
    note: "Single source. Not yet corroborated.",
  },
  corroborated: {
    label: "CORROBORATED",
    color: "#278ba8",
    note: "Multiple independent sources agree.",
  },
  verified: {
    label: "VERIFIED",
    color: "#2f8a67",
    note: "Confirmed on the ground by a responder.",
  },
  conflicting: {
    label: "CONFLICTING",
    color: "#d97534",
    note: "Sources disagree. Needs human review.",
  },
};

export const DUPLICATE_STATE_META: Record<
  DuplicateState,
  { label: string; color: string }
> = {
  matched: { label: "MATCHED", color: "#278ba8" },
  possible_duplicate: { label: "POSSIBLE DUPLICATE", color: "#e5a72e" },
  review_required: { label: "REVIEW REQUIRED", color: "#d97534" },
};

/** Confidence thresholds. These are AI confidence, not certainty. */
export const CONFIDENCE_THRESHOLDS = { high: 0.8, review: 0.5 } as const;

export const CONFIDENCE_META: Record<
  ConfidenceBand,
  { label: string; color: string }
> = {
  high: { label: "HIGH CONFIDENCE", color: "#2f8a67" },
  review_advised: { label: "REVIEW ADVISED", color: "#e5a72e" },
  manual_required: { label: "MANUAL VERIFICATION REQUIRED", color: "#d97534" },
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
  critical: { label: "Critical", color: "#e84d3d" },
  sla_breach: { label: "SLA Breach", color: "#d97534" },
  escalation: { label: "Escalation", color: "#8f2417" },
  shortage: { label: "Shortage", color: "#e5a72e" },
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
  live: { label: "LIVE", color: "#2f8a67" },
  cached: { label: "CACHED", color: "#278ba8" },
  stale: { label: "STALE", color: "#d97534" },
  simulated: { label: "SIMULATED", color: "#7b6ba8" },
  unavailable: { label: "NO DATA", color: "#a8484f" },
};

export const SENSOR_HEALTH_META: Record<
  SensorHealth,
  { label: string; color: string }
> = {
  healthy: { label: "HEALTHY", color: "#2f8a67" },
  stale: { label: "STALE", color: "#d97534" },
  offline: { label: "OFFLINE", color: "#78877c" },
  anomalous: { label: "ANOMALOUS", color: "#e84d3d" },
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
      "Your browser is blocking location for this site. Allow it in the address-bar icon, or type the nearest landmark instead — your report still works.",
    /* A timeout or no fix at all, after the coarse retry. Distinct from a
       refusal: telling someone who granted permission that they denied it
       sends them to the one setting that is already correct. */
    locationUnavailable:
      "Could not get a location fix. Drop a pin on the map, or type the nearest landmark — your report still works.",
    /* Shown instead of locationDenied when the browser refused before it ever
       asked, because the page is not on HTTPS. Naming the real cause is the
       only way the person running it knows what to change. */
    locationInsecure:
      "This page is not on a secure (HTTPS) connection, so your browser blocks location. Type the nearest landmark instead — your report still works.",
    voiceInsecure:
      "Voice input needs a secure (HTTPS) connection. Type your description instead.",
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
    /* Shown under the button after dictation, because the description field it
       writes into is far up the form and off-screen on a phone. */
    voiceCaptured: "Added to your description:",
    voiceReview: "Review it",
    voiceNothingHeard: "Nothing was heard. Try again, or type your description.",
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
      "તમારું બ્રાઉઝર આ સાઇટ માટે સ્થાન બ્લૉક કરે છે. એડ્રેસ-બારના આઇકનમાંથી મંજૂરી આપો, અથવા નજીકનું સ્થળ લખો — તમારો રિપોર્ટ તો પણ કામ કરશે.",
    locationUnavailable:
      "સ્થાન મળી શક્યું નહીં. નકશા પર પિન મૂકો, અથવા નજીકનું સ્થળ લખો — તમારો રિપોર્ટ તો પણ કામ કરશે.",
    locationInsecure:
      "આ પેજ સુરક્ષિત (HTTPS) કનેક્શન પર નથી, તેથી બ્રાઉઝર સ્થાન બ્લૉક કરે છે. નજીકનું સ્થળ લખો — તમારો રિપોર્ટ તો પણ કામ કરશે.",
    voiceInsecure:
      "વોઇસ ઇનપુટ માટે સુરક્ષિત (HTTPS) કનેક્શન જરૂરી છે. તેને બદલે લખો.",
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
    voiceCaptured: "તમારા વર્ણનમાં ઉમેર્યું:",
    voiceReview: "તપાસો",
    voiceNothingHeard: "કંઈ સંભળાયું નહીં. ફરી પ્રયત્ન કરો, અથવા વર્ણન લખો.",
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
      "आपका ब्राउज़र इस साइट के लिए स्थान ब्लॉक कर रहा है। एड्रेस-बार के आइकन से अनुमति दें, या पास का लैंडमार्क लिखें — आपकी रिपोर्ट फिर भी जाएगी।",
    locationUnavailable:
      "स्थान का पता नहीं चल सका। मानचित्र पर पिन लगाएँ, या पास का लैंडमार्क लिखें — आपकी रिपोर्ट फिर भी जाएगी।",
    locationInsecure:
      "यह पेज सुरक्षित (HTTPS) कनेक्शन पर नहीं है, इसलिए ब्राउज़र स्थान ब्लॉक कर रहा है। पास का लैंडमार्क लिखें — रिपोर्ट फिर भी जाएगी।",
    voiceInsecure:
      "वॉइस इनपुट के लिए सुरक्षित (HTTPS) कनेक्शन चाहिए। इसके बजाय लिखें।",
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
    voiceCaptured: "आपके विवरण में जोड़ा गया:",
    voiceReview: "देखें",
    voiceNothingHeard: "कुछ सुनाई नहीं दिया। दोबारा कोशिश करें, या विवरण लिखें।",
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

/* ================================================================== */
/* Gujarat State Emergency Response Platform                           */
/* ================================================================== */

import type {
  ChainStatus,
  ConnectivityState,
  DisasterType,
  DistrictInfo,
  GroundTruthLevel,
  MapLayer,
  MissingStatus,
  ReliefKind,
  ReliefStatus,
  ReportKind,
  RiskLevel,
  ShelterStatus,
} from "@/types";

export const PLATFORM_NAME = "ResQNet";
export const PLATFORM_TAGLINE = "State Emergency Response Platform";
export const PLATFORM_MOTTO = ["PREPARE", "RESPOND", "RECOVER"] as const;
export const CONTROL_ROOM_LABEL = "State Control Room";

/* ------------------------------------------------------------------ */
/* Emergency comms utility bar                                         */
/* ------------------------------------------------------------------ */

/**
 * The always-visible strip. Order matches the state portal convention:
 * the three first-responder lines, then 112, then the helplines.
 */
/* `key` indexes PLATFORM_STRINGS[lang].helplines — the label is looked up at
   render time, because the ticker is on every route in all three languages.
   The numbers themselves are never translated. */
export const UTILITY_NUMBERS: { number: string; key: HelplineKey; icon: string }[] = [
  /* 112 leads. It is the single number that reaches all of the others, so it
     is the one to remember if the strip is only glanced at once. */
  { number: "112", key: "emergency", icon: "TriangleAlert" },
  { number: "100", key: "police", icon: "Shield" },
  { number: "101", key: "fire", icon: "Flame" },
  { number: "108", key: "ambulance", icon: "Ambulance" },
  { number: "1098", key: "child", icon: "Baby" },
  { number: "181", key: "women", icon: "UserRound" },
  { number: "1077", key: "disaster", icon: "Siren" },
];

/* ------------------------------------------------------------------ */
/* Districts                                                           */
/* ------------------------------------------------------------------ */

export const GUJARAT_DISTRICTS: DistrictInfo[] = [
  { id: "kutch", name: "Kutch", nameGu: "કચ્છ", nameHi: "कच्छ", lat: 23.7337, lng: 69.8597 },
  { id: "banaskantha", name: "Banaskantha", nameGu: "બનાસકાંઠા", nameHi: "बनासकांठा", lat: 24.1722, lng: 72.4383 },
  { id: "patan", name: "Patan", nameGu: "પાટણ", nameHi: "पाटण", lat: 23.8493, lng: 72.1266 },
  { id: "mehsana", name: "Mehsana", nameGu: "મહેસાણા", nameHi: "मेहसाणा", lat: 23.588, lng: 72.3693 },
  { id: "gandhinagar", name: "Gandhinagar", nameGu: "ગાંધીનગર", nameHi: "गांधीनगर", lat: 23.2156, lng: 72.6369 },
  { id: "ahmedabad", name: "Ahmedabad", nameGu: "અમદાવાદ", nameHi: "अहमदाबाद", lat: 23.0225, lng: 72.5714 },
  { id: "jamnagar", name: "Jamnagar", nameGu: "જામનગર", nameHi: "जामनगर", lat: 22.4707, lng: 70.0577 },
  { id: "rajkot", name: "Rajkot", nameGu: "રાજકોટ", nameHi: "राजकोट", lat: 22.3039, lng: 70.8022 },
  { id: "junagadh", name: "Junagadh", nameGu: "જૂનાગઢ", nameHi: "जूनागढ़", lat: 21.5222, lng: 70.4579 },
  { id: "amreli", name: "Amreli", nameGu: "અમરેલી", nameHi: "अमरेली", lat: 21.6032, lng: 71.2221 },
  { id: "bhavnagar", name: "Bhavnagar", nameGu: "ભાવનગર", nameHi: "भावनगर", lat: 21.7645, lng: 72.1519 },
  { id: "vadodara", name: "Vadodara", nameGu: "વડોદરા", nameHi: "वडोदरा", lat: 22.3072, lng: 73.1812 },
  { id: "bharuch", name: "Bharuch", nameGu: "ભરૂચ", nameHi: "भरूच", lat: 21.7051, lng: 72.9959 },
  { id: "narmada", name: "Narmada", nameGu: "નર્મદા", nameHi: "नर्मदा", lat: 21.87, lng: 73.5 },
  { id: "surat", name: "Surat", nameGu: "સુરત", nameHi: "सूरत", lat: 21.1702, lng: 72.8311 },
  { id: "navsari", name: "Navsari", nameGu: "નવસારી", nameHi: "नवसारी", lat: 20.9467, lng: 72.952 },
  { id: "valsad", name: "Valsad", nameGu: "વલસાડ", nameHi: "वलसाड", lat: 20.5992, lng: 72.9342 },
];

export const DISTRICT_NAMES = GUJARAT_DISTRICTS.map((d) => d.name);

export function districtById(id: string): DistrictInfo | undefined {
  return GUJARAT_DISTRICTS.find((d) => d.id === id);
}

export function districtByName(name: string): DistrictInfo | undefined {
  return GUJARAT_DISTRICTS.find((d) => d.name === name);
}

/**
 * The district whose centroid is closest to a point.
 *
 * Centroid distance, not a polygon test — ResQNet ships no district boundary
 * geometry, so this is an approximation and every surface that uses it says
 * so. Good enough to aim a shelter list at the right district; not good enough
 * to be called a location of record.
 */
export function nearestDistrict(lat: number, lng: number): DistrictInfo | undefined {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  let best: DistrictInfo | undefined;
  let bestDist = Infinity;
  for (const d of GUJARAT_DISTRICTS) {
    // Equirectangular is fine at this scale and avoids a trig-heavy haversine
    // for what is only ever a nearest-of-17 comparison.
    const dx = (lng - d.lng) * Math.cos(((lat + d.lat) / 2) * (Math.PI / 180));
    const dy = lat - d.lat;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = d;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Sidebar navigation                                                  */
/* ------------------------------------------------------------------ */

export const SIDEBAR_NAV: {
  href: string;
  key: string;
  icon: string;
}[] = [
  { href: "/", key: "home", icon: "Home" },
  { href: "/live-map", key: "liveMap", icon: "Map" },
  { href: "/incidents", key: "incidents", icon: "TriangleAlert" },
  { href: "/shelters", key: "shelters", icon: "House" },
  { href: "/resources", key: "resources", icon: "Boxes" },
  { href: "/missing-persons", key: "missing", icon: "UserSearch" },
  { href: "/volunteers", key: "volunteers", icon: "Users" },
  { href: "/report", key: "reports", icon: "FileText" },
  { href: "/weather", key: "weather", icon: "CloudRain" },
  { href: "/support", key: "support", icon: "LifeBuoy" },
];

/* ------------------------------------------------------------------ */
/* Risk levels                                                         */
/* ------------------------------------------------------------------ */

/**
 * Ordinal ramp. Because adjacent steps are not reliably separable by colour
 * alone (amber vs orange), every risk indicator in the UI carries its text
 * label as well - colour is never the only channel.
 */
export const RISK_META: Record<
  RiskLevel,
  { label: string; color: string; fill: string; rank: number }
> = {
  normal: { label: "NORMAL", color: "#2f8a67", fill: "rgba(47,138,103,0.20)", rank: 0 },
  watch: { label: "WATCH", color: "#b8841f", fill: "rgba(229,167,46,0.24)", rank: 1 },
  moderate: { label: "MODERATE", color: "#d97534", fill: "rgba(217,117,52,0.26)", rank: 2 },
  high: { label: "HIGH", color: "#e84d3d", fill: "rgba(232,77,61,0.28)", rank: 3 },
  critical: { label: "CRITICAL", color: "#8f2417", fill: "rgba(143,36,23,0.38)", rank: 4 },
};

export const RISK_ORDER: RiskLevel[] = ["normal", "watch", "moderate", "high", "critical"];

/* ------------------------------------------------------------------ */
/* Disaster types                                                      */
/* ------------------------------------------------------------------ */

export const DISASTER_META: Record<
  DisasterType,
  { label: string; icon: string; color: string }
> = {
  cyclone: { label: "Cyclone", icon: "Tornado", color: "#b51f32" },
  flood: { label: "Flood", icon: "Waves", color: "#2677b5" },
  fire: { label: "Fire", icon: "Flame", color: "#d9600f" },
  earthquake: { label: "Earthquake", icon: "Activity", color: "#8a5a1f" },
  medical: { label: "Medical", icon: "HeartPulse", color: "#d63a3a" },
  road_block: { label: "Road Block", icon: "Construction", color: "#d89a25" },
  infrastructure: { label: "Infrastructure Damage", icon: "Building2", color: "#5f7280" },
  missing_person: { label: "Missing Person", icon: "UserSearch", color: "#1a6e63" },
  heavy_rainfall: { label: "Heavy Rainfall", icon: "CloudRain", color: "#2677b5" },
  other: { label: "Other", icon: "CircleHelp", color: "#5f7280" },
};

/** The nine types a citizen can pick on the SOS form, in order. */
export const SOS_DISASTER_TYPES: DisasterType[] = [
  "flood",
  "cyclone",
  "fire",
  "earthquake",
  "medical",
  "road_block",
  "infrastructure",
  "missing_person",
  "other",
];

/* ------------------------------------------------------------------ */
/* Map layers                                                          */
/* ------------------------------------------------------------------ */

export const MAP_LAYER_META: Record<MapLayer, { label: string; color: string }> = {
  cyclone: { label: "Cyclone", color: "#b51f32" },
  flood: { label: "Flood", color: "#2677b5" },
  fire: { label: "Fire", color: "#d9600f" },
  heavy_rainfall: { label: "Heavy Rainfall", color: "#2677b5" },
  warning: { label: "Alerts", color: "#d89a25" },
  shelter: { label: "Shelters", color: "#32805d" },
  hospital: { label: "Hospitals", color: "#d63a3a" },
  response_team: { label: "Response Teams", color: "#1a6e63" },
  blocked_road: { label: "Blocked Roads", color: "#a05c27" },
  citizen_report: { label: "Citizen Reports", color: "#6b5f9e" },
};

/** Layers shown by default so the first paint is not overwhelming. */
export const DEFAULT_MAP_LAYERS: MapLayer[] = [
  "cyclone",
  "flood",
  "fire",
  "warning",
  "shelter",
];

/* ------------------------------------------------------------------ */
/* Ground truth / ResQ Chain                                           */
/* ------------------------------------------------------------------ */

export const GROUND_TRUTH_META: Record<
  GroundTruthLevel,
  { label: string; color: string; note: string }
> = {
  unverified: {
    label: "UNVERIFIED",
    color: "#78877c",
    note: "Submitted by a citizen. Nobody has confirmed it yet.",
  },
  community_confirmed: {
    label: "COMMUNITY CONFIRMED",
    color: "#278ba8",
    note: "Other people nearby reported the same thing. Not yet checked by an authority.",
  },
  authority_verified: {
    label: "AUTHORITY VERIFIED",
    color: "#2f8a67",
    note: "Confirmed by a responding unit or district authority.",
  },
};

export const CHAIN_STAGES = [
  { id: "reported", label: "Report" },
  { id: "verified", label: "Verify" },
  { id: "responding", label: "Respond" },
  { id: "resolved", label: "Resolve" },
] as const;

export const CHAIN_STATUS_META: Record<
  ChainStatus,
  { label: string; stage: string; color: string }
> = {
  unverified: { label: "Unverified", stage: "reported", color: "#78877c" },
  community_confirmed: { label: "Community Confirmed", stage: "verified", color: "#278ba8" },
  authority_verified: { label: "Authority Verified", stage: "verified", color: "#2f8a67" },
  assigned: { label: "Assigned", stage: "responding", color: "#1f7690" },
  response_en_route: { label: "Response En Route", stage: "responding", color: "#b8841f" },
  resolved: { label: "Resolved", stage: "resolved", color: "#2f8a67" },
};

export const CHAIN_STATUS_ORDER: ChainStatus[] = [
  "unverified",
  "community_confirmed",
  "authority_verified",
  "assigned",
  "response_en_route",
  "resolved",
];

/* ------------------------------------------------------------------ */
/* Shelters                                                            */
/* ------------------------------------------------------------------ */

export const SHELTER_STATUS_META: Record<
  ShelterStatus,
  { label: string; color: string }
> = {
  open: { label: "Open", color: "#2f8a67" },
  near_capacity: { label: "Near Capacity", color: "#b8841f" },
  full: { label: "Full", color: "#e84d3d" },
  closed: { label: "Closed", color: "#78877c" },
};

/* ------------------------------------------------------------------ */
/* Relief / volunteers                                                 */
/* ------------------------------------------------------------------ */

export const RELIEF_KIND_META: Record<ReliefKind, { label: string; icon: string }> = {
  food: { label: "Food", icon: "Utensils" },
  water: { label: "Water", icon: "Droplets" },
  medical: { label: "Medical", icon: "BriefcaseMedical" },
  rescue: { label: "Rescue", icon: "LifeBuoy" },
  transport: { label: "Transport", icon: "Truck" },
};

export const RELIEF_STATUS_META: Record<ReliefStatus, { label: string; color: string }> = {
  open: { label: "Open", color: "#e84d3d" },
  claimed: { label: "Claimed", color: "#b8841f" },
  in_transit: { label: "In Transit", color: "#1f7690" },
  delivered: { label: "Delivered", color: "#2f8a67" },
};

/* ------------------------------------------------------------------ */
/* Missing persons                                                     */
/* ------------------------------------------------------------------ */

export const MISSING_STATUS_META: Record<
  MissingStatus,
  { label: string; color: string }
> = {
  missing: { label: "Missing", color: "#e84d3d" },
  potential_match: { label: "Potential Match", color: "#b8841f" },
  located: { label: "Located", color: "#1f7690" },
  reunited: { label: "Reunited", color: "#2f8a67" },
};

/* ------------------------------------------------------------------ */
/* Reports suite                                                       */
/* ------------------------------------------------------------------ */

export const REPORT_KIND_META: Record<
  ReportKind,
  { label: string; description: string }
> = {
  situation: {
    label: "Situation Report",
    description: "State-wide picture for a given period.",
  },
  incident: {
    label: "Incident Report",
    description: "A single incident from report to resolution.",
  },
  district: {
    label: "District Report",
    description: "One district's incidents, shelters and resources.",
  },
  response_performance: {
    label: "Response Performance",
    description: "Dispatch and on-scene times against targets.",
  },
  resource: {
    label: "Resource Report",
    description: "Utilisation, shortages and deployment.",
  },
  after_action: {
    label: "After-Action Report",
    description: "What happened, what worked, what to change.",
  },
};

/* ------------------------------------------------------------------ */
/* Connectivity                                                        */
/* ------------------------------------------------------------------ */

export const CONNECTIVITY_META: Record<
  ConnectivityState,
  { label: string; color: string; note: string }
> = {
  online: { label: "ONLINE", color: "#2f8a67", note: "Connected to the state control room." },
  low: {
    label: "LOW CONNECTIVITY",
    color: "#b8841f",
    note: "Weak connection. Submissions may take longer and will be queued if they fail.",
  },
  offline: {
    label: "OFFLINE",
    color: "#e84d3d",
    note: "No connection. Anything you submit is saved on this device and sent when you are back online.",
  },
};

/** Special assistance options offered on the SOS form. */
export const SPECIAL_ASSISTANCE = [
  { id: "elderly", label: "Elderly" },
  { id: "child", label: "Child" },
  { id: "wheelchair", label: "Wheelchair" },
  { id: "medical", label: "Medical Assistance" },
  { id: "other", label: "Other" },
] as const;

export type SpecialAssistance = (typeof SPECIAL_ASSISTANCE)[number]["id"];

/* ------------------------------------------------------------------ */
/* Platform UI strings (en / gu / hi)                                  */
/* ------------------------------------------------------------------ */

export const PLATFORM_STRINGS = {
  en: {
    tagline: "State Emergency Response Platform",
    platformName: "ResQNet — Emergency Response Network",
    platformSubtitle: "Integrated Disaster Response & Public Safety Platform",
    motto: "Prepare · Respond · Recover",
    saferTogether: "A Safer State Together",
    railCreed: ["People", "Prepared", "Communities", "Resilient"],
    controlRoom: "State Control Room",
    /* Who is looking at this. The public portal is the citizen's; the
       control room identity belongs to the operator console. */
    citizen: "Citizen",
    citizenSub: "Public portal",
    online: "Online",
    searchPlaceholder: "Search location, district, incident or resource...",
    reportEmergency: "Report an Emergency",
    imSafe: "I'm Safe",
    imSafeSub: "Let your family know you are safe",
    liveAlerts: "Live Alerts",
    nearestShelters: "Nearest Shelters",
    viewAll: "View All",
    resqPulse: "ResQ Pulse",
    dispatchLogs: "Live Dispatch & Logs",
    radarForecast: "Regional Radar & Forecast",
    activeIncidents: "Active Incidents",
    sheltersOpen: "Shelters Open",
    responseTeams: "Response Teams",
    nav: {
      home: "Home",
      liveMap: "Live Map",
      incidents: "Incidents",
      shelters: "Shelters",
      resources: "Resources",
      missing: "Missing Persons",
      volunteers: "Volunteers",
      reports: "Reports",
      weather: "Weather",
      support: "Support",
    },
    /* Frame chrome that sits on every route: the skip link, the rail's
       heading and the hazard strip's search affordance. */
    chrome: {
      skipToContent: "Skip to main content",
      menu: "Menu",
      searchMap: "Search map",
      searchTheMap: "Search the map",
      searchStatePicture: "Search the state picture",
    },
    /* The helpline ticker. The numbers themselves never translate. */
    helplines: {
      emergency: "EMERGENCY",
      police: "POLICE",
      fire: "FIRE",
      ambulance: "AMBULANCE",
      child: "CHILD HELPLINE",
      women: "WOMEN HELPLINE",
      disaster: "DISASTER HELPLINE",
      call: "Call",
      on: "on",
      regionLabel: "Emergency helpline numbers",
    },
    /* Hazard strip. Shown as tooltip and to screen readers, not as body text. */
    hazards: {
      cyclone: "Cyclone",
      flood: "Flood",
      fire: "Fire",
      rainfall: "Heavy Rainfall",
      landslide: "Landslide",
      medical: "Medical",
      industrial: "Industrial",
      road: "Road Accident",
      collapse: "Building Collapse",
      shelter: "Shelters",
      response: "Emergency Response",
      infra: "Infrastructure",
    },
    /* Disaster types and map layers, keyed so any surface can translate them
       without reshaping DISASTER_META / MAP_LAYER_META, which carry icons and
       colours that never change with language. */
    disasters: {
      cyclone: "Cyclone",
      flood: "Flood",
      fire: "Fire",
      earthquake: "Earthquake",
      medical: "Medical",
      road_block: "Road Block",
      infrastructure: "Infrastructure Damage",
      missing_person: "Missing Person",
      heavy_rainfall: "Heavy Rainfall",
      other: "Other",
    },
    mapLayers: {
      cyclone: "Cyclone",
      flood: "Flood",
      fire: "Fire",
      heavy_rainfall: "Heavy Rainfall",
      warning: "Alerts",
      shelter: "Shelters",
      hospital: "Hospitals",
      response_team: "Response Teams",
      blocked_road: "Blocked Roads",
      citizen_report: "Citizen Reports",
    },
    connectivity: { online: "Online", weak: "Weak signal", offline: "Offline" },
    basemap: { map: "Map", satellite: "Satellite", hybrid: "Hybrid", grid: "Grid", layers: "Layers" },
    risk: { normal: "NORMAL", watch: "WATCH", moderate: "MODERATE", high: "HIGH", critical: "CRITICAL", districtRisk: "District risk" },
    footer: {
      authority: "State Disaster Management Authority",
      eoc: "Emergency Operations Centre",
      operatorConsole: "Operator console",
      linksLeave: "These links leave ResQNet.",
      disclaimer:
        "ResQNet coordinates emergency response. It does not replace calling 112. AI-assisted classification on this platform is advisory — operational decisions are made by authorised personnel.",
    },
  },
  gu: {
    tagline: "રાજ્ય કટોકટી પ્રતિસાદ પ્લેટફોર્મ",
    platformName: "ResQNet — કટોકટી પ્રતિસાદ નેટવર્ક",
    platformSubtitle: "સમેકિત આપત્તિ પ્રતિસાદ અને જનસલામતી પ્લેટફોર્મ",
    motto: "તૈયારી · પ્રતિસાદ · પુનર્વસન",
    saferTogether: "સુરક્ષિત રાજ્ય, સાથે મળીને",
    railCreed: ["લોકો", "તૈયાર", "સમુદાય", "સક્ષમ"],
    controlRoom: "રાજ્ય કંટ્રોલ રૂમ",
    citizen: "નાગરિક",
    citizenSub: "જાહેર પોર્ટલ",
    online: "ઓનલાઇન",
    searchPlaceholder: "સ્થળ, જિલ્લો, ઘટના અથવા સંસાધન શોધો...",
    reportEmergency: "કટોકટીની જાણ કરો",
    imSafe: "હું સુરક્ષિત છું",
    imSafeSub: "તમારા પરિવારને જણાવો કે તમે સુરક્ષિત છો",
    liveAlerts: "લાઇવ ચેતવણીઓ",
    nearestShelters: "નજીકના આશ્રયસ્થાનો",
    viewAll: "બધું જુઓ",
    resqPulse: "ResQ પલ્સ",
    dispatchLogs: "લાઇવ ડિસ્પેચ અને લોગ",
    radarForecast: "પ્રાદેશિક રડાર અને આગાહી",
    activeIncidents: "સક્રિય ઘટનાઓ",
    sheltersOpen: "ખુલ્લા આશ્રયસ્થાનો",
    responseTeams: "પ્રતિસાદ ટીમો",
    nav: {
      home: "હોમ",
      liveMap: "લાઇવ નકશો",
      incidents: "ઘટનાઓ",
      shelters: "આશ્રયસ્થાનો",
      resources: "સંસાધનો",
      missing: "ગુમ થયેલ વ્યક્તિઓ",
      volunteers: "સ્વયંસેવકો",
      reports: "અહેવાલો",
      weather: "હવામાન",
      support: "સહાય",
    },
    chrome: {
      skipToContent: "મુખ્ય સામગ્રી પર જાઓ",
      menu: "મેનુ",
      searchMap: "નકશો શોધો",
      searchTheMap: "નકશામાં શોધો",
      searchStatePicture: "રાજ્યનું ચિત્ર શોધો",
    },
    helplines: {
      emergency: "કટોકટી",
      police: "પોલીસ",
      fire: "ફાયર",
      ambulance: "એમ્બ્યુલન્સ",
      child: "ચાઇલ્ડ હેલ્પલાઇન",
      women: "મહિલા હેલ્પલાઇન",
      disaster: "આપત્તિ હેલ્પલાઇન",
      call: "કૉલ કરો",
      on: "પર",
      regionLabel: "કટોકટી હેલ્પલાઇન નંબર",
    },
    hazards: {
      cyclone: "વાવાઝોડું",
      flood: "પૂર",
      fire: "આગ",
      rainfall: "ભારે વરસાદ",
      landslide: "ભૂસ્ખલન",
      medical: "તબીબી",
      industrial: "ઔદ્યોગિક",
      road: "માર્ગ અકસ્માત",
      collapse: "ઇમારત ધરાશાયી",
      shelter: "આશ્રયસ્થાનો",
      response: "કટોકટી પ્રતિસાદ",
      infra: "માળખાકીય સુવિધા",
    },
    disasters: {
      cyclone: "વાવાઝોડું",
      flood: "પૂર",
      fire: "આગ",
      earthquake: "ભૂકંપ",
      medical: "તબીબી",
      road_block: "માર્ગ અવરોધ",
      infrastructure: "માળખાકીય નુકસાન",
      missing_person: "ગુમ થયેલ વ્યક્તિ",
      heavy_rainfall: "ભારે વરસાદ",
      other: "અન્ય",
    },
    mapLayers: {
      cyclone: "વાવાઝોડું",
      flood: "પૂર",
      fire: "આગ",
      heavy_rainfall: "ભારે વરસાદ",
      warning: "ચેતવણીઓ",
      shelter: "આશ્રયસ્થાનો",
      hospital: "હોસ્પિટલો",
      response_team: "પ્રતિસાદ ટીમો",
      blocked_road: "અવરોધિત માર્ગો",
      citizen_report: "નાગરિક અહેવાલો",
    },
    connectivity: { online: "ઓનલાઇન", weak: "નબળું સિગ્નલ", offline: "ઓફલાઇન" },
    basemap: { map: "નકશો", satellite: "સેટેલાઇટ", hybrid: "હાઇબ્રિડ", grid: "ગ્રીડ", layers: "સ્તરો" },
    risk: { normal: "સામાન્ય", watch: "નજર", moderate: "મધ્યમ", high: "ઊંચું", critical: "ગંભીર", districtRisk: "જિલ્લા જોખમ" },
    footer: {
      authority: "રાજ્ય આપત્તિ વ્યવસ્થાપન સત્તામંડળ",
      eoc: "કટોકટી કામગીરી કેન્દ્ર",
      operatorConsole: "ઓપરેટર કન્સોલ",
      linksLeave: "આ લિંક ResQNet ની બહાર લઈ જાય છે.",
      disclaimer:
        "ResQNet કટોકટી પ્રતિસાદનું સંકલન કરે છે. તે 112 પર કૉલ કરવાનો વિકલ્પ નથી. આ પ્લેટફોર્મ પરનું AI-સહાયિત વર્ગીકરણ સલાહરૂપ છે — કામગીરીના નિર્ણયો અધિકૃત કર્મચારીઓ દ્વારા લેવાય છે.",
    },
  },
  hi: {
    tagline: "राज्य आपातकालीन प्रतिक्रिया मंच",
    platformName: "ResQNet — आपातकालीन प्रतिक्रिया नेटवर्क",
    platformSubtitle: "एकीकृत आपदा प्रतिक्रिया और जन सुरक्षा प्लेटफ़ॉर्म",
    motto: "तैयारी · प्रतिक्रिया · पुनर्भरण",
    saferTogether: "सुरक्षित राज्य, साथ मिलकर",
    railCreed: ["लोग", "तैयार", "समुदाय", "सक्षम"],
    controlRoom: "राज्य कंट्रोल रूम",
    citizen: "नागरिक",
    citizenSub: "सार्वजनिक पोर्टल",
    online: "ऑनलाइन",
    searchPlaceholder: "स्थान, जिला, घटना या संसाधन खोजें...",
    reportEmergency: "आपातकाल की सूचना दें",
    imSafe: "मैं सुरक्षित हूँ",
    imSafeSub: "अपने परिवार को बताएं कि आप सुरक्षित हैं",
    liveAlerts: "लाइव चेतावनियाँ",
    nearestShelters: "निकटतम आश्रय",
    viewAll: "सभी देखें",
    resqPulse: "ResQ पल्स",
    dispatchLogs: "लाइव डिस्पैच और लॉग",
    radarForecast: "क्षेत्रीय रडार और पूर्वानुमान",
    activeIncidents: "सक्रिय घटनाएँ",
    sheltersOpen: "खुले आश्रय",
    responseTeams: "प्रतिक्रिया टीमें",
    nav: {
      home: "होम",
      liveMap: "लाइव मानचित्र",
      incidents: "घटनाएँ",
      shelters: "आश्रय",
      resources: "संसाधन",
      missing: "लापता व्यक्ति",
      volunteers: "स्वयंसेवक",
      reports: "रिपोर्ट",
      weather: "मौसम",
      support: "सहायता",
    },
    chrome: {
      skipToContent: "मुख्य सामग्री पर जाएँ",
      menu: "मेनू",
      searchMap: "मानचित्र खोजें",
      searchTheMap: "मानचित्र में खोजें",
      searchStatePicture: "राज्य की स्थिति खोजें",
    },
    helplines: {
      emergency: "आपातकाल",
      police: "पुलिस",
      fire: "अग्निशमन",
      ambulance: "एम्बुलेंस",
      child: "चाइल्ड हेल्पलाइन",
      women: "महिला हेल्पलाइन",
      disaster: "आपदा हेल्पलाइन",
      call: "कॉल करें",
      on: "पर",
      regionLabel: "आपातकालीन हेल्पलाइन नंबर",
    },
    hazards: {
      cyclone: "चक्रवात",
      flood: "बाढ़",
      fire: "आग",
      rainfall: "भारी वर्षा",
      landslide: "भूस्खलन",
      medical: "चिकित्सा",
      industrial: "औद्योगिक",
      road: "सड़क दुर्घटना",
      collapse: "इमारत ढहना",
      shelter: "आश्रय",
      response: "आपातकालीन प्रतिक्रिया",
      infra: "अवसंरचना",
    },
    disasters: {
      cyclone: "चक्रवात",
      flood: "बाढ़",
      fire: "आग",
      earthquake: "भूकंप",
      medical: "चिकित्सा",
      road_block: "मार्ग अवरोध",
      infrastructure: "अवसंरचना क्षति",
      missing_person: "लापता व्यक्ति",
      heavy_rainfall: "भारी वर्षा",
      other: "अन्य",
    },
    mapLayers: {
      cyclone: "चक्रवात",
      flood: "बाढ़",
      fire: "आग",
      heavy_rainfall: "भारी वर्षा",
      warning: "चेतावनियाँ",
      shelter: "आश्रय",
      hospital: "अस्पताल",
      response_team: "प्रतिक्रिया टीमें",
      blocked_road: "अवरुद्ध मार्ग",
      citizen_report: "नागरिक रिपोर्ट",
    },
    connectivity: { online: "ऑनलाइन", weak: "कमज़ोर सिग्नल", offline: "ऑफ़लाइन" },
    basemap: { map: "मानचित्र", satellite: "सैटेलाइट", hybrid: "हाइब्रिड", grid: "ग्रिड", layers: "परतें" },
    risk: { normal: "सामान्य", watch: "निगरानी", moderate: "मध्यम", high: "उच्च", critical: "गंभीर", districtRisk: "ज़िला जोखिम" },
    footer: {
      authority: "राज्य आपदा प्रबंधन प्राधिकरण",
      eoc: "आपातकालीन संचालन केंद्र",
      operatorConsole: "ऑपरेटर कंसोल",
      linksLeave: "ये लिंक ResQNet से बाहर ले जाते हैं।",
      disclaimer:
        "ResQNet आपातकालीन प्रतिक्रिया का समन्वय करता है। यह 112 पर कॉल करने का विकल्प नहीं है। इस प्लेटफ़ॉर्म पर AI-सहायित वर्गीकरण सलाहकारी है — परिचालन निर्णय अधिकृत कर्मियों द्वारा लिए जाते हैं।",
    },
  },
} as const;

export type NavKey = keyof (typeof PLATFORM_STRINGS)["en"]["nav"];
export type HelplineKey = keyof Omit<
  (typeof PLATFORM_STRINGS)["en"]["helplines"],
  "call" | "on" | "regionLabel"
>;
export type HazardKey = keyof (typeof PLATFORM_STRINGS)["en"]["hazards"];

/**
 * Localised names for the two metadata tables above.
 *
 * DISASTER_META and MAP_LAYER_META keep their English `label` because they
 * also carry icons and colours, which never change with language and are read
 * by callers that have no `lang` in scope. These helpers are the translated
 * read path: pass the language you are rendering in and you get the label for
 * it, falling back to the English one if a key is ever missing.
 */
export function disasterLabel(d: DisasterType, lang: Lang): string {
  return PLATFORM_STRINGS[lang].disasters[d] ?? DISASTER_META[d].label;
}

export function mapLayerLabel(l: MapLayer, lang: Lang): string {
  return PLATFORM_STRINGS[lang].mapLayers[l] ?? MAP_LAYER_META[l].label;
}

export function riskLabel(r: RiskLevel, lang: Lang): string {
  return PLATFORM_STRINGS[lang].risk[r] ?? RISK_META[r].label;
}
