/**
 * Shared chart tokens.
 *
 * The two-series pair is FLOOD CYAN + DEEP AMBER, drawn from the Emergency
 * Terrain palette and re-checked after the repaint. Measured separation
 * (CIELAB ΔE against Viénot/Brettel dichromacy simulation):
 *
 *   normal 86.2 · protanopia 74.7 · deuteranopia 64.0 · tritanopia 63.6
 *
 * and both sit at or above 3:1 against paper and bone, which is the WCAG
 * floor for graphical objects. The obvious in-palette pair — cyan + command
 * teal — was rejected: it measured ΔE 21.2 under deuteranopia and 16.9 under
 * tritanopia, i.e. two lines a red-green colour-blind operator could not
 * reliably tell apart. Brand coherence is not worth an unreadable chart.
 *
 * Deep amber (#b8841f) is intentionally darker and browner than warning amber
 * (#e5a72e) so a neutral second series never reads as an alert.
 *
 * Severity is the exception. Its colours are fixed by `API_CONTRACT.md` and
 * FE1's map uses the same scale, so they are not ours to re-pick. Wherever
 * severity is drawn, colour is therefore REDUNDANT: severity sits on an axis
 * (position) and every mark carries a "SEV n" text label. Colour never
 * carries the meaning on its own.
 */

/** Single hue for magnitude-only charts (counts by category). */
export const HUE_PRIMARY = "#278ba8";

/** Validated two-series pair. Series order is fixed and never cycled. */
export const SERIES_PAIR = ["#278ba8", "#b8841f"] as const;

export const AXIS_COLOR = "var(--border-strong)";
export const GRID_COLOR = "var(--border)";
export const TEXT_COLOR = "var(--muted)";

/** Recessive axes: thin, muted, tabular numerals. */
export const axisProps = {
  stroke: AXIS_COLOR,
  tick: { fill: "var(--muted)", fontSize: 11 },
  tickLine: false,
} as const;

export const gridProps = {
  stroke: GRID_COLOR,
  strokeDasharray: "2 4",
  vertical: false,
} as const;

/** Tooltip chrome matching the app surfaces rather than Recharts' default. */
export const tooltipProps = {
  contentStyle: {
    background: "var(--surface)",
    border: "1px solid var(--border-strong)",
    borderRadius: 0,
    fontSize: 12,
    padding: "6px 8px",
    color: "var(--foreground)",
  },
  labelStyle: { color: "var(--foreground)", fontWeight: 600 },
  itemStyle: { color: "var(--foreground)" },
  cursor: { fill: "var(--surface-2)" },
} as const;

/** Seconds → a compact "4m 12s" / "45s" label for response-time axes. */
export function formatDuration(sec: number | null): string {
  if (sec === null) return "—";
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}
