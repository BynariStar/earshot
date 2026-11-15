// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// The planned day, shared by the home screen, the planner and the station view.
//
// Activities first: with NASA's module averages alone, even 16 hours in the loudest module (Nauka,
// 67.4 dBA) stays under the 72 dBA flight rule and uses about 35% of the daily allowance; one treadmill
// hour alone uses about 112% (our calculation with NASA's numbers; see lib.test.js). So the plan asks for
// loud activities, and the rest of the 16-hour workday is filled automatically by one background choice.
// Workday 16 h + sleep 8 h = 24 h, always.
import iss from '../data/iss_modules.json';
import { dose, workdayStatus, sleepStatus } from './noise.js';

export const WORKDAY_MIN = 16 * 60;
export const SLEEP_MIN = 8 * 60;
export const ACTIVITIES = iss.activities; // T2 treadmill, ARED (NASA NEET example)
export const T2 = ACTIVITIES.find((a) => a.id === 't2');
export const SLEEP_MODULES = iss.modules.filter((m) => m.kind === 'sleep');
export const BACKGROUNDS = [...iss.backgrounds, ...iss.modules.filter((m) => m.kind === 'work').sort((a, b) => a.dba - b.dba)];
export const MAX_ACTIVITY_MIN = 180;

export const DEFAULT_PLAN = {
  activities: { t2: 60, ared: 90 },
  earplugs: false,
  background: 'us_general',
  sleepAt: 'cq_stbd',
};
const KEY = 'earshot.plan.v2';

export function loadPlan() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || 'null');
    return p ? { ...DEFAULT_PLAN, ...p, activities: { ...DEFAULT_PLAN.activities, ...p.activities } } : DEFAULT_PLAN;
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

// Keep activity time within the workday: a change that would overflow is trimmed to what's left.
export function setActivity(plan, id, minutes) {
  const others = Object.entries(plan.activities).filter(([k]) => k !== id).reduce((a, [, m]) => a + m, 0);
  const capped = Math.max(0, Math.min(minutes, MAX_ACTIVITY_MIN, WORKDAY_MIN - others));
  return { ...plan, activities: { ...plan.activities, [id]: capped } };
}

export function computePlan(plan) {
  const acts = ACTIVITIES.filter((a) => (plan.activities[a.id] ?? 0) > 0).map((a) => {
    const plugged = a.id === 't2' && plan.earplugs;
    return {
      id: a.id,
      name: a.id === 't2' ? (plugged ? 'T2 treadmill (earplugs)' : 'T2 treadmill') : a.name,
      dba: plugged ? a.earplugsEffectiveDba : a.dba,
      minutes: plan.activities[a.id],
    };
  });
  const activityMinutes = acts.reduce((a, s) => a + s.minutes, 0);
  const bg = BACKGROUNDS.find((b) => b.id === plan.background) ?? BACKGROUNDS[0];
  const rest = { id: 'background', name: bg.name, dba: bg.dba, minutes: WORKDAY_MIN - activityMinutes };
  const day = [...acts, rest].filter((s) => s.minutes > 0);
  const work = workdayStatus(day);
  const sleepModule = SLEEP_MODULES.find((m) => m.id === plan.sleepAt) ?? SLEEP_MODULES[0];
  const night = { id: 'sleep', name: `Sleep in ${sleepModule.name}`, dba: sleepModule.dba, minutes: SLEEP_MIN };
  const sleep = sleepStatus([night]);
  const parts = [...day, night].map((s) => ({ ...s, dosePct: dose([s]) }));
  const dosePct = parts.reduce((a, s) => a + s.dosePct, 0);
  const top = [...parts].sort((a, b) => b.dosePct - a.dosePct)[0];
  return { day, work, sleep, sleepModule, parts, dosePct, top, background: bg, rest, activityMinutes };
}
