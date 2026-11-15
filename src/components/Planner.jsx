// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Plan a workday, activities first. Loud activities are what push a day over ISS Flight Rule B13-152 and
// NASA's 24-hour noise allowance (NASA-STD-3001 [V2 6115]); the rest of the 16-hour workday is one
// background choice that fills the remaining time automatically, so the day always adds up to 16 + 8 h.
import { ACTIVITIES, BACKGROUNDS, SLEEP_MODULES, MAX_ACTIVITY_MIN, WORKDAY_MIN, computePlan, setActivity } from '../lib/plan.js';
import { useState } from 'react';
import { noiseColor } from '../lib/issLayout.js';
import { LOUD_EVENTS, loadLogs, saveLogs, shareable } from '../lib/daylog.js';

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
      <DayLog plan={plan} />
      <p className="muted">
        Sources: activity levels and earplug effect from NASA's noise-exposure worked example (Allen &amp; Danielson 2020); module levels from
        Allen 2024; limits from Flight Rule B13-152 and NASA-STD-3001 [V2 6115].
      </p>
    </section>
  );
}

// End of the day: what actually happened. Starts from the plan; one tap to log.
function DayLog({ plan }) {
  const [logs, setLogs] = useState(loadLogs);
  const [entry, setEntry] = useState(() => ({ activities: { ...plan.activities }, earplugs: plan.earplugs, background: plan.background, sleepAt: plan.sleepAt, events: [] }));
  const [copied, setCopied] = useState(false);
  const r = computePlan(entry);
  const update = (patch) => setEntry((e) => ({ ...e, ...patch }));
  const log = () => {
    const next = [{ ...entry, id: crypto.randomUUID(), date: new Date().toISOString(), dosePct: r.dosePct, leqDba: r.work.leqDba }, ...logs].slice(0, 60);
    setLogs(next);
    saveLogs(next);
  };
  const remove = (id) => {
    const next = logs.filter((l) => l.id !== id);
    setLogs(next);
    saveLogs(next);
  };
  return (
    <section className="daylog">
      <h3>How did today actually go?</h3>
      <p className="muted">Plans are intentions; logs are what crews can learn from. Starts from your plan: change what was different, then log it. Noise only, stored on this device.</p>
      <div className="daylog-grid">
        <div>
          {ACTIVITIES.map((a) => (
            <label key={a.id} className="slider">
              <span>{a.id === 't2' ? 'T2 treadmill' : 'ARED'}</span>
              <input type="range" min="0" max={MAX_ACTIVITY_MIN} step="15" value={entry.activities[a.id] ?? 0} onChange={(e) => setEntry(setActivity(entry, a.id, Number(e.target.value)))} />
              <span className="val">{entry.activities[a.id] ?? 0} min</span>
            </label>
          ))}
          <label className="inline sub">
            <input type="checkbox" checked={entry.earplugs} onChange={(e) => update({ earplugs: e.target.checked })} /> I wore earplugs on the treadmill
          </label>
          <label className="select">
            Mostly in
            <select value={entry.background} onChange={(e) => update({ background: e.target.value })}>
              {BACKGROUNDS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
        </div>
        <div>
          <p className="small">Anything loud that the plan didn't have?</p>
          <div className="chips">
            {LOUD_EVENTS.map((ev) => (
              <label key={ev} className={`chip${entry.events.includes(ev) ? ' on' : ''}`}>
                <input type="checkbox" checked={entry.events.includes(ev)} onChange={(e) => update({ events: e.target.checked ? [...entry.events, ev] : entry.events.filter((x) => x !== ev) })} />
                {ev}
              </label>
            ))}
          </div>
          <p className="small">Logged day: <strong>{Math.round(r.dosePct)}%</strong> of the allowance, workday {r.work.leqDba.toFixed(1)} dBA (events are noted, not added to the numbers).</p>
          <button className="primary" onClick={log}>Log today</button>
        </div>
      </div>
      {logs.length > 0 && (
        <>
          <ul className="daylog-list">
            {logs.slice(0, 7).map((l) => (
              <li key={l.id}>
                <span>{new Date(l.date).toLocaleDateString()}</span>
                <strong className={l.dosePct > 100 ? 'over' : ''}>{Math.round(l.dosePct)}%</strong>
                <span className="muted">{l.activities.t2 ? `treadmill ${l.activities.t2} min${l.earplugs ? ' with earplugs' : ''}` : 'no treadmill'}{l.events.length ? ` · ${l.events.length} loud event${l.events.length > 1 ? 's' : ''}` : ''}</span>
                <button className="link-button" onClick={() => remove(l.id)} aria-label="Delete this log">Delete</button>
              </li>
            ))}
          </ul>
          <button className="secondary" onClick={async () => { try { await navigator.clipboard.writeText(JSON.stringify(shareable(logs), null, 1)); setCopied(true); } catch { setCopied(false); } }}>
            {copied ? 'Copied' : 'Copy my noise logs to share with the ground'}
          </button>
          <p className="muted small">Shares noise logs only, never hearing results. Nothing is sent automatically.</p>
        </>
      )}
    </section>
  );
}
