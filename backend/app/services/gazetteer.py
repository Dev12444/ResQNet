"""Tiny Ahmedabad gazetteer: place name (EN/GU/HI aliases) -> approx lat/lng. Owner: BE2.

Used to (a) extract a location from report text in the fallback classifier and
(b) geocode `location_text` when a report arrives without coordinates (BE1 pipeline).
Coordinates are approximate area centroids — good enough for dedup + ETA in the demo.
"""
from __future__ import annotations

CITY_CENTER = (23.0225, 72.5714)

# canonical name -> (lat, lng, aliases)
PLACES: dict[str, tuple[float, float, list[str]]] = {
    "Akhbarnagar Underpass": (23.0588, 72.5620, ["akhbarnagar", "akhbar nagar", "અખબારનગર", "अखबारनगर"]),
    "Vasna Barrage": (22.9960, 72.5580, ["vasna barrage", "vasna", "વાસણા", "वासणा", "वासना"]),
    "C.G. Road": (23.0290, 72.5600, ["c.g. road", "cg road", "c g road", "chimanlal girdharlal", "સી.જી. રોડ", "સીજી રોડ"]),
    "Vatva GIDC": (22.9660, 72.6300, ["vatva gidc", "vatva", "વટવા", "वटवा"]),
    "Thaltej, S.G. Highway": (23.0500, 72.5070, ["thaltej", "s.g. highway", "sg highway", "s g highway", "થલતેજ", "એસજી હાઇવે", "थलतेज"]),
    "Maninagar": (22.9960, 72.6030, ["maninagar", "મણિનગર", "मणिनगर"]),
    "Behrampura": (22.9990, 72.5810, ["behrampura", "bahrampura", "બહેરામપુરા", "बहरामपुरा"]),
    "Sabarmati Riverfront": (23.0300, 72.5770, ["riverfront", "river front", "sabarmati river", "રિવરફ્રન્ટ", "रिवरफ्रंट"]),
    "Sabarmati": (23.0800, 72.5850, ["sabarmati", "સાબરમતી", "साबरमती"]),
    "Naroda GIDC": (23.0750, 72.6620, ["naroda", "નરોડા", "नरोडा"]),
    "Navrangpura": (23.0370, 72.5600, ["navrangpura", "નવરંગપુરા", "नवरंगपुरा"]),
    "Satellite": (23.0300, 72.5170, ["satellite", "સેટેલાઇટ", "सैटेलाइट"]),
    "Bopal": (23.0330, 72.4650, ["bopal", "બોપલ", "बोपल"]),
    "Paldi": (23.0110, 72.5620, ["paldi", "પાલડી", "पालडी"]),
    "Shahibaug": (23.0550, 72.5930, ["shahibaug", "shahibag", "શાહીબાગ", "शाहीबाग"]),
    "Asarwa": (23.0500, 72.6040, ["asarwa", "અસારવા", "असारवा"]),
    "Naranpura": (23.0600, 72.5550, ["naranpura", "નારણપુરા", "नारणपुरा"]),
    "Ellisbridge": (23.0230, 72.5710, ["ellisbridge", "ellis bridge", "એલિસબ્રિજ", "एलिसब्रिज"]),
    "Kalupur Railway Station": (23.0260, 72.6010, ["kalupur", "railway station", "કાલુપુર", "कालूपुर"]),
    "Chandkheda": (23.1100, 72.5850, ["chandkheda", "ચાંદખેડા", "चांदखेड़ा"]),
    "Gota": (23.1000, 72.5400, ["gota", "ગોતા", "गोता"]),
    "Vastrapur": (23.0390, 72.5290, ["vastrapur", "વસ્ત્રાપુર", "वस्त्रापुर"]),
    "Isanpur": (22.9770, 72.6000, ["isanpur", "ઇસનપુર", "इसनपुर"]),
    "Narol": (22.9700, 72.5950, ["narol", "નારોલ", "नारोल"]),
    "Odhav": (23.0280, 72.6630, ["odhav", "ઓઢવ", "ओढव"]),
    "Nikol": (23.0470, 72.6700, ["nikol", "નિકોલ", "निकोल"]),
    "Sarkhej": (22.9860, 72.5020, ["sarkhej", "સરખેજ", "सरखेज"]),
    "Ghatlodia": (23.0700, 72.5400, ["ghatlodia", "ઘાટલોડિયા", "घाटलोडिया"]),
    "Ashram Road": (23.0400, 72.5700, ["ashram road", "આશ્રમ રોડ", "आश्रम रोड"]),
    "Nehru Bridge": (23.0270, 72.5770, ["nehru bridge", "નેહરુ બ્રિજ", "नेहरू ब्रिज"]),
    "Ahmedabad Airport": (23.0770, 72.6300, ["airport", "એરપોર્ટ", "एयरपोर्ट"]),
    "Jamalpur": (23.0150, 72.5850, ["jamalpur", "જમાલપુર", "जमालपुर"]),
    "Khokhra": (23.0000, 72.6150, ["khokhra", "ખોખરા", "खोखरा"]),
    "Vejalpur": (23.0050, 72.5200, ["vejalpur", "વેજલપુર", "वेजलपुर"]),
}

# Longest aliases first so "vatva gidc" wins over "vatva", "sabarmati river" over "sabarmati".
_ALIASES: list[tuple[str, str]] = sorted(
    ((alias.lower(), name) for name, (_, _, aliases) in PLACES.items() for alias in aliases),
    key=lambda x: -len(x[0]),
)


def find_place(text: str | None) -> str | None:
    """Return the canonical place name mentioned in `text`, if any."""
    if not text:
        return None
    t = text.lower()
    for alias, name in _ALIASES:
        if alias in t:
            return name
    return None


def geocode(location_text: str | None) -> tuple[float, float, str] | None:
    """Best-effort geocode of a free-text location to (lat, lng, canonical_name)."""
    name = find_place(location_text)
    if name is None:
        return None
    lat, lng, _ = PLACES[name]
    return lat, lng, name
