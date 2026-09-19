/**
 * The incoming-alert bus.
 *
 * One place where a *new* emergency — raised by a citizen through the report
 * form, or issued by the control room through the Flash Alert composer — is
 * recorded so that the Alert Flash banner can raise it on whatever page is
 * open, instead of the report disappearing into a receipt screen.
 *
 * ## What this actually reaches, stated plainly
 *
 * `localStorage` plus a `storage` event. That means:
 *
 *   - every route of this app, without a page reload;
 *   - every tab of this browser, on this device;
 *   - and nothing else.
 *
 * It is **not** a broadcast. It does not reach other people's phones, it does
 * not send SMS, and it does not touch a cell-broadcast gateway. Every surface
 * that renders one of these says so on its face. A real deployment would swap
 * this module for a WebSocket or SSE subscription to the incident stream and
 * hand approved warnings to NDMA's CAP gateway; the component contract would
 * not change, which is why the bus is isolated here.
 *
 * Entries expire after two hours so a report raised during a demo does not
 * haunt the page for the rest of the day.
 */

export type IncomingKind = "citizen" | "official";

export interface IncomingAlert {
  id: string;
  /** Who raised it — this drives the banner's colour and its wording. */
  kind: IncomingKind;
  severity: "critical" | "high" | "moderate";
  headline: string;
  detail: string;
  district: string | null;
  /** Attributed on the banner. Never invented. */
  source: string;
  /** ISO timestamp. */
  at: string;
  /** Where "view details" should go. */
  href: string;
}

const KEY = "resqnet.incoming";
const EVENT = "resqnet:incoming";
const MAX = 6;
const TTL_MS = 2 * 60 * 60 * 1000;

function fresh(list: IncomingAlert[]): IncomingAlert[] {
  const cutoff = Date.now() - TTL_MS;
  return list.filter((a) => {
    const t = Date.parse(a.at);
    return Number.isFinite(t) && t >= cutoff;
  });
}

/** Everything raised in the last two hours, newest first. */
export function readIncoming(): IncomingAlert[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    // Shape-filter: this is storage the user can edit, and a malformed entry
    // must not be able to blank the banner for everything behind it.
    const list = parsed.filter(
      (a): a is IncomingAlert =>
        !!a &&
        typeof a === "object" &&
        typeof (a as IncomingAlert).id === "string" &&
        typeof (a as IncomingAlert).headline === "string" &&
        typeof (a as IncomingAlert).at === "string",
    );
    return fresh(list);
  } catch {
    return [];
  }
}

/**
 * Record a new emergency and wake every listener, in this tab and in the
 * others. Returns the stored entry.
 */
export function publishIncoming(
  input: Omit<IncomingAlert, "id" | "at"> & { id?: string; at?: string },
): IncomingAlert {
  const entry: IncomingAlert = {
    ...input,
    id: input.id ?? `IN-${Date.now().toString(36).toUpperCase()}`,
    at: input.at ?? new Date().toISOString(),
  };
  if (typeof window === "undefined") return entry;
  try {
    const next = [entry, ...readIncoming().filter((a) => a.id !== entry.id)].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage blocked — the alert still reaches this tab through the event */
  }
  // `storage` only fires in *other* tabs, so this tab is notified directly.
  window.dispatchEvent(new CustomEvent<IncomingAlert>(EVENT, { detail: entry }));
  return entry;
}

/** Drop everything. Used by the banner's "clear" affordance. */
export function clearIncoming(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Subscribe to same-tab publishes and to other tabs on this device. */
export function subscribeIncoming(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === KEY) onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}
