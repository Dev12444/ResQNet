# ResQNet — Demo Script

**PS-9 · Bit N Build'26 Gujarat Round**
Owner: FE2 (Diya) · Driver: FE1 · Narrator: FE2 · BE1 on alerts · BE2 on AI questions

> **The one line to land:**
> **ResQNet doesn't just show disasters. It connects REPORTING → VERIFICATION → RESPONSE → RECOVERY.**

Everything below runs on deterministic demo data pinned to a fixed clock, so the
screen looks identical on every run. Where the platform has no live integration,
the interface says so on screen — that is deliberate, and it is worth pointing
out to judges rather than hiding.

---

## 0. Before you start (2 min)

| Check | Why |
|---|---|
| `npm run dev` in `frontend/`, open `http://localhost:3000` | The whole demo is one tab |
| Browser at ~1440×900, zoom 100% | The command layout is desktop-first |
| Second tab open at `/report/new` on a phone-sized window | The citizen half of the story |
| Backup video open in a third tab | If the network dies mid-demo |
| Say the numbers out loud once | You will be asked "is this real data?" — answer before they ask |

**If asked at any point "is this live?":** *"No — this is a pinned demo dataset.
Every panel that isn't wired to a live feed says DEMO DATA or SIMULATED on screen.
We'd rather show you the honesty than fake a feed."*

---

## 1. The front door — 30 sec

**Land on `/` and do not touch anything for five seconds.** Let them read it.

> *"This is ResQNet — a state emergency response platform. One screen for the
> whole state."*

> **Naming.** Nothing in the interface names a state. The districts, the
> coordinates and the map extent are Gujarat's, and the demo is a Gujarat
> demo — but the product is written so it reads as a platform any state
> control room could stand up, not a portal built for one.

Point, in this order:

1. **The emergency comms ticker.** 112 Emergency, 100 Police, 101 Fire, 108
   Ambulance, 1098 Child, 181 Women, 1077 Disaster, circulating like a radio
   frequency. Government blue, not crimson — these numbers are always true, and
   crimson on this platform means something is happening right now.
   > *"Seven numbers, always on screen, on every page, moving like an
   > operational frequency. On a phone these dial."*

   **Hover one and stop talking for a beat.** The ticker pauses, the number
   grows, and a CALL action appears.

   > *"It stops when you reach for it. You never chase a number across the
   > screen in an emergency, and we never hide one behind a menu."*
2. **The critical warning banner**, under the ticker.
   > *"A cyclone warning for Kutch. It is full width and above everything,
   > because a critical warning belongs to the whole system rather than to one
   > panel on one page. It raises only for CRITICAL — a banner that appears for
   > a moderate advisory teaches people to scroll past the one that matters."*

   **Point at the grey line under it and read it out.**

   > *"'ResQNet displays official warnings — it does not broadcast to phones.'
   > There is a NOTIFY THIS DEVICE button and it does exactly what it says: a
   > browser notification, on this device. We will not claim reach we do not
   > have."*

   **Press FIND SHELTER.** The shelter list opens already filtered to Kutch.

   > *"Every action on that banner goes somewhere real."*

   **Come back to `/`.**
3. **Report an Emergency** — the single red action.
4. **I'm Safe** — the other thing a citizen needs.
5. **State Control Room · Online** in the header.

> *"Two audiences, one platform: citizens on the left of that red button,
> the control room on the right."*

---

## 2. The state picture — 45 sec

> *"The map is the product. Seventeen districts, coloured by risk posture:
> normal, watch, moderate, high, critical."*

- Point at **Kutch** — the largest, darkest disc, with a slow halo.
- Toggle **Satellite**, then back to **Map**. *"Map, satellite and hybrid."*
- Open **Layers** and tick **Response Teams**. *"Ten layers — cyclone, flood,
  fire, rainfall, warnings, shelters, hospitals, teams, blocked roads, citizen
  reports."*
- Zoom in once. *"Below state zoom we cluster, so the coastline stays readable."*
- Point at the faint dashed lattice and the **A1 / C3 / E4** references.
  > *"A grid, so a control room can say 'units to C3' out loud. It is real
  > geography — it pans with the ground, not with the screen."*
- Trace the amber dashed line running in from the Arabian Sea to Kutch.
  > *"The cyclone's projected track. Dashed and amber, never solid, because it
  > is a forecast and not an observed position."*
