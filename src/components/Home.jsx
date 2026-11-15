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
import Trend from './Trend.jsx';
import { contextInputs, cognitionComparison } from '../lib/context.js';
import Info from './Info.jsx';

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

export default function Home({ data, onStartTest, onOpenSudden, simulated, earplugs = [], go }) {
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
  const shown = picked && picked.checkId === checkId ? picked : null; // the region popover, open on tap only
  const selected = shown ?? worst ?? { ear: 'left', frequency: 4000 };
  const setSelected = (sel) => setPicked({ ...sel, checkId });

  const findings = check?.confirmedFindings ?? [];
  const inputs = contextInputs(data);
  const firstSentence = (t) => t.split(/(?<=\.)\s/)[0];

  // The verdict: one sentence, one action.
  let title, sub, more = null, todo = [], cta = null;
  if (baselines.length < 2) {
    title = baselines.length ? 'Finish your baseline' : 'Set your baseline';
    sub = baselines.length ? 'One more 8-minute test.' : 'Two 8-minute tests on your own headphones.';
    more = 'Every later check compares against these two tests, on the same headphones and volume.';
    cta = { label: baselines.length ? 'Baseline test 2 of 2' : 'Baseline test 1 of 2', role: 'baseline' };
  } else if (!check) {
    title = 'Baseline set';
    sub = 'Earshot asks for a check after loud exposures.';
    cta = { label: 'Full check', role: 'check' };
  } else if (findings.length) {
    const f = findings.find((x) => x.kind === 'sudden') ?? findings[0];
    const e = explain(f);
    title = e.title;
    sub = firstSentence(e.what);
    more = e.what.slice(sub.length).trim() || null;
    todo = e.actions.slice(0, 3);
  } else if (worst) {
    const w = statusByEar.raw[worst.ear].perFreq[worst.frequency];
    title = `${cap(worst.ear)} ear, ${hz(worst.frequency)}: ${Math.round(w)} dB worse`;
    sub = 'Within test error, so it may be chance.';
    more = "Portable hearing tests vary by about 5 dB from test to test; NASA counts 10 dB as a shift (Wexler et al. 2026). Earshot keeps watching this pitch and asks for a check after loud days.";
  } else {
    title = 'Both ears steady';
    sub = 'Every pitch within 5 dB of your baseline.';
  }
  const deafEar = reference && ['left', 'right'].find((e) => FREQUENCIES.every((f) => statusByEar[e]?.[f] === 'unmeasurable'));
  if (deafEar) sub = `${sub} Your ${deafEar} ear gave no response at baseline, so Earshot tracks your ${deafEar === 'left' ? 'right' : 'left'} ear.`;
  if (!cta && !simulated && check) cta = { label: 'Full check', role: 'check' };
  // Canadian Space Agency PRET data: one sentence, only when it changes the conclusion.
  const cog = data.cognition?.length ? cognitionComparison(inputs.cognition, inputs.hearingShift) : null;
  const cogLine =
    cog?.level === 'flag'
      ? 'Your auditory memory score dropped too. That is likely your hearing, not your thinking.'
      : cog?.level === 'watch' && data.cognition?.length
        ? 'Your auditory memory score dropped, but your hearing is steady, so hearing does not explain it.'
        : null;

  const info = REGION_INFO[selected.frequency];
  const status = statusByEar[selected.ear]?.[selected.frequency] ?? 'untested';
  const delta = statusByEar.raw?.[selected.ear]?.perFreq?.[selected.frequency];

  return (
    <section className="home ears-page">
      <div className="ears-verdict">
        <h2>{title}</h2>
        <p>
          {sub}
          {more && <Info>{more}</Info>}
        </p>
        {check && isNoisy(check) && <p className="noisy-note">This check was measured in noise. Retest somewhere quiet.</p>}
        {todo.length > 0 && (
          <div className="todo">
            <span className="label-caps">What to do</span>
            <ul>{todo.map((a) => <li key={a}>{a}</li>)}</ul>
          </div>
        )}
        {findings.some((f) => f.kind === 'sudden') && <button className="primary" onClick={onOpenSudden}>Open the sudden-drop response</button>}
        {earplugs.length > 0 && (findings.length ? findings.some((f) => f.kind === 'high') : !!worst && worst.frequency >= 2000) && (
          <p>
            Earshot has added earplugs to today: {earplugs.join(', ')}. <button className="link-button inline-link" onClick={() => go('plan')}>See today</button>
          </p>
        )}
        {cogLine && (
          <p>
            {cogLine}
            <Info>{`Canadian Space Agency PRET open data: ${cog.detail}`}</Info>
          </p>
        )}
        <div className="action-bar">
          <div className="action-bar-inner">
            {reference && <button className="primary" onClick={() => go('quick/general')}>Quick check · 2 min</button>}
            {cta && <button className={reference ? 'secondary' : 'primary'} onClick={() => onStartTest(cta.role)}>{cta.role === 'check' ? 'Full check · 8 min' : cta.label}</button>}
          </div>
        </div>
      </div>

      <div className="ears two">
        {['left', 'right'].map((ear) => (
          <figure key={ear} className="ear">
            <Cochlea ear={ear} statuses={statusByEar[ear]} selected={selected} onSelect={setSelected} />
            <figcaption>{ear === 'right' ? 'Right ear' : 'Left ear'}</figcaption>
            {shown && shown.ear === ear && (
              <div className="ear-pop" role="dialog" aria-label={`${cap(ear)} ear, ${info.label}`}>
                <button className="sheet-close" onClick={() => setPicked(null)} aria-label="Close">×</button>
                <strong>{info.label}</strong>
                <p className={`status-text ${status}`}>
                  <span className="status-icon" aria-hidden="true">{{ ok: '✓', watch: '◐', shift: '▲', urgent: '!', unmeasurable: '–', untested: '○' }[status]}</span> {STATUS_TEXT[status]}
                  {Number.isFinite(delta) && status !== 'unmeasurable' && status !== 'untested' ? ` (${delta > 0 ? '+' : ''}${delta.toFixed(0)} dB)` : ''}
                </p>
                <p className="muted small">{info.hears}</p>
              </div>
            )}
          </figure>
        ))}
      </div>
      <p className="muted small ears-caption">
        Tap a band for details.
        <Info>
          Each band sits where that pitch is heard along the cochlea: high pitches near the entrance, low pitches at the centre. Colours compare your latest check with your
          baseline, using NASA's hearing-shift rules: green steady, yellow 5 to 9 dB worse, orange 10 dB or more, red 30 dB or more, grey no response at baseline.
        </Info>
      </p>
      <Trend reference={reference} checks={data.tests.filter((t) => t.role !== 'baseline' && t.complete)} />
    </section>
  );
}
