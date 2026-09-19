/**
 * The ResQNet mark.
 *
 * Concept: SIGNAL → LOCATION → CONNECTION → RESPONSE.
 *
 * Two signal paths leave nodes on a vertical trunk and converge on a single
 * filled point; a response leg drives away from that point. The trunk, the
 * open bowl formed by the converging paths, and the leg together describe an
 * abstract "R" — but the geometry is a network diagram first and a letter
 * second, which is why it survives being shrunk to a favicon.
 *
 * The convergence node is the only crimson element: it is the response, and
 * crimson is reserved for emergencies across the whole platform.
 *
 * This is ResQNet's own mark. It deliberately borrows nothing from NDEM or any
 * other portal's emblem — the reference informs the layout, never the identity.
 *
 * Renders identically at 16px (favicon), 22px (rail), 30px (header) and as a
 * map marker plate, because it is built from four strokes and two dots with no
 * detail below 1/32 of the viewBox.
 */

export function ResQMark({
  className = "size-8",
  tone = "light",
  title,
}: {
  className?: string;
  /** `light` for white/grey surfaces, `dark` for the navy rail and nav bar. */
  tone?: "light" | "dark";
  /** Supply only where the mark is the sole label; otherwise it stays decorative. */
  title?: string;
}) {
  const trunk = tone === "dark" ? "#dbe6f3" : "var(--navy-800)";
  const path = tone === "dark" ? "#6ea8e8" : "var(--navy-600)";
  const eye = tone === "dark" ? "#0d2a52" : "#ffffff";

  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      {/* Converging signal paths — the connection */}
      <path
        d="M9 6.5 L21 12.5 M9 18.5 L21 12.5"
        stroke={path}
        strokeWidth="2.1"
        strokeLinecap="square"
        fill="none"
      />
      {/* Trunk — the origin, and the stem of the R */}
      <path
        d="M9 4.5 V27.5"
        stroke={trunk}
        strokeWidth="3.2"
        strokeLinecap="square"
        fill="none"
      />
      {/* Response leg — speed away from the point of convergence */}
      <path
        d="M20.4 14.6 L26.5 27.5"
        stroke={trunk}
        strokeWidth="3.2"
        strokeLinecap="square"
        fill="none"
      />
      {/* Origin nodes on the trunk */}
      <rect x="6.6" y="4.2" width="4.8" height="4.8" fill={path} />
      <rect x="6.9" y="16.4" width="4.2" height="4.2" fill={path} />
      {/* The response point */}
      <circle cx="21" cy="12.5" r="4.1" fill="var(--crimson)" />
      <circle cx="21" cy="12.5" r="1.5" fill={eye} />
    </svg>
  );
}

/**
 * Full lockup for the institutional header.
 *
 * RESQ is set solid; NET takes the contrasting treatment in crimson, so the
 * wordmark reads as one engineered unit rather than a single bold noun.
 */
export function ResQWordmark({
  tone = "light",
  size = 26,
}: {
  tone?: "light" | "dark";
  /** Cap height of the wordmark in px. */
  size?: number;
}) {
  const ink = tone === "dark" ? "#ffffff" : "var(--navy-800)";
  return (
    <span
      className="block whitespace-nowrap leading-none"
      style={{ fontSize: size, fontWeight: 800, letterSpacing: "-0.02em" }}
    >
      <span style={{ color: ink }}>ResQ</span>
      <span style={{ color: "var(--crimson)" }}>Net</span>
    </span>
  );
}

/**
 * Map-marker plate.
 *
 * A square rather than a teardrop pin: the marker's anchor is its centre,
 * which is honest about the fact that these sit on coordinates.
 */
export function ResQMarkerPlate({ size = 26 }: { size?: number }) {
  return (
    <span
      className="flex items-center justify-center rounded-[3px] border"
      style={{
        width: size,
        height: size,
        background: "var(--navy-800)",
        borderColor: "var(--navy-500)",
      }}
    >
      <ResQMark className="size-[70%]" tone="dark" />
    </span>
  );
}
