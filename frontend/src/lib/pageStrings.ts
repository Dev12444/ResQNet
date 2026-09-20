/**
 * Running text belonging to individual pages.
 *
 * `i18n.ts` holds the enumerated labels shared across the app and
 * `constants.ts` holds the frame chrome and the citizen report form. Neither
 * covered page bodies, which is why switching to Gujarati left every heading,
 * filter, table header and empty state on `/incidents`, `/analytics`,
 * `/field`, `/resources` and the rest sitting in English on an otherwise
 * translated page: those components never asked what the language was.
 *
 * One namespace per page, plus `common` for the handful of phrases that
 * genuinely repeat (retry, search, "all districts"). The `Record<Lang, …>`
 * type makes a missing translation a compile error rather than a silent
 * English leak — the same rule as `i18n.ts`.
 *
 * Never applied to citizen-authored text or to backend-generated prose: a
 * report typed in Gujarati stays in Gujarati, and an English AI summary stays
 * English until the API can produce one in another language.
 */

import type { ConnectivityState, DisasterType, Lang } from "@/types";

/** How a close one asked to be told. Mirrors `ContactChannel`. */
export type NotifyChannel = "sms" | "call" | "whatsapp";

/** The relationships offered on the Close Ones form, stored as these keys. */
export type Relationship =
  | "spouse"
  | "parent"
  | "child"
  | "sibling"
  | "relative"
  | "neighbour"
  | "friend"
  | "carer";
import type { FlashScenario, FlashSeverity, FlashStatus } from "@/types/flash";

interface PrimitiveStrings {
  loading: string;
  retry: string;
  couldNotLoad: (what: string) => string;
  noAnswer: string;
  unknownNotClear: string;
  partialData: string;
  /** Noun phrases for `UnavailableState`, which reads "Could not load <what>". */
  what: {
    evaluationRun: string;
    hotspotClusters: string;
    incidentReports: string;
    facilities: string;
    warningFeed: string;
  };
}

interface CommonStrings {
  retry: string;
  search: string;
  allDistricts: string;
  district: string;
  clear: string;
  close: string;
  cancel: string;
  save: string;
  of: (shown: number, total: number) => string;
  updated: string;
  noData: string;
  viewAll: string;
  demoData: string;
}

interface IncidentsStrings {
  title: string;
  lead: string;
  loading: string;
  loadError: string;
  searchLabel: string;
  searchPlaceholder: string;
  register: string;
  noMatches: string;
  chain: string;
  selectOne: string;
}

interface AnalyticsStrings {
  title: string;
  lead: string;
  loading: string;
  loadError: string;
  activeIncidents: string;
  resolved: string;
  peopleAffected: string;
  avgResponse: string;
  teamsDeployed: string;
  shelterOccupancy: string;
  highestRisk: string;
  noDispatches: string;
  accuracyTitle: string;
  accuracyNote: string;
  typeAccuracy: string;
  severityWithin1: string;
  dedupPrecision: string;
  dedupRecall: string;
  accuracyCaveat: string;
  hotspots: string;
  hotspotsNote: string;
  filters: string;
  period: string;
  today: string;
  days7: string;
  days30: string;
  custom: string;
  disaster: string;
  byType: string;
  responseTimes: string;
  shortages: string;
  insights: string;
  severity: string;
  status: string;
  customDays: string;
  noClusters: string;
  reportToDispatch: string;
  demoDistrictRisk: string;
  observations: string;
  observationsNote: string;
  nothingNotable: string;
  scope: (shown: number, total: number, districts: number) => string;
  demoFigures: string;
  noTriageNote: string;
  insightSeverity: { critical: string; warning: string; info: string };
  trend: string;
  trendNote: string;
  incidentType: string;
  incidentTypeNote: string;
  districtRisk: string;
  districtRiskNote: string;
  responseTime: string;
  responseTimeNote: string;
  shelterCapacity: string;
  shelterCapacityNote: string;
  utilisation: string;
  utilisationNote: string;
  pulseDistribution: string;
  pulseDistributionNote: string;
  districtComparison: string;
  districtTableCaption: string;
  table: {
    district: string;
    risk: string;
    incidents: string;
    shelters: string;
    teams: string;
    affected: string;
    avgDispatch: string;
  };
  /** The observations panel. Counted phrases are functions: each language
      decides its own wording rather than gluing a number onto a fragment. */
  insight: {
    p1NotDispatched: (n: number) => string;
    waitingLongest: (code: string) => string;
    shortage: (kind: string) => string;
    shortageNone: string;
    shortageSome: string;
    shortageEvidence: (required: number, available: number, shortage: number) => string;
    criticalDistricts: (n: number) => string;
    criticalDistrictsNote: string;
    sheltersOpen: (n: number) => string;
    sheltersFull: (full: number, near: number) => string;
    sheltersFullNote: string;
    conflicting: (n: number) => string;
    conflictingNote: string;
    lowConfidence: (n: number) => string;
    lowConfidenceNote: string;
    unverifiedSevere: (n: number) => string;
    unverifiedSevereNote: string;
    minutes: (n: number) => string;
  };
}

interface FieldStrings {
  loading: string;
  loadErrorTitle: string;
  noAssignmentTitle: string;
  loadingIncident: string;
  incidentErrorTitle: string;
  severity: string;
  reported: string;
  notVerified: string;
  situation: string;
  summary: string;
  peopleAffected: string;
  hazards: string;
  updateStatus: string;
  arrived: string;
  completed: string;
  enRoute: string;
  situationUpdate: string;
  send: string;
  sending: string;
  notes: string;
  resolvedByResponder: string;
  roadAccess: string;
  additionalResources: string;
  yourUnit: string;
  navigate: string;
  fieldVerified: string;
  hazardsCaveat: string;
  noOtherUnits: string;
  currentStatus: string;
  assignmentComplete: string;
  updateSituation: string;
  unreachableDetail: string;
  doNotStandDown: string;
  noAssignmentHint: string;
  statusError: string;
  notEstimated: string;
  aiConfidence: string;
  evidence: string;
  suggestedActions: string;
  suggestedActionsNote: string;
  assignedUnits: string;
  quickActions: string;
  quickActionsNote: string;
  /** Qualifies the ETA — it is a straight line, not a routed drive time. */
  etaNote: string;
  /** Precedes the role that last changed the severity, e.g. "RESPONDER". */
  lastChangeBy: string;
  /** Prefixes a numeric severity, e.g. "SEV 4". */
  sev: string;
  sendError: string;
  signalError: string;
  /** The button that moves the assignment on, per status. */
  action: {
    assigned: string;
    en_route: string;
    on_scene: string;
    completed: string;
    cancelled: string;
  };
  updatesSent: (n: number) => string;
  form: {
    lead: string;
    severityAsFound: string;
    hazardsPresent: string;
    correctedLocation: string;
    resolvedHere: string;
    notesHint: string;
    locationUnavailable: string;
    fixFailed: string;
    gettingFix: string;
    useMyPosition: string;
  };
}

interface ResourcesStrings {
  title: string;
  lead: string;
  loading: string;
  loadErrorTitle: string;
  capabilityDemand: string;
  covered: string;
  short: string;
  filter: string;
  searchLabel: string;
  searchPlaceholder: string;
  units: string;
  facilities: string;
  sensors: string;
  callsign: string;
  kind: string;
  status: string;
  base: string;
  eta: string;
  noUnits: string;
  beds: string;
  capacity: string;
  clearFilters: string;
  clearAFilter: string;
  demandNote: string;
  facilitiesNote: string;
  sensorsNote: string;
  refresh: string;
  refreshing: string;
  tableCaption: string;
  assignment: string;
  capabilities: string;
  locationUpdated: string;
  noFacilities: string;
  noSensors: string;
  noBedCapacity: string;
  nearCapacity: string;
  noReading: string;
  reading: string;
  heartbeat: string;
  noHeartbeatNote: string;
  thresholdNote: string;
}

interface SheltersStrings {
  title: string;
  lead: string;
  loading: string;
  loadErrorTitle: string;
  occupancy: string;
  capacity: string;
  open: string;
  nearlyFull: string;
  full: string;
  nearest: string;
  distanceNote: string;
  facilities: string;
  contact: string;
  noMatches: string;
  searchPlaceholder: string;
  searchLabel: string;
  clearAFilter: string;
  directions: string;
  safeRoute: string;
  illustrativeRoute: string;
  hazardsRouted: string;
  hazardsCaveat: string;
  noRoute: string;
  noRouteHint: string;
  food: string;
  water: string;
  medical: string;
  accessible: string;
  summary: (open: number, occupancy: string, capacity: string) => string;
  placesOf: (occupancy: number, capacity: number, pct: number) => string;
  occupancyStale: string;
  staleNote: (minutes: number) => string;
  occupancyAt: (name: string) => string;
}

interface MissingStrings {
  privacyNote: string;
  privacyNoteTail: string;
  title: string;
  lead: string;
  loading: string;
  loadErrorTitle: string;
  reportedMissing: string;
  found: string;
  lastSeen: string;
  age: string;
  noMatches: string;
  searchPlaceholder: string;
  demoNote: string;
  ladder: string;
  searchLabel: string;
  showReunited: string;
  lastSeenAt: string;
  at: string;
  caseOfficer: string;
  noPhoto: string;
  reunitedHidden: string;
}

interface WeatherStrings {
  rainfall7d: string;
  sourceNote: string;
  title: string;
  lead: string;
  loading: string;
  alerts: string;
  forecast: string;
  noAlerts: string;
  demoNote: string;
  issued: string;
  source: string;
  loadError: string;
  activeWarnings: string;
  rainfall: string;
  mmPerDay: string;
  windTemp: string;
  windTempNote: string;
  windKph: string;
  maxC: string;
  noWarnings: string;
}

interface VolunteersStrings {
  summary: (open: number, districts: number) => string;
  claimedBy: (org: string) => string;
  mark: (status: string) => string;
  reliefDemoNote: string;
  quantity: (amount: string, unit: string, kind: string) => string;
  title: string;
  lead: string;
  loading: string;
  skills: string;
  available: string;
  deployed: string;
  register: string;
  demoNote: string;
  noMatches: string;
  reliefTitle: string;
  searchLabel: string;
  loadError: string;
  searchPlaceholder: string;
}

interface SupportStrings {
  title: string;
  lead: string;
  helplines: string;
  faq: string;
  contactControlRoom: string;
  callBanner: string;
  /** Sits under the call banner: what ResQNet is, and is not. */
  notAReplacement: string;
  /** Explains that the lines below 112 are specialised. */
  specialisedLinesNote: string;
  queuedNote: string;
  /** Heading over the offline queue, e.g. "2 submissions waiting on this device". */
  queuedWaiting: (n: number) => string;
  /** One queued row: kind, label and the time it was queued. */
  queuedItem: (kind: string, label: string, time: string) => string;
  accessibility: string;
  a11yKeyboard: string;
  a11yColour: string;
  a11yVoice: string;
  offlineReports: string;
  a11yTouch: string;
  a11yMotion: string;
  a11yAssistance: string;
  networkFails: string;
  call112: string;
  voiceWorks: string;
  staleNote: string;
  faqs: { q: string; a: string }[];
}

interface ReportsPageStrings {
  title: string;
  lead: string;
  loading: string;
  loadErrorTitle: string;
  searchLabel: string;
  searchPlaceholder: string;
  kind: string;
  status: string;
  sort: string;
  newest: string;
  oldest: string;
  byTitle: string;
  byKind: string;
  noMatches: string;
  preview: string;
  selectOne: string;
  exportCsv: string;
  /** The toolbar button, which carries the row count. */
  exportIndex: (n: number) => string;
  /** "<shown> of <total>" above the index. */
  countOf: (shown: number, total: number) => string;
  /** Publication state of a report document. */
  publicationState: { published: string; draft: string; archived: string };
  print: string;
  reportEmergency: string;
  anyStatus: string;
  titleAz: string;
  reportType: string;
  index: string;
  clearAFilter: string;
  stateWide: string;
  docSummary: string;
  docReference: string;
  docPeriod: string;
  docGenerated: string;
  docIssuedBy: string;
  docMasthead: string;
  docGeneratedBy: (when: string) => string;
  docStatus: (status: string) => string;
  docSignatory: (name: string) => string;
  docFootnote: string;
}

interface BannerStrings {
  citizenReport: string;
  warningIssued: string;
  demoWarning: string;
  officialWarning: string;
  warningFor: (hazard: string, district: string) => string;
  viewDetails: string;
  findShelter: string;
  notifyDevice: string;
  notifyTitle: string;
  notified: string;
  dismissWarning: string;
  stateWide: string;
  unverifiedNote: (source: string) => string;
  demoNote: (source: string) => string;
  officialNote: (source: string) => string;
}

interface ConnectivityStrings {
  label: Record<ConnectivityState, string>;
  note: Record<ConnectivityState, string>;
  queued: (n: number) => string;
  call112: string;
  sending: string;
  sendNow: string;
  sent: (n: number) => string;
  failed: (n: number) => string;
  undeliverable: (n: number) => string;
  refused: (n: number) => string;
  reason: (why: string) => string;
  tryAgain: (n: number) => string;
}

interface DashboardStrings {
  queue: string;
  incident: string;
  selectIncident: string;
  simulator: string;
  start: string;
  stop: string;
  reset: string;
  resetDone: string;
  live: string;
  reconnecting: string;
  demoData: string;
  sitrep: string;
  generating: string;
  language: string;
  loadingMap: string;
  commandCenter: string;
  emergencyContacts: string;
  monsoonResponse: string;
  logACall: string;
  layers: string;
  cityView: string;
  connecting: string;
  feedUnavailable: string;
  feedUnavailableNote: string;
  retry: string;
  mapLayers: string;
  aiGenerated: string;
  situationReport: string;
  copy: string;
  print: string;
  priorityIntake: string;
  logCallTitle: string;
  logCallNote: string;
  whatHappening: string;
  locationField: string;
  noGpsNote: string;
  cancel: string;
  active: string;
  p1Open: string;
  unitsFree: string;
  avgToDispatch: string;
  searchIncidents: string;
  logoAlt: string;
  examplePlaceholder: string;
  exampleLocation: string;
  stopScenario: string;
  scenarioStopped: string;
  scenarioStarted: string;
  apiSilent: string;
  incidents: string;
  responseUnits: string;
  facilities: string;
  escalate: string;
  resolve: string;
  acknowledge: string;
  controlRoom: string;
  couldNotSend: string;
  runScenario: string;
  offline: string;
  helpline: {
    emergency: string;
    ambulance: string;
    fire: string;
    police: string;
    stateEoc: string;
    districtControl: string;
    childHelpline: string;
    womenHelpline: string;
  };
  mapSummary: (incidents: number, units: number, facilities: number) => string;
  dispatched: (code: string) => string;
  escalated: (code: string) => string;
  resolved: (code: string) => string;
  mergedInto: (code: string) => string;
  created: (code: string) => string;
  actionFailed: (action: string, why: string) => string;
  error: string;
}

interface FlashStrings {
  compose: string;
  hazard: string;
  area: string;
  headline: string;
  detail: string;
  language: string;
  preview: string;
  broadcast: string;
  cancel: string;
  history: string;
  noneSent: string;
  sentAt: string;
  dismiss: string;
  drill: string;
  drillNote: string;
  massWarning: string;
  flashAlert: string;
  simulation: string;
  authorityNote: string;
  standalone: string;
  allDistrictsWide: string;
  stateWideConfirm: string;
  exactlyWhatCitizenSees: string;
  emergencyAlert: string;
  notRealPhone: string;
  previewAlert: string;
  send: string;
  close: string;
  incident: string;
  scenario: string;
  severity: string;
  affectedArea: string;
  refineArea: string;
  areaDescription: string;
  targetPopulation: string;
  languages: string;
  message: string;
  issuingAuthority: string;
  expiry: string;
  viewSafeRoute: string;
  nearestShelter: string;
  checkInRecorded: string;
  emergency112: string;
  deviceOnlyNote: string;
  viewIncident: string;
  simulatedAlert: string;
  dismissAlert: string;
  issued: string;
  source: string;
  estimatedReach: string;
  historyTitle: string;
  simulateAlert: string;
  demo: string;
  showOnHandset: string;
  withdraw: string;
  district: string;
  targetArea: string;
  status: string;
  operator: string;
  allDistricts: string;
  severityLabel: Record<FlashSeverity, string>;
  severityAction: Record<FlashSeverity, string>;
  statusLabel: Record<FlashStatus, string>;
  scenarioLabel: Record<FlashScenario, string>;
  aiRecommendation: (pct: number) => string;
  reachNote: string;
  wordingNote: string;
  approvingOperator: (name: string) => string;
  hours: (n: number) => string;
  until: (time: string) => string;
  back: string;
  cancelAction: string;
  cannotBroadcast: string;
  expiresIn: (h: number) => string;
  sending: string;
  imSafe: string;
  notWord: string;
  callNowNote: string;
  simulatedAlertNote: string;
  raised: (n: number) => string;
  noWarnings: string;
  noWarningsTail: string;
  simulateBold: string;
  time: string;
  langCol: string;
  reached: (people: string) => string;
  replay: (id: string) => string;
  cancelRow: (id: string) => string;
  historyFooter: string;
  people: (count: string) => string;
  sourceValue: string;
}

interface CloseOnesStrings {
  title: string;
  lead: string;
  add: string;
  name: string;
  phone: string;
  relation: string;
  save: string;
  cancel: string;
  remove: string;
  empty: string;
  deviceOnly: string;
  notifyOnSafe: string;
  toggleLabel: string;
  offNote: string;
  notifyBy: string;
  mobileNumber: string;
  channel: Record<NotifyChannel, string>;
  relationship: Record<Relationship, string>;
  edit: (name: string) => string;
  removeNamed: (name: string) => string;
  errName: string;
  errPhone: string;
  errDuplicate: string;
  saveChanges: string;
  addContact: string;
}

interface RecommendationStrings {
  demoRanking: string;
  notLive: string;
  demoNote: string;
  staleNote: string;
  confirm: string;
  ranking: string;
  none: string;
  noneNote: string;
  tryAgain: string;
  dispatched: string;
  approved: string;
  dispatching: string;
  aiRecommends: string;
  noAnswer: string;
  failed: string;
}

export interface PageStrings {
  primitives: PrimitiveStrings;
  common: CommonStrings;
  disaster: Record<DisasterType, string>;
  incidents: IncidentsStrings;
  analytics: AnalyticsStrings;
  field: FieldStrings;
  resources: ResourcesStrings;
  shelters: SheltersStrings;
  missing: MissingStrings;
  weather: WeatherStrings;
  volunteers: VolunteersStrings;
  support: SupportStrings;
  reports: ReportsPageStrings;
  dashboard: DashboardStrings;
  flash: FlashStrings;
  closeOnes: CloseOnesStrings;
  recommendation: RecommendationStrings;
  banner: BannerStrings;
  connectivity: ConnectivityStrings;
  charts: ChartStrings;
  drawer: DrawerStrings;
  misc: MiscStrings;
}

interface MiscStrings {
  location: {
    title: string;
    on: string;
    share: string;
    usedFor: string;
    unsupported: string;
    asking: string;
    shareButton: string;
    blocked: string;
    denied: string;
    unavailable: string;
  };
  imSafe: {
    close: string;
    recorded: string;
    savedLocally: string;
    contactsNotified: string;
    noContactsNotified: string;
    offlineNote: string;
    name: string;
    district: string;
    recordedAt: string;
    yourName: string;
    districtYouAreIn: string;
    message: string;
    messagePlaceholder: string;
    notifyCloseOnes: string;
    noneSaved: string;
    addCloseOnes: string;
    recording: string;
    markMeSafe: string;
  };
  alerts: {
    soundBlocked: string;
    soundBlockedNote: string;
    unmute: string;
    mute: string;
    muted: string;
    soundOn: string;
    /** The button that dismisses an alert from the stack. */
    acknowledge: string;
  };
  queue: {
    title: string;
    sort: string;
    activeSignals: string;
    live: string;
    /** The three filter selects, shown as each select's "all" option. */
    filterType: string;
    filterStatus: string;
    filterSev: string;
    /** Prefixes the sort order, which is shown as a value beside it. */
    sortPrefix: string;
    /** Abbreviated "reports", suffixed to a count in the queue row. */
    reportsShort: string;
  };
  liveIst: string;
  urgency: { immediate: string; urgent: string; standard: string };
  urgencyQuestion: string;
  status: string;
  chartTable: { caption: string; time: string; reports: string; incidents: string };
  districtIndex: string;
  priorityArea: string;
  filterPlaceholder: string;
  weatherTrend: string;
  cycloneSchematic: string;
  mapLayers: string;
  toggleGrid: string;
  resetView: string;
  closeDistrictPanel: string;
  resqPulse: string;
  /** The four ResQ Pulse counters. */
  pulse: {
    reports: string;
    blockedRoads: string;
    sheltersActive: string;
    responseTeams: string;
  };
  /** Under the district risk ladder, e.g. "Level 4 / 5 · composite posture". */
  compositePosture: (rank: number) => string;
  /** Shown while the map tiles are still loading. */
  loadingMap: string;
  /** Sub-heading under the Live map title. */
  liveMapIntro: string;
  /** Count of districts currently listed, e.g. "17 in view". */
  inView: (n: number) => string;
  /** Unit under a district's active-incident count. */
  incidentsLabel: string;
  /** Amenity chips on a shelter card. */
  amenity: { food: string; water: string; medical: string };
  /** Footnote under the nearby-shelters list. */
  shelterDistanceNote: string;
  /** Marker count under the map, with a note that overlaps are grouped. */
  markersGrouped: (n: number) => string;
  /** Explains that the discs are centroids, not administrative boundaries. */
  centroidNote: string;
  mapLive: string;
  mapDemoData: string;
  mapLayerMissing: string;
  allLayersFromApi: string;
  weakestLayer: (what: string) => string;
  districtAria: (district: string, risk: string, incidents: number) => string;
  markersInDistrict: (n: number) => string;
  api: {
    serverWaking: string;
    deviceOffline: string;
    offlineLastKnown: string;
    timedOut: string;
    showingDemoData: (note: string) => string;
  };
  freshness: {
    offline: string;
    updatedAgo: (age: string) => string;
    locationStale: string;
    capacityStale: string;
    sec: (n: number) => string;
    min: (n: number) => string;
    hr: (n: number) => string;
  };
  liveMap: string;
  districtsByRisk: string;
  notVerifiedOnScene: string;
  demoDataOnMap: string;
  stateOperations: string;
  openNavigation: string;
  closeNavigation: string;
  sections: string;
  logoAlt: string;
  photoPreview: string;
  dragPin: string;
}

interface DrawerStrings {
  selectIncident: string;
  close: string;
  /** Prefixes the numeric severity on the drawer badge, e.g. "SEV 4". */
  sev: string;
  overview: string;
  reports: string;
  aiSummary: string;
  confidenceTag: (pct: number) => string;
  locationUnverified: string;
  summarising: string;
  reportsDisagree: string;
  reasoning: string;
  modelConfidence: string;
  recommendedActions: string;
  dispatchRecommendations: string;
  activityTimeline: string;
  resolve: string;
  resolved: string;
  escalate: string;
  escalated: string;
  independentSources: (n: number) => string;
  reportReceived: string;
  firstOf: (n: number) => string;
  aiTriage: string;
  triageDetail: (type: string, severity: number, priority: string) => string;
  deduplication: string;
  mergedInto: (n: number, code: string) => string;
  currentState: string;
  now: string;
}

interface ChartStrings {
  count: string;
  reports: string;
  incidents: string;
  noData: string;
  noIncidents: string;
  noActivity: string;
  noCompleted: string;
  noShelters: string;
  noDistricts: string;
  noUnits: string;
  showTable: string;
  hideTable: string;
  reportToDispatch: string;
  reportToResolved: string;
  inUse: string;
  free: string;
  activeIncidents: string;
  committed: string;
  available: string;
  districts: string;
}

/* ------------------------------------------------------------------ */
/* Support FAQ                                                         */
/* ------------------------------------------------------------------ */

