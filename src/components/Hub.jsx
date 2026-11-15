// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Home screen: one card per section. "My ears" is personal; the station sections are not.
import iss from '../data/iss_modules.json';
import Cochlea from './Cochlea.jsx';
import About from './About.jsx';
import { AllowanceCard } from './Planner.jsx';
import { averageBaselines, regionStatusFor, FREQUENCIES } from '../lib/rules.js';
import { baselineTests, latestCheck, isNoisy } from '../lib/storage.js';
import { explain } from '../lib/advice.js';
import { computePlan } from '../lib/plan.js';
import { noiseColor } from '../lib/issLayout.js';

function earsSummary(data) {
  const baselines = baselineTests(data);
  const check = latestCheck(data);
  const reference = baselines.length >= 2 ? averageBaselines(baselines[0].thresholds, baselines[1].thresholds) : null;
  const statuses = { left: {}, right: {} };
  if (reference) for (const ear of ['left', 'right']) for (const f of FREQUENCIES) statuses[ear][f] = regionStatusFor(reference[ear][f], check?.thresholds?.[ear]?.[f]);
  let line;
  let action;
  if (baselines.length === 0) [line, action] = ['Start with two short baseline tests on your own headphones.', { label: 'Set your baseline', role: 'baseline' }];
  else if (baselines.length === 1) [line, action] = ['One more baseline test sets your personal reference.', { label: 'Finish your baseline', role: 'baseline' }];
  else if (!check) [line, action] = ['Reference set. Check your hearing any time to compare.', { label: 'Check my hearing', role: 'check' }];
  else {
    const f = check.confirmedFindings ?? [];
    line = f.length ? f.map((x) => explain(x).title).join(' · ') : 'No change from your baseline at the last check.';
    action = { label: 'Check my hearing', role: 'check' };
  }
  return { statuses, line, action, check, noisy: check && isNoisy(check), findings: check?.confirmedFindings?.length ?? 0 };
}

const NOOP = () => {};

export default function Hub({ data, plan, go, onStartTest, onLoadDemo, onExitDemo, onReset }) {
  const ears = earsSummary(data);
  const day = computePlan(plan);
  const loudest = [...iss.modules].filter((m) => m.kind === 'work').sort((a, b) => b.dba - a.dba);

  return (
    <div className="hub">
      <header className="hub-head">
        <img className="brand-mark" src="./favicon.svg" alt="" aria-hidden="true" />
        <div>
          <h1>Earshot</h1>
          <p className="muted">Catch hearing changes early, against your own baseline, using NASA's rules and data.</p>
        </div>
      </header>

      {data.demo && (
        <div className="demo-banner">
          <strong>Demo astronaut: simulated data, not a real person.</strong>{' '}
          <button className="link-button" onClick={onExitDemo}>Exit demo</button>
        </div>
      )}

      <div className="hub-grid">
        <article className={`hub-card ears-card${ears.findings ? ' has-finding' : ''}`} onClick={() => go('ears')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && go('ears')}>
          <div className="hub-card-head">
            <h2>My ears</h2>
            <span className="badge personal">Personal · stays on this device</span>
          </div>
          <div className="mini-ears" aria-hidden="true">
            <Cochlea ear="left" statuses={ears.statuses.left} selected={{}} onSelect={NOOP} size={150} />
            <Cochlea ear="right" statuses={ears.statuses.right} selected={{}} onSelect={NOOP} size={150} />
          </div>
          <p className={ears.findings ? 'finding-line' : ''}>{ears.line}</p>
          {ears.check && (
            <p className="muted small">
              Last check: {Number.isFinite(ears.check.missionDay) ? `mission day ${ears.check.missionDay}` : new Date(ears.check.date).toLocaleDateString()}
            </p>
          )}
          {ears.noisy && <p className="warn small">Latest check measured in noise.</p>}
          <div className="hub-card-actions" onClick={(e) => e.stopPropagation()}>
            {!data.demo && <button className="primary" onClick={() => onStartTest(ears.action.role)}>{ears.action.label}</button>}
            <button className="secondary" onClick={() => go('ears/tests')}>My tests</button>
            {!data.demo && data.tests.length === 0 && (
              <button className="link-button" onClick={onLoadDemo}>or explore a simulated demo astronaut</button>
            )}
          </div>
        </article>

        <article className="hub-card" onClick={() => go('station')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && go('station')}>
          <div className="hub-card-head">
            <h2>Station noise</h2>
            <span className="badge">3D · NASA data</span>
          </div>
          <div className="mini-levels" aria-hidden="true">
            {loudest.map((m) => <span key={m.id} style={{ height: `${(m.dba - 40) * 2.6}px`, background: noiseColor(m.dba) }} title={m.name} />)}
          </div>
          <p>
            NASA's measured levels for {iss.modules.length} places on the ISS, from {loudest.at(-1).dba} to {loudest[0].dba} dBA, plus a real day
            of NASA chamber data.
          </p>
        </article>

        <article className="hub-card" onClick={() => go('plan')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && go('plan')}>
          <div className="hub-card-head">
            <h2>Plan a workday</h2>
            <span className="badge">Flight rule check</span>
          </div>
          <AllowanceCard result={day} compact />
          <p>
            Planned day averages <strong>{day.work.leqDba.toFixed(1)} dBA</strong>
            {day.top ? `; ${day.top.name} uses the most (${Math.round(day.top.dosePct)}%).` : '.'}
          </p>
        </article>
        <article className="hub-card" onClick={() => go('fleet')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && go('fleet')}>
          <div className="hub-card-head">
            <h2>Fleet trends</h2>
            <span className="badge sim">Simulated</span>
          </div>
          <p>
            What the ground learns when crews pool their end-of-day noise logs (never hearing results): what pushes days over the limit, which
            module is getting louder, which sleep stations miss the target.
          </p>
        </article>
      </div>

      <details className="hub-about">
        <summary>How Earshot works, sources, and your data</summary>
        <About data={data} onReset={onReset} />
      </details>
    </div>
  );
}
