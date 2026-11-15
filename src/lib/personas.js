// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// SIMULATED crew members for demonstrations. Not real people. Each shows a different path through Earshot:
// prevention, an early noise-pattern change, NASA's common low-pitch shift, and a sudden drop.
// Patterns follow NASA's reports: low-pitch shifts in about 40% of in-flight tests and high-pitch shifts in
// about 9% (HSRB hearing-loss risk record, Rev B.1, 2025).
import { evaluate, averageBaselines } from './rules.js';
import { demoState } from './demo.js';
import lsah from '../data/lsah.json';
import { NO_RESPONSE_LEVEL } from './threshold.js';

const BASE = {
  left: { 250: 30, 500: 25, 1000: 20, 2000: 20, 3000: 25, 4000: 30 },
  right: { 250: 30, 500: 25, 1000: 20, 2000: 25, 3000: 25, 4000: 30 },
};
const add = (t, d = {}) => ({
  left: Object.fromEntries(Object.entries(t.left).map(([f, v]) => [f, v + (d.left?.[f] ?? 0)])),
  right: Object.fromEntries(Object.entries(t.right).map(([f, v]) => [f, v + (d.right?.[f] ?? 0)])),
});

function build(checks, extra = {}, base = BASE) {
  const launch = new Date();
  const day = (d) => new Date(launch.getTime() + d * 86400000).toISOString();
  const tests = checks.map(([d, role, delta], i) => ({
    id: `sim-${i}`, date: day(d), missionDay: d, role, headphones: 'Crew headphones', noise: { checked: true, pass: true }, context: [], complete: true,
    thresholds: add(base, delta), simulated: true,
  }));
  const ref = averageBaselines(tests[0].thresholds, tests[1].thresholds);
  for (const t of tests.filter((x) => x.role === 'check')) t.confirmedFindings = evaluate(ref, t.thresholds).findings;
  return { profile: { headphones: 'Crew headphones', demo: true }, tests, context: [], demo: true, ...extra };
}

export const PERSONAS = [
  {
    id: 'steady', name: 'Crew member A', tag: 'Steady ears', age: 41, sex: 'male',
    story: 'Steady since launch. Shows prevention: earplug flags before anything changes.',
    state: () => build([[-30, 'baseline', {}], [-29, 'baseline', { right: { 1000: 5 } }], [30, 'check', { left: { 4000: 5 } }], [60, 'check', {}]]),
    truth: {},
  },
  {
    id: 'high', name: 'Crew member B', tag: 'Early high-pitch change', age: 47, sex: 'female',
    story: 'A small change at 3 to 4 kHz in the left ear, the pattern noise causes. Not yet a NASA shift.',
    state: () => build([[-30, 'baseline', {}], [-29, 'baseline', {}], [30, 'check', { left: { 4000: 5 } }], [60, 'check', { left: { 3000: 5, 4000: 7 } }]]),
    truth: { left: { 3000: 5, 4000: 7 } },
    afterNoise: { left: { 2000: 6, 3000: 10, 4000: 13 } }, // a temporary shift after loud noise (simulated)
  },
  {
    id: 'low', name: 'Crew member C', tag: 'Low-pitch shift', age: 47, sex: 'male',
    story: "A low-pitch shift in the left ear: NASA's most common in-flight pattern. Cause unknown.",
    state: () => ({ ...demoState(), demo: true }),
    truth: { left: { 250: 15, 500: 10 }, right: { 250: 5 } },
  },
  {
    id: 'sudden', name: 'Crew member D', tag: 'Sudden drop ahead', age: 52, sex: 'female',
    story: 'Steady until today. In the app, choose Demo, then Ringing in the right ear, to see the sudden-drop response.',
    state: () => build([[-30, 'baseline', {}], [-29, 'baseline', {}], [45, 'check', {}]]),
    truth: {},
    afterRinging: { right: { 1000: 15, 2000: 35, 3000: 40, 4000: 35 } },
  },
];

export const personaById = (id) => PERSONAS.find((p) => p.id === id) ?? null;

// The simulated crew member's thresholds right now, given today's events (for a simulated quick check).
export function simulatedThresholds(persona, events = []) {
  let t = add(persona.baseThresholds ?? BASE, persona.truth);
  if (events.some((e) => e.type === 'loud' || e.type === 'fan-fault' || e.type === 'live') && persona.afterNoise) t = add(t, persona.afterNoise);
  if (events.some((e) => e.type === 'ringing') && persona.afterRinging) t = add(t, persona.afterRinging);
  return t;
}

