// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
import { describe, it, expect } from 'vitest';
import { allowedMinutes, dose, leq, withProtection, workdayStatus, seriesToSegments, EARPLUG_EFFECTIVE_DB } from './noise.js';
import { evaluate, confirm, averageBaselines, baselineAgreement, regionStatus, regionStatusFor } from './rules.js';
import { createSearch, respond, simulate, MAX_LEVEL, NO_RESPONSE_LEVEL } from './threshold.js';
import lmlstp from '../data/lmlstp.json';

describe('NASA noise dose [V2 6115]', () => {
  it('allows 8 hours at 75 dBA and halves time every 3 dB', () => {
    expect(allowedMinutes(75)).toBeCloseTo(480);
    expect(allowedMinutes(78)).toBeCloseTo(240);
    expect(allowedMinutes(72)).toBeCloseTo(960);
  });
  it('gives a dose of 100 for 8 hours at 75 dBA', () => {
    expect(dose([{ dba: 75, minutes: 480 }])).toBeCloseTo(100);
  });
  it('matches the dose computed from the raw NASA chamber files', () => {
    const first = lmlstp.floors[0];
    expect(dose(seriesToSegments(first.series))).toBeCloseTo(first.nasaDose24h, 0);
    expect(leq(seriesToSegments(first.series))).toBeCloseTo(first.leq24hDba, 0);
  });
});

describe('Flight Rule B13-152 worked example (Allen & Danielson 2020)', () => {
  // One hour on T2 at 84.5 dBA, the other 15 hours at the background level that makes the day 72.8 dBA.
  const background = 61.8;
  const day = [
    { dba: 84.5, minutes: 60, protected: true },
    { dba: background, minutes: 900 },
  ];
  it('reproduces about 72.8 dBA without protection', () => {
    expect(workdayStatus(day).leqDba).toBeCloseTo(72.8, 0);
    expect(workdayStatus(day).status).toBe('protection-required');
  });
  it('reproduces about 63.7 dBA with earplugs on the treadmill', () => {
    const protectedDay = withProtection(day, EARPLUG_EFFECTIVE_DB);
    expect(workdayStatus(protectedDay).leqDba).toBeCloseTo(63.7, 0);
  });
});

const flat = (v) => ({ left: { 250: v, 500: v, 1000: v, 2000: v, 3000: v, 4000: v }, right: { 250: v, 500: v, 1000: v, 2000: v, 3000: v, 4000: v } });

