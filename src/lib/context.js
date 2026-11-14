// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// "How unusual is this?" Automatic comparisons of a result against each reference dataset.
// Every comparison returns { id, question, source, verdict, level, detail, value?, normal? } so the UI
// can show a compact strip or a full row.
import lsah from '../data/lsah.json';
import pret from '../data/pret_lnsat.json';
import { LIMITS } from './noise.js';

// --- 1. Test error (Wexler et al. 2026): 10 dB is about two standard deviations of portable-test error.
const TEST_ERROR_SD = 5;

export function testErrorComparison(changeDb) {
  const z = changeDb / TEST_ERROR_SD;
  let verdict, level;
  if (changeDb >= 10) { verdict = 'Larger than test error: unlikely to be chance.'; level = 'flag'; }
  else if (changeDb >= 5) { verdict = 'Within test error: could be chance.'; level = 'watch'; }
  else { verdict = 'Well within test error.'; level = 'ok'; }
  return {
    id: 'error',
    question: 'Bigger than test error?',
    source: 'NASA in-flight audiometry, Wexler et al. 2026',
    verdict,
    level,
    detail: `${changeDb >= 0 ? '+' : ''}${changeDb.toFixed(0)} dB is ${Math.abs(z).toFixed(1)} times the typical test-to-test spread of portable hearing tests (about ${TEST_ERROR_SD} dB). NASA uses 10 dB, about two spreads, as its threshold.`,
    value: changeDb,
    normal: [-10, 10],
  };
}

// --- 2. Age (NASA LSAH): expected drift from age at 6 kHz, from the 1998 LSAH table.
const BANDS = [
  { band: '< 35', mid: 32 }, { band: '35-39', mid: 37 }, { band: '40-44', mid: 42 }, { band: '45-49', mid: 47 },
  { band: '50-54', mid: 52 }, { band: '55-59', mid: 57 }, { band: '60+', mid: 62 },
];

export function ageSlopeDbPerYear(age, sex) {
  const group = lsah.table.groups[sex === 'female' ? 'Female Astronauts' : 'Male Astronauts'];
  const pts = BANDS.map((b) => ({ x: b.mid, y: group[b.band] })).filter((p) => Number.isFinite(p.y));
  if (pts.length < 2) return null;
  let i = pts.findIndex((p) => p.x > age);
  if (i <= 0) i = i === 0 ? 1 : pts.length - 1;
  const a = pts[i - 1];
  const b = pts[i];
  return (b.y - a.y) / (b.x - a.x);
}

export function ageComparison(changeDb, { age, sex, years, band }) {
  if (!Number.isFinite(age) || !sex) {
    return { id: 'age', question: 'Explained by age?', source: 'NASA LSAH hearing-by-age table (1998)', verdict: 'Add your age and sex in your profile to compare.', level: 'none', detail: '' };
  }
  if (band === 'low') {
    return {
      id: 'age',
      question: 'Explained by age?',
      source: 'NASA LSAH hearing-by-age table (1998)',
      verdict: 'Age changes low pitches very little over months: not the explanation.',
      level: 'ok',
      detail: 'Age-related loss starts at high pitches. NASA’s public age table covers 6 kHz only.',
    };
  }
  const slope = Math.max(0, ageSlopeDbPerYear(age, sex) ?? 0);
  const expected = slope * years;
  const share = changeDb > 0 ? Math.min(1, expected / changeDb) : 0;
  return {
    id: 'age',
    question: 'Explained by age?',
    source: 'NASA LSAH hearing-by-age table (1998)',
    verdict: share > 0.5 ? 'Age could explain much of this.' : 'Age explains only a small part.',
    level: share > 0.5 ? 'ok' : 'flag',
    detail: `For ${sex === 'female' ? 'female' : 'male'} astronauts around ${age}, hearing at 6 kHz worsens by about ${slope.toFixed(1)} dB a year in NASA's table, so about ${expected.toFixed(1)} dB over ${years.toFixed(1)} years. Approximate: the table compares age groups, not the same people over time.`,
  };
}

// --- 3. How common in flight (NASA Human System Risk Board hearing-loss risk record, Rev B.1, 2025).
const INFLIGHT = { low: 40.4, high: 9.0 };

export function inflightComparison(band) {
  const pct = INFLIGHT[band];
  return {
    id: 'inflight',
    question: 'Common in spaceflight?',
    source: 'NASA hearing-loss risk record, Rev B.1 (2025)',
    verdict: band === 'low' ? 'Yes: a known in-flight pattern.' : 'Less common in flight: worth attention.',
    level: band === 'low' ? 'ok' : 'flag',
    detail:
      band === 'low'
        ? `${pct}% of NASA in-flight hearing tests show a low-pitch shift. Its cause is unknown; fluid shifts and pressure inside the head are leading ideas.`
        : `${pct}% of NASA in-flight hearing tests show a high-pitch shift, the pattern noise usually causes.`,
    value: pct,
  };
}

