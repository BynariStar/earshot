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

describe("NASA's full NEET worked example (Allen & Danielson 2020)", () => {
  // T2 84.5 dBA 1 h, ARED 66.3 1.5 h, MRM1 65.3 2 h, Node 2 63.8 2 h, Node 1 60.2 1 h, US segment 59.5 8.5 h.
  const rest = [
    { dba: 66.3, minutes: 90 },
    { dba: 65.3, minutes: 120 },
    { dba: 63.8, minutes: 120 },
    { dba: 60.2, minutes: 60 },
    { dba: 59.5, minutes: 510 },
  ];
  it('gives 72.8 dBA without earplugs and 63.7 dBA with them (70.3 dBA effective)', () => {
    // NASA reports one decimal place, so allow rounding (within 0.1 dB).
    expect(Math.abs(workdayStatus([{ dba: 84.5, minutes: 60 }, ...rest]).leqDba - 72.8)).toBeLessThan(0.1);
    expect(Math.abs(workdayStatus([{ dba: 70.3, minutes: 60 }, ...rest]).leqDba - 63.7)).toBeLessThan(0.1);
  });
});

import { computePlan, setActivity, DEFAULT_PLAN, WORKDAY_MIN } from './plan.js';
describe('activity-first workday plan', () => {
  it('always fills exactly 16 hours, plus 8 of sleep', () => {
    const r = computePlan(DEFAULT_PLAN);
    expect(r.day.reduce((a, s) => a + s.minutes, 0)).toBe(WORKDAY_MIN);
    expect(r.parts.find((p) => p.id === 'sleep').minutes).toBe(480);
  });
  it('trims an activity so the workday cannot overflow', () => {
    let p = { ...DEFAULT_PLAN, activities: { t2: 0, ared: 0 } };
    for (const id of ['t2', 'ared']) p = setActivity(p, id, 10000);
    expect(p.activities.t2 + p.activities.ared).toBeLessThanOrEqual(WORKDAY_MIN);
    expect(p.activities.t2).toBe(180);
  });
  it('shows the treadmill hour dominating the allowance', () => {
    const r = computePlan({ ...DEFAULT_PLAN, activities: { t2: 60, ared: 0 } });
    expect(r.top.id).toBe('t2');
    expect(Math.round(r.top.dosePct)).toBe(112);
  });
});

import { clinicalCriteria, windowStatus } from './sudden.js';
describe('sudden-drop decision support', () => {
  it('applies the clinical definition: 30 dB at three neighbouring pitches', () => {
    const cur = flat(20);
    cur.right[2000] = 55; cur.right[3000] = 60; cur.right[4000] = 50;
    expect(clinicalCriteria(flat(20), cur, 'right')).toMatchObject({ met: true, frequencies: [2000, 3000, 4000] });
    const two = flat(20);
    two.right[1000] = 55; two.right[3000] = 55; two.right[4000] = 55;
    expect(clinicalCriteria(flat(20), two, 'right').met).toBe(false);
  });
  it('places the day in the guideline windows', () => {
    expect(windowStatus(1).phase).toBe('initial');
    expect(windowStatus(20).phase).toBe('salvage');
    expect(windowStatus(60).phase).toBe('late');
  });
});

import { pressureDelta, SPEC_WORK_DBA, SPEC_SLEEP_DBA, BASES, baseLevel } from './bases.js';
describe('simulated bases', () => {
  it('converts NASA NC curves to dBA', () => {
    console.log('NC-50 dBA', SPEC_WORK_DBA.toFixed(2), 'NC-40 dBA', SPEC_SLEEP_DBA.toFixed(2));
    expect(SPEC_WORK_DBA).toBeGreaterThan(56);
    expect(SPEC_WORK_DBA).toBeLessThan(61);
    expect(SPEC_SLEEP_DBA).toBeLessThan(SPEC_WORK_DBA - 8);
  });
  it('estimates the exploration-atmosphere effect on fan noise', () => {
    const a = pressureDelta('8.2');
    const b = pressureDelta('10.2');
    console.log('8.2 psia', a.rho.toFixed(3), a.sameSpeed.toFixed(2), a.sameMass.toFixed(2), '| 10.2 psia', b.rho.toFixed(3), b.sameSpeed.toFixed(2), b.sameMass.toFixed(2));
    expect(a.sameSpeed).toBeCloseTo(-7.4, 0);
    expect(a.sameMass).toBeCloseTo(4.9, 0);
    expect(b.sameSpeed).toBeCloseTo(-4.7, 0);
    expect(pressureDelta('14.7').applied).toBeCloseTo(0, 6);
  });
  it('uses NC-50 for Moon sleep (30-day missions) and NC-40 for Mars', () => {
    const opts = { basis: 'spec', atm: '8.2', fans: 'same-speed', mode: 'avg', t: 0 };
    const moonSleep = baseLevel(BASES.moon, BASES.moon.parts.find((p) => p.kind === 'sleep'), opts).dba;
    const marsSleep = baseLevel(BASES.mars, BASES.mars.parts.find((p) => p.kind === 'sleep'), opts).dba;
    expect(moonSleep).toBeCloseTo(SPEC_WORK_DBA, 6);
    expect(marsSleep).toBeCloseTo(SPEC_SLEEP_DBA, 6);
  });
});


