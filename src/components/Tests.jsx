// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Every stored test, newest first, with its raw values, noise status and findings, and a way to delete one.
import { useState } from 'react';
import { averageBaselines, regionStatusFor, isNoResponse } from '../lib/rules.js';
import { baselineTests, isNoisy } from '../lib/storage.js';
import { explain } from '../lib/advice.js';

const SHOWN = [250, 500, 1000, 2000, 3000, 4000];
const fmt = (f) => (f >= 1000 ? `${f / 1000}k` : `${f}`);
// Clinics add masking noise to the other ear when the two ears differ by about 35 dB or more, because a
// loud tone in the worse ear can be heard by the better one (Grason-Stadler audiometry guide). Earshot
// has no masking, so it flags those pitches instead. On Earshot's uncalibrated scale this is approximate.
const CROSS_HEARING_DB = 35;

function noiseBadge(t) {
  if (!t.noise) return null;
  if (t.noise.checked === false) return ['noisy', 'Noise not checked'];
  if (isNoisy(t)) return ['noisy', 'Measured in noise'];
  return ['quiet', 'Quiet room'];
}

function crossHearing(t) {
  const out = [];
  for (const f of SHOWN) {
    const l = t.thresholds?.left?.[f];
    const r = t.thresholds?.right?.[f];
    if (!Number.isFinite(l) || !Number.isFinite(r)) continue;
    if (Math.abs(l - r) >= CROSS_HEARING_DB && !(isNoResponse(l) && isNoResponse(r))) out.push(f);
  }
  return out;
}

function Cell({ t, ear, f, reference }) {
  const v = t.thresholds?.[ear]?.[f];
  const outcome = t.outcomes?.[ear]?.[f];
  if (outcome === 'skipped' || (!Number.isFinite(v) && !(t.ears ?? ['left', 'right']).includes(ear))) return <td className="muted">–</td>;
  if (!Number.isFinite(v)) return <td className="muted">{outcome === 'no-response' ? 'NR' : '?'}</td>;
  const text = isNoResponse(v) ? 'NR' : Math.round(v);
  if (!reference || t.role === 'baseline') return <td>{text}</td>;
  const status = regionStatusFor(reference[ear]?.[f], v);
  const d = v - reference[ear]?.[f];
  return (
    <td className={`cell ${status}`}>
      {text}
      {Number.isFinite(d) && status !== 'unmeasurable' && (
        <small>{d > 0 ? '+' : ''}{d.toFixed(0)}{isNoResponse(v) ? '+' : ''}</small>
      )}
    </td>
  );
}

export default function Tests({ data, onDelete, onStartTest }) {
  const [confirming, setConfirming] = useState(null);
  const baselines = baselineTests(data);
  const inReference = new Set(baselines.slice(0, 2).map((t) => t.id));
  const reference = baselines.length >= 2 ? averageBaselines(baselines[0].thresholds, baselines[1].thresholds) : null;
  const tests = [...data.tests].reverse();

  return (
    <section className="tests">
      <h1>My tests</h1>
      <p className="lede">
        Every test stored on this device, newest first. Numbers are on Earshot's own uncalibrated scale (dB; higher = harder to hear), so
        only differences between your own tests mean anything. NR = no response even at the loudest allowed level; – = ear not tested.
        Checks show the change from your reference (the average of your first two baselines) under each value.
      </p>
      {tests.length === 0 && (
        <p>
          No tests yet. <button className="link-button" onClick={() => onStartTest('baseline')}>Set your baseline</button>
        </p>
      )}
      {tests.map((t) => {
        const badge = noiseBadge(t);
        const bIndex = baselines.findIndex((b) => b.id === t.id);
        const title = t.role === 'baseline' ? (bIndex < 2 ? `Baseline ${bIndex + 1}` : 'Extra baseline (not in your reference)') : 'Hearing check';
        const when = Number.isFinite(t.missionDay) ? `mission day ${t.missionDay}` : new Date(t.date).toLocaleString();
        const ears = ['left', 'right'];
        const cross = crossHearing(t);
        const confirmed = t.confirmedFindings ?? [];
        const unconfirmed = t.unconfirmedFindings ?? [];
        return (
          <article key={t.id} className="test-card">
            <header>
              <h2>{title}</h2>
              <span className="muted">{when}</span>
              {badge && badge[0] !== 'quiet' && <span className={`warn-text ${badge[0]}`}>{badge[1]}</span>}
            </header>
            <p className="muted">
              {t.headphones || 'Headphones not recorded'}
              {Number.isFinite(t.noise?.overall) && ` · noise ${t.noise.overall.toFixed(0)} dBFS overall, ${t.noise.low.toFixed(0)} dBFS low`}
              {Number.isFinite(t.falseAlarms) && ` · ${t.falseAlarms} press${t.falseAlarms === 1 ? '' : 'es'} during silence`}
              {t.retest && ' · includes a retest'}
            </p>
            <table className="audiogram-table">
              <thead>
                <tr>
                  <th>Hz</th>
                  {SHOWN.map((f) => <th key={f}>{fmt(f)}</th>)}
                </tr>
              </thead>
              <tbody>
                {ears.map((ear) => (
                  <tr key={ear}>
                    <th>{ear === 'left' ? 'Left' : 'Right'}</th>
                    {SHOWN.map((f) => <Cell key={f} t={t} ear={ear} f={f} reference={reference} />)}
                  </tr>
                ))}
              </tbody>
            </table>
            {confirmed.length > 0 && (
              <ul className="test-findings">
                {confirmed.map((f, i) => <li key={i} className={explain(f).level}>{explain(f).title} (confirmed)</li>)}
              </ul>
            )}
            {unconfirmed.length > 0 && (
              <p className="muted">Not repeated on retest, so not flagged: {unconfirmed.map((f) => explain(f).title).join('; ')}.</p>
            )}
            {cross.length > 0 && (
              <p className="muted">
                Ears differ by {CROSS_HEARING_DB} dB or more at {cross.map(fmt).join(', ')} Hz. A loud tone in the weaker ear can be heard by the
                other ear; clinics add masking noise for this and Earshot doesn't, so treat the weaker ear's values there with caution.
              </p>
            )}
            <div className="test-actions">
              {confirming === t.id ? (
                <>
                  <span className="warn">
                    {inReference.has(t.id)
                      ? 'This is one of your two reference baselines. Deleting it changes your reference: the next baseline takes its place, or you take a new one.'
                      : 'Delete this test from this device?'}
                  </span>
                  <button className="danger" onClick={() => { onDelete(t.id); setConfirming(null); }}>Delete</button>
                  <button className="link-button" onClick={() => setConfirming(null)}>Keep it</button>
                </>
              ) : (
                <button className="link-button" onClick={() => setConfirming(t.id)}>Delete this test</button>
              )}
            </div>
          </article>
        );
      })}
    </section>
  );
}
