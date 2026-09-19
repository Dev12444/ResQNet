# ResQNet — frontend

Next.js 16 (App Router) client for the ResQNet emergency response platform.
Owner: FE2. The API it talks to lives in [`../backend`](../backend).

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

`npm run dev` loads `.env.development`, which sets `NEXT_PUBLIC_USE_MOCK=true`
so local work runs on fixtures and does not depend on the deployed API being
awake. To drive the real backend locally, set that to `false`.

```bash
npm run build && npm run start    # production build, live API
```

## Environment

Two variables. Neither is a secret, and neither is hardcoded in a component —
`src/lib/api.ts` is the only file that reads them.

| Variable | Value | What happens if it is missing |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | the backend's base URL, e.g. `https://resqnet-api-0jmr.onrender.com` | falls back to `http://localhost:8000` |
| `NEXT_PUBLIC_USE_MOCK` | `true` for fixtures, anything else for live | **defaults to live** |

That default is deliberate. It used to be the other way round, which meant a
deployment where nobody set the variable served invented incidents and said
nothing about it. Forgetting it now produces a visible failure instead of a
convincing false one.

### Deploying

Set both variables on the host explicitly — do not rely on the default.

The project name matters: the backend's `CORS_ORIGIN_REGEX` is
`^https://resqnet(-[a-z0-9-]+)?\.vercel\.app$`, so a Vercel project whose name
does not begin with `resqnet` will have every request and WebSocket rejected by
CORS, with nothing in the UI to explain why.

## The honesty model

This is the part of the build worth understanding before changing anything in
`src/lib/api.ts`.

Every read goes through `withFallback`, which returns an `Envelope<T>` carrying
a `mode` alongside the data. Screens render that mode, never a bare value:

| Mode | Meaning |
|---|---|
| `live` | came from the API just now |
| `cached` / `stale` | last good response; the API did not answer this time |
| `simulated` | fixtures — there is no endpoint behind this, and there never was |
| `unavailable` | live mode, the server did not answer, and there is nothing real to show |

`unavailable` is distinct from `simulated` on purpose. Anything operational —
incidents, reports, units, assignments, facilities, alerts, recommendations —
passes a `liveEmpty` callback, so a dead endpoint yields an empty result and an
explanation rather than plausible invented records. A judge or a dispatcher
looking at a screen of realistic incidents cannot tell that the backend is
down, and nobody demonstrating this should be relying on that.

Empty is its own hazard, so consumers guard it. `/field` will not print "No
active assignment" to a responder whose control room merely failed to answer,
and it will not derive a verification verdict from reports that never arrived.

### Panels with no endpoint behind them

`/api/shelters`, `/api/pulse`, `/api/districts/situation`, `/api/logs`,
`/api/ground-truth` and `/api/weather/*` are not in the contract. The panels
that read them are fixtures in every build, live or not, and each carries a
provenance badge where it is read — including the map's corner stamp, which
reports the weakest layer actually drawn rather than a build flag.

## Testing on a phone

`npm run start -- --hostname 0.0.0.0` serves the LAN address printed at boot.
Geolocation, voice input and camera will be **disabled** there: browsers gate
them behind a secure context, and `localhost` is the only exempt insecure
origin. The app says so rather than reporting a denial the user never made.
Use HTTPS or a tunnel if those features need demonstrating.

## Checks

```bash
npx tsc --noEmit
npx eslint src --max-warnings=0
npm run build
```
