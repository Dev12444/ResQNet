"use client";

/**
 * Portal footer: supporting institutional identity on the left, the state
 * motto in the centre, ResQNet and its operating cycle on the right.
 *
 * It also carries the standing disclaimer. That sentence is not boilerplate —
 * it is the one place the platform states plainly that it coordinates response
 * rather than replacing 112, and that AI on this platform is advisory.
 *
 * The thin line above it carries the operator console and the genuine public
 * portals. They used to sit on the navy section bar, which is a citizen's
 * navigation and has no business carrying a staff entry point or four links
 * that leave the site. The footer is where a government portal keeps them.
 */

import Link from "next/link";
import type { Lang } from "@/types";
import { PLATFORM_STRINGS } from "@/lib/constants";
import { ResQLogoMark } from "@/components/brand/ResQLogo";

/** Genuine public portals. Opened in a new tab, marked as leaving ResQNet. */
const EXTERNAL = [
  { label: "NDMA", href: "https://ndma.gov.in/", title: "National Disaster Management Authority" },
  { label: "NDRF", href: "https://www.ndrf.gov.in/", title: "National Disaster Response Force" },
  { label: "IMD", href: "https://mausam.imd.gov.in/", title: "India Meteorological Department" },
  { label: "NIDM", href: "https://nidm.gov.in/", title: "National Institute of Disaster Management" },
];

export function SiteFooter({ lang }: { lang: Lang }) {
  const t = PLATFORM_STRINGS[lang];
  return (
    <footer className="mt-auto border-t border-[var(--border)] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        <span className="flex items-center gap-2">
          <CivicDevice />
          <span className="leading-tight">
            <span className="block text-[12px] font-bold text-[var(--navy-800)]">
              State Disaster Management Authority
            </span>
            <span className="block text-[11px] text-[var(--muted)]">Emergency Operations Centre</span>
          </span>
        </span>

        <span className="hidden flex-1 text-center text-[17px] font-bold text-[var(--navy-800)] md:block lg:text-[19px]">
          {t.saferTogether}
        </span>

        <span className="flex items-center gap-2.5">
          <ResQLogoMark className="size-6" />
          <span className="leading-tight">
            <span className="cmd block text-[12px] text-[var(--navy-800)]">ResQNet</span>
            <span className="eyebrow block text-[9px] text-[var(--muted)]">
              {t.motto}
            </span>
            {/* The rule the reference closes the footer with. */}
            <span
              aria-hidden
              className="mt-1 block h-[2px] w-full bg-[var(--crimson)]"
            />
          </span>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--hairline)] px-4 py-1.5 text-[10.5px]">
        <Link
          href="/dashboard"
          className="font-semibold text-[var(--navy-700)] no-underline hover:underline"
        >
          Operator console
        </Link>
        <span aria-hidden className="text-[var(--hairline)]">
          |
        </span>
        {EXTERNAL.map((x) => (
          <a
            key={x.href}
            href={x.href}
            title={`${x.title} — opens in a new tab`}
            target="_blank"
            rel="noreferrer noopener"
            className="text-[var(--muted)] no-underline hover:text-[var(--navy-700)] hover:underline"
          >
            {x.label}
          </a>
        ))}
        <span className="text-[var(--faint)]">These links leave ResQNet.</span>
      </div>

      <p className="border-t border-[var(--hairline)] px-4 py-1.5 text-[10.5px] leading-relaxed text-[var(--faint)]">
        ResQNet coordinates emergency response. It does not replace calling 112.
        AI-assisted classification on this platform is advisory — operational
        decisions are made by authorised personnel.
      </p>
    </footer>
  );
}

/** Small civic device for the footer lockup. */
function CivicDevice() {
  return (
    <svg viewBox="0 0 24 24" className="size-6 shrink-0" aria-hidden focusable="false">
      <circle cx="12" cy="10" r="6.4" fill="none" stroke="var(--navy-700)" strokeWidth="1.1" />
      <circle cx="12" cy="10" r="1.5" fill="var(--navy-700)" />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        // See the note in GovHeader's StateEmblem — rounded to keep SSR and the
        // client byte-identical.
        const r = (n: number) => n.toFixed(3);
        return (
          <line
            key={i}
            x1={r(12 + Math.cos(a) * 2.1)}
            y1={r(10 + Math.sin(a) * 2.1)}
            x2={r(12 + Math.cos(a) * 5.8)}
            y2={r(10 + Math.sin(a) * 5.8)}
            stroke="var(--navy-700)"
            strokeWidth="0.8"
          />
        );
      })}
      <path d="M5 18.5h14l-1.5 3h-11L5 18.5Z" fill="var(--navy-700)" />
    </svg>
  );
}
