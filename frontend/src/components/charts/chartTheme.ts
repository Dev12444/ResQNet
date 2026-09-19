/**
 * Shared chart tokens.
 *
 * The two-series pair below was validated with the dataviz palette checker in
 * BOTH light and dark mode — lightness band, chroma floor, CVD separation
 * (deuteranopia/protanopia/tritanopia), normal-vision floor and surface
 * contrast all pass, so one pair serves both themes and no theme-flip is
 * needed.
 *
 * Severity is the exception. Its colours are fixed by `API_CONTRACT.md` and
 * FE1's map uses the same scale, so they are not ours to re-pick — and as a
 * categorical ramp they fail CVD separation badly (green↔yellow ΔE 4.2 under
 * protanopia). Wherever severity is drawn, colour is therefore REDUNDANT:
 * severity sits on an axis (position) and every mark carries a "SEV n" text
 * label. Colour never carries the meaning on its own.
 */

/** Single hue for magnitude-only charts (counts by category). */
export const HUE_PRIMARY = "#3b82f6";

/** Validated two-series pair. Series order is fixed and never cycled. */
export const SERIES_PAIR = ["#3b82f6", "#0d9488"] as const;

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
