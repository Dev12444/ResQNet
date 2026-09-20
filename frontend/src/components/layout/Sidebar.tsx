"use client";

/**
 * The navy command rail.
 *
 * Narrow (176px), fixed on desktop, a slide-over on mobile. Ten destinations,
 * no nesting, no accordions — an operator reaches any surface in one click.
 * The active item takes a crimson plate, which is the only place crimson is
 * used decoratively anywhere in the shell.
 *
 * The foot of the rail carries the creed, set flush left, one word per line.
 * A stippled Statue of Unity used to stand above it; it was removed because a
 * national monument is not this platform's identity, and the rail reads
 * quieter without it.
 */

import { pageStrings } from "@/lib/pageStrings";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import {
  Boxes,
  CloudRain,
  FileText,
  Home,
  House,
  LifeBuoy,
  Map,
  TriangleAlert,
  UserSearch,
  Users,
  X,
} from "lucide-react";
import type { ComponentType } from "react";
import type { Lang } from "@/types";
import { PLATFORM_STRINGS, SIDEBAR_NAV, type NavKey } from "@/lib/constants";
import { ResQLogoMark } from "@/components/brand/ResQLogo";

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  Home,
  Map,
  TriangleAlert,
  House,
  Boxes,
  UserSearch,
  Users,
  FileText,
  CloudRain,
  LifeBuoy,
};

export function Sidebar({
  lang,
  open,
  onClose,
}: {
  lang: Lang;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const m = pageStrings(lang).misc;
  const t = PLATFORM_STRINGS[lang];
  const nav = t.nav;

  return (
    <>
      {/* Mobile scrim */}
      {open && (
        <button
          type="button"
          aria-label={m.closeNavigation}
          onClick={onClose}
          className="fixed inset-0 z-40 bg-[var(--navy-900)]/60 lg:hidden"
        />
      )}

      <aside
        /* On desktop the rail is a normal flex child, so it stretches from the
           ticker down to the footer and the monument sits at its foot — as on
           the reference. It is deliberately not `h-dvh`: the rail starts below
           ~110px of header, nav and ticker, so a full-viewport height would
           push its lower content off the bottom of the screen. */
        className={`fixed inset-y-0 left-0 z-50 flex w-[188px] flex-col bg-[var(--navy-800)] transition-transform lg:static lg:z-auto lg:w-44 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Mobile-only head — on desktop the header carries the wordmark */}
        <div className="flex h-12 items-center justify-between border-b border-[var(--rail-border)] px-3 lg:hidden">
          <span className="flex items-center gap-2">
            {/* The mark is navy ink and would disappear into the rail, so
                it sits on its own small white tile rather than being recoloured
                — the artwork is never restyled. */}
            <span className="flex size-6 items-center justify-center rounded-[3px] bg-white">
              <ResQLogoMark className="size-5" />
            </span>
            <span className="cmd text-[12px] text-white">{t.chrome.menu}</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={m.closeNavigation}
            className="text-[var(--rail-muted)] hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav
          aria-label={m.sections}
          className="thin-scroll shrink-0 py-1"
        >
          <ul>
            {SIDEBAR_NAV.map((item) => {
              const Icon = ICONS[item.icon] ?? Home;
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href as Route}
                    onClick={onClose}
                    aria-current={active ? "page" : undefined}
                    className={`mx-1.5 my-[1px] flex items-center gap-2.5 rounded-[4px] px-2.5 py-[7px] text-[12.5px] font-semibold no-underline transition-colors ${
                      active
                        ? "bg-[var(--crimson)] text-white"
                        : "text-[#c6d6ea] hover:bg-[var(--rail-hover)] hover:text-white"
                    }`}
                  >
                    <Icon className="size-[15px] shrink-0" />
                    <span className="truncate">{nav[item.key as NavKey]}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* The creed, set flush left, one word per line, closed by a short
            crimson rule: the only crimson in the rail apart from the active
            nav plate. */}
        <div className="relative mt-auto shrink-0 px-3 pb-4 pt-1">
          <p className="text-[13px] font-normal leading-[1.18] text-[#c3d3e2]">
            {t.railCreed.map((word) => (
              <span key={word} className="block">
                {word}
              </span>
            ))}
          </p>
          <span
            aria-hidden
            className="mt-2 block h-[2px] w-7 bg-[var(--crimson-500)]"
          />
        </div>
      </aside>
    </>
  );
}
