// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Personal noise targets from the crew member's own hearing checks.
//
// Why: ISS Flight Rule B13-152 requires hearing protection during loud activities when the 16-hour workday
// exceeds 72 dBA, and between 60 and 72 dBA "the flight surgeon recommends protection based on the
// individual's needs" (Allen & Danielson 2020). Real ISS workdays sit in that band (NASA measured 68.7 to
// 70.8 dBA; Limardo et al. 2021). Earshot knows the individual's needs: their own change from baseline.
//
// The NASA numbers below are NASA's; the stricter targets for a high-pitch change (protect above 60 dBA,
// 50% of the daily allowance, sleep at or under 50 dBA) are OUR DESIGN CHOICE, labelled as such in the app.
import { averageBaselines, regionStatusFor, FREQUENCIES, HIGH, LOW } from './rules.js';
import { baselineTests, latestCheck } from './storage.js';

export function hearingState(data) {
  const baselines = baselineTests(data);
  if (baselines.length < 2) return { state: 'none' };
  const check = latestCheck(data);
  if (!check) return { state: 'steady', note: 'Baseline set; no check yet.' };
  const ref = averageBaselines(baselines[0].thresholds, baselines[1].thresholds);
  const statuses = {};
  for (const ear of ['left', 'right']) for (const f of FREQUENCIES) statuses[`${ear}${f}`] = regionStatusFor(ref[ear][f], check.thresholds?.[ear]?.[f]);
  const changed = (fs) => ['left', 'right'].some((ear) => fs.some((f) => ['watch', 'shift', 'urgent'].includes(statuses[`${ear}${f}`])));
  const confirmed = check.confirmedFindings ?? [];
  if (confirmed.some((f) => f.kind === 'high' || f.kind === 'sudden') || changed(HIGH)) return { state: 'high' };
  if (confirmed.some((f) => f.kind === 'low') || changed(LOW)) return { state: 'low' };
  return { state: 'steady' };
}

export const TARGETS = {
  none: { title: 'Set your baseline to personalise this plan', dosePct: 100, protectAbove: 72, sleepMax: 62, ours: false },
  steady: { title: 'Your ears: steady. NASA’s standard targets apply.', dosePct: 100, protectAbove: 72, sleepMax: 62, ours: false },
  low: {
    title: 'Your ears: a low-pitch change. NASA’s standard targets apply.',
    note: 'Low-pitch shifts in flight are not explained by noise (NASA); log ear fullness and pressure changes, and keep nights quiet.',
    dosePct: 100,
    protectAbove: 72,
    sleepMax: 50,
    ours: true,
  },
  high: {
    title: 'Your ears: a high-pitch change, the pattern noise causes. Stricter targets.',
    note: 'Stricter targets are Earshot’s design choice for the flight rule’s “individual needs” band, not a NASA number.',
    dosePct: 50,
    protectAbove: 60,
    sleepMax: 50,
    ours: true,
  },
};

export function planChecks(result, target) {
  const checks = [];
  const pct = Math.round(result.dosePct);
  checks.push({ ok: result.dosePct <= target.dosePct, text: `Daily allowance ${pct}% (target ${target.dosePct}%${target.dosePct < 100 ? ', Earshot’s' : ', NASA'})` });
  checks.push({ ok: result.work.leqDba <= 72, text: `Workday ${result.work.leqDba.toFixed(1)} dBA (flight rule: protection required above 72)` });
  for (const s of result.day) {
    if (s.rawDba > target.protectAbove && !s.protectedNow) {
      checks.push({ ok: false, text: `Earplugs for ${s.name} (${s.rawDba} dBA, above ${target.protectAbove})` });
    }
  }
  checks.push({ ok: result.sleepModule.dba <= target.sleepMax, text: `Sleep ${result.sleepModule.dba} dBA (target ≤ ${target.sleepMax})` });
  return checks;
}
