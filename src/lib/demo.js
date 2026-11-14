// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// A SIMULATED astronaut for demonstrations. Not real data. The pattern (a low-frequency shift
// appearing during a long mission in one ear) mirrors what NASA reports: low-frequency shifts in
// about 40% of in-flight tests (Human System Risk Board hearing-loss risk record, Rev B.1, 2025).
import { evaluate, averageBaselines } from './rules.js';
import pret from '../data/pret_lnsat.json';

const base = {
  left: { 250: 30, 500: 25, 1000: 20, 2000: 20, 3000: 25, 4000: 30 },
  right: { 250: 30, 500: 25, 1000: 20, 2000: 25, 3000: 25, 4000: 30 },
};

const shift = (t, d) => ({
  left: Object.fromEntries(Object.entries(t.left).map(([f, v]) => [f, v + (d.left?.[f] ?? 0)])),
  right: Object.fromEntries(Object.entries(t.right).map(([f, v]) => [f, v + (d.right?.[f] ?? 0)])),
});

// Mission days and the simulated change from baseline at each check.
const CHECKS = [
  [-30, 'baseline', { left: { 500: 5 }, right: { 1000: 5 } }],
  [-30, 'baseline', {}],
  [14, 'check', { left: { 250: 5 } }],
  [45, 'check', { left: { 250: 5, 500: 5 }, right: { 4000: 5 } }],
  [75, 'check', { left: { 250: 10, 500: 5 } }],
  [105, 'check', { left: { 250: 15, 500: 10 }, right: { 250: 5 } }],
];

export function demoState(launch = new Date()) {
  const day = (d) => new Date(launch.getTime() + d * 86400000).toISOString();
  const tests = CHECKS.map(([d, role, delta], i) => ({
    id: `demo-${i}`,
    date: day(d),
    missionDay: d,
    role,
    headphones: 'Demo headphones',
    noise: { checked: true, pass: true },
    context: i === 5 ? ['Ear fullness or pressure'] : [],
    complete: true,
    thresholds: shift(base, delta),
    simulated: true,
  }));
  const reference = averageBaselines(tests[0].thresholds, tests[1].thresholds);
  for (const t of tests.filter((x) => x.role === 'check')) {
    const ev = evaluate(reference, t.thresholds);
    t.confirmedFindings = ev.findings; // in the demo the retest is assumed to repeat the result
  }
  // Thinking-test history: REAL scores of CSA PRET volunteer #35 (10 sessions in 2015), placed on this
  // simulated mission's timeline for the demo. Pairing them with the simulated hearing record is illustrative.
  const volunteer = pret.people.find((p) => p.participant === 35);
  const days = [-30, -29, 10, 20, 35, 50, 62, 75, 95, 105];
  const cognition = volunteer.sessions.map((s, i) => ({ missionDay: days[i], level: s.highestLevelPassed, source: `CSA PRET volunteer #35, session ${s.session} (${s.date})` }));
  return {
    profile: { headphones: 'Demo headphones', demo: true, age: 47, sex: 'male' },
    tests,
    context: [],
    demo: true,
    cognition,
    plannedDay: { leqDba: 72.8, status: 'protection-required', note: "NASA's worked example day: one treadmill hour without earplugs" },
  };
}
