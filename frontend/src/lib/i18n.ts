/**
 * Translations for the platform's enumerated labels.
 *
 * `constants.ts` holds one metadata object per enum — `VERIFICATION_META`,
 * `DATA_MODE_META`, `SEVERITY_LABEL` and around twenty more — each carrying an
 * English `label` alongside the colour, icon and rank that the UI also needs.
 * Those objects are read by roughly every component in the app, most of them
 * from call sites with no language in scope, which is why switching to
 * Gujarati still left `UNVERIFIED`, `SIMULATED` and `CRITICAL RISK` sitting in
 * English on an otherwise translated page.
 *
 * Rather than thread a language through every metadata lookup, the labels are
 * mirrored here, keyed by the same enum members. The metadata objects keep
 * their English text — it is the fallback, and several non-visual consumers
 * (sorting, CSV export, the operator's own shorthand) depend on it — and a
 * component that has a language calls `labels(lang)` instead.
 *
 * The rule when adding an enum member: add it here too. The `Record` types
 * make that a compile error rather than a silent English leak.
 */

import type {
  AlertKind,
  AssignmentStatus,
  ChainStatus,
  ConfidenceBand,
  DataMode,
  DuplicateState,
  GroundTruthLevel,
  Hazard,
  IncidentStatus,
  Lang,
  MissingStatus,
  Priority,
  QuickAction,
  ReliefKind,
  ReliefStatus,
  ReportKind,
  ReportSource,
  ResourceKind,
  ResourceStatus,
  RoadAccess,
  SensorHealth,
  Severity,
  ShelterStatus,
  VerificationStatus,
} from "@/types";
import type { CHAIN_STAGES, ResourceViewStatus } from "./constants";

interface EnumLabels {
  severity: Record<Severity, string>;
  priority: Record<Priority, string>;
  incidentStatus: Record<IncidentStatus, string>;
  resourceKind: Record<ResourceKind, string>;
  resourceStatus: Record<ResourceStatus, string>;
  resourceViewStatus: Record<ResourceViewStatus, string>;
  assignmentStatus: Record<AssignmentStatus, string>;
  verification: Record<VerificationStatus, string>;
  /** The tooltip under each verification badge — why the state was assigned. */
  verificationNote: Record<VerificationStatus, string>;
  duplicate: Record<DuplicateState, string>;
  confidence: Record<ConfidenceBand, string>;
  hazard: Record<Hazard, string>;
  source: Record<ReportSource, string>;
  alertKind: Record<AlertKind, string>;
  /** The field responder's one-tap signals to the control room. */
  quickAction: Record<QuickAction, string>;
  dataMode: Record<DataMode, string>;
  sensorHealth: Record<SensorHealth, string>;
  roadAccess: Record<RoadAccess, string>;
  /** Citizen-facing trust ladder shown on incidents and the report receipt. */
  groundTruth: Record<GroundTruthLevel, string>;
  groundTruthNote: Record<GroundTruthLevel, string>;
  chainStatus: Record<ChainStatus, string>;
  chainStage: Record<(typeof CHAIN_STAGES)[number]["id"], string>;
  shelterStatus: Record<ShelterStatus, string>;
  reliefKind: Record<ReliefKind, string>;
  reliefStatus: Record<ReliefStatus, string>;
  missingStatus: Record<MissingStatus, string>;
  reportKind: Record<ReportKind, string>;
  reportKindNote: Record<ReportKind, string>;
}

