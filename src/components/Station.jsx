// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
import { useMemo, useState } from 'react';
import iss from '../data/iss_modules.json';
import lmlstp from '../data/lmlstp.json';
import { dose, withProtection, workdayStatus, sleepStatus, biggestContributors, LIMITS, EARPLUG_EFFECTIVE_DB } from '../lib/noise.js';

const sleepModules = iss.modules.filter((m) => m.kind === 'sleep');
const t2 = iss.activities.find((a) => a.id === 't2');

// Colour scale for module levels, anchored to NASA limits (sleep target 50, recommend protection 60).
function levelClass(dba) {
  if (dba >= 65) return 'lvl-high';
  if (dba >= 60) return 'lvl-mid';
  if (dba > 50) return 'lvl-low';
  return 'lvl-quiet';
}

const STATUS = {
  ok: { text: 'Under 60 dBA: no protection needed', cls: 'ok' },
  'protection-recommended': { text: 'Over 60 dBA: protection recommended during loud activities', cls: 'watch' },
  'protection-required': { text: 'Over 72 dBA: hearing protection required (Flight Rule B13-152)', cls: 'urgent' },
  restful: { text: 'At or under 50 dBA: restful sleep', cls: 'ok' },
  'above-sleep-target': { text: 'Above the 50 dBA sleep target, but still hearing rest (≤ 62 dBA)', cls: 'watch' },
  'no-hearing-rest': { text: 'Over 62 dBA: no hearing rest tonight', cls: 'urgent' },
};

const DEFAULT_DAY = { lab: 4, cof: 2, node3: 2, sm: 4, mlm: 1, node2: 2, cupola: 0, jem: 0 };

