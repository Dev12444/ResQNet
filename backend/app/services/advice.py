"""Citizen safety advice in English / Gujarati / Hindi. Owner: BE2.

Shown on /report right after a citizen submits ("help is on the way; meanwhile..."). Deliberately
**fixed, reviewed templates, not LLM output**: invented safety instructions could hurt someone, and
templates are instant and work offline. Selected by incident type + hazards; hazard tips come first
because they are the most urgent. Numbers: 112 (national emergency), 108 (ambulance, Gujarat EMRI),
101 (fire), 100 (police), 1070 (Gujarat State Emergency Operation Centre), 1077 (district control room).
"""
from __future__ import annotations

LANGS = ("en", "gu", "hi")
MAX_TIPS = 5

# Each tip: {"en": ..., "gu": ..., "hi": ...}
_T = dict[str, str]

HAZARD_TIPS: dict[str, list[_T]] = {
    "trapped_people": [
        {"en": "If you are trapped, stay where rescuers can see or hear you. Shout, whistle or tap on metal.",
         "gu": "જો તમે ફસાયા હો, તો બચાવ ટીમ જોઈ કે સાંભળી શકે ત્યાં રહો. બૂમ પાડો, સીટી વગાડો કે ધાતુ પર ઠોકો.",
         "hi": "अगर आप फँसे हैं, तो वहीं रहें जहाँ बचाव दल देख या सुन सके। आवाज़ लगाएँ, सीटी बजाएँ या धातु पर ठोकें।"},
        {"en": "Keep your phone on and save battery, so rescuers can reach you.",
         "gu": "ફોન ચાલુ રાખો અને બેટરી બચાવો, જેથી બચાવ ટીમ તમારો સંપર્ક કરી શકે.",
         "hi": "फ़ोन चालू रखें और बैटरी बचाएँ, ताकि बचाव दल आपसे संपर्क कर सके।"},
    ],
    "gas_leak": [
        {"en": "Move upwind and away from the smell. Cover your nose and mouth with a wet cloth.",
         "gu": "ગંધથી દૂર, પવનની વિરુદ્ધ દિશામાં જાઓ. નાક અને મોં ભીના કપડાથી ઢાંકો.",
         "hi": "गंध से दूर, हवा की उल्टी दिशा में जाएँ। नाक और मुँह गीले कपड़े से ढकें।"},
        {"en": "Do not light matches, smoke, or switch electrical items on or off.",
         "gu": "માચીસ ન સળગાવો, ધૂમ્રપાન ન કરો, અને વીજળીની સ્વિચ ચાલુ-બંધ ન કરો.",
         "hi": "माचिस न जलाएँ, धूम्रपान न करें, और बिजली के स्विच चालू-बंद न करें।"},
    ],
    "chemical": [
        {"en": "Stay indoors with windows and doors closed if you cannot move away from the fumes.",
         "gu": "જો ધુમાડાથી દૂર ન જઈ શકો, તો ઘરમાં રહો અને બારી-દરવાજા બંધ રાખો.",
         "hi": "अगर धुएँ से दूर नहीं जा सकते, तो घर के अंदर रहें और खिड़की-दरवाज़े बंद रखें।"},
    ],
    "rising_water": [
        {"en": "Move to higher ground or an upper floor now. Do not wait for the water to rise further.",
         "gu": "હમણાં જ ઊંચી જગ્યાએ અથવા ઉપરના માળે જાઓ. પાણી વધુ વધે તેની રાહ ન જુઓ.",
         "hi": "अभी ऊँची जगह या ऊपरी मंज़िल पर जाएँ। पानी और बढ़ने का इंतज़ार न करें।"},
    ],
    "electrical": [
        {"en": "Stay at least 10 metres away from fallen wires and sparking poles. Never touch water near them.",
         "gu": "પડેલા વાયર અને તણખા ઝરતા થાંભલાથી ઓછામાં ઓછું 10 મીટર દૂર રહો. તેની પાસેના પાણીને અડશો નહીં.",
         "hi": "गिरे तारों और चिंगारी वाले खंभों से कम से कम 10 मीटर दूर रहें। उनके पास के पानी को न छुएँ।"},
    ],
    "fire_spread": [
        {"en": "Get out and stay out. Close doors behind you to slow the fire. Do not use lifts.",
         "gu": "બહાર નીકળો અને બહાર જ રહો. આગ ધીમી કરવા પાછળના દરવાજા બંધ કરો. લિફ્ટનો ઉપયોગ ન કરો.",
         "hi": "बाहर निकलें और बाहर ही रहें। आग धीमी करने के लिए पीछे के दरवाज़े बंद करें। लिफ़्ट का उपयोग न करें।"},
    ],
    "structural": [
        {"en": "Keep away from cracked walls, damaged buildings and hanging debris.",
         "gu": "તિરાડવાળી દીવાલો, નુકસાન પામેલી ઇમારતો અને લટકતા કાટમાળથી દૂર રહો.",
         "hi": "दरार वाली दीवारों, क्षतिग्रस्त इमारतों और लटकते मलबे से दूर रहें।"},
    ],
    "injuries": [
        {"en": "Press a clean cloth firmly on any bleeding. Do not move someone with a possible neck or back injury.",
         "gu": "લોહી વહેતું હોય ત્યાં સાફ કપડું જોરથી દબાવો. ગરદન કે પીઠની ઈજા હોય તો વ્યક્તિને ખસેડશો નહીં.",
         "hi": "खून बहने वाली जगह पर साफ़ कपड़ा ज़ोर से दबाएँ। गर्दन या पीठ की चोट हो तो व्यक्ति को न हिलाएँ।"},
    ],
}

