"use client";

/**
 * Primary navigation — the section bar under the institutional header.
 *
 * It carries the platform's own sections, in the sidebar's order: Home, Live
 * Map, Incidents, Shelters, Resources, Missing Persons, Volunteers, Reports,
 * Weather, Support. It used to carry programme names borrowed from the
 * reference portal — IDRN, Aapda Mitra, Devadoot, Web-DCRA — which told a
 * citizen nothing about where a link went and, worse, named schemes this
 * build does not actually implement. A destination should be named after what
 * is behind it.
 *
 * One list, shared with the rail through `SIDEBAR_NAV`, so the two can never
 * drift apart. It matters most on a phone, where the rail is behind a menu
 * button and this bar is the only navigation on screen — which is why it
 * scrolls horizontally rather than collapsing.
 *
 * Deep navy, because the reference is, and nothing else sits on the band: the
 * operator console and the external government portals moved to the footer,
 * where a citizen portal keeps them. The active section keeps its crimson
 * plate, the only saturated object in the bar.
 */

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import type { Lang } from "@/types";
import { PLATFORM_STRINGS, SIDEBAR_NAV, type NavKey } from "@/lib/constants";

export function PrimaryNav({ lang }: { lang: Lang }) {
  const pathname = usePathname();
  const nav = PLATFORM_STRINGS[lang].nav;

  return (
    <nav
      aria-label="Sections"
      className="border-b border-[var(--navy-900)] bg-[var(--navy-900)]"
    >
      <ul className="no-scrollbar flex items-stretch overflow-x-auto">
        {SIDEBAR_NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href as Route}
                aria-current={active ? "page" : undefined}
                className={`flex h-[30px] items-center whitespace-nowrap px-3 text-[12px] font-semibold no-underline transition-colors ${
                  active
                    ? "bg-[var(--crimson)] text-white"
                    : "text-[#c6d6ea] hover:bg-[var(--navy-700)] hover:text-white"
                }`}
              >
                {nav[item.key as NavKey]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
