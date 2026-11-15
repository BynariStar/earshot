// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// My ears: one verdict first (what changed, how much, what to do), "Why" on request, then the two cochleas
// and one simple line of change over time.
import { useMemo, useState } from 'react';
import Cochlea from './Cochlea.jsx';
import { averageBaselines, shifts, regionStatusFor, FREQUENCIES } from '../lib/rules.js';
import { REGION_INFO } from '../lib/cochlea.js';
import { explain } from '../lib/advice.js';
import { baselineTests, latestCheck, isNoisy } from '../lib/storage.js';
import { hearingState } from '../lib/personal.js';
import Trend from './Trend.jsx';
import { compareAll, contextInputs, bandOf } from '../lib/context.js';

const STATUS_TEXT = {
  untested: 'Not tested yet',
  ok: 'Steady: within 5 dB of your baseline',
  watch: 'Watch: 5 to 9 dB worse, within test error',
  shift: 'Shift: 10 dB or more worse',
  urgent: 'Urgent: 30 dB or more worse',
  unmeasurable: 'Not measurable: no response at baseline',
};
const RANK = { urgent: 4, shift: 3, watch: 2 };
const hz = (f) => (f >= 1000 ? `${f / 1000} kHz` : `${f} Hz`);
const cap = (s) => s[0].toUpperCase() + s.slice(1);

