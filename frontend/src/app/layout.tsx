import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Noto_Sans_Gujarati } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
 * IBM Plex Sans has no Gujarati coverage and Plex's Devanagari is not on
 * Google Fonts, so Gujarati and Hindi report text would otherwise fall back to
 * whatever the device happens to have. Noto Sans Gujarati covers both scripts
 * we display and is appended to the stack in `globals.css`.
 */
const notoGujarati = Noto_Sans_Gujarati({
  variable: "--font-noto-gujarati",
  subsets: ["gujarati", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ResQNet — Gujarat Emergency Command Center",
  description:
    "AI-assisted emergency coordination for Gujarat: citizen and 112 reports, sensors, field teams, hospitals and departments in one operational picture.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#dc2626",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable} ${notoGujarati.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
