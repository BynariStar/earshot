// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// NASA hearing-shift rules, applied to change from the astronaut's own baseline on the same headphones.
//
// Definitions from NASA's Human System Risk Board hearing-loss risk record (Rev B.1, 2025):
// - Low-frequency shift: average worsening of 10 dB or more at 250 and 500 Hz, in either ear.
// - High-frequency shift: average worsening of 10 dB or more at 2, 3 and 4 kHz, in either ear.
// - Sudden sensorineural hearing loss: a drop of 30 dB or more. We apply it per tested frequency
//   and require an immediate confirming retest before escalating.
// 10 dB is about two standard deviations of portable-audiometer error (Wexler et al. 2026), so a single
// test can cross it by chance; every flag asks for a confirming retest first.

import { NO_RESPONSE_LEVEL } from './threshold.js';

export const FREQUENCIES = [250, 500, 1000, 2000, 3000, 4000];
export const LOW = [250, 500];
export const HIGH = [2000, 3000, 4000];
export const SHIFT_DB = 10;
export const SUDDEN_DB = 30;

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

// thresholds: { left: { 250: dB, ... }, right: { ... } }. Higher number = quieter tone needed louder = worse.
export function shifts(baseline, current) {
  const out = {};
  for (const ear of ['left', 'right']) {
    const perFreq = {};
    for (const f of FREQUENCIES) {
      const b = baseline?.[ear]?.[f];
      const c = current?.[ear]?.[f];
      if (Number.isFinite(b) && Number.isFinite(c)) perFreq[f] = c - b;
    }
    const lowVals = LOW.map((f) => perFreq[f]).filter(Number.isFinite);
    const highVals = HIGH.map((f) => perFreq[f]).filter(Number.isFinite);
    out[ear] = {
      perFreq,
      low: lowVals.length === LOW.length ? mean(lowVals) : null,
      high: highVals.length === HIGH.length ? mean(highVals) : null,
    };
  }
  return out;
}

// "Not heard even at the output cap" is stored as NO_RESPONSE_LEVEL, a lower bound. A finding that
// involves one is marked atLeast: the true change is at least the number shown.
export const isNoResponse = (v) => Number.isFinite(v) && v >= NO_RESPONSE_LEVEL;

// Returns a list of findings, most urgent first.
export function evaluate(baseline, current) {
  const s = shifts(baseline, current);
  const findings = [];
  for (const ear of ['left', 'right']) {
    const e = s[ear];
    const suddenFreqs = Object.entries(e.perFreq)
      .filter(([, d]) => d >= SUDDEN_DB)
      .map(([f]) => Number(f));
    const nr = (fs) => fs.some((f) => isNoResponse(current?.[ear]?.[f]));
    if (suddenFreqs.length) {
      findings.push({ kind: 'sudden', ear, frequencies: suddenFreqs, worst: Math.max(...suddenFreqs.map((f) => e.perFreq[f])), atLeast: nr(suddenFreqs) });
    }
    if (e.low !== null && e.low >= SHIFT_DB) findings.push({ kind: 'low', ear, averageDb: e.low, atLeast: nr(LOW) });
    if (e.high !== null && e.high >= SHIFT_DB) findings.push({ kind: 'high', ear, averageDb: e.high, atLeast: nr(HIGH) });
  }
  const order = { sudden: 0, low: 1, high: 2 };
  findings.sort((a, b) => order[a.kind] - order[b.kind]);
  return { shifts: s, findings };
}

// A finding counts only when a retest taken right after shows the same kind of shift in the same ear.
export function confirm(firstEval, retestEval) {
  return firstEval.findings.filter((f) => retestEval.findings.some((r) => r.kind === f.kind && r.ear === f.ear));
}

// Status for the cochlea: per ear and frequency, a traffic-light colour.
export function regionStatus(shiftDb) {
  if (!Number.isFinite(shiftDb)) return 'untested';
  if (shiftDb >= SUDDEN_DB) return 'urgent';
  if (shiftDb >= SHIFT_DB) return 'shift';
  if (shiftDb >= 5) return 'watch';
  return 'ok';
}

// Status for one region, given the personal reference and the latest value. If the baseline itself
// was "not heard at the cap", a later change can't be measured there.
export function regionStatusFor(refValue, curValue) {
  if (isNoResponse(refValue)) return 'unmeasurable';
  if (!Number.isFinite(refValue) || !Number.isFinite(curValue)) return 'untested';
  return regionStatus(curValue - refValue);
}

// Average two baselines (taken the same day) into one personal reference.
export function averageBaselines(a, b) {
  const out = { left: {}, right: {} };
  for (const ear of ['left', 'right']) {
    for (const f of FREQUENCIES) {
      const x = a?.[ear]?.[f];
      const y = b?.[ear]?.[f];
      if (Number.isFinite(x) && Number.isFinite(y)) out[ear][f] = (x + y) / 2;
      else if (Number.isFinite(x)) out[ear][f] = x;
      else if (Number.isFinite(y)) out[ear][f] = y;
    }
  }
  return out;
}

// Two baselines that disagree by more than 10 dB at a frequency mean the setup isn't stable yet.
export function baselineAgreement(a, b) {
  const problems = [];
  for (const ear of ['left', 'right']) {
    for (const f of FREQUENCIES) {
      const x = a?.[ear]?.[f];
      const y = b?.[ear]?.[f];
      if (Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) > SHIFT_DB) problems.push({ ear, frequency: f, difference: Math.abs(x - y) });
    }
  }
  return problems;
}