- Point at marker shape, not colour.
  > *"Squares are fixed facilities, diamonds are mobile units, circles are
  > events. Shape carries the meaning, so the map still works for a
  > colour-blind operator and in a photograph of a screen."*

**Say the honest bit:**
> *"Those discs sit on district centroids and show risk. They're not surveyed
> administrative boundaries — the legend says exactly that."*

---

## 3. ResQ Pulse — 30 sec

**Go to `/live-map`** and point at the **ResQ Pulse** panel on the right —
the segmented gauge, not the words.

*(Pulse lives with the map rather than on Home: Home stays deliberately
sparse — comms, search, the two emergency actions, the map, alerts and the
citizen cards. Everything else is one click away on the rail.)*

> *"ResQ Pulse is our signature read: district-level live intelligence in one
> instrument. Kutch — critical, level five of five. 38 reports, 6 blocked
> roads, 5 shelters active, 8 response teams, priority area Jakhau Coast."*

> *"It is a meter rather than a coloured badge on purpose. The level is printed
> beside it, so the reading survives colour-blindness, a projector and a
> photograph — and only the top segment animates, and only at critical, so
> movement on that gauge means exactly one thing."*

Click through one dot to **Surat**.

> *"Surat — high. 23 reports, 4 blocked roads, priority area Adajan.
> Every one of those numbers is a count of something in the data, not a score
> we invented."*

---

## 4. Drill into the high-risk district — 30 sec

**Click the Kutch disc.**

The situation panel opens:

```
KUTCH / SECTOR A2                          ● LIVE
23.73°N / 69.86°E              CRITICAL RISK
Cyclone landfall expected within 12 hours. Heavy winds and coastal surge.
Active Incidents   14
Shelters Open       5
Response Teams      8
People Affected 4,200
Shelters: Bhuj 184/250 · Jakhau 96/150 · Mandvi 148/160
Updated 14:44:00 IST
```

> *"One click, and a district commander has the whole posture — incidents,
> shelters with live occupancy, teams, people affected, and when it was last
> updated."*

---

## 5. A citizen reports — 60 sec  ← **the heart of the demo**

**Switch to the phone-sized tab at `/report/new`.**

1. Tap **ગુજરાતી**. *"Gujarati, Hindi, English."*
2. Type (or paste) the Akhbarnagar report:
   > `અખબારનગર અંડરપાસમાં ગાડી ફસાઈ છે, પાણી ઝડપથી વધી રહ્યું છે. અંદર ત્રણ લોકો છે.`
3. Tap **પૂર / પાણી** (Flood), then **Life at risk now**.
4. Tap **Use My Location** — *let it fail if it does.*
   > *"If GPS is denied, the form does not stop. You type a landmark instead.
   > Same for the photo, same for voice. Nothing optional can block a report."*
5. Tick **Elderly** under special assistance.
6. Tap **Report an Emergency**.

**On the receipt, slow down.** This is the slide that wins the round.

> *"Two blocks, deliberately separate. The top one is her report, in her words,
> in her script — we never translate it away or overwrite it. The bottom one is
> the system's operational reading: type, severity, location, hazards."*

Then point at the two labels:

> *"Verification says **UNVERIFIED** — hers is the only account so far.
> Confidence says **64% · REVIEW ADVISED** — and it's labelled AI confidence,
> not proof. Below that: 'An operator reviews every report before any unit is
> sent.' The system classifies. People decide."*

And the progress rail:

```
✓ Received  ✓ AI Triage  ✓ Evidence Check  ✓ New incident INC-0013 opened  ⑤ Operational Review
```

---

## 6. Verification — the ResQ Chain — 45 sec

**Back to the desktop tab → `/incidents`.**

> *"Every citizen report climbs a trust ladder, and we show where it is."*

Point at the three counters: **UNVERIFIED / COMMUNITY CONFIRMED / AUTHORITY VERIFIED.**

Click **GT-0001** (the Akhbarnagar flood). The **ResQ Chain** opens on the right:

```
Report ✓   Verify ✓   Respond ✓   Resolve ✓
14:09  Unverified            Citizen app — first report received
14:11  Community Confirmed   4 nearby reports — same location described
14:14  Authority Verified    VASNA-WL-01 + 112 Control Room
14:13  Assigned              NDRF-BOAT-02 assigned
14:14  Response En Route     NDRF-BOAT-02
14:40  Resolved              Three occupants recovered
```

