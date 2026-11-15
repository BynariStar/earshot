// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// The planned day, shared by the home screen, the planner, the day log and the fleet simulation.
//
// A 16-hour workday (what Flight Rule B13-152 averages over) + 8 hours of sleep = 24 hours, always:
// loud activities and the places you list are capped at 16 hours, and one "fill" place takes the rest.
// Personal audio (earphones) is added to the 24-hour noise dose, not to the workday's room-noise average.
import iss from '../data/iss_modules.json';
import { dose, workdayStatus, sleepStatus, allowedMinutes } from './noise.js';
import { BASES, baseLevel } from './bases.js';

export const WORKDAY_MIN = 16 * 60;
export const SLEEP_MIN = 8 * 60;
export const ACTIVITIES = iss.activities; // T2 treadmill, ARED (NASA NEET example)
export const T2 = ACTIVITIES.find((a) => a.id === 't2');
// NASA's effective treadmill level with earplugs (70.3 dBA vs 84.5 dBA) implies 14.2 dB of protection;
// we apply the same figure to other sources when the crew member chooses to wear earplugs.
export const PLUG_DB = T2.dba - T2.earplugsEffectiveDba;
export const MAX_ACTIVITY_MIN = 180;
export const SLEEP_MODULES = iss.modules.filter((m) => m.kind === 'sleep');
export const BACKGROUNDS = [...iss.backgrounds, ...iss.modules.filter((m) => m.kind === 'work').sort((a, b) => a.dba - b.dba)];

// Places and sleep spots for the chosen base. Moon and Mars use the simulated "ISS-like" levels at the
// base's default cabin air with fans sped up (the Station noise defaults).
function baseOptions(baseId) {
  const base = BASES[baseId];
  const opts = { basis: 'iss', atm: base.defaultAtm, fans: 'same-mass', mode: 'avg', t: 0 };
  const lvl = (p) => baseLevel(base, p, opts).dba;
  return {
    places: base.parts.filter((p) => p.kind !== 'sleep' && p.kind !== 'airlock' && p.kind !== 'exercise').map((p) => ({ id: p.id, name: p.label, dba: Math.round(lvl(p) * 10) / 10 })),
    sleep: base.parts.filter((p) => p.kind === 'sleep').map((p) => ({ id: p.id, name: p.label, dba: Math.round(lvl(p) * 10) / 10 })),
  };
}
export const DEFAULT_FILL = { iss: 'us_general', moon: 'm_work', mars: 'r_work' };
export const DEFAULT_SLEEP = { iss: 'cq_stbd', moon: 'm_crew', mars: 'r_cq1' };
export function placeOptions(baseId = 'iss') {
  return baseId === 'iss' ? BACKGROUNDS : baseOptions(baseId).places;
}
export function sleepOptions(baseId = 'iss') {
  return baseId === 'iss' ? SLEEP_MODULES : baseOptions(baseId).sleep;
}

export const DEFAULT_PLAN = {
  base: 'iss',
  activities: { t2: 60, ared: 90 },
  protect: { t2: false, ared: false, loudPlaces: false },
  places: [],
  fill: 'us_general',
  audio: { minutes: 0, dba: 75 },
  sleepAt: 'cq_stbd',
};
const KEY = 'earshot.plan.v3';

// Accepts older plan shapes (earplugs/background) so saved logs and the fleet simulation keep working.
export function normalize(p) {
  const base = p.base ?? 'iss';
  return {
    ...DEFAULT_PLAN,
    ...p,
    base,
    activities: { ...DEFAULT_PLAN.activities, ...p.activities },
    protect: { ...DEFAULT_PLAN.protect, ...(p.protect ?? {}), ...(p.earplugs !== undefined && !p.protect ? { t2: p.earplugs } : {}) },
    places: p.places ?? [],
    fill: p.fill ?? p.background ?? DEFAULT_FILL[base],
    audio: { ...DEFAULT_PLAN.audio, ...(p.audio ?? {}) },
  };
}

export function loadPlan() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || 'null');
    return p ? normalize(p) : DEFAULT_PLAN;
  } catch {
    return DEFAULT_PLAN;
  }
}