const en: EnumLabels = {
  severity: {
    1: "Minor",
    2: "Moderate",
    3: "Serious",
    4: "Severe",
    5: "Catastrophic",
  },
  priority: {
    P1: "P1 — Immediate",
    P2: "P2 — Urgent",
    P3: "P3 — Standard",
    P4: "P4 — Routine",
  },
  incidentStatus: {
    new: "New",
    triaged: "Triaged",
    dispatched: "Dispatched",
    on_scene: "On Scene",
    resolved: "Resolved",
    escalated: "Escalated",
  },
  resourceKind: {
    ambulance: "Ambulance",
    fire_truck: "Fire Unit",
    rescue_boat: "Rescue Boat",
    police: "Police",
    ndrf_team: "Rescue Team",
    hazmat: "Hazmat",
  },
  resourceStatus: {
    available: "Available",
    assigned: "Assigned",
    busy: "Busy",
    offline: "Offline",
  },
  resourceViewStatus: {
    available: "Available",
    assigned: "Assigned",
    en_route: "En Route",
    on_scene: "On Scene",
    busy: "Busy",
    offline: "Offline",
  },
  assignmentStatus: {
    assigned: "Assigned",
    en_route: "En Route",
    on_scene: "On Scene",
    completed: "Completed",
    cancelled: "Cancelled",
  },
  verification: {
    unverified: "UNVERIFIED",
    corroborated: "CORROBORATED",
    verified: "VERIFIED",
    conflicting: "CONFLICTING",
  },
  verificationNote: {
    unverified: "Single source. Not yet corroborated.",
    corroborated: "Multiple independent sources agree.",
    verified: "Confirmed on the ground by a responder.",
    conflicting: "Sources disagree. Needs human review.",
  },
  duplicate: {
    matched: "MATCHED",
    possible_duplicate: "POSSIBLE DUPLICATE",
    review_required: "REVIEW REQUIRED",
  },
  confidence: {
    high: "HIGH CONFIDENCE",
    review_advised: "REVIEW ADVISED",
    manual_required: "MANUAL VERIFICATION REQUIRED",
  },
  hazard: {
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
  },
  source: {
    citizen: "Citizen",
    call: "112 Call",
    sensor: "Sensor",
    field: "Field",
  },
  alertKind: {
    critical: "Critical",
    sla_breach: "SLA Breach",
    escalation: "Escalation",
    shortage: "Shortage",
  },
  quickAction: {
    situation_worse: "Situation Worse",
    situation_stable: "Situation Stable",
    wrong_location: "Wrong Location",
    road_blocked: "Road Blocked",
    need_ambulance: "Need Ambulance",
    need_fire: "Need Fire",
    need_rescue: "Need Rescue",
    need_hazmat: "Need Hazmat",
    unable_to_reach: "Unable To Reach",
  },
  dataMode: {
    live: "LIVE",
    cached: "CACHED",
    stale: "STALE",
    simulated: "SIMULATED",
    unavailable: "NO DATA",
  },
  sensorHealth: {
    healthy: "HEALTHY",
    stale: "STALE",
    offline: "OFFLINE",
    anomalous: "ANOMALOUS",
  },
  roadAccess: {
    clear: "Clear",
    partially_blocked: "Partially Blocked",
    blocked: "Blocked",
    unknown: "Unknown",
  },
  groundTruth: {
    unverified: "UNVERIFIED",
    community_confirmed: "COMMUNITY CONFIRMED",
    authority_verified: "AUTHORITY VERIFIED",
  },
  groundTruthNote: {
    unverified: "Submitted by a citizen. Nobody has confirmed it yet.",
    community_confirmed:
      "Other people nearby reported the same thing. Not yet checked by an authority.",
    authority_verified: "Confirmed by a responding unit or district authority.",
  },
  chainStatus: {
    unverified: "Unverified",
    community_confirmed: "Community Confirmed",
    authority_verified: "Authority Verified",
    assigned: "Assigned",
    response_en_route: "Response En Route",
    resolved: "Resolved",
  },
  chainStage: {
    reported: "Report",
    verified: "Verify",
    responding: "Respond",
    resolved: "Resolve",
  },
  shelterStatus: {
    open: "Open",
    near_capacity: "Near Capacity",
    full: "Full",
    closed: "Closed",
  },
  reliefKind: {
    food: "Food",
    water: "Water",
    medical: "Medical",
    rescue: "Rescue",
    transport: "Transport",
  },
  reliefStatus: {
    open: "Open",
    claimed: "Claimed",
    in_transit: "In Transit",
    delivered: "Delivered",
  },
  missingStatus: {
    missing: "Missing",
    potential_match: "Potential Match",
    located: "Located",
    reunited: "Reunited",
  },
  reportKind: {
    situation: "Situation Report",
    incident: "Incident Report",
    district: "District Report",
    response_performance: "Response Performance",
    resource: "Resource Report",
    after_action: "After-Action Report",
  },
  reportKindNote: {
    situation: "State-wide picture for a given period.",
    incident: "A single incident from report to resolution.",
    district: "One district's incidents, shelters and resources.",
    response_performance: "Dispatch and on-scene times against targets.",
    resource: "Utilisation, shortages and deployment.",
    after_action: "What happened, what worked, what to change.",
  },
};