> *"Report, verify, respond, resolve — with who said what, and when. Seven
> reports from five **independent** sources. Two were the same person texting
> twice, and we do not count those as confirmation. That distinction is the
> difference between a real signal and an echo."*

---

## 7. Dispatch and the field — 30 sec

**Go to `/field`, pick `NDRF-TEAM-01`.**

> *"This is the responder's phone. Assignment, hazards, advisory actions,
> and four big buttons: acknowledge, en route, on scene, complete."*

Point at the severity block:

```
REPORTED            FIELD-VERIFIED
SEV 3 · Serious     SEV 4 · Severe
Latest change by: RESPONDER
```

> *"The citizen said a wall had fallen. The NDRF team arrived and found two
> people trapped, and raised it on scene. Ground truth beats the model, and the
> platform records who changed it."*

Tap **Update Situation** and show the form — severity, people affected, hazards,
corrected GPS, road access, extra resources.

> *"And the ETA says 'straight-line estimate — not a routed ETA', because we
> have no routing engine. We won't print a number that implies we checked the
> roads."*

---

## 8. Shelters and SafeRoute — 30 sec

**Go to `/shelters`.**

- Filter by **Kutch**, then tick **Medical**.
- Point at **Mandvi Town Hall — 148/160, NEAR CAPACITY**.
- Point at **Behrampura Relief Centre — 200/200, FULL**.

> *"Occupancy with its own age. If a count goes stale the bar greys out and the
> page tells you to confirm by phone before sending people there. A bed count is
> a hint, not a reservation."*

Click **SafeRoute** on Surat Community Hall.

> *"A suggested way there, routing around the waterlogging at Adajan and the
> tree down at Udhna — both of which are citizen reports already in the system.
> And it is labelled an illustrative route, because no live routing engine is
> connected."*

---

## 8b. I'm Safe and Close Ones — 45 sec

**Back on `/`, in the right rail, open CLOSE ONES NOTIFICATION.**

> *"Before the emergency, not during it: a citizen lists the people who should
> hear from them first. Name, relationship, number, and how that person wants
> to be reached — an elderly parent gets a voice call, not a WhatsApp message
> they will never open."*

Add one — **Meera Patel, Parent, a mobile number, Voice call** — then press
**ADD CONTACT**.

> *"The switch above it now has something to act on. A toggle with nothing
> behind it is a dead control."*

**Press I'M SAFE.**

> *"The dialog names the people it would reach — it doesn't offer to notify a
> list that might be empty. Name, district, an optional message."*

**Mark yourself safe, and read the confirmation out loud.**

> *"And this is the sentence that matters: it says the check-in is recorded and
> exactly who it did and did not reach. Contacts are stored on this device,
> this build has no SMS gateway, and the card says so. Telling someone their
> family has been notified when nothing was sent is the single most damaging
> thing a platform like this can do."*

---

## 9. The command view — 30 sec

**Back to `/` and point at the bottom strip.**

- **Live Dispatch & Logs** — the scrolling event stream.
  > *"Cyclone warning updated. Unit GJ-KUT-08 dispatched. Shelter capacity
  > updated. Citizen report verified. Filterable by incident, district, unit or
  > severity."*
- **Regional Radar & Forecast** — with its **DEMO DATA** tag.
  > *"Labelled, because there's no live IMD feed behind it."*
- **Weather Trend Graph** — rainfall and wind across the week.
  > *"Both lines are named underneath. A chart whose series are told apart by
  > colour alone is unreadable to part of any audience."*

---

## 10. Analytics — learning from it — 45 sec

**Go to `/analytics`.**

Seven KPIs across the top. Then:

> *"Watch what happens when I filter."*

**Click the Kutch district chip.** Everything recomputes — KPIs, every chart,
and the observations.

Read one observation aloud:

> *"'Rescue Team shortage — no units available anywhere in view. Required 5,
> Available 0, Shortage 5.' That's not a generated sentence, it's a computed one,
> and it prints the numbers it came from so you can check it."*

Point at **District risk** and **ResQ Pulse distribution**.

**The chart-craft line, if you have a design-minded judge:**
> *"Severity and risk are never encoded by colour alone — they sit on an axis
> with their label printed, because the contract's severity palette fails
> colour-blind separation and we couldn't change it unilaterally."*

Point at the note under Response time:
> *"Report-to-triage isn't shown, because the incident contract has no triage
> timestamp. We'd rather show the gap than estimate it."*

