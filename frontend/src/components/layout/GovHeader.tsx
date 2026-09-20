"use client";

/**
 * Institutional header.
 *
 * Two registers on one band, as on a government geo-portal: the emblem and
 * wordmark on the left, the platform's full name and subtitle beside them,
 * and the operator's controls on the right. A second, thinner line carries the
 * utility links.
 *
 * It deliberately carries no KPIs. The operational counters FE1 shipped
 * (ACTIVE / P1 OPEN / UNITS / AVG RESPONSE) live on the console's own header
 * at `/dashboard`, where they belong to a workflow — putting them here would
 * push the map down on every page and turn the portal into a dashboard.
 */

import { pageStrings } from "@/lib/pageStrings";
import Link from "next/link";
import { Bell, ChevronDown, Globe, Menu, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Lang, WeatherAlert } from "@/types";
import { LANGS, PLATFORM_STRINGS, RISK_META } from "@/lib/constants";
import { ResQLogo } from "@/components/brand/ResQLogo";
import { type ConnectivityInfo } from "./StatusIndicator";

export function GovHeader({
  lang,
  onLangChange,
  connectivity,
  alerts,
  onMenu,
}: {
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  connectivity: ConnectivityInfo;
  alerts: WeatherAlert[];
  onMenu: () => void;
}) {
  const t = PLATFORM_STRINGS[lang];
  const m = pageStrings(lang).misc;
  const [langOpen, setLangOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setLangOpen(false);
        setBellOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const unread = alerts.filter(
    (a) => a.severity === "critical" || a.severity === "high",
  ).length;
  const online = connectivity.state !== "offline";

  return (
    <header className="border-b border-[var(--border)] bg-[linear-gradient(180deg,#f7fafd_0%,#eaf0f7_100%)]">
      <div className="flex items-stretch gap-3 px-3 py-2 sm:px-4">
        <button
          type="button"
          onClick={onMenu}
          aria-label={m.openNavigation}
          className="-ml-1 self-center rounded p-1.5 text-[var(--navy-700)] hover:bg-white/70 lg:hidden"
        >
          <Menu className="size-5" />
        </button>

        {/* Emblem + wordmark */}
        <Link href="/" className="flex shrink-0 items-center gap-2.5 no-underline">
          <StateEmblem />
          <span
            aria-hidden
            className="hidden h-9 w-px bg-[var(--border-strong)] sm:block"
          />
          {/* The supplied lockup, contained rather than cropped, so the
              symbol, the wordmark and the subtitle all stay in proportion.
              Shorter on a phone, where the header band itself is shorter. */}
          <ResQLogo priority className="h-10 shrink-0 sm:h-14" />
        </Link>

        {/* Platform name */}
        <div className="hidden min-w-0 flex-1 flex-col justify-center border-l border-[var(--border-strong)] pl-3 md:flex">
          <h1 className="truncate text-[19px] font-bold leading-tight text-[var(--navy-800)] lg:text-[21px]">
            {t.platformName}
          </h1>
          <p className="truncate text-[12px] leading-tight text-[var(--muted)]">
            {t.platformSubtitle}
          </p>
        </div>

        {/* Operator controls */}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {/* Language */}
          <div ref={langRef} className="relative">
            <button
              type="button"
              onClick={() => setLangOpen((o) => !o)}
              aria-expanded={langOpen}
              aria-haspopup="menu"
              className="flex h-8 items-center gap-1.5 rounded-[var(--radius)] border border-[var(--border-strong)] bg-white px-2.5 text-[12px] font-600 text-[var(--foreground)] hover:bg-[var(--surface-2)]"
            >
              <Globe className="size-3.5 text-[var(--navy-600)]" aria-hidden />
              <span className="hidden font-semibold sm:inline">
                {LANGS.find((l) => l.code === lang)?.label}
              </span>
              <ChevronDown className="size-3 text-[var(--muted)]" aria-hidden />
            </button>
            {langOpen && (
              <ul
                role="menu"
                className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-[var(--radius)] border border-[var(--border-strong)] bg-white shadow-[var(--shadow-pop)]"
              >
                {LANGS.map((l) => (
                  <li key={l.code} role="none">
                    <button
                      role="menuitemradio"
                      aria-checked={l.code === lang}
                      type="button"
                      lang={l.code}
                      onClick={() => {
                        onLangChange(l.code);
                        setLangOpen(false);
                      }}
                      className={`block w-full border-l-2 px-3 py-2 text-left text-[13px] hover:bg-[var(--info-bg)] ${
                        l.code === lang
                          ? "border-[var(--navy-600)] font-semibold"
                          : "border-transparent"
                      }`}
                    >
                      {l.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Notifications */}
          <div ref={bellRef} className="relative">
            <button
              type="button"
              onClick={() => setBellOpen((o) => !o)}
              aria-expanded={bellOpen}
              aria-label={`Notifications, ${unread} high severity`}
              className="relative flex size-8 items-center justify-center rounded-[var(--radius)] border border-[var(--border-strong)] bg-white text-[var(--navy-700)] hover:bg-[var(--surface-2)]"
            >
              <Bell className="size-4" aria-hidden />
              {unread > 0 && (
                <span
                  aria-hidden
                  className="mono absolute -right-1.5 -top-1.5 flex size-[17px] items-center justify-center rounded-full border border-white bg-[var(--crimson)] text-[9px] font-bold text-white"
                >
                  {unread}
                </span>
              )}
            </button>
            {bellOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-80 overflow-hidden rounded-[var(--radius)] border border-[var(--border-strong)] bg-white shadow-[var(--shadow-pop)]">
                <p className="eyebrow border-b border-[var(--hairline)] bg-[var(--surface-2)] px-3 py-2 text-[var(--muted)]">
                  Active Alerts
                </p>
                <ul className="thin-scroll max-h-80 overflow-y-auto">
                  {alerts.length === 0 && (
                    <li className="px-3 py-4 text-[13px] text-[var(--muted)]">
                      No active alerts.
                    </li>
                  )}
                  {alerts.map((a) => (
                    <li
                      key={a.id}
                      className="border-b border-[var(--hairline)] px-3 py-2 last:border-b-0"
                    >
                      <span
                        className="eyebrow"
                        style={{ color: RISK_META[a.severity].color }}
                      >
                        {RISK_META[a.severity].label}
                      </span>
                      <p className="mt-1 text-[13px] font-semibold leading-tight">
                        {a.headline}
                      </p>
                      <p className="telemetry mt-0.5">
                        {a.district} · {a.source}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Who is looking at this.
              The public portal is the citizen's surface, so it says so. The
              control-room identity that used to sit here belongs to the
              operator console at /dashboard, which carries its own. The
              connectivity dot stays: whether this device can reach the network
              is the one thing about themselves a citizen needs to know before
              they submit a report. */}
          <div className="flex items-center gap-2 border-l border-[var(--border-strong)] pl-2">
            <span className="hidden text-right sm:block">
              <span className="block text-[12px] font-bold leading-none text-[var(--navy-800)]">
                {t.citizen}
              </span>
              <span className="mt-1 flex items-center justify-end gap-1">
                <span
                  aria-hidden
                  className={`size-1.5 rounded-full ${online ? "live-dot" : "pulse-critical"}`}
                  style={{ background: online ? "var(--green)" : "var(--crimson)" }}
                />
                <span className="text-[11px] leading-none text-[var(--muted)]">
                  {connectivity.state === "online"
                    ? t.connectivity.online
                    : connectivity.state === "low"
                      ? t.connectivity.weak
                      : t.connectivity.offline}
                </span>
              </span>
            </span>
            <span
              aria-hidden
              className="flex size-8 items-center justify-center rounded-full bg-[var(--navy-700)] text-white"
            >
              <UserRound className="size-4" />
            </span>
          </div>
        </div>
      </div>

    </header>
  );
}

/**
 * Supporting institutional identity — Government of Gujarat.
 *
 * A generic civic device (chakra over a plinth), not a reproduction of the
 * State Emblem of India, whose use is restricted by the State Emblem of India
 * (Prohibition of Improper Use) Act. It reads as government without claiming
 * to be an official seal on a demonstration build.
 */
function StateEmblem() {
  return (
    <span className="hidden shrink-0 flex-col items-center sm:flex">
      <svg viewBox="0 0 40 40" className="size-9" aria-hidden focusable="false">
        <circle
          cx="20"
          cy="16"
          r="10.5"
          fill="none"
          stroke="var(--navy-700)"
          strokeWidth="1.4"
        />
        <circle cx="20" cy="16" r="2.4" fill="var(--navy-700)" />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI) / 6;
          // Rounded: full-precision trig serialises differently in Node and the
          // browser, which React flags as a hydration mismatch on every load.
          const r = (n: number) => n.toFixed(3);
          return (
            <line
              key={i}
              x1={r(20 + Math.cos(a) * 3.4)}
              y1={r(16 + Math.sin(a) * 3.4)}
              x2={r(20 + Math.cos(a) * 9.6)}
              y2={r(16 + Math.sin(a) * 9.6)}
              stroke="var(--navy-700)"
              strokeWidth="1"
            />
          );
        })}
        <path d="M9 29h22l-2.5 4h-17L9 29Z" fill="var(--navy-700)" />
        <path d="M11 34.5h18v2H11z" fill="var(--navy-700)" opacity="0.6" />
      </svg>
    </span>
  );
}
