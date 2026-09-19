"use client";

/**
 * Command bar.
 *
 *   RESQNET  │  STATE OPS · telemetry  │  language · alerts · ● network
 *
 * Carbon, 56px, square-cornered. The left third is identity, the middle is
 * live instrumentation, the right is the operator's controls. It does not
 * carry a page title — the rail already says where you are, and a title band
 * is the first thing that makes a console look like a website.
 */

import Link from "next/link";
import { Bell, ChevronDown, Globe, Menu } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Lang, WeatherAlert } from "@/types";
import { LANGS, PLATFORM_STRINGS, RISK_META } from "@/lib/constants";
import { ResQWordmark } from "@/components/brand/ResQMark";
import { LiveClock, NetworkLamp, SyncCounter } from "./Telemetry";
import { type ConnectivityInfo } from "./StatusIndicator";

export function Header({
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
  const [langOpen, setLangOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  // Close either popover on an outside click or Escape.
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
    <header className="sticky top-0 z-30 border-b border-[var(--rail-border)] bg-[var(--rail)]">
      <div className="flex h-14 items-stretch">
        <button
          type="button"
          onClick={onMenu}
          aria-label="Open navigation"
          className="px-3 text-[var(--rail-muted)] hover:bg-[var(--rail-hover)] hover:text-white lg:hidden"
        >
          <Menu className="size-5" />
        </button>

        {/* Identity */}
        <Link
          href="/"
          className="flex min-w-0 items-center border-r border-[var(--rail-border)] px-3 no-underline sm:px-4 lg:w-60 lg:shrink-0"
        >
          <span className="[&_span]:!text-white">
            <ResQWordmark tone="dark" />
          </span>
        </Link>

        {/* Instrumentation — the middle of the bar is a readout, not whitespace */}
        <div className="hidden min-w-0 flex-1 items-center gap-4 px-4 md:flex">
          <span className="cmd shrink-0 text-[13px] text-[var(--rail-ink)]">
            State Ops
          </span>
          <span aria-hidden className="h-4 w-px shrink-0 bg-[var(--rail-border)]" />
          <span className="[&_.telemetry_span]:!text-[var(--rail-muted)]">
            <LiveClock />
          </span>
          <span className="hidden [&_.telemetry_span]:!text-[var(--rail-muted)] xl:inline">
            <SyncCounter
              since={connectivity.lastSynced ? connectivity.lastSynced.toISOString() : null}
            />
          </span>
          <span className="telemetry hidden shrink-0 text-[var(--rail-muted)] xl:inline">
            Radar / IMD · Demo Dataset
          </span>
        </div>

        <div className="ml-auto flex items-stretch">
          {/* Language */}
          <div ref={langRef} className="relative flex items-center border-l border-[var(--rail-border)]">
            <button
              type="button"
              onClick={() => setLangOpen((o) => !o)}
              aria-expanded={langOpen}
              aria-haspopup="menu"
              className="flex h-full items-center gap-1.5 px-2.5 text-[var(--rail-ink)] hover:bg-[var(--rail-hover)] sm:px-3"
            >
              <Globe className="size-4 text-[var(--rail-muted)]" aria-hidden />
              <span className="cmd hidden text-[12px] sm:inline">
                {LANGS.find((l) => l.code === lang)?.label}
              </span>
              <ChevronDown className="size-3.5 text-[var(--rail-muted)]" aria-hidden />
            </button>
            {langOpen && (
              <ul
                role="menu"
                className="absolute right-0 top-full z-40 w-44 border border-[var(--border-strong)] bg-[var(--surface)] shadow-lg"
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
                      className={`block w-full px-3 py-2 text-left text-sm hover:bg-[var(--teal-bg)] ${
                        l.code === lang
                          ? "border-l-2 border-[var(--teal)] font-semibold"
                          : "border-l-2 border-transparent"
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
          <div ref={bellRef} className="relative flex items-center border-l border-[var(--rail-border)]">
            <button
              type="button"
              onClick={() => setBellOpen((o) => !o)}
              aria-expanded={bellOpen}
              aria-label={`Notifications, ${unread} high severity`}
              className="relative flex h-full items-center px-3 text-[var(--rail-ink)] hover:bg-[var(--rail-hover)]"
            >
              <Bell className="size-[18px]" aria-hidden />
              {unread > 0 && (
                <span
                  aria-hidden
                  className="mono absolute right-1 top-3 flex size-4 items-center justify-center bg-[var(--coral)] text-[10px] font-bold text-white"
                >
                  {unread}
                </span>
              )}
            </button>
            {bellOpen && (
              <div className="absolute right-0 top-full z-40 w-80 border border-[var(--border-strong)] bg-[var(--surface)] shadow-lg">
                <p className="eyebrow border-b border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--muted)]">
                  Active Alerts
                </p>
                <ul className="thin-scroll max-h-80 overflow-y-auto">
                  {alerts.length === 0 && (
                    <li className="px-3 py-4 text-sm text-[var(--muted)]">
                      No active alerts.
                    </li>
                  )}
                  {alerts.map((a) => (
                    <li
                      key={a.id}
                      className="border-b border-[var(--border)] px-3 py-2 last:border-b-0"
                    >
                      <span
                        className="eyebrow"
                        style={{ color: RISK_META[a.severity].color }}
                      >
                        {RISK_META[a.severity].label}
                      </span>
                      <p className="mt-1 text-sm font-semibold leading-tight">
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

          {/* Network state */}
          <div className="flex items-center gap-2.5 border-l border-[var(--rail-border)] px-3 sm:px-4">
            <span className="hidden text-right sm:block">
              <span className="cmd block text-[12px] leading-none text-white">
                {t.controlRoom}
              </span>
              <span className="mt-1 block">
                <NetworkLamp
                  online={online}
                  tone="dark"
                  label={
                    connectivity.state === "online"
                      ? "State Network Online"
                      : connectivity.state === "low"
                        ? "Weak Signal"
                        : "Offline"
                  }
                />
              </span>
            </span>
            <span
              aria-hidden
              className="notch-sm flex size-8 shrink-0 items-center justify-center border border-[var(--teal)] bg-[var(--petrol)] text-[11px] font-bold text-white"
            >
              SC
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
