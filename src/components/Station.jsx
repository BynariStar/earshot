// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Station noise in 3D. Two places and two modes:
// - ISS (schematic): "Average" = NASA's measured module averages (Allen 2024). "At the moment" = a
//   SIMULATED day, because NASA doesn't publish live module levels: module averages plus two treadmill
//   sessions (NASA's measured 84.5 dBA at the runner's head) and a sleep period.
// - NASA chamber (real data): the three floors of NASA's 1997 sealed-chamber test (LMLSTP 3.3).
//   "Average" = each floor's 24-hour average; "At the moment" = the real minute-by-minute reading.
import { useEffect, useMemo, useState } from 'react';
import iss from '../data/iss_modules.json';
import lmlstp from '../data/lmlstp.json';
import Station3D from './Station3D.jsx';
import { ISS_PARTS, SLEEP_IN, T2_MODULE, NOISE_BINS, NO_DATA_COLOR, noiseColor } from '../lib/issLayout.js';
import { T2 } from '../lib/plan.js';
import Spectrum from './Spectrum.jsx';
import { faultDelta } from '../lib/spectrum.js';
import { STATIONS } from '../lib/session.js';
import { BASES, ATMOSPHERES, EXERCISE_SESSIONS, baseLevel, pressureDelta, SPEC_WORK_DBA, SPEC_SLEEP_DBA } from '../lib/bases.js';

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

