"use client";

/**
 * Optional photo attachment.
 *
 * Downscaled in the browser to ~1280 px before it becomes a data URL, because
 * the contract caps `photo_url` at 6 MB and a phone camera JPEG will blow past
 * that. Every failure path — unreadable file, no canvas, oversized result —
 * ends with the photo dropped and the report still submittable.
 */

import { useRef, useState } from "react";

const MAX_EDGE = 1280;
const MAX_BYTES = 6 * 1024 * 1024;

export function PhotoInput({
  value,
  onChange,
  label,
  addLabel,
  removeLabel,
  errorLabel,
}: {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  label: string;
  addLabel: string;
  removeLabel: string;
  errorLabel: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const dataUrl = await downscale(file);
      if (dataUrl.length > MAX_BYTES) {
        setError(errorLabel);
        onChange(null);
      } else {
        onChange(dataUrl);
      }
    } catch {
      setError(errorLabel);
      onChange(null);
    } finally {
      setBusy(false);
      // Let the same file be picked again after a failure.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <span className="block text-sm font-semibold">{label}</span>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        id="report-photo"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {value ? (
        <div className="mt-1.5">
          {/* Local data URL of unknown dimensions — next/image adds nothing here. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Attached photo preview"
            className="max-h-48 w-full border border-[var(--border)] object-contain"
          />
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setError(null);
            }}
            className="mt-1.5 min-h-11 w-full border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm font-semibold hover:bg-[var(--surface-2)]"
          >
            {removeLabel}
          </button>
        </div>
      ) : (
        <label
          htmlFor="report-photo"
          className="mt-1.5 flex min-h-11 cursor-pointer items-center justify-center border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm font-semibold hover:bg-[var(--surface-2)]"
        >
          {busy ? "…" : addLabel}
        </label>
      )}

      {error && (
        <p role="alert" className="mt-1 text-xs" style={{ color: "var(--critical)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

/** Resize to fit `MAX_EDGE` and re-encode as JPEG. */
async function downscale(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.75);
}
