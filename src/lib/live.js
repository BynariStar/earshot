// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// "Live" station view: a SIMULATED feed that shows what continuous monitoring would look like. NASA doesn't
// publish live module levels, so the feed starts from each module's measured average and replays a loop of
// incidents. The faults are ones NASA has reported on the ISS (Allen 2024, ICES-2024-354): a stalled
// ventilation fan (Node 2: 500 Hz and 1 kHz), faster pump speeds (US Lab: around 2 kHz), an unexplained
// low-frequency peak (Kibo: 63 Hz). The treadmill is NASA's measured 84.5 dBA at the runner's head.
// Where an incident is placed somewhere NASA didn't report it, it's marked illustrative.
import { SIGNATURES, faultDelta } from './spectrum.js';

const sig = (id) => SIGNATURES.find((s) => s.id === id);

// Per station: what goes wrong, and where. kind 'fault' adds `rise` dB in the signature's bands;
// kind 'activity' sets the area to its loud-activity level.
export const INCIDENTS = {
  iss: [
    { part: 'node2', kind: 'fault', signature: 'stalled-fan', rise: 8, what: 'ventilation fan stalled', during: 'a stalled ventilation fan', fix: 'fan swapped' },
    { part: 'node3', kind: 'activity', what: 'treadmill session started', during: 'a treadmill session', fix: 'treadmill session over' },
    { part: 'lab', kind: 'fault', signature: 'pump-speed', rise: 7, what: 'pump running faster', during: 'a fast-running pump', fix: 'pump speed reset' },
    { part: 'jem', kind: 'fault', signature: 'low-freq', rise: 8, what: 'low-frequency hum', during: 'a low-frequency hum', fix: 'hum gone' },
    { part: 'cof', kind: 'fault', signature: 'stalled-fan', rise: 6, what: 'ventilation fan stalled', during: 'a stalled ventilation fan', fix: 'fan swapped', illustrative: true },
  ],
  moon: [
    { part: 'm_work', kind: 'fault', signature: 'stalled-fan', rise: 8, what: 'ventilation fan stalled', during: 'a stalled ventilation fan', fix: 'fan swapped', illustrative: true },
    { part: 'm_exercise', kind: 'activity', what: 'exercise session started', during: 'an exercise session', fix: 'exercise session over' },
    { part: 'm_water', kind: 'fault', signature: 'pump-speed', rise: 7, what: 'pump running faster', during: 'a fast-running pump', fix: 'pump speed reset', illustrative: true },
    { part: 'm_galley', kind: 'fault', signature: 'low-freq', rise: 8, what: 'low-frequency hum', during: 'a low-frequency hum', fix: 'hum gone', illustrative: true },
    { part: 'm_workshop', kind: 'fault', signature: 'stalled-fan', rise: 6, what: 'ventilation fan stalled', during: 'a stalled ventilation fan', fix: 'fan swapped', illustrative: true },
  ],
  mars: [
    { part: 'r_work', kind: 'fault', signature: 'stalled-fan', rise: 8, what: 'ventilation fan stalled', during: 'a stalled ventilation fan', fix: 'fan swapped', illustrative: true },
    { part: 'r_fitness', kind: 'activity', what: 'exercise session started', during: 'an exercise session', fix: 'exercise session over' },
    { part: 'r_farm', kind: 'fault', signature: 'pump-speed', rise: 7, what: 'pump running faster', during: 'a fast-running pump', fix: 'pump speed reset', illustrative: true },
    { part: 'r_galley', kind: 'fault', signature: 'low-freq', rise: 8, what: 'low-frequency hum', during: 'a low-frequency hum', fix: 'hum gone', illustrative: true },
    { part: 'r_medical', kind: 'fault', signature: 'stalled-fan', rise: 6, what: 'ventilation fan stalled', during: 'a stalled ventilation fan', fix: 'fan swapped', illustrative: true },
  ],
};

// The loop, in seconds: incident i starts at `at` and lasts `dur`. Overlaps are deliberate.
export const CYCLE_S = 120;
const SCHEDULE = [
  { i: 0, at: 3, dur: 45 },
  { i: 1, at: 15, dur: 30 },
  { i: 2, at: 38, dur: 35 },
  { i: 3, at: 62, dur: 30 },
  { i: 4, at: 85, dur: 30 },
];

// What is happening `s` seconds into the feed: active incidents and the recent log (newest first).
export function liveFrame(station, s, logSize = 6) {
  const list = INCIDENTS[station] ?? [];
  const active = [];
  const log = [];
  const c0 = Math.max(0, Math.floor((s - 300) / CYCLE_S));
  for (let c = c0; c <= Math.floor(s / CYCLE_S); c++) {
    for (const e of SCHEDULE) {
      const inc = list[e.i];
      if (!inc) continue;
      const start = c * CYCLE_S + e.at;
      const end = start + e.dur;
      if (start <= s) log.push({ at: start, type: 'start', inc, key: `${c}-${e.i}` });
      if (end <= s) log.push({ at: end, type: 'end', inc, key: `${c}-${e.i}` });
      if (start <= s && s < end) active.push({ ...inc, key: `${c}-${e.i}`, since: start });
    }
  }
  log.sort((a, b) => b.at - a.at);
  return { active, log: log.slice(0, logSize) };
}

// Small, smooth fluctuation so the feed looks alive (±0.4 dB).
export const jitter = (s, n) => 0.4 * Math.sin(s * 0.9 + n * 1.7) * Math.cos(s * 0.31 + n);

// dBA change an incident causes. `spectrumId` is the module whose spectrum the fault is applied to.
export function incidentDelta(inc, spectrumId) {
  return inc.kind === 'fault' ? faultDelta(spectrumId, inc.signature, inc.rise) : 0;
}

// Pitches a quick check should test after someone was in the area: the bands the noise hit (within the
// tested range), plus 4 kHz, where noise damage usually shows first.
export function incidentPitches(inc) {
  if (inc.kind === 'activity') return [2000, 3000, 4000];
  const bands = sig(inc.signature).bands.filter((b) => b >= 250 && b <= 4000);
  if (!bands.length) return [250, 500, 1000]; // a low hum: the lowest pitches Earshot tests
  return [...new Set([...bands, 4000])].sort((a, b) => a - b);
}

export const signatureOf = sig;
