/**
 * Emergency calling surfaces.
 *
 * 112 is the unified emergency number and always leads. The other lines are
 * specialised and are presented as such — none of them is offered as a
 * substitute for 112, and ResQNet never presents itself as a replacement for
 * calling emergency services.
 */

import { EMERGENCY_NUMBERS, PRIMARY_EMERGENCY_NUMBER } from "@/lib/constants";

/**
 * The primary action. A real `tel:` link, so it dials on a phone and is still
 * a readable number on desktop.
 */
export function Call112Button({
  size = "md",
  className = "",
  label = "CALL 112",
}: {
  size?: "md" | "lg";
  className?: string;
  label?: string;
}) {
  const sizing =
    size === "lg"
      ? "min-h-14 px-5 text-lg"
      : "min-h-10 px-3 text-sm";
  return (
    <a
      href={`tel:${PRIMARY_EMERGENCY_NUMBER}`}
      className={`inline-flex items-center justify-center gap-2 border-2 border-[#7f1d1d] bg-[var(--critical)] font-bold uppercase tracking-wide text-white hover:bg-[#b91c1c] ${sizing} ${className}`}
    >
      <PhoneGlyph />
      {label}
    </a>
  );
}

function PhoneGlyph() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-4 shrink-0" fill="currentColor">
      <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.2.4 2.4.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2Z" />
    </svg>
  );
}

/**
 * The advisory that must accompany citizen reporting: ResQNet coordinates,
 * it does not replace an emergency call.
 */
export function EmergencyCallBanner({ text }: { text: string }) {
  return (
    <div
      className="flex flex-wrap items-center gap-3 border-l-4 px-3 py-2.5"
      style={{ borderColor: "var(--critical)", background: "var(--critical-bg)" }}
    >
      <p className="min-w-0 flex-1 text-sm font-medium text-[var(--foreground)]">{text}</p>
      <Call112Button />
    </div>
  );
}

/** Full directory. 112 is visually and structurally separated from the rest. */
export function EmergencyDirectory({ compact = false }: { compact?: boolean }) {
  const [primary, ...rest] = EMERGENCY_NUMBERS;
  return (
    <div>
      <a
        href={`tel:${primary.number}`}
        className="flex items-center justify-between gap-3 border-2 border-[#7f1d1d] bg-[var(--critical)] px-3 py-2.5 text-white hover:bg-[#b91c1c]"
      >
        <span>
          <span className="mono block text-2xl font-bold leading-none">{primary.number}</span>
          <span className="mt-1 block text-xs uppercase tracking-wide opacity-90">
            {primary.label}
          </span>
        </span>
        <PhoneGlyph />
      </a>
      <p className="px-1 py-2 text-xs text-[var(--muted)]">
        112 reaches all services. The lines below are specialised — use them only when you
        already know which service you need.
      </p>
      <ul
        className={`grid gap-px border border-[var(--border)] bg-[var(--border)] ${
          compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"
        }`}
      >
        {rest.map((entry) => (
          <li key={entry.number} className="bg-[var(--surface)]">
            <a
              href={`tel:${entry.number}`}
              className="flex min-h-12 flex-col justify-center px-2.5 py-2 hover:bg-[var(--surface-2)]"
            >
              <span className="mono text-base font-semibold leading-none">{entry.number}</span>
              <span className="mt-1 text-xs leading-tight text-[var(--muted)]">
                {entry.label}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