---

## 10b. ResQNet Flash Alert — 60 sec  ← **the second thing that wins the round**

**Go to `/dashboard` — the ResQNet Command Center.** Select **INC-0007**.

> *"This is the operator console. Queue on the left, the GIS map in the middle,
> the incident's full intelligence on the right — AI summary, reasoning,
> confidence, recommended actions, dispatch recommendations, timeline."*

**Press SEND FLASH ALERT.**

> *"Watch what the AI is allowed to do. It has drafted a warning — scenario,
> severity, target area, the wording in three languages — and told me why:
> seven corroborating reports, four people affected, flash flood hazard class,
> ninety-two percent confidence."*

Point at the line under the recommendation and read it out:

> ***"The model cannot issue a warning. You are the issuing authority."***

> *"That is the whole design. There is no code path from the model to a send.
> `send()` is called from one button, and a person has to press it."*

**Press PREVIEW ALERT.** Flick through English, ગુજરાતી, हिन्दी.

> *"Nobody approves wording they haven't read, so preview is a required step,
> and the text is pre-authored per language — we never machine-translate a
> warning at send time."*

**Press SEND FLASH ALERT.**

The citizen handset takes over the screen.

> *"Severity band, the hazard in the largest type on the platform, affected
> area, estimated reach, and the four things that matter in the next ten
> minutes: safe route, nearest shelter, I'm Safe, 112. Every one of those is
> wired to a real surface — I'm Safe writes a genuine check-in and tells you if
> it only saved locally."*

**Say the honest bit, and say it before they ask:**

> *"It says SIMULATION at the top and the foot says why: ResQNet's frontend
> cannot emit a cell broadcast. In a live deployment the approved warning goes
> to NDMA's Common Alerting Protocol gateway, which does the broadcast. We are
> demonstrating the chain of authority, not faking a government alert."*

**Switch to the FLASH ALERTS tab on the left.**

> *"And it is auditable: time, incident, district, severity, target area,
> languages, status, and the operator who approved it. A warning you can't
> audit afterwards isn't a governable capability."*

**Dismiss the handset and go back to `/`.** The warning is still there, as the
crimson Alert Flash band under the ticker.

> *"The takeover was for the operator who approved it. This band is the
> citizen-facing half — it is on every route until someone dismisses it."*

---

## 10c. Alert Flash from a citizen report — 30 sec

This is the other half of the same mechanism, and it is worth showing because
it is the one judges try to break.

**Open `/report/new` in a second tab. Submit a short report** — "Fire in a
garment godown near Bhuj bus stand, people trapped on the first floor."

**Switch back to the first tab without reloading it.** The band is already
there, in amber.

> *"One citizen reported that, and every ResQNet page on this device picked it
> up without a refresh. Note what it does not do: it is amber, not red, and it
> does not pulse. The chip says CITIZEN REPORT · UNVERIFIED and the foot says
> it is awaiting verification by the State Control Room."*

> *"A government warning and one person's account are not the same claim, so
> they do not get the same colour. When the control room confirms it and issues
> a Flash Alert, that is when it turns red and starts pulsing."*

**Read the last line of the band out loud:**

> ***"This banner is showing on this device only — ResQNet does not broadcast
> to phones. For an emergency, call 112."***

> *"That reach is `localStorage` and a storage event: this app, every tab, this
> browser. In deployment it is a subscription to the incident stream. We say
> exactly which of those we have."*

---

## 11. Recovery — the after-action report — 30 sec

**Go to `/report`.**

> *"Six report families: situation, incident, district, response performance,
> resource, after-action."*

Open **AAR-2026-0912 — Ahmedabad Urban Flooding**.

> *"A real government document — masthead, reference number, period, numbered
> sections, tables, signature block."*

Scroll to *What to change*:

> *"'Repeat reports from a single reporter initially read as independent
> confirmation. The unique-source count has since been made explicit in the
> interface.' That's the recovery loop closing — an operational lesson that
> changed the product."*

Click **Print / Save as PDF**.

> *"Prints clean. And Export CSV for the numbers."*

---

## 11b. If a judge asks about the design — 30 sec

Only if they ask, or if you have time in hand.

> *"The visual language is an Indian government geo-portal crossed with an
> emergency operations centre. Deep navy for structure — header, navigation,
> the rail, and the helpline ticker. Crimson only where something is
> operationally urgent: P1, the alert banner, the emergency actions. Green for
> safe and available, amber for
> warnings, blue for water. There is no decorative colour anywhere on the
> platform."*

