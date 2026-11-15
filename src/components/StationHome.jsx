// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Home: the live station map. Anything that needs action now opens full screen (App); everything else
// waits behind the bell. Below the map: what's happening now, then Plan my day, My ears, Quick check.
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { STATIONS } from '../lib/session.js';
import { partsOf } from '../lib/live.js';

const Station = lazy(() => import('./Station.jsx'));

const DEMO_EVENTS = [
  { type: 'loud', label: 'Treadmill without earplugs' },
  { type: 'ringing', label: 'Ringing in the right ear', ear: 'right' },
];

// A small popover that closes on outside click or Escape.
function Popover({ label, button, children, className = '', onOpen }) {
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
      <button
        className="icon-button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => {
          if (!open) onOpen?.();
          setOpen((o) => !o);
        }}
      >
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

export default function StationHome({ session, persona, alerts, go, focus, onEvent, onClearEvents, onChange, liveStart, pausedAt, onTogglePause, onSeen, onDone, onMoveMe }) {
  const st = STATIONS[session.station];
  const key = (a) => `${a.id}:${a.title}`;
  const bell = alerts.filter((a) => !(session.done ?? []).includes(key(a))); // most urgent first
  const unseen = bell.filter((a) => !(session.bellSeen ?? []).includes(key(a)));
  const [fresh, setFresh] = useState([]); // what was new when the bell was opened
  const worst = unseen.some((x) => x.level === 'urgent') ? 'urgent' : unseen.some((x) => x.level === 'warn') ? 'warn' : 'info';
  // P pauses or plays the simulated feed (for presenting).
  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === 'p' || e.key === 'P') && !/input|select|textarea/i.test(e.target.tagName)) onTogglePause();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onTogglePause]);
  const act = (x) => (x.event ? onEvent(x.event) : go(x.to));
  const myEars = alerts.find((a) => a.id === 'baseline') ? 'Set your baseline' : 'Your hearing and quick checks';
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
          <Popover label={`Notifications: ${unseen.length} new`} className="bell" onOpen={() => { setFresh(unseen.map(key)); onSeen(bell.map(key)); }} button={<><BellIcon />{unseen.length > 0 && <span className={`count ${worst}`}>{unseen.length}</span>}</>}>
            {(close) => (
              <>
                {bell.length === 0 && <p className="muted small">Nothing new.</p>}
                {bell.map((a) => (
                  <div key={a.id} className={`note ${a.level}${fresh.includes(key(a)) ? ' new' : ''}`}>
                    {a.dismissable && (
                      <button className="done-btn" onClick={() => onDone(key(a))} aria-label={`Mark "${a.title}" as done`} title="Done">✓</button>
                    )}
                    <strong>{a.level === 'urgent' && <span className="event-dot" aria-hidden="true" />}{a.title}</strong>
                    <span className="muted small">{a.body}</span>
                    {a.actions.map((x) => (
                      <button key={x.label} className="link-button inline-link" onClick={() => { close(); act(x); }}>{x.label}</button>
                    ))}
                  </div>
                ))}
              </>
            )}
          </Popover>
          <Popover label="Demo controls" className="demo" button={<span className="demo-label"><span className="wide-only">Demo controls</span><span className="narrow-only">Demo</span></span>}>
            {(close) => (
              <>
                <label className="menu-field">
                  Move me to
                  <select value={session.youAt ?? ''} onChange={(e) => { onMoveMe(e.target.value || null); close(); }}>
                    <option value="">Follow my schedule</option>
                    {partsOf(session.station).filter((p) => !p.struct).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </label>
                <p className="muted small">Add an event:</p>
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
        <Station key={session.station} lockedPlace={session.station} demoEvents={session.events} focus={focus} compact liveStart={liveStart} pausedAt={pausedAt} onTogglePause={onTogglePause} youStation={session.station} youAt={session.youAt ?? null} onMoveMe={onMoveMe} />
      </Suspense>

      <nav className="home-nav" aria-label="Main">
        <button onClick={() => go('plan')}>
          <Icon name="plan" />
          <strong>Plan my day</strong>
          <span className="muted small">{flags ? flags.title : 'No earplugs needed today'}</span>
        </button>
        <button onClick={() => go('ears')}>
          <Icon name="ear" />
          <strong>My ears</strong>
          <span className="muted small">{myEars}</span>
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

const ICONS = {
  plan: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M8 14h2M14 14h2M8 18h2" /></>,
  ear: <><path d="M6 8.5a6 6 0 0 1 12 0c0 3.5-2.5 4.6-3.5 6.3-.9 1.6-.6 3.2-1.8 4.4A3 3 0 0 1 7.5 18" /><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.6-1.6 2.2-2 3.3" /></>,
  check: <><path d="M2 12h4l3-7 4 14 3-7h6" /></>,
};
function Icon({ name }) {
  return (
    <svg className="nav-icon" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  );
}