export default function Station({ lockedPlace, demoEvents = [], focus = null, compact = false }) {
  const [place, setPlace] = useState(lockedPlace ?? 'iss');
  const [mode, setMode] = useState(lockedPlace ? 'now' : 'avg');
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

  useEffect(() => {
    if (!playing || mode !== 'now') return undefined;
    const id = setInterval(() => setT((x) => (x + 10) % 1440), 120);
    return () => clearInterval(id);
  }, [playing, mode]);

  const base = BASES[place];
  const parts = base ? base.parts : place === 'iss' ? ISS_PARTS : CHAMBER_PARTS;
  const { levels, events, whys } = useMemo(
    () => (base ? baseLevels(base, { basis, atm, fans, mode, t }) : place === 'iss' ? issLevels(mode, t) : chamberLevels(mode, t)),
    [base, place, basis, atm, fans, mode, t]
  );
  // A demo fault raises one module's noise in the fault signature's bands.
  const faultModule = demoEvents.some((e) => e.type === 'fan-fault') ? STATIONS[place]?.faultModule : null;
  const levels2 = useMemo(() => {
    if (!faultModule || !Number.isFinite(levels[faultModule])) return levels;
    return { ...levels, [faultModule]: levels[faultModule] + faultDelta(faultModule) };
  }, [levels, faultModule]);
  const sel = parts.find((p) => p.id === selected);
  const pick = (id) => setSelected(id);

  return (
    <section className="station">
      {!lockedPlace && <div className="station-controls">
        <Segmented
          label="Place"
          value={place}
          onChange={(v) => { setPlace(v); setSelected(null); if (BASES[v]) setAtm(BASES[v].defaultAtm); }}
          options={[['iss', 'ISS'], ['moon', 'Moon base'], ['mars', 'Mars base'], ['chamber', 'NASA chamber (real data)']]}
        />
        <Segmented label="Mode" value={mode} onChange={(v) => { setMode(v); setPlaying(false); }} options={[['avg', 'Average'], ['now', 'At the moment']]} />
      </div>}
      {lockedPlace && (
        <div className="station-controls">
          <Segmented label="Mode" value={mode} onChange={(v) => { setMode(v); setPlaying(false); }} options={[['now', 'At the moment'], ['avg', 'Average']]} />
        </div>
      )}

      {base && !compact && (
        <div className="station-controls base-controls">
          <Segmented label="Levels" value={basis} onChange={setBasis} options={[['spec', 'Built to NASA limits'], ['iss', 'ISS-like']]} />
          <label className="select">
            Cabin air
            <select value={atm} onChange={(e) => setAtm(e.target.value)}>
              {Object.entries(ATMOSPHERES).map(([k, a]) => <option key={k} value={k}>{a.label}</option>)}
            </select>
          </label>
          {basis === 'iss' && atm !== '14.7' && (
            <Segmented label="Fans" value={fans} onChange={setFans} options={[['same-mass', 'Fans sped up for the same airflow'], ['same-speed', 'Same fans, same speed']]} />
          )}
        </div>
      )}

      {mode === 'now' && (
        <div className="timebar">
          <button className="secondary play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play the day'}>
            {playing ? '❚❚' : '▶'}
          </button>
          <input type="range" min="0" max="1435" step="5" value={t} onChange={(e) => { setT(Number(e.target.value)); setPlaying(false); }} aria-label="Time of day" />
          <span className="clock">{clock(t)}</span>
        </div>
      )}

      {!compact && <p className="muted provenance">
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

      <div className="station-stage">
        <Station3D
          key={place}
          parts={parts}
          levels={levels2}
          selected={selected}
          onSelect={pick}
          decor={base ? base.decor : place === 'iss' ? 'iss' : 'none'}
          camera={base ? base.camera : place === 'iss' ? [52, 40, 66] : [13, 11, 15]}
          target={base ? base.target : place === 'iss' ? [-5, -3, 0] : [0, 3, 0]}
          highlight={faultModule ?? (base ? events.find((e) => base.parts.find((x) => x.id === e.id)?.kind === 'exercise')?.id : events[0]?.id === T2_MODULE ? T2_MODULE : undefined)}
        />
        <aside className="station-panel">
          {events.map((e) => <p key={e.text} className="event">{e.text}</p>)}
          {faultModule && <p className="event">{STATIONS[place].faultName}: {faultDelta(faultModule) > 0 ? '+' : ''}{faultDelta(faultModule).toFixed(1)} dB right now. Tap it for the likely source.</p>}
          {sel && base ? (
            <BaseDetail part={sel} level={levels2[sel.id]} why={whys[sel.id]} atm={atm} basis={basis} fault={sel.id === faultModule} />
          ) : sel ? (
            <ModuleDetail part={sel} level={levels2[sel.id]} place={place} mode={mode} fault={sel.id === faultModule} />
          ) : (
            <p className="muted">Drag to turn, pinch or scroll to zoom, and tap {place === 'chamber' ? 'a floor' : place === 'iss' ? 'a module' : 'an area'} for details.</p>
          )}
          <div className="legend3d">
            {NOISE_BINS.map((b) => (
              <span key={b.label}><i style={{ background: b.color }} />{b.label}</span>
            ))}
            {place !== 'chamber' && <span><i style={{ background: NO_DATA_COLOR }} />No value</span>}
          </div>
        </aside>
      </div>

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

function BaseDetail({ part, level, why, atm, basis, fault }) {
  const d = pressureDelta(atm);
  return (
    <div className="module-detail">
      <h3>{part.label}</h3>
      <p className="muted">{part.contains}</p>
      {Number.isFinite(level) ? (
        <p className="level" style={{ color: noiseColor(level) }}>
          {level.toFixed(1)} dBA <span className="muted">simulated</span>
        </p>
      ) : (
        <p className="muted">No value.</p>
      )}
      <p className="small">{why}</p>
      <Spectrum id={part.id} fault={fault} />
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

function ModuleDetail({ part, level, place, mode, fault }) {
  const m = byId[part.id];
  const sleepers = SLEEP_IN[part.id] ?? [];
  return (
    <div className="module-detail">
      <h3>{part.label}</h3>
      {part.struct ? (
        <p className="muted">Connecting passage; no separate noise value.</p>
      ) : Number.isFinite(level) ? (
        <p className="level" style={{ color: noiseColor(level) }}>
          {level.toFixed(1)} dBA <span className="muted">{mode === 'avg' ? (place === 'iss' ? 'measured average' : '24-hour average') : place === 'iss' ? 'simulated now' : 'this minute'}</span>
        </p>
      ) : (
        <p className="muted">No dBA value published (reported only as meeting NASA's NC-50 limit, or not measured).</p>
      )}
      {m?.date && <p className="muted">NASA survey of {m.date}</p>}
      {place === 'iss' && !part.struct && <Spectrum id={part.id} fault={fault} />}
      {sleepers.length > 0 && (
        <>
          <h4>Sleep stations here</h4>
          <ul>
            {sleepers.map((id) => (
              <li key={id}>{byId[id].name}: <strong style={{ color: noiseColor(byId[id].dba) }}>{byId[id].dba} dBA</strong></li>
            ))}
          </ul>
          <p className="muted">NASA's sleep target is 50 dBA; up to 62 dBA still counts as hearing rest (Flight Rule B13-152).</p>
        </>
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
