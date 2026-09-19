"use client";

/**
 * A short two-tone chime for a new critical alert.
 *
 * Synthesised with Web Audio rather than shipped as a file: it is a few
 * hundred bytes of code instead of an asset, and it cannot fail to load on a
 * venue connection.
 *
 * Two constraints shape this.
 *
 * Browsers refuse to start an AudioContext until the page has had a genuine
 * user gesture, so a dashboard left untouched cannot make a sound however much
 * it might want to. That is not worked around — it is reported, so the console
 * can say "sound is blocked until you click" instead of silently failing and
 * leaving an operator believing they will be told.
 *
 * And it is mutable. An operations room that cannot silence an alarm learns to
 * ignore it, which defeats the alarm.
 */

const MUTE_KEY = "resqnet.alertSound.muted";

let ctx: AudioContext | null = null;

/** True once a gesture has let us open an AudioContext that is actually running. */
export function chimeReady(): boolean {
  return ctx !== null && ctx.state === "running";
}

export function isMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* storage blocked — the setting just will not persist */
  }
}

/**
 * Open (or resume) the audio context. Must be called from a user gesture the
 * first time. Returns whether sound can now be produced.
 */
export async function armChime(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") await ctx.resume();
    return ctx.state === "running";
  } catch {
    return false;
  }
}

/** Play the chime. No-op when muted, blocked, or unsupported. */
export function playAlertChime(): void {
  if (isMuted() || ctx === null || ctx.state !== "running") return;
  try {
    const now = ctx.currentTime;
    // Two descending tones: distinct from a notification ping, and short
    // enough that repeated alerts do not overlap into noise.
    for (const [at, freq] of [
      [0, 880],
      [0.18, 660],
    ] as const) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      // Ramped rather than switched: an instant start or stop clicks.
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.16, now + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + at);
      osc.stop(now + at + 0.18);
    }
  } catch {
    /* audio failed — the banner is still on screen, which is the real alert */
  }
}
