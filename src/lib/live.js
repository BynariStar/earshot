// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// "Live" station view: a SIMULATED feed that shows what continuous monitoring would look like. NASA doesn't
// publish live module levels, so the feed starts from each module's measured average and replays a loop of
// incidents. The faults are ones NASA has reported on the ISS (Allen 2024, ICES-2024-354): a stalled
// ventilation fan (Node 2: 500 Hz and 1 kHz), faster pump speeds (US Lab: around 2 kHz), an unexplained
// low-frequency peak (Kibo: 63 Hz). The treadmill is NASA's measured 84.5 dBA at the runner's head.
// Where an incident is placed somewhere NASA didn't report it, it's marked illustrative.
import { SIGNATURES, faultDelta } from './spectrum.js';
import { ISS_PARTS } from './issLayout.js';
import { BASES } from './bases.js';

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
  { i: 0, at: 10, dur: 45 },
  { i: 1, at: 20, dur: 30 },
  { i: 2, at: 40, dur: 30 },
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

// ASSUMPTION, stated in the app: Earshot knows which module each crew member is in (from the crew schedule
// or a worn tag). We don't know of a NASA system that tracks crew location by module; this is simulated.
// Where the crew member is during the loop: in the first incident's area when it starts, then elsewhere.
export const LOCATIONS = {
  iss: [[0, 58, 'node2'], [58, 84, 'node1'], [84, CYCLE_S, 'lab']],
  moon: [[0, 58, 'm_work'], [58, 84, 'm_crew'], [84, CYCLE_S, 'm_hygiene']],
  mars: [[0, 58, 'r_work'], [58, CYCLE_S, 'r_lounge']],
};
export function whereAt(station, s) {
  const t = ((s % CYCLE_S) + CYCLE_S) % CYCLE_S;
  return (LOCATIONS[station] ?? []).find(([a, b]) => t >= a && t < b)?.[2] ?? null;
}

export function partsOf(station) {
  return BASES[station] ? BASES[station].parts : ISS_PARTS;
}
// "Node 2 (Harmony)" -> "Harmony"; "Columbus (ESA)" -> "Columbus" (an agency in brackets isn't the module's name).
export const shortPart = (label) => {
  const l = String(label).replace(' (earplugs)', '').replace(/^Level \d · /, '');
  const m = l.match(/^(.*) \((.*)\)$/);
  return m ? (/^(ESA|JAXA|NASA|CSA)$/.test(m[2]) ? m[1] : m[2]) : l;
};
export const partLabel = (station, id) => partsOf(station).find((p) => p.id === id)?.label ?? id;
// The module whose NASA spectrum a part's fault is applied to (bases borrow their ISS counterpart's).
export const spectrumIdOf = (station, id) => (BASES[station] ? BASES[station].parts.find((p) => p.id === id)?.iss ?? id : id);

// An incident in the area where the crew member is right now, or null.
export function liveHit(station, s, here = whereAt(station, s)) {
  return liveFrame(station, s).active.find((x) => x.part === here) ?? null;
}