// --- 4. Noise (NASA station levels, flight rule): the astronaut's last planned day from the station view.
export function noiseComparison(band, day) {
  if (!day) {
    return { id: 'noise', question: 'Could noise explain it?', source: 'NASA ISS acoustics (Allen 2024), Flight Rule B13-152', verdict: 'Plan your day in Station noise to compare.', level: 'none', detail: '' };
  }
  const over = day.leqDba > LIMITS.workdayRequireDba;
  if (band === 'low') {
    return {
      id: 'noise',
      question: 'Could noise explain it?',
      source: 'NASA ISS acoustics (Allen 2024), Flight Rule B13-152',
      verdict: 'Unlikely to be the main cause.',
      level: 'ok',
      detail: `Your planned workday averages ${day.leqDba.toFixed(1)} dBA. Noise damage usually shows at high pitches first, so a low-pitch shift points elsewhere (pressure, fluid shifts, ear blockage).`,
    };
  }
  return {
    id: 'noise',
    question: 'Could noise explain it?',
    source: 'NASA ISS acoustics (Allen 2024), Flight Rule B13-152',
    verdict: over ? 'Plausible: your days exceed the flight-rule limit.' : 'Your planned days are within the flight rule.',
    level: over ? 'flag' : 'ok',
    detail: `Your planned workday averages ${day.leqDba.toFixed(1)} dBA (limit 72 dBA without hearing protection).`,
  };
}

// --- 5. Auditory thinking tasks (CSA PRET): normal variation and whether hearing could explain a drop.
const DROP = 2;

export function pretPopulation() {
  let later = 0;
  let drops = 0;
  for (const p of pret.people) {
    const lv = p.sessions.map((s) => s.highestLevelPassed);
    const base = (lv[0] + lv[1]) / 2;
    for (const v of lv.slice(2)) {
      later++;
      if (base - v >= DROP) drops++;
    }
  }
  return { later, drops, rate: drops / later, participants: pret.participants };
}

export function cognitionComparison(series, hearingShift) {
  const pop = pretPopulation();
  const source = 'Canadian Space Agency PRET open data, auditory task (v5.0, 40 volunteers × 10 sessions)';
  if (!series?.length) {
    return {
      id: 'cognition',
      question: 'Would it affect thinking tests?',
      source,
      verdict: hearingShift ? 'Possibly: heard tasks may score lower.' : 'No hearing change to account for.',
      level: hearingShift ? 'watch' : 'ok',
      detail: `No auditory-task results on record. In CSA's PRET simulator, 2 of 6 cognitive tasks are heard through speakers. ${hearingShift ? 'Tell whoever reviews your cognitive tests about this hearing change.' : ''}`,
    };
  }
  const lv = series.map((s) => s.level);
  const base = (lv[0] + lv[1]) / 2;
  const latest = lv[lv.length - 1];
  const dropped = base - latest >= DROP;
  let verdict, level;
  if (dropped && hearingShift) { verdict = 'Auditory task dropped while hearing shifted: check hearing first.'; level = 'flag'; }
  else if (dropped) { verdict = 'Auditory task dropped, hearing steady: hearing does not explain it.'; level = 'watch'; }
  else { verdict = 'Auditory task steady.'; level = 'ok'; }
  return {
    id: 'cognition',
    question: 'Would it affect thinking tests?',
    source,
    verdict,
    level,
    detail: `Latest level ${latest}, personal baseline ${base.toFixed(1)}. Among ${pop.participants} CSA volunteers, a drop of ${DROP}+ levels happened in only ${pop.drops} of ${pop.later} sessions (${(pop.rate * 100).toFixed(1)}%), so a drop this size is unusual.`,
    series: lv,
    base,
  };
}

// --- Gather everything the comparisons need from the stored state.
export function contextInputs(data) {
  const profile = data.profile ?? {};
  const baselines = data.tests.filter((t) => t.role === 'baseline' && t.complete);
  const checks = data.tests.filter((t) => t.role !== 'baseline' && t.complete);
  const latest = checks[checks.length - 1];
  let years = 0;
  if (baselines.length && latest) {
    if (Number.isFinite(latest.missionDay) && Number.isFinite(baselines[0].missionDay)) years = (latest.missionDay - baselines[0].missionDay) / 365;
    else years = (new Date(latest.date) - new Date(baselines[0].date)) / (365 * 86400000);
  }
  let day = data.plannedDay ?? null;
  if (!day) {
    try {
      day = JSON.parse(localStorage.getItem('earshot.plannedDay') || 'null');
    } catch {
      day = null;
    }
  }
  return {
    age: Number(profile.age),
    sex: profile.sex,
    years: Math.max(0, years),
    day,
    cognition: data.cognition ?? null,
    hearingShift: (latest?.confirmedFindings ?? []).some((f) => f.kind !== 'sudden') || (latest?.confirmedFindings ?? []).length > 0,
  };
}

export function bandOf(frequency) {
  if (frequency <= 500) return 'low';
  if (frequency >= 2000) return 'high';
  return null;
}

// All comparisons for one change (a finding's band average, or one region's change).
export function compareAll(changeDb, band, inputs) {
  const rows = [testErrorComparison(changeDb)];
  if (band) {
    rows.push(ageComparison(changeDb, { age: inputs.age, sex: inputs.sex, years: inputs.years, band }));
    rows.push(inflightComparison(band));
    rows.push(noiseComparison(band, inputs.day));
  }
  rows.push(cognitionComparison(inputs.cognition, inputs.hearingShift));
  return rows;
}
