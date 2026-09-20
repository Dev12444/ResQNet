"use client";

/**
 * Optional voice dictation via the Web Speech API.
 *
 * The transcript is always dropped into the editable textarea rather than sent
 * straight through: speech recognition mishears, and the citizen must be able
 * to correct their own words before they become an operational report.
 *
 * Absent or refused support degrades to a disabled control with an
 * explanation — typing is always available.
 */

import { useEffect, useRef, useState } from "react";
import type { Lang } from "@/types";
import { LANGS } from "@/lib/constants";
import { isSecureContext } from "@/lib/secureContext";

/* Minimal shape of the vendor-prefixed API; not in lib.dom for all targets. */
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
  isFinal: boolean;
  length: number;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

/* Enough to cover the pauses in a long spoken report, while still bounding a
   recogniser that ends the instant it starts. */
const MAX_RESTARTS = 50;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function VoiceInput({
  lang,
  onTranscript,
  label,
  startLabel,
  stopLabel,
  unsupportedLabel,
  insecureLabel,
  hintLabel,
}: {
  lang: Lang;
  /** Receives the final transcript, to be appended to the editable text. */
  onTranscript: (text: string) => void;
  label: string;
  startLabel: string;
  stopLabel: string;
  unsupportedLabel: string;
  /** Shown when the engine exists but the origin is not HTTPS. */
  insecureLabel: string;
  hintLabel: string;
}) {
  const [supported, setSupported] = useState(false);
  const [insecure, setInsecure] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  /** True while the citizen has dictation open, across Chrome's pause-restarts. */
  const wantListening = useRef(false);
  const restarts = useRef(0);
  /** Interim text the engine has not marked final, so ending can still keep it. */
  const pendingUncommitted = useRef("");

  useEffect(() => {
    // Deferred: detection must not set state synchronously in the effect body,
    // and it can only run on the client, so it cannot be a lazy initial value
    // without causing a hydration mismatch.
    const timer = setTimeout(() => {
      // Chrome still exposes webkitSpeechRecognition on a plain-HTTP origin,
      // so a presence check alone renders a button that fails the moment it
      // is pressed. Treat an insecure origin as its own, explainable state.
      setInsecure(!isSecureContext());
      setSupported(getRecognitionCtor() !== null);
    }, 0);
    return () => {
      clearTimeout(timer);
      // Unmounting is a deliberate stop: do not let `onend` restart into a
      // recogniser whose component is gone.
      wantListening.current = false;
      recognition.current?.stop();
    };
  }, []);

  function start() {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    setError(null);
    const rec = new Ctor();
    rec.lang = LANGS.find((l) => l.code === lang)?.speech ?? "en-IN";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (event) => {
      let finalText = "";
      let pendingText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else pendingText += result[0].transcript;
      }
      // Mirrored into a ref so a session ending from anywhere — a stop, a
      // pause-restart, an unmount — still knows what was left uncommitted.
      pendingUncommitted.current = pendingText;
      setInterim(pendingText);
      if (finalText.trim()) {
        onTranscript(finalText.trim());
        pendingUncommitted.current = "";
        setInterim("");
      }
    };
    rec.onerror = (event) => {
      /*
       * `no-speech` is not a failure. Chrome raises it after a few seconds of
       * silence — which happens constantly to someone describing an emergency
       * in pauses — and follows it with `onend`. Treating it as an error put
       * "voice input stopped" on screen mid-sentence; `onend` below restarts
       * instead, so the pause is invisible.
       */
      if (event.error === "no-speech" || event.error === "aborted") return;

      // A refusal must not be retried: restarting re-throws it forever.
      const refused =
        event.error === "not-allowed" || event.error === "service-not-allowed";
      if (refused) wantListening.current = false;
      setError(
        refused
          ? "Microphone permission denied. You can still type your report."
          : "Voice input stopped. You can still type your report.",
      );
      setListening(false);
    };

    rec.onend = () => {
      /*
       * Commit whatever the engine never marked final.
       *
       * Interim text is shown live under the button, so the citizen watches
       * their words appear — and then watched them vanish, because ending the
       * session simply cleared them. Anything not finalised at that moment was
       * silently discarded, which is the whole of "it doesn't save what I
       * said". Committing here loses nothing: when Chrome does finalise
       * (its usual behaviour on stop), `onresult` has already emptied this.
       */
      const leftover = pendingUncommitted.current.trim();
      pendingUncommitted.current = "";
      if (leftover) onTranscript(leftover);
      setInterim("");
      /*
       * Chrome ends the session on each natural pause even with `continuous`.
       * Restart while the citizen still has the button held open, so dictation
       * survives the gaps between sentences. The budget stops a engine that
       * ends immediately from spinning: after that, it stays stopped.
       */
      if (wantListening.current && restarts.current < MAX_RESTARTS) {
        restarts.current += 1;
        try {
          rec.start();
          return;
        } catch {
          // Fall through to stopping cleanly.
        }
      }
      wantListening.current = false;
      setListening(false);
    };

    recognition.current = rec;
    try {
      wantListening.current = true;
      restarts.current = 0;
      rec.start();
      setListening(true);
    } catch {
      wantListening.current = false;
      setError("Could not start voice input. You can still type your report.");
    }
  }

  function stop() {
    // Cleared first: `onend` checks it, and must not restart after a deliberate stop.
    wantListening.current = false;
    recognition.current?.stop();
    setListening(false);
  }

  if (!supported || insecure) {
    return (
      <div>
        <span className="block text-sm font-semibold">{label}</span>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {insecure ? insecureLabel : unsupportedLabel}
        </p>
      </div>
    );
  }

  return (
    <div>
      <span className="block text-sm font-semibold">{label}</span>
      <button
        type="button"
        onClick={listening ? stop : start}
        aria-pressed={listening}
        className={`mt-1.5 flex min-h-11 w-full items-center justify-center gap-2 border px-3 text-sm font-semibold ${
          listening
            ? "border-[var(--critical)] bg-[var(--critical-bg)] text-[var(--critical)]"
            : "border-[var(--border-strong)] bg-[var(--surface)] hover:bg-[var(--surface-2)]"
        }`}
      >
        <span
          aria-hidden
          className={`inline-block size-2 rounded-full ${listening ? "pulse-critical" : ""}`}
          style={{ background: listening ? "var(--critical)" : "var(--muted)" }}
        />
        {listening ? stopLabel : startLabel}
      </button>
      {listening && interim && (
        <p className="mt-1 text-xs italic text-[var(--muted)]" aria-live="polite">
          {interim}
        </p>
      )}
      <p className="mt-1 text-xs text-[var(--muted)]">{hintLabel}</p>
      {error && (
        <p role="alert" className="mt-1 text-xs" style={{ color: "var(--critical)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
