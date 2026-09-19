/**
 * Flash Alert content, scenarios and the recommendation rule.
 *
 * Message text is authored per language rather than machine-translated: a
 * warning that tells four million people what to do is not something to hand
 * to a translation API, and the operator approves each language explicitly.
 */

import type { Lang } from "@/types";
import type {
  FlashAlert,
  FlashRecommendation,
  FlashScenario,
  FlashSeverity,
} from "@/types/flash";

export const FLASH_SEVERITY_META: Record<
  FlashSeverity,
  { label: string; color: string; bg: string; rank: number; action: string }
> = {
  extreme: {
    label: "EXTREME",
    color: "var(--crimson)",
    bg: "var(--critical-bg)",
    rank: 3,
    action: "Take protective action immediately",
  },
  serious: {
    label: "SERIOUS",
    color: "var(--high)",
    bg: "var(--high-bg)",
    rank: 2,
    action: "Prepare to act and monitor official updates",
  },
  advisory: {
    label: "ADVISORY",
    color: "var(--amber-600)",
    bg: "var(--medium-bg)",
    rank: 1,
    action: "Stay informed and avoid the affected area",
  },
};

export const FLASH_STATUS_META: Record<
  FlashAlert["status"],
  { label: string; color: string }
> = {
  draft: { label: "DRAFT", color: "var(--muted)" },
  ready: { label: "READY", color: "var(--blue)" },
  sent: { label: "SENT", color: "var(--crimson)" },
  expired: { label: "EXPIRED", color: "var(--faint)" },
  cancelled: { label: "CANCELLED", color: "var(--muted)" },
};

export const FLASH_SCENARIO_META: Record<
  FlashScenario,
  { label: string; severity: FlashSeverity }
> = {
  cyclone: { label: "Cyclone", severity: "extreme" },
  flash_flood: { label: "Flash Flood", severity: "extreme" },
  extreme_rain: { label: "Extreme Rainfall", severity: "serious" },
  major_fire: { label: "Major Fire", severity: "serious" },
  chemical_leak: { label: "Chemical / Gas Leak", severity: "extreme" },
  earthquake: { label: "Earthquake", severity: "extreme" },
  dam_river: { label: "Dam / River Warning", severity: "serious" },
  building_collapse: { label: "Building Collapse", severity: "serious" },
  industrial_accident: { label: "Industrial Accident", severity: "serious" },
  evacuation: { label: "Evacuation Order", severity: "extreme" },
  p1_life_threat: { label: "P1 Life-Threatening Incident", severity: "extreme" },
};

/**
 * Estimated district populations, used only to show an operator roughly how
 * many people a warning would reach. Rounded order-of-magnitude figures for
 * demonstration — the interface labels the number as an estimate and never
 * presents it as a register count.
 */
export const DISTRICT_POPULATION: Record<string, number> = {
  Kutch: 2_092_000,
  Banaskantha: 3_120_000,
  Patan: 1_343_000,
  Mehsana: 2_035_000,
  Gandhinagar: 1_391_000,
  Ahmedabad: 7_214_000,
  Surendranagar: 1_756_000,
  Rajkot: 3_804_000,
  Jamnagar: 1_408_000,
  Junagadh: 1_525_000,
  Amreli: 1_514_000,
  Bhavnagar: 2_880_000,
  Vadodara: 4_165_000,
  Bharuch: 1_551_000,
  Narmada: 590_000,
  Surat: 6_081_000,
  Navsari: 1_330_000,
};

/** Gujarat's approximate population, for a state-wide warning. */
export const STATE_POPULATION = 63_872_000;

export function estimateReach(district: string | null): number {
  if (!district) return STATE_POPULATION;
  return DISTRICT_POPULATION[district] ?? 500_000;
}

