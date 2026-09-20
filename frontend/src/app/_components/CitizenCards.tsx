"use client";

/**
 * The two citizen-preference cards on the right rail.
 *
 * Both deal with consent, so both are written to be honest about what they do:
 * the toggle changes a real setting that the I'm Safe workflow reads, and the
 * permission button calls the real browser geolocation API and reports exactly
 * what the browser answered. Neither ever claims a success it did not get.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  Check,
  Info,
  LocateFixed,
  Pencil,
  ShieldAlert,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import type { Lang } from "@/types";
import { isSecureContext } from "@/lib/secureContext";

const CLOSE_ONES_KEY = "resqnet.closeOnes";
const CONTACTS_KEY = "resqnet.closeOnes.contacts";

const ADD_CLOSE_ONE_EVENT = "resqnet:add-close-one";

/**
 * Open the add-a-contact form on this page's Close Ones card.
 *
 * The I'm Safe dialog can only tell someone with an empty list to go and add
 * one; on a phone the card that does it is a screen and a half below the fold,
 * under the map, so "add them on the home screen" was a dead end. An event
 * rather than lifted state: the two live in unrelated parts of the tree, and
 * the dialog has to unmount before the scroll can land anywhere useful.
 */
export function openAddCloseOne(): void {
  window.dispatchEvent(new Event(ADD_CLOSE_ONE_EVENT));
}

/** How a contact has asked to hear from the platform. */
export type ContactChannel = "sms" | "call" | "whatsapp";

export type CloseOne = {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  channel: ContactChannel;
};

const CHANNEL_LABEL: Record<ContactChannel, string> = {
  sms: "SMS",
  call: "Voice call",
  whatsapp: "WhatsApp",
};

const RELATIONSHIPS = [
  "Spouse",
  "Parent",
  "Child",
  "Sibling",
  "Relative",
  "Neighbour",
  "Friend",
  "Carer",
];

/**
 * Whether "I'm Safe" should also notify saved contacts.
 *
 * Exported so the I'm Safe dialog reads the same preference rather than
 * keeping a second copy of it — one switch, one meaning.
 */
export function readCloseOnes(): boolean {
  try {
    return window.localStorage.getItem(CLOSE_ONES_KEY) !== "0";
  } catch {
    return true;
  }
}

/** The saved contact list. Same storage the card writes, same shape. */
export function readCloseOneContacts(): CloseOne[] {
  try {
    const raw = window.localStorage.getItem(CONTACTS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Anything hand-edited, or written by an older build, is discarded rather
    // than rendered half-formed.
    return parsed.filter(
      (c): c is CloseOne =>
        !!c &&
        typeof c === "object" &&
        typeof (c as CloseOne).id === "string" &&
        typeof (c as CloseOne).name === "string" &&
        typeof (c as CloseOne).phone === "string",
    );
  } catch {
    return [];
  }
}

function writeCloseOneContacts(list: CloseOne[]): void {
  try {
    window.localStorage.setItem(CONTACTS_KEY, JSON.stringify(list));
  } catch {
    /* storage blocked — the list just will not persist */
  }
}

/** Indian mobile numbers, with or without +91 and separators. */
function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/[^0-9]/g, "");
  const local =
    digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  if (local.length !== 10 || !/^[6-9]/.test(local)) return null;
  return local;
}

const EMPTY_DRAFT: Omit<CloseOne, "id"> = {
  name: "",
  relationship: RELATIONSHIPS[0],
  phone: "",
  channel: "sms",
};

/**
 * Close Ones — the switch, and the contacts the switch acts on.
 *
 * A toggle with nothing behind it is a dead control, so the card manages the
 * list as well: add, edit, remove, each contact carrying the channel they
 * asked for. The list lives in this browser and the card says so; nothing here
 * claims a message reached a phone.
 */
