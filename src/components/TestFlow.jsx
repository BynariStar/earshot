// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
import { useState } from 'react';
import NoiseCheck from './NoiseCheck.jsx';
import TestRunner from './TestRunner.jsx';
import { TEST_ORDER } from '../lib/testOrder.js';
import { playReferenceTone, unlockAudio } from '../lib/audio.js';
import { averageBaselines, baselineAgreement, evaluate, confirm } from '../lib/rules.js';
import { baselineTests, isNoisy } from '../lib/storage.js';
import { explain } from '../lib/advice.js';

const SYMPTOMS = ['Ear fullness or pressure', 'Ringing (tinnitus)', 'Dizziness', 'Congestion or cold', 'Recent pressure change (suit run, hatch, leak check)', 'New medication'];
const EAR_CHOICES = [
  ['both', 'Both ears', ['right', 'left']],
  ['left', 'Left ear only', ['left']],
  ['right', 'Right ear only', ['right']],
];
const fmt = (f) => (f >= 1000 ? `${f / 1000} kHz` : `${f} Hz`);

function noResponseList(outcomes) {
  const out = [];
  for (const ear of ['left', 'right']) for (const f of TEST_ORDER) if (outcomes?.[ear]?.[f] === 'no-response') out.push(`${ear} ${fmt(f)}`);
  return out;
}

