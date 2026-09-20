"use client";

/**
 * Optional photo or short video attachment.
 *
 * Photos are downscaled in the browser to ~1280 px before becoming a data URL,
 * because the contract caps `photo_url` at 6 MB and a phone camera JPEG will
 * blow past that. Video is passed through untouched and rejected if it exceeds
 * the cap — we do not transcode in the browser.
 *
 * Every failure path — unreadable file, no canvas, oversized result — ends with
 * the attachment dropped and the report still submittable.
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
  const [isVideo, setIsVideo] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const video = file.type.startsWith("video/");
      // Video cannot be shrunk client-side, so an oversized clip is refused
      // outright rather than silently truncated.
      const dataUrl = video ? await readAsDataUrl(file) : await downscale(file);
      if (dataUrl.length > MAX_BYTES) {
        setError(
          video
            ? "That video is too large to attach. Send the report without it, or attach a photo instead."
            : errorLabel,
        );
        onChange(null);
      } else {
        setIsVideo(video);
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
        accept="image/*,video/*"
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
          {isVideo ? (
            <video
              src={value}
              controls
              className="max-h-48 w-full border border-[var(--border)] bg-black object-contain"
            />
          ) : (
            <>
              {/* Local data URL of unknown dimensions — next/image adds nothing here. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={value}
                alt="Attached photo preview"
                className="max-h-48 w-full border border-[var(--border)] object-contain"
              />
            </>
          )}
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setError(null);
              setIsVideo(false);
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

/** Read a file straight through, for formats we cannot re-encode. */
async function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unreadable file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Decode a picked image to something canvas can draw.
 *
 * `createImageBitmap` is the fast path, but it throws outright on HEIC/HEIF —
 * which is what an iPhone shoots by default — and on a few other formats a
 * given engine will happily render in an `<img>`. Relying on it alone meant a
 * photo straight off an iPhone hit the catch in `handleFile`, the attachment
 * was dropped, and the citizen was told their file was unreadable.
 *
 * So: try the fast path, then fall back to decoding through an `<img>`, which
 * uses the browser's full image pipeline (Safari decodes HEIC there). If both
 * refuse, the format genuinely cannot be read on this device.
 */
async function decode(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  try {
    return await createImageBitmap(file);
  } catch {
    // Fall through to the <img> path.
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Unsupported image format"));
      img.src = url;
    });
  } finally {
    // Revoking immediately is safe: decoding has finished or failed by here.
    URL.revokeObjectURL(url);
  }
}

/** Resize to fit `MAX_EDGE` and re-encode as JPEG. */
async function downscale(file: File): Promise<string> {
  const source = await decode(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(source.width, source.height));
  const width = Math.round(source.width * scale);
  const height = Math.round(source.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(source, 0, 0, width, height);
  if (source instanceof ImageBitmap) source.close?.();
  // Re-encoding to JPEG also normalises HEIC and anything else exotic into a
  // format the operator console can actually display.
  return canvas.toDataURL("image/jpeg", 0.75);
}
