// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
import { useMemo, useState } from 'react';
import Cochlea from './Cochlea.jsx';
import { averageBaselines, shifts, regionStatusFor, FREQUENCIES } from '../lib/rules.js';
import { REGION_INFO } from '../lib/cochlea.js';
import { explain } from '../lib/advice.js';
import { baselineTests, latestCheck, isNoisy } from '../lib/storage.js';
import Trend from './Trend.jsx';
import ContextStrip from './ContextStrip.jsx';
import { compareAll, contextInputs, bandOf } from '../lib/context.js';

const STATUS_TEXT = {
  untested: 'Not tested yet',
  ok: 'Steady: within 5 dB of your baseline',
  watch: 'Watch: 5 to 9 dB worse than your baseline (within test-to-test variation)',
  shift: 'Shift: 10 dB or more worse than your baseline',
  urgent: 'Urgent: 30 dB or more worse than your baseline',
  unmeasurable: 'Not measurable: no response here at baseline, so a change can’t be tracked',
};
const RANK = { urgent: 4, shift: 3, watch: 2 };

export default function Home({ data, onStartTest, onLoadDemo, onExitDemo, onOpenNormal, onOpenSudden }) {
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

  // Open on the region that changed most, so the first thing you see is what matters. A region you
  // click stays selected until a new check comes in.
  const worst = useMemo(() => {
    let best = null;
    for (const ear of ['left', 'right'])
      for (const f of FREQUENCIES) {
        const r = RANK[statusByEar[ear]?.[f]] ?? 0;
        const d = statusByEar.raw?.[ear]?.perFreq?.[f] ?? 0;
        if (r && (!best || r > best.r || (r === best.r && d > best.d))) best = { ear, frequency: f, r, d };
      }
    return best && { ear: best.ear, frequency: best.frequency };
  }, [statusByEar]);
  const checkId = check?.id ?? null;
  const selected = picked && picked.checkId === checkId ? picked : worst ?? { ear: 'left', frequency: 4000 };
  const setSelected = (sel) => setPicked({ ...sel, checkId });

  const findings = check?.confirmedFindings ?? [];
  const inputs = contextInputs(data);
  const info = REGION_INFO[selected.frequency];
  const status = statusByEar[selected.ear]?.[selected.frequency] ?? 'untested';
  const delta = statusByEar.raw?.[selected.ear]?.perFreq?.[selected.frequency];

  let callToAction;
  if (baselines.length === 0) callToAction = { label: 'Set your baseline (test 1 of 2)', role: 'baseline' };
  else if (baselines.length === 1) callToAction = { label: 'Finish your baseline (test 2 of 2)', role: 'baseline' };
  else callToAction = { label: 'Check my hearing', role: 'check' };

  return (
    <section className="home">
      {data.demo && (
        <div className="demo-banner">
          <strong>Demo astronaut: simulated data, not a real person.</strong> The pattern follows NASA's reported in-flight
          low-frequency shifts. <button className="link-button" onClick={onExitDemo}>Exit demo</button>
        </div>
      )}
      <div className="home-intro">
        <h1>Your inner ear, by pitch</h1>
        <p>
          Each coloured band sits where that pitch is heard along your cochlea: high pitches at the outer base, low pitches near the
          centre. Colours compare your latest check with your own baseline, using NASA's hearing-shift rules.
        </p>
        {data.demo ? (
          <button className="primary" onClick={onExitDemo}>
            Exit demo to test yourself
          </button>
        ) : (
          <button className="primary" onClick={() => onStartTest(callToAction.role)}>
            {callToAction.label}
          </button>
        )}
        {!data.demo && data.tests.length === 0 && (
          <button className="link-button" onClick={onLoadDemo}>or explore with a simulated demo astronaut</button>
        )}
        {check && (
          <p className="muted">
            Last check: {Number.isFinite(check.missionDay) ? `mission day ${check.missionDay}` : new Date(check.date).toLocaleString()}
          </p>
        )}
        {check && isNoisy(check) && (
          <p className="noisy-note">Your latest check was measured in noise. Treat its colours as unreliable and retest somewhere quiet.</p>
        )}
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
                {f.kind === 'sudden' && <button className="primary" onClick={onOpenSudden}>Open the sudden-drop response</button>}
                {f.kind !== 'sudden' && <ContextStrip rows={compareAll(f.averageDb, f.kind, inputs)} onMore={onOpenNormal} />}
              </article>
            );
          })}
        </div>
      )}

      <div className="ears">
        {['left', 'right'].map((ear) => (
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
          {Number.isFinite(delta) && status !== 'unmeasurable' && <p className="muted">Change from baseline: {delta > 0 ? '+' : ''}{delta.toFixed(0)} dB (higher = harder to hear)</p>}
          <h3>What this part hears</h3>
          <p>{info.hears}</p>
          <h3>What NASA knows</h3>
          <p>{info.nasa}</p>
          {Number.isFinite(delta) && status !== 'unmeasurable' && delta >= 5 && <ContextStrip rows={compareAll(delta, bandOf(selected.frequency), inputs)} onMore={onOpenNormal} />}
        </aside>
      </div>
      <Trend reference={reference} checks={data.tests.filter((t) => t.role !== 'baseline' && t.complete)} />
      <div className="legend">
        {['ok', 'watch', 'shift', 'urgent', 'unmeasurable', 'untested'].map((s) => (
          <span key={s} className={`legend-item ${s}`}>{STATUS_TEXT[s].split(':')[0]}</span>
        ))}
      </div>
    </section>
  );
}