On the logo, if asked:

> *"The radar sweep is the signal, the red node at its centre is the
> emergency, and the arcs are the reach. It is the approved ResQNet lockup,
> used as supplied — not redrawn, not recoloured, and never stretched: every
> placement contains it and lets it keep its own proportions. In the rail head
> and the app icon, where there are only twenty-odd pixels, the symbol stands
> on its own, which is how a stacked lockup reduces."*

On the type, if asked:

> *"Two faces. Archivo Narrow carries every heading, nav item and panel title,
> because a narrow face is what makes an operations screen legible at this
> density — LIVE DISPATCH & LOGS fits a 120-pixel panel head at eleven pixels
> without tracking games. Archivo rather than one of the grotesque condensed
> faces because it keeps stroke contrast and open counters at that width, so a
> title reads as signage instead of as one more row of table chrome. Source
> Sans 3 carries running text; it was drawn for interface text at small sizes,
> and this platform lives at eleven and twelve pixels. IBM Plex Mono carries
> anything an operator would read out loud: IDs, timestamps, coordinates, ETAs.
> Noto Sans Gujarati covers Gujarati and Hindi, so a warning never falls back
> to whatever font the device happens to have. No Inter, no Poppins — this is a
> government instrument, not a product landing page."*

> *"Everything is a compact card — one-pixel border, six-pixel radius, a tinted
> head with an uppercase title. Dense on purpose: this is built for 1366 by 768
> on a control-room screen, not for a marketing page."*

On the logo, if asked:

> *"Archivo Narrow for the command register and Source Sans for running text,
> with Noto Sans Gujarati carrying both Indic scripts. We took the layout from
> the reference portal, never the identity."*

On the Statue of Unity in the rail:

> *"Drawn, not photographed — an architectural elevation, one hairline
> throughout, nothing filled and nothing shaded. The ink is a desaturated
> blue-grey one step off the rail's own navy, and two fade masks dissolve the
> edges and the base, which is what makes it sit inside the sidebar instead of
> on top of it. There is no image file and no box anywhere."*

> *"And it is a scene, not a logo: Sardar Patel in the long coat with the khes
> across it, the viewing-gallery base under him, the approach ramp, and the
> temple group on the bank. Proportion carries the likeness at this size, not
> detail — narrow shoulders, the coat flaring wide at mid-body, then narrow
> again at the legs. Get that sequence wrong and it reads as an obelisk no
> matter how much detail goes on top."*

---

## 12. Close — 20 sec

Return to `/`.

> *"Reporting. Verification. Response. Warning. Recovery.
> A citizen reports in Gujarati. Independent sources corroborate it. A sensor
> confirms it. An operator dispatches. A responder corrects what the report got
> wrong. Analytics finds the shortage. The after-action report changes how we
> work next time.*
>
> ***ResQNet doesn't just show disasters. It connects reporting, verification,
> response and recovery.*** *And every number on screen tells you how much to
> trust it."*

---

## Backup plan

| If this breaks | Do this |
|---|---|
| Map tiles don't load | The map shows a written fallback; carry on with the right-hand panels and `/incidents` — the numbers are identical |
| Network dies entirely | Switch to the backup video tab. Also: turn wifi off on the phone and demo the **offline queue** — it says "not yet sent" and offers 112. That failure *is* a feature |
| Dev server dies | `npm run dev` in `frontend/`, back in ~2 s |
| Judge asks for live backend | `NEXT_PUBLIC_USE_MOCK=false` and point at the running API — the badge flips from SIMULATED to LIVE |

## Questions you will get

**"Is any of this AI?"** — Classification, deduplication, summarisation and
photo severity, all from BE2's pipeline, with a rule-based fallback when the
model is unavailable. It is labelled advisory everywhere it appears, and it
never dispatches anything.

**"How do you stop false reports?"** — We don't block them, we rank them.
Unverified stays unverified until independent sources agree, and repeat messages
from one reporter never count as corroboration. Conflicting accounts are shown
side by side rather than silently resolved.

**"What's not finished?"** — Live weather, routing, and the shelter/volunteer/
missing-person endpoints are client-side adapters over the demo dataset. Every
one of them is labelled on screen. Nothing is presented as live that isn't.