import { setPlaceMinutes } from './plan.js';
import { TARGETS, planChecks } from './personal.js';
describe('planner with places, protection, earphones and personal targets', () => {
  it('caps listed places so the workday never overflows 16 hours', () => {
    let p = { ...DEFAULT_PLAN, places: [{ id: 'sm', minutes: 0 }, { id: 'mlm', minutes: 0 }] };
    p = setPlaceMinutes(p, 0, 600);
    p = setPlaceMinutes(p, 1, 600);
    const r = computePlan(p);
    expect(r.day.reduce((a, s) => a + s.minutes, 0)).toBe(WORKDAY_MIN);
    expect(r.activityMinutes).toBeLessThanOrEqual(WORKDAY_MIN);
  });
  it('earphones count toward the allowance even when the treadmill is plugged', () => {
    const quiet = computePlan({ ...DEFAULT_PLAN, protect: { t2: true, ared: false, loudPlaces: false } });
    const loud = computePlan({ ...DEFAULT_PLAN, protect: { t2: true, ared: false, loudPlaces: false }, audio: { minutes: 120, dba: 90 } });
    expect(quiet.dosePct).toBeLessThan(30);
    expect(loud.dosePct).toBeGreaterThan(100);
  });
  it('gives stricter checks for a high-pitch change than for steady ears', () => {
    const r = computePlan({ ...DEFAULT_PLAN, protect: { t2: true, ared: false, loudPlaces: false } });
    const steadyFails = planChecks(r, TARGETS.steady).filter((c) => !c.ok).length;
    const highFails = planChecks(r, TARGETS.high).filter((c) => !c.ok).length;
    expect(highFails).toBeGreaterThan(steadyFails); // e.g. ARED at 66.3 dBA unprotected, sleep above 50
  });
  it('turns the remaining allowance into treadmill minutes', () => {
    const r = computePlan({ ...DEFAULT_PLAN, activities: { t2: 0, ared: 0 } });
    expect(r.headroom(84.5)).toBeGreaterThan(40);
    expect(r.headroom(84.5)).toBeLessThan(54); // all of the allowance would be about 53 min
  });
});

import { PERSONAS, simulatedThresholds } from './personas.js';
import { buildAlerts, quickPitchesFor } from './alerts.js';
import { spectrumOf, dbaOf, likelySource, withFault, faultDelta } from './spectrum.js';
describe('active monitoring', () => {
  it('digitised NASA spectra reproduce NASA\'s dBA within 0.1 dB', () => {
    for (const [id, dba] of [['lab', 59.7], ['cof', 56.8], ['jem', 55.6], ['mlm', 67.4], ['mrm1', 65.2], ['fgb', 61.8]]) {
      expect(Math.abs(dbaOf(spectrumOf(id).bands) - dba)).toBeLessThan(0.15);
    }
  });
  it('NC envelopes stay above the module\'s measured dBA', () => {
    expect(dbaOf(spectrumOf('node2').bands)).toBeGreaterThan(57.5);
  });
  it('names the stalled fan as the likely source of a 500 Hz / 1 kHz rise', () => {
    const n = spectrumOf('node2').bands;
    expect(likelySource(n, withFault(n, 'stalled-fan', 8)).id).toBe('stalled-fan');
    expect(faultDelta('node2')).toBeGreaterThan(2);
  });
  it('a fan fault in a module you work in triggers an exposure alert with targeted pitches', () => {
    const p = PERSONAS.find((x) => x.id === 'high');
    const data = p.state();
    const events = [{ type: 'fan-fault', at: 1 }];
    const alerts = buildAlerts({ station: 'iss', data, events, plan: { placesUsed: ['node2'] }, planFlags: [], hearing: { state: 'high' }, quick: [] });
    expect(alerts.map((a) => a.id)).toEqual(expect.arrayContaining(['fault', 'exposure']));
    expect(quickPitchesFor(events[0])).toEqual([500, 1000, 4000]);
  });
  it('ringing on crew member D leads to a 30+ dB simulated drop', () => {
    const d = PERSONAS.find((x) => x.id === 'sudden');
    expect(simulatedThresholds(d, [{ type: 'ringing' }]).right[3000] - simulatedThresholds(d, []).right[3000]).toBeGreaterThanOrEqual(30);
  });
});

