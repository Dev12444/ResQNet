"use client";

/**
 * The emergency comms ticker.
 *
 * A thin government-blue strip — 24px, never a banner — carrying the seven
 * state helplines past on a continuous loop, the way a control room runs a
 * frequency. Three rules govern it:
 *
 *  1. Never hide a number. On narrow screens it still scrolls; it never
 *     collapses behind a menu.
 *  2. Never make someone chase a moving target. Hovering or tab-focusing
 *     anywhere in the strip pauses the loop via CSS `animation-play-state`,
 *     so it is instant and does not depend on React.
 *  3. Never animate at the cost of access. Under `prefers-reduced-motion` the
 *     loop is suppressed in `globals.css` and the strip degrades to an
 *     ordinary horizontally-scrollable list.
 *
 * Entries are rendered twice into one track. The animation translates exactly
 * -50%, so the second copy arrives where the first began and the loop is
 * seamless. The duplicate is `aria-hidden` and out of the tab order, so
 * assistive technology and keyboard users meet each number once.
 *
 * Every entry is a real `tel:` link, so on a phone these dial.
 */

import type { Lang } from "@/types";
import { PLATFORM_STRINGS, UTILITY_NUMBERS } from "@/lib/constants";

export function EmergencyUtilityBar({ lang }: { lang: Lang }) {
  const t = PLATFORM_STRINGS[lang].helplines;

  return (
    <div className="ticker" role="region" aria-label={t.regionLabel}>
      <div className="ticker-track">
        {UTILITY_NUMBERS.map((e) => (
          <TickerItem key={e.number} number={e.number} label={t[e.key]} lang={lang} />
        ))}
        {UTILITY_NUMBERS.map((e) => (
          <TickerItem key={`echo-${e.number}`} number={e.number} label={t[e.key]} lang={lang} echo />
        ))}
      </div>
    </div>
  );
}

function TickerItem({
  number,
  label,
  lang,
  echo = false,
}: {
  number: string;
  label: string;
  lang: Lang;
  /** The duplicated copy that makes the loop seamless — hidden from AT. */
  echo?: boolean;
}) {
  const t = PLATFORM_STRINGS[lang].helplines;
  return (
    <a
      href={`tel:${number}`}
      className="ticker-item"
      aria-hidden={echo || undefined}
      tabIndex={echo ? -1 : undefined}
      aria-label={`${t.call} ${label} ${t.on} ${number}`}
    >
      <strong>{number}</strong>
      <span className="ticker-sep" aria-hidden>
        •
      </span>
      <span>{label}</span>
    </a>
  );
}
