// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Quick check: about 2 minutes, at the pitches an exposure or symptom points to. A change of 10 dB or more
// (NASA's shift size) asks for the full check; 30 dB or more points to a possible sudden drop.
import { useState } from 'react';
import TestRunner from './TestRunner.jsx';
import { averageBaselines, isNoResponse } from '../lib/rules.js';
import { baselineTests } from '../lib/storage.js';
import { quickPitchesFor, SYMPTOMS } from '../lib/alerts.js';
import Info from './Info.jsx';
import { simulatedThresholds } from '../lib/personas.js';
import { simulate } from '../lib/threshold.js';
import { bandLabel } from '../lib/spectrum.js';

const WHY = {
  'fan-fault': 'the stalled-fan noise rose at 500 Hz and 1 kHz; 4 kHz is where noise damage usually shows first',
  loud: 'treadmill noise reaches the 2 to 4 kHz region, where noise damage usually shows first',
  ringing: 'ringing often comes with a change at 1 to 4 kHz',
  live: 'the pitches the noise you were in reaches, plus 4 kHz, where noise damage usually shows first',
  general: 'a quick sweep across low, middle and high pitches',
};

export default function QuickCheck({ kind, data, persona, events, onSave, onSimulatedFullCheck, go }) {
  const pitches = kind === 'general' ? [500, 1000, 2000, 4000] : quickPitchesFor(events.find((e) => e.type === kind) ?? { type: kind });
  const baselines = baselineTests(data);
  const ref = baselines.length >= 2 ? averageBaselines(baselines[0].thresholds, baselines[1].thresholds) : null;
  const [stage, setStage] = useState('intro');
  const [result, setResult] = useState(null);

  function finish(thresholds, simulated) {
    const changes = [];
    for (const ear of ['left', 'right']) for (const f of pitches) {
      const v = thresholds[ear]?.[f];
      if (Number.isFinite(v) && !isNoResponse(ref[ear][f])) changes.push({ ear, f, d: Math.round(v - ref[ear][f]) });
    }
    const worst = changes.reduce((a, c) => (c.d > a.d ? c : a), { d: -99 });
    const q = { at: Date.now(), kind, pitches, thresholds, changes, worst: worst.d, worstAt: worst.f, worstEar: worst.ear, simulated };
    onSave(q);
    setResult(q);
    setStage('result');
  }

  function runSimulated() {
    const truth = simulatedThresholds(persona, events);
    const t = { left: {}, right: {} };
    for (const ear of ['left', 'right']) for (const f of pitches) t[ear][f] = simulate(f, ear, truth[ear][f]).threshold;
    finish(t, true);
  }

  if (!ref) {
    return (
      <section className="panel">
        <h2>Quick check</h2>
        <p>A quick check compares a few pitches with your baseline, so it needs one first.</p>
        <button className="primary" onClick={() => go('test/baseline')}>Set your baseline</button>
      </section>
    );
  }
  if (stage === 'running') return <TestRunner ears={['right', 'left']} frequencies={pitches} onComplete={(r) => finish(r.thresholds, false)} onCancel={() => setStage('intro')} />;

  if (stage === 'result') {
    const w = result.worst;
    return (
      <section className="panel quick-result">
        <h2>{w >= 10 ? `${result.worstEar === 'left' ? 'Left' : 'Right'} ear, ${bandLabel(result.worstAt)}: ${w} dB worse` : w >= 5 ? 'No change beyond test error' : 'No change'}</h2>
        {w >= 30 && <p className="urgent-text">Possible sudden drop.</p>}
        <table className="audiogram-table">
          <thead><tr><th>Ear</th>{pitches.map((f) => <th key={f}>{bandLabel(f)}</th>)}</tr></thead>
          <tbody>
            {['left', 'right'].map((ear) => (
              <tr key={ear}><th>{ear}</th>{pitches.map((f) => { const c = result.changes.find((x) => x.ear === ear && x.f === f); return <td key={f} className={`cell ${c?.d >= 30 ? 'urgent' : c?.d >= 10 ? 'shift' : c?.d >= 5 ? 'watch' : 'ok'}`}>{c ? `${c.d > 0 ? '+' : ''}${c.d}` : '–'}</td>; })}</tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">
          Change from your baseline, in dB
          <Info>Higher means harder to hear. Measured on your own headphones against your own baseline.{result.simulated ? ' These are the simulated responses of a simulated crew member.' : ''}</Info>
        </p>
        {w >= 30 ? (
          <>
            <div className="todo">
              <span className="label-caps">What to do</span>
              <ul>
                <li>Tell your crew medical officer now.</li>
                <li>Run the full check to confirm it.</li>
              </ul>
            </div>
            <p className="muted small">
              Why
              <Info>A drop of 30 dB or more may be sudden hearing loss. Treatment works best when it starts early. If the full check confirms it, Earshot opens the sudden-drop response.</Info>
            </p>
            {result.simulated ? <button className="primary" onClick={onSimulatedFullCheck}>Run the full check (simulated)</button> : <button className="primary" onClick={() => go('test/check')}>Full check now</button>}
          </>
        ) : w >= 10 ? (
          <>
            <div className="todo">
              <span className="label-caps">What to do</span>
              <ul>
                <li>Earplugs for loud tasks today.</li>
                <li>A quiet night.</li>
                <li>Recheck tomorrow. Earshot will ask.</li>
              </ul>
            </div>
            <p className="muted small">
              Why
              <Info>A change right after loud noise is often temporary. If it's still there tomorrow, Earshot runs the full check.</Info>
            </p>
            <button className="secondary" onClick={() => go('test/check')}>Full check now instead</button>
          </>
        ) : (
          <p>Nothing to do. Earshot keeps watching.</p>
        )}
        <button className="secondary" onClick={() => go("ears")}>Back to my ears</button>
      </section>
    );
  }

  const reported = kind === 'ringing' ? events.find((e) => e.type === 'ringing') : null;
  return (
    <section className="panel">
      {reported && (
        <p className="reported">
          <span className="event-dot" aria-hidden="true" /> {SYMPTOMS[reported.symptom ?? 'ringing']} reported in your {reported.ear === 'both' ? 'ears' : `${reported.ear ?? 'right'} ear`},{' '}
          {new Date(reported.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
        </p>
      )}
      <h2>{reported ? 'Check now' : 'Quick check'}: {pitches.map(bandLabel).join(', ')}</h2>
      <p>
        2 minutes, both ears.
        <Info>Why these pitches: {WHY[kind] ?? WHY.general}. Use the same headphones and volume as your baseline, in the quietest spot you can find.</Info>
      </p>
      <div className="action-bar no-tabs">
        <div className="action-bar-inner">
          {persona ? (
            <button className="primary" onClick={runSimulated}>Simulate {persona.name}'s responses</button>
          ) : (
            <button className="primary" onClick={() => setStage('running')}>Start (headphones on)</button>
          )}
          <button className="secondary" onClick={() => go('')}>Not now</button>
        </div>
      </div>
    </section>
  );
}
