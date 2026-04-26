"use client";

const MUTE_KEY = "wbr.muted";

let ctx: AudioContext | null = null;

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx && ctx.state !== "closed") return ctx;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

export function isMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MUTE_KEY) === "1";
}

export function setMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  if (muted) window.localStorage.setItem(MUTE_KEY, "1");
  else window.localStorage.removeItem(MUTE_KEY);
}

interface ToneOptions {
  freq: number;
  durationMs: number;
  volume?: number;
  type?: OscillatorType;
  attackMs?: number;
  releaseMs?: number;
  delayMs?: number;
}

function tone({
  freq,
  durationMs,
  volume = 0.06,
  type = "sine",
  attackMs = 5,
  releaseMs = 30,
  delayMs = 0,
}: ToneOptions): void {
  if (isMuted()) return;
  const audio = ensureCtx();
  if (!audio) return;
  const start = audio.currentTime + delayMs / 1000;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + attackMs / 1000);
  gain.gain.linearRampToValueAtTime(
    0,
    start + (durationMs - releaseMs) / 1000,
  );
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(start);
  osc.stop(start + durationMs / 1000);
}

export const sfx = {
  unlock(): void {
    // iOS: must call after user gesture to unlock the audio context.
    if (isMuted()) return;
    const audio = ensureCtx();
    if (audio && audio.state === "suspended") void audio.resume();
  },

  tick(): void {
    tone({ freq: 880, durationMs: 60, volume: 0.04, type: "square" });
  },

  countdownBeep(): void {
    tone({ freq: 660, durationMs: 90, volume: 0.05, type: "triangle" });
  },

  countdownFinal(): void {
    tone({ freq: 1320, durationMs: 200, volume: 0.07, type: "triangle" });
  },

  ding(): void {
    tone({ freq: 988, durationMs: 140, volume: 0.06, type: "sine" });
    tone({ freq: 1318, durationMs: 200, volume: 0.06, type: "sine", delayMs: 90 });
    tone({ freq: 1568, durationMs: 280, volume: 0.06, type: "sine", delayMs: 180 });
  },

  buzz(): void {
    tone({ freq: 180, durationMs: 220, volume: 0.08, type: "sawtooth" });
    tone({ freq: 140, durationMs: 220, volume: 0.06, type: "sawtooth", delayMs: 100 });
  },

  rush(): void {
    tone({ freq: 1100, durationMs: 50, volume: 0.05, type: "square" });
  },

  gameOver(): void {
    tone({ freq: 880, durationMs: 200, volume: 0.06, type: "triangle" });
    tone({ freq: 660, durationMs: 250, volume: 0.06, type: "triangle", delayMs: 180 });
    tone({ freq: 440, durationMs: 400, volume: 0.06, type: "triangle", delayMs: 380 });
  },
};
