// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// "Is this normal?": the latest result compared automatically against every reference dataset.
import { averageBaselines, shifts } from '../lib/rules.js';
import { baselineTests, latestCheck } from '../lib/storage.js';
import { compareAll, contextInputs } from '../lib/context.js';
import { explain } from '../lib/advice.js';

const BAND_LABEL = { low: 'low pitches (250-500 Hz)', high: 'high pitches (2-4 kHz)' };

export default function IsThisNormal({ data, onStartTest }) {
  const baselines = baselineTests(data);
  const check = latestCheck(data);
  if (baselines.length < 2 || !check) {
    return (
      <section className="panel">
        <h1>Is this normal?</h1>
        <p>
          After your two baseline tests and at least one check, this page compares every change automatically with NASA and Canadian Space
          Agency data: test error, age, how common it is in spaceflight, your noise exposure, and auditory thinking tasks.
        </p>
        <button className="primary" onClick={onStartTest}>Start with your baseline</button>
      </section>
    );
  }
  const reference = averageBaselines(baselines[0].thresholds, baselines[1].thresholds);
  const s = shifts(reference, check.thresholds);
  const inputs = contextInputs(data);
  const confirmed = check.confirmedFindings ?? [];

  // Rows to examine: confirmed findings first; otherwise the largest band change in either ear.
  let subjects = confirmed.filter((f) => f.kind !== 'sudden').map((f) => ({ ear: f.ear, band: f.kind, change: f.averageDb, finding: f }));
  if (!subjects.length) {
    const all = [];
    for (const ear of ['left', 'right']) for (const band of ['low', 'high']) if (Number.isFinite(s[ear][band])) all.push({ ear, band, change: s[ear][band] });
    all.sort((a, b) => b.change - a.change);
    subjects = all.slice(0, 1);
  }

  return (
    <section className="normal">
      <h1>Is this normal?</h1>
      <p className="lede">
        Your latest check{Number.isFinite(check.missionDay) ? ` (mission day ${check.missionDay})` : ''}, compared automatically with five
        reference datasets. One personal-baseline method, NASA and Canadian Space Agency data together.
      </p>
      {subjects.map((sub) => {
        const rows = compareAll(sub.change, sub.band, inputs);
        const title = sub.finding ? explain(sub.finding).title : `Largest change: ${sub.ear} ear, ${BAND_LABEL[sub.band]}`;
        return (
          <article key={`${sub.ear}-${sub.band}`} className="normal-card">
            <h2>{title}</h2>
            <p className="muted">
              {sub.change >= 0 ? '+' : ''}
              {sub.change.toFixed(1)} dB average change from your baseline in the {sub.ear} ear, {BAND_LABEL[sub.band]}.
            </p>
            <div className="normal-rows">
              {rows.map((r) => (
                <div key={r.id} className={`normal-row ${r.level}`}>
                  <div className="normal-q">
                    <strong>{r.question}</strong>
                    <span className="muted">{r.source}</span>
                  </div>
                  <div className="normal-viz">{r.id === 'error' ? <ErrorBar value={r.value} /> : r.id === 'cognition' && r.series ? <Spark series={r.series} base={r.base} /> : null}</div>
                  <div className="normal-v">
                    <p className="verdict-line">{r.verdict}</p>
                    {r.detail && <p className="muted">{r.detail}</p>}
                  </div>
                </div>
              ))}
            </div>
          </article>
        );
      })}
      {data.demo && (
        <p className="muted">
          Demo: the hearing record is simulated. The auditory-task history is the real record of one CSA PRET volunteer (2015), placed on the
          demo mission's timeline; the pairing is illustrative. The noise day is NASA's own worked example.
        </p>
      )}
    </section>
  );
}

// Change vs. the +/-10 dB band NASA treats as within test error.
function ErrorBar({ value }) {
  const W = 200, H = 34, lo = -20, hi = 30;
  const X = (v) => 6 + ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (W - 12);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mini" role="img" aria-label={`Change ${value.toFixed(0)} dB against the plus or minus 10 dB test-error band`}>
      <rect x={X(-10)} y={10} width={X(10) - X(-10)} height={12} className="mini-band" />
      <line x1={X(0)} x2={X(0)} y1={6} y2={26} className="mini-zero" />
      <circle cx={X(value)} cy={16} r={5} className="mini-dot" />
      <text x={X(-10)} y={33} className="mini-axis" textAnchor="middle">-10</text>
      <text x={X(10)} y={33} className="mini-axis" textAnchor="middle">+10</text>
    </svg>
  );
}

// Auditory-task levels per session with the personal baseline.
function Spark({ series, base }) {
  const W = 200, H = 40;
  const X = (i) => 6 + (i / (series.length - 1)) * (W - 12);
  const Y = (v) => 4 + ((6 - v) / 6) * (H - 8);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mini" role="img" aria-label="Auditory task level per session">
      <line x1={6} x2={W - 6} y1={Y(base)} y2={Y(base)} className="mini-zero" />
      <path d={series.map((v, i) => `${i ? 'L' : 'M'}${X(i)},${Y(v)}`).join(' ')} className="mini-line" />
      {series.map((v, i) => <circle key={i} cx={X(i)} cy={Y(v)} r={2.5} className="mini-dot" />)}
    </svg>
  );
}