export default function Home({ data, onStartTest, onOpenSudden, simulated }) {
  const [picked, setPicked] = useState(null);
  const baselines = baselineTests(data);
  const check = latestCheck(data);
  const reference = baselines.length >= 2 ? averageBaselines(baselines[0].thresholds, baselines[1].thresholds) : null;

  const statusByEar = useMemo(() => {
    const out = { left: {}, right: {} };
    if (!reference) return out;
    for (const ear of ['left', 'right']) for (const f of FREQUENCIES) out[ear][f] = regionStatusFor(reference[ear][f], check?.thresholds?.[ear]?.[f]);
    return check ? { ...out, raw: shifts(reference, check.thresholds) } : out;
  }, [reference, check]);

  // The region that changed most: the verdict is about it, and the cochlea opens on it.
  const worst = useMemo(() => {
    let best = null;
    for (const ear of ['left', 'right'])
      for (const f of FREQUENCIES) {
        const r = RANK[statusByEar[ear]?.[f]] ?? 0;
        const d = statusByEar.raw?.[ear]?.perFreq?.[f] ?? 0;
        if (r && (!best || r > best.r || (r === best.r && d > best.d))) best = { ear, frequency: f, r, d };
      }
    return best;
  }, [statusByEar]);
  const checkId = check?.id ?? null;
  const selected = picked && picked.checkId === checkId ? picked : worst ?? { ear: 'left', frequency: 4000 };
  const setSelected = (sel) => setPicked({ ...sel, checkId });

  const findings = check?.confirmedFindings ?? [];
  const inputs = contextInputs(data);
  const info = REGION_INFO[selected.frequency];
  const status = statusByEar[selected.ear]?.[selected.frequency] ?? 'untested';
  const delta = statusByEar.raw?.[selected.ear]?.perFreq?.[selected.frequency];

  // The verdict.
  let title, sub, actions = [], why = null, cta = null;
  if (baselines.length < 2) {
    title = baselines.length ? 'Finish your baseline' : 'Set your baseline';
    sub = baselines.length ? 'One more 8-minute test. Every later check compares against these two.' : 'Two 8-minute tests on your own headphones. Every later check compares against them.';
    cta = { label: baselines.length ? 'Baseline test 2 of 2' : 'Baseline test 1 of 2', role: 'baseline' };
  } else if (!check) {
    title = 'Baseline set';
    sub = 'Earshot asks for a check after loud exposures, or you can run one now.';
    cta = { label: 'Check my hearing', role: 'check' };
  } else if (findings.length) {
    const f = findings.find((x) => x.kind === 'sudden') ?? findings[0];
    const e = explain(f);
    title = e.title;
    sub = e.what;
    actions = e.actions;
    if (f.kind !== 'sudden') why = compareAll(f.averageDb, f.kind, inputs);
  } else if (worst) {
    const w = statusByEar.raw[worst.ear].perFreq[worst.frequency];
    title = `${cap(worst.ear)} ear, ${hz(worst.frequency)}: ${Math.round(w)} dB worse than your baseline`;
    sub = `Within test error, so it may be chance.${hearingState(data).state === 'high' ? ' Stricter noise targets are on until it settles.' : ''}`;
    why = compareAll(w, bandOf(worst.frequency), inputs).filter((r) => r.id !== 'cognition');
  } else {
    title = 'Both ears steady';
    sub = 'Every pitch within 5 dB of your baseline.';
  }
  if (!cta && !simulated && check) cta = { label: 'Check my hearing', role: 'check' };
  // An ear with no response at any pitch at baseline can't be tracked; say so once.
  const deafEar = reference && ['left', 'right'].find((e) => FREQUENCIES.every((f) => statusByEar[e]?.[f] === 'unmeasurable'));
  if (deafEar) sub = `${sub} Your ${deafEar} ear gave no response at baseline, so Earshot tracks your ${deafEar === 'left' ? 'right' : 'left'} ear.`;

  return (
    <section className="home">
      <div className="ears-verdict">
        <h2>{title}</h2>
        <p>{sub}</p>
        {check && isNoisy(check) && <p className="noisy-note">This check was measured in noise. Retest somewhere quiet.</p>}
        {actions.length > 0 && <ul className="verdict-actions">{actions.map((a) => <li key={a}>{a}</li>)}</ul>}
        {findings.some((f) => f.kind === 'sudden') && <button className="primary" onClick={onOpenSudden}>Open the sudden-drop response</button>}
        {why && (
          <details className="why">
            <summary>Why</summary>
            <ul>
              {why.filter((r) => r.level !== 'none').map((r) => (
                <li key={r.id}>
                  <strong>{r.question}</strong> {r.verdict} <span className="muted small">{r.source}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
        {cta && <button className="secondary" onClick={() => onStartTest(cta.role)}>{cta.label}</button>}
        {check && <p className="muted small">Last check: {Number.isFinite(check.missionDay) ? `mission day ${check.missionDay}` : new Date(check.date).toLocaleString()}</p>}
      </div>

      <div className="ears">
        {['left', 'right'].map((ear) => (
          <figure key={ear} className="ear">
            <Cochlea ear={ear} statuses={statusByEar[ear]} selected={selected} onSelect={setSelected} />
            <figcaption>{ear === 'right' ? 'Right ear' : 'Left ear'}</figcaption>
          </figure>
        ))}
        <aside className="region-panel" aria-live="polite">
          <h3>
            {selected.ear === 'right' ? 'Right' : 'Left'} ear · {info.label}
          </h3>
          <p className={`status-pill ${status}`}>{STATUS_TEXT[status]}</p>
          {Number.isFinite(delta) && status !== 'unmeasurable' && status !== 'untested' && <p className="muted small">{delta > 0 ? '+' : ''}{delta.toFixed(0)} dB from your baseline (higher = harder to hear)</p>}
          <h4>What this part hears</h4>
          <p>{info.hears}</p>
          <h4>What NASA knows</h4>
          <p>{info.nasa}</p>
        </aside>
      </div>
      <p className="muted small ears-caption">Each band sits where that pitch is heard along the cochlea. Colours compare your latest check with your baseline, using NASA's hearing-shift rules.</p>
      <div className="legend">
        {['ok', 'watch', 'shift', 'urgent', 'unmeasurable', 'untested'].map((s) => (
          <span key={s} className={`legend-item ${s}`}>{STATUS_TEXT[s].split(':')[0]}</span>
        ))}
      </div>
      <Trend reference={reference} checks={data.tests.filter((t) => t.role !== 'baseline' && t.complete)} />
    </section>
  );
}
