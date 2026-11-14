// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Hearing vs. thinking: an auditory cognitive task can drop because of hearing, not cognition.
// Uses the Canadian Space Agency's PRET open data (version 5.0, Letter-Number Sequencing Auditory Task,
// 40 ground volunteers x 10 sessions, 2015; Open Government Licence - Canada) to set what a normal
// session-to-session change looks like, with the same personal-baseline logic Earshot uses for hearing.
import { useMemo, useState } from 'react';
import pret from '../data/pret_lnsat.json';

const DROP = 2; // levels below the personal baseline

function stats() {
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
  return { later, drops, rate: drops / later };
}

export default function CrossCheck({ hearingFindings }) {
  const [who, setWho] = useState(1);
  const [today, setToday] = useState(null);
  const s = useMemo(stats, []);
  const person = pret.people.find((p) => p.participant === who);
  const levels = person.sessions.map((x) => x.highestLevelPassed);
  const base = (levels[0] + levels[1]) / 2;
  const dropped = today !== null && base - today >= DROP;
  const hearingShift = hearingFindings.length > 0;

  const W = 520, H = 160, L = 30, R = 10, T = 10, B = 26;
  const X = (i) => L + (i / 9) * (W - L - R);
  const Y = (v) => T + ((6 - v) / 6) * (H - T - B);

  let verdict = null;
  if (today !== null) {
    if (!dropped) verdict = { cls: 'ok', text: 'Within your normal range on this task. Nothing to cross-check.' };
    else if (hearingShift)
      verdict = {
        cls: 'shift',
        text: 'Your auditory task score dropped AND Earshot shows a confirmed hearing shift. Check hearing first: the task is heard through speakers, so the drop may be hearing, not thinking. Tell the crew medical officer both results together.',
      };
    else
      verdict = {
        cls: 'watch',
        text: 'Your auditory task score dropped, but your hearing is steady against your baseline. Hearing does not explain it; consider fatigue, sleep, or a noisy room during the task, and talk to the crew medical officer if it repeats.',
      };
  }

  return (
    <section className="crosscheck">
      <h2>Hearing or thinking? A cross-check with CSA data</h2>
      <p className="lede">
        Cognitive tests in space often use sound. In the Canadian Space Agency's PRET mission simulator, the letter-number task "is played over
        the computer's speakers", so a hearing change or a noisy module can look like a drop in thinking. Earshot cross-checks the two.
      </p>
      <div className="crosscheck-grid">
        <div>
          <label className="select">
            CSA volunteer
            <select value={who} onChange={(e) => { setWho(Number(e.target.value)); setToday(null); }}>
              {pret.people.map((p) => <option key={p.participant} value={p.participant}>#{p.participant}</option>)}
            </select>
          </label>
          <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Auditory task level over 10 sessions">
            {[0, 2, 4, 6].map((t) => (
              <g key={t}>
                <line x1={L} x2={W - R} y1={Y(t)} y2={Y(t)} className="grid" />
                <text x={L - 6} y={Y(t) + 4} textAnchor="end" className="axis">{t}</text>
              </g>
            ))}
            <rect x={L} width={W - L - R} y={Y(base + 1.5)} height={Y(base - DROP + 0.5) - Y(base + 1.5)} className="band" />
            <line x1={L} x2={W - R} y1={Y(base)} y2={Y(base)} className="baseline" />
            <path d={levels.map((v, i) => `${i ? 'L' : 'M'}${X(i)},${Y(v)}`).join(' ')} className="series" />
            {levels.map((v, i) => <circle key={i} cx={X(i)} cy={Y(v)} r="3.5" className="dot" />)}
            {person.sessions.map((x, i) => (
              <text key={i} x={X(i)} y={H - 8} textAnchor="middle" className="axis">{i + 1}</text>
            ))}
          </svg>
          <p className="muted">
            Highest level passed in each of 10 sessions ({person.sessions[0].date} to {person.sessions[9].date}). Line: personal baseline
            (first two sessions). Band: normal range.
          </p>
        </div>
        <div>
          <p>
            Across all {pret.participants} volunteers, a drop of {DROP} or more levels below their own baseline happened in only{' '}
            <strong>{s.drops} of {s.later} later sessions ({(s.rate * 100).toFixed(1)}%)</strong>. Earshot treats that as a real drop, the same
            way it treats 10 dB in hearing.
          </p>
          <p>Try it: what level did this volunteer reach today?</p>
          <div className="tabs">
            {[0, 1, 2, 3, 4, 5].map((v) => (
              <button key={v} className={today === v ? 'tab on' : 'tab'} onClick={() => setToday(v)}>{v}</button>
            ))}
          </div>
          {verdict && <p className={`verdict ${verdict.cls}`}>{verdict.text}</p>}
          <p className="muted">
            Hearing status comes from your Earshot checks: {hearingShift ? 'a confirmed shift is on record.' : 'no confirmed shift on record.'}{' '}
            Volunteers were on the ground, not astronauts; how much a given hearing shift lowers this task's score is not known.
          </p>
        </div>
      </div>
    </section>
  );
}
