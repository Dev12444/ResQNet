/**
 * The ResQNet logo.
 *
 * The supplied artwork, used as supplied. It is not redrawn in CSS or SVG,
 * its colours are not restyled, and it is never stretched: every placement
 * sets one dimension and lets `object-contain` find the other, so the lockup
 * keeps its own proportions at any size.
 *
 * The file is the approved lockup with its flat background keyed out, so it
 * sits on the header's gradient, on white and on navy without a pale box
 * around it. Nothing inside the artwork was altered to do that — only the
 * paper it was delivered on was removed.
 *
 * Two entry points, because one lockup cannot do both jobs:
 *
 *   - `ResQLogo` is the whole thing: symbol, wordmark, subtitle and
 *     strapline. It needs vertical room, so it is used where there is some.
 *   - `ResQLogoMark` is the symbol alone, for the places that are 20-30px
 *     tall — a rail head, a footer lockup, an app icon. At that size the
 *     wordmark under the symbol would be two illegible grey bars, which is
 *     how a stacked lockup is normally reduced.
 */

import Image from "next/image";

/** Natural size of the trimmed artwork, used to keep the intrinsic ratio. */
const LOGO = { w: 457, h: 438 };
const MARK = { w: 295, h: 248 };

export function ResQLogo({
  className = "",
  priority = false,
}: {
  className?: string;
  /** Set on the header copy: it is above the fold on every route. */
  priority?: boolean;
}) {
  return (
    <Image
      src="/brand/resqnet-logo.png"
      alt="ResQNet — Disaster Response Platform"
      width={LOGO.w}
      height={LOGO.h}
      priority={priority}
      className={`w-auto object-contain ${className}`}
    />
  );
}

export function ResQLogoMark({
  className = "",
  alt = "",
}: {
  className?: string;
  /** Supply only where the mark is the sole label; otherwise it stays decorative. */
  alt?: string;
}) {
  return (
    <Image
      src="/brand/resqnet-mark.png"
      alt={alt}
      width={MARK.w}
      height={MARK.h}
      aria-hidden={alt ? undefined : true}
      className={`object-contain ${className}`}
    />
  );
}
