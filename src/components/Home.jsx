// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
import { useMemo, useState } from 'react';
import Cochlea from './Cochlea.jsx';
import { averageBaselines, shifts, regionStatus, FREQUENCIES } from '../lib/rules.js';
import { REGION_INFO } from '../lib/cochlea.js';
import { explain } from '../lib/advice.js';
import { baselineTests, latestCheck } from '../lib/storage.js';

const STATUS_TEXT = {
  untested: 'Not tested yet',
  ok: 'Steady: within 5 dB of your baseline',
  watch: 'Watch: 5 to 9 dB worse than your baseline (within test-to-test variation)',
  shift: 'Shift: 10 dB or more worse than your baseline',
  urgent: 'Urgent: 30 dB or more worse than your baseline',
};

export default function Home({ data, onStartTest }) {
  const [selected, setSelected] = useState({ ear: 'right', frequency: 4000 });
  const baselines = baselineTests(data);
  const check = latestCheck(data);
  const reference = baselines.length >= 2 ? averageBaselines(baselines[0].thresholds, baselines[1].thresholds) : null;

  const statusByEar = useMemo(() => {
    const out = { left: {}, right: {} };
    if (!reference || !check) return out;
    const s = shifts(reference, check.thresholds);
    for (const ear of ['left', 'right']) for (const f of FREQUENCIES) out[ear][f] = regionStatus(s[ear].perFreq[f]);
    return { ...out, raw: s };
  }, [reference, check]);

  const findings = check?.confirmedFindings ?? [];
  const info = REGION_INFO[selected.frequency];
  const status = statusByEar[selected.ear]?.[selected.frequency] ?? 'untested';
  const delta = statusByEar.raw?.[selected.ear]?.perFreq?.[selected.frequency];

  let callToAction;
  if (baselines.length === 0) callToAction = { label: 'Set your baseline (test 1 of 2)', role: 'baseline' };
  else if (baselines.length === 1) callToAction = { label: 'Finish your baseline (test 2 of 2)', role: 'baseline' };
  else callToAction = { label: 'Check my hearing', role: 'check' };

  return (
    <section className="home">
      <div className="home-intro">
        <h1>Your inner ear, by pitch</h1>
        <p>
          Each coloured band sits where that pitch is heard along your cochlea: high pitches at the outer base, low pitches near the
          centre. Colours compare your latest check with your own baseline, using NASA's hearing-shift rules.
        </p>
        <button className="primary" onClick={() => onStartTest(callToAction.role)}>
          {callToAction.label}
        </button>
        {check && <p className="muted">Last check: {new Date(check.date).toLocaleString()}</p>}
      </div>

      {findings.length > 0 && (
        <div className="findings">
          {findings.map((f, i) => {
            const e = explain(f);
            return (
              <article key={i} className={`finding ${e.level}`}>
                <h3>{e.title}</h3>
                <p>{e.what}</p>
                <ul>{e.actions.map((a) => <li key={a}>{a}</li>)}</ul>
              </article>
            );
          })}
        </div>
      )}

      <div className="ears">
        {['right', 'left'].map((ear) => (
          <figure key={ear} className="ear">
            <Cochlea ear={ear} statuses={statusByEar[ear]} selected={selected} onSelect={setSelected} />
            <figcaption>{ear === 'right' ? 'Right ear' : 'Left ear'}</figcaption>
          </figure>
        ))}
        <aside className="region-panel" aria-live="polite">
          <h2>
            {selected.ear === 'right' ? 'Right' : 'Left'} ear · {info.label}
          </h2>
          <p className={`status-pill ${status}`}>{STATUS_TEXT[status]}</p>
          {Number.isFinite(delta) && <p className="muted">Change from baseline: {delta > 0 ? '+' : ''}{delta.toFixed(0)} dB (higher = harder to hear)</p>}
          <h3>What this part hears</h3>
          <p>{info.hears}</p>
          <h3>What NASA knows</h3>
          <p>{info.nasa}</p>
        </aside>
      </div>
      <div className="legend">
        {['ok', 'watch', 'shift', 'urgent', 'untested'].map((s) => (
          <span key={s} className={`legend-item ${s}`}>{STATUS_TEXT[s].split(':')[0]}</span>
        ))}
      </div>
    </section>
  );
}
