// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Sudden-drop response: decision support for the crew and the flight surgeon after a confirmed drop of
// 30 dB or more. It does not diagnose or recommend treatment. Guideline content: AAO-HNS Clinical Practice
// Guideline, Sudden Hearing Loss (Update), Otolaryngol Head Neck Surg 2019;161(1_suppl):S1-S45.
import { useState } from 'react';
import { averageBaselines } from '../lib/rules.js';
import { baselineTests, latestCheck, isNoisy } from '../lib/storage.js';
import { clinicalCriteria, daysSince, windowStatus, surgeonSummary, INITIAL_WINDOW_DAYS, SALVAGE_TO_DAYS } from '../lib/sudden.js';

const FLAGS = [
  ['both', 'Both ears are affected'],
  ['vertigo', 'Dizziness or spinning'],
  ['neuro', 'Trouble speaking, seeing, or weakness or numbness in the face, arm or leg'],
  ['recurrent', 'This has happened before'],
];
const fmt = (f) => (f >= 1000 ? `${f / 1000} kHz` : `${f} Hz`);
const localInput = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

// An example for demonstrations: a simulated right-ear drop at 2-4 kHz against the demo baseline.
function example(reference) {
  const current = { left: { ...reference.left }, right: { ...reference.right } };
  for (const [f, d] of [[1000, 10], [2000, 35], [3000, 40], [4000, 35]]) current.right[f] = reference.right[f] + d;
  return { ear: 'right', current, onset: new Date(Date.now() - 20 * 3600000), simulated: true };
}

