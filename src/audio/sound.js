// Generated tones via the Web Audio API -- no sound files to load or
// manage. Every call here is fire-and-forget: scheduling an oscillator
// returns immediately (the actual sound plays asynchronously through the
// audio hardware on the browser's own clock), so nothing here can ever
// block input, and a failure (no AudioContext support, autoplay policy,
// whatever) is swallowed rather than surfaced -- a broken sound should
// never break the game.
const MUTE_KEY = "hilo:muted";

let audioCtx = null;
function getContext() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  return audioCtx;
}

// Local-only, not synced to an account -- this is a device/browser sound
// preference, not a gameplay-affecting setting like game mode, so there's
// no need for the profiles-column round trip that gameMode/equippedTheme
// use. Works the same for anonymous and signed-in visitors.
export function isMuted() {
  return localStorage.getItem(MUTE_KEY) === "1";
}

export function setMuted(muted) {
  localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
}

function tone({ freqStart, freqEnd = freqStart, durationMs, type = "sine", gain = 0.12 }) {
  if (isMuted()) return;
  try {
    const ctx = getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const now = ctx.currentTime;
    const duration = durationMs / 1000;

    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    if (freqEnd !== freqStart) osc.frequency.linearRampToValueAtTime(freqEnd, now + duration);

    gainNode.gain.setValueAtTime(gain, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  } catch {
    // Never let a sound failure affect gameplay.
  }
}

// Guess registered -- fires the instant a call button is tapped, before
// the network round trip even starts.
export function playClickTone() {
  tone({ freqStart: 600, durationMs: 40, type: "square", gain: 0.06 });
}

// Win -- quick rising tone.
export function playWinTone() {
  tone({ freqStart: 440, freqEnd: 880, durationMs: 140, type: "sine", gain: 0.14 });
}

// Bust -- quick low, falling tone.
export function playLoseTone() {
  tone({ freqStart: 300, freqEnd: 110, durationMs: 140, type: "sine", gain: 0.14 });
}