export function savePlan(plan) {
  try {
    localStorage.setItem(KEY, JSON.stringify(plan));
  } catch {
    /* storage unavailable */
  }
}

const usedMinutes = (p, except = {}) =>
  Object.entries(p.activities).reduce((a, [k, m]) => a + (except.activity === k ? 0 : m), 0) +
  p.places.reduce((a, pl, i) => a + (except.place === i ? 0 : pl.minutes), 0);

// Keep the workday within 16 hours: a change that would overflow is trimmed to what's left.
export function setActivity(plan, id, minutes) {
  const p = normalize(plan);
  const capped = Math.max(0, Math.min(minutes, MAX_ACTIVITY_MIN, WORKDAY_MIN - usedMinutes(p, { activity: id })));
  return { ...p, activities: { ...p.activities, [id]: capped } };
}
export function setPlaceMinutes(plan, index, minutes) {
  const p = normalize(plan);
  const capped = Math.max(0, Math.min(minutes, WORKDAY_MIN - usedMinutes(p, { place: index })));
  return { ...p, places: p.places.map((pl, i) => (i === index ? { ...pl, minutes: capped } : pl)) };
}

export function computePlan(plan) {
  const p = normalize(plan);
  const places = placeOptions(p.base);
  const levelOf = (id) => places.find((x) => x.id === id) ?? places[0];
  const plugged = (dba) => dba - PLUG_DB;

  const acts = ACTIVITIES.filter((a) => (p.activities[a.id] ?? 0) > 0).map((a) => {
    const prot = !!p.protect[a.id];
    const short = a.id === 't2' ? 'Treadmill' : 'ARED';
    return { id: a.id, kind: 'activity', name: `${short}${prot ? ' (earplugs)' : ''}`, rawDba: a.dba, dba: prot ? plugged(a.dba) : a.dba, protectedNow: prot, minutes: p.activities[a.id] };
  });
  const listed = p.places
    .filter((pl) => pl.minutes > 0)
    .map((pl, i) => {
      const o = levelOf(pl.id);
      const prot = p.protect.loudPlaces && o.dba > 60;
      return { id: `place${i}`, placeId: o.id, kind: 'place', name: `${o.name}${prot ? ' (earplugs)' : ''}`, rawDba: o.dba, dba: prot ? plugged(o.dba) : o.dba, protectedNow: prot, minutes: pl.minutes };
    });
  const used = acts.reduce((a, s) => a + s.minutes, 0) + listed.reduce((a, s) => a + s.minutes, 0);
  const f = levelOf(p.fill);
  const fillProt = p.protect.loudPlaces && f.dba > 60;
  const fill = { id: 'fill', placeId: f.id, kind: 'place', name: `${f.name}${fillProt ? ' (earplugs)' : ''}`, rawDba: f.dba, dba: fillProt ? plugged(f.dba) : f.dba, protectedNow: fillProt, minutes: WORKDAY_MIN - used };
  const day = [...acts, ...listed, fill].filter((s) => s.minutes > 0);
  const work = workdayStatus(day);

  const sleeps = sleepOptions(p.base);
  const sleepModule = sleeps.find((m) => m.id === p.sleepAt) ?? sleeps[0];
  const night = { id: 'sleep', kind: 'sleep', name: `Sleep: ${sleepModule.name}`, dba: sleepModule.dba, minutes: SLEEP_MIN };
  const sleep = sleepStatus([night]);
  const audio = p.audio.minutes > 0 ? [{ id: 'audio', kind: 'audio', name: 'Earphones', dba: p.audio.dba, minutes: p.audio.minutes }] : [];

  const parts = [...day, night, ...audio].map((s) => ({ ...s, dosePct: dose([s]) }));
  const dosePct = parts.reduce((a, s) => a + s.dosePct, 0);
  const top = [...parts].sort((a, b) => b.dosePct - a.dosePct)[0];
  const remaining = Math.max(0, 100 - dosePct);
  const headroom = (dba) => (remaining / 100) * allowedMinutes(dba);
  return { plan: p, day, work, sleep, sleepModule, parts, dosePct, top, fill, activityMinutes: used, headroom, remaining, background: f, rest: fill };
}