export default function Station() {
  const [hours, setHours] = useState(DEFAULT_DAY);
  const [t2Minutes, setT2Minutes] = useState(60);
  const [earplugs, setEarplugs] = useState(false);
  const [sleepAt, setSleepAt] = useState('cq_stbd');
  const [floor, setFloor] = useState(1);

  const plannedMinutes = Object.values(hours).reduce((a, b) => a + b * 60, 0) + t2Minutes;
  const day = useMemo(() => {
    const segs = Object.entries(hours)
      .filter(([, h]) => h > 0)
      .map(([id, h]) => {
        const m = iss.modules.find((x) => x.id === id);
        return { id, name: m.name, dba: m.dba, minutes: h * 60 };
      });
    if (t2Minutes > 0) segs.push({ id: 't2', name: t2.name, dba: t2.dba, minutes: t2Minutes, protected: earplugs });
    return withProtection(segs, EARPLUG_EFFECTIVE_DB);
  }, [hours, t2Minutes, earplugs]);

  const work = workdayStatus(day);
  const sleepModule = sleepModules.find((m) => m.id === sleepAt);
  const sleep = sleepStatus([{ dba: sleepModule.dba, minutes: 480 }]);
  const day24 = [...day, { dba: sleepModule.dba, minutes: 480 }];
  const dose24 = dose(day24);
  const top = biggestContributors(day)[0];

  const chamber = lmlstp.floors[floor];

  return (
    <section className="station">
      <h1>Your station, by sound</h1>
      <p className="lede">
        NASA's measured noise levels for each ISS module (Allen 2024, ICES-2024-354). Plan a 16-hour workday and a night, and see how it
        compares with ISS Flight Rule B13-152 and NASA's 24-hour noise dose (NASA-STD-3001 [V2 6115]).
      </p>

      <div className="module-grid">
        {iss.modules.map((m) => (
          <div key={m.id} className={`module ${levelClass(m.dba)}`} title={`${m.name}: ${m.dba} dBA`}>
            <span className="module-name">{m.name}</span>
            <span className="module-dba">{m.dba.toFixed(1)} dBA</span>
            <span className="module-kind">{m.kind}</span>
          </div>
        ))}
      </div>

      <div className="planner">
        <div className="planner-inputs">
          <h2>Plan a workday</h2>
          {Object.keys(DEFAULT_DAY).map((id) => {
            const m = iss.modules.find((x) => x.id === id);
            return (
              <label key={id} className="slider">
                <span>{m.name} <em>{m.dba} dBA</em></span>
                <input type="range" min="0" max="8" step="0.5" value={hours[id]} onChange={(e) => setHours({ ...hours, [id]: Number(e.target.value) })} />
                <span className="val">{hours[id]} h</span>
              </label>
            );
          })}
          <label className="slider">
            <span>T2 treadmill <em>{t2.dba} dBA</em></span>
            <input type="range" min="0" max="120" step="15" value={t2Minutes} onChange={(e) => setT2Minutes(Number(e.target.value))} />
            <span className="val">{t2Minutes} min</span>
          </label>
          <label className="inline">
            <input type="checkbox" checked={earplugs} onChange={(e) => setEarplugs(e.target.checked)} /> Earplugs on the treadmill
          </label>
          <label className="select">
            Sleep in
            <select value={sleepAt} onChange={(e) => setSleepAt(e.target.value)}>
              {sleepModules.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.dba} dBA)</option>)}
            </select>
          </label>
          {Math.abs(plannedMinutes - 960) > 30 && (
            <p className="muted">Planned {Math.round(plannedMinutes / 6) / 10} h; the flight rule assumes a 16-hour day.</p>
          )}
        </div>

        <div className="planner-results">
          <div className={`result-card ${STATUS[work.status].cls}`}>
            <span className="big">{work.leqDba.toFixed(1)} dBA</span>
            <span>Workday average</span>
            <p>{STATUS[work.status].text}</p>
          </div>
          <div className={`result-card ${STATUS[sleep.status].cls}`}>
            <span className="big">{sleep.leqDba.toFixed(1)} dBA</span>
            <span>Tonight</span>
            <p>{STATUS[sleep.status].text}</p>
          </div>
          <div className={`result-card ${dose24 > LIMITS.doseMax ? 'urgent' : 'ok'}`}>
            <span className="big">{dose24.toFixed(0)}</span>
            <span>24-hour noise dose (limit 100)</span>
            <p>NASA-STD-3001 [V2 6115]</p>
          </div>
          {top && work.status !== 'ok' && (
            <p className="advice">
              Biggest contributor today: <strong>{top.name}</strong> ({Math.round(top.share * 100)}% of your sound energy).
              {top.id === 't2' && !earplugs && ' Wear earplugs on the treadmill: NASA’s own example shows that alone takes a 72.8 dBA day to 63.7 dBA.'}
            </p>
          )}
        </div>
      </div>

      <div className="chamber">
        <h2>A real day of NASA noise data</h2>
        <p className="lede">
          Minute-by-minute sound levels from NASA's 1997 90-day sealed-chamber test with four crew (LMLSTP 3.3, NASA Life Sciences Portal),
          run through the same NASA dose formula.
        </p>
        <div className="tabs">
          {lmlstp.floors.map((f, i) => (
            <button key={f.floor} className={i === floor ? 'tab on' : 'tab'} onClick={() => setFloor(i)}>{f.floor}</button>
          ))}
        </div>
        <ChamberChart series={chamber.series} />
        <p>
          24-hour average <strong>{chamber.leq24hDba} dBA</strong>, loudest minute {chamber.maxDba} dBA, NASA dose{' '}
          <strong className={chamber.nasaDose24h > 100 ? 'over' : ''}>{chamber.nasaDose24h}</strong>
          {chamber.nasaDose24h > 100 ? ': over NASA’s limit of 100 for anyone spending the whole day here.' : ': within NASA’s limit of 100.'}
        </p>
        <p className="muted">Static readings at a fixed point on each floor ({chamber.start.replace('T', ' ')} onward), not personal dosimeters.</p>
      </div>
    </section>
  );
}

function ChamberChart({ series }) {
  const W = 720, H = 200, pad = 32;
  const lo = 50, hi = 95;
  const x = (i) => pad + (i / (series.length - 1)) * (W - pad - 8);
  const y = (v) => H - pad - ((v - lo) / (hi - lo)) * (H - pad - 8);
  const line = series.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  // Cumulative dose along the day
  let acc = 0;
  const doseLine = series
    .map((v, i) => {
      acc += 100 / (480 / 2 ** ((v - 75) / 3));
      return { i, acc };
    })
    .map(({ i, acc: a }) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${(H - pad - (Math.min(a, 250) / 250) * (H - pad - 8)).toFixed(1)}`)
    .join(' ');
  const ticks = [50, 60, 70, 80, 90];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Sound level over 24 hours">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad} x2={W - 8} y1={y(t)} y2={y(t)} className="grid" />
          <text x={pad - 6} y={y(t) + 4} textAnchor="end" className="axis">{t}</text>
        </g>
      ))}
      <line x1={pad} x2={W - 8} y1={y(72)} y2={y(72)} className="limit" />
      <text x={W - 10} y={y(72) - 4} textAnchor="end" className="axis limit-label">72 dBA workday limit</text>
      <path d={line} className="series" />
      <path d={doseLine} className="dose" />
      <text x={pad} y={H - 8} className="axis">0 h</text>
      <text x={W - 8} y={H - 8} textAnchor="end" className="axis">24 h</text>
      <text x={W - 10} y={20} textAnchor="end" className="axis dose-label">cumulative NASA dose (scale 0–250)</text>
    </svg>
  );
}