describe('NASA shift rules', () => {
  it('finds nothing when hearing is unchanged', () => {
    expect(evaluate(flat(20), flat(20)).findings).toEqual([]);
  });
  it('flags a low-frequency shift from the 250 and 500 Hz average', () => {
    const cur = flat(20);
    cur.left[250] = 32;
    cur.left[500] = 28;
    const r = evaluate(flat(20), cur);
    expect(r.findings).toEqual([{ kind: 'low', ear: 'left', averageDb: 10, atLeast: false }]);
  });
  it('does not flag a 9 dB low-frequency average', () => {
    const cur = flat(20);
    cur.right[250] = 30;
    cur.right[500] = 28;
    expect(evaluate(flat(20), cur).findings).toEqual([]);
  });
  it('flags a high-frequency shift from the 2, 3 and 4 kHz average', () => {
    const cur = flat(20);
    cur.right[2000] = 30;
    cur.right[3000] = 30;
    cur.right[4000] = 30;
    expect(evaluate(flat(20), cur).findings[0]).toMatchObject({ kind: 'high', ear: 'right' });
  });
  it('puts a sudden 30 dB drop first', () => {
    const cur = flat(20);
    cur.left[4000] = 55;
    cur.left[2000] = 30;
    cur.left[3000] = 30;
    const kinds = evaluate(flat(20), cur).findings.map((f) => f.kind);
    expect(kinds[0]).toBe('sudden');
  });
  it('confirms only findings the retest repeats', () => {
    const cur = flat(20);
    cur.left[250] = 35;
    cur.left[500] = 35;
    const first = evaluate(flat(20), cur);
    expect(confirm(first, evaluate(flat(20), flat(22)))).toEqual([]);
    expect(confirm(first, evaluate(flat(20), cur))).toHaveLength(1);
  });
  it('averages two baselines and spots disagreements', () => {
    const a = flat(20);
    const b = flat(24);
    b.right[250] = 40;
    expect(averageBaselines(a, b).left[500]).toBe(22);
    expect(baselineAgreement(a, b)).toEqual([{ ear: 'right', frequency: 250, difference: 20 }]);
  });
  it('still flags when a pitch becomes inaudible even at the cap', () => {
    const base = flat(30);
    base.left[4000] = 45;
    const cur = flat(30);
    cur.left[2000] = 45;
    cur.left[3000] = 45;
    cur.left[4000] = NO_RESPONSE_LEVEL;
    const kinds = evaluate(base, cur).findings.map((f) => [f.kind, f.atLeast]);
    expect(kinds).toEqual([['sudden', true], ['high', true]]);
  });
  it('treats an ear with no response at baseline as unmeasurable, not steady', () => {
    expect(regionStatusFor(NO_RESPONSE_LEVEL, NO_RESPONSE_LEVEL)).toBe('unmeasurable');
    expect(regionStatusFor(30, 41)).toBe('shift');
    expect(regionStatusFor(30, undefined)).toBe('untested');
    expect(evaluate(flat(NO_RESPONSE_LEVEL), flat(NO_RESPONSE_LEVEL)).findings).toEqual([]);
  });
  it('colours regions by shift size', () => {
    expect(regionStatus(2)).toBe('ok');
    expect(regionStatus(7)).toBe('watch');
    expect(regionStatus(12)).toBe('shift');
    expect(regionStatus(31)).toBe('urgent');
    expect(regionStatus(undefined)).toBe('untested');
  });
});

describe('threshold search', () => {
  it('never goes above the output cap', () => {
    let s = createSearch(1000, 'left');
    while (!s.done) {
      expect(s.level).toBeLessThanOrEqual(MAX_LEVEL);
      s = respond(s, false);
    }
    expect(s.outcome).toBe('no-response');
    expect(s.threshold).toBe(NO_RESPONSE_LEVEL);
  });
  it('reaches the cap in 4 tones for an ear that hears nothing (ASHA: +20, then +10)', () => {
    let s = createSearch(1000, 'right');
    const levels = [];
    while (!s.done) {
      levels.push(s.level);
      s = respond(s, false);
    }
    expect(levels).toEqual([40, 60, 70, 80]);
  });
  it('lands within 5 dB of a simulated listener most of the time', () => {
    let seed = 42;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    let close = 0;
    const runs = 200;
    for (let i = 0; i < runs; i++) {
      const r = simulate(1000, 'left', 30, { rng });
      if (r.outcome === 'threshold' && Math.abs(r.threshold - 30) <= 5) close++;
    }
    expect(close / runs).toBeGreaterThan(0.85);
  });
});

import { ageSlopeDbPerYear, pretPopulation, testErrorComparison, compareAll } from './context.js';
describe('dataset comparisons', () => {
  it('derives about 1 dB/year at 6 kHz for a 47-year-old male astronaut from NASA LSAH', () => {
    expect(ageSlopeDbPerYear(47, 'male')).toBeCloseTo((30.84 - 25.47) / 5, 2);
  });
  it('finds 6 of 320 later CSA PRET sessions with a 2-level drop', () => {
    const p = pretPopulation();
    expect(p.later).toBe(320);
    expect(p.drops).toBe(6);
  });
  it('treats 10 dB as beyond test error', () => {
    expect(testErrorComparison(10).level).toBe('flag');
    expect(testErrorComparison(4).level).toBe('ok');
  });
  it('returns five comparisons for a band change', () => {
    expect(compareAll(12, 'high', { age: 47, sex: 'male', years: 0.5, day: null, cognition: null, hearingShift: true })).toHaveLength(5);
  });
});
