// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Decision SUPPORT for a sudden drop in hearing. Earshot never diagnoses or recommends treatment; it
// shortens the time from onset to the flight surgeon's decision and hands them the facts.
//
// Clinical definition (AAO-HNS Clinical Practice Guideline: Sudden Hearing Loss, Update 2019; as summarised
// by the US Defense Health Agency's Hearing Center of Excellence): a drop of at least 30 dB at three
// consecutive audiometric frequencies, developing within 72 hours. NASA's risk record uses "30 dB or more"
// without the frequency rule, which is what Earshot's first flag uses.
import { FREQUENCIES } from './rules.js';

export const SUDDEN_DB = 30;
export const INITIAL_WINDOW_DAYS = 14; // KAS 8: corticosteroids an option within 2 weeks of onset
export const SALVAGE_FROM_DAYS = 14; // KAS 10: intratympanic steroids recommended at 2-6 weeks if recovery incomplete
export const SALVAGE_TO_DAYS = 42;

// Three neighbouring tested pitches each 30 dB or more worse than the reference.
export function clinicalCriteria(reference, current, ear) {
  const drops = FREQUENCIES.map((f) => (current?.[ear]?.[f] ?? NaN) - (reference?.[ear]?.[f] ?? NaN));
  let best = [];
  let run = [];
  FREQUENCIES.forEach((f, i) => {
    if (Number.isFinite(drops[i]) && drops[i] >= SUDDEN_DB) run = [...run, f];
    else run = [];
    if (run.length > best.length) best = run;
  });
  return { met: best.length >= 3, frequencies: best, drops: Object.fromEntries(FREQUENCIES.map((f, i) => [f, drops[i]])) };
}

export function daysSince(iso, now = Date.now()) {
  return (now - new Date(iso).getTime()) / 86400000;
}

// Where the guideline's timing puts this day (information for the medical team, not advice).
export function windowStatus(days) {
  if (days < 0) return { phase: 'future', text: 'Onset time is in the future; check the date.' };
  if (days <= INITIAL_WINDOW_DAYS) return { phase: 'initial', text: `Day ${Math.floor(days) + 1} of the 2-week window the guideline gives for first treatment.` };
  if (days <= SALVAGE_TO_DAYS) return { phase: 'salvage', text: `Past 2 weeks: the guideline's salvage options apply up to about 6 weeks after onset.` };
  return { phase: 'late', text: 'More than 6 weeks since onset: outside the guideline\'s treatment windows; follow-up and rehabilitation apply.' };
}

const fmt = (f) => (f >= 1000 ? `${f / 1000} kHz` : `${f} Hz`);

export function surgeonSummary({ ear, onset, hum, flags, criteria, context, headphones, noisy, simulated }) {
  const lines = [];
  if (simulated) lines.push('EXAMPLE ONLY: simulated data, not a real crew member.');
  lines.push(`Earshot sudden-drop summary (research prototype, not a medical device)`);
  lines.push(`Ear: ${ear}. Onset reported: ${onset ? new Date(onset).toLocaleString() : 'not given'}.`);
  lines.push(`Change from personal baseline (same headphones${headphones ? `: ${headphones}` : ''}; dB, higher = worse):`);
  lines.push(
    FREQUENCIES.map((f) => {
      const d = criteria.drops[f];
      return `${fmt(f)} ${Number.isFinite(d) ? (d > 0 ? '+' : '') + Math.round(d) : 'n/a'}`;
    }).join(', ')
  );
  lines.push(`Confirmed by an immediate retest. Clinical definition (30 dB at 3 neighbouring pitches): ${criteria.met ? `met (${criteria.frequencies.map(fmt).join(', ')})` : 'not met'}.`);
  lines.push(`Hum test: ${hum === 'other' ? 'louder in the other ear (suggests inner-ear / sensorineural)' : hum === 'same' ? 'louder in the affected ear (suggests conductive)' : hum === 'equal' ? 'no difference' : 'not done'}.`);
  lines.push(`Red flags: ${flags.length ? flags.join('; ') : 'none reported'}.`);
  if (context?.length) lines.push(`Logged context: ${context.join('; ')}.`);
  if (noisy) lines.push('Note: test measured without a passing noise check.');
  lines.push('Absolute thresholds are on an uncalibrated scale; only the change from baseline is meaningful.');
  return lines.join('\n');
}