TYPE_TIPS: dict[str, list[_T]] = {
    "flood": [
        {"en": "Do not walk or drive through moving water. 15 cm can knock you down; 60 cm can sweep a car away.",
         "gu": "વહેતા પાણીમાંથી ચાલીને કે વાહન લઈને ન જાઓ. 15 સેમી પાણી તમને પાડી શકે; 60 સેમી ગાડી તાણી જાય.",
         "hi": "बहते पानी में न चलें, न गाड़ी चलाएँ। 15 सेमी पानी आपको गिरा सकता है; 60 सेमी गाड़ी बहा सकता है।"},
        {"en": "Switch off the main power supply if water is entering your home and it is safe to reach.",
         "gu": "ઘરમાં પાણી આવતું હોય અને સુરક્ષિત રીતે પહોંચી શકાય, તો મુખ્ય વીજ પુરવઠો બંધ કરો.",
         "hi": "घर में पानी आ रहा हो और सुरक्षित पहुँच सकें, तो मुख्य बिजली सप्लाई बंद करें।"},
    ],
    "fire": [
        {"en": "Stay low under the smoke and leave by the nearest safe exit. Call 101.",
         "gu": "ધુમાડાની નીચે નમીને ચાલો અને નજીકના સુરક્ષિત રસ્તે બહાર નીકળો. 101 પર ફોન કરો.",
         "hi": "धुएँ के नीचे झुककर चलें और नज़दीकी सुरक्षित रास्ते से बाहर निकलें। 101 पर फ़ोन करें।"},
        {"en": "If your clothes catch fire: stop, drop to the ground and roll.",
         "gu": "કપડાં સળગે તો: ઊભા રહો, જમીન પર પડો અને આળોટો.",
         "hi": "कपड़ों में आग लगे तो: रुकें, ज़मीन पर लेटें और लुढ़कें।"},
    ],
    "road_accident": [
        {"en": "Switch on hazard lights and keep bystanders away from traffic. Call 108 for an ambulance.",
         "gu": "હેઝાર્ડ લાઇટ ચાલુ કરો અને લોકોને ટ્રાફિકથી દૂર રાખો. એમ્બ્યુલન્સ માટે 108 પર ફોન કરો.",
         "hi": "हैज़र्ड लाइट चालू करें और लोगों को ट्रैफ़िक से दूर रखें। एम्बुलेंस के लिए 108 पर फ़ोन करें।"},
        {"en": "Do not remove a rider's helmet or pull people out of a vehicle unless there is fire.",
         "gu": "આગ ન હોય ત્યાં સુધી ચાલકનું હેલ્મેટ ન કાઢો કે લોકોને ગાડીમાંથી ખેંચી ન કાઢો.",
         "hi": "आग न हो तो सवार का हेलमेट न उतारें और लोगों को गाड़ी से न खींचें।"},
    ],
    "industrial": [
        {"en": "Leave the area in the direction your plant's evacuation plan or officials tell you. Call 101.",
         "gu": "પ્લાન્ટની ખાલી કરવાની યોજના કે અધિકારીઓ કહે તે દિશામાં વિસ્તાર છોડો. 101 પર ફોન કરો.",
         "hi": "संयंत्र की निकासी योजना या अधिकारियों के बताए रास्ते से क्षेत्र छोड़ें। 101 पर फ़ोन करें।"},
    ],
    "medical": [
        {"en": "Call 108. Keep the person still and comfortable, and do not give food or water if unconscious.",
         "gu": "108 પર ફોન કરો. વ્યક્તિને સ્થિર અને આરામથી રાખો; બેભાન હોય તો ખાવા-પીવાનું ન આપો.",
         "hi": "108 पर फ़ोन करें। व्यक्ति को स्थिर और आराम से रखें; बेहोश हो तो खाना-पानी न दें।"},
        {"en": "If the person is not breathing and you are trained, start CPR until help arrives.",
         "gu": "વ્યક્તિ શ્વાસ ન લેતી હોય અને તમે તાલીમ પામેલા હો, તો મદદ આવે ત્યાં સુધી CPR શરૂ કરો.",
         "hi": "व्यक्ति साँस न ले रहा हो और आप प्रशिक्षित हों, तो मदद आने तक CPR शुरू करें।"},
    ],
    "building_collapse": [
        {"en": "Get into open ground away from the structure. Do not re-enter to collect belongings.",
         "gu": "ઇમારતથી દૂર ખુલ્લી જગ્યામાં જાઓ. સામાન લેવા પાછા અંદર ન જાઓ.",
         "hi": "इमारत से दूर खुली जगह में जाएँ। सामान लेने वापस अंदर न जाएँ।"},
    ],
    "other": [
        {"en": "Stay at a safe distance and keep others away until responders arrive.",
         "gu": "સુરક્ષિત અંતરે રહો અને મદદ આવે ત્યાં સુધી બીજાને દૂર રાખો.",
         "hi": "सुरक्षित दूरी पर रहें और मदद आने तक दूसरों को दूर रखें।"},
    ],
}

