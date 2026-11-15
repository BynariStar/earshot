// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Station noise in 3D. Two places and two modes:
// - ISS (schematic): "Average" = NASA's measured module averages (Allen 2024). "At the moment" = a
//   SIMULATED day, because NASA doesn't publish live module levels: module averages plus two treadmill
//   sessions (NASA's measured 84.5 dBA at the runner's head) and a sleep period.
// - "Live" (ISS and bases): a SIMULATED feed of incidents NASA has reported, to show continuous
//   monitoring (src/lib/live.js). The old "At the moment" is now "Over a day" (mode id 'now').
// - NASA chamber (real data): the three floors of NASA's 1997 sealed-chamber test (LMLSTP 3.3).
//   "Average" = each floor's 24-hour average; "At the moment" = the real minute-by-minute reading.
import { useEffect, useMemo, useRef, useState } from 'react';
import iss from '../data/iss_modules.json';
import lmlstp from '../data/lmlstp.json';
import Station3D from './Station3D.jsx';
import { ISS_PARTS, SLEEP_IN, T2_MODULE, NOISE_BINS, NO_DATA_COLOR, noiseColor } from '../lib/issLayout.js';
import { T2 } from '../lib/plan.js';
import Spectrum from './Spectrum.jsx';
import Info from './Info.jsx';
import Picker from './Picker.jsx';
import { faultDelta } from '../lib/spectrum.js';
import { STATIONS } from '../lib/session.js';
import { liveFrame, jitter, incidentDelta, whereAt, signatureOf } from '../lib/live.js';
import { BASES, ATMOSPHERES, EXERCISE_SESSIONS, baseLevel, pressureDelta, SPEC_WORK_DBA, SPEC_SLEEP_DBA } from '../lib/bases.js';

// A word for each colour band, so level never depends on colour alone.
const bandWord = (v) => (!Number.isFinite(v) ? '' : v <= 50 ? 'Quiet' : v <= 60 ? 'Moderate' : v <= 65 ? 'Loud' : 'Very loud');
const byId = Object.fromEntries(iss.modules.map((m) => [m.id, m]));
const CHAMBER_PARTS = lmlstp.floors.map((f, i) => ({ id: `floor${i}`, label: f.floor, axis: 'y', pos: [0, i * 3.1, 0], len: 2.9, r: 3.05 }));

// Simulated crew day (clock minutes). Treadmill times and sleep period are illustrative.
const T2_SESSIONS = [[8 * 60, 9 * 60], [15 * 60, 16 * 60]];
const SLEEP = [21 * 60 + 30, 6 * 60]; // wraps midnight
const inRange = (t, [a, b]) => (a <= b ? t >= a && t < b : t >= a || t < b);
const clock = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const startMinute = (iso) => {
  const [h, m] = iso.split('T')[1].split(':').map(Number);
  return h * 60 + m;
};

function issLevels(mode, t) {
  const out = Object.fromEntries(ISS_PARTS.map((p) => [p.id, byId[p.id]?.dba ?? null]));
  const events = [];
  if (mode === 'now') {
    if (T2_SESSIONS.some((r) => inRange(t, r))) {
      out[T2_MODULE] = T2.dba;
      events.push({ id: T2_MODULE, text: `T2 treadmill running in Node 3: ${T2.dba} dBA at the runner's head (NASA measurement).` });
    }
    if (inRange(t, SLEEP)) events.push({ id: 'node2', text: 'Crew asleep in their sleep stations (tap Node 2 or Zvezda for their levels).' });
  }
  return { levels: out, events };
}

function chamberLevels(mode, t) {
  const levels = {};
  lmlstp.floors.forEach((f, i) => {
    levels[`floor${i}`] = mode === 'avg' ? f.leq24hDba : f.series[(t - startMinute(f.start) + 1440) % 1440];
  });
  return { levels, events: [] };
}