// --- Build your own simulated crew member -----------------------------------------------------------
// Age and sex set the starting hearing at high pitches from NASA's astronaut hearing-by-age table (LSAH,
// 1998). That table gives 6 kHz only, so we apply its age-group difference fully at 4 kHz and partly at
// 3 and 2 kHz, the way age-related loss slopes. An approximation, labelled as one. Where the astronaut
// group has no value (women over 49), the table's comparison group is used.

const AGE_BANDS = [[0, 35, '< 35'], [35, 40, '35-39'], [40, 45, '40-44'], [45, 50, '45-49'], [50, 55, '50-54'], [55, 60, '55-59'], [60, 200, '60+']];
export function ageOffsetDb(age, sex) {
  const g = sex === 'female' ? 'Female' : 'Male';
  const band = AGE_BANDS.find(([a, b]) => age >= a && age < b)?.[2] ?? '< 35';
  const v = (k) => lsah.table.groups[`${g} Astronauts`][k] ?? lsah.table.groups[`${g} Comparisons`][k];
  return Math.max(0, v(band) - v('< 35'));
}

export const CONDITIONS = [
  { id: 'steady', label: 'Steady ears' },
  { id: 'high', label: 'Early high-pitch change' },
  { id: 'low', label: 'Low-pitch shift' },
  { id: 'sudden', label: 'Sudden drop ahead' },
  { id: 'deaf', label: "One ear doesn't hear" },
];

const onEar = (ear, d) => ({ [ear]: d });
export function customPersona({ age = 40, sex = 'female', condition = 'high', ear = 'left' } = {}) {
  const off = ageOffsetDb(age, sex);
  const aged = { 2000: Math.round(off * 0.3), 3000: Math.round(off * 0.6), 4000: Math.round(off) };
  const base = { left: { ...BASE.left }, right: { ...BASE.right } };
  for (const e of ['left', 'right']) for (const [f, d] of Object.entries(aged)) base[e][f] += d;
  if (condition === 'deaf') for (const f of Object.keys(base[ear])) base[ear][f] = NO_RESPONSE_LEVEL;
  const other = ear === 'left' ? 'right' : 'left';
  const checks = {
    steady: [[30, 'check', {}], [60, 'check', {}]],
    high: [[30, 'check', onEar(ear, { 4000: 5 })], [60, 'check', onEar(ear, { 3000: 5, 4000: 7 })]],
    low: [[30, 'check', onEar(ear, { 250: 5 })], [60, 'check', onEar(ear, { 250: 15, 500: 10 })]],
    sudden: [[45, 'check', {}]],
    deaf: [[30, 'check', {}], [60, 'check', onEar(other, { 4000: 5 })]],
  }[condition];
  const label = CONDITIONS.find((c) => c.id === condition)?.label ?? condition;
  return {
    id: 'custom',
    name: 'Your crew member',
    tag: label,
    age,
    sex,
    custom: true,
    story: `${age}, ${sex}. ${label}${condition === 'steady' ? '' : `, ${ear} ear`}.`,
    state: () => build([[-30, 'baseline', {}], [-29, 'baseline', {}], ...checks], {}, base),
    truth: checks[checks.length - 1][2],
    afterNoise: condition === 'deaf' ? onEar(other, { 2000: 6, 3000: 10, 4000: 13 }) : onEar(ear, { 2000: 6, 3000: 10, 4000: 13 }),
    afterRinging: condition === 'sudden' ? onEar(ear, { 1000: 15, 2000: 35, 3000: 40, 4000: 35 }) : null,
    baseThresholds: base,
  };
}

// Scenarios for a simulated check: what the simulated crew member "hears" this time. "As expected" follows
// the crew member and today's events; the others replace today's change, on the ear the scenario names.
export const SCENARIOS = [
  { id: 'expected', label: 'As expected for this crew member', note: "Their own pattern plus today's events" },
  { id: 'none', label: 'No change', note: 'Every pitch within a few dB of baseline' },
  { id: 'temporary', label: 'Temporary change after noise', note: '+10 to +15 dB at 3 to 4 kHz in one ear' },
  { id: 'low', label: 'Low-pitch change', note: "+10 to +15 dB at 250 and 500 Hz: NASA's common in-flight pattern" },
  { id: 'sudden', label: 'Sudden drop', note: '30 dB or more at 2 to 4 kHz in one ear' },
];
export function scenarioThresholds(persona, events, scenarioId, ear = 'right') {
  if (scenarioId === 'expected') return simulatedThresholds(persona, events);
  const base = persona.baseThresholds ?? BASE;
  const d = {
    none: {},
    temporary: { [ear]: { 2000: 5, 3000: 10, 4000: 15 } },
    low: { [ear]: { 250: 15, 500: 10 } },
    sudden: { [ear]: { 1000: 10, 2000: 35, 3000: 40, 4000: 35 } },
  }[scenarioId];
  return add(base, d);
}
