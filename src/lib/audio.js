// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Tone output through the Web Audio API, routed to one ear only.
// Pulsed tones (three 225 ms beeps) are easier to tell apart from tinnitus than a steady tone.
import { MAX_LEVEL } from './threshold.js';

let ctx = null;

export function audioContext() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

export async function unlockAudio() {
  const c = audioContext();
  if (c.state === 'suspended') await c.resume();
  return c;
}

// App level (dB, 100 = digital full scale) to linear gain, with the output cap enforced here,
// so no code path can play louder than MAX_LEVEL.
export function levelToGain(level) {
  const capped = Math.min(level, MAX_LEVEL);
  return 10 ** ((capped - 100) / 20);
}

const PULSE_MS = 225;
const GAP_MS = 225;
const PULSES = 3;
const RAMP_S = 0.02; // 20 ms on/off ramps avoid audible clicks

// Plays a pulsed tone in one ear. Resolves when the tone has finished.
export function playTone({ frequency, ear, level }) {
  const c = audioContext();
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = frequency;
  const gain = c.createGain();
  gain.gain.value = 0;
  const merger = c.createChannelMerger(2);
  osc.connect(gain);
  gain.connect(merger, 0, ear === 'left' ? 0 : 1);
  merger.connect(c.destination);

  const peak = levelToGain(level);
  const t0 = c.currentTime + 0.05;
  for (let i = 0; i < PULSES; i++) {
    const on = t0 + (i * (PULSE_MS + GAP_MS)) / 1000;
    const off = on + PULSE_MS / 1000;
    gain.gain.setValueAtTime(0, on);
    gain.gain.linearRampToValueAtTime(peak, on + RAMP_S);
    gain.gain.setValueAtTime(peak, off - RAMP_S);
    gain.gain.linearRampToValueAtTime(0, off);
  }
  const end = t0 + (PULSES * (PULSE_MS + GAP_MS)) / 1000;
  osc.start(t0);
  osc.stop(end + 0.05);
  return new Promise((resolve) => {
    osc.onended = () => {
      merger.disconnect();
      resolve();
    };
  });
}

// A fixed reference tone used once at setup so the user sets the system volume to a comfortable,
// repeatable point, and is told to keep it there for every test.
export function playReferenceTone(ear = 'both') {
  const c = audioContext();
  const osc = c.createOscillator();
  osc.frequency.value = 1000;
  const gain = c.createGain();
  gain.gain.value = 0;
  const t0 = c.currentTime + 0.05;
  gain.gain.linearRampToValueAtTime(levelToGain(70), t0 + 0.05);
  gain.gain.setValueAtTime(levelToGain(70), t0 + 1.45);
  gain.gain.linearRampToValueAtTime(0, t0 + 1.5);
  osc.connect(gain);
  if (ear === 'both') gain.connect(c.destination);
  else {
    const merger = c.createChannelMerger(2);
    gain.connect(merger, 0, ear === 'left' ? 0 : 1);
    merger.connect(c.destination);
  }
  osc.start(t0);
  osc.stop(t0 + 1.6);
}
