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
  hintLabel,
}: {
  lang: Lang;
  /** Receives the final transcript, to be appended to the editable text. */
  onTranscript: (text: string) => void;
  label: string;
  startLabel: string;
  stopLabel: string;
  unsupportedLabel: string;
  hintLabel: string;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    // Deferred: detection must not set state synchronously in the effect body,
    // and it can only run on the client, so it cannot be a lazy initial value
    // without causing a hydration mismatch.
    const timer = setTimeout(() => setSupported(getRecognitionCtor() !== null), 0);
    return () => {
      clearTimeout(timer);
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
      let pending = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else pending += result[0].transcript;
      }
      setInterim(pending);
      if (finalText.trim()) {
        onTranscript(finalText.trim());
        setInterim("");
      }
    };
    rec.onerror = (event) => {
      setError(
        event.error === "not-allowed"
          ? "Microphone permission denied. You can still type your report."
          : "Voice input stopped. You can still type your report.",
      );
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
    };

    recognition.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setError("Could not start voice input. You can still type your report.");
    }
  }

  function stop() {
    recognition.current?.stop();
    setListening(false);
  }

  if (!supported) {
    return (
      <div>
        <span className="block text-sm font-semibold">{label}</span>
        <p className="mt-1 text-xs text-[var(--muted)]">{unsupportedLabel}</p>
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
