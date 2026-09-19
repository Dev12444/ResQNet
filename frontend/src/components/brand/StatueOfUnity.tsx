/**
 * Statue of Unity — the line drawing at the foot of the command rail.
 *
 * Traced from the supplied reference rather than invented, and the reference
 * is a *scene*, not a figure on a pedestal:
 *
 *   - Sardar Patel standing, in the long coat with the khes drawn diagonally
 *     across it, arms hanging free of the body with the hands showing at the
 *     coat's edge;
 *   - the viewing-gallery base under him, drawn in slight perspective;
 *   - the approach ramp running off to the left;
 *   - the temple group on the bank beside it, two shikharas and their halls;
 *   - one ground line under all of it.
 *
 * Earlier passes drew a symmetrical robed column centred in the frame. That is
 * what was wrong with them. The reference sits to the right of centre with the
 * temples in the space at lower left, and the figure's widest point is the
 * flare of the coat at mid-body — not the shoulders, which are narrow. Get
 * that sequence wrong (narrow shoulders, wide coat, narrow legs) and it reads
 * as an obelisk no matter how much detail goes on top of it.
 *
 * Every form is a stroke of near-uniform weight. Nothing is filled, nothing is
 * shaded, and there is no dot pattern: the reference is pure outline and holds
 * an even line all the way to the ground, so the fade masks here only soften
 * the very edges of the canvas — they are not there to make it recede.
 *
 * The ink is a desaturated blue-grey, a cool near-white one family with the
 * navy behind it. A warm or saturated ink reads as a graphic pasted onto the
 * sidebar no matter how faint it is.
 *
 * Deliberately not: a photograph, a 3D render, a solid silhouette, a temple on
 * its own, a cartoon, or clip-art. There is no raster asset and no background
 * box; this is SVG that inherits the navy behind it.
 */

/** Desaturated blue-grey. Cool enough to belong to the navy it sits on. */
const INK = "#c3d6e6";