const gu: EnumLabels = {
  severity: {
    1: "ગૌણ",
    2: "મધ્યમ",
    3: "ગંભીર",
    4: "અતિ ગંભીર",
    5: "વિનાશક",
  },
  priority: {
    P1: "P1 — તાત્કાલિક",
    P2: "P2 — તાકીદનું",
    P3: "P3 — સામાન્ય",
    P4: "P4 — નિયમિત",
  },
  incidentStatus: {
    new: "નવું",
    triaged: "વર્ગીકૃત",
    dispatched: "રવાના",
    on_scene: "ઘટનાસ્થળે",
    resolved: "ઉકેલાયું",
    escalated: "ઉચ્ચ સ્તરે",
  },
  resourceKind: {
    ambulance: "એમ્બ્યુલન્સ",
    fire_truck: "ફાયર યુનિટ",
    rescue_boat: "બચાવ બોટ",
    police: "પોલીસ",
    ndrf_team: "બચાવ ટુકડી",
    hazmat: "જોખમી પદાર્થ",
  },
  resourceStatus: {
    available: "ઉપલબ્ધ",
    assigned: "સોંપાયેલ",
    busy: "વ્યસ્ત",
    offline: "ઑફલાઇન",
  },
  resourceViewStatus: {
    available: "ઉપલબ્ધ",
    assigned: "સોંપાયેલ",
    en_route: "માર્ગ પર",
    on_scene: "ઘટનાસ્થળે",
    busy: "વ્યસ્ત",
    offline: "ઑફલાઇન",
  },
  assignmentStatus: {
    assigned: "સોંપાયેલ",
    en_route: "માર્ગ પર",
    on_scene: "ઘટનાસ્થળે",
    completed: "પૂર્ણ",
    cancelled: "રદ",
  },
  verification: {
    unverified: "ચકાસાયેલ નથી",
    corroborated: "સમર્થિત",
    verified: "ચકાસાયેલ",
    conflicting: "વિરોધાભાસી",
  },
  verificationNote: {
    unverified: "એક જ સ્રોત. હજુ સમર્થન મળ્યું નથી.",
    corroborated: "એકથી વધુ સ્વતંત્ર સ્રોત સંમત છે.",
    verified: "ઘટનાસ્થળે બચાવકર્મી દ્વારા પુષ્ટિ થયેલ.",
    conflicting: "સ્રોતો અસંમત છે. માનવ સમીક્ષા જરૂરી.",
  },
  duplicate: {
    matched: "મેળ ખાયું",
    possible_duplicate: "સંભવિત નકલ",
    review_required: "સમીક્ષા જરૂરી",
  },
  confidence: {
    high: "ઉચ્ચ વિશ્વાસ",
    review_advised: "સમીક્ષા સલાહભર્યું",
    manual_required: "માનવ ચકાસણી જરૂરી",
  },
  hazard: {
    trapped_people: "ફસાયેલા લોકો",
    gas_leak: "ગેસ લીક",
    fire_spread: "આગ ફેલાવો",
    rising_water: "વધતું પાણી",
    electrical: "વીજળી",
    structural: "માળખાકીય",
    injuries: "ઈજાઓ",
    blocked_road: "બંધ માર્ગ",
    chemical: "રસાયણ",
    other: "અન્ય",
  },
  source: {
    citizen: "નાગરિક",
    call: "112 કૉલ",
    sensor: "સેન્સર",
    field: "ક્ષેત્ર",
  },
  alertKind: {
    critical: "ગંભીર",
    sla_breach: "SLA ભંગ",
    escalation: "ઉચ્ચ સ્તરે",
    shortage: "અછત",
  },
  quickAction: {
    situation_worse: "સ્થિતિ બગડી",
    situation_stable: "સ્થિતિ સ્થિર",
    wrong_location: "ખોટું સ્થળ",
    road_blocked: "રસ્તો બંધ",
    need_ambulance: "એમ્બ્યુલન્સ જોઈએ",
    need_fire: "ફાયર યુનિટ જોઈએ",
    need_rescue: "બચાવ ટુકડી જોઈએ",
    need_hazmat: "હઝમેટ જોઈએ",
    unable_to_reach: "પહોંચી શકાતું નથી",
  },
  dataMode: {
    live: "લાઇવ",
    cached: "સંગ્રહિત",
    stale: "જૂનું",
    simulated: "સિમ્યુલેટેડ",
    unavailable: "માહિતી નથી",
  },
  sensorHealth: {
    healthy: "સ્વસ્થ",
    stale: "જૂનું",
    offline: "ઑફલાઇન",
    anomalous: "અસામાન્ય",
  },
  roadAccess: {
    clear: "ખુલ્લો",
    partially_blocked: "આંશિક બંધ",
    blocked: "બંધ",
    unknown: "અજ્ઞાત",
  },
  groundTruth: {
    unverified: "ચકાસાયેલ નથી",
    community_confirmed: "સમુદાય દ્વારા પુષ્ટ",
    authority_verified: "સત્તાવાર રીતે ચકાસાયેલ",
  },
  groundTruthNote: {
    unverified: "નાગરિક દ્વારા મોકલાયેલ. હજુ કોઈએ પુષ્ટિ કરી નથી.",
    community_confirmed:
      "નજીકના અન્ય લોકોએ પણ આ જ જાણ કરી છે. સત્તાવાળા દ્વારા હજુ ચકાસાયું નથી.",
    authority_verified: "બચાવ ટુકડી અથવા જિલ્લા સત્તાવાળા દ્વારા પુષ્ટ.",
  },
  chainStatus: {
    unverified: "ચકાસાયેલ નથી",
    community_confirmed: "સમુદાય દ્વારા પુષ્ટ",
    authority_verified: "સત્તાવાર રીતે ચકાસાયેલ",
    assigned: "સોંપાયેલ",
    response_en_route: "મદદ માર્ગ પર",
    resolved: "ઉકેલાયું",
  },
  chainStage: {
    reported: "જાણ",
    verified: "ચકાસણી",
    responding: "પ્રતિસાદ",
    resolved: "ઉકેલ",
  },
  shelterStatus: {
    open: "ખુલ્લું",
    near_capacity: "ક્ષમતાની નજીક",
    full: "ભરેલું",
    closed: "બંધ",
  },
  reliefKind: {
    food: "ભોજન",
    water: "પાણી",
    medical: "તબીબી",
    rescue: "બચાવ",
    transport: "વાહનવ્યવહાર",
  },
  reliefStatus: {
    open: "ખુલ્લું",
    claimed: "સ્વીકારાયું",
    in_transit: "માર્ગ પર",
    delivered: "પહોંચાડાયું",
  },
  missingStatus: {
    missing: "ગુમ",
    potential_match: "સંભવિત મેળ",
    located: "મળી આવ્યા",
    reunited: "પરિવારને મળ્યા",
  },
  reportKind: {
    situation: "પરિસ્થિતિ અહેવાલ",
    incident: "ઘટના અહેવાલ",
    district: "જિલ્લા અહેવાલ",
    response_performance: "પ્રતિસાદ કામગીરી",
    resource: "સંસાધન અહેવાલ",
    after_action: "કાર્યોત્તર અહેવાલ",
  },
  reportKindNote: {
    situation: "આપેલા સમયગાળા માટે રાજ્યવ્યાપી ચિત્ર.",
    incident: "એક ઘટના, જાણથી ઉકેલ સુધી.",
    district: "એક જિલ્લાની ઘટનાઓ, આશ્રયસ્થાનો અને સંસાધનો.",
    response_performance: "લક્ષ્યાંક સામે રવાનગી અને ઘટનાસ્થળે પહોંચવાનો સમય.",
    resource: "ઉપયોગ, અછત અને તૈનાતી.",
    after_action: "શું થયું, શું કામ આવ્યું, શું બદલવું.",
  },
};

