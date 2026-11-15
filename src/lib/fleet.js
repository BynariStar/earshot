// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// SIMULATED fleet view: what the ground could learn by pooling crews' end-of-day NOISE logs (never hearing
// results). Every crew-day is generated, deterministically, from NASA's measured levels (module averages,
// Allen 2024; treadmill, ARED and earplug figures, Allen & Danielson 2020) and the habit ASSUMPTIONS listed
// below. One problem is injected on purpose so the view has something to find: a module running loud for
// three weeks, like the clogged-fan episodes NASA traced in its dosimetry (Limardo et al. 2021).
import iss from '../data/iss_modules.json';
import { computePlan } from './plan.js';

export const ASSUMPTIONS = [
  '3 expeditions × 7 crew × 180 days = 3,780 crew-days.',
  'Crew 1–4 work mostly in the US segment, crew 5–7 mostly in the Russian segment.',
  'Treadmill on 85% of days (30–75 min); resistance exercise (ARED) on 80% of days (60 or 90 min).',
  'Each crew member has their own earplug habit on the treadmill: 30%, 60% or 90% of sessions.',
  "Daily module readings scatter around NASA's measured average by about ±1 dB (as a dosimeter or microphone would).",
  'Injected example: the U.S. Lab runs 6 dB loud in weeks 9–11 of Expedition B (a clogged fan).',
];
export const EXPEDITIONS = ['A', 'B', 'C'];
const CREW = 7;
const DAYS = 180;
export const ANOMALY = { module: 'lab', expedition: 'B', weeks: [9, 10, 11], db: 6 };
export const DETECT_DB = 3; // flag a module whose weekly average runs this far above its NASA average

const byId = Object.fromEntries(iss.modules.map((m) => [m.id, m]));
const US_BG = [['us_general', 0.6], ['lab', 0.15], ['node2', 0.1], ['cof', 0.1], ['jem', 0.05]];
const RU_BG = [['sm', 0.5], ['fgb', 0.2], ['mlm', 0.2], ['mrm1', 0.1]];
const US_SLEEP = ['cq_stbd', 'cq_port', 'cq_zenith', 'cq_nadir'];
const RU_SLEEP = ['kayuta_sm_stbd', 'kayuta_sm_port', 'kayuta_mlm'];
const PLUG_HABITS = [0.3, 0.6, 0.9];

function rng(seed) {
  // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, weighted) => {
  let x = r();
  for (const [v, w] of weighted) if ((x -= w) <= 0) return v;
  return weighted[weighted.length - 1][0];
};
const gauss = (r) => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());
const bgLevel = (id) => (id === 'us_general' ? iss.backgrounds[0].dba : byId[id].dba);

export function simulateFleet(seed = 2026) {
  const r = rng(seed);
  const days = [];
  EXPEDITIONS.forEach((exp) => {
    for (let c = 0; c < CREW; c++) {
      const us = c < 4;
      const plugHabit = PLUG_HABITS[(c + exp.charCodeAt(0)) % 3];
      const sleepAt = us ? US_SLEEP[c % 4] : RU_SLEEP[(c - 4) % 3];
      for (let d = 0; d < DAYS; d++) {
        const week = Math.floor(d / 7) + 1;
        const background = pick(r, us ? US_BG : RU_BG);
        const t2 = r() < 0.85 ? [30, 45, 60, 75][Math.floor(r() * 4)] : 0;
        const ared = r() < 0.8 ? (r() < 0.5 ? 60 : 90) : 0;
        const earplugs = t2 > 0 && r() < plugHabit;
        const anomaly = exp === ANOMALY.expedition && background === ANOMALY.module && ANOMALY.weeks.includes(week) ? ANOMALY.db : 0;
        const reading = bgLevel(background) + gauss(r) + anomaly;
        const nightReading = byId[sleepAt].dba + gauss(r) * 1.5;
        const res = computePlan({ activities: { t2, ared }, earplugs, background, sleepAt });
        days.push({ exp, crew: c + 1, day: d + 1, week, background, t2, ared, earplugs, sleepAt, reading, nightReading, dosePct: res.dosePct, top: res.top.id, leq: res.work.leqDba });
      }
    }
  });
  return days;
}

const CAUSE_LABEL = {
  t2: 'Treadmill without earplugs',
  t2plugged: 'Treadmill with earplugs',
  ared: 'Resistance exercise (ARED)',
  background: 'Time in the module',
  sleep: 'Sleep station',
};

export function analyzeFleet(days) {
  const over = days.filter((d) => d.dosePct > 100);
  const causeCount = {};
  for (const d of over) {
    const k = d.top === 't2' && d.earplugs ? 't2plugged' : d.top;
    causeCount[k] = (causeCount[k] ?? 0) + 1;
  }
  const causes = Object.entries(causeCount)
    .map(([k, n]) => ({ id: k, label: CAUSE_LABEL[k] ?? k, share: n / over.length, n }))
    .sort((a, b) => b.share - a.share);

  const t2Days = days.filter((d) => d.t2 > 0);
  const rate = (xs) => (xs.length ? xs.filter((d) => d.dosePct > 100).length / xs.length : 0);
  const plugs = { with: rate(t2Days.filter((d) => d.earplugs)), without: rate(t2Days.filter((d) => !d.earplugs)) };

  // Weekly module readings vs NASA averages, per expedition.
  const weekly = {};
  for (const d of days) {
    const k = `${d.exp}|${d.background}|${d.week}`;
    (weekly[k] ??= []).push(d.reading - bgLevel(d.background));
  }
  const series = {};
  const anomalies = [];
  for (const [k, xs] of Object.entries(weekly)) {
    const [exp, mod, week] = k.split('|');
    const dev = xs.reduce((a, b) => a + b, 0) / xs.length;
    ((series[exp] ??= {})[mod] ??= []).push({ week: Number(week), dev, n: xs.length });
    if (dev >= DETECT_DB && xs.length >= 3) anomalies.push({ exp, module: mod, week: Number(week), dev });
  }
  for (const exp of Object.keys(series)) for (const mod of Object.keys(series[exp])) series[exp][mod].sort((a, b) => a.week - b.week);

  const sleepStations = {};
  for (const d of days) {
    const s = (sleepStations[d.sleepAt] ??= { id: d.sleepAt, nights: 0, over50: 0 });
    s.nights++;
    if (d.nightReading > 50) s.over50++;
  }
  const sleep = Object.values(sleepStations)
    .map((s) => ({ ...s, name: byId[s.id].name, dba: byId[s.id].dba, share: s.over50 / s.nights }))
    .sort((a, b) => b.share - a.share);

  const over72 = days.filter((d) => d.leq > 72).length / days.length;
  return { total: days.length, over: over.length, overShare: over.length / days.length, over72, causes, plugs, series, anomalies, sleep };
}

export const moduleName = (id) => (id === 'us_general' ? 'US segment, general' : byId[id]?.name ?? id);
