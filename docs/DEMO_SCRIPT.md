# ResQNet — Demo Script

> **By BE2 (Dev), for FE2 (Diya, owner of this file).** Button labels match the final dashboard (`/dashboard`) as merged in `main`. Timings come from the real scenario file (`scenario_ahmedabad_flood.json`, 30 events over 174 s), replayed by **RUN SCENARIO** at **2×**, so all 30 reports arrive in about 90 s (`NEXT_PUBLIC_SIM_SPEED`).
>
> Live URLs: API `https://resqnet-api-0jmr.onrender.com` (Render, Singapore) with Neon Postgres. Frontend: Vercel URL *(Diya: fill in)*.
>
> Total slot assumed: **5 min** = 1 min pitch + 3 min live demo + 1 min impact/close. If you get only 3 min, skip the ⏩ steps.

---

## 0. Pre-flight checklist (T–30 min)

- [ ] **Wake Render** (free plan sleeps after 15 min idle; first hit takes ~50 s): open `https://resqnet-api-0jmr.onrender.com/health` and check `{"status":"ok","db":true}`
- [ ] `GET /api/ai/status`: `ai_enabled: true`, `generation_available: true`, `openai_over_budget: false`, `demo_seed_answers: 93` (the scenario's AI answers are baked in, so they're instant even if OpenAI/Gemini are down)
- [ ] Dashboard: press **RESET**, which shows "Demo data reset" (25 units, 18 facilities, 0 incidents); the top bar shows **LIVE** (WebSocket connected), not RECONNECTING
- [ ] Dashboard open on the laptop (full screen, dark theme); `/report` open on a **phone**
- [ ] Telegram open on a second phone, volume **up**, bot chat pinned
- [ ] Backup: phone hotspot ready · recorded demo video on the desktop · local backend (`uvicorn`) as fallback URL
- [ ] Close notifications, Slack and email on the laptop

**Roles on stage:** 🎤 Presenter (pitch + narration) · 🖱️ Driver (laptop) · 📱 Citizen (phone) · 📟 Telegram holder

---

## 1. Pitch opener: 60 s 🎤

> "Every monsoon, Ahmedabad's control rooms are flooded twice: once with water, and once with calls.
> The same underpass gets reported *seven times* in three languages. A gas leak in Vatva waits because
> nobody noticed it wasn't dispatched. Dispatchers decide from memory which ambulance is closest.
>
> **ResQNet** is an AI co-pilot for the emergency control room. It reads every report, whether
> Gujarati, Hindi or English, from citizens, calls, sensors and field crews. It works out what's
> happening and how bad it is, merges duplicates into one incident, and recommends the best units
> and hospital. Then a **human approves**. Let us show you a monsoon evening in Ahmedabad."

---

## 2. Live demo: ~3 min

### Flow A: citizen report → dispatch (golden path) · 0:00–1:00