import { liveFrame, incidentPitches, INCIDENTS, CYCLE_S, whereAt, liveHit } from './live.js';
describe('live feed (simulated)', () => {
  it('replays overlapping incidents on a loop and logs them newest first', () => {
    const f = liveFrame('iss', 20);
    expect(f.active.map((x) => x.part)).toEqual(['node2', 'node3']);
    expect(f.log[0].inc.part).toBe('node3');
    const later = liveFrame('iss', CYCLE_S + 20);
    expect(later.active.map((x) => x.part)).toEqual(['node2', 'node3']);
    expect(later.log.some((e) => e.type === 'end')).toBe(true);
  });
  it('every incident sits on a part of its station, and checks test the pitches the noise reaches', () => {
    for (const st of ['iss', 'moon', 'mars']) expect(INCIDENTS[st]).toHaveLength(5);
    expect(incidentPitches(INCIDENTS.iss[0])).toEqual([500, 1000, 4000]);
    expect(incidentPitches(INCIDENTS.iss[3])).toEqual([250, 500, 1000]);
    expect(incidentPitches(INCIDENTS.iss[1])).toEqual([2000, 3000, 4000]);
  });
  it('an incident where the crew member is raises an exposure alert with a targeted check, no question asked', () => {
    // The simulated crew member is in Node 2 when its fan stalls (10 s into the loop).
    expect(whereAt('iss', 12)).toBe('node2');
    const hit = liveHit('iss', 12);
    expect(hit.part).toBe('node2');
    expect(liveHit('iss', 5)).toBeNull();
    // ...and nowhere else in the loop.
    const hits = new Set();
    for (let t = 0; t < CYCLE_S; t++) for (const st of ['iss', 'moon', 'mars']) { const h = liveHit(st, t); if (h) hits.add(`${st}:${h.part}`); }
    expect([...hits].sort()).toEqual(['iss:node2', 'mars:r_work', 'moon:m_work']);
    const data = { tests: [], quick: [] };
    const a = buildAlerts({ station: 'iss', data, events: [{ type: 'live', where: 'Node 2 (Harmony)', part: 'node2', cause: 'Likely a stalled ventilation fan, +4.8 dBA', pitches: incidentPitches(hit), at: 1 }], plan: null, planFlags: [], hearing: null, quick: [] });
    // The popup says wear earplugs and shows the source; the hearing check waits behind the bell.
    const pop = a.filter((x) => x.popup);
    expect(pop.map((x) => x.id)).toEqual(['live-earplugs']);
    expect(pop[0].title).toBe('Node 2 (Harmony) got loud: wear earplugs there');
    expect(pop[0].actions.map((x) => x.to)).toEqual(['home/node2']);
    const ex = a.find((x) => x.id === 'exposure');
    expect(ex.popup).toBeFalsy();
    expect(ex.body).toContain('500 Hz, 1 kHz and 4 kHz');
    expect(ex.actions.map((x) => x.to)).toEqual(['quick/live']);
  });
});

import { customPersona, ageOffsetDb } from './personas.js';
describe('build your own simulated crew member', () => {
  it('ages the starting hearing from NASA LSAH and builds the chosen condition', () => {
    expect(ageOffsetDb(30, 'male')).toBe(0);
    expect(ageOffsetDb(57, 'male')).toBeCloseTo(38.43 - 12.56, 2);
    expect(ageOffsetDb(52, 'female')).toBeCloseTo(15.0 - 8.39, 2); // comparison group where the astronaut table is empty
    const deaf = customPersona({ age: 40, sex: 'female', condition: 'deaf', ear: 'right' }).state();
    expect(deaf.tests[0].thresholds.right[1000]).toBeGreaterThanOrEqual(85);
    const low = customPersona({ age: 40, sex: 'male', condition: 'low', ear: 'right' }).state();
    expect(low.tests[low.tests.length - 1].confirmedFindings.map((f) => `${f.kind}:${f.ear}`)).toContain('low:right');
  });
});
