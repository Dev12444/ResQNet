/**
 * Small display primitives shared across the FE2 surfaces.
 *
 * Every status indicator pairs colour with a text label — colour alone is not
 * a readable signal for colour-blind operators or on a washed-out projector.
 */

import type { ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Badge                                                               */
/* ------------------------------------------------------------------ */

export function Badge({
  label,
  color,
  variant = "solid",
  title,
}: {
  label: string;
  color: string;
  variant?: "solid" | "outline" | "tint";
  title?: string;
}) {
  const base =
    "inline-flex items-center gap-1.5 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap";
  if (variant === "solid") {
    return (
      <span
        className={base}
        style={{ background: color, color: readableOn(color) }}
        title={title}
      >
        {label}
      </span>
    );
  }
  if (variant === "tint") {
    return (
      <span
        className={base}
        style={{ background: `${color}1a`, color, border: `1px solid ${color}55` }}
        title={title}
      >
        {label}
      </span>
    );
  }
  return (
    <span className={base} style={{ color, border: `1px solid ${color}` }} title={title}>
      {label}
    </span>
  );
}

/** A dot plus its label, for compact rows where a full badge is too heavy. */
export function StatusDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span
        aria-hidden
        className="inline-block size-2 shrink-0 rounded-full"
        style={{ background: color }}
      />
      <span>{label}</span>
    </span>
  );
}

/** Pick black or white text for a background colour, by relative luminance. */
export function readableOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#ffffff";
  const int = parseInt(m[1], 16);
  const [r, g, b] = [(int >> 16) & 255, (int >> 8) & 255, int & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.45 ? "#18181b" : "#ffffff";
}

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`border border-[var(--border)] bg-[var(--surface)] ${className}`}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
          <div className="min-w-0">
            {title && (
              <h2 className="text-[13px] font-semibold uppercase tracking-wide">{title}</h2>
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs text-[var(--muted)]">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/** Label/value pair used throughout the incident and unit detail views. */
export function DataRow({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1">
      <dt className="w-32 shrink-0 text-xs uppercase tracking-wide text-[var(--muted)]">
        {label}
      </dt>
      <dd className={`min-w-0 flex-1 text-sm ${mono ? "mono" : ""}`}>{children}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page states                                                         */
/* ------------------------------------------------------------------ */

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 px-3 py-6 text-sm text-[var(--muted)]"
    >
      <span
        aria-hidden
        className="inline-block size-3 animate-spin rounded-full border-2 border-[var(--border-strong)] border-t-transparent"
      />
      {label}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="px-3 py-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

export function ErrorState({
  title,
  detail,
  onRetry,
}: {
  title: string;
  detail?: string | null;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="border-l-4 px-3 py-3"
      style={{ borderColor: "var(--critical)", background: "var(--critical-bg)" }}
    >
      <p className="text-sm font-semibold">{title}</p>
      {detail && <p className="mt-1 text-xs text-[var(--muted)]">{detail}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 border border-[var(--border-strong)] bg-[var(--surface)] px-2 py-1 text-xs font-semibold hover:bg-[var(--surface-2)]"
        >
          Retry
        </button>
      )}
    </div>
  );
}

/**
 * Shown when a screen rendered, but one of its feeds did not. Better than a
 * blank panel: the operator learns exactly which part is missing.
 */
export function PartialDataNote({ what }: { what: string }) {
  return (
    <p
      className="border-l-4 px-3 py-2 text-xs"
      style={{ borderColor: "var(--high)", background: "var(--high-bg)" }}
    >
      <strong className="font-semibold">Partial data.</strong> {what}
    </p>
  );
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
