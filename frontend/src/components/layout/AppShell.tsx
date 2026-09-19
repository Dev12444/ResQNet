"use client";

/**
 * The shared shell: identity, navigation, connection state, and a 112 action
 * that is reachable from every screen without scrolling.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_LINKS } from "@/lib/constants";
import { Call112Button, EmergencyDirectory } from "./EmergencyContacts";
import { ConnectionIndicator, useConnectionStatus } from "./ConnectionBar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const connection = useConnectionStatus();

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      <header className="border-b-2 border-[var(--border-strong)] bg-[var(--surface)]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
          <Link href="/" className="flex min-w-0 items-baseline gap-2 no-underline">
            <span className="text-base font-bold tracking-tight text-[var(--critical)]">
              RESQNET
            </span>
            <span className="hidden truncate text-xs uppercase tracking-wide text-[var(--muted)] sm:inline">
              Gujarat Emergency Command Center
            </span>
          </Link>

          <ConnectionIndicator state={connection} className="order-3 w-full sm:order-none sm:w-auto" />

          <div className="ml-auto flex items-center gap-2">
            <Call112Button />
          </div>
        </div>

        <nav aria-label="Primary" className="border-t border-[var(--border)]">
          <ul className="flex overflow-x-auto">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <li key={link.href} className="shrink-0">
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`block border-b-2 px-3 py-2 text-[13px] font-semibold uppercase tracking-wide no-underline ${
                      active
                        ? "border-[var(--critical)] text-[var(--foreground)]"
                        : "border-transparent text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="mt-auto border-t border-[var(--border)] bg-[var(--surface)] px-3 py-4">
        <details>
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide">
            All emergency numbers
          </summary>
          <div className="mt-3 max-w-3xl">
            <EmergencyDirectory />
          </div>
        </details>
        <p className="mt-3 text-xs text-[var(--muted)]">
          ResQNet coordinates emergency response. It does not replace calling 112. AI output on
          this system is advisory — operational decisions are made by people.
        </p>
      </footer>
    </>
  );
}
