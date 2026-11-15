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
import { liveFrame, jitter, incidentDelta, whereAt, signatureOf, spectrumIdOf, shortPart } from '../lib/live.js';
import { protectorFor, protectorWhy, levelReaching, reachLabel, REACH_DBA, trendFor } from '../lib/protect.js';
import { BASES, ATMOSPHERES, EXERCISE_SESSIONS, baseLevel, SPEC_WORK_DBA, SPEC_SLEEP_DBA } from '../lib/bases.js';

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

export default function Station({ lockedPlace, demoEvents = [], focus = null, compact = false, liveStart: liveStartProp, pausedAt = null, onTogglePause, youStation, youAt = null, onMoveMe, watch = null }) {
  const [place, setPlace] = useState(lockedPlace ?? 'iss');
  const [mode, setMode] = useState(lockedPlace ? 'live' : 'avg');
  const [t, setT] = useState(() => {
    if (!lockedPlace) return 8 * 60 + 30;
    const d = new Date();
    return Math.floor((d.getHours() * 60 + d.getMinutes()) / 5) * 5; // the home map opens at the current time of day
  });
  const [playing, setPlaying] = useState(false);
  // focus: { id, n } from an alert action ("Show the source"): select that module and open its details.
  const [selected, setSelected] = useState(focus?.id ?? null);
  const [panelOpen, setPanelOpen] = useState(!!focus?.id); // otherwise closed; events show as callouts on the map
  useEffect(() => {
    if (focus?.id) {
      setSelected(focus.id);
      setPanelOpen(true);
    }
  }, [focus?.id, focus?.n]);
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
  // Callouts: a "!" above each module with something happening now (red: loud now; amber: getting louder).
  // The open module's expands to its full text; tapping a "!" opens that module.
  const shortLabel = (id) => shortPart(partLabel(id));
  // Early warning (simulated): one module creeping louder over days. Shown on the home map only.
  const trend = lockedPlace && place === lockedPlace ? trendFor(place) : null;
  const callouts = [
    ...(faultModule ? [{ id: faultModule, text: `${shortLabel(faultModule)}: louder than normal, +${faultDelta(faultModule).toFixed(1)} dBA` }] : []),
    ...frame.active
      .filter((inc) => inc.part !== faultModule)
      .map((inc) => ({ id: inc.part, text: `${shortLabel(inc.part)}: ${inc.what.replace(/ started$/, '')}, ${inc.kind === 'activity' ? `${Math.round(levels[inc.part])} dBA` : `+${Math.round(levels[inc.part] - baseLv[inc.part])} dBA`}` })),
  ];
  if (trend && !callouts.some((c) => c.id === trend.part)) callouts.push({ id: trend.part, kind: 'trend', text: `${shortLabel(trend.part)}: getting louder, +${trend.rise.toFixed(1)} dBA in ${trend.span} days` });
  const panelShift = showPanel && panelOpen && wide ? 380 : 0;
  const incidentBox = selInc ? <LiveIncident inc={selInc} since={clockAt(selInc.since)} delta={levels[selInc.part] - baseLv[selInc.part]} place={place} /> : null;
  // The fault shown in a module's spectrum: the demo fault, or a live incident there.
  const faultFor = (id) => {
    if (id === faultModule) return true;
    const inc = activeOn(id);
    return inc?.kind === 'fault' ? { signature: inc.signature, rise: inc.rise } : null;
  };
  // Tapping a module opens its details; tapping the same module again undoes that: back to "Now" if the
  // panel was showing Now before, or closed if the tap is what opened it.
  const openedFrom = useRef(null); // 'now' | 'closed'
  const pick = (id) => {
    if (id === selected && panelOpen) {
      setSelected(null);
      if (openedFrom.current === 'closed') setPanelOpen(false);
      return;
    }
    if (!selected) openedFrom.current = panelOpen ? 'now' : 'closed';
    setSelected(id);
    setPanelOpen(true);
  };

  const timebar = mode === 'now' && (
        <div className={`timebar${compact ? ' map-time' : ''}`}>
          {!compact && (
            <button className="secondary play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play the day'}>
              {playing ? '❚❚' : '▶'}
            </button>
          )}
          <button className="secondary step-hour" onClick={() => { setT((x) => (x + 1380) % 1440); setPlaying(false); }} aria-label="One hour earlier">−1 h</button>
          <button className="secondary step-hour" onClick={() => { setT((x) => (x + 60) % 1440); setPlaying(false); }} aria-label="One hour later">+1 h</button>
          <input type="range" min="0" max="1435" step="5" value={t} onChange={(e) => { setT(Number(e.target.value)); setPlaying(false); }} aria-label="Time of day" />
          <span className="clock">{clock(t)}</span>
        </div>
  );

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
          camera={base ? base.camera : place === 'iss' ? [64, 49, 81] : [13, 11, 15]}
          target={base ? base.target : place === 'iss' ? [-5, -3, 0] : [0, 3, 0]}
          highlight={live ? highlights : faultModule ?? (base ? events.find((e) => base.parts.find((x) => x.id === e.id)?.kind === 'exercise')?.id : events[0]?.id === T2_MODULE ? T2_MODULE : undefined)}
          you={you}
          offsetRight={panelShift}
          viewRef={view}
          callouts={callouts.map((c) => ({ ...c, open: !!(panelOpen && sel && c.id === sel.id) }))}
          onCallout={pick}
        />

        <div className="map-overlay map-tl">
          {/* One control: play/pause for whatever is running (the live feed, or the day replay) + the view switch. */}
          <div className="mode-pill" role="group" aria-label="View">
            {(live ? !!onTogglePause : mode === 'now') && (
              <button
                className="pill-play"
                onClick={live ? onTogglePause : () => setPlaying((p) => !p)}
                aria-label={live ? (pausedAt ? 'Play the live feed (P)' : 'Pause the live feed (P)') : playing ? 'Pause the day' : 'Play the day'}
              >
                {(live ? !pausedAt : playing) ? '❚❚' : '▶'}
              </button>
            )}
            {(place === 'chamber' ? [['now', 'Day'], ['avg', 'Average']] : [['live', 'Live'], ['now', 'Day'], ['avg', 'Average']]).map(([v, label]) => (
              <button key={v} className={`pill-seg${mode === v ? ' on' : ''}`} aria-pressed={mode === v} onClick={() => { setMode(v); setPlaying(false); }}>
                {v === 'live' && <span className={live && pausedAt ? 'pause-dot' : 'live-dot'} aria-hidden="true" />}
                {v === 'live' && live && pausedAt ? 'Paused' : label}
              </button>
            ))}
          </div>
          {you && (
            <button className="you-btn map-chip" onClick={() => pick(you)}>
              <span className="you-dot" aria-hidden="true" /> You: <strong>{partLabel(you)}</strong>
            </button>
          )}
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
          <button className={`map-icon key-btn${showKey ? ' on' : ''}`} onClick={() => setShowKey((v) => !v)} aria-pressed={showKey}>Key</button>
          <button className={`map-icon${viewCtl ? ' on' : ''}`} onClick={() => setViewCtl((v) => !v)} aria-pressed={viewCtl} aria-label="Map buttons: turn and zoom">✥</button>
          {viewCtl && (
            <div className="view-ctl" role="group" aria-label="Map view controls">
              <button className="map-icon" onClick={() => view.current?.rotate(-1)} aria-label="Turn left">⟲</button>
              <button className="map-icon" onClick={() => view.current?.rotate(1)} aria-label="Turn right">⟳</button>
              <button className="map-icon" onClick={() => view.current?.zoom(0.8)} aria-label="Zoom in">+</button>
              <button className="map-icon" onClick={() => view.current?.zoom(1.25)} aria-label="Zoom out">−</button>
              <button className="map-icon" onClick={() => view.current?.reset()} aria-label="Reset view">⌂</button>
            </div>
          )}
        </div>

        {compact && timebar}
        {showPanel && panelOpen && (
          <aside className="map-panel" aria-label={sel ? `${sel.label} details` : 'What is happening now'}>
            {/* One header pattern: back on the left (details only), title in the middle, close on the right. */}
            <div className="panel-head">
              {sel && (live || faultModule) ? <button className="secondary back-now" onClick={() => setSelected(null)}>‹ Now</button> : <span className="head-spacer" />}
              <h3 className="panel-title">{sel ? sel.label : 'Now'}</h3>
              <button className="sheet-close" onClick={() => { setPanelOpen(false); setSelected(null); }} aria-label="Close">×</button>
            </div>
            {sel ? (
              <>
                {base ? (
                  <BaseDetail compact={compact} part={sel} level={levels2[sel.id]} why={whys[sel.id]} fault={faultFor(sel.id)} live={live} incident={incidentBox} extra={<><TrendBlock trend={trend?.part === sel.id ? trend : null} /><ProtectHere spectrumId={spectrumIdOf(place, sel.id)} fault={faultFor(sel.id)} watch={watch} /></>} />
                ) : (
                  <ModuleDetail compact={compact} part={sel} level={levels2[sel.id]} place={place} mode={live ? 'live' : mode} fault={faultFor(sel.id)} incident={incidentBox} extra={place === 'iss' && !sel.struct && <><TrendBlock trend={trend?.part === sel.id ? trend : null} /><ProtectHere spectrumId={sel.id} fault={faultFor(sel.id)} watch={watch} /></>} />
                )}
                {live && hereLog.length > 0 && (
                  <details className="here-log">
                    <summary>History <span className="muted">· {hereLog.length} {hereLog.length === 1 ? 'event' : 'events'}</span></summary>
                    <ol className="timeline">
                      {hereLog.map((e) => (
                        <li key={`${e.key}-${e.type}`} className={e.type}>
                          <span className="tl-time">{clockAt(e.at)}</span>
                          <span className="tl-text">{e.type === 'start' ? e.inc.what[0].toUpperCase() + e.inc.what.slice(1) : `${e.inc.fix[0].toUpperCase()}${e.inc.fix.slice(1)}, back to normal`}</span>
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
                {live && onMoveMe && youStation === place && !sel.struct && sel.id !== you && (
                  <button className="secondary small-btn" onClick={() => onMoveMe(sel.id)}>Move me here (demo)</button>
                )}
              </>
            ) : (
              <>
                {frame.active.length === 0 && !faultModule && !trend && <p className="muted small">All modules at their usual levels.</p>}
                <ul className="now-rows">
                  {faultModule && (
                    <li>
                      <button className="now-row" onClick={() => pick(faultModule)} onMouseEnter={() => setHover(faultModule)} onMouseLeave={() => setHover(null)}>
                        <span className="event-dot" aria-hidden="true" />
                        <span><strong>{STATIONS[place].faultName}</strong> louder than normal <span className="muted">+{faultDelta(faultModule).toFixed(1)} dBA</span></span>
                      </button>
                    </li>
                  )}
                  {trend && (
                    <li>
                      <button className="now-row" onClick={() => pick(trend.part)} onMouseEnter={() => setHover(trend.part)} onMouseLeave={() => setHover(null)}>
                        <span className="trend-dot" aria-hidden="true">↗</span>
                        <span><strong>{partLabel(trend.part)}</strong> getting louder <span className="muted">+{trend.rise.toFixed(1)} dBA in {trend.span} days</span></span>
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
      {!compact && timebar}

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

// Early warning (simulated): a module creeping louder over days, before it becomes a fault.
function TrendBlock({ trend }) {
  if (!trend) return null;
  const sig = signatureOf(trend.signature);
  const hz = (b) => (b >= 1000 ? `${b / 1000} kHz` : `${b} Hz`);
  return (
    <div className="trend-block">
      <span className="label-caps">Getting louder</span>
      <p className="source-big">
        <span className="trend-dot" aria-hidden="true">↗</span> +{trend.rise.toFixed(1)} dBA over {trend.span} days
      </p>
      <div className="trend-bars" aria-hidden="true">
        {trend.days.map((d, i) => <span key={i} style={{ height: `${12 + (d / trend.rise) * 28}px` }} />)}
      </div>
      <p className="source-detail">
        Mostly at {sig.bands.map(hz).join(' and ')}, like a ventilation fan wearing out. Protect your ears here until it's checked.
        <Info>Simulated trend, modelled on a real case: a Columbus ventilation fan grew noisier for about 15 days before it was switched off (Parzianello et al., ESMATS 2011). NASA trends its sound surveys to catch hardware going bad before it fails (Welsh, Denham & Allen 2011).</Info>
      </p>
    </div>
  );
}

// Which protector suits this module's noise, and whether it reaches the crew member's weakest pitch.
function ProtectHere({ spectrumId, fault, watch }) {
  const f = fault === true ? { signature: 'stalled-fan', rise: 8 } : fault || null;
  const prot = protectorFor(spectrumId, f);
  const lvl = watch ? levelReaching(spectrumId, watch.f, f) : null;
  const hz = (b) => (b >= 1000 ? `${b / 1000} kHz` : `${b} Hz`);
  return (
    <div className="protect-here">
      <span className="label-caps">Best protection here</span>
      <p>
        <strong>{prot.name}</strong>
        <Info>{protectorWhy(prot)} NASA lists foam ear inserts, passive muffs and noise-cancelling (ANR) headsets as ISS hearing countermeasures; noise cancelling adds most below 1 kHz. Choosing by spectrum is Earshot's rule, from NASA's measured spectra (Allen 2024).</Info>
      </p>
      {lvl !== null && lvl >= REACH_DBA && (
        <p className="small warn-text">
          Reaches your {watch.ear} ear's {hz(watch.f)}, which is on watch: {Math.round(lvl)} dBA at {reachLabel(watch.f)}, just below it.
        </p>
      )}
    </div>
  );
}

// A live incident in the selected area: what happened, since when, and where the noise comes from.
function LiveIncident({ inc, since, delta, place }) {
  const sig = inc.kind === 'fault' ? signatureOf(inc.signature) : null;
  const hz = (b) => (b >= 1000 ? `${b / 1000} kHz` : `${b} Hz`);
  const source = sig ? sig.name : place === 'iss' ? 'T2 treadmill in use' : 'Exercise machine in use';
  return (
    <div className="live-incident">
      <span className="label-caps">Likely source</span>
      <p className="source-big">
        <span className="event-dot" aria-hidden="true" /> {source}
      </p>
      <p className="source-detail">
        {sig ? `Louder at ${sig.bands.map(hz).join(' and ')}` : inc.what[0].toUpperCase() + inc.what.slice(1)}
        {Number.isFinite(delta) && delta > 0.05 ? `, +${delta.toFixed(1)} dBA` : ''} · since {since}
        <Info>
          {sig ? sig.basis : "NASA measured 84.5 dBA at the runner's head (Allen & Danielson 2020)."}
          {inc.illustrative ? ' Placed here for illustration; NASA reported it elsewhere on the ISS.' : ''}
        </Info>
      </p>
    </div>
  );
}

function BaseDetail({ compact, part, level, why, fault, live, incident, extra }) {
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
      {extra}
      <p className="small">{why}</p>
      <Spectrum id={part.id} fault={fault} hideSource={!!incident} showSources={!compact} />
    </div>
  );
}

function ModuleDetail({ part, level, place, mode, fault, incident, compact, extra }) {
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
      {extra}
      {m?.date && !compact && <p className="muted">NASA survey of {m.date}</p>}
      {place === 'iss' && !part.struct && <Spectrum id={part.id} fault={fault} hideSource={!!incident} showSources={!compact} />}
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
