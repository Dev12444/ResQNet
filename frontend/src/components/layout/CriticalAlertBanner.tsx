"use client";

/**
 * Alert Flash — the citizen-facing emergency banner.
 *
 * Full width, directly under the emergency ticker, on every route. Three
 * things can raise it:
 *
 *   1. an official CRITICAL warning already in the alert feed (IMD, GSDMA);
 *   2. a citizen emergency report submitted through `/report/new`;
 *   3. a warning the control room issues from the Flash Alert composer.
 *
 * (2) and (3) arrive through `lib/liveAlerts`, so a report raised in one tab
 * reaches every other tab of this browser without a reload. Newest wins, and a
 * report or an issued warning outranks a standing feed alert — the point of
 * the banner is that something has just happened.
 *
 * It raises only for CRITICAL and HIGH. A banner that appears for a moderate
 * advisory teaches people to scroll past the one that matters.
 *
 * Four honesty rules are built into it:
 *
 *   1. The banner never claims reach it does not have. It appears on this
 *      device, in this browser. Browser notifications go to the same place and
 *      the opt-in says exactly that. ResQNet's frontend cannot emit a cell
 *      broadcast and does not pretend to.
 *   2. A citizen report is labelled UNVERIFIED and attributed to the reporter,
 *      never to an authority, until the control room has confirmed it.
 *   3. Dismissal is per alert and per tab. A new alert raises a new banner;
 *      dismissing one does not silence the next.
 *   4. Every action goes somewhere real — the alert feed, the incident queue,
 *      and the shelter list already filtered to the affected district.
 */

import Link from "next/link";
import type { Route } from "next";
import { useCallback, useEffect, useState } from "react";
import { BellRing, ChevronRight, House, TriangleAlert, X } from "lucide-react";
import type { DataMode, WeatherAlert } from "@/types";
import { pageStrings } from "@/lib/pageStrings";
import { useLang } from "@/components/layout/LangProvider";
import {
  readIncoming,
  subscribeIncoming,
  type IncomingAlert,
} from "@/lib/liveAlerts";

const DISMISSED_KEY = "resqnet.criticalDismissed";

type NotifyState = "unsupported" | "default" | "granted" | "denied";

/** What the banner actually renders, whatever raised it. */
interface Flash {
  id: string;
  /** The chip before the headline. Carries provenance, not decoration. */
  tag: string;
  headline: string;
  detail: string;
  district: string | null;
  source: string;
  href: Route;
  /** Crimson for a confirmed emergency, amber for an unverified report. */
  tone: "critical" | "unverified";
}

type BannerStrings = ReturnType<typeof pageStrings>["banner"];

function fromIncoming(a: IncomingAlert, t: BannerStrings): Flash | null {
  if (a.severity === "moderate") return null;
  return {
    id: a.id,
    tag: a.kind === "citizen" ? t.citizenReport : t.warningIssued,
    headline: a.headline,
    detail: a.detail,
    district: a.district,
    source: a.source,
    href: a.href as Route,
    tone: a.kind === "citizen" ? "unverified" : "critical",
  };
}

function fromFeed(
  a: WeatherAlert,
  demo: boolean,
  t: BannerStrings,
  hazard: string,
): Flash {
  return {
    id: a.id,
    // A fabricated cyclone warning that says "Official warning" and credits IMD
    // is the single most misleading thing this app could put on screen, so the
    // provenance of the feed is carried into the chip rather than assumed.
    tag: demo ? t.demoWarning : t.officialWarning,
    headline: t.warningFor(hazard, a.district),
    detail: a.detail,
    district: a.district,
    source: a.source,
    href: "/weather" as Route,
    tone: "critical",
  };
}