const hi: EnumLabels = {
  severity: {
    1: "मामूली",
    2: "मध्यम",
    3: "गंभीर",
    4: "अति गंभीर",
    5: "विनाशकारी",
  },
  priority: {
    P1: "P1 — तत्काल",
    P2: "P2 — अत्यावश्यक",
    P3: "P3 — सामान्य",
    P4: "P4 — नियमित",
  },
  incidentStatus: {
    new: "नया",
    triaged: "वर्गीकृत",
    dispatched: "रवाना",
    on_scene: "घटनास्थल पर",
    resolved: "हल हुआ",
    escalated: "उच्च स्तर पर",
  },
  resourceKind: {
    ambulance: "एम्बुलेंस",
    fire_truck: "अग्निशमन यूनिट",
    rescue_boat: "बचाव नौका",
    police: "पुलिस",
    ndrf_team: "बचाव दल",
    hazmat: "खतरनाक पदार्थ",
  },
  resourceStatus: {
    available: "उपलब्ध",
    assigned: "सौंपा गया",
    busy: "व्यस्त",
    offline: "ऑफ़लाइन",
  },
  resourceViewStatus: {
    available: "उपलब्ध",
    assigned: "सौंपा गया",
    en_route: "रास्ते में",
    on_scene: "घटनास्थल पर",
    busy: "व्यस्त",
    offline: "ऑफ़लाइन",
  },
  assignmentStatus: {
    assigned: "सौंपा गया",
    en_route: "रास्ते में",
    on_scene: "घटनास्थल पर",
    completed: "पूर्ण",
    cancelled: "रद्द",
  },
  verification: {
    unverified: "असत्यापित",
    corroborated: "समर्थित",
    verified: "सत्यापित",
    conflicting: "विरोधाभासी",
  },
  verificationNote: {
    unverified: "एकमात्र स्रोत। अभी तक पुष्टि नहीं।",
    corroborated: "एक से अधिक स्वतंत्र स्रोत सहमत हैं।",
    verified: "घटनास्थल पर बचावकर्मी द्वारा पुष्ट।",
    conflicting: "स्रोत असहमत हैं। मानव समीक्षा आवश्यक।",
  },
  duplicate: {
    matched: "मिलान हुआ",
    possible_duplicate: "संभावित नकल",
    review_required: "समीक्षा आवश्यक",
  },
  confidence: {
    high: "उच्च विश्वास",
    review_advised: "समीक्षा सलाह योग्य",
    manual_required: "मानव सत्यापन आवश्यक",
  },
  hazard: {
    trapped_people: "फँसे लोग",
    gas_leak: "गैस रिसाव",
    fire_spread: "आग का फैलाव",
    rising_water: "बढ़ता पानी",
    electrical: "बिजली",
    structural: "संरचनात्मक",
    injuries: "चोटें",
    blocked_road: "अवरुद्ध मार्ग",
    chemical: "रसायन",
    other: "अन्य",
  },
  source: {
    citizen: "नागरिक",
    call: "112 कॉल",
    sensor: "सेंसर",
    field: "क्षेत्र",
  },
  alertKind: {
    critical: "गंभीर",
    sla_breach: "SLA उल्लंघन",
    escalation: "उच्च स्तर पर",
    shortage: "कमी",
  },
  quickAction: {
    situation_worse: "स्थिति बिगड़ी",
    situation_stable: "स्थिति स्थिर",
    wrong_location: "गलत स्थान",
    road_blocked: "रास्ता बंद",
    need_ambulance: "एम्बुलेंस चाहिए",
    need_fire: "फायर यूनिट चाहिए",
    need_rescue: "बचाव दल चाहिए",
    need_hazmat: "हज़मैट चाहिए",
    unable_to_reach: "पहुँच नहीं सकते",
  },
  dataMode: {
    live: "लाइव",
    cached: "संचित",
    stale: "पुराना",
    simulated: "सिम्युलेटेड",
    unavailable: "कोई डेटा नहीं",
  },
  sensorHealth: {
    healthy: "स्वस्थ",
    stale: "पुराना",
    offline: "ऑफ़लाइन",
    anomalous: "असामान्य",
  },
  roadAccess: {
    clear: "खुला",
    partially_blocked: "आंशिक अवरुद्ध",
    blocked: "अवरुद्ध",
    unknown: "अज्ञात",
  },
  groundTruth: {
    unverified: "असत्यापित",
    community_confirmed: "समुदाय द्वारा पुष्ट",
    authority_verified: "आधिकारिक रूप से सत्यापित",
  },
  groundTruthNote: {
    unverified: "नागरिक द्वारा भेजा गया। अभी किसी ने पुष्टि नहीं की।",
    community_confirmed:
      "आसपास के अन्य लोगों ने भी यही बताया है। अधिकारियों ने अभी जाँच नहीं की।",
    authority_verified: "बचाव दल या ज़िला अधिकारी द्वारा पुष्ट।",
  },
  chainStatus: {
    unverified: "असत्यापित",
    community_confirmed: "समुदाय द्वारा पुष्ट",
    authority_verified: "आधिकारिक रूप से सत्यापित",
    assigned: "सौंपा गया",
    response_en_route: "मदद रास्ते में",
    resolved: "हल हुआ",
  },
  chainStage: {
    reported: "सूचना",
    verified: "सत्यापन",
    responding: "प्रतिक्रिया",
    resolved: "समाधान",
  },
  shelterStatus: {
    open: "खुला",
    near_capacity: "क्षमता के करीब",
    full: "भरा",
    closed: "बंद",
  },
  reliefKind: {
    food: "भोजन",
    water: "पानी",
    medical: "चिकित्सा",
    rescue: "बचाव",
    transport: "परिवहन",
  },
  reliefStatus: {
    open: "खुला",
    claimed: "स्वीकारा गया",
    in_transit: "रास्ते में",
    delivered: "पहुँचाया गया",
  },
  missingStatus: {
    missing: "लापता",
    potential_match: "संभावित मिलान",
    located: "मिल गए",
    reunited: "परिवार से मिले",
  },
  reportKind: {
    situation: "स्थिति रिपोर्ट",
    incident: "घटना रिपोर्ट",
    district: "ज़िला रिपोर्ट",
    response_performance: "प्रतिक्रिया प्रदर्शन",
    resource: "संसाधन रिपोर्ट",
    after_action: "कार्योत्तर रिपोर्ट",
  },
  reportKindNote: {
    situation: "दी गई अवधि के लिए राज्यव्यापी तस्वीर।",
    incident: "एक घटना, सूचना से समाधान तक।",
    district: "एक ज़िले की घटनाएँ, आश्रय और संसाधन।",
    response_performance: "लक्ष्य के मुकाबले रवानगी और घटनास्थल पहुँचने का समय।",
    resource: "उपयोग, कमी और तैनाती।",
    after_action: "क्या हुआ, क्या काम आया, क्या बदलना है।",
  },
};