export function CloseOnesCard({ lang }: { lang: Lang }) {
  const [on, setOn] = useState(true);
  const [contacts, setContacts] = useState<CloseOne[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // Read after mount: touching storage during render would desync the
  // server-rendered markup.
  useEffect(() => {
    const t = setTimeout(() => {
      setOn(readCloseOnes());
      setContacts(readCloseOneContacts());
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const toggle = useCallback(() => {
    setOn((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(CLOSE_ONES_KEY, next ? "1" : "0");
      } catch {
        /* storage blocked — the preference just will not persist */
      }
      return next;
    });
  }, []);

  const commit = useCallback((list: CloseOne[]) => {
    setContacts(list);
    writeCloseOneContacts(list);
  }, []);

  const startAdd = useCallback(() => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
    setFormOpen(true);
  }, []);

  // Sent here from the I'm Safe dialog, which has nowhere of its own to add a
  // contact. Bring the card into view as well as opening the form: arriving at
  // a focused field somewhere off-screen is its own kind of lost.
  useEffect(() => {
    const open = () => {
      startAdd();
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    window.addEventListener(ADD_CLOSE_ONE_EVENT, open);
    return () => window.removeEventListener(ADD_CLOSE_ONE_EVENT, open);
  }, [startAdd]);

  // The form is the point of the trip, so put the cursor in it. Deferred until
  // after the form has rendered, and only for a fresh add — grabbing focus
  // while someone is part-way through editing an existing contact would be
  // taking the keyboard off them.
  useEffect(() => {
    if (!formOpen || editingId) return;
    const t = setTimeout(() => nameRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [formOpen, editingId]);

  const startEdit = (c: CloseOne) => {
    setEditingId(c.id);
    setDraft({
      name: c.name,
      relationship: c.relationship,
      phone: c.phone,
      channel: c.channel,
    });
    setError(null);
    setFormOpen(true);
  };

  const remove = (id: string) => {
    commit(contacts.filter((c) => c.id !== id));
    if (editingId === id) {
      setFormOpen(false);
      setEditingId(null);
    }
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    const name = draft.name.trim();
    if (!name) {
      setError("Enter a name.");
      return;
    }
    const phone = normalisePhone(draft.phone);
    if (!phone) {
      setError("Enter a 10-digit Indian mobile number.");
      return;
    }
    if (contacts.some((c) => c.phone === phone && c.id !== editingId)) {
      setError("That number is already saved.");
      return;
    }

    const next: CloseOne = {
      ...draft,
      name,
      phone,
      id: editingId ?? crypto.randomUUID(),
    };
    commit(
      editingId
        ? contacts.map((c) => (c.id === editingId ? next : c))
        : [...contacts, next],
    );
    setFormOpen(false);
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
  };

  return (
    <section className="panel" ref={sectionRef} id="close-ones">
      <div className="panel-head">
        <Users className="size-3.5 shrink-0 text-[var(--navy-600)]" aria-hidden />
        <h2 className="cmd text-[11.5px]">Close Ones Notification</h2>
        <span className="mono ml-auto text-[10px] text-[var(--muted)]">
          {contacts.length}
        </span>
      </div>

      <div className="flex items-start gap-2.5 px-2.5 py-2.5">
        <button
          type="button"
          role="switch"
          aria-checked={on}
          onClick={toggle}
          aria-label="Notify close ones when I check in as safe"
          className={`relative mt-0.5 h-[22px] w-[42px] shrink-0 rounded-full transition-colors ${
            on ? "bg-[var(--green)]" : "bg-[var(--border-strong)]"
          }`}
        >
          <span
            aria-hidden
            className={`absolute top-[3px] size-4 rounded-full bg-white shadow transition-all ${
              on ? "left-[23px]" : "left-[3px]"
            }`}
          />
        </button>
        <p className="text-[11.5px] leading-snug text-[var(--muted)]">
          {on ? (
            <>
              When you check in as safe, the people below hear about it too.
            </>
          ) : (
            <>
              Right now only the control room sees your check-in. Turn this on
              to let your people know as well.
            </>
          )}
        </p>
      </div>

      {/* The list the switch acts on */}
      <ul className="border-t border-[var(--hairline)]">
        {contacts.length === 0 && !formOpen && (
          <li className="px-2.5 py-2 text-[11px] leading-snug text-[var(--muted)]">
            Nobody added yet. Start with whoever should hear from you first.
          </li>
        )}
        {contacts.map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-2 border-b border-[var(--hairline)] px-2.5 py-1.5 last:border-b-0"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-semibold leading-tight">
                {c.name}
                <span className="font-normal text-[var(--muted)]">
                  {" "}
                  &middot; {c.relationship}
                </span>
              </span>
              <span className="telemetry">
                +91 {c.phone} &middot; {CHANNEL_LABEL[c.channel]}
              </span>
            </span>
            <button
              type="button"
              onClick={() => startEdit(c)}
              aria-label={`Edit ${c.name}`}
              className="rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--navy-700)]"
            >
              <Pencil className="size-3.5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => remove(c.id)}
              aria-label={`Remove ${c.name}`}
              className="rounded p-1 text-[var(--muted)] hover:bg-[var(--critical-bg)] hover:text-[var(--crimson)]"
            >
              <Trash2 className="size-3.5" aria-hidden />
            </button>
          </li>
        ))}
      </ul>

      {formOpen ? (
        <form
          onSubmit={save}
          className="grid gap-1.5 border-t border-[var(--hairline)] bg-[var(--surface-2)] p-2.5"
        >
          <label className="block">
            <span className="eyebrow text-[var(--muted)]">Name</span>
            <input
              ref={nameRef}
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              autoComplete="name"
              className="mt-0.5 h-8 w-full rounded-[4px] border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-[12px]"
            />
          </label>

          <div className="grid grid-cols-2 gap-1.5">
            <label className="block">
              <span className="eyebrow text-[var(--muted)]">Relationship</span>
              <select
                value={draft.relationship}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, relationship: e.target.value }))
                }
                className="mt-0.5 h-8 w-full rounded-[4px] border border-[var(--border-strong)] bg-[var(--surface)] px-1.5 text-[12px]"
              >
                {RELATIONSHIPS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="eyebrow text-[var(--muted)]">Notify by</span>
              <select
                value={draft.channel}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    channel: e.target.value as ContactChannel,
                  }))
                }
                className="mt-0.5 h-8 w-full rounded-[4px] border border-[var(--border-strong)] bg-[var(--surface)] px-1.5 text-[12px]"
              >
                {(Object.keys(CHANNEL_LABEL) as ContactChannel[]).map((ch) => (
                  <option key={ch} value={ch}>
                    {CHANNEL_LABEL[ch]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="eyebrow text-[var(--muted)]">Mobile number</span>
            <input
              value={draft.phone}
              onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
              inputMode="tel"
              autoComplete="tel"
              placeholder="98XXXXXXXX"
              className="mono mt-0.5 h-8 w-full rounded-[4px] border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-[12px]"
            />
          </label>

          {error && (
            <p role="alert" className="text-[11px] font-semibold text-[var(--crimson)]">
              {error}
            </p>
          )}

          <div className="mt-0.5 flex gap-1.5">
            <button
              type="submit"
              className="cmd h-8 flex-1 rounded-[4px] border border-[var(--navy-600)] bg-[var(--navy-600)] text-[11px] text-white hover:bg-[var(--navy-700)]"
            >
              {editingId ? "Save changes" : "Add contact"}
            </button>
            <button
              type="button"
              onClick={() => {
                setFormOpen(false);
                setEditingId(null);
                setError(null);
              }}
              className="cmd h-8 rounded-[4px] border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-[11px] hover:bg-[var(--surface-3)]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={startAdd}
          className="cmd flex w-full items-center justify-center gap-1.5 border-t border-[var(--hairline)] py-1.5 text-[11px] text-[var(--navy-700)] hover:bg-[var(--surface-2)]"
        >
          <UserPlus className="size-3.5" aria-hidden />
          Add close one
        </button>
      )}

      <p className="flex items-start gap-1.5 border-t border-[var(--hairline)] px-2.5 py-1.5 text-[10px] leading-snug text-[var(--faint)]">
        <Info className="mt-px size-3 shrink-0" aria-hidden />
        Saved on this device only. There&apos;s no SMS gateway in this build,
        so nothing actually reaches a phone yet.
      </p>
      {/* Language is accepted for parity with the other cards; the copy here is
          deliberately English-only until it has been reviewed by a translator. */}
      <span hidden>{lang}</span>
    </section>
  );
}

type PermState = "unknown" | "prompt" | "granted" | "denied" | "unsupported" | "asking";

export function LocationPermissionCard() {
  const [state, setState] = useState<PermState>("unknown");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Read the current permission without prompting, where the browser supports
  // it. Safari has no Permissions API for geolocation, hence the fallback.
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
        if (!cancelled) setState("unsupported");
        return;
      }
      if (!navigator.permissions?.query) {
        if (!cancelled) setState("prompt");
        return;
      }
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((p) => {
          if (!cancelled) setState(p.state as PermState);
        })
        .catch(() => {
          if (!cancelled) setState("prompt");
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  const request = () => {
    setError(null);
    // On plain HTTP from anything but this device the browser refuses before
    // it prompts, so there is no permission decision to report. Say why.
    if (!isSecureContext()) {
      setState("denied");
      setError(
        "This page is not on a secure (HTTPS) connection, so your browser blocks location. You can still report an emergency by typing a landmark.",
      );
      return;
    }
    setState("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setState("granted");
      },
      (err) => {
        // Never dress a refusal up as a success.
        setState(err.code === err.PERMISSION_DENIED ? "denied" : "prompt");
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Permission denied. You can still report an emergency by typing a landmark."
            : "Location unavailable right now. You can still report by typing a landmark.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <LocateFixed className="size-3.5 shrink-0 text-[var(--navy-600)]" aria-hidden />
        <h2 className="cmd text-[11.5px]">Location Access</h2>
      </div>

      <div className="px-2.5 py-2.5">
        {state === "granted" ? (
          /* Granted is a settled state, so it collapses to one line. A card
             that keeps explaining itself after you have said yes is just
             something else to scroll past. */
          <p className="flex items-center gap-1.5 text-[12px] leading-snug text-[var(--foreground)]">
            <Check className="size-4 shrink-0 text-[var(--green)]" aria-hidden />
            <span>
              Location is on. You&apos;ll see what&apos;s happening near you.
              {coords && (
                <span className="telemetry ml-1">
                  {coords.lat.toFixed(3)}°N / {coords.lng.toFixed(3)}°E
                </span>
              )}
            </span>
          </p>
        ) : (
          <>
            <p className="text-center text-[13px] font-bold leading-snug text-[var(--foreground)]">
              Share your location so we can show you what&apos;s happening
              around you.
            </p>
            <p className="mt-1.5 text-center text-[11px] leading-snug text-[var(--muted)]">
              Used for nearby shelters, safe routes and local alerts. We never
              track where you go.
            </p>

            {state === "unsupported" ? (
              <p className="mt-2 rounded-[4px] bg-[var(--medium-bg)] px-2 py-1.5 text-[11px]">
                This browser can&apos;t share location. Reporting still works —
                just type the nearest landmark.
              </p>
            ) : (
              <button
                type="button"
                onClick={request}
                disabled={state === "asking"}
                /* Bordered rather than filled, and centred, as on the
                   reference: this is a request, not the page's primary action
                   — that is REPORT AN EMERGENCY, and only one control on a
                   screen should look like the primary one. */
                className="mx-auto mt-3 flex h-10 items-center justify-center gap-1.5 rounded-[4px] border-2 border-[var(--navy-600)] bg-white px-4 text-[12.5px] font-bold text-[var(--navy-700)] hover:bg-[var(--info-bg)] disabled:opacity-60"
              >
                <LocateFixed className="size-4" aria-hidden />
                {state === "asking" ? "Asking…" : "Share my location"}
              </button>
            )}

            {state === "denied" && (
              <p className="mt-2 flex items-start gap-1.5 rounded-[4px] bg-[var(--critical-bg)] px-2 py-1.5 text-[11px] leading-snug">
                <ShieldAlert
                  className="mt-px size-3.5 shrink-0 text-[var(--crimson)]"
                  aria-hidden
                />
                <span>
                  Your browser is blocking this. You can turn it back on in
                  site settings — reporting works fine without it.
                </span>
              </p>
            )}
            {error && state !== "denied" && (
              <p className="mt-2 text-[11px] text-[var(--muted)]">{error}</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