export function CriticalAlertBanner({
  alerts,
  mode,
}: {
  alerts: WeatherAlert[];
  /** Provenance of `alerts`. Anything but "live" is not an official warning. */
  mode: DataMode;
}) {
  const { lang } = useLang();
  const t = pageStrings(lang).banner;
  const { stateWide } = t;
  const hazardLabel = pageStrings(lang).disaster;
  const demoFeed = mode !== "live";
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [incoming, setIncoming] = useState<IncomingAlert[]>([]);
  const [notify, setNotify] = useState<NotifyState>("default");
  const [sent, setSent] = useState(false);

  // Read after mount: storage and Notification.permission are both device
  // state, and reading them during render would desync SSR.
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const raw = window.sessionStorage.getItem(DISMISSED_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) setDismissed(parsed.filter((v) => typeof v === "string"));
      } catch {
        /* storage blocked — the banner simply reappears on reload */
      }
      if (typeof window === "undefined" || !("Notification" in window)) {
        setNotify("unsupported");
      } else {
        setNotify(Notification.permission as NotifyState);
      }
      setIncoming(readIncoming());
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // A report submitted anywhere in the app — or in another tab — lands here.
  useEffect(() => subscribeIncoming(() => setIncoming(readIncoming())), []);

  const queue: Flash[] = [
    ...incoming
      .map((a) => fromIncoming(a, t))
      .filter((f): f is Flash => f !== null),
    ...alerts
      .filter((a) => a.severity === "critical")
      .map((a) => fromFeed(a, demoFeed, t, hazardLabel[a.disaster])),
  ];
  const flash = queue.find((f) => !dismissed.includes(f.id));

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = [...prev, id];
      try {
        window.sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
    setSent(false);
  }, []);

  const requestNotify = async () => {
    if (!flash || !("Notification" in window)) return;
    let permission = Notification.permission;
    if (permission === "default") permission = await Notification.requestPermission();
    setNotify(permission as NotifyState);
    if (permission !== "granted") return;
    // One notification, for this browser, for this alert. Nothing is queued
    // and nothing is sent anywhere else.
    new Notification(`ResQNet — ${flash.headline}`, {
      body: `${flash.district ?? stateWide}. ${flash.detail}`,
      tag: flash.id,
    });
    setSent(true);
  };

  if (!flash) return null;

  const unverified = flash.tone === "unverified";

  return (
    <aside
      role="alert"
      aria-live="assertive"
      /* `flash-bar` is the siren pulse, and it is deliberately not applied to
         an unverified report: the pulse is the platform asserting that this is
         confirmed and happening now, which is exactly what a single citizen
         account has not yet earned. Amber and still, until the control room
         says otherwise. */
      className={`border-y text-white ${
        unverified
          ? "border-[var(--amber-700)] bg-[var(--amber-600)]"
          : "flash-bar border-[var(--crimson-800)] bg-[var(--crimson-700)]"
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 sm:px-4">
        <TriangleAlert
          className={`size-6 shrink-0 ${unverified ? "" : "pulse-critical"}`}
          aria-hidden
        />

        {/* On a phone the headline takes the rest of its own row and the
           action buttons wrap underneath. Without the basis the text column
           shrinks to its minimum beside the buttons and sets one word per
           line, which is unreadable on exactly the alert that matters. */}
        <div className="min-w-0 flex-1 basis-[calc(100%-3.5rem)] md:basis-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="cmd rounded-[3px] bg-white/20 px-1.5 py-[1px] text-[9.5px] tracking-wider">
              {flash.tag}
            </span>
            <span className="cmd text-[14px] leading-tight sm:text-[15px]">
              {flash.headline}
            </span>
          </p>
          <p className="mt-0.5 text-[12px] leading-snug text-white/90">
            {flash.detail}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href={flash.href}
            className="cmd flex h-8 items-center gap-1 rounded-[4px] border border-white/60 px-2.5 text-[11px] text-white no-underline hover:bg-white/15"
          >
            {t.viewDetails}
            <ChevronRight className="size-3.5" aria-hidden />
          </Link>

          <Link
            href={
              (flash.district
                ? `/shelters?district=${encodeURIComponent(flash.district)}`
                : "/shelters") as Route
            }
            className={`cmd flex h-8 items-center gap-1.5 rounded-[4px] bg-white px-2.5 text-[11px] no-underline hover:bg-white/90 ${
              unverified ? "text-[var(--amber-700)]" : "text-[var(--crimson-800)]"
            }`}
          >
            <House className="size-3.5" aria-hidden />
            {t.findShelter}
          </Link>

          {/* Browser notifications, described accurately. */}
          {notify !== "unsupported" && notify !== "denied" && !sent && (
            <button
              type="button"
              onClick={requestNotify}
              title={t.notifyTitle}
              className="cmd flex h-8 items-center gap-1.5 rounded-[4px] border border-white/40 px-2.5 text-[11px] text-white hover:bg-white/15"
            >
              <BellRing className="size-3.5" aria-hidden />
              {t.notifyDevice}
            </button>
          )}
          {sent && (
            <span className="cmd flex h-8 items-center px-1.5 text-[11px] text-white/80">
              {t.notified}
            </span>
          )}

          <button
            type="button"
            onClick={() => dismiss(flash.id)}
            aria-label={t.dismissWarning}
            className="flex size-8 items-center justify-center rounded-[4px] text-white/80 hover:bg-white/15 hover:text-white"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      <p className="border-t border-white/20 px-3 py-1 text-[10px] leading-snug text-white/75 sm:px-4">
        {unverified
          ? t.unverifiedNote(flash.source)
          : demoFeed
            ? t.demoNote(flash.source)
            : t.officialNote(flash.source)}
      </p>
    </aside>
  );
}