/** Kept beside the page strings so a question and its answer stay together. */
const FAQ_EN: { q: string; a: string }[] = [
  {
    q: "Does reporting here replace calling 112?",
    a: "No. 112 reaches emergency services directly and is always the fastest route to help. ResQNet coordinates the response around your report \u2014 it does not dispatch anyone on its own, and an operator reviews every report before a unit is sent.",
  },
  {
    q: "What happens after I submit a report?",
    a: "Your report is received, classified, checked against other reports from the same area, and either linked to a known incident or opened as a new one. A control-room operator then reviews it. You can see each of these stages on the confirmation screen, along with your report reference.",
  },
  {
    q: "What if I have no network?",
    a: "Your report is saved on this device and sent automatically when the connection returns. Until it sends, it has NOT reached the control room \u2014 the banner at the top of the screen will say so and show how many submissions are waiting. If the situation is life-threatening, call 112 by phone instead.",
  },
  {
    q: "Why does my report say UNVERIFIED?",
    a: "It means yours is the only account so far. Reports become CORROBORATED when other independent sources describe the same thing, and AUTHORITY VERIFIED when a responding unit or district officer confirms it on the ground. Repeated messages from the same person do not count as independent confirmation.",
  },
  {
    q: "The AI confidence figure \u2014 what does it mean?",
    a: "It is the classifier's confidence in its own reading of your report: the type, the severity and the hazards. It is not a judgement about whether the emergency is real, and it never decides the response. Anything below 50% is flagged for manual verification.",
  },
  {
    q: "Can I report on behalf of someone else?",
    a: "Yes. Describe what you saw and where. If the person needs special assistance \u2014 elderly, a child, a wheelchair user, or someone needing medical support \u2014 tick the relevant option so responders arrive prepared.",
  },
  {
    q: "Is my personal information published?",
    a: "No. Contact details you provide go to the control room only. The public missing-persons register shows an age band and last-seen location, never addresses, phone numbers or dates of birth.",
  },
  {
    q: "Are shelter bed counts guaranteed?",
    a: "No. They are the last figure reported by that shelter, shown with its age. If a count is more than a couple of minutes old the page says so and advises confirming by phone before travelling.",
  },
];

const FAQ_GU: { q: string; a: string }[] = [
  {
    q: "અહીં જાણ કરવી એ 112 પર કૉલ કરવાનો વિકલ્પ છે?",
    a: "ના. 112 સીધું કટોકટી સેવાઓ સુધી પહોંચે છે અને મદદ માટે હંમેશા સૌથી ઝડપી રસ્તો છે. ResQNet તમારા અહેવાલની આસપાસ પ્રતિસાદનું સંકલન કરે છે \u2014 તે જાતે કોઈને રવાના કરતું નથી, અને એકમ મોકલતાં પહેલાં ઓપરેટર દરેક અહેવાલ તપાસે છે.",
  },
  {
    q: "અહેવાલ મોકલ્યા પછી શું થાય છે?",
    a: "તમારો અહેવાલ મળે છે, વર્ગીકૃત થાય છે, એ જ વિસ્તારના બીજા અહેવાલો સાથે સરખાવાય છે, અને કાં તો જાણીતી ઘટના સાથે જોડાય છે કાં નવી ઘટના ખૂલે છે. પછી કંટ્રોલ રૂમનો ઓપરેટર તેની સમીક્ષા કરે છે. આ દરેક તબક્કો તમને પુષ્ટિ સ્ક્રીન પર તમારા સંદર્ભ ક્રમાંક સાથે દેખાય છે.",
  },
  {
    q: "મારી પાસે નેટવર્ક ન હોય તો?",
    a: "તમારો અહેવાલ આ ઉપકરણ પર સાચવાય છે અને જોડાણ પાછું આવતાં આપોઆપ મોકલાય છે. મોકલાય નહીં ત્યાં સુધી તે કંટ્રોલ રૂમ સુધી પહોંચ્યો નથી \u2014 સ્ક્રીનની ટોચે આવેલું બેનર એ જણાવશે અને કેટલા બાકી છે તે બતાવશે. જો જીવનું જોખમ હોય તો ફોનથી 112 પર કૉલ કરો.",
  },
  {
    q: "મારા અહેવાલમાં અપ્રમાણિત કેમ લખ્યું છે?",
    a: "તેનો અર્થ એ કે અત્યાર સુધી માત્ર તમારો જ અહેવાલ છે. જ્યારે બીજા સ્વતંત્ર સ્રોતો એ જ વાત જણાવે ત્યારે અહેવાલ સમર્થિત બને છે, અને પ્રતિસાદ એકમ કે જિલ્લા અધિકારી ઘટનાસ્થળે પુષ્ટિ કરે ત્યારે સત્તાવાર ચકાસાયેલ બને છે. એક જ વ્યક્તિના વારંવારના સંદેશા સ્વતંત્ર પુષ્ટિ ગણાતા નથી.",
  },
  {
    q: "AI વિશ્વાસનો આંકડો \u2014 તેનો અર્થ શું?",
    a: "તે તમારા અહેવાલના વાચન અંગે વર્ગીકરણકર્તાનો પોતાનો વિશ્વાસ છે: પ્રકાર, ગંભીરતા અને જોખમો. કટોકટી ખરેખર છે કે નહીં તે અંગેનો ચુકાદો નથી, અને તે ક્યારેય પ્રતિસાદ નક્કી કરતો નથી. 50% થી નીચેનું બધું મેન્યુઅલ ચકાસણી માટે ચિહ્નિત થાય છે.",
  },
  {
    q: "શું હું બીજા કોઈ વતી જાણ કરી શકું?",
    a: "હા. તમે શું જોયું અને ક્યાં જોયું તે જણાવો. જો વ્યક્તિને ખાસ સહાયની જરૂર હોય \u2014 વૃદ્ધ, બાળક, વ્હીલચેર વાપરનાર, કે તબીબી સહાયની જરૂરવાળા \u2014 તો યોગ્ય વિકલ્પ પસંદ કરો જેથી બચાવકર્મી તૈયાર થઈને આવે.",
  },
  {
    q: "શું મારી અંગત માહિતી જાહેર થાય છે?",
    a: "ના. તમે આપેલી સંપર્ક વિગતો માત્ર કંટ્રોલ રૂમ સુધી જાય છે. જાહેર ગુમ વ્યક્તિ રજિસ્ટરમાં ઉંમરનો ગાળો અને છેલ્લે જોવાયાનું સ્થળ દેખાય છે, સરનામું, ફોન નંબર કે જન્મતારીખ ક્યારેય નહીં.",
  },
  {
    q: "શું આશ્રયસ્થાનની પથારીની સંખ્યાની ખાતરી છે?",
    a: "ના. એ તે આશ્રયસ્થાને છેલ્લે જણાવેલો આંકડો છે, જે તેની ઉંમર સાથે દર્શાવાય છે. જો આંકડો બે-ત્રણ મિનિટથી જૂનો હોય તો પાનું એમ જણાવે છે અને જતાં પહેલાં ફોનથી ખાતરી કરવાનું સૂચવે છે.",
  },
];

const FAQ_HI: { q: string; a: string }[] = [
  {
    q: "क्या यहाँ रिपोर्ट करना 112 पर कॉल करने की जगह लेता है?",
    a: "नहीं। 112 सीधे आपातकालीन सेवाओं तक पहुँचता है और मदद का सबसे तेज़ रास्ता है। ResQNet आपकी रिपोर्ट के इर्द-गिर्द प्रतिक्रिया का समन्वय करता है \u2014 यह स्वयं किसी को रवाना नहीं करता, और इकाई भेजने से पहले एक ऑपरेटर हर रिपोर्ट देखता है।",
  },
  {
    q: "रिपोर्ट भेजने के बाद क्या होता है?",
    a: "आपकी रिपोर्ट मिलती है, वर्गीकृत होती है, उसी क्षेत्र की अन्य रिपोर्टों से मिलाई जाती है, और या तो किसी ज्ञात घटना से जुड़ती है या नई घटना खुलती है। फिर कंट्रोल रूम का ऑपरेटर उसकी समीक्षा करता है। ये सभी चरण आपको पुष्टि स्क्रीन पर आपके संदर्भ क्रमांक के साथ दिखते हैं।",
  },
  {
    q: "अगर मेरे पास नेटवर्क न हो तो?",
    a: "आपकी रिपोर्ट इस डिवाइस पर सहेजी जाती है और कनेक्शन लौटने पर अपने आप भेज दी जाती है। भेजे जाने तक वह कंट्रोल रूम तक नहीं पहुँची है \u2014 स्क्रीन के ऊपर का बैनर यही बताएगा और कितनी प्रतीक्षा में हैं यह दिखाएगा। यदि जान का ख़तरा हो तो फ़ोन से 112 पर कॉल करें।",
  },
  {
    q: "मेरी रिपोर्ट पर असत्यापित क्यों लिखा है?",
    a: "इसका अर्थ है कि अब तक केवल आपका ही विवरण है। जब अन्य स्वतंत्र स्रोत वही बात बताते हैं तो रिपोर्ट समर्थित बनती है, और प्रतिक्रिया इकाई या ज़िला अधिकारी घटनास्थल पर पुष्टि करे तो प्राधिकरण सत्यापित बनती है। एक ही व्यक्ति के बार-बार संदेश स्वतंत्र पुष्टि नहीं माने जाते।",
  },
  {
    q: "AI विश्वास का आँकड़ा \u2014 इसका क्या अर्थ है?",
    a: "यह आपकी रिपोर्ट के अपने पठन पर वर्गीकरणकर्ता का विश्वास है: प्रकार, गंभीरता और ख़तरे। यह निर्णय नहीं कि आपात स्थिति वास्तविक है या नहीं, और यह कभी प्रतिक्रिया तय नहीं करता। 50% से नीचे सब कुछ मैन्युअल सत्यापन के लिए चिह्नित होता है।",
  },
  {
    q: "क्या मैं किसी और की ओर से रिपोर्ट कर सकता हूँ?",
    a: "हाँ। बताइए आपने क्या और कहाँ देखा। यदि व्यक्ति को विशेष सहायता चाहिए \u2014 बुज़ुर्ग, बच्चा, व्हीलचेयर उपयोगकर्ता, या चिकित्सा सहायता की आवश्यकता \u2014 तो संबंधित विकल्प चुनें ताकि बचावकर्मी तैयार होकर आएँ।",
  },
  {
    q: "क्या मेरी निजी जानकारी प्रकाशित होती है?",
    a: "नहीं। आपके दिए संपर्क विवरण केवल कंट्रोल रूम तक जाते हैं। सार्वजनिक लापता व्यक्ति रजिस्टर में आयु वर्ग और अंतिम बार देखे जाने का स्थान दिखता है, पते, फ़ोन नंबर या जन्मतिथि कभी नहीं।",
  },
  {
    q: "क्या आश्रय के बिस्तरों की संख्या की गारंटी है?",
    a: "नहीं। यह उस आश्रय द्वारा अंतिम बार बताया गया आँकड़ा है, जो अपनी आयु के साथ दिखाया जाता है। यदि आँकड़ा कुछ मिनट से पुराना हो तो पृष्ठ यह बताता है और जाने से पहले फ़ोन पर पुष्टि करने की सलाह देता है।",
  },
];