const ENUM_LABELS: Record<Lang, EnumLabels> = { en, gu, hi };

/** Every enumerated label, in one language. */
export function labels(lang: Lang): EnumLabels {
  return ENUM_LABELS[lang] ?? en;
}

/* ------------------------------------------------------------------ */
/* Running text in shared components                                   */
/* ------------------------------------------------------------------ */

/**
 * Prose belonging to components rendered on many pages.
 *
 * Counted phrases are functions rather than templates with a placeholder:
 * Gujarati and Hindi do not inflect these the way English does, so each
 * language decides its own wording instead of every call site gluing a number
 * onto a translated fragment.
 */
interface SharedStrings {
  trust: {
    noneRecorded: string;
    aiConfidence: string;
    aiConfidenceNote: string;
    evidence: (reports: number, unique: number) => string;
    repeats: (n: number) => string;
    conflictTitle: string;
    conflictNote: string;
    confirmations: (n: number) => string;
  };
}

const SHARED: Record<Lang, SharedStrings> = {
  en: {
    trust: {
      noneRecorded: "None recorded",
      aiConfidence: "AI confidence",
      aiConfidenceNote:
        "AI confidence in this classification — not a confirmation that the emergency occurred.",
      evidence: (r, u) =>
        `${r} report${r === 1 ? "" : "s"} · ${u} unique source${u === 1 ? "" : "s"}`,
      repeats: (n) =>
        `${n} repeat report${n === 1 ? "" : "s"} from an already-counted reporter — not independent confirmation.`,
      conflictTitle: "Conflicting information",
      conflictNote:
        "Sources disagree. Both accounts are kept until a responder confirms on scene.",
      confirmations: (n) =>
        n === 0
          ? "no independent confirmations yet"
          : `${n} independent confirmation${n === 1 ? "" : "s"}`,
    },
  },
  gu: {
    trust: {
      noneRecorded: "કોઈ નોંધ નથી",
      aiConfidence: "AI વિશ્વાસ",
      aiConfidenceNote:
        "આ વર્ગીકરણમાં AI નો વિશ્વાસ — કટોકટી ખરેખર બની હોવાની પુષ્ટિ નથી.",
      evidence: (r, u) => `${r} અહેવાલ · ${u} અલગ સ્રોત`,
      repeats: (n) =>
        `પહેલેથી ગણાયેલા વ્યક્તિ તરફથી ${n} પુનરાવર્તિત અહેવાલ — સ્વતંત્ર પુષ્ટિ નથી.`,
      conflictTitle: "વિરોધાભાસી માહિતી",
      conflictNote:
        "સ્રોતો અસંમત છે. બચાવકર્મી ઘટનાસ્થળે પુષ્ટિ ન કરે ત્યાં સુધી બંને વિગતો રાખવામાં આવે છે.",
      confirmations: (n) =>
        n === 0 ? "હજુ કોઈ સ્વતંત્ર પુષ્ટિ નથી" : `${n} સ્વતંત્ર પુષ્ટિ`,
    },
  },
  hi: {
    trust: {
      noneRecorded: "कोई दर्ज नहीं",
      aiConfidence: "AI विश्वास",
      aiConfidenceNote:
        "इस वर्गीकरण में AI का विश्वास — यह पुष्टि नहीं कि आपात स्थिति वास्तव में हुई।",
      evidence: (r, u) => `${r} रिपोर्ट · ${u} अलग स्रोत`,
      repeats: (n) =>
        `पहले से गिने गए व्यक्ति से ${n} दोहराई गई रिपोर्ट — स्वतंत्र पुष्टि नहीं।`,
      conflictTitle: "विरोधाभासी जानकारी",
      conflictNote:
        "स्रोत असहमत हैं। घटनास्थल पर बचावकर्मी की पुष्टि तक दोनों विवरण रखे जाते हैं।",
      confirmations: (n) =>
        n === 0 ? "अभी कोई स्वतंत्र पुष्टि नहीं" : `${n} स्वतंत्र पुष्टि`,
    },
  },
};

/** Running text for shared components, in one language. */
export function strings(lang: Lang): SharedStrings {
  return SHARED[lang] ?? SHARED.en;
}
