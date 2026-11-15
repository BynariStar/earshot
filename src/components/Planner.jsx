// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Plan a workday: time in each module plus treadmill time, checked against ISS Flight Rule B13-152
// and NASA's 24-hour noise allowance (NASA-STD-3001 [V2 6115]).
import iss from '../data/iss_modules.json';
import { PLAN_MODULES, SLEEP_MODULES, T2, computePlan } from '../lib/plan.js';

const STATUS = {
  ok: { text: 'Under 60 dBA: no protection needed', cls: 'ok' },
  'protection-recommended': { text: 'Over 60 dBA: protection recommended during loud activities', cls: 'watch' },
  'protection-required': { text: 'Over 72 dBA: hearing protection required (Flight Rule B13-152)', cls: 'urgent' },
  restful: { text: 'At or under 50 dBA: restful sleep', cls: 'ok' },
  'above-sleep-target': { text: 'Above the 50 dBA sleep target, but still hearing rest (≤ 62 dBA)', cls: 'watch' },
  'no-hearing-rest': { text: 'Over 62 dBA: no hearing rest tonight', cls: 'urgent' },
};

export function AllowanceCard({ result, earplugs, compact = false }) {
  const pct = Math.round(result.dosePct);
  const over = pct > 100;
  const top = result.top;
  return (
    <div className={`result-card allowance ${over ? 'urgent' : pct > 80 ? 'watch' : 'ok'}`}>
      <span className="big">{pct}%</span>
      <span>of today's noise allowance{over ? `: ${pct - 100}% over` : ''}</span>
      <div className="allowance-bar" aria-hidden="true">
        <div style={{ width: `${Math.min(pct, 200) / 2}%` }} />
        <span className="allowance-mark" />
      </div>
      {!compact && (
        <>
          <p>
            NASA allows a fixed amount of noise per 24 hours: 8 hours at 75 dBA, and half that time for every 3 dB louder (NASA-STD-3001
            [V2 6115]). 100% uses all of it.
          </p>
          {top && (
            <p>
              <strong>{top.name}</strong> uses {Math.round(top.dosePct)}% on its own
              {top.id === 't2' && !earplugs ? '. Earplugs on the treadmill fix most of this day.' : '.'}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default function Planner({ plan, setPlan }) {
  const r = computePlan(plan);
  const set = (patch) => setPlan({ ...plan, ...patch });
  return (
    <section className="planner-page">
      <p className="lede">
        Choose where you'll spend a 16-hour workday and where you'll sleep. Levels are NASA's measured module averages (Allen 2024); the
        treadmill is NASA's own worked example (Allen &amp; Danielson 2020).
      </p>
      <div className="planner">
        <div className="planner-inputs">
          {PLAN_MODULES.map((id) => {
            const m = iss.modules.find((x) => x.id === id);
            return (
              <label key={id} className="slider">
                <span>{m.name} <em>{m.dba} dBA</em></span>
                <input type="range" min="0" max="8" step="0.5" value={plan.hours[id]} onChange={(e) => set({ hours: { ...plan.hours, [id]: Number(e.target.value) } })} />
                <span className="val">{plan.hours[id]} h</span>
              </label>
            );
          })}
          <label className="slider">
            <span>T2 treadmill <em>{T2.dba} dBA</em></span>
            <input type="range" min="0" max="120" step="15" value={plan.t2Minutes} onChange={(e) => set({ t2Minutes: Number(e.target.value) })} />
            <span className="val">{plan.t2Minutes} min</span>
          </label>
          <label className="inline">
            <input type="checkbox" checked={plan.earplugs} onChange={(e) => set({ earplugs: e.target.checked })} /> Earplugs on the treadmill
          </label>
          <label className="select">
            Sleep in
            <select value={plan.sleepAt} onChange={(e) => set({ sleepAt: e.target.value })}>
              {SLEEP_MODULES.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.dba} dBA)</option>)}
            </select>
          </label>
          {Math.abs(r.plannedMinutes - 960) > 30 && (
            <p className="muted">Planned {Math.round(r.plannedMinutes / 6) / 10} h; the flight rule assumes a 16-hour day.</p>
          )}
        </div>
        <div className="planner-results">
          <AllowanceCard result={r} earplugs={plan.earplugs} />
          <div className={`result-card ${STATUS[r.work.status].cls}`}>
            <span className="big">{r.work.leqDba.toFixed(1)} dBA</span>
            <span>Workday average</span>
            <p>{STATUS[r.work.status].text}</p>
          </div>
          <div className={`result-card ${STATUS[r.sleep.status].cls}`}>
            <span className="big">{r.sleep.leqDba.toFixed(1)} dBA</span>
            <span>Tonight</span>
            <p>{STATUS[r.sleep.status].text}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
