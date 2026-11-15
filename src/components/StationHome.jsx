// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Home: the live station map with active alerts, and one tap to plan the day, check your ears or run a quick check.
import { lazy, Suspense, useState } from 'react';
import About from './About.jsx';
import { STATIONS } from '../lib/session.js';

const Station = lazy(() => import('./Station.jsx'));

const DEMO_EVENTS = (st) => [
  { type: 'fan-fault', label: `Fan fault in ${st.faultName}` },
  { type: 'loud', label: 'Treadmill without earplugs (loud exposure)' },
  { type: 'ringing', label: 'Ringing in the right ear', ear: 'right' },
];

export default function StationHome({ session, persona, alerts, go, focus, onEvent, onClearEvents, onChange, data, onReset }) {
  const st = STATIONS[session.station];
  const [demoOpen, setDemoOpen] = useState(false);
  return (
    <div className="station-home">
      <header className="home-head">
        <img className="brand-mark" src="./favicon.svg" alt="" aria-hidden="true" />
        <div className="home-title">
          <h1>{st.name}</h1>
          <span className="muted small">
            {persona ? `${persona.name} · ${persona.tag} · simulated` : 'You'} · <button className="link-button inline-link" onClick={onChange}>change</button>
          </span>
        </div>
        <div className="demo-menu">
          <button className="secondary" onClick={() => setDemoOpen((o) => !o)} aria-expanded={demoOpen}>Demo ▾</button>
          {demoOpen && (
            <div className="demo-pop" role="menu">
              <p className="muted small">Trigger an event to see Earshot respond.</p>
              {DEMO_EVENTS(st).map((e) => (
                <button key={e.type} role="menuitem" onClick={() => { onEvent(e); setDemoOpen(false); }}>{e.label}</button>
              ))}
              <button role="menuitem" className="link-button" onClick={() => { onClearEvents(); setDemoOpen(false); }}>Clear today's events</button>
            </div>
          )}
        </div>
      </header>

      <section className="alerts" aria-live="polite">
        {alerts.length === 0 && <p className="muted">All quiet. Earshot is watching the station's noise and your plan.</p>}
        {alerts.map((a) => (
          <article key={a.id} className={`alert ${a.level}`}>
            <div>
              <h3>{a.title}</h3>
              <p>{a.body}</p>
            </div>
            {a.actions.length > 0 && (
              <div className="alert-actions">
                {a.actions.map((x) => <button key={x.label} className={a.level === 'urgent' ? 'primary' : 'secondary'} onClick={() => (x.event ? onEvent(x.event) : go(x.to))}>{x.label}</button>)}
              </div>
            )}
          </article>
        ))}
      </section>

      <nav className="quick-actions" aria-label="Main">
        <button className="action" onClick={() => go('plan')}><strong>Plan my day</strong><span className="muted small">Earplug flags, allowance, sleep</span></button>
        <button className="action" onClick={() => go('ears')}><strong>My ears</strong><span className="muted small">Cochlea, tests, sudden-drop response</span></button>
        <button className="action" onClick={() => go('quick/general')}><strong>Quick check</strong><span className="muted small">2 minutes, any time</span></button>
      </nav>

      <Suspense fallback={<p className="muted">Loading the station…</p>}>
        <Station key={session.station} lockedPlace={session.station} demoEvents={session.events} focus={focus} compact />
      </Suspense>
      <p className="small"><button className="link-button inline-link" onClick={() => go('station')}>Full station view</button>: every place, NASA's real chamber data, base settings and cabin pressure.</p>

      <details className="hub-about">
        <summary>How Earshot works, sources, and your data</summary>
        <About data={data} onReset={onReset} />
      </details>
    </div>
  );
}
