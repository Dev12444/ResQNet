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
 * Language lives here so the choice persists across routes, and is exposed
 * through `useLang()` rather than threaded down as props. Flash-alert state
 * lives here too, because a mass warning has to be able to reach a citizen on
 * any page — see `FlashAlertProvider`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { Lang, WeatherAlert } from "@/types";
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

const LANG_KEY = "resqnet.lang";

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

const LangContext = createContext<LangContextValue>({
  lang: "en",
  setLang: () => {},
});

/** Current interface language. Never applied to citizen-authored text. */
export function useLang(): LangContextValue {
  return useContext(LangContext);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [menuOpen, setMenuOpen] = useState(false);
  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);
  const connectivity = useConnectivity();

  // Restore the saved language after mount — reading storage during render
  // would desync the server-rendered markup.
  useEffect(() => {
    // Deferred so the restore does not set state synchronously in the effect.
    const timer = setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(LANG_KEY);
        if (saved === "en" || saved === "gu" || saved === "hi") setLangState(saved);
      } catch {
        /* storage blocked — English is a fine default */
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const env = await getWeatherAlerts();
      if (!cancelled) setAlerts(env.data);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(LANG_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      <FlashAlertProvider lang={lang}>
        <a href="#main" className="skip-link">
          Skip to main content
        </a>

        <GovHeader
          lang={lang}
          onLangChange={setLang}
          connectivity={connectivity}
          alerts={alerts}
          onMenu={() => setMenuOpen(true)}
        />
        <PrimaryNav lang={lang} />
        <DisasterStrip />
        <EmergencyUtilityBar />
        {/* Full width and above the rail: a critical warning belongs to the
            whole system, not to one panel on one route. */}
        <CriticalAlertBanner alerts={alerts} />

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
    </LangContext.Provider>
  );
}
