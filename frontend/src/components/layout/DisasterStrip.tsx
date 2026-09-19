"use client";

/**
 * Hazard quick-access strip.
 *
 * The compact icon row a geo-portal puts under its navigation: one glyph per
 * hazard class, each routing to the ResQNet surface that carries that hazard's
 * operational picture. Colour follows the platform's semantics — crimson for
 * life-threatening classes, amber for warnings, blue for water.
 *
 * Drawn as flat glyphs on white tiles rather than as filled colour discs. A
 * row of twelve saturated circles reads as a sticker sheet, not as an
 * instrument panel: at this size the disc is the loudest thing on a page whose
 * actual emergency signal is the crimson ticker directly below it. The tile
 * keeps the colour coding — the glyph is still drawn in the hazard's own
 * colour — while returning the strip to the weight the reference gives it.
 *
 * Every icon is a real link with a visible tooltip; none is decorative.
 */

import Link from "next/link";
import type { Route } from "next";
import {
  Ambulance,
  Building2,
  CarFront,
  CloudRain,
  Factory,
  Flame,
  Home,
  Mountain,
  Search,
  Siren,
  Tornado,
  Waves,
  Wrench,
} from "lucide-react";
import type { ComponentType } from "react";

interface Hazard {
  key: string;
  label: string;
  href: Route;
  Icon: ComponentType<{ className?: string }>;
  color: string;
}

const HAZARDS: Hazard[] = [
  { key: "cyclone", label: "Cyclone", href: "/weather" as Route, Icon: Tornado, color: "var(--violet)" },
  { key: "flood", label: "Flood", href: "/weather" as Route, Icon: Waves, color: "var(--blue)" },
  { key: "fire", label: "Fire", href: "/incidents" as Route, Icon: Flame, color: "var(--high)" },
  { key: "rainfall", label: "Heavy Rainfall", href: "/weather" as Route, Icon: CloudRain, color: "var(--blue)" },
  { key: "landslide", label: "Landslide", href: "/incidents" as Route, Icon: Mountain, color: "var(--amber-600)" },
  { key: "medical", label: "Medical", href: "/incidents" as Route, Icon: Ambulance, color: "var(--crimson)" },
  { key: "industrial", label: "Industrial", href: "/incidents" as Route, Icon: Factory, color: "var(--high)" },
  { key: "road", label: "Road Accident", href: "/incidents" as Route, Icon: CarFront, color: "var(--amber)" },
  { key: "collapse", label: "Building Collapse", href: "/incidents" as Route, Icon: Building2, color: "var(--muted)" },
  { key: "shelter", label: "Shelters", href: "/shelters" as Route, Icon: Home, color: "var(--green)" },
  { key: "response", label: "Emergency Response", href: "/resources" as Route, Icon: Siren, color: "var(--crimson)" },
  { key: "infra", label: "Infrastructure", href: "/resources" as Route, Icon: Wrench, color: "var(--navy-600)" },
];

export function DisasterStrip() {
  return (
    <div className="border-b border-[var(--border)] bg-[var(--surface-2)]">
      <div className="flex items-center">
        <ul className="no-scrollbar flex flex-1 items-center gap-[3px] overflow-x-auto px-2 py-[5px]">
          {HAZARDS.map(({ key, label, href, Icon, color }) => (
            <li key={key} className="shrink-0">
              <Link
                href={href}
                title={label}
                className="flex size-[24px] items-center justify-center rounded-[3px] border border-[var(--border)] bg-white no-underline transition-colors hover:border-[var(--navy-600)] hover:bg-[var(--info-bg)]"
                style={{ color }}
              >
                <Icon className="size-[14px]" />
                <span className="sr-only">{label}</span>
              </Link>
            </li>
          ))}
        </ul>

        <Link
          href="/live-map"
          title="Search the state picture"
          className="mr-2 flex h-[24px] shrink-0 items-center gap-1.5 rounded-[3px] border border-[var(--border-strong)] bg-white px-2 text-[11px] font-semibold text-[var(--navy-700)] no-underline hover:bg-[var(--info-bg)]"
        >
          <Search className="size-[13px]" aria-hidden />
          <span className="hidden sm:inline">Search map</span>
          <span className="sr-only sm:hidden">Search the map</span>
        </Link>
      </div>
    </div>
  );
}
