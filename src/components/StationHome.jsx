// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Home: the live station map. Anything that needs action now opens full screen (App); everything else
// waits behind the bell. Below the map: what's happening now, then Plan my day, My ears, Quick check.
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { STATIONS } from '../lib/session.js';

const Station = lazy(() => import('./Station.jsx'));

const DEMO_EVENTS = [
  { type: 'loud', label: 'Treadmill without earplugs' },
  { type: 'ringing', label: 'Ringing in the right ear', ear: 'right' },
];

// A small popover that closes on outside click or Escape.
function Popover({ label, button, children, className = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className={`popover ${className}`} ref={ref}>
      <button className="icon-button" aria-label={label} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {button}
      </button>
      {open && (
        <div className="popover-body" role="menu">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export default function StationHome({ session, persona, alerts, go, focus, onEvent, onClearEvents, onChange, liveStart }) {
  const st = STATIONS[session.station];
  const bell = alerts.filter((a) => a.level === 'info' || a.level === 'ok');
  const act = (x) => (x.event ? onEvent(x.event) : go(x.to));
  const myEars = alerts.find((a) => a.id === 'baseline') ? 'Set your baseline' : 'Your hearing, check by check';
  const flags = alerts.find((a) => a.id === 'flags');
  return (
    <div className="station-home">
      <header className="home-head">
        <img className="brand-mark" src="./favicon.svg" alt="" aria-hidden="true" />
        <div className="home-title">
          <h1>{st.name}</h1>
          <span className="muted small">
            {persona ? `${persona.name} (simulated)` : 'You'} · <button className="link-button inline-link" onClick={onChange}>change</button>
          </span>
        </div>
        <div className="head-tools">
          <Popover label={`Notifications: ${bell.length}`} className="bell" button={<><BellIcon />{bell.length > 0 && <span className="count">{bell.length}</span>}</>}>
            {(close) => (
              <>
                {bell.length === 0 && <p className="muted small">Nothing new.</p>}
                {bell.map((a) => (
                  <div key={a.id} className="note">
                    <strong>{a.title}</strong>
                    <span className="muted small">{a.body}</span>
                    {a.actions.map((x) => (
                      <button key={x.label} className="link-button inline-link" onClick={() => { close(); act(x); }}>{x.label}</button>
                    ))}
                  </div>
                ))}
              </>
            )}
          </Popover>
          <Popover label="Demo" className="demo" button={<span className="demo-label">Demo</span>}>
            {(close) => (
              <>
                <p className="muted small">The live feed runs by itself. Add an event:</p>
                {DEMO_EVENTS.map((e) => (
                  <button key={e.type} className="menu-item" onClick={() => { close(); onEvent(e); }}>{e.label}</button>
                ))}
                <button className="menu-item" onClick={() => { close(); onClearEvents(); }}>Start over</button>
              </>
            )}
          </Popover>
          <Popover label="Menu" className="menu" button={<span aria-hidden="true">⋯</span>}>
            {(close) => (
              <>
                <button className="menu-item" onClick={() => { close(); go('station'); }}>Explore the data</button>
                <button className="menu-item" onClick={() => { close(); go('about'); }}>How Earshot works and sources</button>
              </>
            )}
          </Popover>
        </div>
      </header>

      <Suspense fallback={<p className="muted">Loading the station…</p>}>
        <Station key={session.station} lockedPlace={session.station} demoEvents={session.events} focus={focus} compact liveStart={liveStart} youStation={session.station} />
      </Suspense>

      <nav className="home-nav" aria-label="Main">
        <button onClick={() => go('plan')}>
          <strong>Plan my day</strong>
          <span className="muted small">{flags ? flags.title : 'No earplugs needed today'}</span>
        </button>
        <button onClick={() => go('ears')}>
          <strong>My ears</strong>
          <span className="muted small">{myEars}</span>
        </button>
        <button onClick={() => go('quick/general')}>
          <strong>Quick check</strong>
          <span className="muted small">2 minutes</span>
        </button>
      </nav>
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
