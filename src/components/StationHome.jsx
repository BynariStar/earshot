// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Home: the live station map. Navigation and alerts live in the bottom tab bar; the header holds only the
// station, who you are, and the presenter's Demo controls and menu.
import { watchPitches } from '../lib/protect.js';
import { lazy, Suspense, useEffect, useState } from 'react';
import { STATIONS } from '../lib/session.js';
import { partsOf } from '../lib/live.js';
import Sheet from './Sheet.jsx';
import { startGuidedDemo } from '../lib/guided.js';

const Station = lazy(() => import('./Station.jsx'));

const DEMO_EVENTS = [
  { type: 'loud', label: 'Treadmill without earplugs' },
  { type: 'ringing', symptom: 'ringing', label: 'Report ringing in the right ear', ear: 'right' },
];

export default function StationHome({ session, persona, data, focus, onEvent, onClearEvents, onChange, liveStart, pausedAt, onTogglePause, onMoveMe }) {
  const st = STATIONS[session.station];
  const [sheet, setSheet] = useState(null); // 'demo' | 'move'
  // P pauses or plays the simulated feed (for presenting).
  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === 'p' || e.key === 'P') && !/input|select|textarea/i.test(e.target.tagName)) onTogglePause();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onTogglePause]);
  const close = () => setSheet(null);
  const parts = partsOf(session.station).filter((p) => !p.struct);
  return (
    <div className="station-home">
      <button className="demo-fab" onClick={() => setSheet('demo')} aria-label="Demo controls">
        <span aria-hidden="true">⚙</span> Demo
      </button>

      <Suspense fallback={<p className="muted">Loading the station…</p>}>
        <Station key={session.station} lockedPlace={session.station} demoEvents={session.events} focus={focus} compact liveStart={liveStart} pausedAt={pausedAt} onTogglePause={onTogglePause} youStation={session.station} youAt={session.youAt ?? null} onMoveMe={onMoveMe} watch={data ? watchPitches(data)[0] ?? null : null} />
      </Suspense>

      {sheet === 'demo' && (
        <Sheet title="Demo controls" onClose={close}>
          <p className="muted demo-who">{persona ? `${persona.name} (simulated)` : 'You (your own baseline)'} · {st.name}</p>
          <div className="rows">
            <button className="row" onClick={startGuidedDemo}>
              <span>Play the guided demo<span className="muted small"> 1 min · Space pauses, → skips, Esc exits</span></span>
              <span aria-hidden="true">▶</span>
            </button>
            <button className="row" onClick={() => setSheet('move')}>
              <span>Move me to…<span className="muted small"> {session.youAt ? parts.find((p) => p.id === session.youAt)?.label : 'following my schedule'}</span></span>
              <span aria-hidden="true">›</span>
            </button>
            <button className="row" onClick={() => { onTogglePause(); close(); }}>
              <span>{pausedAt ? 'Play the live feed' : 'Pause the live feed'}<span className="muted small"> (P)</span></span>
            </button>
            {DEMO_EVENTS.map((e) => (
              <button key={e.type} className="row" onClick={() => { close(); onEvent(e); }}>
                <span>{e.label}</span>
              </button>
            ))}
            <button className="row" onClick={() => { close(); onClearEvents(); }}>
              <span>Start over</span>
            </button>
            <button className="row" onClick={() => { close(); onChange(); }}>
              <span>Change crew member or station</span><span aria-hidden="true">›</span>
            </button>
          </div>
        </Sheet>
      )}
      {sheet === 'move' && (
        <Sheet title="Move me to" onClose={close}>
          <div className="rows">
            <button className={`row${!session.youAt ? ' on' : ''}`} onClick={() => { onMoveMe(null); close(); }}>
              <span>Follow my schedule</span>{!session.youAt && <span aria-hidden="true">✓</span>}
            </button>
            {parts.map((p) => (
              <button key={p.id} className={`row${session.youAt === p.id ? ' on' : ''}`} onClick={() => { onMoveMe(p.id); close(); }}>
                <span>{p.label}</span>{session.youAt === p.id && <span aria-hidden="true">✓</span>}
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}