HEADLINE: _T = {
    "en": "Your report has reached the control room. Help is being arranged.",
    "gu": "તમારો રિપોર્ટ કંટ્રોલ રૂમ સુધી પહોંચી ગયો છે. મદદની વ્યવસ્થા થઈ રહી છે.",
    "hi": "आपकी रिपोर्ट कंट्रोल रूम तक पहुँच गई है। मदद की व्यवस्था की जा रही है।",
}
HELPLINES = [
    {"number": "112", "label": {"en": "Emergency", "gu": "ઇમરજન્સી", "hi": "आपातकाल"}},
    {"number": "108", "label": {"en": "Ambulance", "gu": "એમ્બ્યુલન્સ", "hi": "एम्बुलेंस"}},
    {"number": "101", "label": {"en": "Fire", "gu": "ફાયર", "hi": "फ़ायर"}},
    {"number": "1070", "label": {"en": "Gujarat disaster control room", "gu": "ગુજરાત આપત્તિ કંટ્રોલ રૂમ",
                                 "hi": "गुजरात आपदा कंट्रोल रूम"}},
]


def safety_advice(type_: str | None, hazards: list[str] | None = None, lang: str | None = "en") -> dict:
    """{lang, headline, tips[], helplines[]} for the citizen. Hazard tips first. Never raises."""
    lang = lang if lang in LANGS else "en"
    tips: list[str] = []
    for hz in hazards or []:
        for tip in HAZARD_TIPS.get(hz, []):
            if tip[lang] not in tips:
                tips.append(tip[lang])
    for tip in TYPE_TIPS.get(type_ or "other", TYPE_TIPS["other"]):
        if tip[lang] not in tips:
            tips.append(tip[lang])
    return {
        "lang": lang,
        "headline": HEADLINE[lang],
        "tips": tips[:MAX_TIPS],
        "helplines": [{"number": h["number"], "label": h["label"][lang]} for h in HELPLINES],
    }