| # | Action | What the audience sees | Say |
|---|---|---|---|
| A1 | 📱 On `/report`, type in **Gujarati**: `અખબારનગર અંડરપાસમાં ગાડી ફસાઈ છે, પાણી વધી રહ્યું છે` → Submit | Phone: "Report received · INC-0001" + **safety tips in Gujarati** ("move to higher ground…", helplines 112/108) *(needs FE2 to show `GET /api/incidents/{id}/advice?lang=gu` on the success screen; if it isn't there, skip the tips line)* | "A citizen reports in Gujarati: a car is stuck in the Akhbarnagar underpass. Instantly, in Gujarati, they are told what to do until help arrives." |
| A2 | 🖱️ Dashboard | Red **pulsing P1 pin** at Akhbarnagar, **CRITICAL** alert card on the map, INC-0001 at the top of the **INCIDENT QUEUE** · 📟 Telegram buzzes *(only if BE1's bot token is set on Render)* | "In about a second the AI classified it: flood, people trapped, so P1. Priority follows a fixed rule, not a guess." |
| A3 | 🖱️ Click the pin or the queue row → drawer | **AI SITUATION SUMMARY** in English, **Reasoning**, **MODEL CONFIDENCE** bar, P1 / SEV badges | "The dispatcher reads it in English, whatever language it came in, and sees *why* the AI decided." |
| A4 | 🖱️ Scroll to **DISPATCH RECOMMENDATION** | NDRF boat (chip **swift water**), NDRF team (**flood rescue**), ambulance (**trauma · ALS**), all pre-ticked, with ETAs + receiving hospital | "It ranks every available unit by capability, ETA and load. Here it picked the swift-water boat, and a hospital with trauma beds." |
| A5 | 🖱️ **APPROVE DISPATCH (3)** | Button turns **DISPATCH APPROVED**, status badge becomes *dispatched*, **UNITS FREE** drops 25 → 22, **AVG TO DISPATCH** fills in · 📟 responder Telegram *(if configured)* | "One click. The human stays in control, and everything goes into the audit log." |
| A6 ⏩ | 🖱️ **LOG A CALL** → type a 108 call in Romanized Gujarati: `Akhbarnagar underpass ma haju ek gadi fasai, 2 loko andar` → submit | Toast: merged into **INC-0001**, report count goes up | "A 108 operator types what the caller says, however they say it. It's the same underpass, so it merges instead of creating a new incident." |

### Flow B: duplicate storm · 1:00–1:45

| # | Action | What the audience sees | Say |
|---|---|---|---|
| B1 | 🖱️ **RUN SCENARIO** | Button becomes **STOP SCENARIO 3/30 → 30/30**; pins stream in for C.G. Road fire, Vatva, S.G. Highway…; **ACTIVE** counter climbs to ~11 | "Now the whole evening: 30 reports from citizens, 108 calls, sensors and field crews, sped up 2×." |
| B2 | Point at INC-0001 in the queue | **REPORTS (n)** tab count climbs to 7–8, **no new pin** at Akhbarnagar | "Seven more people report the same car: in Hindi, in English, by phone. The AI knows it's the same incident, so nothing is double-dispatched." |
| B3 | 🖱️ Drawer header → **CORROBORATED** chip (hover shows sources); **REPORTS** tab lists them with language + source | Gujarati, Hindi and English reports side by side | "It also tells you how *confirmed* an incident is: independent citizens and 108 calls all agree." |
| B4 ⏩ | 🖱️ Open C.G. Road fire | Field-crew update merged, **Verified**; fire truck with **aerial ladder / rescue** chip | "A field crew confirmed it. People are trapped upstairs, so it picked the truck with the ladder over one slightly closer." |

### Flow C: the slipping incident · 1:45–2:30

| # | Action | What the audience sees | Say |
|---|---|---|---|
| C1 | *(don't dispatch Vatva)* | Vatva GIDC gas leak P1, ammonia sensor 180 ppm (threshold 50) merged into the same incident | "The Vatva gas leak was confirmed by a citizen and by an ammonia sensor, and it's busy, so nobody dispatched it." |
| C2 | Wait ~2:20 after pressing RUN SCENARIO (Vatva arrives ~0:18, P1 dispatch SLA = 120 s, checked every 15 s) | 🔴 **SLA BREACH** alert card · 📟 authority Telegram *(if configured)*. Use **ACKNOWLEDGE** to clear handled cards | "Two minutes for a P1 with no dispatch, so ResQNet raises an alert. Incidents don't slip through." |
| C2b | 🖱️ Open Vatva → **ESCALATE** | Button greys out as **ESCALATED**, status badge *escalated* | "The human decides to escalate. If nobody acts, it escalates itself after a second missed SLA." |
| C3 | 🖱️ `/analytics` → insights | "INC-0004 waiting for dispatch", "nearest hazmat unit is far", "Flood reports rising" | "It also warns you about coverage gaps: the only hazmat unit is far from Vatva. Fix that *before* the next leak." |

### Flow D: supervisor view · 2:30–3:00

| # | Action | What the audience sees | Say |
|---|---|---|---|
| D1 | 🖱️ **SITREP** (top bar) | Modal with a markdown situation report of all active incidents | "For the collector's briefing, the situation report writes itself." |
| D2 | 🖱️ `/analytics` | Hotspot map (riverfront cluster), incidents by type, response times, shortages, **AI accuracy card** | "Hotspots show the riverfront flooding cluster. And here's how accurate the AI is." |

---

## 3. Impact & close: 60 s 🎤

> "We measured it on 50 labelled reports in three languages:
> **100 % incident-type accuracy, 100 % severity within one level, 96.8 % of critical incidents caught,
> and perfect duplicate merging: 27 real incidents, 27 predicted.** About 1.4 seconds and a fraction
> of a rupee per report.
>
> And it never goes down. If OpenAI fails, it switches to Gemini. If the internet fails, keyword rules
> in Gujarati, Hindi and English take over. No report is ever dropped.
>
> ResQNet covers every PS-9 deliverable: collection, classification, deduplication, resource
> recommendation, real-time monitoring, alerts, AI assistance and analytics. **The AI does the
> reading, the human makes the decision.** Thank you."

---

## 4. Backup plans

| Failure | Do this | Say |
|---|---|---|
| Venue Wi-Fi dies | Switch laptop + phones to hotspot | *(nothing)* |
| OpenAI/Gemini down or slow | Keep going: scenario texts are cached, and new texts fall back to rules | "This is the offline fallback running: same pipeline, keyword rules." |
| Render/Neon down | Point frontend at local `uvicorn` (SQLite), then `python -m scripts.seed` | — |
| Scenario/simulator breaks | **RESET**, then submit 2–3 reports manually from the phone or with **LOG A CALL** | — |
| Dashboard says RECONNECTING | Render is waking up (~50 s). Keep talking; it reconnects by itself and data refreshes every 15 s anyway | "The backend is on a free tier; it's waking up." |
| Everything breaks | Play the recorded video; narrate over it | "Here's the recording from our last run." |
| Telegram doesn't buzz | Show the alert banner in the dashboard | — |

## 5. Likely judge questions

| Question | Answer |
|---|---|
| *What if the AI is wrong?* | It only recommends. Priority comes from a fixed rule, a human approves every dispatch, and each output shows reasoning, confidence and the model that answered. Conflicting reports are flagged on the Trust panel. |
| *How do you detect duplicates across languages?* | Same type + within 300 m (1 km for floods) + 30 min, plus multilingual embedding similarity. Precision and recall were 1.0 on our eval. |
| *Can it handle load?* | BE1's load test replays the scenario at 2× while dispatchers race for the same units, crews double-tap and duplicates arrive in parallel: ~1,400 requests, **0 server errors**, no double-booked unit, reports p95 **under 0.1 s** once PR #24 lands (the AI runs outside the database lock; 5.1 s before). |
| *Cost at city scale?* | About $0.0005 per report on gpt-4.1-mini. Repeat texts are cached. There's a hard budget cap, and it falls back to free rules. |
| *Offline / internet outage?* | Keyword rules in 3 languages, place-name gazetteer, geo+time dedup. It degrades, it doesn't stop. |
| *Reports without GPS?* | Gazetteer of ~35 Ahmedabad areas (EN/GU/HI names). If it's unknown, the report goes to the city centre with a "location unverified" badge. |
| *Isn't your eval set biased?* | We also built a separate **stress set** of messy real-world input (Romanized Gujarati like "pani bharayu che", typos, pranks, past incidents, no GPS). The AI scores 100 % type and 94 % critical-incident recall there, and even the offline keyword rules score 100 % type. *(Add teammates' held-out numbers here when they land.)* |
| *Privacy / security?* | Keys server-side only, no citizen data sent anywhere except the AI provider, SSRF-guarded photo fetch, full audit log. |
| *Why not just a form with categories?* | People in an emergency write "ગાડી ફસાઈ છે", not a category. The AI turns messy text into structured, prioritised, de-duplicated incidents. |