export function StatueOfUnity({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 158 226"
      className={className}
      role="img"
      aria-label="Statue of Unity above its base and the temples on the Narmada, line drawing"
      focusable="false"
    >
      <defs>
        {/* Vertical dissolve: even through almost the whole drawing, easing
            only in the last few percent so there is no hard bottom edge. */}
        <linearGradient id="su-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.6" />
          <stop offset="0.06" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.9" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.3" />
        </linearGradient>

        {/* Lateral dissolve, so the temples and the ramp thin out at the left
            edge instead of stopping against nothing. */}
        <linearGradient id="su-fade-x" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="1" />
          <stop offset="0.06" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.95" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#000" stopOpacity="1" />
        </linearGradient>

        <mask id="su-mask">
          <rect width="158" height="226" fill="url(#su-fade)" />
          <rect
            width="158"
            height="226"
            fill="url(#su-fade-x)"
            style={{ mixBlendMode: "multiply" }}
          />
        </mask>
      </defs>

      <g mask="url(#su-mask)">
        {/* ================= The figure ================= */}
        <g
          fill="none"
          stroke={INK}
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeOpacity="0.82"
        >
          {/* the lightning arrester at the crown, which the reference shows */}
          <path d="M115 5.6 V10.2" />

          {/* Head: bald, slightly domed, on a short neck. */}
          <ellipse cx="115" cy="20.8" rx="8.5" ry="10.4" />
          <path d="M108.6 14 Q115 10.4 121.4 14" />
          {/* ears */}
          <path d="M106.6 19 Q105.2 21 106.8 23" />
          <path d="M123.4 19 Q124.8 21 123.2 23" />
          {/* neck */}
          <path d="M110.4 30 Q110 34 109.4 36.4" />
          <path d="M119.6 30 Q120 34 120.6 36.4" />
        </g>

        {/* eyes — two marks, which is all the face this size can carry */}
        {/* Eye marks only. Anything more becomes a face, and a face on a
            17-pixel head becomes a cartoon. */}
        <g fill={INK} fillOpacity="0.62" stroke="none">
          <circle cx="111.8" cy="19.4" r="0.7" />
          <circle cx="118.2" cy="19.4" r="0.7" />
        </g>

        <g
          fill="none"
          stroke={INK}
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeOpacity="0.82"
        >
          {/* Shoulders — narrow, and sloping under the weight of the coat. */}
          <path d="M98.8 39 Q105 35.4 110.4 34.2 Q115 33.7 119.6 34.2 Q125 35.4 140 39" />

          {/* The coat. This is the figure's widest point, at mid-body, and it
              comes back in at the hem — the reason the silhouette reads as a
              man in a heavy coat and not as a column. */}
          <path d="M98.8 39 Q89.6 56 87.2 80 Q86.4 97 95 114" />
          <path d="M140 39 Q149.2 56 150 80 Q150 97 143.6 114" />
          <path d="M95 114 Q119 117.6 143.6 114" />
          <path d="M96 118.4 Q119 121.6 142.6 118.4" />

          {/* Arms inside the coat, and the hands showing at its edge. */}
          <path d="M102.4 43.6 Q96.4 64 94.6 90 Q94.6 100 97.6 108.6" />
          <path d="M136.4 43.6 Q142.4 64 144.2 90 Q144.2 100 141.2 108.6" />
          <path d="M92.8 103 Q88.8 105.4 89.6 110 Q92 112.4 95.4 110.4 Q96.8 106.4 94.8 102.6" />
          <path d="M146 103 Q150 105.4 149.2 110 Q146.8 112.4 143.4 110.4 Q142 106.4 144 102.6" />
        </g>

        {/* The khes, drawn across the coat, and the coat's own folds. */}
        <g
          fill="none"
          stroke={INK}
          strokeWidth="0.7"
          strokeLinecap="round"
          strokeOpacity="0.5"
        >
          <path d="M106.6 41.4 Q116.4 58 130 76.4 Q136 86.4 137.6 98" />
          <path d="M112.6 39.6 Q122.4 55.6 135.2 72" />
          <path d="M104.4 52 Q102.6 78 103.6 112" />
          <path d="M134 52 Q135.8 78 134.8 112" />
        </g>

        {/* ================= Dhoti and legs ================= */}
        <g
          fill="none"
          stroke={INK}
          strokeWidth="0.95"
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeOpacity="0.78"
        >
          <path d="M100 119.6 Q98.6 141 99.2 163.6" />
          <path d="M139 119.6 Q140.4 141 139.8 163.6" />
          {/* the gap between the legs — the lower half's strongest cue */}
          <path d="M112.6 121.6 V163.6" />
          <path d="M126 121.6 V163.6" />
          {/* feet */}
          <path d="M97 163.6 H117.6 V170 H97 Z" />
          <path d="M121.8 163.6 H142 V170 H121.8 Z" />
        </g>
        <g
          fill="none"
          stroke={INK}
          strokeWidth="0.6"
          strokeOpacity="0.36"
          strokeLinecap="round"
        >
          <path d="M103.6 126 L111.6 150 M132.6 126 L127 150" />
        </g>

        {/* ================= The base ================= */}
        <g
          fill="none"
          stroke={INK}
          strokeWidth="0.9"
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeOpacity="0.58"
        >
          {/* the statue's own plinth */}
          <path d="M90 170 H149 L152 177.6 H87 Z" />
          {/* the viewing-gallery block, in slight perspective: a visible top
              face, then the elevation under it */}
          <path d="M76 181 H138 L148 189 H66 Z" />
          <path d="M66 189 L62 207.6 H152 L148 189" />
          <path d="M63.6 197.6 H150.4" />
        </g>
        {/* piers on the lower storey */}
        <g stroke={INK} strokeWidth="0.55" strokeOpacity="0.3" strokeLinecap="round">
          <path d="M76 197.6 L75.4 207.6 M89 197.6 L88.6 207.6 M102 197.6 L102 207.6 M115 197.6 L115.4 207.6 M128 197.6 L128.8 207.6 M141 197.6 L142.2 207.6" />
        </g>

        {/* The approach ramp, running off to the left. */}
        <g
          fill="none"
          stroke={INK}
          strokeWidth="0.75"
          strokeLinecap="round"
          strokeOpacity="0.44"
        >
          <path d="M66 193.6 L44 201.6" />
          <path d="M67 199.4 L46 206.8" />
          <path d="M60 195.8 L61 202 M54 198 L55 204 M48 200.2 L49 205.6" />
        </g>

        {/* ================= Temples on the bank ================= */}
        <g
          fill="none"
          stroke={INK}
          strokeWidth="0.8"
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeOpacity="0.46"
        >
          {/* two shikharas with their finials */}
          <path d="M10 207.6 V187 Q10 178.6 17 173.6 Q24 178.6 24 187 V207.6" />
          <path d="M17 173.6 V168.4" />
          <path d="M13.6 182 H20.4" />
          <path d="M26 207.6 V190 Q26 182.6 32 178.4 Q38 182.6 38 190 V207.6" />
          <path d="M32 178.4 V174" />
          {/* the halls in front of them */}
          <path d="M2 207.6 V197 H12 V207.6" />
          <path d="M0.6 197 L7 191.4 L13.4 197" />
          <path d="M24 207.6 V199.6 H40 V207.6" />
        </g>

        {/* Ground. One line, so the whole scene is standing on something. */}
        <g stroke={INK} strokeWidth="0.65" strokeOpacity="0.26" strokeLinecap="round">
          <path d="M2 210.6 H156" />
        </g>
      </g>
    </svg>
  );
}
