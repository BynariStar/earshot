// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// SIMULATED crew members for demonstrations. Not real people. Each shows a different path through Earshot:
// prevention, an early noise-pattern change, NASA's common low-pitch shift, and a sudden drop.
// Patterns follow NASA's reports: low-pitch shifts in about 40% of in-flight tests and high-pitch shifts in
// about 9% (HSRB hearing-loss risk record, Rev B.1, 2025).
import { evaluate, averageBaselines } from './rules.js';
import { demoState } from './demo.js';

const BASE = {
  left: { 250: 30, 500: 25, 1000: 20, 2000: 20, 3000: 25, 4000: 30 },
  right: { 250: 30, 500: 25, 1000: 20, 2000: 25, 3000: 25, 4000: 30 },
};
const add = (t, d = {}) => ({
  left: Object.fromEntries(Object.entries(t.left).map(([f, v]) => [f, v + (d.left?.[f] ?? 0)])),
  right: Object.fromEntries(Object.entries(t.right).map(([f, v]) => [f, v + (d.right?.[f] ?? 0)])),
});

function build(checks, extra = {}) {
  const launch = new Date();
  const day = (d) => new Date(launch.getTime() + d * 86400000).toISOString();
  const tests = checks.map(([d, role, delta], i) => ({
    id: `sim-${i}`, date: day(d), missionDay: d, role, headphones: 'Crew headphones', noise: { checked: true, pass: true }, context: [], complete: true,
    thresholds: add(BASE, delta), simulated: true,
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
  let t = add(BASE, persona.truth);
  if (events.some((e) => e.type === 'loud' || e.type === 'fan-fault' || e.type === 'live') && persona.afterNoise) t = add(t, persona.afterNoise);
  if (events.some((e) => e.type === 'ringing') && persona.afterRinging) t = add(t, persona.afterRinging);
  return t;
}
