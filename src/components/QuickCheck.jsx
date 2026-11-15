// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Quick check: about 2 minutes, at the pitches an exposure or symptom points to. A change of 10 dB or more
// (NASA's shift size) asks for the full check; 30 dB or more points to a possible sudden drop.
import { useState } from 'react';
import TestRunner from './TestRunner.jsx';
import { averageBaselines, isNoResponse } from '../lib/rules.js';
import { baselineTests } from '../lib/storage.js';
import { quickPitchesFor } from '../lib/alerts.js';
import { simulatedThresholds } from '../lib/personas.js';
import { simulate } from '../lib/threshold.js';
import { bandLabel } from '../lib/spectrum.js';

const WHY = {
  'fan-fault': 'the stalled-fan noise rose at 500 Hz and 1 kHz; 4 kHz is where noise damage usually shows first',
  loud: 'treadmill noise reaches the 2 to 4 kHz region, where noise damage usually shows first',
  ringing: 'ringing often comes with a change at 1 to 4 kHz',
  general: 'a quick sweep across low, middle and high pitches',
};

export default function QuickCheck({ kind, data, persona, events, onSave, onSimulatedFullCheck, go }) {
  const pitches = kind === 'general' ? [500, 1000, 2000, 4000] : quickPitchesFor({ type: kind });
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
        <h2>{w >= 30 ? `Possible sudden drop: ${w} dB at ${bandLabel(result.worstAt)}, ${result.worstEar} ear` : w >= 10 ? `${w} dB worse at ${bandLabel(result.worstAt)}, ${result.worstEar} ear` : 'No change at these pitches'}</h2>
        <table className="audiogram-table">
          <thead><tr><th>Ear</th>{pitches.map((f) => <th key={f}>{bandLabel(f)}</th>)}</tr></thead>
          <tbody>
            {['left', 'right'].map((ear) => (
              <tr key={ear}><th>{ear}</th>{pitches.map((f) => { const c = result.changes.find((x) => x.ear === ear && x.f === f); return <td key={f} className={`cell ${c?.d >= 30 ? 'urgent' : c?.d >= 10 ? 'shift' : c?.d >= 5 ? 'watch' : 'ok'}`}>{c ? `${c.d > 0 ? '+' : ''}${c.d}` : '–'}</td>; })}</tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">Change from your baseline in dB (higher = harder to hear).{result.simulated ? ' Simulated responses of a simulated crew member.' : ''}</p>
        {w >= 30 ? (
          <>
            <p><strong>Tell your crew medical officer now.</strong> Confirm it with the full check, which starts the sudden-drop response if the drop is real.</p>
            {result.simulated ? <button className="primary" onClick={onSimulatedFullCheck}>Run the full check (simulated)</button> : <button className="primary" onClick={() => go('test/check')}>Full check now</button>}
          </>
        ) : w >= 10 ? (
          <>
            <p>A change this size right after loud noise is often temporary. Protect your ears for the rest of today, keep tonight quiet, and Earshot will ask for a recheck tomorrow. If it's still there, the full check follows.</p>
            <button className="secondary" onClick={() => go('test/check')}>Full check now instead</button>
          </>
        ) : (
          <p>Within {Math.max(w, 0)} dB of your baseline. Nothing to do; Earshot keeps watching.</p>
        )}
        <button className="link-button" onClick={() => go('')}>Back to the station</button>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Quick check: {pitches.map(bandLabel).join(', ')}</h2>
      <p>About 2 minutes, both ears. Why these pitches: {WHY[kind] ?? WHY.general}.</p>
      <p className="muted small">Same headphones and volume as your baseline, in the quietest spot you can find.</p>
      <div className="row-buttons left">
        {persona ? (
          <button className="primary" onClick={runSimulated}>Simulate {persona.name}'s responses</button>
        ) : (
          <button className="primary" onClick={() => setStage('running')}>Start (headphones on)</button>
        )}
      </div>
    </section>
  );
}
