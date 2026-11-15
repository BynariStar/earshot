// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// The planned day (shared by the home screen, the planner and the station view), and what it adds up to.
import iss from '../data/iss_modules.json';
import { dose, withProtection, workdayStatus, sleepStatus, EARPLUG_EFFECTIVE_DB } from './noise.js';

export const PLAN_MODULES = ['lab', 'cof', 'node3', 'sm', 'mlm', 'node2', 'cupola', 'jem'];
export const DEFAULT_PLAN = {
  hours: { lab: 4, cof: 2, node3: 2, sm: 4, mlm: 1, node2: 2, cupola: 0, jem: 0 },
  t2Minutes: 60,
  earplugs: false,
  sleepAt: 'cq_stbd',
};
export const SLEEP_MODULES = iss.modules.filter((m) => m.kind === 'sleep');
export const T2 = iss.activities.find((a) => a.id === 't2');
const KEY = 'earshot.plan';

export function loadPlan() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || 'null');
    return p ? { ...DEFAULT_PLAN, ...p, hours: { ...DEFAULT_PLAN.hours, ...p.hours } } : DEFAULT_PLAN;
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

export function computePlan(plan) {
  const segs = Object.entries(plan.hours)
    .filter(([, h]) => h > 0)
    .map(([id, h]) => {
      const m = iss.modules.find((x) => x.id === id);
      return { id, name: m.name, dba: m.dba, minutes: h * 60 };
    });
  if (plan.t2Minutes > 0) segs.push({ id: 't2', name: 'T2 treadmill', dba: T2.dba, minutes: plan.t2Minutes, protected: plan.earplugs });
  const day = withProtection(segs, EARPLUG_EFFECTIVE_DB);
  const work = workdayStatus(day);
  const sleepModule = SLEEP_MODULES.find((m) => m.id === plan.sleepAt) ?? SLEEP_MODULES[0];
  const night = { id: 'sleep', name: `Sleep in ${sleepModule.name}`, dba: sleepModule.dba, minutes: 480 };
  const sleep = sleepStatus([night]);
  const parts = [...day, night].map((s) => ({ ...s, dosePct: dose([s]) }));
  const dosePct = parts.reduce((a, s) => a + s.dosePct, 0);
  const top = [...parts].sort((a, b) => b.dosePct - a.dosePct)[0];
  const plannedMinutes = Object.values(plan.hours).reduce((a, h) => a + h * 60, 0) + plan.t2Minutes;
  return { day, work, sleep, sleepModule, parts, dosePct, top, plannedMinutes };
}
