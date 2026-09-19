import Link from "next/link";
import type { Route } from "next";
import {
  EmergencyDirectory,
  Call112Button,
} from "@/components/layout/EmergencyContacts";

/**
 * Operational entry point. Four destinations, the emergency numbers, and
 * nothing that pretends to be a live figure — the numbers live on the screens
 * that actually load them.
 */

const ENTRY_POINTS: {
  href: Route;
  title: string;
  who: string;
  detail: string;
  accent: string;
}[] = [
  {
    href: "/report",
    title: "REPORT EMERGENCY",
    who: "Citizens",
    detail:
      "Report in Gujarati, Hindi or English. Location, photo and voice are optional — a description alone is enough.",
    accent: "var(--critical)",
  },
  {
    href: "/dashboard",
    title: "OPEN CONTROL ROOM",
    who: "Dispatchers",
    detail:
      "Live incident queue, map and dispatch. Every dispatch decision is made by an operator, not the system.",
    accent: "var(--info)",
  },
  {
    href: "/field",
    title: "FIELD RESPONDER",
    who: "Field teams",
    detail:
      "Your assignment, hazards and advisory actions. Acknowledge, update status and correct what the report got wrong.",
    accent: "var(--high)",
  },
  {
    href: "/analytics",
    title: "ANALYTICS",
    who: "Command staff",
    detail:
      "Response times, verification mix, resource shortages and reporting hotspots across districts.",
    accent: "var(--ok)",
  },
];

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-6">
      <section className="border-2 border-[var(--border-strong)] bg-[var(--surface)]">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-[var(--border-strong)] px-4 py-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[var(--critical)]">
              RESQNET
            </h1>
            <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
              Gujarat Emergency Command Center
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-right">
              <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Emergency
              </span>
              <span className="mono block text-3xl font-bold leading-none text-[var(--critical)]">
                112
              </span>
            </span>
            <Call112Button size="lg" />
          </div>
        </div>

        <p className="px-4 py-3 text-sm text-[var(--muted)]">
          Citizen and 112 reports, sensors, field teams and hospitals in one operational
          picture: report, triage, corroborate, prioritise, dispatch, respond, verify, analyse.
          AI assists with classification and corroboration — people make the operational
          decisions.
        </p>
      </section>

      <nav aria-label="Entry points" className="mt-4 grid gap-px bg-[var(--border)] sm:grid-cols-2">
        {ENTRY_POINTS.map((entry) => (
          <Link
            key={entry.href}
            href={entry.href}
            className="group flex flex-col border-l-4 bg-[var(--surface)] px-4 py-4 no-underline hover:bg-[var(--surface-2)]"
            style={{ borderLeftColor: entry.accent }}
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {entry.who}
            </span>
            <span className="mt-1 text-lg font-bold tracking-tight group-hover:underline">
              {entry.title}
            </span>
            <span className="mt-1.5 text-sm text-[var(--muted)]">{entry.detail}</span>
          </Link>
        ))}
      </nav>

      <section className="mt-6">
        <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide">
          Emergency numbers
        </h2>
        <EmergencyDirectory />
      </section>
    </div>
  );
}
