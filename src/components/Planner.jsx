// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Plan a workday, activities first. Loud activities are what push a day over ISS Flight Rule B13-152 and
// NASA's 24-hour noise allowance (NASA-STD-3001 [V2 6115]); the rest of the 16-hour workday is one
// background choice that fills the remaining time automatically, so the day always adds up to 16 + 8 h.
import { ACTIVITIES, BACKGROUNDS, SLEEP_MODULES, MAX_ACTIVITY_MIN, WORKDAY_MIN, computePlan, setActivity } from '../lib/plan.js';
import { noiseColor } from '../lib/issLayout.js';

const STATUS = {
  ok: { text: 'Under 60 dBA: no protection needed', cls: 'ok' },
  'protection-recommended': { text: 'Over 60 dBA: protection recommended during loud activities', cls: 'watch' },
  'protection-required': { text: 'Over 72 dBA: hearing protection required (Flight Rule B13-152)', cls: 'urgent' },
  restful: { text: 'At or under 50 dBA: restful sleep', cls: 'ok' },
  'above-sleep-target': { text: 'Above the 50 dBA sleep target, but still hearing rest (≤ 62 dBA)', cls: 'watch' },
  'no-hearing-rest': { text: 'Over 62 dBA: no hearing rest tonight', cls: 'urgent' },
};
const SHORT = { t2: 'Treadmill', ared: 'ARED' };
const hm = (min) => (min % 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min / 60} h`);

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

function DayBar({ result }) {
  return (
    <div className="daybar" aria-label="Your 16-hour workday">
      {result.day.map((s) => (
        <span key={s.id} style={{ flex: s.minutes, background: noiseColor(s.dba) }} title={`${s.name}: ${hm(s.minutes)} at ${s.dba} dBA`}>
          {s.minutes >= 60 ? SHORT[s.id] ?? s.name : ''}
        </span>
      ))}
    </div>
  );
}

export default function Planner({ plan, setPlan }) {
  const r = computePlan(plan);
  const left = WORKDAY_MIN - r.activityMinutes;
  return (
    <section className="planner-page">
      <p className="lede">
        Loud activities decide whether a day is safe. With NASA's measured module averages alone, even a whole workday in the loudest
        module stays under the 72 dBA flight rule; one treadmill hour can double the day's noise allowance.
      </p>
      <div className="planner">
        <div className="planner-inputs">
          <h3>Loud activities today</h3>
          {ACTIVITIES.map((a) => {
            const v = plan.activities[a.id] ?? 0;
            return (
              <div key={a.id}>
                <label className="slider">
                  <span>{a.id === 't2' ? 'T2 treadmill' : a.name} <em>{a.dba} dBA</em></span>
                  <input type="range" min="0" max={MAX_ACTIVITY_MIN} step="15" value={v} onChange={(e) => setPlan(setActivity(plan, a.id, Number(e.target.value)))} />
                  <span className="val">{v} min</span>
                </label>
                {a.id === 't2' && (
                  <label className="inline sub">
                    <input type="checkbox" checked={plan.earplugs} onChange={(e) => setPlan({ ...plan, earplugs: e.target.checked })} /> Earplugs on the
                    treadmill ({a.earplugsEffectiveDba} dBA effective, NASA's figure)
                  </label>
                )}
              </div>
            );
          })}

          <h3>The rest of the workday ({hm(left)})</h3>
          <label className="select">
            Mostly in
            <select value={plan.background} onChange={(e) => setPlan({ ...plan, background: e.target.value })}>
              {BACKGROUNDS.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.dba} dBA)</option>)}
            </select>
          </label>
          <DayBar result={r} />
          <p className="muted">Workday: 16 hours, the period the flight rule averages over. Activities fill part of it; your choice above fills the rest.</p>

          <h3>Sleep (8 h)</h3>
          <label className="select">
            Sleep in
            <select value={plan.sleepAt} onChange={(e) => setPlan({ ...plan, sleepAt: e.target.value })}>
              {SLEEP_MODULES.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.dba} dBA)</option>)}
            </select>
          </label>
        </div>
        <div className="planner-results">
          <AllowanceCard result={r} earplugs={plan.earplugs} />
          <div className={`result-card ${STATUS[r.work.status].cls}`}>
            <span className="big">{r.work.leqDba.toFixed(1)} dBA</span>
            <span>16-hour workday average</span>
            <p>{STATUS[r.work.status].text}</p>
          </div>
          <div className={`result-card ${STATUS[r.sleep.status].cls}`}>
            <span className="big">{r.sleep.leqDba.toFixed(1)} dBA</span>
            <span>Tonight</span>
            <p>{STATUS[r.sleep.status].text}</p>
          </div>
          <p className="reality">
            <strong>Reality check:</strong> NASA's crew dosimeters measured real workday averages of 68.7 to 70.8 dBA (Limardo et al. 2021),
            louder than module averages predict. Everyday crew activity (meals, routines, conferences) was the largest source of events
            above 85 dBA. Averages miss these; personal monitoring catches them.
          </p>
        </div>
      </div>
      <p className="muted">
        Sources: activity levels and earplug effect from NASA's noise-exposure worked example (Allen &amp; Danielson 2020); module levels from
        Allen 2024; limits from Flight Rule B13-152 and NASA-STD-3001 [V2 6115].
      </p>
    </section>
  );
}