const en: PageStrings = {
  primitives: {
    loading: "Loading…",
    retry: "Retry",
    couldNotLoad: (what) => `Could not load ${what}`,
    noAnswer: "The server did not answer.",
    unknownNotClear:
      "This is not the same as there being nothing to show — treat it as unknown, not as clear.",
    partialData: "Partial data.",
    what: {
      evaluationRun: "the evaluation run",
      hotspotClusters: "the hotspot clusters",
      incidentReports: "the reports behind this incident",
      facilities: "hospitals and shelters",
      warningFeed: "the warning feed",
    },
  },
  common: {
    retry: "Try again",
    search: "Search",
    allDistricts: "All districts",
    district: "District",
    clear: "Clear",
    close: "Close",
    cancel: "Cancel",
    save: "Save",
    of: (shown, total) => `${shown} of ${total}`,
    updated: "Updated",
    noData: "No data",
    viewAll: "View all",
    demoData: "Demo data",
  },
  disaster: {
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
  incidents: {
    title: "Incidents",
    lead: "Citizen and authority reports, with their verification state.",
    loading: "Loading incidents…",
    loadError: "Could not load incidents",
    searchLabel: "Search incidents",
    searchPlaceholder: "Search location, description or reference...",
    register: "Register",
    noMatches: "No incidents match these filters",
    chain: "ResQ Chain",
    selectOne: "Select an incident to see its chain",
  },
  analytics: {
    title: "Emergency Intelligence Centre",
    lead: "Response performance, classification quality and where reports cluster.",
    loading: "Loading analytics…",
    loadError: "Could not load analytics",
    activeIncidents: "Active incidents",
    resolved: "Resolved",
    peopleAffected: "People affected",
    avgResponse: "Avg response",
    teamsDeployed: "Teams deployed",
    shelterOccupancy: "Shelter occupancy",
    highestRisk: "Highest district risk",
    noDispatches: "No dispatches in window",
    accuracyTitle: "AI classification accuracy",
    accuracyNote:
      "Measured by BE2 against a labelled evaluation set — not a live figure.",
    typeAccuracy: "Type accuracy",
    severityWithin1: "Severity ±1",
    dedupPrecision: "Dedup precision",
    dedupRecall: "Dedup recall",
    accuracyCaveat:
      "Accuracy on a test set is not accuracy on the next real report. Every classification stays advisory and an operator confirms it.",
    hotspots: "Reporting hotspots",
    hotspotsNote: "Where reports cluster. Density of reports — not confirmed risk.",
    filters: "Filters",
    period: "Period",
    today: "Today",
    days7: "7 days",
    days30: "30 days",
    custom: "Custom",
    disaster: "Disaster",
    byType: "By type",
    responseTimes: "Response times",
    shortages: "Shortages",
    insights: "Insights",
    severity: "Severity",
    status: "Status",
    customDays: "Custom period in days",
    noClusters: "No clusters in the current corpus",
    reportToDispatch: "Report → dispatch",
    demoDistrictRisk: "Demo district risk",
    observations: "Observations",
    observationsNote: "Computed from the rows currently in view.",
    nothingNotable: "Nothing notable in this selection",
    scope: (shown, total, districts) =>
      `${shown} of ${total} incidents · ${districts} districts in view`,
    demoFigures: " — demo figures",
    noTriageNote:
      "Report → triage is not shown: the incident contract has no `triaged_at` timestamp, so it cannot be derived.",
    insightSeverity: { critical: "CRITICAL", warning: "WARNING", info: "INFO" },
    trend: "Incident trend",
    trendNote: "Incidents and reports opened per bucket.",
    incidentType: "Incident type",
    incidentTypeNote: "Count of incidents by type.",
    districtRisk: "District risk",
    districtRiskNote: "Active incidents per district; risk level printed beside each bar.",
    responseTime: "Response time",
    responseTimeNote:
      "Report → dispatch and report → resolved, from incident timestamps.",
    shelterCapacity: "Shelter capacity",
    shelterCapacityNote: "Places in use against total capacity.",
    utilisation: "Resource utilisation",
    utilisationNote: "Units committed against available.",
    pulseDistribution: "ResQ Pulse distribution",
    pulseDistributionNote: "How many districts sit at each risk level.",
    districtComparison: "District comparison",
    districtTableCaption:
      "Risk, incidents, shelters, teams and dispatch time per district",
    table: {
      district: "District",
      risk: "Risk",
      incidents: "Incidents",
      shelters: "Shelters",
      teams: "Teams",
      affected: "Affected",
      avgDispatch: "Avg dispatch",
    },
    insight: {
      p1NotDispatched: (n) =>
        `${n} P1 incident${n === 1 ? "" : "s"} not yet dispatched`,
      waitingLongest: (code) => `${code} has been waiting longest.`,
      shortage: (kind) => `${kind} shortage`,
      shortageNone: "No units of this type are available anywhere in view.",
      shortageSome: "Open incidents need more units of this type than are free.",
      shortageEvidence: (required, available, shortage) =>
        `Required ${required} · Available ${available} · Shortage ${shortage}`,
      criticalDistricts: (n) =>
        `${n} district${n === 1 ? "" : "s"} at CRITICAL risk`,
      criticalDistrictsNote:
        "These districts carry the highest combination of hazard and exposure.",
      sheltersOpen: (n) => `${n} shelters open`,
      sheltersFull: (full, near) =>
        `${full} shelter${full === 1 ? "" : "s"} full, ${near} near capacity`,
      sheltersFullNote: "Arrivals should be redirected before these are overwhelmed.",
      conflicting: (n) =>
        `${n} incident${n === 1 ? "" : "s"} with conflicting reports`,
      conflictingNote:
        "Sources disagree on scale or location. Confirm before scaling the response.",
      lowConfidence: (n) =>
        `${n} report${n === 1 ? "" : "s"} below the manual-verification threshold`,
      lowConfidenceNote:
        "The classifier could not read these with confidence. A person should call back.",
      unverifiedSevere: (n) =>
        `${n} severe incident${n === 1 ? "" : "s"} resting on a single source`,
      unverifiedSevereNote:
        "Severity is high but nothing has corroborated the report yet.",
      minutes: (n) => `${n} min`,
    },
  },
  field: {
    loading: "Loading your assignment…",
    loadErrorTitle: "Could not reach the control room",
    noAssignmentTitle: "No active assignment",
    loadingIncident: "Loading incident…",
    incidentErrorTitle: "Could not load the incident",
    severity: "Severity",
    reported: "Reported",
    notVerified: "Not yet verified on scene",
    situation: "Situation",
    summary: "Summary",
    peopleAffected: "People affected",
    hazards: "Reported hazards",
    updateStatus: "Update status",
    arrived: "Arrived on scene",
    completed: "Completed",
    enRoute: "En route",
    situationUpdate: "Situation update",
    send: "Send update",
    sending: "Sending…",
    notes: "Notes",
    resolvedByResponder: "Mark this incident resolved",
    roadAccess: "Road access",
    additionalResources: "Additional resources needed",
    yourUnit: "Your unit",
    navigate: "Navigate in Google Maps",
    fieldVerified: "Field-verified",
    hazardsCaveat:
      "Hazards above are as reported and classified. Treat them as unconfirmed until you see them yourself.",
    noOtherUnits: "No other units assigned.",
    currentStatus: "Current status",
    assignmentComplete: "Assignment complete.",
    updateSituation: "Update situation",
    unreachableDetail:
      "The server did not answer. This is not the same as having no assignment.",
    doNotStandDown:
      "Do not treat this as “stand down”. Confirm your tasking by radio or on",
    noAssignmentHint:
      "You will see your incident here as soon as the control room dispatches your unit.",
    statusError: "Could not update status",
    notEstimated: "Not estimated",
    aiConfidence: "AI confidence",
    evidence: "Evidence",
    suggestedActions: "Suggested actions",
    suggestedActionsNote: "Advisory — your assessment on scene overrides these.",
    assignedUnits: "Assigned to this incident",
    quickActions: "Quick actions",
    quickActionsNote: "Sends a single signal to the control room.",
    etaNote: "straight-line estimate — not a routed ETA",
    lastChangeBy: "Latest change by:",
    sev: "SEV",
    sendError: "Could not send the update",
    signalError: "Could not send the signal",
    action: {
      assigned: "ACKNOWLEDGE",
      en_route: "EN ROUTE",
      on_scene: "ON SCENE",
      completed: "COMPLETE",
      cancelled: "CANCELLED",
    },
    updatesSent: (n) =>
      `${n} situation update${n === 1 ? "" : "s"} sent from this device. The control room picture updates once the backend accepts them.`,
    form: {
      lead: "What you record here replaces the reported picture. Leave a field blank to keep the current value.",
      severityAsFound: "Severity as you find it",
      hazardsPresent: "Hazards present",
      correctedLocation: "Corrected location",
      resolvedHere: "Incident resolved at this location",
      notesHint: "What the control room needs to know",
      locationUnavailable:
        "Location unavailable on this device. Describe it in the notes instead.",
      fixFailed: "Could not get a fix. Describe the correct location in the notes.",
      gettingFix: "Getting fix…",
      useMyPosition: "Use my current position",
    },
  },
  resources: {
    title: "Resources",
    lead: "Units, hospitals, shelters and sensors across the state.",
    loading: "Loading resources…",
    loadErrorTitle: "Could not load units",
    capabilityDemand: "Capability demand",
    covered: "COVERED",
    short: "SHORT",
    filter: "Filter",
    searchLabel: "Search units, facilities and sensors",
    searchPlaceholder: "Search callsign, base, capability, facility…",
    units: "Units",
    facilities: "Hospitals & shelters",
    sensors: "Sensors",
    callsign: "Callsign",
    kind: "Type",
    status: "Status",
    base: "Base",
    eta: "ETA",
    noUnits: "No units match these filters",
    beds: "Beds",
    capacity: "Capacity",
    clearFilters: "Clear filters",
    clearAFilter: "Clear a filter to widen the search.",
    demandNote:
      "Required counts each open incident's needed unit types against units currently available.",
    facilitiesNote: "Bed counts are last-reported figures, not reservations.",
    sensorsNote: "Reading, heartbeat and health are tracked separately.",
    refresh: "Refresh",
    refreshing: "Refreshing…",
    tableCaption: "Response units with status, assignment, base and location freshness",
    assignment: "Assignment",
    capabilities: "Capabilities",
    locationUpdated: "Location updated",
    noFacilities: "No facilities match these filters",
    noSensors: "No sensors match these filters",
    noBedCapacity: "No bed capacity reported",
    nearCapacity: "NEAR CAPACITY",
    noReading: "No reading",
    reading: "Reading",
    heartbeat: "Heartbeat",
    noHeartbeatNote:
      "No heartbeat. Absence of a reading is not evidence that conditions are normal.",
    thresholdNote:
      "Reading is past its threshold. Corroborate before treating as confirmed.",
  },
  shelters: {
    title: "Shelters",
    lead: "Relief shelters, their occupancy and what they can offer.",
    loading: "Loading shelters…",
    loadErrorTitle: "Could not load shelters",
    occupancy: "Occupancy",
    capacity: "Capacity",
    open: "Open",
    nearlyFull: "Nearly full",
    full: "Full",
    nearest: "Nearest to you",
    distanceNote: "Straight-line distance, not road distance.",
    facilities: "Facilities",
    contact: "Contact",
    noMatches: "No shelters match these filters",
    searchPlaceholder: "Search name or address...",
    searchLabel: "Search shelters",
    clearAFilter: "Clear a filter to widen the search.",
    directions: "Directions",
    safeRoute: "SafeRoute",
    illustrativeRoute: "Illustrative route.",
    hazardsRouted: "Known hazards routed around",
    hazardsCaveat:
      "Only hazards already reported to ResQNet are considered. Others may exist.",
    noRoute: "No route selected",
    noRouteHint: "Choose SafeRoute on a shelter to see a suggested way there.",
    food: "Food",
    water: "Water",
    medical: "Medical",
    accessible: "Accessible",
    summary: (open, occupancy, capacity) =>
      `${open} open · ${occupancy} of ${capacity} places in use`,
    placesOf: (occupancy, capacity, pct) => `${occupancy} / ${capacity} places (${pct}%)`,
    occupancyStale: "OCCUPANCY STALE",
    staleNote: (minutes) =>
      `This count is ${minutes} min old — confirm by phone before sending people here.`,
    occupancyAt: (name) => `Occupancy at ${name}`,
  },
  missing: {
    privacyNote:
      "This register shows only what is needed to help identify someone. Contact details, addresses and dates of birth are held by the case officer and are not published here. If you recognise someone, call the district emergency line on",
    privacyNoteTail: ".",
    title: "Missing Persons",
    lead: "Reports of people missing after an emergency.",
    loading: "Loading records…",
    loadErrorTitle: "Could not load records",
    reportedMissing: "Reported missing",
    found: "Found",
    lastSeen: "Last seen",
    age: "Age",
    noMatches: "No records match these filters",
    searchPlaceholder: "Search name, area or reference…",
    demoNote: "Demo records — this build has no missing-persons registry behind it.",
    ladder: "Missing → Potential Match → Located → Reunited",
    searchLabel: "Search the register",
    showReunited: "Show reunited cases",
    lastSeenAt: "Last seen:",
    at: "At:",
    caseOfficer: "Case officer:",
    noPhoto: "No photograph on file.",
    reunitedHidden: "Reunited cases are hidden unless you tick the box above.",
  },
  weather: {
    rainfall7d: "7-day rainfall",
    sourceNote:
      "Source: IMD, NDMA. ResQNet has no live meteorological integration — the figures on this page are fixtures for the demonstration.",
    title: "Weather",
    lead: "District warnings, rainfall and wind outlook.",
    loading: "Loading weather…",
    alerts: "Alerts",
    forecast: "Forecast",
    noAlerts: "No active weather alerts",
    demoNote: "Demo data — no live IMD feed",
    issued: "Issued",
    source: "Source",
    loadError: "Could not load weather alerts",
    activeWarnings: "Active warnings",
    rainfall: "Rainfall",
    mmPerDay: "Millimetres per day",
    windTemp: "Wind & temperature",
    windTempNote: "Peak wind (kph) and maximum temperature (°C)",
    windKph: "Wind kph",
    maxC: "Max °C",
    noWarnings: "No warnings match these filters",
  },
  volunteers: {
    summary: (open, districts) =>
      `${open} unclaimed request${open === 1 ? "" : "s"} across ${districts} districts`,
    claimedBy: (org) => ` · claimed by ${org}`,
    mark: (status) => `Mark ${status}`,
    reliefDemoNote:
      "Status changes made here are held on this device for the demonstration. They are not yet sent to the state control room — the coordination endpoint is an open integration.",
    quantity: (amount, unit, kind) => `${amount} ${unit} — ${kind}`,
    title: "Volunteers",
    lead: "Trained volunteers and where they are deployed.",
    loading: "Loading volunteers…",
    skills: "Skills",
    available: "Available",
    deployed: "Deployed",
    register: "Register as a volunteer",
    demoNote: "Demo roster — registrations are not stored in this build.",
    noMatches: "No requests match these filters",
    reliefTitle: "Volunteers & NGOs",
    searchLabel: "Search relief requests",
    loadError: "Could not load relief requests",
    searchPlaceholder: "Search location, reference or organisation...",
  },
  support: {
    title: "Support",
    lead: "Helplines, guidance and how to reach the control room.",
    helplines: "Emergency numbers",
    faq: "Common questions",
    contactControlRoom: "Contact the control room",
    callBanner: "In an emergency, call 112",
    notAReplacement:
      "ResQNet supports coordination between citizens, responders and departments. It does not replace an emergency call, and submitting a report here does not summon help on its own.",
    specialisedLinesNote:
      "112 reaches all services. The lines below are specialised \u2014 use them only when you already know which service you need.",
    queuedWaiting: (n) =>
      `${n} submission${n === 1 ? "" : "s"} waiting on this device`,
    queuedItem: (kind, label, time) => `${kind} — ${label} (queued ${time})`,
    queuedNote:
      "These have not reached the control room yet. They will send automatically when the connection returns.",
    accessibility: "Accessibility",
    a11yKeyboard:
      "Every screen works with a keyboard alone. Focus is always visible, and a “Skip to main content” link is the first stop on every page.",
    a11yVoice:
      "The reporting form supports voice input in Gujarati, Hindi and English where the browser allows it, and you can always edit the transcript before sending.",
    offlineReports:
      "Reports you submit offline are saved on this device and sent when the connection returns. The banner tells you how many are waiting.",
    a11yColour:
      "Status is never carried by colour alone — every coloured badge also states its meaning in words.",
    a11yTouch:
      "Emergency controls use large touch targets and the reporting form works one-handed on a phone.",
    a11yMotion:
      "Animation is limited to two indicators and is disabled entirely if your device requests reduced motion.",
    a11yAssistance:
      "Special assistance options — elderly, child, wheelchair, medical — are on the reporting form so responders arrive prepared.",
    networkFails: "If the network fails",
    call112: "Call 112.",
    voiceWorks:
      "A voice call works on a weak signal that will not carry a data connection.",
    staleNote:
      "The last data you loaded stays on screen and is marked STALE rather than being presented as current.",
    faqs: FAQ_EN,
  },
  reports: {
    title: "Reports",
    lead: "Situation reports, damage assessments and daily briefs.",
    loading: "Loading reports…",
    loadErrorTitle: "Could not load reports",
    searchLabel: "Search reports",
    searchPlaceholder: "Search title, district or reference…",
    kind: "Type",
    status: "Status",
    sort: "Sort",
    newest: "Newest first",
    oldest: "Oldest first",
    byTitle: "Title",
    byKind: "Type",
    noMatches: "No reports match these filters",
    preview: "Preview",
    selectOne: "Select a report to preview it",
    exportCsv: "Export index (CSV)",
    exportIndex: (n) => `Export index (${n})`,
    countOf: (shown, total) => `${shown} of ${total}`,
    publicationState: { published: "Published", draft: "Draft", archived: "Archived" },
    print: "Print / Save as PDF",
    reportEmergency: "Report an Emergency",
    anyStatus: "Any status",
    titleAz: "Title A\u2013Z",
    reportType: "Report type",
    index: "Index",
    clearAFilter: "Clear a filter to widen the search.",
    stateWide: "State-wide",
    docSummary: "Summary",
    docReference: "Reference",
    docPeriod: "Period",
    docGenerated: "Generated",
    docIssuedBy: "Issued by",
    docMasthead: "State Disaster Management Authority \u00b7 ResQNet",
    docGeneratedBy: (when) => `Generated by ResQNet \u00b7 ${when} IST`,
    docStatus: (status) => `Status: ${status}`,
    docSignatory: (name) => `${name} \u2014 authorised signatory`,
    docFootnote:
      "Figures in this report are drawn from the ResQNet operational dataset at the time of generation. Where a field was unavailable it is marked rather than estimated.",
  },
  dashboard: {
    queue: "Incident queue",
    incident: "Incident",
    selectIncident: "Select an incident",
    simulator: "Simulator",
    start: "Run scenario",
    stop: "Stop",
    reset: "Reset",
    resetDone: "Demo data reset",
    live: "LIVE",
    reconnecting: "RECONNECTING",
    demoData: "DEMO DATA",
    sitrep: "SITREP",
    generating: "Generating\u2026",
    language: "Language",
    loadingMap: "Loading live map\u2026",
    commandCenter: "EMERGENCY COMMAND CENTER",
    emergencyContacts: "EMERGENCY CONTACTS",
    monsoonResponse: "MONSOON RESPONSE",
    logACall: "LOG A CALL",
    layers: "LAYERS",
    cityView: "CITY VIEW",
    connecting: "Connecting to control room\u2026",
    feedUnavailable: "INCIDENT FEED UNAVAILABLE",
    feedUnavailableNote:
      "An empty queue here means the control room could not be reached \u2014 not that the city is quiet.",
    retry: "Retry",
    mapLayers: "MAP LAYERS",
    aiGenerated: "AI GENERATED",
    situationReport: "Situation Report",
    copy: "Copy",
    print: "Print",
    priorityIntake: "PRIORITY INTAKE",
    logCallTitle: "Log an emergency call",
    logCallNote:
      "Type what the caller says, in any language. AI classifies, locates and de-duplicates it.",
    whatHappening: "What is happening?",
    locationField: "Location (area / landmark)",
    noGpsNote: "No GPS: the area name is geocoded from the Ahmedabad gazetteer.",
    cancel: "Cancel",
    active: "ACTIVE",
    p1Open: "P1 OPEN",
    unitsFree: "UNITS FREE",
    avgToDispatch: "AVG TO DISPATCH",
    searchIncidents: "Search incident code, title or location\u2026",
    logoAlt: "ResQNet logo",
    examplePlaceholder: "e.g. \u0a85\u0ab5\u0abe\u0ab0 \u2014 water is rising",
    exampleLocation: "e.g. Akhbarnagar underpass",
    stopScenario: "Stop scenario",
    scenarioStopped: "Scenario stopped",
    scenarioStarted: "Scenario started: reports will stream in",
    apiSilent: "The API did not answer.",
    incidents: "Incidents",
    responseUnits: "Response units",
    facilities: "Hospitals & shelters",
    escalate: "Escalate",
    resolve: "Resolve",
    acknowledge: "Acknowledge",
    controlRoom: "Control room",
    couldNotSend: "Could not send",
    runScenario: "RUN SCENARIO",
    offline: "OFFLINE",
    helpline: {
      emergency: "EMERGENCY",
      ambulance: "AMBULANCE",
      fire: "FIRE",
      police: "POLICE",
      stateEoc: "STATE EOC",
      districtControl: "DISTRICT CONTROL",
      childHelpline: "CHILD HELPLINE",
      womenHelpline: "WOMEN HELPLINE",
    },
    mapSummary: (incidents, units, facilities) =>
      `OSM \u00b7 ${incidents} incidents \u00b7 ${units} units \u00b7 ${facilities} facilities`,
    dispatched: (code) => `${code} dispatched`,
    escalated: (code) => `${code} escalated`,
    resolved: (code) => `${code} resolved: units released`,
    mergedInto: (code) => `Merged into ${code} (duplicate detected)`,
    created: (code) => `New incident ${code} created`,
    actionFailed: (action, why) => `${action} failed: ${why}`,
    error: "error",
  },
  flash: {
    compose: "Compose alert",
    hazard: "Hazard",
    area: "Area",
    headline: "Headline",
    detail: "Detail",
    language: "Language",
    preview: "Preview",
    broadcast: "Broadcast",
    cancel: "Cancel",
    history: "Sent alerts",
    noneSent: "No alerts sent yet",
    sentAt: "Sent",
    dismiss: "Dismiss",
    drill: "DRILL",
    drillNote: "This is a drill. No action is required.",
    massWarning: "Mass Warning \u00b7 Authorised Operators Only",
    flashAlert: "ResQNet Flash Alert",
    simulation: "Simulation",
    authorityNote:
      "The model cannot issue a warning. You are the issuing authority.",
    standalone: "Not raised from an incident \u2014 standalone warning",
    allDistrictsWide: "All districts (state-wide)",
    stateWideConfirm:
      "State-wide warnings reach every district. Confirm this is intended.",
    exactlyWhatCitizenSees: "Exactly what a citizen will see",
    emergencyAlert: "Emergency Alert",
    notRealPhone: "This will not reach a real phone.",
    previewAlert: "PREVIEW ALERT",
    send: "SEND FLASH ALERT",
    close: "Close",
    incident: "Incident",
    scenario: "Scenario",
    severity: "Severity",
    affectedArea: "Affected area",
    refineArea: "Refine the area, e.g. coastal belt and low-lying villages",
    areaDescription: "Affected area description",
    targetPopulation: "Target population",
    languages: "Languages",
    message: "Message",
    issuingAuthority: "Issuing authority",
    expiry: "Expiry",
    viewSafeRoute: "VIEW SAFE ROUTE",
    nearestShelter: "NEAREST SHELTER",
    checkInRecorded: "CHECK-IN RECORDED",
    emergency112: "EMERGENCY 112",
    deviceOnlyNote: "Saved on this device only \u2014 it has",
    viewIncident: "VIEW INCIDENT",
    simulatedAlert: "Simulated alert.",
    dismissAlert: "Dismiss alert",
    issued: "Issued",
    source: "Source",
    estimatedReach: "Estimated reach",
    historyTitle: "Flash Alert History",
    simulateAlert: "SIMULATE FLASH ALERT",
    demo: "Demo",
    showOnHandset: "Show this warning on the simulated handset",
    withdraw: "Withdraw this warning",
    district: "District",
    targetArea: "Target area",
    status: "Status",
    operator: "Operator",
    allDistricts: "All districts",
    severityLabel: { extreme: "EXTREME", serious: "SERIOUS", advisory: "ADVISORY" },
    severityAction: {
      extreme: "Take protective action immediately",
      serious: "Prepare to act and monitor official updates",
      advisory: "Stay informed and avoid the affected area",
    },
    statusLabel: {
      draft: "DRAFT",
      ready: "READY",
      sent: "SENT",
      expired: "EXPIRED",
      cancelled: "CANCELLED",
    },
    scenarioLabel: {
      cyclone: "Cyclone",
      flash_flood: "Flash Flood",
      extreme_rain: "Extreme Rainfall",
      major_fire: "Major Fire",
      chemical_leak: "Chemical / Gas Leak",
      earthquake: "Earthquake",
      dam_river: "Dam / River Warning",
      building_collapse: "Building Collapse",
      industrial_accident: "Industrial Accident",
      evacuation: "Evacuation Order",
      p1_life_threat: "P1 Life-Threatening Incident",
    },
    aiRecommendation: (pct) => `AI Recommendation \u00b7 ${pct}% confidence`,
    reachNote: "people \u2014 estimated from district population, not a device register",
    wordingNote:
      "Wording is pre-authored per language and reviewed on the preview step \u2014 it is never machine-translated at send time.",
    approvingOperator: (name) => `Approving operator: ${name}`,
    hours: (n) => `${n} hours`,
    until: (time) => `Until ${time}`,
    back: "BACK",
    cancelAction: "CANCEL",
    cannotBroadcast:
      "ResQNet\u2019s frontend cannot emit a cell broadcast. Sending records the warning in Flash Alert History and displays it on the simulated citizen handset so the workflow can be demonstrated end to end.",
    expiresIn: (h) => `expires in ${h}h`,
    sending: "SENDING\u2026",
    imSafe: "I\u2019M SAFE",
    notWord: "not",
    callNowNote: "reached the control room yet. If you need help now, call 112.",
    simulatedAlertNote:
      "This is a demonstration of ResQNet\u2019s warning workflow. It is not an official government cell broadcast and was not sent to any phone. In a live deployment an approved warning is handed to the NDMA Common Alerting Protocol gateway, which performs the broadcast.",
    raised: (n) => `${n} raised`,
    noWarnings: "No warnings raised in this session. Use",
    noWarningsTail: "to run the Kutch cyclone demonstration.",
    simulateBold: "Simulate Flash Alert",
    time: "Time",
    langCol: "Lang",
    reached: (people) => `~${people} reached`,
    replay: (id) => `Replay ${id}`,
    cancelRow: (id) => `Cancel ${id}`,
    historyFooter:
      "Every entry is a simulation. ResQNet\u2019s frontend does not emit cell broadcasts \u2014 an approved warning would be handed to the NDMA Common Alerting Protocol gateway in a live deployment.",
    people: (count) => `${count} people`,
    sourceValue: "ResQNet \u00b7 Emergency Response Network",
  },
  closeOnes: {
    title: "Close ones notification",
    lead: "When you check in as safe, the people below hear about it too.",
    add: "Add close one",
    name: "Name",
    phone: "Phone",
    relation: "Relation",
    save: "Save",
    cancel: "Cancel",
    remove: "Remove",
    empty: "Nobody added yet. Start with whoever should hear from you first.",
    deviceOnly:
      "Saved on this device only. There's no SMS gateway in this build, so nothing actually reaches a phone yet.",
    notifyOnSafe: "Notify them when I check in as safe",
    toggleLabel: "Notify close ones when I check in as safe",
    offNote:
      "Right now only the control room sees your check-in. Turn this on to let your people know as well.",
    notifyBy: "Notify by",
    mobileNumber: "Mobile number",
    channel: { sms: "SMS", call: "Voice call", whatsapp: "WhatsApp" },
    relationship: {
      spouse: "Spouse",
      parent: "Parent",
      child: "Child",
      sibling: "Sibling",
      relative: "Relative",
      neighbour: "Neighbour",
      friend: "Friend",
      carer: "Carer",
    },
    edit: (name) => `Edit ${name}`,
    removeNamed: (name) => `Remove ${name}`,
    errName: "Enter a name.",
    errPhone: "Enter a 10-digit Indian mobile number.",
    errDuplicate: "That number is already saved.",
    saveChanges: "Save changes",
    addContact: "Add contact",
  },
  recommendation: {
    demoRanking: "DEMO RANKING",
    notLive: "NOT LIVE",
    demoNote: "These units are demo data, not the live fleet.",
    staleNote:
      "Showing the last answer the recommender gave, not the current fleet.",
    confirm: "Confirm availability before dispatching.",
    ranking: "Ranking units\u2026",
    none: "NO RECOMMENDATION AVAILABLE",
    noneNote:
      "Dispatch from the unit list instead \u2014 this panel only ranks, it is not required to send anybody.",
    tryAgain: "Try again",
    dispatched: "Units dispatched. Track them in the timeline.",
    approved: "DISPATCH APPROVED",
    dispatching: "DISPATCHING\u2026",
    aiRecommends: "AI recommends \u00b7 dispatcher approves",
    noAnswer: "The recommender did not answer.",
    failed: "Dispatch failed",
  },
  banner: {
    citizenReport: "Citizen report \u00b7 unverified",
    warningIssued: "Warning issued",
    demoWarning: "Demo warning \u2014 not issued",
    officialWarning: "Official warning",
    warningFor: (hazard, district) => `${hazard} warning \u00b7 ${district}`,
    viewDetails: "View details",
    findShelter: "Find shelter",
    notifyDevice: "Notify this device",
    notifyTitle:
      "Show this warning as a notification in this browser, on this device",
    notified: "Notified on this device",
    dismissWarning: "Dismiss this warning",
    stateWide: "State-wide",
    unverifiedNote: (source) =>
      `Reported by ${source} and awaiting verification by the State Control Room. This banner is showing on this device only \u2014 ResQNet does not broadcast to phones. For an emergency, call 112.`,
    demoNote: (source) =>
      `Demonstration warning attributed to ${source} for the walkthrough. Nothing has been issued and nobody has been told. For an emergency, call 112.`,
    officialNote: (source) =>
      `Issued by ${source}. ResQNet displays official warnings \u2014 it does not broadcast to phones. For an emergency, call 112.`,
  },
  connectivity: {
    label: { online: "ONLINE", low: "LOW CONNECTIVITY", offline: "OFFLINE" },
    note: {
      online: "Connected to the state control room.",
      low: "Weak connection. Submissions may take longer and will be queued if they fail.",
      offline:
        "No connection. Anything you submit is saved on this device and sent when you are back online.",
    },
    queued: (n) =>
      `${n} submission${n === 1 ? "" : "s"} still on this device \u2014 not yet received by the control room.`,
    call112: "Call 112 instead",
    sending: "Sending\u2026",
    sendNow: "Send now",
    sent: (n) => `${n} sent to the control room.`,
    failed: (n) => `${n} could not be sent and are still waiting. `,
    undeliverable: (n) =>
      `${n} cannot be sent automatically \u2014 please submit ${n === 1 ? "it" : "them"} again.`,
    refused: (n) =>
      `${n} ${n === 1 ? "was" : "were"} refused by the control room and will not be resent on their own.`,
    reason: (why) => `Reason: ${why}. `,
    tryAgain: (n) => `Try ${n === 1 ? "it" : "them"} again anyway`,
  },
  charts: {
    count: "Count",
    reports: "Reports",
    incidents: "Incidents",
    noData: "No data for these filters",
    noIncidents: "No incidents for these filters",
    noActivity: "No activity in this window",
    noCompleted: "No completed responses in this window",
    noShelters: "No shelters in this selection",
    noDistricts: "No districts in this selection",
    noUnits: "No units in this selection",
    showTable: "Show data table",
    hideTable: "Hide data table",
    reportToDispatch: "Report \u2192 dispatch",
    reportToResolved: "Report \u2192 resolved",
    inUse: "In use",
    free: "Free",
    activeIncidents: "Active incidents",
    committed: "Committed",
    available: "Available",
    districts: "Districts",
  },
  drawer: {
    selectIncident: "Select an incident",
    close: "Close",
    sev: "SEV",
    overview: "OVERVIEW",
    reports: "REPORTS",
    aiSummary: "AI SITUATION SUMMARY",
    confidenceTag: (pct) => `${pct}% CONFIDENCE`,
    locationUnverified:
      "LOCATION UNVERIFIED: confirm with the caller before dispatch",
    summarising: "Summarising reports\u2026",
    reasoning: "Reasoning:",
    reportsDisagree: "Reports disagree:",
    modelConfidence: "MODEL CONFIDENCE",
    recommendedActions: "RECOMMENDED ACTIONS",
    dispatchRecommendations: "DISPATCH RECOMMENDATIONS",
    activityTimeline: "ACTIVITY TIMELINE",
    resolve: "RESOLVE",
    resolved: "RESOLVED",
    escalate: "ESCALATE",
    escalated: "ESCALATED",
    independentSources: (n) => `${n} independent sources`,
    reportReceived: "Report received",
    firstOf: (n) => `First of ${n} report${n === 1 ? "" : "s"}`,
    aiTriage: "AI triage",
    triageDetail: (type, severity, priority) =>
      `${type} \u00b7 severity ${severity} \u00b7 ${priority}`,
    deduplication: "Deduplication",
    mergedInto: (n, code) => `${n} reports merged into ${code}`,
    currentState: "Current state",
    now: "now",
  },
  misc: {
    location: {
      title: "Location Access",
      on: "Location is on. You\u2019ll see what\u2019s happening near you.",
      share:
        "Share your location so we can show you what\u2019s happening around you.",
      usedFor:
        "Used for nearby shelters, safe routes and local alerts. We never track where you go.",
      unsupported:
        "This browser can\u2019t share location. Reporting still works \u2014 just type the nearest landmark.",
      asking: "Asking\u2026",
      shareButton: "Share my location",
      blocked:
        "Your browser is blocking this. You can turn it back on in site settings \u2014 reporting works fine without it.",
      denied:
        "Permission denied. You can still report an emergency by typing a landmark.",
      unavailable:
        "Location unavailable right now. You can still report by typing a landmark.",
    },
    imSafe: {
      close: "Close",
      recorded: "Check-in recorded",
      savedLocally: "Saved on this device only",
      contactsNotified: "Your listed contacts will be notified that you are safe.",
      noContactsNotified: "Your status is recorded. No contacts were notified.",
      offlineNote:
        "There is no connection right now, so this has NOT reached the control room or your contacts. It will be sent automatically when you are back online.",
      name: "Name",
      district: "District",
      recordedAt: "Recorded",
      yourName: "Your name",
      districtYouAreIn: "District you are in",
      message: "Message (optional)",
      messagePlaceholder: "At the shelter with my family",
      notifyCloseOnes: "Notify my close ones",
      noneSaved:
        "No close ones saved yet, so this check-in will reach the control room only.",
      addCloseOnes: "Add close ones",
      recording: "Recording\u2026",
      markMeSafe: "Mark me safe",
    },
    alerts: {
      soundBlocked: "SOUND BLOCKED UNTIL YOU CLICK",
      soundBlockedNote:
        "Browsers require a click on the page before they will play sound.",
      unmute: "Unmute alert sound",
      mute: "Mute alert sound",
      muted: "MUTED",
      soundOn: "SOUND ON",
      acknowledge: "ACKNOWLEDGE",
    },
    queue: {
      title: "INCIDENT QUEUE",
      sort: "PRIORITY \u2192 AGE",
      activeSignals: "ACTIVE SIGNALS",
      live: "LIVE",
      filterType: "TYPE",
      filterStatus: "STATUS",
      filterSev: "SEV",
      sortPrefix: "SORT",
      reportsShort: "rpt",
    },
    liveIst: "LIVE IST",
    urgency: {
      immediate: "Life at risk now",
      urgent: "Urgent help needed",
      standard: "Needs attention",
    },
    urgencyQuestion: "How urgent is it?",
    status: "Status",
    chartTable: {
      caption: "Reports and incidents per time bucket",
      time: "Time",
      reports: "Reports",
      incidents: "Incidents",
    },
    districtIndex: "District index",
    priorityArea: "Priority area",
    filterPlaceholder: "Filter by incident, district, unit or severity...",
    weatherTrend: "Weather Trend",
    cycloneSchematic:
      "Schematic of the cyclone system over the Arabian Sea with its projected track towards the Kutch coast",
    mapLayers: "Map layers",
    toggleGrid: "Toggle the map grid reference overlay",
    resetView: "Reset the map view",
    closeDistrictPanel: "Close district panel",
    resqPulse: "ResQ Pulse",
    pulse: {
      reports: "Reports",
      blockedRoads: "Blocked roads",
      sheltersActive: "Shelters active",
      responseTeams: "Response teams",
    },
    compositePosture: (rank) => `Level ${rank} / 5 \u00b7 composite posture`,
    loadingMap: "LOADING MAP\u2026",
    liveMapIntro:
      "District risk posture and operational markers across the state.",
    inView: (n) => `${n} in view`,
    incidentsLabel: "incidents",
    amenity: { food: "Food", water: "Water", medical: "Med" },
    shelterDistanceNote:
      "Distances are straight-line from the selected district centre, not road distance.",
    markersGrouped: (n) => `${n} MARKERS \u00b7 OVERLAPS GROUPED`,
    centroidNote:
      "Discs mark district centroids and show risk posture \u2014 they are not administrative boundaries.",
    mapLive: "Live",
    mapDemoData: "Demo data",
    mapLayerMissing: "Layer missing",
    allLayersFromApi: "Every layer on this map came from the API.",
    weakestLayer: (what) => `Weakest layer on this map: ${what}.`,
    districtAria: (district, risk, incidents) =>
      `${district}, ${risk} risk, ${incidents} active incidents`,
    markersInDistrict: (n) => `, ${n} markers in district`,
    api: {
      serverWaking:
        "Server waking — the API sleeps after a few idle minutes and takes up to a minute to start. Retrying will work.",
      deviceOffline: "This device is offline",
      offlineLastKnown: "Offline — showing last known data",
      timedOut: "Request timed out",
      showingDemoData: (note) => `${note} — showing demo data`,
    },
    freshness: {
      offline: "OFFLINE",
      updatedAgo: (age) => `Updated ${age} ago`,
      locationStale: "LOCATION STALE",
      capacityStale: "CAPACITY STALE",
      sec: (n) => `${n} sec`,
      min: (n) => `${n} min`,
      hr: (n) => `${n} hr`,
    },
    liveMap: "Live Map",
    districtsByRisk: "Districts by risk",
    notVerifiedOnScene: "Not yet verified on scene",
    demoDataOnMap: "Demo data on this map:",
    stateOperations: "ResQNet \u00b7 State Operations",
    openNavigation: "Open navigation",
    closeNavigation: "Close navigation",
    sections: "Sections",
    logoAlt: "ResQNet \u2014 Disaster Response Platform",
    photoPreview: "Attached photo preview",
    dragPin: "Drag the pin to correct the location",
  },
};

const gu: PageStrings = {
  primitives: {
    loading: "લોડ થઈ રહ્યું છે…",
    retry: "ફરી પ્રયાસ",
    couldNotLoad: (what) => `${what} લોડ કરી શકાયું નથી`,
    noAnswer: "સર્વરે જવાબ આપ્યો નથી.",
    unknownNotClear:
      "આનો અર્થ એ નથી કે બતાવવા જેવું કંઈ નથી — તેને અજ્ઞાત ગણો, સલામત નહીં.",
    partialData: "આંશિક માહિતી.",
    what: {
      evaluationRun: "મૂલ્યાંકન દોડ",
      hotspotClusters: "હોટસ્પોટ ક્લસ્ટર",
      incidentReports: "આ ઘટના પાછળના અહેવાલો",
      facilities: "હોસ્પિટલો અને આશ્રયસ્થાનો",
      warningFeed: "ચેતવણી ફીડ",
    },
  },
  common: {
    retry: "ફરી પ્રયાસ કરો",
    search: "શોધો",
    allDistricts: "બધા જિલ્લા",
    district: "જિલ્લો",
    clear: "સાફ કરો",
    close: "બંધ કરો",
    cancel: "રદ કરો",
    save: "સાચવો",
    of: (shown, total) => `${total} માંથી ${shown}`,
    updated: "અપડેટ",
    noData: "માહિતી નથી",
    viewAll: "બધું જુઓ",
    demoData: "ડેમો માહિતી",
  },
  disaster: {
    cyclone: "ચક્રવાત",
    flood: "પૂર",
    fire: "આગ",
    earthquake: "ભૂકંપ",
    medical: "તબીબી",
    road_block: "રસ્તો બંધ",
    infrastructure: "માળખાકીય નુકસાન",
    missing_person: "ગુમ થયેલ વ્યક્તિ",
    heavy_rainfall: "ભારે વરસાદ",
    other: "અન્ય",
  },
  incidents: {
    title: "ઘટનાઓ",
    lead: "નાગરિકો અને સત્તાધિકારીના અહેવાલ, તેમની ચકાસણી સ્થિતિ સાથે.",
    loading: "ઘટનાઓ લોડ થઈ રહી છે…",
    loadError: "ઘટનાઓ લોડ કરી શકાઈ નથી",
    searchLabel: "ઘટનાઓ શોધો",
    searchPlaceholder: "સ્થળ, વર્ણન કે સંદર્ભ શોધો...",
    register: "રજિસ્ટર",
    noMatches: "આ ફિલ્ટર સાથે કોઈ ઘટના મળી નથી",
    chain: "ResQ ચેઇન",
    selectOne: "ચેઇન જોવા માટે ઘટના પસંદ કરો",
  },
  analytics: {
    title: "કટોકટી ગુપ્તચર કેન્દ્ર",
    lead: "પ્રતિસાદ કામગીરી, વર્ગીકરણ ગુણવત્તા અને અહેવાલોનું કેન્દ્રીકરણ.",
    loading: "વિશ્લેષણ લોડ થઈ રહ્યું છે…",
    loadError: "વિશ્લેષણ લોડ કરી શકાયું નથી",
    activeIncidents: "સક્રિય ઘટનાઓ",
    resolved: "ઉકેલાયેલ",
    peopleAffected: "અસરગ્રસ્ત લોકો",
    avgResponse: "સરેરાશ પ્રતિસાદ",
    teamsDeployed: "તૈનાત ટીમો",
    shelterOccupancy: "આશ્રય ભરાવો",
    highestRisk: "સૌથી વધુ જિલ્લા જોખમ",
    noDispatches: "આ સમયગાળામાં કોઈ રવાનગી નથી",
    accuracyTitle: "AI વર્ગીકરણ ચોકસાઈ",
    accuracyNote:
      "લેબલ કરેલા મૂલ્યાંકન સેટ સામે BE2 દ્વારા માપવામાં આવેલ — આ જીવંત આંકડો નથી.",
    typeAccuracy: "પ્રકાર ચોકસાઈ",
    severityWithin1: "ગંભીરતા ±1",
    dedupPrecision: "ડુપ્લિકેટ ચોકસાઈ",
    dedupRecall: "ડુપ્લિકેટ રિકોલ",
    accuracyCaveat:
      "ટેસ્ટ સેટ પરની ચોકસાઈ આગામી વાસ્તવિક અહેવાલ માટેની ચોકસાઈ નથી. દરેક વર્ગીકરણ સલાહરૂપ રહે છે અને ઓપરેટર તેની પુષ્ટિ કરે છે.",
    hotspots: "અહેવાલ કેન્દ્રો",
    hotspotsNote: "અહેવાલો ક્યાં કેન્દ્રિત છે. અહેવાલોની ઘનતા — પુષ્ટિ થયેલ જોખમ નહીં.",
    filters: "ફિલ્ટર",
    period: "સમયગાળો",
    today: "આજે",
    days7: "7 દિવસ",
    days30: "30 દિવસ",
    custom: "કસ્ટમ",
    disaster: "આપત્તિ",
    byType: "પ્રકાર પ્રમાણે",
    responseTimes: "પ્રતિસાદ સમય",
    shortages: "અછત",
    insights: "તારણો",
    severity: "ગંભીરતા",
    status: "સ્થિતિ",
    customDays: "દિવસોમાં કસ્ટમ સમયગાળો",
    noClusters: "હાલના સંગ્રહમાં કોઈ ક્લસ્ટર નથી",
    reportToDispatch: "અહેવાલ → રવાનગી",
    demoDistrictRisk: "ડેમો જિલ્લા જોખમ",
    observations: "અવલોકનો",
    observationsNote: "હાલ દેખાતી હરોળમાંથી ગણતરી કરેલ.",
    nothingNotable: "આ પસંદગીમાં નોંધપાત્ર કંઈ નથી",
    scope: (shown, total, districts) =>
      `${total} માંથી ${shown} ઘટના · ${districts} જિલ્લા દૃશ્યમાં`,
    demoFigures: " — ડેમો આંકડા",
    noTriageNote:
      "અહેવાલ → વર્ગીકરણ બતાવાતું નથી: ઘટના કરારમાં `triaged_at` સમયમુદ્રા નથી, તેથી તે ગણી શકાતું નથી.",
    insightSeverity: { critical: "ગંભીર", warning: "ચેતવણી", info: "માહિતી" },
    trend: "ઘટના વલણ",
    trendNote: "દરેક સમયગાળામાં ખૂલેલી ઘટનાઓ અને અહેવાલો.",
    incidentType: "ઘટના પ્રકાર",
    incidentTypeNote: "પ્રકાર પ્રમાણે ઘટનાઓની સંખ્યા.",
    districtRisk: "જિલ્લા જોખમ",
    districtRiskNote: "જિલ્લા પ્રમાણે સક્રિય ઘટનાઓ; દરેક પટ્ટી પાસે જોખમ સ્તર દર્શાવેલ છે.",
    responseTime: "પ્રતિસાદ સમય",
    responseTimeNote:
      "ઘટનાના સમયગાળા પરથી અહેવાલ → રવાનગી અને અહેવાલ → ઉકેલ.",
    shelterCapacity: "આશ્રય ક્ષમતા",
    shelterCapacityNote: "કુલ ક્ષમતા સામે વપરાયેલી જગ્યાઓ.",
    utilisation: "સંસાધન વપરાશ",
    utilisationNote: "ઉપલબ્ધ સામે તૈનાત એકમો.",
    pulseDistribution: "ResQ પલ્સ વિતરણ",
    pulseDistributionNote: "દરેક જોખમ સ્તરે કેટલા જિલ્લા છે.",
    districtComparison: "જિલ્લા સરખામણી",
    districtTableCaption:
      "જિલ્લા પ્રમાણે જોખમ, ઘટનાઓ, આશ્રયસ્થાનો, ટીમો અને રવાનગી સમય",
    table: {
      district: "જિલ્લો",
      risk: "જોખમ",
      incidents: "ઘટનાઓ",
      shelters: "આશ્રયસ્થાનો",
      teams: "ટીમો",
      affected: "અસરગ્રસ્ત",
      avgDispatch: "સરેરાશ રવાનગી",
    },
    insight: {
      p1NotDispatched: (n) => `${n} P1 ઘટના હજુ રવાના કરાઈ નથી`,
      waitingLongest: (code) => `${code} સૌથી લાંબા સમયથી રાહ જોઈ રહી છે.`,
      shortage: (kind) => `${kind} ની અછત`,
      shortageNone: "આ પ્રકારનું કોઈ એકમ ક્યાંય ઉપલબ્ધ નથી.",
      shortageSome: "ખુલ્લી ઘટનાઓને આ પ્રકારના મુક્ત એકમો કરતાં વધુની જરૂર છે.",
      shortageEvidence: (required, available, shortage) =>
        `જરૂરી ${required} · ઉપલબ્ધ ${available} · અછત ${shortage}`,
      criticalDistricts: (n) => `${n} જિલ્લા ગંભીર જોખમમાં`,
      criticalDistrictsNote:
        "આ જિલ્લાઓમાં જોખમ અને સંપર્કનું સૌથી ઊંચું સંયોજન છે.",
      sheltersOpen: (n) => `${n} આશ્રયસ્થાન ખુલ્લાં`,
      sheltersFull: (full, near) =>
        `${full} આશ્રયસ્થાન ભરાયેલાં, ${near} ક્ષમતાની નજીક`,
      sheltersFullNote:
        "આ ભરાઈ જાય તે પહેલાં આવનારાઓને બીજે વાળવા જોઈએ.",
      conflicting: (n) => `${n} ઘટનામાં વિરોધાભાસી અહેવાલ`,
      conflictingNote:
        "સ્રોતો પ્રમાણ કે સ્થળ અંગે અસંમત છે. પ્રતિસાદ વધારતાં પહેલાં ખાતરી કરો.",
      lowConfidence: (n) => `${n} અહેવાલ મેન્યુઅલ ચકાસણી મર્યાદાથી નીચે`,
      lowConfidenceNote:
        "વર્ગીકરણકર્તા આ વિશ્વાસપૂર્વક વાંચી શક્યું નથી. વ્યક્તિએ પાછો કૉલ કરવો જોઈએ.",
      unverifiedSevere: (n) => `${n} ગંભીર ઘટના માત્ર એક જ સ્રોત પર આધારિત`,
      unverifiedSevereNote:
        "ગંભીરતા ઊંચી છે પણ હજુ કોઈએ અહેવાલની પુષ્ટિ કરી નથી.",
      minutes: (n) => `${n} મિનિટ`,
    },
  },
  field: {
    loading: "તમારું કાર્ય લોડ થઈ રહ્યું છે…",
    loadErrorTitle: "કંટ્રોલ રૂમ સાથે સંપર્ક થઈ શક્યો નથી",
    noAssignmentTitle: "કોઈ સક્રિય કાર્ય નથી",
    loadingIncident: "ઘટના લોડ થઈ રહી છે…",
    incidentErrorTitle: "ઘટના લોડ કરી શકાઈ નથી",
    severity: "ગંભીરતા",
    reported: "જાણ કરેલ",
    notVerified: "ઘટનાસ્થળે હજુ ચકાસાયેલ નથી",
    situation: "પરિસ્થિતિ",
    summary: "સારાંશ",
    peopleAffected: "અસરગ્રસ્ત લોકો",
    hazards: "જણાવેલ જોખમો",
    updateStatus: "સ્થિતિ અપડેટ કરો",
    arrived: "ઘટનાસ્થળે પહોંચ્યા",
    completed: "પૂર્ણ",
    enRoute: "રસ્તામાં",
    situationUpdate: "પરિસ્થિતિ અપડેટ",
    send: "અપડેટ મોકલો",
    sending: "મોકલાઈ રહ્યું છે…",
    notes: "નોંધ",
    resolvedByResponder: "આ ઘટના ઉકેલાયેલી તરીકે ચિહ્નિત કરો",
    roadAccess: "રસ્તાની પહોંચ",
    additionalResources: "વધારાના સંસાધનોની જરૂર",
    yourUnit: "તમારું એકમ",
    navigate: "Google Maps માં માર્ગ જુઓ",
    fieldVerified: "ઘટનાસ્થળે ચકાસાયેલ",
    hazardsCaveat:
      "ઉપરના જોખમો જણાવ્યા અને વર્ગીકૃત કર્યા મુજબ છે. જાતે ન જુઓ ત્યાં સુધી તેને અપુષ્ટ ગણો.",
    noOtherUnits: "બીજું કોઈ એકમ સોંપાયેલ નથી.",
    currentStatus: "હાલની સ્થિતિ",
    assignmentComplete: "કાર્ય પૂર્ણ.",
    updateSituation: "પરિસ્થિતિ અપડેટ કરો",
    unreachableDetail:
      "સર્વરે જવાબ આપ્યો નથી. આનો અર્થ એ નથી કે તમારું કોઈ કાર્ય નથી.",
    doNotStandDown:
      "આને “કામ બંધ” ન સમજો. સ્થળ છોડતાં પહેલાં રેડિયો દ્વારા અથવા આ નંબર પર તમારું કાર્ય ખાતરી કરો",
    noAssignmentHint:
      "કંટ્રોલ રૂમ તમારું એકમ રવાના કરશે કે તરત જ તમારી ઘટના અહીં દેખાશે.",
    statusError: "સ્થિતિ અપડેટ કરી શકાઈ નથી",
    notEstimated: "અંદાજ નથી",
    aiConfidence: "AI વિશ્વાસ",
    evidence: "પુરાવા",
    suggestedActions: "સૂચવેલ પગલાં",
    suggestedActionsNote: "સલાહરૂપ — ઘટનાસ્થળે તમારું મૂલ્યાંકન આના પર ભારે પડે છે.",
    assignedUnits: "આ ઘટના માટે સોંપાયેલ",
    quickActions: "ઝડપી પગલાં",
    quickActionsNote: "કંટ્રોલ રૂમને એક સંકેત મોકલે છે.",
    etaNote: "સીધી રેખાનો અંદાજ — માર્ગ મુજબનો ETA નથી",
    lastChangeBy: "છેલ્લો ફેરફાર:",
    sev: "ગંભીરતા",
    sendError: "અપડેટ મોકલી શકાયું નથી",
    signalError: "સંકેત મોકલી શકાયો નથી",
    action: {
      assigned: "સ્વીકાર્યું",
      en_route: "રસ્તામાં",
      on_scene: "ઘટનાસ્થળે",
      completed: "પૂર્ણ",
      cancelled: "રદ",
    },
    updatesSent: (n) =>
      `આ ઉપકરણ પરથી ${n} પરિસ્થિતિ અપડેટ મોકલાયા. બેકએન્ડ સ્વીકારે પછી કંટ્રોલ રૂમની માહિતી અપડેટ થશે.`,
    form: {
      lead: "તમે અહીં જે નોંધો છો તે જણાવેલી માહિતીની જગ્યા લે છે. હાલનું મૂલ્ય રાખવા માટે ખાનું ખાલી છોડો.",
      severityAsFound: "તમને જણાય તે મુજબ ગંભીરતા",
      hazardsPresent: "હાજર જોખમો",
      correctedLocation: "સુધારેલું સ્થળ",
      resolvedHere: "આ સ્થળે ઘટના ઉકેલાઈ ગઈ",
      notesHint: "કંટ્રોલ રૂમને શું જાણવું જરૂરી છે",
      locationUnavailable:
        "આ ઉપકરણ પર સ્થળ ઉપલબ્ધ નથી. તેના બદલે નોંધમાં વર્ણન કરો.",
      fixFailed: "સ્થાન મળી શક્યું નથી. નોંધમાં સાચું સ્થળ લખો.",
      gettingFix: "સ્થાન મેળવાઈ રહ્યું છે…",
      useMyPosition: "મારું હાલનું સ્થાન વાપરો",
    },
  },
  resources: {
    title: "સંસાધનો",
    lead: "રાજ્યભરમાં એકમો, હોસ્પિટલો, આશ્રયસ્થાનો અને સેન્સર.",
    loading: "સંસાધનો લોડ થઈ રહ્યા છે…",
    loadErrorTitle: "એકમો લોડ કરી શકાયા નથી",
    capabilityDemand: "ક્ષમતા માંગ",
    covered: "આવરી લેવાયેલ",
    short: "અછત",
    filter: "ફિલ્ટર",
    searchLabel: "એકમો, સુવિધાઓ અને સેન્સર શોધો",
    searchPlaceholder: "કૉલસાઇન, બેઝ, ક્ષમતા, સુવિધા શોધો…",
    units: "એકમો",
    facilities: "હોસ્પિટલો અને આશ્રયસ્થાનો",
    sensors: "સેન્સર",
    callsign: "કૉલસાઇન",
    kind: "પ્રકાર",
    status: "સ્થિતિ",
    base: "બેઝ",
    eta: "પહોંચવાનો સમય",
    noUnits: "આ ફિલ્ટર સાથે કોઈ એકમ મળ્યું નથી",
    beds: "પથારી",
    capacity: "ક્ષમતા",
    clearFilters: "ફિલ્ટર સાફ કરો",
    clearAFilter: "શોધ વિસ્તારવા માટે કોઈ ફિલ્ટર હટાવો.",
    demandNote:
      "દરેક ખુલ્લી ઘટના માટે જરૂરી એકમ પ્રકારોની સરખામણી હાલ ઉપલબ્ધ એકમો સાથે.",
    facilitiesNote: "પથારીની સંખ્યા છેલ્લે જણાવેલ આંકડા છે, અનામત નથી.",
    sensorsNote: "રીડિંગ, હાર્ટબીટ અને આરોગ્ય અલગ અલગ નોંધાય છે.",
    refresh: "તાજું કરો",
    refreshing: "તાજું થઈ રહ્યું છે…",
    tableCaption: "સ્થિતિ, સોંપણી, બેઝ અને સ્થાન તાજગી સાથે પ્રતિસાદ એકમો",
    assignment: "સોંપણી",
    capabilities: "ક્ષમતાઓ",
    locationUpdated: "સ્થાન અપડેટ",
    noFacilities: "આ ફિલ્ટર સાથે કોઈ સુવિધા મળી નથી",
    noSensors: "આ ફિલ્ટર સાથે કોઈ સેન્સર મળ્યું નથી",
    noBedCapacity: "પથારીની ક્ષમતા જણાવાઈ નથી",
    nearCapacity: "ક્ષમતાની નજીક",
    noReading: "કોઈ રીડિંગ નથી",
    reading: "રીડિંગ",
    heartbeat: "હાર્ટબીટ",
    noHeartbeatNote:
      "કોઈ હાર્ટબીટ નથી. રીડિંગ ન હોવું એ પરિસ્થિતિ સામાન્ય હોવાનો પુરાવો નથી.",
    thresholdNote:
      "રીડિંગ તેની મર્યાદા વટાવી ગયું છે. પુષ્ટિ ગણતાં પહેલાં ખાતરી કરો.",
  },
  shelters: {
    title: "આશ્રયસ્થાનો",
    lead: "રાહત આશ્રયસ્થાનો, તેમનો ભરાવો અને ઉપલબ્ધ સુવિધાઓ.",
    loading: "આશ્રયસ્થાનો લોડ થઈ રહ્યા છે…",
    loadErrorTitle: "આશ્રયસ્થાનો લોડ કરી શકાયા નથી",
    occupancy: "ભરાવો",
    capacity: "ક્ષમતા",
    open: "ખુલ્લું",
    nearlyFull: "લગભગ ભરાયેલ",
    full: "ભરાયેલ",
    nearest: "તમારી સૌથી નજીક",
    distanceNote: "સીધી રેખાનું અંતર, રસ્તાનું અંતર નહીં.",
    facilities: "સુવિધાઓ",
    contact: "સંપર્ક",
    noMatches: "આ ફિલ્ટર સાથે કોઈ આશ્રયસ્થાન મળ્યું નથી",
    searchPlaceholder: "નામ કે સરનામું શોધો...",
    searchLabel: "આશ્રયસ્થાનો શોધો",
    clearAFilter: "શોધ વિસ્તારવા માટે કોઈ ફિલ્ટર હટાવો.",
    directions: "દિશા",
    safeRoute: "સલામત માર્ગ",
    illustrativeRoute: "દૃષ્ટાંતરૂપ માર્ગ.",
    hazardsRouted: "જાણીતા જોખમો ટાળીને માર્ગ",
    hazardsCaveat:
      "માત્ર ResQNet ને જણાવાયેલા જોખમો ધ્યાનમાં લેવાય છે. બીજા પણ હોઈ શકે.",
    noRoute: "કોઈ માર્ગ પસંદ કરેલ નથી",
    noRouteHint: "સૂચવેલ માર્ગ જોવા માટે આશ્રયસ્થાન પર સલામત માર્ગ પસંદ કરો.",
    food: "ભોજન",
    water: "પાણી",
    medical: "તબીબી",
    accessible: "સુલભ",
    summary: (open, occupancy, capacity) =>
      `${open} ખુલ્લાં · ${capacity} માંથી ${occupancy} જગ્યા વપરાશમાં`,
    placesOf: (occupancy, capacity, pct) => `${capacity} માંથી ${occupancy} જગ્યા (${pct}%)`,
    occupancyStale: "વપરાશ જૂનો",
    staleNote: (minutes) =>
      `આ આંકડો ${minutes} મિનિટ જૂનો છે — લોકોને મોકલતાં પહેલાં ફોનથી ખાતરી કરો.`,
    occupancyAt: (name) => `${name} માં વપરાશ`,
  },
  missing: {
    privacyNote:
      "આ રજિસ્ટરમાં કોઈને ઓળખવા માટે જરૂરી હોય તેટલું જ દેખાય છે. સંપર્ક વિગતો, સરનામાં અને જન્મતારીખ કેસ અધિકારી પાસે રહે છે અને અહીં પ્રકાશિત થતી નથી. તમે કોઈને ઓળખતા હો તો જિલ્લા કટોકટી લાઇન પર કૉલ કરો",
    privacyNoteTail: ".",
    title: "ગુમ થયેલ વ્યક્તિઓ",
    lead: "કટોકટી પછી ગુમ થયેલ લોકોના અહેવાલ.",
    loading: "રેકોર્ડ લોડ થઈ રહ્યા છે…",
    loadErrorTitle: "રેકોર્ડ લોડ કરી શકાયા નથી",
    reportedMissing: "ગુમ હોવાની જાણ",
    found: "મળી ગયા",
    lastSeen: "છેલ્લે જોવાયા",
    age: "ઉંમર",
    noMatches: "આ ફિલ્ટર સાથે કોઈ રેકોર્ડ મળ્યો નથી",
    searchPlaceholder: "નામ, વિસ્તાર કે સંદર્ભ શોધો…",
    demoNote: "ડેમો રેકોર્ડ — આ બિલ્ડ પાછળ ગુમ વ્યક્તિઓની કોઈ નોંધણી નથી.",
    ladder: "ગુમ → સંભવિત મેળ → મળી આવ્યા → પરિવાર સાથે",
    searchLabel: "રજિસ્ટરમાં શોધો",
    showReunited: "પરિવાર સાથે મળેલા કેસ બતાવો",
    lastSeenAt: "છેલ્લે જોવાયા:",
    at: "સ્થળ:",
    caseOfficer: "કેસ અધિકારી:",
    noPhoto: "ફાઇલમાં કોઈ ફોટો નથી.",
    reunitedHidden: "ઉપરનું ખાનું ટિક ન કરો ત્યાં સુધી પરિવાર સાથે મળેલા કેસ છુપાયેલા રહે છે.",
  },
  weather: {
    rainfall7d: "7 દિવસનો વરસાદ",
    sourceNote:
      "સ્રોત: IMD, NDMA. ResQNet સાથે કોઈ જીવંત હવામાન જોડાણ નથી — આ પાનાના આંકડા નિદર્શન માટેના નમૂના છે.",
    title: "હવામાન",
    lead: "જિલ્લા ચેતવણીઓ, વરસાદ અને પવનનો અંદાજ.",
    loading: "હવામાન લોડ થઈ રહ્યું છે…",
    alerts: "ચેતવણીઓ",
    forecast: "આગાહી",
    noAlerts: "કોઈ સક્રિય હવામાન ચેતવણી નથી",
    demoNote: "ડેમો માહિતી — કોઈ જીવંત IMD ફીડ નથી",
    issued: "જારી",
    source: "સ્રોત",
    loadError: "હવામાન ચેતવણીઓ લોડ કરી શકાઈ નથી",
    activeWarnings: "સક્રિય ચેતવણીઓ",
    rainfall: "વરસાદ",
    mmPerDay: "દરરોજ મિલિમીટર",
    windTemp: "પવન અને તાપમાન",
    windTempNote: "મહત્તમ પવન (કિમી/કલાક) અને મહત્તમ તાપમાન (°C)",
    windKph: "પવન કિમી/ક",
    maxC: "મહત્તમ °C",
    noWarnings: "આ ફિલ્ટર સાથે કોઈ ચેતવણી મળી નથી",
  },
  volunteers: {
    summary: (open, districts) =>
      `${districts} જિલ્લામાં ${open} વણદાવેલી વિનંતી`,
    claimedBy: (org) => ` · ${org} દ્વારા દાવો`,
    mark: (status) => `${status} ચિહ્નિત કરો`,
    reliefDemoNote:
      "અહીં કરેલા સ્થિતિ ફેરફાર નિદર્શન માટે આ ઉપકરણ પર જ રહે છે. તે હજી રાજ્ય કંટ્રોલ રૂમને મોકલાતા નથી — સંકલન એન્ડપોઇન્ટ હજી બાકી છે.",
    quantity: (amount, unit, kind) => `${amount} ${unit} — ${kind}`,
    title: "સ્વયંસેવકો",
    lead: "પ્રશિક્ષિત સ્વયંસેવકો અને તેમની તૈનાતી.",
    loading: "સ્વયંસેવકો લોડ થઈ રહ્યા છે…",
    skills: "કૌશલ્ય",
    available: "ઉપલબ્ધ",
    deployed: "તૈનાત",
    register: "સ્વયંસેવક તરીકે નોંધણી કરો",
    demoNote: "ડેમો યાદી — આ બિલ્ડમાં નોંધણી સાચવવામાં આવતી નથી.",
    noMatches: "આ ફિલ્ટર સાથે કોઈ વિનંતી મળી નથી",
    reliefTitle: "સ્વયંસેવકો અને NGO",
    searchLabel: "રાહત વિનંતીઓ શોધો",
    loadError: "રાહત વિનંતીઓ લોડ કરી શકાઈ નથી",
    searchPlaceholder: "સ્થળ, સંદર્ભ કે સંસ્થા શોધો...",
  },
  support: {
    title: "સહાય",
    lead: "હેલ્પલાઇન, માર્ગદર્શન અને કંટ્રોલ રૂમ સુધી પહોંચવાની રીત.",
    helplines: "કટોકટી નંબર",
    faq: "સામાન્ય પ્રશ્નો",
    contactControlRoom: "કંટ્રોલ રૂમનો સંપર્ક કરો",
    callBanner: "કટોકટીમાં 112 પર કૉલ કરો",
    notAReplacement:
      "ResQNet નાગરિકો, બચાવકર્મીઓ અને વિભાગો વચ્ચે સંકલનમાં મદદ કરે છે. તે કટોકટી કૉલનો વિકલ્પ નથી, અને અહીં અહેવાલ મોકલવાથી જાતે મદદ આવી જતી નથી.",
    specialisedLinesNote:
      "112 બધી સેવાઓ સુધી પહોંચે છે. નીચેની લાઇનો ખાસ સેવા માટે છે \u2014 તમને ખબર હોય કે કઈ સેવા જોઈએ ત્યારે જ તે વાપરો.",
    queuedWaiting: (n) => `આ ઉપકરણ પર ${n} સબમિશન બાકી છે`,
    queuedItem: (kind, label, time) => `${kind} — ${label} (કતારમાં ${time})`,
    queuedNote:
      "આ હજુ કંટ્રોલ રૂમ સુધી પહોંચ્યા નથી. જોડાણ પાછું આવતાં આપોઆપ મોકલાઈ જશે.",
    accessibility: "સુલભતા",
    a11yKeyboard:
      "દરેક સ્ક્રીન ફક્ત કીબોર્ડથી ચાલે છે. ફોકસ હંમેશા દેખાય છે, અને દરેક પાના પર “મુખ્ય સામગ્રી પર જાઓ” લિંક પહેલી હોય છે.",
    a11yVoice:
      "બ્રાઉઝર પરવાનગી આપે ત્યાં રિપોર્ટ ફોર્મ ગુજરાતી, હિન્દી અને અંગ્રેજીમાં વૉઇસ ઇનપુટ સ્વીકારે છે, અને મોકલતાં પહેલાં તમે લખાણ સુધારી શકો છો.",
    offlineReports:
      "ઑફલાઇન મોકલેલા અહેવાલ આ ઉપકરણ પર સચવાય છે અને જોડાણ પાછું આવતાં મોકલાય છે. બેનર કેટલા બાકી છે તે જણાવે છે.",
    a11yColour:
      "સ્થિતિ ક્યારેય માત્ર રંગથી દર્શાવાતી નથી — દરેક રંગીન બેજ તેનો અર્થ શબ્દોમાં પણ જણાવે છે.",
    a11yTouch:
      "કટોકટી નિયંત્રણો મોટા ટચ વિસ્તાર વાપરે છે અને રિપોર્ટ ફોર્મ ફોન પર એક હાથે ચાલે છે.",
    a11yMotion:
      "એનિમેશન માત્ર બે સૂચકો પૂરતું છે અને તમારું ઉપકરણ ઓછી ગતિ માગે તો સંપૂર્ણ બંધ થાય છે.",
    a11yAssistance:
      "ખાસ સહાય વિકલ્પો — વૃદ્ધ, બાળક, વ્હીલચેર, તબીબી — રિપોર્ટ ફોર્મ પર છે જેથી બચાવકર્મી તૈયાર થઈને આવે.",
    networkFails: "નેટવર્ક બંધ થાય તો",
    call112: "112 પર કૉલ કરો.",
    voiceWorks:
      "નબળા સિગ્નલ પર પણ વૉઇસ કૉલ ચાલે છે, જ્યાં ડેટા જોડાણ ચાલતું નથી.",
    staleNote:
      "તમે છેલ્લે લોડ કરેલી માહિતી સ્ક્રીન પર રહે છે અને હાલની તરીકે નહીં, જૂની તરીકે ચિહ્નિત થાય છે.",
    faqs: FAQ_GU,
  },
  reports: {
    title: "અહેવાલો",
    lead: "પરિસ્થિતિ અહેવાલ, નુકસાન આકારણી અને દૈનિક સંક્ષેપ.",
    loading: "અહેવાલો લોડ થઈ રહ્યા છે…",
    loadErrorTitle: "અહેવાલો લોડ કરી શકાયા નથી",
    searchLabel: "અહેવાલો શોધો",
    searchPlaceholder: "શીર્ષક, જિલ્લો કે સંદર્ભ શોધો…",
    kind: "પ્રકાર",
    status: "સ્થિતિ",
    sort: "ક્રમ",
    newest: "નવા પહેલાં",
    oldest: "જૂના પહેલાં",
    byTitle: "શીર્ષક",
    byKind: "પ્રકાર",
    noMatches: "આ ફિલ્ટર સાથે કોઈ અહેવાલ મળ્યો નથી",
    preview: "પૂર્વાવલોકન",
    selectOne: "પૂર્વાવલોકન માટે અહેવાલ પસંદ કરો",
    exportCsv: "અનુક્રમણિકા નિકાસ (CSV)",
    exportIndex: (n) => `અનુક્રમણિકા નિકાસ (${n})`,
    countOf: (shown, total) => `${total} માંથી ${shown}`,
    publicationState: { published: "પ્રકાશિત", draft: "મુસદ્દો", archived: "આર્કાઇવ" },
    print: "છાપો / PDF તરીકે સાચવો",
    reportEmergency: "કટોકટીની જાણ કરો",
    anyStatus: "કોઈપણ સ્થિતિ",
    titleAz: "શીર્ષક અ\u2013હ",
    reportType: "અહેવાલ પ્રકાર",
    index: "અનુક્રમણિકા",
    clearAFilter: "શોધ વિસ્તારવા માટે કોઈ ફિલ્ટર હટાવો.",
    stateWide: "રાજ્યવ્યાપી",
    docSummary: "સારાંશ",
    docReference: "સંદર્ભ",
    docPeriod: "સમયગાળો",
    docGenerated: "તૈયાર થયું",
    docIssuedBy: "જારી કરનાર",
    docMasthead: "રાજ્ય આપત્તિ વ્યવસ્થાપન સત્તામંડળ \u00b7 ResQNet",
    docGeneratedBy: (when) => `ResQNet દ્વારા તૈયાર \u00b7 ${when} IST`,
    docStatus: (status) => `સ્થિતિ: ${status}`,
    docSignatory: (name) => `${name} \u2014 અધિકૃત સહી કરનાર`,
    docFootnote:
      "આ અહેવાલના આંકડા તૈયાર થયા તે સમયના ResQNet ઓપરેશનલ ડેટાસેટમાંથી લેવાયા છે. જ્યાં માહિતી ઉપલબ્ધ ન હતી ત્યાં અંદાજ મૂકવાને બદલે તેને ચિહ્નિત કરાયું છે.",
  },
  dashboard: {
    queue: "ઘટના કતાર",
    incident: "ઘટના",
    selectIncident: "ઘટના પસંદ કરો",
    simulator: "સિમ્યુલેટર",
    start: "દૃશ્ય ચલાવો",
    stop: "બંધ કરો",
    reset: "રીસેટ",
    resetDone: "ડેમો માહિતી રીસેટ થઈ",
    live: "જીવંત",
    reconnecting: "ફરી જોડાઈ રહ્યું છે",
    demoData: "ડેમો માહિતી",
    sitrep: "પરિસ્થિતિ અહેવાલ",
    generating: "તૈયાર થઈ રહ્યું છે\u2026",
    language: "ભાષા",
    loadingMap: "જીવંત નકશો લોડ થઈ રહ્યો છે\u2026",
    commandCenter: "કટોકટી કમાન્ડ સેન્ટર",
    emergencyContacts: "કટોકટી સંપર્કો",
    monsoonResponse: "ચોમાસું પ્રતિસાદ",
    logACall: "કૉલ નોંધો",
    layers: "સ્તરો",
    cityView: "શહેર દૃશ્ય",
    connecting: "કંટ્રોલ રૂમ સાથે જોડાઈ રહ્યું છે\u2026",
    feedUnavailable: "ઘટના ફીડ ઉપલબ્ધ નથી",
    feedUnavailableNote:
      "અહીં ખાલી કતારનો અર્થ એ કે કંટ્રોલ રૂમ સુધી પહોંચી શકાયું નથી \u2014 શહેર શાંત છે એમ નહીં.",
    retry: "ફરી પ્રયાસ",
    mapLayers: "નકશા સ્તરો",
    aiGenerated: "AI નિર્મિત",
    situationReport: "પરિસ્થિતિ અહેવાલ",
    copy: "નકલ કરો",
    print: "છાપો",
    priorityIntake: "પ્રાથમિકતા નોંધણી",
    logCallTitle: "કટોકટી કૉલ નોંધો",
    logCallNote:
      "કૉલ કરનાર જે કહે તે કોઈપણ ભાષામાં લખો. AI તેને વર્ગીકૃત કરે, સ્થળ શોધે અને ડુપ્લિકેટ દૂર કરે છે.",
    whatHappening: "શું થઈ રહ્યું છે?",
    locationField: "સ્થળ (વિસ્તાર / સીમાચિહ્ન)",
    noGpsNote: "GPS નથી: વિસ્તારનું નામ અમદાવાદ ગેઝેટિયરમાંથી શોધાય છે.",
    cancel: "રદ કરો",
    active: "સક્રિય",
    p1Open: "P1 ખુલ્લી",
    unitsFree: "મુક્ત એકમો",
    avgToDispatch: "સરેરાશ રવાનગી સમય",
    searchIncidents: "ઘટના ક્રમાંક, શીર્ષક કે સ્થળ શોધો\u2026",
    logoAlt: "ResQNet લોગો",
    examplePlaceholder: "દા.ત. અખબારનગર અંડરપાસમાં ગાડી ફસાઈ છે, પાણી વધી રહ્યું છે",
    exampleLocation: "દા.ત. અખબારનગર અંડરપાસ",
    stopScenario: "દૃશ્ય બંધ કરો",
    scenarioStopped: "દૃશ્ય બંધ થયું",
    scenarioStarted: "દૃશ્ય શરૂ: અહેવાલો આવવા લાગશે",
    apiSilent: "API એ જવાબ આપ્યો નથી.",
    incidents: "ઘટનાઓ",
    responseUnits: "પ્રતિસાદ એકમો",
    facilities: "હોસ્પિટલો અને આશ્રયસ્થાનો",
    escalate: "ઉગ્ર બનાવો",
    resolve: "ઉકેલાયેલ કરો",
    acknowledge: "સ્વીકારો",
    controlRoom: "કંટ્રોલ રૂમ",
    couldNotSend: "મોકલી શકાયું નથી",
    runScenario: "દૃશ્ય ચલાવો",
    offline: "ઓફલાઇન",
    helpline: {
      emergency: "કટોકટી",
      ambulance: "એમ્બ્યુલન્સ",
      fire: "ફાયર",
      police: "પોલીસ",
      stateEoc: "રાજ્ય EOC",
      districtControl: "જિલ્લા કંટ્રોલ",
      childHelpline: "બાળ હેલ્પલાઇન",
      womenHelpline: "મહિલા હેલ્પલાઇન",
    },
    mapSummary: (incidents, units, facilities) =>
      `OSM \u00b7 ${incidents} ઘટના \u00b7 ${units} એકમ \u00b7 ${facilities} સુવિધા`,
    dispatched: (code) => `${code} રવાના કરાયું`,
    escalated: (code) => `${code} ઉગ્ર કરાયું`,
    resolved: (code) => `${code} ઉકેલાયું: એકમો મુક્ત`,
    mergedInto: (code) => `${code} માં ભેળવાયું (ડુપ્લિકેટ મળ્યું)`,
    created: (code) => `નવી ઘટના ${code} બનાવાઈ`,
    actionFailed: (action, why) => `${action} નિષ્ફળ: ${why}`,
    error: "ભૂલ",
  },
  flash: {
    compose: "ચેતવણી તૈયાર કરો",
    hazard: "જોખમ",
    area: "વિસ્તાર",
    headline: "શીર્ષક",
    detail: "વિગત",
    language: "ભાષા",
    preview: "પૂર્વાવલોકન",
    broadcast: "પ્રસારિત કરો",
    cancel: "રદ કરો",
    history: "મોકલેલી ચેતવણીઓ",
    noneSent: "હજુ કોઈ ચેતવણી મોકલાઈ નથી",
    sentAt: "મોકલ્યું",
    dismiss: "બંધ કરો",
    drill: "કવાયત",
    drillNote: "આ એક કવાયત છે. કોઈ પગલાંની જરૂર નથી.",
    massWarning: "સામૂહિક ચેતવણી \u00b7 માત્ર અધિકૃત ઓપરેટરો",
    flashAlert: "ResQNet ફ્લેશ ચેતવણી",
    simulation: "સિમ્યુલેશન",
    authorityNote:
      "મોડેલ ચેતવણી જારી કરી શકતું નથી. જારી કરનાર સત્તા તમે છો.",
    standalone: "કોઈ ઘટનામાંથી નહીં \u2014 સ્વતંત્ર ચેતવણી",
    allDistrictsWide: "બધા જિલ્લા (રાજ્યવ્યાપી)",
    stateWideConfirm:
      "રાજ્યવ્યાપી ચેતવણી દરેક જિલ્લા સુધી પહોંચે છે. આ હેતુસર છે તેની ખાતરી કરો.",
    exactlyWhatCitizenSees: "નાગરિકને બરાબર આ જ દેખાશે",
    emergencyAlert: "કટોકટી ચેતવણી",
    notRealPhone: "આ ખરેખરા ફોન સુધી પહોંચશે નહીં.",
    previewAlert: "ચેતવણી પૂર્વાવલોકન",
    send: "ફ્લેશ ચેતવણી મોકલો",
    close: "બંધ કરો",
    incident: "ઘટના",
    scenario: "દૃશ્ય",
    severity: "ગંભીરતા",
    affectedArea: "અસરગ્રસ્ત વિસ્તાર",
    refineArea: "વિસ્તાર સ્પષ્ટ કરો, દા.ત. દરિયાકાંઠો અને નીચાણવાળાં ગામો",
    areaDescription: "અસરગ્રસ્ત વિસ્તારનું વર્ણન",
    targetPopulation: "લક્ષ્ય વસ્તી",
    languages: "ભાષાઓ",
    message: "સંદેશ",
    issuingAuthority: "જારી કરનાર સત્તા",
    expiry: "સમાપ્તિ",
    viewSafeRoute: "સલામત માર્ગ જુઓ",
    nearestShelter: "નજીકનું આશ્રયસ્થાન",
    checkInRecorded: "ચેક-ઇન નોંધાયું",
    emergency112: "કટોકટી 112",
    deviceOnlyNote: "ફક્ત આ ઉપકરણ પર સાચવેલ \u2014 તે",
    viewIncident: "ઘટના જુઓ",
    simulatedAlert: "સિમ્યુલેટેડ ચેતવણી.",
    dismissAlert: "ચેતવણી બંધ કરો",
    issued: "જારી",
    source: "સ્રોત",
    estimatedReach: "અંદાજિત પહોંચ",
    historyTitle: "ફ્લેશ ચેતવણી ઇતિહાસ",
    simulateAlert: "ફ્લેશ ચેતવણી સિમ્યુલેટ કરો",
    demo: "ડેમો",
    showOnHandset: "સિમ્યુલેટેડ હેન્ડસેટ પર આ ચેતવણી બતાવો",
    withdraw: "આ ચેતવણી પાછી ખેંચો",
    district: "જિલ્લો",
    targetArea: "લક્ષ્ય વિસ્તાર",
    status: "સ્થિતિ",
    operator: "ઓપરેટર",
    allDistricts: "બધા જિલ્લા",
    severityLabel: { extreme: "અત્યંત ગંભીર", serious: "ગંભીર", advisory: "સલાહ" },
    severityAction: {
      extreme: "તરત જ રક્ષણાત્મક પગલાં લો",
      serious: "પગલાં લેવા તૈયાર રહો અને સત્તાવાર અપડેટ પર નજર રાખો",
      advisory: "માહિતગાર રહો અને અસરગ્રસ્ત વિસ્તાર ટાળો",
    },
    statusLabel: {
      draft: "ડ્રાફ્ટ",
      ready: "તૈયાર",
      sent: "મોકલેલ",
      expired: "સમાપ્ત",
      cancelled: "રદ",
    },
    scenarioLabel: {
      cyclone: "વાવાઝોડું",
      flash_flood: "આકસ્મિક પૂર",
      extreme_rain: "અતિ ભારે વરસાદ",
      major_fire: "મોટી આગ",
      chemical_leak: "રાસાયણિક / ગૅસ લીક",
      earthquake: "ભૂકંપ",
      dam_river: "ડેમ / નદી ચેતવણી",
      building_collapse: "ઇમારત ધરાશાયી",
      industrial_accident: "ઔદ્યોગિક અકસ્માત",
      evacuation: "સ્થળાંતર આદેશ",
      p1_life_threat: "P1 જીવલેણ ઘટના",
    },
    aiRecommendation: (pct) => `AI ભલામણ \u00b7 ${pct}% વિશ્વાસ`,
    reachNote: "લોકો \u2014 જિલ્લાની વસ્તી પરથી અંદાજિત, ઉપકરણ રજિસ્ટર નહીં",
    wordingNote:
      "શબ્દરચના દરેક ભાષા માટે પહેલેથી લખાયેલી છે અને પૂર્વાવલોકન તબક્કે તપાસાય છે \u2014 મોકલતી વખતે તેનું યાંત્રિક ભાષાંતર ક્યારેય થતું નથી.",
    approvingOperator: (name) => `મંજૂરી આપનાર ઓપરેટર: ${name}`,
    hours: (n) => `${n} કલાક`,
    until: (time) => `${time} સુધી`,
    back: "પાછળ",
    cancelAction: "રદ કરો",
    cannotBroadcast:
      "ResQNet નું ફ્રન્ટએન્ડ સેલ બ્રોડકાસ્ટ મોકલી શકતું નથી. મોકલવાથી ચેતવણી ફ્લેશ ચેતવણી ઇતિહાસમાં નોંધાય છે અને સિમ્યુલેટેડ નાગરિક હેન્ડસેટ પર દેખાય છે, જેથી સમગ્ર પ્રક્રિયા બતાવી શકાય.",
    expiresIn: (h) => `${h} કલાકમાં સમાપ્ત`,
    sending: "મોકલાઈ રહ્યું છે\u2026",
    imSafe: "હું સલામત છું",
    notWord: "નથી",
    callNowNote: "હજી કંટ્રોલ રૂમ સુધી પહોંચ્યું. જો હમણાં મદદ જોઈએ તો 112 પર કૉલ કરો.",
    simulatedAlertNote:
      "આ ResQNet ની ચેતવણી પ્રક્રિયાનું નિદર્શન છે. તે સરકારી સેલ બ્રોડકાસ્ટ નથી અને કોઈ ફોન પર મોકલાયું નથી. વાસ્તવિક જમાવટમાં મંજૂર ચેતવણી NDMA ના કોમન અલર્ટિંગ પ્રોટોકોલ ગેટવેને સોંપાય છે, જે પ્રસારણ કરે છે.",
    raised: (n) => `${n} જારી`,
    noWarnings: "આ સત્રમાં કોઈ ચેતવણી જારી થઈ નથી. વાપરો",
    noWarningsTail: "\u2014 કચ્છ વાવાઝોડાનું નિદર્શન ચલાવવા માટે.",
    simulateBold: "ફ્લેશ ચેતવણી સિમ્યુલેટ કરો",
    time: "સમય",
    langCol: "ભાષા",
    reached: (people) => `~${people} સુધી પહોંચ્યું`,
    replay: (id) => `${id} ફરી બતાવો`,
    cancelRow: (id) => `${id} રદ કરો`,
    historyFooter:
      "દરેક નોંધ સિમ્યુલેશન છે. ResQNet નું ફ્રન્ટએન્ડ સેલ બ્રોડકાસ્ટ મોકલતું નથી \u2014 વાસ્તવિક જમાવટમાં મંજૂર ચેતવણી NDMA ના કોમન અલર્ટિંગ પ્રોટોકોલ ગેટવેને સોંપાત.",
    people: (count) => `${count} લોકો`,
    sourceValue: "ResQNet \u00b7 કટોકટી પ્રતિસાદ નેટવર્ક",
  },
  closeOnes: {
    title: "નજીકના લોકોને સૂચના",
    lead: "તમે સુરક્ષિત હોવાની જાણ કરો ત્યારે નીચેના લોકોને પણ ખબર પડે છે.",
    add: "નજીકની વ્યક્તિ ઉમેરો",
    name: "નામ",
    phone: "ફોન",
    relation: "સંબંધ",
    save: "સાચવો",
    cancel: "રદ કરો",
    remove: "દૂર કરો",
    empty: "હજુ કોઈ ઉમેર્યું નથી. જેને સૌથી પહેલાં ખબર પડવી જોઈએ તેનાથી શરૂ કરો.",
    deviceOnly:
      "ફક્ત આ ઉપકરણ પર સાચવેલ. આ બિલ્ડમાં SMS ગેટવે નથી, તેથી હજુ કોઈ ફોન સુધી સંદેશ પહોંચતો નથી.",
    notifyOnSafe: "હું સુરક્ષિત હોવાની જાણ કરું ત્યારે તેમને સૂચિત કરો",
    toggleLabel: "હું સુરક્ષિત હોવાની જાણ કરું ત્યારે નજીકના લોકોને સૂચિત કરો",
    offNote:
      "અત્યારે તમારી ચેક-ઇન માત્ર કંટ્રોલ રૂમ જુએ છે. તમારા લોકોને પણ જણાવવા માટે આ ચાલુ કરો.",
    notifyBy: "કઈ રીતે સૂચિત કરવું",
    mobileNumber: "મોબાઇલ નંબર",
    channel: { sms: "SMS", call: "વૉઇસ કૉલ", whatsapp: "WhatsApp" },
    relationship: {
      spouse: "જીવનસાથી",
      parent: "માતા-પિતા",
      child: "સંતાન",
      sibling: "ભાઈ-બહેન",
      relative: "સગાં",
      neighbour: "પડોશી",
      friend: "મિત્ર",
      carer: "સંભાળ રાખનાર",
    },
    edit: (name) => `${name} સંપાદિત કરો`,
    removeNamed: (name) => `${name} દૂર કરો`,
    errName: "નામ દાખલ કરો.",
    errPhone: "10 અંકનો ભારતીય મોબાઇલ નંબર દાખલ કરો.",
    errDuplicate: "આ નંબર પહેલેથી સાચવેલો છે.",
    saveChanges: "ફેરફાર સાચવો",
    addContact: "સંપર્ક ઉમેરો",
  },
  recommendation: {
    demoRanking: "ડેમો ક્રમાંકન",
    notLive: "જીવંત નથી",
    demoNote: "આ એકમો ડેમો માહિતી છે, જીવંત કાફલો નથી.",
    staleNote:
      "ભલામણકર્તાએ આપેલો છેલ્લો જવાબ બતાવાય છે, હાલનો કાફલો નહીં.",
    confirm: "રવાના કરતાં પહેલાં ઉપલબ્ધતાની પુષ્ટિ કરો.",
    ranking: "એકમો ક્રમાંકિત થઈ રહ્યાં છે\u2026",
    none: "કોઈ ભલામણ ઉપલબ્ધ નથી",
    noneNote:
      "તેના બદલે એકમ યાદીમાંથી રવાના કરો \u2014 આ પેનલ માત્ર ક્રમ આપે છે, કોઈને મોકલવા માટે જરૂરી નથી.",
    tryAgain: "ફરી પ્રયાસ કરો",
    dispatched: "એકમો રવાના થયા. સમયરેખામાં તેમને જુઓ.",
    approved: "રવાનગી મંજૂર",
    dispatching: "રવાના થઈ રહ્યું છે\u2026",
    aiRecommends: "AI ભલામણ કરે \u00b7 ડિસ્પેચર મંજૂરી આપે",
    noAnswer: "ભલામણકર્તાએ જવાબ આપ્યો નથી.",
    failed: "રવાનગી નિષ્ફળ",
  },
  banner: {
    citizenReport: "નાગરિક અહેવાલ \u00b7 અપ્રમાણિત",
    warningIssued: "ચેતવણી જારી",
    demoWarning: "ડેમો ચેતવણી \u2014 જારી કરાઈ નથી",
    officialWarning: "સત્તાવાર ચેતવણી",
    warningFor: (hazard, district) => `${hazard} ચેતવણી \u00b7 ${district}`,
    viewDetails: "વિગતો જુઓ",
    findShelter: "આશ્રય શોધો",
    notifyDevice: "આ ઉપકરણ પર સૂચના આપો",
    notifyTitle: "આ ચેતવણી આ બ્રાઉઝરમાં, આ ઉપકરણ પર સૂચના તરીકે બતાવો",
    notified: "આ ઉપકરણ પર સૂચિત",
    dismissWarning: "આ ચેતવણી બંધ કરો",
    stateWide: "રાજ્યવ્યાપી",
    unverifiedNote: (source) =>
      `${source} દ્વારા જણાવાયું છે અને રાજ્ય કંટ્રોલ રૂમની ચકાસણીની રાહ જોવાય છે. આ બેનર માત્ર આ ઉપકરણ પર દેખાય છે \u2014 ResQNet ફોન પર પ્રસારણ કરતું નથી. કટોકટી માટે 112 પર કૉલ કરો.`,
    demoNote: (source) =>
      `વૉકથ્રૂ માટે ${source} ને આભારી નિદર્શન ચેતવણી. કશું જારી થયું નથી અને કોઈને જણાવાયું નથી. કટોકટી માટે 112 પર કૉલ કરો.`,
    officialNote: (source) =>
      `${source} દ્વારા જારી. ResQNet સત્તાવાર ચેતવણીઓ દર્શાવે છે \u2014 તે ફોન પર પ્રસારણ કરતું નથી. કટોકટી માટે 112 પર કૉલ કરો.`,
  },
  connectivity: {
    label: { online: "ઓનલાઇન", low: "નબળું જોડાણ", offline: "ઓફલાઇન" },
    note: {
      online: "રાજ્ય કંટ્રોલ રૂમ સાથે જોડાયેલ.",
      low: "નબળું જોડાણ. મોકલવામાં વધુ સમય લાગી શકે અને નિષ્ફળ જાય તો કતારમાં મુકાશે.",
      offline:
        "જોડાણ નથી. તમે જે કંઈ મોકલો તે આ ઉપકરણ પર સચવાશે અને ફરી ઓનલાઇન થતાં મોકલાશે.",
    },
    queued: (n) =>
      `${n} સબમિશન હજી આ ઉપકરણ પર છે \u2014 કંટ્રોલ રૂમને હજી મળ્યું નથી.`,
    call112: "તેના બદલે 112 પર કૉલ કરો",
    sending: "મોકલાઈ રહ્યું છે\u2026",
    sendNow: "હમણાં મોકલો",
    sent: (n) => `${n} કંટ્રોલ રૂમને મોકલાયું.`,
    failed: (n) => `${n} મોકલી શકાયું નહીં અને હજી રાહ જુએ છે. `,
    undeliverable: (n) =>
      `${n} આપોઆપ મોકલી શકાતું નથી \u2014 કૃપા કરી ફરીથી મોકલો.`,
    refused: (n) =>
      `${n} કંટ્રોલ રૂમે નકાર્યું અને તે જાતે ફરી મોકલાશે નહીં.`,
    reason: (why) => `કારણ: ${why}. `,
    tryAgain: () => "તેમ છતાં ફરી પ્રયાસ કરો",
  },
  charts: {
    count: "સંખ્યા",
    reports: "અહેવાલો",
    incidents: "ઘટનાઓ",
    noData: "આ ફિલ્ટર માટે કોઈ માહિતી નથી",
    noIncidents: "આ ફિલ્ટર માટે કોઈ ઘટના નથી",
    noActivity: "આ સમયગાળામાં કોઈ પ્રવૃત્તિ નથી",
    noCompleted: "આ સમયગાળામાં કોઈ પૂર્ણ પ્રતિસાદ નથી",
    noShelters: "આ પસંદગીમાં કોઈ આશ્રયસ્થાન નથી",
    noDistricts: "આ પસંદગીમાં કોઈ જિલ્લો નથી",
    noUnits: "આ પસંદગીમાં કોઈ એકમ નથી",
    showTable: "માહિતી કોષ્ટક બતાવો",
    hideTable: "માહિતી કોષ્ટક છુપાવો",
    reportToDispatch: "અહેવાલ \u2192 રવાનગી",
    reportToResolved: "અહેવાલ \u2192 ઉકેલ",
    inUse: "વપરાશમાં",
    free: "ખાલી",
    activeIncidents: "સક્રિય ઘટનાઓ",
    committed: "રોકાયેલ",
    available: "ઉપલબ્ધ",
    districts: "જિલ્લા",
  },
  drawer: {
    selectIncident: "એક ઘટના પસંદ કરો",
    close: "બંધ કરો",
    sev: "ગંભીરતા",
    overview: "ઝાંખી",
    reports: "અહેવાલો",
    aiSummary: "AI પરિસ્થિતિ સારાંશ",
    confidenceTag: (pct) => `${pct}% વિશ્વાસ`,
    locationUnverified:
      "સ્થળ અપ્રમાણિત: રવાના કરતાં પહેલાં કૉલર સાથે ખાતરી કરો",
    summarising: "અહેવાલોનો સારાંશ બની રહ્યો છે\u2026",
    reasoning: "તર્ક:",
    reportsDisagree: "અહેવાલો અસંમત છે:",
    modelConfidence: "મોડેલનો વિશ્વાસ",
    recommendedActions: "ભલામણ કરેલ પગલાં",
    dispatchRecommendations: "રવાનગી ભલામણો",
    activityTimeline: "પ્રવૃત્તિ સમયરેખા",
    resolve: "ઉકેલો",
    resolved: "ઉકેલાયું",
    escalate: "ઉગ્ર કરો",
    escalated: "ઉગ્ર કરાયું",
    independentSources: (n) => `${n} સ્વતંત્ર સ્રોત`,
    reportReceived: "અહેવાલ મળ્યો",
    firstOf: (n) => `${n} અહેવાલમાંથી પહેલો`,
    aiTriage: "AI વર્ગીકરણ",
    triageDetail: (type, severity, priority) =>
      `${type} \u00b7 ગંભીરતા ${severity} \u00b7 ${priority}`,
    deduplication: "ડુપ્લિકેટ દૂર",
    mergedInto: (n, code) => `${n} અહેવાલ ${code} માં ભેળવાયા`,
    currentState: "વર્તમાન સ્થિતિ",
    now: "હમણાં",
  },
  misc: {
    location: {
      title: "સ્થળની પરવાનગી",
      on: "સ્થળ ચાલુ છે. તમારી આસપાસ શું થઈ રહ્યું છે તે દેખાશે.",
      share: "તમારું સ્થળ શેર કરો જેથી તમારી આસપાસ શું થઈ રહ્યું છે તે બતાવી શકીએ.",
      usedFor:
        "નજીકનાં આશ્રયસ્થાન, સલામત માર્ગ અને સ્થાનિક ચેતવણીઓ માટે વપરાય છે. તમે ક્યાં જાઓ છો તે અમે ક્યારેય ટ્રૅક કરતા નથી.",
      unsupported:
        "આ બ્રાઉઝર સ્થળ શેર કરી શકતું નથી. જાણ કરવાનું ચાલુ જ રહે છે \u2014 નજીકનું સીમાચિહ્ન લખો.",
      asking: "પૂછાઈ રહ્યું છે\u2026",
      shareButton: "મારું સ્થળ શેર કરો",
      blocked:
        "તમારું બ્રાઉઝર આ રોકી રહ્યું છે. સાઇટ સેટિંગ્સમાં તેને ફરી ચાલુ કરી શકો \u2014 તેના વિના પણ જાણ કરી શકાય છે.",
      denied: "પરવાનગી નકારાઈ. તમે સીમાચિહ્ન લખીને પણ કટોકટીની જાણ કરી શકો છો.",
      unavailable:
        "અત્યારે સ્થળ ઉપલબ્ધ નથી. તમે સીમાચિહ્ન લખીને પણ જાણ કરી શકો છો.",
    },
    imSafe: {
      close: "બંધ કરો",
      recorded: "ચેક-ઇન નોંધાયું",
      savedLocally: "ફક્ત આ ઉપકરણ પર સાચવ્યું",
      contactsNotified: "તમારા સંપર્કોને જાણ કરાશે કે તમે સલામત છો.",
      noContactsNotified: "તમારી સ્થિતિ નોંધાઈ. કોઈ સંપર્કને જાણ કરાઈ નથી.",
      offlineNote:
        "અત્યારે જોડાણ નથી, તેથી આ કંટ્રોલ રૂમ કે તમારા સંપર્કો સુધી પહોંચ્યું નથી. ફરી ઓનલાઇન થતાં તે આપોઆપ મોકલાશે.",
      name: "નામ",
      district: "જિલ્લો",
      recordedAt: "નોંધાયું",
      yourName: "તમારું નામ",
      districtYouAreIn: "તમે જે જિલ્લામાં છો",
      message: "સંદેશ (વૈકલ્પિક)",
      messagePlaceholder: "પરિવાર સાથે આશ્રયસ્થાનમાં છું",
      notifyCloseOnes: "મારા નજીકના લોકોને જાણ કરો",
      noneSaved:
        "હજી કોઈ નજીકની વ્યક્તિ સાચવી નથી, તેથી આ ચેક-ઇન માત્ર કંટ્રોલ રૂમ સુધી પહોંચશે.",
      addCloseOnes: "નજીકના લોકો ઉમેરો",
      recording: "નોંધાઈ રહ્યું છે\u2026",
      markMeSafe: "મને સલામત ચિહ્નિત કરો",
    },
    alerts: {
      soundBlocked: "તમે ક્લિક કરો ત્યાં સુધી અવાજ બંધ",
      soundBlockedNote: "અવાજ વગાડતાં પહેલાં બ્રાઉઝરને પાના પર ક્લિક જોઈએ છે.",
      unmute: "ચેતવણીનો અવાજ ચાલુ કરો",
      mute: "ચેતવણીનો અવાજ બંધ કરો",
      muted: "અવાજ બંધ",
      soundOn: "અવાજ ચાલુ",
      acknowledge: "સ્વીકારો",
    },
    queue: {
      title: "ઘટના કતાર",
      sort: "પ્રાથમિકતા \u2192 ઉંમર",
      activeSignals: "સક્રિય સંકેત",
      live: "લાઇવ",
      filterType: "પ્રકાર",
      filterStatus: "સ્થિતિ",
      filterSev: "ગંભીરતા",
      sortPrefix: "ક્રમ",
      reportsShort: "અહેવાલ",
    },
    liveIst: "લાઇવ IST",
    urgency: {
      immediate: "અત્યારે જીવનું જોખમ",
      urgent: "તાત્કાલિક મદદ જોઈએ",
      standard: "ધ્યાન આપવું જરૂરી",
    },
    urgencyQuestion: "કેટલું તાત્કાલિક છે?",
    status: "સ્થિતિ",
    chartTable: {
      caption: "સમયગાળા પ્રમાણે અહેવાલો અને ઘટનાઓ",
      time: "સમય",
      reports: "અહેવાલો",
      incidents: "ઘટનાઓ",
    },
    districtIndex: "જિલ્લા સૂચકાંક",
    priorityArea: "પ્રાથમિકતા વિસ્તાર",
    filterPlaceholder: "ઘટના, જિલ્લો, એકમ કે ગંભીરતા પ્રમાણે ગાળો...",
    weatherTrend: "હવામાન વલણ",
    cycloneSchematic:
      "અરબી સમુદ્ર પરના વાવાઝોડાનું અને કચ્છ કિનારા તરફના તેના સંભવિત માર્ગનું રેખાચિત્ર",
    mapLayers: "નકશાના સ્તરો",
    toggleGrid: "નકશાનું ગ્રિડ સંદર્ભ સ્તર ચાલુ/બંધ કરો",
    resetView: "નકશાનું દૃશ્ય રીસેટ કરો",
    closeDistrictPanel: "જિલ્લા પેનલ બંધ કરો",
    resqPulse: "ResQ પલ્સ",
    pulse: {
      reports: "અહેવાલ",
      blockedRoads: "બંધ રસ્તા",
      sheltersActive: "ચાલુ આશ્રયસ્થાન",
      responseTeams: "પ્રતિસાદ ટુકડી",
    },
    compositePosture: (rank) => `સ્તર ${rank} / 5 \u00b7 સંયુક્ત સ્થિતિ`,
    loadingMap: "નકશો લોડ થાય છે\u2026",
    liveMapIntro: "રાજ્યભરમાં જિલ્લા જોખમ સ્થિતિ અને કામગીરીના માર્કર.",
    inView: (n) => `${n} દેખાય છે`,
    incidentsLabel: "ઘટના",
    amenity: { food: "ભોજન", water: "પાણી", medical: "તબીબી" },
    shelterDistanceNote:
      "અંતર પસંદ કરેલા જિલ્લા કેન્દ્રથી સીધી રેખામાં છે, માર્ગ અંતર નથી.",
    markersGrouped: (n) => `${n} માર્કર \u00b7 ઓવરલેપ જૂથબદ્ધ`,
    centroidNote:
      "ગોળા જિલ્લાના કેન્દ્રબિંદુ દર્શાવે છે અને જોખમની સ્થિતિ બતાવે છે \u2014 તે વહીવટી સીમા નથી.",
    mapLive: "લાઇવ",
    mapDemoData: "ડેમો માહિતી",
    mapLayerMissing: "સ્તર ગુમ",
    allLayersFromApi: "આ નકશાનું દરેક સ્તર API માંથી આવ્યું છે.",
    weakestLayer: (what) => `આ નકશાનું સૌથી નબળું સ્તર: ${what}.`,
    districtAria: (district, risk, incidents) =>
      `${district}, ${risk} જોખમ, ${incidents} સક્રિય ઘટના`,
    markersInDistrict: (n) => `, જિલ્લામાં ${n} માર્કર`,
    api: {
      serverWaking:
        "સર્વર જાગી રહ્યું છે — થોડી નિષ્ક્રિય મિનિટો પછી API સૂઈ જાય છે અને શરૂ થવામાં એક મિનિટ સુધી લાગે છે. ફરી પ્રયાસ કરવાથી કામ થશે.",
      deviceOffline: "આ ઉપકરણ ઓફલાઇન છે",
      offlineLastKnown: "ઓફલાઇન — છેલ્લી જાણીતી માહિતી બતાવાય છે",
      timedOut: "વિનંતીનો સમય પૂરો થયો",
      showingDemoData: (note) => `${note} — ડેમો માહિતી બતાવાય છે`,
    },
    freshness: {
      offline: "ઓફલાઇન",
      updatedAgo: (age) => `${age} પહેલાં અપડેટ`,
      locationStale: "સ્થળ જૂનું",
      capacityStale: "ક્ષમતા જૂની",
      sec: (n) => `${n} સેકન્ડ`,
      min: (n) => `${n} મિનિટ`,
      hr: (n) => `${n} કલાક`,
    },
    liveMap: "લાઇવ નકશો",
    districtsByRisk: "જોખમ પ્રમાણે જિલ્લા",
    notVerifiedOnScene: "ઘટનાસ્થળે હજી ચકાસાયું નથી",
    demoDataOnMap: "આ નકશા પરનો ડેમો ડેટા:",
    stateOperations: "ResQNet \u00b7 રાજ્ય કામગીરી",
    openNavigation: "નેવિગેશન ખોલો",
    closeNavigation: "નેવિગેશન બંધ કરો",
    sections: "વિભાગો",
    logoAlt: "ResQNet \u2014 આપત્તિ પ્રતિસાદ પ્લેટફોર્મ",
    photoPreview: "જોડેલા ફોટાનું પૂર્વાવલોકન",
    dragPin: "સ્થળ સુધારવા પિન ખેંચો",
  },
};

const hi: PageStrings = {
  primitives: {
    loading: "लोड हो रहा है…",
    retry: "फिर से प्रयास",
    couldNotLoad: (what) => `${what} लोड नहीं हो सका`,
    noAnswer: "सर्वर ने उत्तर नहीं दिया।",
    unknownNotClear:
      "इसका अर्थ यह नहीं कि दिखाने को कुछ नहीं है — इसे अज्ञात मानें, सुरक्षित नहीं।",
    partialData: "आंशिक डेटा।",
    what: {
      evaluationRun: "मूल्यांकन रन",
      hotspotClusters: "हॉटस्पॉट क्लस्टर",
      incidentReports: "इस घटना के पीछे की रिपोर्ट",
      facilities: "अस्पताल और आश्रय",
      warningFeed: "चेतावनी फ़ीड",
    },
  },
  common: {
    retry: "फिर से प्रयास करें",
    search: "खोजें",
    allDistricts: "सभी ज़िले",
    district: "ज़िला",
    clear: "साफ़ करें",
    close: "बंद करें",
    cancel: "रद्द करें",
    save: "सहेजें",
    of: (shown, total) => `${total} में से ${shown}`,
    updated: "अपडेट",
    noData: "कोई डेटा नहीं",
    viewAll: "सभी देखें",
    demoData: "डेमो डेटा",
  },
  disaster: {
    cyclone: "चक्रवात",
    flood: "बाढ़",
    fire: "आग",
    earthquake: "भूकंप",
    medical: "चिकित्सा",
    road_block: "रास्ता बंद",
    infrastructure: "अवसंरचना क्षति",
    missing_person: "लापता व्यक्ति",
    heavy_rainfall: "भारी वर्षा",
    other: "अन्य",
  },
  incidents: {
    title: "घटनाएँ",
    lead: "नागरिक और प्राधिकरण की रिपोर्ट, उनकी सत्यापन स्थिति के साथ।",
    loading: "घटनाएँ लोड हो रही हैं…",
    loadError: "घटनाएँ लोड नहीं हो सकीं",
    searchLabel: "घटनाएँ खोजें",
    searchPlaceholder: "स्थान, विवरण या संदर्भ खोजें...",
    register: "रजिस्टर",
    noMatches: "इन फ़िल्टरों से कोई घटना नहीं मिली",
    chain: "ResQ चेन",
    selectOne: "चेन देखने के लिए कोई घटना चुनें",
  },
  analytics: {
    title: "आपातकालीन आसूचना केंद्र",
    lead: "प्रतिक्रिया प्रदर्शन, वर्गीकरण गुणवत्ता और रिपोर्ट कहाँ केंद्रित हैं।",
    loading: "विश्लेषण लोड हो रहा है…",
    loadError: "विश्लेषण लोड नहीं हो सका",
    activeIncidents: "सक्रिय घटनाएँ",
    resolved: "सुलझाई गईं",
    peopleAffected: "प्रभावित लोग",
    avgResponse: "औसत प्रतिक्रिया",
    teamsDeployed: "तैनात टीमें",
    shelterOccupancy: "आश्रय भराव",
    highestRisk: "सर्वाधिक ज़िला जोखिम",
    noDispatches: "इस अवधि में कोई रवानगी नहीं",
    accuracyTitle: "AI वर्गीकरण सटीकता",
    accuracyNote:
      "लेबल किए गए मूल्यांकन सेट पर BE2 द्वारा मापी गई — यह लाइव आँकड़ा नहीं है।",
    typeAccuracy: "प्रकार सटीकता",
    severityWithin1: "गंभीरता ±1",
    dedupPrecision: "डुप्लिकेट सटीकता",
    dedupRecall: "डुप्लिकेट रिकॉल",
    accuracyCaveat:
      "टेस्ट सेट पर सटीकता अगली वास्तविक रिपोर्ट पर सटीकता नहीं है। हर वर्गीकरण सलाहकारी रहता है और ऑपरेटर उसकी पुष्टि करता है।",
    hotspots: "रिपोर्टिंग हॉटस्पॉट",
    hotspotsNote: "रिपोर्ट कहाँ केंद्रित हैं। रिपोर्ट का घनत्व — पुष्ट जोखिम नहीं।",
    filters: "फ़िल्टर",
    period: "अवधि",
    today: "आज",
    days7: "7 दिन",
    days30: "30 दिन",
    custom: "कस्टम",
    disaster: "आपदा",
    byType: "प्रकार अनुसार",
    responseTimes: "प्रतिक्रिया समय",
    shortages: "कमी",
    insights: "निष्कर्ष",
    severity: "गंभीरता",
    status: "स्थिति",
    customDays: "दिनों में कस्टम अवधि",
    noClusters: "वर्तमान संग्रह में कोई क्लस्टर नहीं",
    reportToDispatch: "रिपोर्ट → रवानगी",
    demoDistrictRisk: "डेमो ज़िला जोखिम",
    observations: "अवलोकन",
    observationsNote: "अभी दिख रही पंक्तियों से गणना।",
    nothingNotable: "इस चयन में कुछ उल्लेखनीय नहीं",
    scope: (shown, total, districts) =>
      `${total} में से ${shown} घटनाएँ · ${districts} ज़िले दृश्य में`,
    demoFigures: " — डेमो आँकड़े",
    noTriageNote:
      "रिपोर्ट → वर्गीकरण नहीं दिखाया गया: घटना अनुबंध में `triaged_at` टाइमस्टैम्प नहीं है, इसलिए यह निकाला नहीं जा सकता।",
    insightSeverity: { critical: "गंभीर", warning: "चेतावनी", info: "सूचना" },
    trend: "घटना रुझान",
    trendNote: "प्रत्येक अवधि में खुली घटनाएँ और रिपोर्ट।",
    incidentType: "घटना प्रकार",
    incidentTypeNote: "प्रकार अनुसार घटनाओं की संख्या।",
    districtRisk: "ज़िला जोखिम",
    districtRiskNote: "ज़िले के अनुसार सक्रिय घटनाएँ; हर पट्टी के पास जोखिम स्तर दिया है।",
    responseTime: "प्रतिक्रिया समय",
    responseTimeNote:
      "घटना समयांकों से रिपोर्ट → रवानगी और रिपोर्ट → समाधान।",
    shelterCapacity: "आश्रय क्षमता",
    shelterCapacityNote: "कुल क्षमता के मुकाबले उपयोग में स्थान।",
    utilisation: "संसाधन उपयोग",
    utilisationNote: "उपलब्ध के मुकाबले तैनात इकाइयाँ।",
    pulseDistribution: "ResQ पल्स वितरण",
    pulseDistributionNote: "हर जोखिम स्तर पर कितने ज़िले हैं।",
    districtComparison: "ज़िला तुलना",
    districtTableCaption:
      "ज़िले के अनुसार जोखिम, घटनाएँ, आश्रय, टीमें और रवानगी समय",
    table: {
      district: "ज़िला",
      risk: "जोखिम",
      incidents: "घटनाएँ",
      shelters: "आश्रय",
      teams: "टीमें",
      affected: "प्रभावित",
      avgDispatch: "औसत रवानगी",
    },
    insight: {
      p1NotDispatched: (n) => `${n} P1 घटनाएँ अभी रवाना नहीं हुईं`,
      waitingLongest: (code) => `${code} सबसे लंबे समय से प्रतीक्षा में है।`,
      shortage: (kind) => `${kind} की कमी`,
      shortageNone: "इस प्रकार की कोई इकाई कहीं उपलब्ध नहीं है।",
      shortageSome: "खुली घटनाओं को इस प्रकार की मुक्त इकाइयों से अधिक चाहिए।",
      shortageEvidence: (required, available, shortage) =>
        `आवश्यक ${required} · उपलब्ध ${available} · कमी ${shortage}`,
      criticalDistricts: (n) => `${n} ज़िले गंभीर जोखिम में`,
      criticalDistrictsNote:
        "इन ज़िलों में ख़तरे और जोखिम का सर्वाधिक संयोजन है।",
      sheltersOpen: (n) => `${n} आश्रय खुले`,
      sheltersFull: (full, near) =>
        `${full} आश्रय भरे, ${near} क्षमता के निकट`,
      sheltersFullNote: "ये भर जाएँ उससे पहले आने वालों को अन्यत्र भेजें।",
      conflicting: (n) => `${n} घटनाओं में विरोधाभासी रिपोर्ट`,
      conflictingNote:
        "स्रोत पैमाने या स्थान पर असहमत हैं। प्रतिक्रिया बढ़ाने से पहले पुष्टि करें।",
      lowConfidence: (n) => `${n} रिपोर्ट मैन्युअल सत्यापन सीमा से नीचे`,
      lowConfidenceNote:
        "वर्गीकरणकर्ता इन्हें विश्वास के साथ नहीं पढ़ सका। किसी व्यक्ति को वापस कॉल करना चाहिए।",
      unverifiedSevere: (n) => `${n} गंभीर घटनाएँ केवल एक स्रोत पर आधारित`,
      unverifiedSevereNote:
        "गंभीरता अधिक है पर अभी तक किसी ने रिपोर्ट की पुष्टि नहीं की।",
      minutes: (n) => `${n} मिनट`,
    },
  },
  field: {
    loading: "आपका कार्य लोड हो रहा है…",
    loadErrorTitle: "कंट्रोल रूम से संपर्क नहीं हो सका",
    noAssignmentTitle: "कोई सक्रिय कार्य नहीं",
    loadingIncident: "घटना लोड हो रही है…",
    incidentErrorTitle: "घटना लोड नहीं हो सकी",
    severity: "गंभीरता",
    reported: "सूचित",
    notVerified: "घटनास्थल पर अभी सत्यापित नहीं",
    situation: "स्थिति",
    summary: "सारांश",
    peopleAffected: "प्रभावित लोग",
    hazards: "बताए गए ख़तरे",
    updateStatus: "स्थिति अपडेट करें",
    arrived: "घटनास्थल पर पहुँचे",
    completed: "पूर्ण",
    enRoute: "रास्ते में",
    situationUpdate: "स्थिति अपडेट",
    send: "अपडेट भेजें",
    sending: "भेजा जा रहा है…",
    notes: "टिप्पणी",
    resolvedByResponder: "इस घटना को सुलझा हुआ चिह्नित करें",
    roadAccess: "सड़क पहुँच",
    additionalResources: "अतिरिक्त संसाधनों की आवश्यकता",
    yourUnit: "आपकी इकाई",
    navigate: "Google Maps में मार्ग देखें",
    fieldVerified: "घटनास्थल पर सत्यापित",
    hazardsCaveat:
      "ऊपर के ख़तरे बताए और वर्गीकृत किए अनुसार हैं। जब तक आप स्वयं न देखें, उन्हें अपुष्ट मानें।",
    noOtherUnits: "कोई अन्य इकाई नियुक्त नहीं।",
    currentStatus: "वर्तमान स्थिति",
    assignmentComplete: "कार्य पूर्ण।",
    updateSituation: "स्थिति अपडेट करें",
    unreachableDetail:
      "सर्वर ने उत्तर नहीं दिया। इसका अर्थ यह नहीं कि आपका कोई कार्य नहीं है।",
    doNotStandDown:
      "इसे “काम बंद” न समझें। स्थल छोड़ने से पहले रेडियो पर या इस नंबर पर अपना कार्य पुष्ट करें",
    noAssignmentHint:
      "कंट्रोल रूम आपकी इकाई रवाना करते ही आपकी घटना यहाँ दिखेगी।",
    statusError: "स्थिति अपडेट नहीं हो सकी",
    notEstimated: "अनुमान नहीं",
    aiConfidence: "AI विश्वास",
    evidence: "साक्ष्य",
    suggestedActions: "सुझाए गए कदम",
    suggestedActionsNote: "सलाहकारी — घटनास्थल पर आपका आकलन इन पर भारी है।",
    assignedUnits: "इस घटना के लिए नियुक्त",
    quickActions: "त्वरित कार्रवाई",
    quickActionsNote: "कंट्रोल रूम को एक संकेत भेजता है।",
    etaNote: "सीधी रेखा का अनुमान — मार्ग आधारित ETA नहीं",
    lastChangeBy: "अंतिम बदलाव:",
    sev: "गंभीरता",
    sendError: "अपडेट नहीं भेजा जा सका",
    signalError: "संकेत नहीं भेजा जा सका",
    action: {
      assigned: "स्वीकार किया",
      en_route: "रास्ते में",
      on_scene: "घटनास्थल पर",
      completed: "पूर्ण",
      cancelled: "रद्द",
    },
    updatesSent: (n) =>
      `इस डिवाइस से ${n} स्थिति अपडेट भेजे गए। बैकएंड स्वीकार करने पर कंट्रोल रूम की तस्वीर अपडेट होगी।`,
    form: {
      lead: "आप यहाँ जो दर्ज करते हैं वह बताई गई तस्वीर की जगह लेता है। वर्तमान मान रखने के लिए खाना खाली छोड़ें।",
      severityAsFound: "जैसा आप पाएँ वैसी गंभीरता",
      hazardsPresent: "मौजूद ख़तरे",
      correctedLocation: "सही किया गया स्थान",
      resolvedHere: "इस स्थान पर घटना सुलझ गई",
      notesHint: "कंट्रोल रूम को क्या जानना आवश्यक है",
      locationUnavailable:
        "इस डिवाइस पर स्थान उपलब्ध नहीं। इसके बजाय टिप्पणी में विवरण दें।",
      fixFailed: "स्थान नहीं मिल सका। टिप्पणी में सही स्थान लिखें।",
      gettingFix: "स्थान लिया जा रहा है…",
      useMyPosition: "मेरा वर्तमान स्थान उपयोग करें",
    },
  },
  resources: {
    title: "संसाधन",
    lead: "राज्य भर में इकाइयाँ, अस्पताल, आश्रय और सेंसर।",
    loading: "संसाधन लोड हो रहे हैं…",
    loadErrorTitle: "इकाइयाँ लोड नहीं हो सकीं",
    capabilityDemand: "क्षमता माँग",
    covered: "कवर",
    short: "कमी",
    filter: "फ़िल्टर",
    searchLabel: "इकाइयाँ, सुविधाएँ और सेंसर खोजें",
    searchPlaceholder: "कॉलसाइन, बेस, क्षमता, सुविधा खोजें…",
    units: "इकाइयाँ",
    facilities: "अस्पताल और आश्रय",
    sensors: "सेंसर",
    callsign: "कॉलसाइन",
    kind: "प्रकार",
    status: "स्थिति",
    base: "बेस",
    eta: "पहुँचने का समय",
    noUnits: "इन फ़िल्टरों से कोई इकाई नहीं मिली",
    beds: "बिस्तर",
    capacity: "क्षमता",
    clearFilters: "फ़िल्टर साफ़ करें",
    clearAFilter: "खोज बढ़ाने के लिए कोई फ़िल्टर हटाएँ।",
    demandNote:
      "हर खुली घटना के लिए आवश्यक इकाई प्रकारों की तुलना वर्तमान उपलब्ध इकाइयों से।",
    facilitiesNote: "बिस्तरों की संख्या अंतिम बताए गए आँकड़े हैं, आरक्षण नहीं।",
    sensorsNote: "रीडिंग, हार्टबीट और स्वास्थ्य अलग-अलग दर्ज होते हैं।",
    refresh: "ताज़ा करें",
    refreshing: "ताज़ा हो रहा है…",
    tableCaption: "स्थिति, नियुक्ति, बेस और स्थान ताज़गी सहित प्रतिक्रिया इकाइयाँ",
    assignment: "नियुक्ति",
    capabilities: "क्षमताएँ",
    locationUpdated: "स्थान अपडेट",
    noFacilities: "इन फ़िल्टरों से कोई सुविधा नहीं मिली",
    noSensors: "इन फ़िल्टरों से कोई सेंसर नहीं मिला",
    noBedCapacity: "बिस्तर क्षमता नहीं बताई गई",
    nearCapacity: "क्षमता के निकट",
    noReading: "कोई रीडिंग नहीं",
    reading: "रीडिंग",
    heartbeat: "हार्टबीट",
    noHeartbeatNote:
      "कोई हार्टबीट नहीं। रीडिंग का न होना यह प्रमाण नहीं कि स्थिति सामान्य है।",
    thresholdNote:
      "रीडिंग अपनी सीमा पार कर चुकी है। पुष्ट मानने से पहले सत्यापित करें।",
  },
  shelters: {
    title: "आश्रय",
    lead: "राहत आश्रय, उनका भराव और उपलब्ध सुविधाएँ।",
    loading: "आश्रय लोड हो रहे हैं…",
    loadErrorTitle: "आश्रय लोड नहीं हो सके",
    occupancy: "भराव",
    capacity: "क्षमता",
    open: "खुला",
    nearlyFull: "लगभग भरा",
    full: "भरा",
    nearest: "आपके सबसे नज़दीक",
    distanceNote: "सीधी रेखा की दूरी, सड़क दूरी नहीं।",
    facilities: "सुविधाएँ",
    contact: "संपर्क",
    noMatches: "इन फ़िल्टरों से कोई आश्रय नहीं मिला",
    searchPlaceholder: "नाम या पता खोजें...",
    searchLabel: "आश्रय खोजें",
    clearAFilter: "खोज बढ़ाने के लिए कोई फ़िल्टर हटाएँ।",
    directions: "दिशा",
    safeRoute: "सुरक्षित मार्ग",
    illustrativeRoute: "उदाहरण मार्ग।",
    hazardsRouted: "ज्ञात ख़तरों से बचाकर मार्ग",
    hazardsCaveat:
      "केवल ResQNet को बताए गए ख़तरे ध्यान में लिए जाते हैं। अन्य भी हो सकते हैं।",
    noRoute: "कोई मार्ग चयनित नहीं",
    noRouteHint: "सुझाया मार्ग देखने के लिए किसी आश्रय पर सुरक्षित मार्ग चुनें।",
    food: "भोजन",
    water: "पानी",
    medical: "चिकित्सा",
    accessible: "सुलभ",
    summary: (open, occupancy, capacity) =>
      `${open} खुले · ${capacity} में से ${occupancy} स्थान उपयोग में`,
    placesOf: (occupancy, capacity, pct) => `${capacity} में से ${occupancy} स्थान (${pct}%)`,
    occupancyStale: "उपयोग पुराना",
    staleNote: (minutes) =>
      `यह आँकड़ा ${minutes} मिनट पुराना है — लोगों को भेजने से पहले फ़ोन पर पुष्टि करें।`,
    occupancyAt: (name) => `${name} में उपयोग`,
  },
  missing: {
    privacyNote:
      "इस रजिस्टर में किसी को पहचानने के लिए आवश्यक जानकारी ही दिखती है। संपर्क विवरण, पते और जन्मतिथि केस अधिकारी के पास रहते हैं और यहाँ प्रकाशित नहीं होते। यदि आप किसी को पहचानते हैं तो ज़िला आपातकालीन लाइन पर कॉल करें",
    privacyNoteTail: "।",
    title: "लापता व्यक्ति",
    lead: "आपात स्थिति के बाद लापता लोगों की रिपोर्ट।",
    loading: "रिकॉर्ड लोड हो रहे हैं…",
    loadErrorTitle: "रिकॉर्ड लोड नहीं हो सके",
    reportedMissing: "लापता की सूचना",
    found: "मिल गए",
    lastSeen: "अंतिम बार देखा",
    age: "आयु",
    noMatches: "इन फ़िल्टरों से कोई रिकॉर्ड नहीं मिला",
    searchPlaceholder: "नाम, क्षेत्र या संदर्भ खोजें…",
    demoNote: "डेमो रिकॉर्ड — इस बिल्ड के पीछे लापता व्यक्ति रजिस्ट्री नहीं है।",
    ladder: "लापता → संभावित मेल → मिल गए → परिवार से मिले",
    searchLabel: "रजिस्टर में खोजें",
    showReunited: "परिवार से मिले मामले दिखाएँ",
    lastSeenAt: "अंतिम बार देखा:",
    at: "स्थान:",
    caseOfficer: "केस अधिकारी:",
    noPhoto: "फ़ाइल में कोई फ़ोटो नहीं।",
    reunitedHidden: "जब तक ऊपर का बॉक्स न चुनें, परिवार से मिले मामले छिपे रहते हैं।",
  },
  weather: {
    rainfall7d: "7 दिन की वर्षा",
    sourceNote:
      "स्रोत: IMD, NDMA. ResQNet का कोई जीवंत मौसम एकीकरण नहीं है — इस पृष्ठ के आँकड़े प्रदर्शन हेतु नमूने हैं।",
    title: "मौसम",
    lead: "ज़िला चेतावनियाँ, वर्षा और हवा का अनुमान।",
    loading: "मौसम लोड हो रहा है…",
    alerts: "चेतावनियाँ",
    forecast: "पूर्वानुमान",
    noAlerts: "कोई सक्रिय मौसम चेतावनी नहीं",
    demoNote: "डेमो डेटा — कोई लाइव IMD फ़ीड नहीं",
    issued: "जारी",
    source: "स्रोत",
    loadError: "मौसम चेतावनियाँ लोड नहीं हो सकीं",
    activeWarnings: "सक्रिय चेतावनियाँ",
    rainfall: "वर्षा",
    mmPerDay: "प्रतिदिन मिलीमीटर",
    windTemp: "हवा और तापमान",
    windTempNote: "अधिकतम हवा (किमी/घंटा) और अधिकतम तापमान (°C)",
    windKph: "हवा किमी/घं",
    maxC: "अधिकतम °C",
    noWarnings: "इन फ़िल्टरों से कोई चेतावनी नहीं मिली",
  },
  volunteers: {
    summary: (open, districts) =>
      `${districts} ज़िलों में ${open} बिना दावे की अनुरोध`,
    claimedBy: (org) => ` · ${org} द्वारा दावा`,
    mark: (status) => `${status} चिह्नित करें`,
    reliefDemoNote:
      "यहाँ किए गए स्थिति परिवर्तन प्रदर्शन के लिए इसी डिवाइस पर रहते हैं। ये अभी राज्य कंट्रोल रूम को नहीं भेजे जाते — समन्वय एंडपॉइंट अभी बाकी है।",
    quantity: (amount, unit, kind) => `${amount} ${unit} — ${kind}`,
    title: "स्वयंसेवक",
    lead: "प्रशिक्षित स्वयंसेवक और उनकी तैनाती।",
    loading: "स्वयंसेवक लोड हो रहे हैं…",
    skills: "कौशल",
    available: "उपलब्ध",
    deployed: "तैनात",
    register: "स्वयंसेवक के रूप में पंजीकरण करें",
    demoNote: "डेमो सूची — इस बिल्ड में पंजीकरण सहेजे नहीं जाते।",
    noMatches: "इन फ़िल्टरों से कोई अनुरोध नहीं मिला",
    reliefTitle: "स्वयंसेवक और NGO",
    searchLabel: "राहत अनुरोध खोजें",
    loadError: "राहत अनुरोध लोड नहीं हो सके",
    searchPlaceholder: "स्थान, संदर्भ या संस्था खोजें...",
  },
  support: {
    title: "सहायता",
    lead: "हेल्पलाइन, मार्गदर्शन और कंट्रोल रूम तक पहुँचने का तरीका।",
    helplines: "आपातकालीन नंबर",
    faq: "सामान्य प्रश्न",
    contactControlRoom: "कंट्रोल रूम से संपर्क करें",
    callBanner: "आपात स्थिति में 112 पर कॉल करें",
    notAReplacement:
      "ResQNet नागरिकों, बचावकर्मियों और विभागों के बीच समन्वय में मदद करता है। यह आपातकालीन कॉल का विकल्प नहीं है, और यहाँ रिपोर्ट भेजने से अपने आप मदद नहीं पहुँचती।",
    specialisedLinesNote:
      "112 सभी सेवाओं तक पहुँचता है। नीचे दी गई लाइनें विशेष सेवाओं के लिए हैं \u2014 इनका उपयोग तभी करें जब आपको पता हो कि कौन सी सेवा चाहिए।",
    queuedWaiting: (n) => `इस डिवाइस पर ${n} सबमिशन बाकी हैं`,
    queuedItem: (kind, label, time) => `${kind} — ${label} (कतार में ${time})`,
    queuedNote:
      "ये अभी कंट्रोल रूम तक नहीं पहुँचे हैं। कनेक्शन लौटने पर अपने आप भेज दिए जाएँगे।",
    accessibility: "सुलभता",
    a11yKeyboard:
      "हर स्क्रीन केवल कीबोर्ड से चलती है। फ़ोकस हमेशा दिखता है, और हर पृष्ठ पर “मुख्य सामग्री पर जाएँ” लिंक पहला पड़ाव है।",
    a11yVoice:
      "जहाँ ब्राउज़र अनुमति दे, रिपोर्ट फ़ॉर्म गुजराती, हिन्दी और अंग्रेज़ी में वॉइस इनपुट स्वीकारता है, और भेजने से पहले आप लिखावट संपादित कर सकते हैं।",
    offlineReports:
      "ऑफ़लाइन भेजी रिपोर्ट इस डिवाइस पर सहेजी जाती हैं और कनेक्शन लौटने पर भेजी जाती हैं। बैनर बताता है कितनी प्रतीक्षा में हैं।",
    a11yColour:
      "स्थिति कभी केवल रंग से नहीं दिखाई जाती — हर रंगीन बैज अपना अर्थ शब्दों में भी बताता है।",
    a11yTouch:
      "आपातकालीन नियंत्रण बड़े टच क्षेत्र उपयोग करते हैं और रिपोर्ट फ़ॉर्म फ़ोन पर एक हाथ से चलता है।",
    a11yMotion:
      "एनिमेशन केवल दो संकेतकों तक सीमित है और आपका डिवाइस कम गति माँगे तो पूरी तरह बंद हो जाता है।",
    a11yAssistance:
      "विशेष सहायता विकल्प — बुज़ुर्ग, बच्चा, व्हीलचेयर, चिकित्सा — रिपोर्ट फ़ॉर्म पर हैं ताकि बचावकर्मी तैयार होकर आएँ।",
    networkFails: "नेटवर्क बंद हो तो",
    call112: "112 पर कॉल करें।",
    voiceWorks:
      "कमज़ोर सिग्नल पर भी वॉइस कॉल चलती है, जहाँ डेटा कनेक्शन नहीं चलता।",
    staleNote:
      "आपने अंतिम बार जो डेटा लोड किया वह स्क्रीन पर रहता है और वर्तमान के बजाय पुराना चिह्नित होता है।",
    faqs: FAQ_HI,
  },
  reports: {
    title: "रिपोर्ट",
    lead: "स्थिति रिपोर्ट, क्षति आकलन और दैनिक विवरण।",
    loading: "रिपोर्ट लोड हो रही हैं…",
    loadErrorTitle: "रिपोर्ट लोड नहीं हो सकीं",
    searchLabel: "रिपोर्ट खोजें",
    searchPlaceholder: "शीर्षक, ज़िला या संदर्भ खोजें…",
    kind: "प्रकार",
    status: "स्थिति",
    sort: "क्रम",
    newest: "नई पहले",
    oldest: "पुरानी पहले",
    byTitle: "शीर्षक",
    byKind: "प्रकार",
    noMatches: "इन फ़िल्टरों से कोई रिपोर्ट नहीं मिली",
    preview: "पूर्वावलोकन",
    selectOne: "पूर्वावलोकन के लिए रिपोर्ट चुनें",
    exportCsv: "अनुक्रमणिका निर्यात (CSV)",
    exportIndex: (n) => `अनुक्रमणिका निर्यात (${n})`,
    countOf: (shown, total) => `${total} में से ${shown}`,
    publicationState: { published: "प्रकाशित", draft: "मसौदा", archived: "संग्रहित" },
    print: "प्रिंट / PDF के रूप में सहेजें",
    reportEmergency: "आपात स्थिति की सूचना दें",
    anyStatus: "कोई भी स्थिति",
    titleAz: "शीर्षक अ\u2013ज्ञ",
    reportType: "रिपोर्ट प्रकार",
    index: "अनुक्रमणिका",
    clearAFilter: "खोज बढ़ाने के लिए कोई फ़िल्टर हटाएँ।",
    stateWide: "राज्यव्यापी",
    docSummary: "सारांश",
    docReference: "संदर्भ",
    docPeriod: "अवधि",
    docGenerated: "तैयार",
    docIssuedBy: "जारीकर्ता",
    docMasthead: "राज्य आपदा प्रबंधन प्राधिकरण \u00b7 ResQNet",
    docGeneratedBy: (when) => `ResQNet द्वारा तैयार \u00b7 ${when} IST`,
    docStatus: (status) => `स्थिति: ${status}`,
    docSignatory: (name) => `${name} \u2014 अधिकृत हस्ताक्षरकर्ता`,
    docFootnote:
      "इस रिपोर्ट के आँकड़े तैयार किए जाने के समय के ResQNet ऑपरेशनल डेटासेट से लिए गए हैं। जहाँ कोई जानकारी उपलब्ध नहीं थी, वहाँ अनुमान लगाने के बजाय उसे चिह्नित किया गया है।",
  },
  dashboard: {
    queue: "घटना क़तार",
    incident: "घटना",
    selectIncident: "कोई घटना चुनें",
    simulator: "सिम्युलेटर",
    start: "परिदृश्य चलाएँ",
    stop: "रोकें",
    reset: "रीसेट",
    resetDone: "डेमो डेटा रीसेट हुआ",
    live: "लाइव",
    reconnecting: "पुनः जुड़ रहा है",
    demoData: "डेमो डेटा",
    sitrep: "स्थिति रिपोर्ट",
    generating: "तैयार हो रहा है\u2026",
    language: "भाषा",
    loadingMap: "लाइव मानचित्र लोड हो रहा है\u2026",
    commandCenter: "आपातकालीन कमान केंद्र",
    emergencyContacts: "आपातकालीन संपर्क",
    monsoonResponse: "मानसून प्रतिक्रिया",
    logACall: "कॉल दर्ज करें",
    layers: "परतें",
    cityView: "शहर दृश्य",
    connecting: "कंट्रोल रूम से जुड़ रहा है\u2026",
    feedUnavailable: "घटना फ़ीड उपलब्ध नहीं",
    feedUnavailableNote:
      "यहाँ खाली क़तार का अर्थ है कि कंट्रोल रूम तक नहीं पहुँचा जा सका \u2014 यह नहीं कि शहर शांत है।",
    retry: "फिर से प्रयास",
    mapLayers: "मानचित्र परतें",
    aiGenerated: "AI निर्मित",
    situationReport: "स्थिति रिपोर्ट",
    copy: "कॉपी",
    print: "प्रिंट",
    priorityIntake: "प्राथमिकता प्रविष्टि",
    logCallTitle: "आपातकालीन कॉल दर्ज करें",
    logCallNote:
      "कॉल करने वाला जो कहे वह किसी भी भाषा में लिखें। AI उसे वर्गीकृत करता, स्थान खोजता और दोहराव हटाता है।",
    whatHappening: "क्या हो रहा है?",
    locationField: "स्थान (क्षेत्र / स्थल-चिह्न)",
    noGpsNote: "GPS नहीं: क्षेत्र का नाम अहमदाबाद गजेटियर से खोजा जाता है।",
    cancel: "रद्द करें",
    active: "सक्रिय",
    p1Open: "P1 खुली",
    unitsFree: "मुक्त इकाइयाँ",
    avgToDispatch: "औसत रवानगी समय",
    searchIncidents: "घटना कोड, शीर्षक या स्थान खोजें\u2026",
    logoAlt: "ResQNet लोगो",
    examplePlaceholder: "उदा. अखबारनगर अंडरपास में गाड़ी फँसी है, पानी बढ़ रहा है",
    exampleLocation: "उदा. अखबारनगर अंडरपास",
    stopScenario: "परिदृश्य रोकें",
    scenarioStopped: "परिदृश्य रुका",
    scenarioStarted: "परिदृश्य शुरू: रिपोर्ट आने लगेंगी",
    apiSilent: "API ने उत्तर नहीं दिया।",
    incidents: "घटनाएँ",
    responseUnits: "प्रतिक्रिया इकाइयाँ",
    facilities: "अस्पताल और आश्रय",
    escalate: "बढ़ाएँ",
    resolve: "सुलझा हुआ करें",
    acknowledge: "स्वीकारें",
    controlRoom: "कंट्रोल रूम",
    couldNotSend: "भेजा नहीं जा सका",
    runScenario: "परिदृश्य चलाएँ",
    offline: "ऑफ़लाइन",
    helpline: {
      emergency: "आपातकाल",
      ambulance: "एम्बुलेंस",
      fire: "अग्निशमन",
      police: "पुलिस",
      stateEoc: "राज्य EOC",
      districtControl: "ज़िला कंट्रोल",
      childHelpline: "बाल हेल्पलाइन",
      womenHelpline: "महिला हेल्पलाइन",
    },
    mapSummary: (incidents, units, facilities) =>
      `OSM \u00b7 ${incidents} घटनाएँ \u00b7 ${units} इकाइयाँ \u00b7 ${facilities} सुविधाएँ`,
    dispatched: (code) => `${code} रवाना`,
    escalated: (code) => `${code} बढ़ाया गया`,
    resolved: (code) => `${code} हल: इकाइयाँ मुक्त`,
    mergedInto: (code) => `${code} में मिलाया (डुप्लिकेट मिला)`,
    created: (code) => `नई घटना ${code} बनाई`,
    actionFailed: (action, why) => `${action} विफल: ${why}`,
    error: "त्रुटि",
  },
  flash: {
    compose: "चेतावनी तैयार करें",
    hazard: "ख़तरा",
    area: "क्षेत्र",
    headline: "शीर्षक",
    detail: "विवरण",
    language: "भाषा",
    preview: "पूर्वावलोकन",
    broadcast: "प्रसारित करें",
    cancel: "रद्द करें",
    history: "भेजी गई चेतावनियाँ",
    noneSent: "अभी कोई चेतावनी नहीं भेजी गई",
    sentAt: "भेजा",
    dismiss: "बंद करें",
    drill: "अभ्यास",
    drillNote: "यह एक अभ्यास है। किसी कार्रवाई की आवश्यकता नहीं।",
    massWarning: "सामूहिक चेतावनी \u00b7 केवल अधिकृत ऑपरेटर",
    flashAlert: "ResQNet फ़्लैश चेतावनी",
    simulation: "सिमुलेशन",
    authorityNote:
      "मॉडल चेतावनी जारी नहीं कर सकता। जारी करने वाला प्राधिकरण आप हैं।",
    standalone: "किसी घटना से नहीं \u2014 स्वतंत्र चेतावनी",
    allDistrictsWide: "सभी ज़िले (राज्यव्यापी)",
    stateWideConfirm:
      "राज्यव्यापी चेतावनी हर ज़िले तक पहुँचती है। पुष्टि करें कि यही अभीष्ट है।",
    exactlyWhatCitizenSees: "नागरिक को ठीक यही दिखेगा",
    emergencyAlert: "आपातकालीन चेतावनी",
    notRealPhone: "यह किसी वास्तविक फ़ोन तक नहीं पहुँचेगी।",
    previewAlert: "चेतावनी पूर्वावलोकन",
    send: "फ़्लैश चेतावनी भेजें",
    close: "बंद करें",
    incident: "घटना",
    scenario: "परिदृश्य",
    severity: "गंभीरता",
    affectedArea: "प्रभावित क्षेत्र",
    refineArea: "क्षेत्र स्पष्ट करें, उदा. तटीय पट्टी और निचले गाँव",
    areaDescription: "प्रभावित क्षेत्र का विवरण",
    targetPopulation: "लक्षित जनसंख्या",
    languages: "भाषाएँ",
    message: "संदेश",
    issuingAuthority: "जारी करने वाला प्राधिकरण",
    expiry: "समाप्ति",
    viewSafeRoute: "सुरक्षित मार्ग देखें",
    nearestShelter: "निकटतम आश्रय",
    checkInRecorded: "चेक-इन दर्ज",
    emergency112: "आपातकाल 112",
    deviceOnlyNote: "केवल इस डिवाइस पर सहेजा \u2014 यह",
    viewIncident: "घटना देखें",
    simulatedAlert: "सिमुलेटेड चेतावनी।",
    dismissAlert: "चेतावनी बंद करें",
    issued: "जारी",
    source: "स्रोत",
    estimatedReach: "अनुमानित पहुँच",
    historyTitle: "फ़्लैश चेतावनी इतिहास",
    simulateAlert: "फ़्लैश चेतावनी सिमुलेट करें",
    demo: "डेमो",
    showOnHandset: "सिमुलेटेड हैंडसेट पर यह चेतावनी दिखाएँ",
    withdraw: "यह चेतावनी वापस लें",
    district: "ज़िला",
    targetArea: "लक्षित क्षेत्र",
    status: "स्थिति",
    operator: "ऑपरेटर",
    allDistricts: "सभी ज़िले",
    severityLabel: { extreme: "अत्यंत गंभीर", serious: "गंभीर", advisory: "सलाह" },
    severityAction: {
      extreme: "तुरंत सुरक्षात्मक कदम उठाएँ",
      serious: "कार्रवाई के लिए तैयार रहें और आधिकारिक अपडेट देखते रहें",
      advisory: "सूचित रहें और प्रभावित क्षेत्र से बचें",
    },
    statusLabel: {
      draft: "ड्राफ़्ट",
      ready: "तैयार",
      sent: "भेजा",
      expired: "समाप्त",
      cancelled: "रद्द",
    },
    scenarioLabel: {
      cyclone: "चक्रवात",
      flash_flood: "आकस्मिक बाढ़",
      extreme_rain: "अत्यधिक वर्षा",
      major_fire: "बड़ी आग",
      chemical_leak: "रासायनिक / गैस रिसाव",
      earthquake: "भूकंप",
      dam_river: "बाँध / नदी चेतावनी",
      building_collapse: "इमारत ढहना",
      industrial_accident: "औद्योगिक दुर्घटना",
      evacuation: "निकासी आदेश",
      p1_life_threat: "P1 जानलेवा घटना",
    },
    aiRecommendation: (pct) => `AI अनुशंसा \u00b7 ${pct}% विश्वास`,
    reachNote: "लोग \u2014 ज़िले की जनसंख्या से अनुमानित, डिवाइस रजिस्टर नहीं",
    wordingNote:
      "शब्दावली हर भाषा के लिए पहले से लिखी गई है और पूर्वावलोकन चरण में जाँची जाती है \u2014 भेजते समय इसका मशीन अनुवाद कभी नहीं होता।",
    approvingOperator: (name) => `स्वीकृति देने वाला ऑपरेटर: ${name}`,
    hours: (n) => `${n} घंटे`,
    until: (time) => `${time} तक`,
    back: "पीछे",
    cancelAction: "रद्द करें",
    cannotBroadcast:
      "ResQNet का फ़्रंटएंड सेल ब्रॉडकास्ट नहीं भेज सकता। भेजने पर चेतावनी फ़्लैश चेतावनी इतिहास में दर्ज होती है और सिमुलेटेड नागरिक हैंडसेट पर दिखती है, ताकि पूरी प्रक्रिया दिखाई जा सके।",
    expiresIn: (h) => `${h} घंटे में समाप्त`,
    sending: "भेजा जा रहा है\u2026",
    imSafe: "मैं सुरक्षित हूँ",
    notWord: "नहीं",
    callNowNote: "अभी तक कंट्रोल रूम तक पहुँचा। यदि अभी मदद चाहिए तो 112 पर कॉल करें।",
    simulatedAlertNote:
      "यह ResQNet की चेतावनी प्रक्रिया का प्रदर्शन है। यह सरकारी सेल ब्रॉडकास्ट नहीं है और किसी फ़ोन पर नहीं भेजा गया। वास्तविक तैनाती में स्वीकृत चेतावनी NDMA के कॉमन अलर्टिंग प्रोटोकॉल गेटवे को सौंपी जाती है, जो प्रसारण करता है।",
    raised: (n) => `${n} जारी`,
    noWarnings: "इस सत्र में कोई चेतावनी जारी नहीं हुई। उपयोग करें",
    noWarningsTail: "\u2014 कच्छ चक्रवात प्रदर्शन चलाने के लिए।",
    simulateBold: "फ़्लैश चेतावनी सिमुलेट करें",
    time: "समय",
    langCol: "भाषा",
    reached: (people) => `~${people} तक पहुँचा`,
    replay: (id) => `${id} फिर दिखाएँ`,
    cancelRow: (id) => `${id} रद्द करें`,
    historyFooter:
      "हर प्रविष्टि एक सिमुलेशन है। ResQNet का फ़्रंटएंड सेल ब्रॉडकास्ट नहीं भेजता \u2014 वास्तविक तैनाती में स्वीकृत चेतावनी NDMA के कॉमन अलर्टिंग प्रोटोकॉल गेटवे को सौंपी जाती।",
    people: (count) => `${count} लोग`,
    sourceValue: "ResQNet \u00b7 आपातकालीन प्रतिक्रिया नेटवर्क",
  },
  closeOnes: {
    title: "अपनों को सूचना",
    lead: "जब आप सुरक्षित होने की जानकारी देते हैं, नीचे के लोगों को भी पता चलता है।",
    add: "अपना व्यक्ति जोड़ें",
    name: "नाम",
    phone: "फ़ोन",
    relation: "संबंध",
    save: "सहेजें",
    cancel: "रद्द करें",
    remove: "हटाएँ",
    empty: "अभी कोई नहीं जोड़ा। जिसे सबसे पहले पता चलना चाहिए, उससे शुरू करें।",
    deviceOnly:
      "केवल इस डिवाइस पर सहेजा गया। इस बिल्ड में SMS गेटवे नहीं है, इसलिए अभी कोई संदेश फ़ोन तक नहीं पहुँचता।",
    notifyOnSafe: "जब मैं सुरक्षित होने की जानकारी दूँ तो उन्हें सूचित करें",
    toggleLabel: "जब मैं सुरक्षित होने की जानकारी दूँ तो अपनों को सूचित करें",
    offNote:
      "अभी आपकी चेक-इन केवल कंट्रोल रूम देखता है। अपने लोगों को भी बताने के लिए इसे चालू करें।",
    notifyBy: "किस माध्यम से सूचित करें",
    mobileNumber: "मोबाइल नंबर",
    channel: { sms: "SMS", call: "वॉइस कॉल", whatsapp: "WhatsApp" },
    relationship: {
      spouse: "जीवनसाथी",
      parent: "माता-पिता",
      child: "संतान",
      sibling: "भाई-बहन",
      relative: "रिश्तेदार",
      neighbour: "पड़ोसी",
      friend: "मित्र",
      carer: "देखभालकर्ता",
    },
    edit: (name) => `${name} संपादित करें`,
    removeNamed: (name) => `${name} हटाएँ`,
    errName: "नाम दर्ज करें।",
    errPhone: "10 अंकों का भारतीय मोबाइल नंबर दर्ज करें।",
    errDuplicate: "यह नंबर पहले से सहेजा है।",
    saveChanges: "बदलाव सहेजें",
    addContact: "संपर्क जोड़ें",
  },
  recommendation: {
    demoRanking: "डेमो रैंकिंग",
    notLive: "लाइव नहीं",
    demoNote: "ये इकाइयाँ डेमो डेटा हैं, लाइव बेड़ा नहीं।",
    staleNote:
      "अनुशंसाकर्ता का पिछला उत्तर दिख रहा है, वर्तमान बेड़ा नहीं।",
    confirm: "रवाना करने से पहले उपलब्धता की पुष्टि करें।",
    ranking: "इकाइयाँ क्रमित हो रही हैं\u2026",
    none: "कोई अनुशंसा उपलब्ध नहीं",
    noneNote:
      "इसके बजाय इकाई सूची से रवाना करें \u2014 यह पैनल केवल क्रम देता है, किसी को भेजने के लिए आवश्यक नहीं।",
    tryAgain: "फिर से प्रयास करें",
    dispatched: "इकाइयाँ रवाना हुईं। समयरेखा में उन्हें देखें।",
    approved: "रवानगी स्वीकृत",
    dispatching: "रवाना हो रहा है\u2026",
    aiRecommends: "AI अनुशंसा करे \u00b7 डिस्पैचर स्वीकृति दे",
    noAnswer: "अनुशंसाकर्ता ने उत्तर नहीं दिया।",
    failed: "रवानगी विफल",
  },
  banner: {
    citizenReport: "नागरिक रिपोर्ट \u00b7 असत्यापित",
    warningIssued: "चेतावनी जारी",
    demoWarning: "डेमो चेतावनी \u2014 जारी नहीं",
    officialWarning: "आधिकारिक चेतावनी",
    warningFor: (hazard, district) => `${hazard} चेतावनी \u00b7 ${district}`,
    viewDetails: "विवरण देखें",
    findShelter: "आश्रय खोजें",
    notifyDevice: "इस डिवाइस पर सूचित करें",
    notifyTitle: "इस चेतावनी को इस ब्राउज़र में, इस डिवाइस पर सूचना के रूप में दिखाएँ",
    notified: "इस डिवाइस पर सूचित",
    dismissWarning: "यह चेतावनी बंद करें",
    stateWide: "राज्यव्यापी",
    unverifiedNote: (source) =>
      `${source} द्वारा बताया गया और राज्य कंट्रोल रूम के सत्यापन की प्रतीक्षा में। यह बैनर केवल इस डिवाइस पर दिख रहा है \u2014 ResQNet फ़ोन पर प्रसारण नहीं करता। आपात स्थिति में 112 पर कॉल करें।`,
    demoNote: (source) =>
      `वॉकथ्रू के लिए ${source} को दिया गया प्रदर्शन चेतावनी। कुछ भी जारी नहीं हुआ और किसी को नहीं बताया गया। आपात स्थिति में 112 पर कॉल करें।`,
    officialNote: (source) =>
      `${source} द्वारा जारी। ResQNet आधिकारिक चेतावनियाँ दिखाता है \u2014 यह फ़ोन पर प्रसारण नहीं करता। आपात स्थिति में 112 पर कॉल करें।`,
  },
  connectivity: {
    label: { online: "ऑनलाइन", low: "कमज़ोर कनेक्शन", offline: "ऑफ़लाइन" },
    note: {
      online: "राज्य कंट्रोल रूम से जुड़ा हुआ।",
      low: "कमज़ोर कनेक्शन। भेजने में अधिक समय लग सकता है और विफल होने पर कतार में रखा जाएगा।",
      offline:
        "कोई कनेक्शन नहीं। आप जो भी भेजेंगे वह इस डिवाइस पर सहेजा जाएगा और वापस ऑनलाइन होने पर भेजा जाएगा।",
    },
    queued: (n) =>
      `${n} सबमिशन अब भी इस डिवाइस पर ${n === 1 ? "है" : "हैं"} \u2014 कंट्रोल रूम को अभी तक नहीं मिला।`,
    call112: "इसके बजाय 112 पर कॉल करें",
    sending: "भेजा जा रहा है\u2026",
    sendNow: "अभी भेजें",
    sent: (n) => `${n} कंट्रोल रूम को भेजा गया।`,
    failed: (n) => `${n} भेजा नहीं जा सका और अब भी प्रतीक्षा में ${n === 1 ? "है" : "हैं"}। `,
    undeliverable: (n) =>
      `${n} स्वतः नहीं भेजा जा सकता \u2014 कृपया फिर से भेजें।`,
    refused: (n) =>
      `${n} कंट्रोल रूम ने अस्वीकार किया और यह स्वयं दोबारा नहीं भेजा जाएगा।`,
    reason: (why) => `कारण: ${why}। `,
    tryAgain: () => "फिर भी दोबारा कोशिश करें",
  },
  charts: {
    count: "संख्या",
    reports: "रिपोर्टें",
    incidents: "घटनाएँ",
    noData: "इन फ़िल्टरों के लिए कोई डेटा नहीं",
    noIncidents: "इन फ़िल्टरों के लिए कोई घटना नहीं",
    noActivity: "इस अवधि में कोई गतिविधि नहीं",
    noCompleted: "इस अवधि में कोई पूर्ण प्रतिक्रिया नहीं",
    noShelters: "इस चयन में कोई आश्रय नहीं",
    noDistricts: "इस चयन में कोई ज़िला नहीं",
    noUnits: "इस चयन में कोई इकाई नहीं",
    showTable: "डेटा तालिका दिखाएँ",
    hideTable: "डेटा तालिका छिपाएँ",
    reportToDispatch: "रिपोर्ट \u2192 रवानगी",
    reportToResolved: "रिपोर्ट \u2192 समाधान",
    inUse: "उपयोग में",
    free: "खाली",
    activeIncidents: "सक्रिय घटनाएँ",
    committed: "लगी हुई",
    available: "उपलब्ध",
    districts: "ज़िले",
  },
  drawer: {
    selectIncident: "एक घटना चुनें",
    close: "बंद करें",
    sev: "गंभीरता",
    overview: "अवलोकन",
    reports: "रिपोर्टें",
    aiSummary: "AI स्थिति सारांश",
    confidenceTag: (pct) => `${pct}% विश्वास`,
    locationUnverified:
      "स्थान असत्यापित: रवाना करने से पहले कॉलर से पुष्टि करें",
    summarising: "रिपोर्टों का सारांश बन रहा है\u2026",
    reasoning: "तर्क:",
    reportsDisagree: "रिपोर्टें असहमत हैं:",
    modelConfidence: "मॉडल का विश्वास",
    recommendedActions: "अनुशंसित कार्रवाई",
    dispatchRecommendations: "रवानगी अनुशंसाएँ",
    activityTimeline: "गतिविधि समयरेखा",
    resolve: "हल करें",
    resolved: "हल हुआ",
    escalate: "बढ़ाएँ",
    escalated: "बढ़ाया गया",
    independentSources: (n) => `${n} स्वतंत्र स्रोत`,
    reportReceived: "रिपोर्ट मिली",
    firstOf: (n) => `${n} रिपोर्टों में से पहली`,
    aiTriage: "AI वर्गीकरण",
    triageDetail: (type, severity, priority) =>
      `${type} \u00b7 गंभीरता ${severity} \u00b7 ${priority}`,
    deduplication: "डुप्लिकेट हटाना",
    mergedInto: (n, code) => `${n} रिपोर्टें ${code} में मिलाई गईं`,
    currentState: "वर्तमान स्थिति",
    now: "अभी",
  },
  misc: {
    location: {
      title: "स्थान की अनुमति",
      on: "स्थान चालू है। आपके आसपास क्या हो रहा है वह दिखेगा.",
      share: "अपना स्थान साझा करें ताकि हम दिखा सकें कि आपके आसपास क्या हो रहा है।",
      usedFor:
        "पास के आश्रय, सुरक्षित मार्ग और स्थानीय चेतावनियों के लिए उपयोग होता है। आप कहाँ जाते हैं यह हम कभी ट्रैक नहीं करते।",
      unsupported:
        "यह ब्राउज़र स्थान साझा नहीं कर सकता। रिपोर्ट करना फिर भी काम करता है \u2014 निकटतम स्थल लिखें।",
      asking: "पूछा जा रहा है\u2026",
      shareButton: "मेरा स्थान साझा करें",
      blocked:
        "आपका ब्राउज़र इसे रोक रहा है। आप साइट सेटिंग्स में इसे फिर चालू कर सकते हैं \u2014 इसके बिना भी रिपोर्ट करना काम करता है।",
      denied: "अनुमति अस्वीकृत। आप स्थल लिखकर भी आपात सूचना दे सकते हैं।",
      unavailable: "अभी स्थान उपलब्ध नहीं। आप स्थल लिखकर भी रिपोर्ट कर सकते हैं।",
    },
    imSafe: {
      close: "बंद करें",
      recorded: "चेक-इन दर्ज",
      savedLocally: "केवल इस डिवाइस पर सहेजा",
      contactsNotified: "आपके सूचीबद्ध संपर्कों को बताया जाएगा कि आप सुरक्षित हैं।",
      noContactsNotified: "आपकी स्थिति दर्ज है। किसी संपर्क को सूचित नहीं किया गया।",
      offlineNote:
        "अभी कोई कनेक्शन नहीं है, इसलिए यह कंट्रोल रूम या आपके संपर्कों तक नहीं पहुँचा है। वापस ऑनलाइन होने पर यह अपने आप भेज दिया जाएगा।",
      name: "नाम",
      district: "ज़िला",
      recordedAt: "दर्ज",
      yourName: "आपका नाम",
      districtYouAreIn: "आप जिस ज़िले में हैं",
      message: "संदेश (वैकल्पिक)",
      messagePlaceholder: "परिवार के साथ आश्रय में हूँ",
      notifyCloseOnes: "मेरे अपनों को सूचित करें",
      noneSaved:
        "अभी कोई अपना नहीं सहेजा, इसलिए यह चेक-इन केवल कंट्रोल रूम तक पहुँचेगा।",
      addCloseOnes: "अपने लोग जोड़ें",
      recording: "दर्ज हो रहा है\u2026",
      markMeSafe: "मुझे सुरक्षित चिह्नित करें",
    },
    alerts: {
      soundBlocked: "जब तक आप क्लिक न करें, ध्वनि बंद",
      soundBlockedNote: "ध्वनि चलाने से पहले ब्राउज़र को पृष्ठ पर एक क्लिक चाहिए।",
      unmute: "चेतावनी ध्वनि चालू करें",
      mute: "चेतावनी ध्वनि बंद करें",
      muted: "ध्वनि बंद",
      soundOn: "ध्वनि चालू",
      acknowledge: "स्वीकारें",
    },
    queue: {
      title: "घटना कतार",
      sort: "प्राथमिकता \u2192 आयु",
      activeSignals: "सक्रिय संकेत",
      live: "लाइव",
      filterType: "प्रकार",
      filterStatus: "स्थिति",
      filterSev: "गंभीरता",
      sortPrefix: "क्रम",
      reportsShort: "रिपोर्ट",
    },
    liveIst: "लाइव IST",
    urgency: {
      immediate: "अभी जान का ख़तरा",
      urgent: "तुरंत मदद चाहिए",
      standard: "ध्यान देना ज़रूरी",
    },
    urgencyQuestion: "यह कितना तात्कालिक है?",
    status: "स्थिति",
    chartTable: {
      caption: "प्रति समय-खंड रिपोर्टें और घटनाएँ",
      time: "समय",
      reports: "रिपोर्टें",
      incidents: "घटनाएँ",
    },
    districtIndex: "ज़िला सूचकांक",
    priorityArea: "प्राथमिकता क्षेत्र",
    filterPlaceholder: "घटना, ज़िला, इकाई या गंभीरता से छाँटें...",
    weatherTrend: "मौसम प्रवृत्ति",
    cycloneSchematic:
      "अरब सागर पर चक्रवात और कच्छ तट की ओर उसके संभावित मार्ग का रेखाचित्र",
    mapLayers: "मानचित्र परतें",
    toggleGrid: "मानचित्र की ग्रिड संदर्भ परत चालू/बंद करें",
    resetView: "मानचित्र दृश्य रीसेट करें",
    closeDistrictPanel: "ज़िला पैनल बंद करें",
    resqPulse: "ResQ पल्स",
    pulse: {
      reports: "रिपोर्ट",
      blockedRoads: "बंद रास्ते",
      sheltersActive: "सक्रिय आश्रय",
      responseTeams: "प्रतिक्रिया दल",
    },
    compositePosture: (rank) => `स्तर ${rank} / 5 \u00b7 संयुक्त स्थिति`,
    loadingMap: "नक्शा लोड हो रहा है\u2026",
    liveMapIntro: "राज्यभर में जिला जोखिम स्थिति और परिचालन मार्कर।",
    inView: (n) => `${n} दिख रहे हैं`,
    incidentsLabel: "घटनाएँ",
    amenity: { food: "भोजन", water: "पानी", medical: "चिकित्सा" },
    shelterDistanceNote:
      "दूरियाँ चयनित जिला केंद्र से सीधी रेखा में हैं, सड़क दूरी नहीं।",
    markersGrouped: (n) => `${n} मार्कर \u00b7 ओवरलैप समूहित`,
    centroidNote:
      "गोले जिलों के केंद्रबिंदु दर्शाते हैं और जोखिम की स्थिति बताते हैं \u2014 ये प्रशासनिक सीमाएँ नहीं हैं।",
    mapLive: "लाइव",
    mapDemoData: "डेमो डेटा",
    mapLayerMissing: "परत अनुपलब्ध",
    allLayersFromApi: "इस मानचित्र की हर परत API से आई है।",
    weakestLayer: (what) => `इस मानचित्र की सबसे कमज़ोर परत: ${what}.`,
    districtAria: (district, risk, incidents) =>
      `${district}, ${risk} जोखिम, ${incidents} सक्रिय घटनाएँ`,
    markersInDistrict: (n) => `, ज़िले में ${n} मार्कर`,
    api: {
      serverWaking:
        "सर्वर जाग रहा है — कुछ निष्क्रिय मिनटों के बाद API सो जाता है और शुरू होने में एक मिनट तक लगता है। फिर से कोशिश करने पर काम करेगा।",
      deviceOffline: "यह डिवाइस ऑफ़लाइन है",
      offlineLastKnown: "ऑफ़लाइन — अंतिम ज्ञात डेटा दिखाया जा रहा है",
      timedOut: "अनुरोध का समय समाप्त",
      showingDemoData: (note) => `${note} — डेमो डेटा दिखाया जा रहा है`,
    },
    freshness: {
      offline: "ऑफ़लाइन",
      updatedAgo: (age) => `${age} पहले अपडेट`,
      locationStale: "स्थान पुराना",
      capacityStale: "क्षमता पुरानी",
      sec: (n) => `${n} सेकंड`,
      min: (n) => `${n} मिनट`,
      hr: (n) => `${n} घंटे`,
    },
    liveMap: "लाइव मानचित्र",
    districtsByRisk: "जोखिम अनुसार ज़िले",
    notVerifiedOnScene: "घटनास्थल पर अभी सत्यापित नहीं",
    demoDataOnMap: "इस मानचित्र पर डेमो डेटा:",
    stateOperations: "ResQNet \u00b7 राज्य संचालन",
    openNavigation: "नेविगेशन खोलें",
    closeNavigation: "नेविगेशन बंद करें",
    sections: "अनुभाग",
    logoAlt: "ResQNet \u2014 आपदा प्रतिक्रिया प्लेटफ़ॉर्म",
    photoPreview: "संलग्न फ़ोटो का पूर्वावलोकन",
    dragPin: "स्थान सुधारने के लिए पिन खींचें",
  },
};

const PAGE_STRINGS: Record<Lang, PageStrings> = { en, gu, hi };

/** Page copy in one language. Falls back to English for an unknown code. */
export function pageStrings(lang: Lang): PageStrings {
  return PAGE_STRINGS[lang] ?? en;
}
