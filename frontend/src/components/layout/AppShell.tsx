"use client";

/**
 * The portal frame.
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ institutional header (full width)            │
 *   │ primary navigation                           │
 *   │ hazard strip                                 │
 *   │ 112 | 100 | 101 | 108 | 1098 | 181 | 1077 →  │
 *   │ critical warning banner (only when one is live) │
 *   ├────────┬─────────────────────────────────────┤
 *   │  rail  │ workspace                           │
 *   ├────────┴─────────────────────────────────────┤
 *   │ Emblem | A Safer State Together | RESQNET      │
 *   └──────────────────────────────────────────────┘
 *
 * Header, nav, hazard strip and ticker all span the full width so identity and
 * the emergency numbers belong to the whole system; only the workspace is
 * indented by the rail.
 *
 * Language is read from `LangProvider` in the root layout rather than owned
 * here: this component hands `/dashboard` straight through, so a choice living
 * at this level never reached the operator console. Flash-alert state does
 * live here, because a mass warning has to be able to reach a citizen on any
 * page — see `FlashAlertProvider`.
 */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { DataMode, WeatherAlert } from "@/types";
import { PLATFORM_STRINGS } from "@/lib/constants";
import { getWeatherAlerts } from "@/lib/api";
import { Sidebar } from "./Sidebar";
import { GovHeader } from "./GovHeader";
import { PrimaryNav } from "./PrimaryNav";
import { DisasterStrip } from "./DisasterStrip";
import { EmergencyUtilityBar } from "./EmergencyUtilityBar";
import { CriticalAlertBanner } from "./CriticalAlertBanner";
import { ConnectivityBanner, useConnectivity } from "./StatusIndicator";
import { FlashAlertProvider } from "@/components/flash/FlashAlertProvider";
import { SiteFooter } from "./SiteFooter";
import { useLang } from "./LangProvider";

/*
 * Re-exported so the four existing call sites keep importing `useLang` from
 * here. The hook itself now lives in `LangProvider`.
 */
export { useLang } from "./LangProvider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { lang, setLang } = useLang();
  const [menuOpen, setMenuOpen] = useState(false);
  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);
  // Provenance travels with the alerts: the banner must not present a demo
  // warning as an official one.
  const [alertMode, setAlertMode] = useState<DataMode>("simulated");
  const connectivity = useConnectivity();
  const pathname = usePathname() ?? "";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const env = await getWeatherAlerts();
      if (!cancelled) {
        setAlerts(env.data);
        setAlertMode(env.mode);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // The control room is a full-screen console with its own header, 112 bar and live status.
  if (pathname.startsWith("/dashboard")) return <>{children}</>;

  return (
    <>
      <FlashAlertProvider lang={lang}>
        <a href="#main" className="skip-link">
          {PLATFORM_STRINGS[lang].chrome.skipToContent}
        </a>

        <GovHeader
          lang={lang}
          onLangChange={setLang}
          connectivity={connectivity}
          alerts={alerts}
          onMenu={() => setMenuOpen(true)}
        />
        <PrimaryNav lang={lang} />
        <DisasterStrip lang={lang} />
        <EmergencyUtilityBar lang={lang} />
        {/* Full width and above the rail: a critical warning belongs to the
            whole system, not to one panel on one route. */}
        <CriticalAlertBanner alerts={alerts} mode={alertMode} />

        <div className="flex flex-1">
          <Sidebar lang={lang} open={menuOpen} onClose={() => setMenuOpen(false)} />

          <div className="flex min-w-0 flex-1 flex-col">
            <ConnectivityBanner info={connectivity} />
            <main id="main" className="flex-1">
              {children}
            </main>
          </div>
        </div>

        <SiteFooter lang={lang} />
      </FlashAlertProvider>
    </>
  );
}