export default function SuddenResponse({ data, onRetest }) {
  const baselines = baselineTests(data);
  const reference = baselines.length >= 2 ? averageBaselines(baselines[0].thresholds, baselines[1].thresholds) : null;
  const check = latestCheck(data);
  const finding = check?.confirmedFindings?.find((f) => f.kind === 'sudden');
  const ex = !finding && data.demo && reference ? example(reference) : null;
  const ear = finding?.ear ?? ex?.ear;
  const current = finding ? check.thresholds : ex?.current;

  const [onset, setOnset] = useState(() => localInput(ex?.onset ?? (check ? new Date(check.date) : new Date())));
  const [hum, setHum] = useState(null);
  const [flags, setFlags] = useState([]);
  const [copied, setCopied] = useState(false);

  if (!reference || !ear) {
    return (
      <section className="sudden">
        <h2>Sudden-drop response</h2>
        <p>
          This opens automatically when a check, confirmed by a retest, shows a drop of 30 dB or more. There's no such finding in your record.
        </p>
        <p className="muted">
          If you notice a sudden change in your hearing, don't wait for a scheduled check: tell your crew medical officer and run a hearing
          check now.
        </p>
      </section>
    );
  }

  const criteria = clinicalCriteria(reference, current, ear);
  const days = daysSince(new Date(onset).toISOString());
  const win = windowStatus(days);
  const neuro = flags.includes('neuro');
  const flagText = FLAGS.filter(([k]) => flags.includes(k)).map(([, t]) => t);
  const summary = surgeonSummary({ ear, onset: new Date(onset).toISOString(), hum, flags: flagText, criteria, context: check?.context, headphones: check?.headphones, noisy: check && isNoisy(check), simulated: !!ex });
  const toggle = (k) => setFlags((f) => (f.includes(k) ? f.filter((x) => x !== k) : [...f, k]));

  return (
    <section className="sudden">
      {ex && <div className="demo-banner"><strong>Example with simulated data.</strong> This is how the response looks after a confirmed sudden drop.</div>}
      <div className="sudden-head">
        <h2>Sudden drop in your {ear} ear: act today</h2>
        <p>
          <strong>Tell your crew medical officer now.</strong> A sudden drop in hearing is time-sensitive. Treatment decisions belong to the
          flight surgeon; this screen gathers what they'll need.
        </p>
      </div>

      {neuro && (
        <div className="sudden-alarm">
          <strong>Neurological symptoms: this may not be only a hearing problem.</strong> Follow your medical emergency procedure and contact
          the ground now.
        </div>
      )}

      <div className="sudden-grid">
        <article className="sudden-card">
          <h3>1 · When did it start?</h3>
          <input type="datetime-local" value={onset} onChange={(e) => setOnset(e.target.value)} />
          <div className="window-bar" aria-hidden="true">
            <div className="w-initial" style={{ width: `${(INITIAL_WINDOW_DAYS / SALVAGE_TO_DAYS) * 100}%` }} />
            <div className="w-salvage" />
            <span className="w-now" style={{ left: `${Math.min(100, Math.max(0, (days / SALVAGE_TO_DAYS) * 100))}%` }} />
          </div>
          <p className="muted small">0 → 2 weeks: first treatment window · 2 → 6 weeks: salvage window (AAO-HNS 2019)</p>
          <p>{win.text}</p>
        </article>

        <article className="sudden-card">
          <h3>2 · Hum test (30 seconds)</h3>
          <p>With your mouth closed, hum a low note. Where does it sound louder?</p>
          <div className="chips">
            {[['same', `In my ${ear} ear (the worse one)`], ['other', 'In my other ear'], ['equal', 'The same in both']].map(([k, t]) => (
              <button key={k} className={`chip${hum === k ? ' on' : ''}`} onClick={() => setHum(k)}>{t}</button>
            ))}
          </div>
          {hum === 'same' && <p className="hint-ok">Points to a blocked or fluid-filled middle ear (conductive), which is usually less urgent. Still tell your crew medical officer, and note any recent pressure change.</p>}
          {hum === 'other' && <p className="hint-urgent">Points to the inner ear (sensorineural), the kind where time to treatment matters most. Make sure the flight surgeon knows today.</p>}
          {hum === 'equal' && <p className="muted">Inconclusive. Report it as no difference.</p>}
          <p className="muted small">The hum test performs about as well as a tuning-fork (Weber) test for a new one-sided loss (Ahmed et al. 2018); the guideline lists it as an alternative.</p>
        </article>

        <article className="sudden-card">
          <h3>3 · Anything else?</h3>
          {FLAGS.map(([k, t]) => (
            <label key={k} className="inline flag">
              <input type="checkbox" checked={flags.includes(k)} onChange={() => toggle(k)} /> {t}
            </label>
          ))}
          <p className="muted small">The guideline asks clinicians to check for both-ear loss, repeat episodes and neurological signs first.</p>
        </article>

        <article className="sudden-card">
          <h3>4 · What the test shows</h3>
          <table className="audiogram-table">
            <thead><tr><th>Hz</th>{Object.keys(criteria.drops).map((f) => <th key={f}>{fmt(Number(f)).replace(' kHz', 'k').replace(' Hz', '')}</th>)}</tr></thead>
            <tbody><tr><th>Change</th>{Object.values(criteria.drops).map((d, i) => <td key={i} className={`cell ${d >= 30 ? 'urgent' : d >= 10 ? 'shift' : 'ok'}`}>{Number.isFinite(d) ? `${d > 0 ? '+' : ''}${Math.round(d)}` : '–'}</td>)}</tr></tbody>
          </table>
          <p>
            {criteria.met
              ? `Meets the clinical definition: 30 dB or more at three neighbouring pitches (${criteria.frequencies.map(fmt).join(', ')}).`
              : "Meets NASA's 30 dB flag, but not the clinical three-pitch definition. Still report it."}
          </p>
        </article>
      </div>

      <article className="sudden-card guideline">
        <h3>For the medical team: what the guideline says</h3>
        <p className="muted small">Information to support the flight surgeon's decision, not a treatment instruction. AAO-HNS Clinical Practice Guideline: Sudden Hearing Loss (Update), 2019.</p>
        <ul>
          <li><strong>First:</strong> tell a blocked or middle ear (conductive) apart from inner-ear (sensorineural) loss, and check for both-ear loss, repeat episodes and neurological signs.</li>
          <li><strong>Steroids:</strong> an option as first treatment within 2 weeks of onset.</li>
          <li><strong>If recovery is incomplete at 2 to 6 weeks:</strong> steroid injection through the eardrum (intratympanic) is recommended, a specialist procedure.</li>
          <li><strong>Hyperbaric oxygen:</strong> an option only together with steroids, within 2 weeks (or within a month as salvage).</li>
          <li><strong>Not routinely:</strong> antivirals, clot-dissolving drugs, vasodilators or other vasoactive drugs.</li>
          <li><strong>Follow-up:</strong> a hearing test at the end of treatment and again within 6 months.</li>
        </ul>
        <p className="muted small">
          On the ISS: the 2023 formulary (Diaz et al., npj Microgravity 2024, as listed by WikEM) includes oral prednisone and methylprednisolone
          and injectable dexamethasone. Crew medical officers are usually not physicians, so dosing and the decision stay with the flight surgeon.
        </p>
      </article>

      <article className="sudden-card">
        <h3>5 · Summary for the flight surgeon</h3>
        <pre className="summary">{summary}</pre>
        <div className="row-buttons left">
          <button className="primary" onClick={async () => { try { await navigator.clipboard.writeText(summary); setCopied(true); } catch { setCopied(false); } }}>
            {copied ? 'Copied' : 'Copy summary'}
          </button>
          {!ex && <button className="secondary" onClick={onRetest}>Retest now</button>}
        </div>
        <p className="muted small">Nothing is sent automatically. Retest daily during treatment to track recovery.</p>
      </article>
    </section>
  );
}
