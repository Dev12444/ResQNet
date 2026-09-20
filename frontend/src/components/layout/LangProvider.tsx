"use client";

/**
 * Interface language, for the whole application.
 *
 * This used to live inside `AppShell`, which meant it covered every route the
 * shell wraps — and not `/dashboard`, which the shell hands straight through
 * as a full-screen console. Anything on that route calling `useLang()` got the
 * context default and rendered in English no matter what the citizen had
 * chosen. Sitting above the shell in the root layout, the choice now reaches
 * every route, and the operator console can follow it too.
 *
 * Never applied to citizen-authored text: a report typed in Gujarati stays in
 * Gujarati whatever the interface is set to.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { Lang } from "@/types";
import { PLATFORM_STRINGS } from "@/lib/constants";

const LANG_KEY = "resqnet.lang";

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

const LangContext = createContext<LangContextValue>({
  lang: "en",
  setLang: () => {},
});

/** Current interface language. */
export function useLang(): LangContextValue {
  return useContext(LangContext);
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  // Restore the saved choice after mount — reading storage during render would
  // desync the server-rendered markup.
  useEffect(() => {
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

  /*
   * Keep the document's own language attribute in step.
   *
   * `<html lang>` is fixed at "en" in the root layout because that markup is
   * rendered on the server, before anyone's preference is known. Left alone, a
   * screen reader announces Gujarati and Hindi with English pronunciation
   * rules, which is close to unintelligible.
   */
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

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
      {/*
       * The tab title, rendered rather than assigned.
       *
       * `metadata` in the root layout is resolved on the server, before
       * anyone's preference is known, and `generateMetadata` is Server
       * Component only — so no server hook can read the saved language, and
       * the tab kept its English title on an otherwise Gujarati console.
       *
       * Assigning `document.title` from an effect does not hold: Next renders
       * the title from `metadata` as part of the React tree, so React reverts
       * the assignment on its next commit — and with several panels polling,
       * that is immediately. Rendering React's own `<title>` is the documented
       * alternative for client components (see the `global-error` note in the
       * Next docs), and it wins because it is the only title in the tree —
       * `metadata.title` in the root layout was removed for exactly that
       * reason. On the server this renders English, which is the correct
       * pre-preference default, and it re-renders when the choice is restored.
       */}
      <title>{PLATFORM_STRINGS[lang].platformName}</title>
      {children}
    </LangContext.Provider>
  );
}