export default function TestFlow({ role, data, onSave, onDone }) {
  const profile = data.profile ?? {};
  const [stage, setStage] = useState('setup'); // setup | running | retest-offer | retesting | result
  const [headphones, setHeadphones] = useState(profile.headphones ?? '');
  const [age, setAge] = useState(profile.age ?? '');
  const [sex, setSex] = useState(profile.sex ?? '');
  const [earChoice, setEarChoice] = useState(profile.earChoice ?? 'both');
  const [noise, setNoise] = useState(null);
  const [bypass, setBypass] = useState(false);
  const [volumeSet, setVolumeSet] = useState(false);
  const [context, setContext] = useState([]);
  const [first, setFirst] = useState(null);
  const [outcome, setOutcome] = useState(null);

  const baselines = baselineTests(data);
  const reference = baselines.length >= 2 ? averageBaselines(baselines[0].thresholds, baselines[1].thresholds) : null;
  const noiseOk = noise && noise.pass;
  const ready = headphones.trim() && volumeSet && noise && (noiseOk || bypass);
  const sameHeadphones = !profile.headphones || profile.headphones === headphones.trim();
  const ears = EAR_CHOICES.find(([k]) => k === earChoice)[2];

  function noiseRecord() {
    if (!noise || noise.denied) return { checked: false, bypassed: bypass };
    return { checked: true, pass: noise.pass, overall: noise.overall, low: noise.low, processingOn: noise.processingOn, bypassed: !noise.pass && bypass };
  }

  function record(result, extra) {
    return {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      role,
      headphones: headphones.trim(),
      ears,
      noise: noiseRecord(),
      context,
      complete: true,
      ...result,
      ...extra,
    };
  }

  function onFirstComplete(result) {
    if (role === 'baseline') {
      const test = record(result);
      const problems = baselines.length === 1 ? baselineAgreement(baselines[0].thresholds, result.thresholds) : [];
      onSave(test, { headphones: headphones.trim(), earChoice, ...(age ? { age: Number(age) } : {}), ...(sex ? { sex } : {}) });
      setOutcome({ kind: 'baseline', number: baselines.length + 1, problems, falseAlarms: result.falseAlarms, test });
      setStage('result');
      return;
    }
    const ev = evaluate(reference, result.thresholds);
    setFirst({ result, ev });
    if (ev.findings.length) setStage('retest-offer');
    else {
      const test = record(result, { confirmedFindings: [] });
      onSave(test);
      setOutcome({ kind: 'check', confirmed: [], unconfirmed: [], falseAlarms: result.falseAlarms, test });
      setStage('result');
    }
  }

  function onRetestComplete(result) {
    // Merge: the retest only covered the flagged ears; keep the first test's other values.
    const merged = { left: { ...first.result.thresholds.left }, right: { ...first.result.thresholds.right } };
    const flaggedEars = [...new Set(first.ev.findings.map((f) => f.ear))];
    for (const ear of flaggedEars) merged[ear] = { ...result.thresholds[ear] };
    const retestEv = evaluate(reference, merged);
    const confirmed = confirm(first.ev, retestEv).map((f) => retestEv.findings.find((r) => r.kind === f.kind && r.ear === f.ear));
    const unconfirmed = first.ev.findings.filter((f) => !confirmed.some((c) => c.kind === f.kind && c.ear === f.ear));
    const test = record(first.result, { confirmedFindings: confirmed, unconfirmedFindings: unconfirmed, retest: { thresholds: result.thresholds, outcomes: result.outcomes, falseAlarms: result.falseAlarms } });
    onSave(test);
    setOutcome({ kind: 'check', confirmed, unconfirmed, falseAlarms: first.result.falseAlarms + result.falseAlarms, test });
    setStage('result');
  }

  if (stage === 'running') return <TestRunner ears={ears} onComplete={onFirstComplete} onCancel={onDone} />;
  if (stage === 'retesting') {
    const flaggedEars = [...new Set(first.ev.findings.map((f) => f.ear))];
    return <TestRunner ears={flaggedEars} frequencies={TEST_ORDER} onComplete={onRetestComplete} onCancel={onDone} />;
  }

  if (stage === 'retest-offer') {
    return (
      <section className="panel">
        <h2>Something changed. Let's make sure.</h2>
        <p>
          This test differs from your baseline in a way NASA's rules would flag. A single test can do that by chance (10 dB is about two
          standard deviations of portable-test error), so Earshot only flags a change that a retest repeats.
        </p>
        <ul>
          {first.ev.findings.map((f, i) => (
            <li key={i}>{explain(f).title}</li>
          ))}
        </ul>
        <p>Keep the same headphones and volume, and retest now.</p>
        <button className="primary" onClick={() => setStage('retesting')}>Retest now</button>
      </section>
    );
  }

  if (stage === 'result') {
    const noisy = isNoisy(outcome.test);
    const nr = noResponseList(outcome.test.outcomes);
    return (
      <section className="panel">
        {noisy && (
          <p className="noisy-note">
            {outcome.kind === 'baseline'
              ? 'This baseline was measured without a passing noise check. Fine for trying things out, but redo it in a quiet place before relying on it (you can delete it under My tests).'
              : 'This check was measured without a passing noise check. Treat any change as unreliable and retest somewhere quiet before acting on it.'}
          </p>
        )}
        {outcome.kind === 'baseline' ? (
          <>
            <h2>Baseline test {outcome.number} of 2 saved</h2>
            {outcome.number === 1 && <p>Take the second baseline test today, with the same headphones and volume. Earshot averages the two.</p>}
            {outcome.number >= 2 && outcome.problems.length === 0 && <p>Your two baselines agree within 10 dB at every pitch. Your personal reference is set.</p>}
            {outcome.number >= 2 && outcome.problems.length > 0 && (
              <p className="warn">
                Your two baselines differ by more than 10 dB at {outcome.problems.map((p) => `${p.ear} ${fmt(p.frequency)}`).join(', ')}. Check the
                headphone fit and room noise; consider deleting one under My tests and redoing it.
              </p>
            )}
          </>
        ) : outcome.confirmed.length ? (
          <>
            <h2>Confirmed change</h2>
            {outcome.confirmed.map((f, i) => {
              const e = explain(f);
              return (
                <article key={i} className={`finding ${e.level}`}>
                  <h3>{e.title}</h3>
                  <p>{e.what}</p>
                  <ul>{e.actions.map((a) => <li key={a}>{a}</li>)}</ul>
                </article>
              );
            })}
          </>
        ) : (
          <>
            <h2>No confirmed change</h2>
            <p>
              {outcome.unconfirmed.length
                ? 'The retest did not repeat the earlier difference, so nothing is flagged. It was most likely test-to-test variation.'
                : 'Your hearing matches your baseline within NASA’s 10 dB rules.'}
            </p>
          </>
        )}
        {nr.length > 0 && (
          <p className="muted">
            No response even at the loudest allowed level: {nr.join(', ')}. Recorded as "at least" that level, so a change there still counts.
          </p>
        )}
        {outcome.falseAlarms > 3 && <p className="muted">You pressed during silence {outcome.falseAlarms} times; results may be less reliable.</p>}
        <button className="primary" onClick={onDone}>Back to my cochlea</button>
      </section>
    );
  }

  return (
    <section className="panel setup">
      <h2>{role === 'baseline' ? `Baseline test ${baselines.length + 1} of 2` : 'Hearing check'}</h2>
      <p>About 8 to 10 minutes. Same headphones, same volume and a quiet place every time: Earshot measures change, not absolute hearing.</p>

      <ol className="steps">
        <li>
          <label>
            Headphones (model)
            <input value={headphones} onChange={(e) => setHeadphones(e.target.value)} placeholder="e.g. the wired over-ear pair" />
          </label>
          {!sameHeadphones && <p className="warn">Different from your baseline headphones ({profile.headphones}). Results won't be comparable.</p>}
          <p className="muted">Wired over-ear headphones are best. Turn off noise cancelling and any sound effects or equalizers.</p>
        </li>
        <li>
          <p>Which ears?</p>
          <div className="chips">
            {EAR_CHOICES.map(([k, label]) => (
              <label key={k} className={`chip${earChoice === k ? ' on' : ''}`}>
                <input type="radio" name="ears" checked={earChoice === k} onChange={() => setEarChoice(k)} />
                {label}
              </label>
            ))}
          </div>
          <p className="muted">If you already know one ear doesn't hear, test only the other. Use the same choice for every test.</p>
        </li>
        <li>
          <p>Set your volume: play the reference tone and adjust your device volume until it is clearly audible but comfortable. Then leave the volume alone for every test.</p>
          <button className="secondary" onClick={async () => { await unlockAudio(); playReferenceTone('both'); }}>Play reference tone</button>{' '}
          <label className="inline">
            <input type="checkbox" checked={volumeSet} onChange={(e) => setVolumeSet(e.target.checked)} /> Volume set and I won't change it
          </label>
        </li>
        <li>
          <NoiseCheck onResult={(r) => { setNoise(r); setBypass(false); }} />
          {noise && !noise.pass && (
            <label className="inline bypass">
              <input type="checkbox" checked={bypass} onChange={(e) => setBypass(e.target.checked)} /> Bypass the noise check (troubleshooting or
              demo). The result is saved as "measured in noise" and shouldn't be relied on.
            </label>
          )}
        </li>
        {role === 'baseline' && (
          <li>
            <p>Optional: your age and sex let Earshot compare changes with NASA's astronaut hearing-by-age data. Stored on this device only.</p>
            <label className="inline">Age <input type="number" min="18" max="90" value={age} onChange={(e) => setAge(e.target.value)} style={{ width: 80 }} /></label>
            <label className="inline">
              Sex
              <select value={sex} onChange={(e) => setSex(e.target.value)}>
                <option value="">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
            </label>
          </li>
        )}
        {role !== 'baseline' && (
          <li>
            <p>Anything since your last check? (optional)</p>
            <div className="chips">
              {SYMPTOMS.map((s) => (
                <label key={s} className={`chip${context.includes(s) ? ' on' : ''}`}>
                  <input type="checkbox" checked={context.includes(s)} onChange={(e) => setContext((c) => (e.target.checked ? [...c, s] : c.filter((x) => x !== s)))} />
                  {s}
                </label>
              ))}
            </div>
          </li>
        )}
      </ol>
      <button className="primary" disabled={!ready} onClick={() => setStage('running')}>
        {noiseOk ? 'Start test' : bypass ? 'Start test (marked "measured in noise")' : 'Start test'}
      </button>
      <button className="link-button" onClick={onDone}>Cancel</button>
    </section>
  );
}
