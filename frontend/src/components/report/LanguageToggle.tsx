"use client";

/**
 * Language switch for the citizen form.
 *
 * This changes the INTERFACE language only. What the citizen types is stored
 * and displayed exactly as they wrote it — switching language never rewrites
 * or translates their report.
 */

import { LANGS } from "@/lib/constants";
import type { Lang } from "@/types";

export function LanguageToggle({
  value,
  onChange,
  label,
}: {
  value: Lang;
  onChange: (lang: Lang) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex">
      {LANGS.map((lang) => {
        const active = lang.code === value;
        return (
          <button
            key={lang.code}
            type="button"
            onClick={() => onChange(lang.code)}
            aria-pressed={active}
            lang={lang.code}
            className={`min-h-11 flex-1 border px-3 py-2 text-sm font-semibold ${
              active
                ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--surface)]"
                : "border-[var(--border-strong)] bg-[var(--surface)] hover:bg-[var(--surface-2)]"
            } ${lang.code === "en" ? "" : "-ml-px"}`}
          >
            {lang.label}
          </button>
        );
      })}
    </div>
  );
}
