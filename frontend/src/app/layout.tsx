import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import {
  Archivo_Narrow,
  IBM_Plex_Mono,
  Noto_Sans_Gujarati,
  Source_Sans_3,
} from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { LangProvider } from "@/components/layout/LangProvider";

/**
 * Two Latin faces, deliberately.
 *
 * Archivo Narrow carries every heading, nav item, panel title and status word.
 * A narrow face is what makes an operations portal legible at this density:
 * LIVE DISPATCH & LOGS fits in a 120px panel head at 11px without tracking
 * games. Archivo rather than Roboto Condensed because it keeps stroke contrast
 * and open counters at that width, so a title reads as signage rather than as
 * one more row of table chrome.
 *
 * Source Sans 3 carries running text. It was drawn for interface text at small
 * sizes, and at the 11-12px this platform actually lives at it stays warm and
 * legible where a grotesque goes flat.
 */
const archivoNarrow = Archivo_Narrow({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const bodySans = Source_Sans_3({
  variable: "--font-sans-body",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

/** Mono is reserved for IDs, timestamps, ETAs, coordinates and readings. */
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

/**
 * Neither Latin face ships Gujarati or Devanagari, so Gujarati and Hindi text would otherwise fall back to whatever
 * the device happens to have. Noto Sans Gujarati covers both scripts we
 * display and is appended to the stack in `globals.css`.
 */
const notoGujarati = Noto_Sans_Gujarati({
  variable: "--font-noto-gujarati",
  subsets: ["gujarati", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

/*
 * No `title` here on purpose.
 *
 * The title has to follow the interface language, which is a client-side
 * preference this server-resolved object cannot see. `LangProvider` renders a
 * React `<title>` instead; a `title` in this object would emit a second one
 * that wins by document order and pin the tab to English.
 */
export const metadata: Metadata = {
  description:
    "Integrated Disaster Response & Public Safety Platform: citizen and 112 reports, AI-assisted triage, GIS command map, dispatch, shelters and mass warning.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#071D34",
};

/**
 * Applies the saved console theme before first paint.
 *
 * Inlined and run synchronously on purpose: reading the preference in an
 * effect would let the light theme paint first and flash on every load for
 * anyone running the night-shift console.
 */
const THEME_BOOTSTRAP = `try{var t=localStorage.getItem('resqnet-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;}catch(e){}`;

/*
 * The props are written out rather than using Next's `LayoutProps<"/">`.
 * That helper is generated into `.next/types` by a build, so a fresh clone
 * fails `tsc --noEmit` until something has built — which is exactly the order
 * a CI job or a new contributor does things in. The root layout takes children
 * and nothing else, so spelling it out costs nothing and removes the trap.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${archivoNarrow.variable} ${bodySans.variable} ${plexMono.variable} ${notoGujarati.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      {/* `lang` above is the server's best guess; LangProvider corrects the
          live document once the saved preference is known. */}
      <body className="flex min-h-full flex-col">
        <LangProvider>
          <AppShell>{children}</AppShell>
        </LangProvider>
      </body>
    </html>
  );
}