/** "4.2 million" / "590 thousand" — readable at a glance under pressure. */
export function formatReach(n: number): string {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(2)} crore`;
  if (n >= 100_000) return `${(n / 100_000).toFixed(1)} lakh`;
  return n.toLocaleString("en-IN");
}

type Copy = Record<Lang, string>;

/**
 * Authored warning text per scenario. `{area}` is the only substitution, so
 * the operator always sees the exact words that will go out.
 */
const COPY: Record<FlashScenario, { headline: Copy; body: Copy }> = {
  cyclone: {
    headline: {
      en: "CYCLONE WARNING — {area}",
      gu: "ચક્રવાત ચેતવણી — {area}",
      hi: "चक्रवात चेतावनी — {area}",
    },
    body: {
      en: "Severe cyclonic conditions are expected near {area}. Move away from coastal and low-lying areas and follow official evacuation instructions.",
      gu: "{area} નજીક તીવ્ર ચક્રવાતી સ્થિતિ અપેક્ષિત છે. દરિયાકાંઠા અને નીચાણવાળા વિસ્તારોથી દૂર જાઓ અને સત્તાવાર સ્થળાંતર સૂચનાઓનું પાલન કરો.",
      hi: "{area} के पास भीषण चक्रवाती स्थिति की आशंका है। तटीय और निचले इलाकों से दूर हट जाएँ और आधिकारिक निकासी निर्देशों का पालन करें।",
    },
  },
  flash_flood: {
    headline: {
      en: "FLASH FLOOD WARNING — {area}",
      gu: "અચાનક પૂર ચેતવણી — {area}",
      hi: "आकस्मिक बाढ़ चेतावनी — {area}",
    },
    body: {
      en: "Water is rising rapidly in {area}. Move to higher ground now. Do not attempt to cross flooded roads or underpasses on foot or by vehicle.",
      gu: "{area}માં પાણી ઝડપથી વધી રહ્યું છે. તાત્કાલિક ઊંચાણવાળી જગ્યાએ જાઓ. પાણી ભરેલા રસ્તા કે અંડરપાસ પગપાળા કે વાહનથી પાર કરવાનો પ્રયાસ ન કરો.",
      hi: "{area} में पानी तेज़ी से बढ़ रहा है। तुरंत ऊँचे स्थान पर जाएँ। पानी भरी सड़कों या अंडरपास को पैदल या वाहन से पार करने की कोशिश न करें।",
    },
  },
  extreme_rain: {
    headline: {
      en: "EXTREMELY HEAVY RAINFALL — {area}",
      gu: "અતિ ભારે વરસાદ — {area}",
      hi: "अत्यधिक भारी वर्षा — {area}",
    },
    body: {
      en: "Extremely heavy rainfall is expected over {area} in the next 12 hours. Avoid non-essential travel and stay away from waterlogged underpasses.",
      gu: "આગામી 12 કલાકમાં {area} પર અતિ ભારે વરસાદની શક્યતા છે. બિનજરૂરી મુસાફરી ટાળો અને પાણી ભરાયેલા અંડરપાસથી દૂર રહો.",
      hi: "अगले 12 घंटों में {area} पर अत्यधिक भारी वर्षा की संभावना है। अनावश्यक यात्रा से बचें और जलभराव वाले अंडरपास से दूर रहें।",
    },
  },
  major_fire: {
    headline: {
      en: "MAJOR FIRE — {area}",
      gu: "મોટી આગ — {area}",
      hi: "बड़ी आग — {area}",
    },
    body: {
      en: "A major fire is active in {area}. Keep clear of the area, keep access roads free for emergency vehicles, and close windows if you are downwind of the smoke.",
      gu: "{area}માં મોટી આગ લાગી છે. વિસ્તારથી દૂર રહો, કટોકટી વાહનો માટે રસ્તા ખુલ્લા રાખો અને ધુમાડાની દિશામાં હો તો બારીઓ બંધ કરો.",
      hi: "{area} में बड़ी आग लगी है। क्षेत्र से दूर रहें, आपातकालीन वाहनों के लिए रास्ता खाली रखें और धुएँ की दिशा में होने पर खिड़कियाँ बंद रखें।",
    },
  },
  chemical_leak: {
    headline: {
      en: "CHEMICAL LEAK — {area}",
      gu: "રાસાયણિક ગેસ લીક — {area}",
      hi: "रासायनिक गैस रिसाव — {area}",
    },
    body: {
      en: "A chemical release has been reported in {area}. Go indoors immediately, close all doors and windows, switch off air conditioning, and wait for the all-clear.",
      gu: "{area}માં રાસાયણિક ગેસ લીકની જાણ થઈ છે. તાત્કાલિક ઘરની અંદર જાઓ, બધા દરવાજા-બારીઓ બંધ કરો, એ.સી. બંધ કરો અને સૂચના મળે ત્યાં સુધી રાહ જુઓ.",
      hi: "{area} में रासायनिक रिसाव की सूचना है। तुरंत घर के अंदर जाएँ, सभी दरवाज़े-खिड़कियाँ बंद करें, एयर कंडीशनिंग बंद करें और अगली सूचना तक प्रतीक्षा करें।",
    },
  },
  earthquake: {
    headline: {
      en: "EARTHQUAKE — {area}",
      gu: "ભૂકંપ — {area}",
      hi: "भूकंप — {area}",
    },
    body: {
      en: "An earthquake has been recorded near {area}. Move away from damaged structures, expect aftershocks, and do not use lifts.",
      gu: "{area} નજીક ભૂકંપ નોંધાયો છે. નુકસાન પામેલી ઇમારતોથી દૂર જાઓ, આફ્ટરશોકની શક્યતા છે, લિફ્ટનો ઉપયોગ ન કરો.",
      hi: "{area} के पास भूकंप दर्ज किया गया है। क्षतिग्रस्त संरचनाओं से दूर हटें, आफ़्टरशॉक की आशंका है, लिफ़्ट का उपयोग न करें।",
    },
  },
  dam_river: {
    headline: {
      en: "RIVER / DAM RELEASE WARNING — {area}",
      gu: "નદી / ડેમ છોડવાની ચેતવણી — {area}",
      hi: "नदी / बांध छोड़ने की चेतावनी — {area}",
    },
    body: {
      en: "Water is being released upstream and river levels in {area} will rise. Move away from the riverbank and low-lying settlements now.",
      gu: "ઉપરવાસમાંથી પાણી છોડાઈ રહ્યું છે અને {area}માં નદીનું સ્તર વધશે. નદીકાંઠા અને નીચાણવાળી વસાહતોથી તાત્કાલિક દૂર જાઓ.",
      hi: "ऊपरी क्षेत्र से पानी छोड़ा जा रहा है और {area} में नदी का स्तर बढ़ेगा। नदी किनारे और निचली बस्तियों से तुरंत दूर हट जाएँ।",
    },
  },
  building_collapse: {
    headline: {
      en: "STRUCTURAL COLLAPSE — {area}",
      gu: "ઇમારત ધરાશાયી — {area}",
      hi: "इमारत ढहने की घटना — {area}",
    },
    body: {
      en: "A structure has collapsed in {area} and rescue work is under way. Keep the lane clear for rescue teams and avoid adjacent buildings.",
      gu: "{area}માં ઇમારત ધરાશાયી થઈ છે અને બચાવ કામગીરી ચાલુ છે. બચાવ ટીમ માટે રસ્તો ખુલ્લો રાખો અને બાજુની ઇમારતોથી દૂર રહો.",
      hi: "{area} में एक इमारत ढह गई है और बचाव कार्य जारी है। बचाव दल के लिए रास्ता खाली रखें और आसपास की इमारतों से दूर रहें।",
    },
  },
  industrial_accident: {
    headline: {
      en: "INDUSTRIAL ACCIDENT — {area}",
      gu: "ઔદ્યોગિક દુર્ઘટના — {area}",
      hi: "औद्योगिक दुर्घटना — {area}",
    },
    body: {
      en: "An industrial accident has occurred in {area}. An exclusion zone is in force. Do not approach the site and follow instructions from response teams.",
      gu: "{area}માં ઔદ્યોગિક દુર્ઘટના બની છે. પ્રતિબંધિત ક્ષેત્ર અમલમાં છે. સ્થળ પાસે ન જાઓ અને પ્રતિસાદ ટીમની સૂચનાઓનું પાલન કરો.",
      hi: "{area} में औद्योगिक दुर्घटना हुई है। निषेध क्षेत्र लागू है। स्थल के पास न जाएँ और प्रतिक्रिया दल के निर्देशों का पालन करें।",
    },
  },
  evacuation: {
    headline: {
      en: "EVACUATION ORDER — {area}",
      gu: "સ્થળાંતર આદેશ — {area}",
      hi: "निकासी आदेश — {area}",
    },
    body: {
      en: "An evacuation order is in force for {area}. Leave now by the marked route, carry identification and essential medicines, and report to the nearest shelter.",
      gu: "{area} માટે સ્થળાંતર આદેશ અમલમાં છે. ચિહ્નિત માર્ગે તાત્કાલિક નીકળો, ઓળખપત્ર અને જરૂરી દવાઓ સાથે લો, અને નજીકના આશ્રયસ્થાને પહોંચો.",
      hi: "{area} के लिए निकासी आदेश लागू है। चिह्नित मार्ग से तुरंत निकलें, पहचान पत्र और आवश्यक दवाएँ साथ लें, और निकटतम शरण स्थल पर पहुँचें।",
    },
  },
  p1_life_threat: {
    headline: {
      en: "EMERGENCY — {area}",
      gu: "કટોકટી — {area}",
      hi: "आपातकाल — {area}",
    },
    body: {
      en: "A life-threatening emergency is in progress in {area}. Keep clear of the area and keep roads free for emergency vehicles.",
      gu: "{area}માં જીવલેણ કટોકટી ચાલી રહી છે. વિસ્તારથી દૂર રહો અને કટોકટી વાહનો માટે રસ્તા ખુલ્લા રાખો.",
      hi: "{area} में जानलेवा आपात स्थिति जारी है। क्षेत्र से दूर रहें और आपातकालीन वाहनों के लिए सड़कें खाली रखें।",
    },
  },
};

/** Fills `{area}` in every language at once. */
export function renderCopy(
  scenario: FlashScenario,
  area: string,
): { headline: Record<Lang, string>; body: Record<Lang, string> } {
  const c = COPY[scenario];
  const fill = (m: Copy): Record<Lang, string> => ({
    en: m.en.replaceAll("{area}", area),
    gu: m.gu.replaceAll("{area}", area),
    hi: m.hi.replaceAll("{area}", area),
  });
  return { headline: fill(c.headline), body: fill(c.body) };
}

/**
 * The AI's recommendation.
 *
 * This is the whole extent of the model's authority: it proposes a scenario,
 * a severity, an area and the wording, and explains why. It cannot send, and
 * there is no code path from here to a send — `FlashAlertProvider.send()` is
 * reachable only from an operator action.
 */
export function recommendFlashAlert(input: {
  scenario: FlashScenario;
  district: string | null;
  area: string;
  incidentCode?: string | null;
  peopleAffected?: number;
  reportCount?: number;
}): FlashRecommendation {
  const meta = FLASH_SCENARIO_META[input.scenario];
  const { headline, body } = renderCopy(input.scenario, input.area);
  const reach = estimateReach(input.district);

  const bits: string[] = [];
  if (input.incidentCode) bits.push(`raised from ${input.incidentCode}`);
  if (input.reportCount) bits.push(`${input.reportCount} corroborating reports`);
  if (input.peopleAffected) bits.push(`${input.peopleAffected} people affected on scene`);
  bits.push(`${meta.label.toLowerCase()} hazard class`);

  // Confidence rises with corroboration and falls without it. It describes the
  // classification only — never the decision to warn, which is not the model's.
  const corroboration = Math.min(1, (input.reportCount ?? 1) / 6);
  const confidence = Math.round((0.62 + corroboration * 0.3) * 100) / 100;

  return {
    scenario: input.scenario,
    severity: meta.severity,
    target: {
      scope: input.district ? "district" : "state",
      district: input.district,
      area: input.area,
      population: reach,
    },
    headline,
    body,
    rationale: `Recommended because ${bits.join(", ")}. An authorised operator must review the wording and the target area before this is issued.`,
    confidence,
  };
}