function baseLevels(base, opts) {
  const levels = {};
  const whys = {};
  for (const part of base.parts) {
    const r = baseLevel(base, part, opts);
    levels[part.id] = r.dba;
    whys[part.id] = r.why;
  }
  const events = [];
  if (opts.mode === 'now') {
    const ex = base.parts.find((x) => x.kind === 'exercise');
    if (EXERCISE_SESSIONS.some(([a, b]) => opts.t >= a && opts.t < b)) {
      events.push({ id: ex.id, text: opts.basis === 'spec' ? 'Exercise session: at most 65 dBA if the machine meets NASA\'s 1-hour limit.' : `Exercise session: ${levels[ex.id].toFixed(1)} dBA if the machine is as loud as the ISS treadmill.` });
    }
    if (inRange(opts.t, SLEEP)) events.push({ id: base.parts.find((x) => x.kind === 'sleep').id, text: 'Crew asleep in their quarters.' });
  }
  return { levels, events, whys };
}

function Segmented({ value, options, onChange, label }) {
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} role="tab" aria-selected={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}

export default function Station({ lockedPlace, demoEvents = [], focus = null, compact = false, liveStart: liveStartProp, pausedAt = null, onTogglePause, youStation, youAt = null, onMoveMe }) {
  const [place, setPlace] = useState(lockedPlace ?? 'iss');
  const [mode, setMode] = useState(lockedPlace ? 'live' : 'avg');
  const [t, setT] = useState(() => {
    if (!lockedPlace) return 8 * 60 + 30;
    const d = new Date();
    return Math.floor((d.getHours() * 60 + d.getMinutes()) / 5) * 5; // the home map opens at the current time of day
  });
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState(focus);
  useEffect(() => {
    if (focus) setSelected(focus);
  }, [focus]);
  const [basis, setBasis] = useState('iss');
  const [atm, setAtm] = useState('8.2');
  const [fans, setFans] = useState('same-mass'); // realistic default: the same air mass must still move

  // Live feed clock: seconds since the feed started.
  const mountedAt = useRef(Date.now());
  const liveStart = liveStartProp ?? mountedAt.current;
  const elapsed = () => ((pausedAt ?? Date.now()) - liveStart) / 1000;
  const [liveS, setLiveS] = useState(elapsed);
  useEffect(() => {
    if (mode !== 'live') return undefined;
    setLiveS(elapsed());
    if (pausedAt) return undefined;
    const id = setInterval(() => setLiveS(elapsed()), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, liveStart, pausedAt]);
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth > 700);
  const [hover, setHover] = useState(null);
  const [viewCtl, setViewCtl] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const view = useRef(null);
  const [wide, setWide] = useState(() => window.innerWidth > 700);
  useEffect(() => {
    const on = () => setWide(window.innerWidth > 700);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  useEffect(() => {
    if (!playing || mode !== 'now') return undefined;
    const id = setInterval(() => setT((x) => (x + 10) % 1440), 120);
    return () => clearInterval(id);
  }, [playing, mode]);

  const base = BASES[place];
  const parts = base ? base.parts : place === 'iss' ? ISS_PARTS : CHAMBER_PARTS;
  const live = mode === 'live' && place !== 'chamber';
  const calcMode = live ? 'avg' : mode;
  const { levels: baseLv, events, whys } = useMemo(
    () => (base ? baseLevels(base, { basis, atm, fans, mode: calcMode, t }) : place === 'iss' ? issLevels(calcMode, t) : chamberLevels(calcMode, t)),
    [base, place, basis, atm, fans, calcMode, t]
  );
  // Live: the loud-activity level for an area (ISS treadmill, or a base's exercise session).
  const activityLevel = (id) => {
    if (place === 'iss') return T2.dba;
    const part = base.parts.find((x) => x.id === id);
    return baseLevel(base, part, { basis, atm, fans, mode: 'now', t: EXERCISE_SESSIONS[0][0] }).dba;
  };
  const frame = live ? liveFrame(place, liveS) : { active: [], log: [] };
  const specId = (id) => (base ? base.parts.find((x) => x.id === id)?.iss ?? id : id);
  const levels = useMemo(() => {
    if (!live) return baseLv;
    const out = {};
    parts.forEach((p, n) => {
      const v = baseLv[p.id];
      out[p.id] = Number.isFinite(v) ? v + jitter(liveS, n) : v;
    });
    for (const inc of frame.active) {
      if (!Number.isFinite(out[inc.part])) continue;
      out[inc.part] = inc.kind === 'activity' ? activityLevel(inc.part) + jitter(liveS, 99) : out[inc.part] + incidentDelta(inc, specId(inc.part));
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseLv, live, liveS, parts]);
  const activeOn = (id) => frame.active.find((x) => x.part === id);
  // A demo fault raises one module's noise in the fault signature's bands.
  const faultModule = demoEvents.some((e) => e.type === 'fan-fault') ? STATIONS[place]?.faultModule : null;
  const levels2 = useMemo(() => {
    if (!faultModule || !Number.isFinite(levels[faultModule])) return levels;
    return { ...levels, [faultModule]: levels[faultModule] + faultDelta(faultModule) };
  }, [levels, faultModule]);
  const sel = parts.find((p) => p.id === selected);
  const highlights = [faultModule, ...frame.active.map((x) => x.part), hover].filter(Boolean);
  const you = live && youStation === place ? youAt ?? whereAt(place, liveS) : null;
  const clockAt = (at) => new Date(liveStart + at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const partLabel = (id) => parts.find((p) => p.id === id)?.label ?? id;
  const selInc = sel && live ? activeOn(sel.id) : null;
  const hereLog = sel && live ? liveFrame(place, liveS, 60).log.filter((e) => e.inc.part === sel.id).slice(0, 4) : [];
  // The panel: "Now" in live view (or during a demo fault), a module's details when one is selected.
  const showPanel = !!sel || live || !!faultModule;
  const panelShift = showPanel && panelOpen && wide ? 380 : 0;
  const incidentBox = selInc ? <LiveIncident inc={selInc} since={clockAt(selInc.since)} delta={levels[selInc.part] - baseLv[selInc.part]} place={place} /> : null;
  // The fault shown in a module's spectrum: the demo fault, or a live incident there.
  const faultFor = (id) => {
    if (id === faultModule) return true;
    const inc = activeOn(id);
    return inc?.kind === 'fault' ? { signature: inc.signature, rise: inc.rise } : null;
  };
  const pick = (id) => {
    setSelected(id);
    setPanelOpen(true);
  };

  return (
    <section className="station">
      {!lockedPlace && <div className="station-controls">
        <Segmented
          label="Place"
          value={place}
          onChange={(v) => { setPlace(v); setSelected(null); if (BASES[v]) setAtm(BASES[v].defaultAtm); if (v === 'chamber' && mode === 'live') setMode('avg'); }}
          options={[['iss', 'ISS'], ['moon', 'Moon base'], ['mars', 'Mars base'], ['chamber', 'NASA chamber (real data)']]}
        />
      </div>}

      {base && !compact && (
        <div className="station-controls base-controls">
          <Segmented label="Levels" value={basis} onChange={setBasis} options={[['spec', 'Built to NASA limits'], ['iss', 'ISS-like']]} />
          <Picker label="Cabin air" value={atm} options={Object.entries(ATMOSPHERES).map(([k, x]) => ({ value: k, label: x.label }))} onChange={setAtm} />
          {basis === 'iss' && atm !== '14.7' && (
            <Segmented label="Fans" value={fans} onChange={setFans} options={[['same-mass', 'Fans sped up for the same airflow'], ['same-speed', 'Same fans, same speed']]} />
          )}
        </div>
      )}


      {!compact && !live && <p className="muted provenance">
        {place === 'iss' && mode === 'avg' && "NASA's measured average for each module (Allen 2024, ICES-2024-354). Grey: no dBA value published (Unity and the Quest airlock are reported only as meeting NASA's NC-50 limit)."}
        {place === 'iss' && mode === 'now' && 'Simulated day. NASA publishes module averages, not live levels. Fans and pumps run around the clock, so modules change little hour to hour; the big swings come from crew activities. This day adds two treadmill hours and a sleep period to the measured averages.'}
        {base && (
          <>
            <strong>Simulated {base.name.toLowerCase()}:</strong> {base.subtitle}. No such habitat has measured noise yet.{' '}
            {basis === 'spec'
              ? `Each area is at NASA's design limit: ${SPEC_WORK_DBA.toFixed(1)} dBA for work areas (NC-50) and ${SPEC_SLEEP_DBA.toFixed(1)} dBA for sleep (NC-40), the most a compliant room could be.`
              : 'Each area takes the measured level of the ISS module with the same equipment, adjusted for cabin pressure.'}{' '}
            {base.note}
          </>
        )}
        {place === 'chamber' && mode === 'avg' && "Real NASA data: each floor's 24-hour average from the 1997 90-day sealed-chamber test with four crew (LMLSTP 3.3, NASA Life Sciences Portal)."}
        {place === 'chamber' && mode === 'now' && "Real NASA data, minute by minute. Each floor's 24-hour recording was made on a different date; they're lined up here by time of day."}
      </p>}

      <div className={`station-stage${compact ? ' home-stage' : ''}`}>
        <Station3D
          key={place}
          parts={parts}
          levels={levels2}
          selected={selected}
          onSelect={pick}
          decor={base ? base.decor : place === 'iss' ? 'iss' : 'none'}
          camera={base ? base.camera : place === 'iss' ? [52, 40, 66] : [13, 11, 15]}
          target={base ? base.target : place === 'iss' ? [-5, -3, 0] : [0, 3, 0]}
          highlight={live ? highlights : faultModule ?? (base ? events.find((e) => base.parts.find((x) => x.id === e.id)?.kind === 'exercise')?.id : events[0]?.id === T2_MODULE ? T2_MODULE : undefined)}
          you={you}
          offsetRight={panelShift}
          viewRef={view}
        />

        <div className="map-overlay map-tl">
          {live && (
            <div className="live-ctl">
              <span className={`map-chip${pausedAt ? ' paused' : ''}`}>
                <span className={pausedAt ? 'pause-dot' : 'live-dot'} aria-hidden="true" /> {pausedAt ? 'Paused' : 'Live'}
                <Info>Simulated: faults NASA has reported on the ISS, replayed on a loop over the {place === 'iss' ? 'measured averages' : 'simulated averages'}. Earshot assumes it knows which module you're in.</Info>
              </span>
              {onTogglePause && (
                <button className="icon-button map-icon" onClick={onTogglePause} aria-label={pausedAt ? 'Play the simulated feed (P)' : 'Pause the simulated feed (P)'} title={pausedAt ? 'Play (P)' : 'Pause (P)'}>
                  {pausedAt ? '▶' : '❚❚'}
                </button>
              )}
            </div>
          )}
          <div className="map-mode">
          <Segmented
            label="View"
            value={mode}
            onChange={(v) => { setMode(v); setPlaying(false); }}
            options={place === 'chamber' ? [['now', 'Day'], ['avg', 'Average']] : [['live', 'Live'], ['now', 'Day'], ['avg', 'Average']]}
          />
          </div>
          {!live && mode === 'now' && events.length > 0 && <p className="map-note">{events[0].text}</p>}
        </div>
        {showKey && (
          <div className="map-overlay map-key" aria-label="Colour key">
            {NOISE_BINS.map((b, i) => (
              <span key={b.label}><i style={{ background: b.color }} /><strong>{['Quiet', 'Moderate', 'Loud', 'Very loud'][i]}</strong> {b.label.replace(' (sleep target)', '')}</span>
            ))}
            {place !== 'chamber' && <span><i style={{ background: NO_DATA_COLOR }} /><strong>No value</strong></span>}
          </div>
        )}
        <div className="map-overlay map-r">
          {viewCtl && (
            <div className="view-ctl" role="group" aria-label="Map view controls">
              <button className="map-icon" onClick={() => view.current?.rotate(-1)} aria-label="Turn left">⟲</button>
              <button className="map-icon" onClick={() => view.current?.rotate(1)} aria-label="Turn right">⟳</button>
              <button className="map-icon" onClick={() => view.current?.zoom(0.8)} aria-label="Zoom in">+</button>
              <button className="map-icon" onClick={() => view.current?.zoom(1.25)} aria-label="Zoom out">−</button>
              <button className="map-icon" onClick={() => view.current?.reset()} aria-label="Reset view">⌂</button>
            </div>
          )}
          <button className={`map-icon key-btn${showKey ? ' on' : ''}`} onClick={() => setShowKey((v) => !v)} aria-pressed={showKey}>Key</button>
          <button className={`map-icon${viewCtl ? ' on' : ''}`} onClick={() => setViewCtl((v) => !v)} aria-pressed={viewCtl} aria-label="Map buttons: turn and zoom">✥</button>
        </div>
        {you && (
          <div className="map-overlay map-bl">
            <button className="you-btn" onClick={() => pick(you)}>
              <span className="you-dot" aria-hidden="true" /> You: <strong>{partLabel(you)}</strong>
            </button>
          </div>
        )}

        {showPanel && panelOpen && (
          <aside className="map-panel" aria-label={sel ? `${sel.label} details` : 'What is happening now'}>
            <div className="panel-head">
              {sel ? (
                live || faultModule ? <button className="secondary back-now" onClick={() => setSelected(null)}>‹ Now</button> : <span />
              ) : (
                <span className="label-caps">Now</span>
              )}
              <button className="sheet-close" onClick={() => (sel && !live && !faultModule ? setSelected(null) : setPanelOpen(false))} aria-label={sel && !live && !faultModule ? 'Close' : 'Collapse the panel'}>
                {sel && !live && !faultModule ? '×' : '›'}
              </button>
            </div>
            {sel ? (
              <>
                {base ? (
                  <BaseDetail part={sel} level={levels2[sel.id]} why={whys[sel.id]} atm={atm} basis={basis} fault={faultFor(sel.id)} live={live} incident={incidentBox} />
                ) : (
                  <ModuleDetail part={sel} level={levels2[sel.id]} place={place} mode={live ? 'live' : mode} fault={faultFor(sel.id)} incident={incidentBox} />
                )}
                {live && hereLog.length > 0 && (
                  <>
                    <h4>History here</h4>
                    <ul className="feed">
                      {hereLog.map((e) => (
                        <li key={`${e.key}-${e.type}`} className={`feed-${e.type}`}><span className="muted">{clockAt(e.at)}</span> {e.type === 'start' ? e.inc.what : `${e.inc.fix}, back to normal`}</li>
                      ))}
                    </ul>
                  </>
                )}
                {live && onMoveMe && youStation === place && !sel.struct && sel.id !== you && (
                  <button className="secondary small-btn" onClick={() => onMoveMe(sel.id)}>Move me here (demo)</button>
                )}
              </>
            ) : (
              <>
                {frame.active.length === 0 && !faultModule && <p className="muted small">All modules at their usual levels.</p>}
                <ul className="now-rows">
                  {faultModule && (
                    <li>
                      <button className="now-row" onClick={() => pick(faultModule)} onMouseEnter={() => setHover(faultModule)} onMouseLeave={() => setHover(null)}>
                        <span className="event-dot" aria-hidden="true" />
                        <span><strong>{STATIONS[place].faultName}</strong> louder than normal <span className="muted">+{faultDelta(faultModule).toFixed(1)} dBA</span></span>
                      </button>
                    </li>
                  )}
                  {frame.active.map((inc) => (
                    <li key={inc.key}>
                      <button className="now-row" onClick={() => pick(inc.part)} onMouseEnter={() => setHover(inc.part)} onMouseLeave={() => setHover(null)}>
                        <span className="event-dot" aria-hidden="true" />
                        <span>
                          <strong>{partLabel(inc.part)}</strong> {inc.what}{' '}
                          <span className="muted">{inc.kind === 'activity' ? `${levels[inc.part].toFixed(1)} dBA` : `+${(levels[inc.part] - baseLv[inc.part]).toFixed(1)} dBA`}</span>
                          {inc.part === you && <span className="you-tag"> · you're here</span>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {live && (
                  <>
                    <h4>Feed</h4>
                    {frame.log.length === 0 && <p className="muted small">Nothing yet.</p>}
                    <ul className="feed">
                      {frame.log.map((e) => (
                        <li key={`${e.key}-${e.type}`} className={`feed-${e.type}`}>
                          <button className="feed-row" onClick={() => pick(e.inc.part)} onMouseEnter={() => setHover(e.inc.part)} onMouseLeave={() => setHover(null)}>
                            <span className="muted">{clockAt(e.at)}</span>
                            <span><strong>{partLabel(e.inc.part)}</strong> {e.type === 'start' ? e.inc.what : `${e.inc.fix}, back to normal`}</span>
                            <span className="chev" aria-hidden="true">›</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <p className="muted small">Tap {place === 'chamber' ? 'a floor' : place === 'iss' ? 'a module' : 'an area'} for its noise by pitch.</p>
              </>
            )}
          </aside>
        )}
        {showPanel && !panelOpen && (
          <button className="panel-tab" onClick={() => setPanelOpen(true)}>
            ‹ {sel ? sel.label : frame.active.length ? `${frame.active.length} now` : 'Details'}
          </button>
        )}
      </div>
      {mode === 'now' && (
        <div className="timebar">
          <button className="secondary play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play the day'}>
            {playing ? '❚❚' : '▶'}
          </button>
          <button className="secondary step-hour" onClick={() => { setT((x) => (x + 1380) % 1440); setPlaying(false); }} aria-label="One hour earlier">−1 h</button>
          <button className="secondary step-hour" onClick={() => { setT((x) => (x + 60) % 1440); setPlaying(false); }} aria-label="One hour later">+1 h</button>
          <input type="range" min="0" max="1435" step="5" value={t} onChange={(e) => { setT(Number(e.target.value)); setPlaying(false); }} aria-label="Time of day" />
          <span className="clock">{clock(t)}</span>
        </div>
      )}

      {place === 'chamber' && <ChamberChart floor={selected ? Number(selected.replace('floor', '')) : 1} t={mode === 'now' ? t : null} />}
      {place === 'iss' && !compact && (
        <details className="module-list">
          <summary>All measured levels, as a list</summary>
          <ul>
            {[...iss.modules].sort((a, b) => b.dba - a.dba).map((m) => (
              <li key={m.id}><i style={{ background: noiseColor(m.dba) }} />{m.name} <strong>{m.dba.toFixed(1)} dBA</strong> <span className="muted">{m.kind}</span></li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

// A live incident in the selected area: what happened, since when, and where the noise comes from.
function LiveIncident({ inc, since, delta, place }) {
  const sig = inc.kind === 'fault' ? signatureOf(inc.signature) : null;
  return (
    <div className="live-incident">
      <p>
        <span className="event-dot" aria-hidden="true" /> <strong>{inc.what[0].toUpperCase() + inc.what.slice(1)}</strong> since {since}
        {Number.isFinite(delta) && delta > 0.05 ? `, +${delta.toFixed(1)} dBA` : ''}
      </p>
      <p className="source-line">
        <span className="label-caps">Source</span>{' '}
        {sig ? (
          <>
            likely a {sig.name.toLowerCase()}: the rise is at {sig.bands.map((b) => (b >= 1000 ? `${b / 1000} kHz` : `${b} Hz`)).join(' and ')}.
            <Info>{sig.basis}{inc.illustrative ? ' Placed here for illustration; NASA reported it elsewhere on the ISS.' : ''}</Info>
          </>
        ) : place === 'iss' ? (
          <>
            the T2 treadmill, in use.
            <Info>NASA measured 84.5 dBA at the runner's head (Allen & Danielson 2020).</Info>
          </>
        ) : (
          'the exercise machine, in use.'
        )}
      </p>
    </div>
  );
}

function BaseDetail({ part, level, why, atm, basis, fault, live, incident }) {
  const d = pressureDelta(atm);
  return (
    <div className="module-detail">
      <h3>{part.label}</h3>
      <p className="muted">{part.contains}</p>
      {Number.isFinite(level) ? (
        <p className="level" style={{ color: noiseColor(level) }} data-band={bandWord(level)}>
          {level.toFixed(1)} dBA <span className="muted">{live ? 'live (simulated)' : 'simulated'}</span>
        </p>
      ) : (
        <p className="muted">No value.</p>
      )}
      {incident}
      <p className="small">{why}</p>
      <Spectrum id={part.id} fault={fault} hideSource={!!incident} />
      {atm !== '14.7' && (
        <>
          <h4>Lower cabin pressure</h4>
          <p className="small">
            {basis === 'iss'
              ? `Thinner air carries the same fans differently. Our estimate from the standard fan laws: about ${d.sameSpeed.toFixed(1)} dB if the fans keep their speed, or ${d.sameMass > 0 ? '+' : ''}${d.sameMass.toFixed(1)} dB if they spin faster to move the same mass of air for cooling and CO₂ removal. Real designs would sit in between or be re-engineered.`
              : "NASA's limits apply at any cabin pressure, so a compliant room meets them either way."}
          </p>
          <p className="small">Headphone output also changes with air pressure, so hearing baselines must be taken at the habitat's own pressure.</p>
        </>
      )}
    </div>
  );
}

function ModuleDetail({ part, level, place, mode, fault, incident }) {
  const m = byId[part.id];
  const sleepers = SLEEP_IN[part.id] ?? [];
  return (
    <div className="module-detail">
      <h3>{part.label}</h3>
      {part.struct ? (
        <p className="muted">Connecting passage; no separate noise value.</p>
      ) : Number.isFinite(level) ? (
        <p className="level" style={{ color: noiseColor(level) }} data-band={bandWord(level)}>
          {level.toFixed(1)} dBA <span className="muted">{mode === 'live' ? 'live (simulated)' : mode === 'avg' ? (place === 'iss' ? 'measured average' : '24-hour average') : place === 'iss' ? 'simulated, this time of day' : 'this minute'}</span>
        </p>
      ) : (
        <p className="muted">No dBA value published (reported only as meeting NASA's NC-50 limit, or not measured).</p>
      )}
      {incident}
      {m?.date && <p className="muted">NASA survey of {m.date}</p>}
      {place === 'iss' && !part.struct && <Spectrum id={part.id} fault={fault} hideSource={!!incident} />}
      {sleepers.length > 0 && (
        <div className="sleep-line">
          <p className="small">
            {sleepers.length} crew quarters here, {Math.min(...sleepers.map((id) => byId[id].dba))}–{Math.max(...sleepers.map((id) => byId[id].dba))} dBA.
          </p>
          <button className="secondary" onClick={() => { window.location.hash = '#/plan/sleep'; }}>Choose where I sleep ›</button>
        </div>
      )}
      {place === 'chamber' && (
        <p className="muted">The chart below shows this floor's full day.</p>
      )}
    </div>
  );
}

function ChamberChart({ floor, t }) {
  const f = lmlstp.floors[floor];
  const series = f.series;
  const W = 720, H = 200, pad = 32;
  const lo = 50, hi = 95;
  const x = (i) => pad + (i / (series.length - 1)) * (W - pad - 8);
  const y = (v) => H - pad - ((v - lo) / (hi - lo)) * (H - pad - 8);
  const line = series.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const cursor = t === null ? null : (t - startMinute(f.start) + 1440) % 1440;
  return (
    <div className="chamber">
      <h3>{f.floor}: the full recorded day</h3>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Sound level over 24 hours">
        {[50, 60, 70, 80, 90].map((v) => (
          <g key={v}>
            <line x1={pad} x2={W - 8} y1={y(v)} y2={y(v)} className="grid" />
            <text x={pad - 6} y={y(v) + 4} textAnchor="end" className="axis">{v}</text>
          </g>
        ))}
        <line x1={pad} x2={W - 8} y1={y(72)} y2={y(72)} className="limit" />
        <text x={pad + 4} y={y(72) + 13} textAnchor="start" className="axis limit-label">72</text>
        <path d={line} className="series" />
        {cursor !== null && <line x1={x(cursor)} x2={x(cursor)} y1={8} y2={H - pad} className="cursor" />}
        <text x={pad} y={H - 8} className="axis">{clock(startMinute(f.start))}</text>
        <text x={W - 8} y={H - 8} textAnchor="end" className="axis">+24 h</text>
      </svg>
      <p>
        24-hour average <strong>{f.leq24hDba} dBA</strong>, loudest minute {f.maxDba} dBA. Spending the whole day here would use{' '}
        <strong className={f.nasaDose24h > 100 ? 'over' : ''}>{Math.round(f.nasaDose24h)}%</strong> of NASA's daily noise allowance
        {f.nasaDose24h > 100 ? ', over the limit.' : '.'}
      </p>
      <p className="muted">
        Red dashed line: 72 dBA, the ISS flight-rule level (B13-152). It applies to a 16-hour workday average, not single minutes. Static
        readings at a fixed point on each floor, not personal dosimeters.
      </p>
    </div>
  );
}
