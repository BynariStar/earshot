// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Plan a workday: where you'll be, what loud things you'll do, what you'll protect, how loud you'll listen,
// and where you'll sleep, checked against NASA's rules AND against targets set by your own hearing checks.
import { useState } from 'react';
import { noiseColor } from '../lib/issLayout.js';
import { LOUD_EVENTS, loadLogs, saveLogs, shareable } from '../lib/daylog.js';
import {
  ACTIVITIES, MAX_ACTIVITY_MIN, WORKDAY_MIN, PLUG_DB, T2, DEFAULT_FILL, DEFAULT_SLEEP, computePlan, setActivity, setPlaceMinutes, placeOptions, sleepOptions, normalize,
} from '../lib/plan.js';
import { hearingState, TARGETS, planChecks } from '../lib/personal.js';
import { BASES } from '../lib/bases.js';

const STATUS = {
  ok: { text: 'Under 60 dBA: no protection needed', cls: 'ok' },
  'protection-recommended': { text: '60 to 72 dBA: protection recommended based on your individual needs', cls: 'watch' },
  'protection-required': { text: 'Over 72 dBA: hearing protection required during loud activities', cls: 'urgent' },
  restful: { text: 'At or under 50 dBA: restful sleep', cls: 'ok' },
  'above-sleep-target': { text: 'Above the 50 dBA sleep target, but still hearing rest (≤ 62 dBA)', cls: 'watch' },
  'no-hearing-rest': { text: 'Over 62 dBA: no hearing rest tonight', cls: 'urgent' },
};
const hm = (min) => (min >= 60 ? (min % 60 ? `${Math.floor(min / 60)} h ${Math.round(min % 60)} min` : `${min / 60} h`) : `${Math.round(min)} min`);
const SHORT = { t2: 'Treadmill', ared: 'ARED', audio: 'Earphones' };

export function AllowanceCard({ result, compact = false }) {
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
          <p>NASA allows a fixed amount of noise per 24 hours: 8 hours at 75 dBA, and half that time for every 3 dB louder (NASA-STD-3001 [V2 6115]).</p>
          {top && <p><strong>{top.name}</strong> uses the most: {Math.round(top.dosePct)}%.</p>}
          {over ? (
            <p>
              Over by {pct - 100}%.{' '}
              {top?.id === 'audio'
                ? 'Turn the earphones down or listen for less time: every 3 dB quieter doubles the time you can listen.'
                : 'Earplugs on the loudest item, or less time on it, bring the day back.'}
            </p>
          ) : (
            <p className="headroom">
              Room left today: about {hm(result.headroom(T2.dba))} of treadmill without earplugs, or {hm(result.headroom(85))} of earphones at 85 dBA.
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
        <span key={s.id} style={{ flex: s.minutes, background: noiseColor(s.dba) }} title={`${s.name}: ${hm(s.minutes)} at ${s.dba.toFixed(1)} dBA`}>
          {s.minutes >= 75 ? SHORT[s.id] ?? s.name.replace(/^Level \d · /, '').replace(' (earplugs)', '') : ''}
        </span>
      ))}
    </div>
  );
}

function ForYourEars({ data, result }) {
  const hs = hearingState(data);
  const t = TARGETS[hs.state];
  const checks = planChecks(result, t);
  const quiet = sleepOptions(result.plan.base).filter((s) => s.dba <= 50);
  return (
    <div className={`result-card ears-advice ${checks.every((c) => c.ok) ? 'ok' : 'watch'}`}>
      <span className="label-strong">For your ears</span>
      <p><strong>{t.title}</strong></p>
      {t.note && <p className="muted small">{t.note}</p>}
      <ul className="checks">
        {checks.map((c) => (
          <li key={c.text} className={c.ok ? 'ok' : 'todo'}>
            <span aria-hidden="true">{c.ok ? '✓' : '!'}</span> {c.text}
          </li>
        ))}
      </ul>
      {result.dosePct > 50 && result.sleepModule.dba > 50 && (
        <p className="small">Loud day: pair it with a quieter night. Sleep spots at or under 50 dBA: {quiet.map((s) => `${s.name} (${s.dba})`).join(', ') || 'none in this base'}.</p>
      )}
    </div>
  );
}

function WeekView({ logs }) {
  const last = logs.slice(0, 7).reverse();
  if (last.length < 2) return <p className="muted small">Log a few days below to see your rolling week, the same 7-day view the WHO safe-listening standard uses.</p>;
  const avg = last.reduce((a, l) => a + l.dosePct, 0) / last.length;
  const max = Math.max(150, ...last.map((l) => l.dosePct));
  return (
    <div className="week">
      <div className="week-head">
        <strong>Your last {last.length} logged days</strong>
        <span className="muted small">average {Math.round(avg)}% of the daily allowance · {last.filter((l) => l.dosePct > 100).length} over</span>
      </div>
      <div className="week-bars">
        <span className="week-line" style={{ bottom: `${(100 / max) * 100}%` }} title="100% of the daily allowance" />
        {last.map((l) => (
          <span key={l.id} className={`week-bar${l.dosePct > 100 ? ' over' : ''}`} style={{ height: `${(Math.min(l.dosePct, max) / max) * 100}%` }} title={`${new Date(l.date).toLocaleDateString()}: ${Math.round(l.dosePct)}%`} />
        ))}
      </div>
    </div>
  );
}

export default function Planner({ plan: rawPlan, setPlan, data }) {
  const plan = normalize(rawPlan);
  const r = computePlan(plan);
  const [logs, setLogs] = useState(loadLogs);
  const places = placeOptions(plan.base);
  const sleeps = sleepOptions(plan.base);
  const left = WORKDAY_MIN - r.activityMinutes;
  const set = (patch) => setPlan({ ...plan, ...patch });
  const switchBase = (b) => setPlan({ ...plan, base: b, places: [], fill: DEFAULT_FILL[b], sleepAt: DEFAULT_SLEEP[b] });

  return (
    <section className="planner-page">
      <div className="station-controls">
        <div className="segmented" role="tablist" aria-label="Base">
          {[['iss', 'ISS'], ['moon', 'Moon base'], ['mars', 'Mars base']].map(([k, label]) => (
            <button key={k} role="tab" aria-selected={plan.base === k} className={plan.base === k ? 'on' : ''} onClick={() => switchBase(k)}>{label}</button>
          ))}
        </div>
      </div>
      {plan.base !== 'iss' && (
        <p className="muted small">Simulated {BASES[plan.base].name.toLowerCase()}: area levels are the "ISS-like" values at {BASES[plan.base].defaultAtm} psia with fans sped up, as in Station noise. Exercise uses the ISS machines' levels.</p>
      )}

      <div className="planner">
        <div className="planner-inputs">
          <h3>Loud activities</h3>
          {ACTIVITIES.map((a) => {
            const v = plan.activities[a.id] ?? 0;
            return (
              <div key={a.id} className="activity-row">
                <label className="slider">
                  <span>{a.id === 't2' ? 'T2 treadmill' : a.name} <em>{a.dba} dBA</em></span>
                  <input type="range" min="0" max={MAX_ACTIVITY_MIN} step="15" value={v} onChange={(e) => setPlan(setActivity(plan, a.id, Number(e.target.value)))} />
                  <span className="val">{v} min</span>
                </label>
                <label className="inline sub">
                  <input type="checkbox" checked={!!plan.protect[a.id]} onChange={(e) => set({ protect: { ...plan.protect, [a.id]: e.target.checked } })} /> Earplugs
                </label>
              </div>
            );
          })}

          <h3>Where you'll work</h3>
          {plan.places.map((pl, i) => (
            <div key={i} className="place-row">
              <select value={pl.id} onChange={(e) => set({ places: plan.places.map((x, j) => (j === i ? { ...x, id: e.target.value } : x)) })}>
                {places.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.dba} dBA)</option>)}
              </select>
              <input type="range" min="0" max="480" step="30" value={pl.minutes} onChange={(e) => setPlan(setPlaceMinutes(plan, i, Number(e.target.value)))} aria-label="Hours" />
              <span className="val">{hm(pl.minutes)}</span>
              <button className="link-button" onClick={() => set({ places: plan.places.filter((_, j) => j !== i) })} aria-label="Remove place">Remove</button>
            </div>
          ))}
          <button className="secondary small-btn" disabled={left <= 0} onClick={() => setPlan(setPlaceMinutes({ ...plan, places: [...plan.places, { id: places[0].id, minutes: 0 }] }, plan.places.length, 120))}>
            + Add a place
          </button>
          <label className="select fill-row">
            The rest ({hm(left)}) in
            <select value={plan.fill} onChange={(e) => set({ fill: e.target.value })}>
              {places.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.dba} dBA)</option>)}
            </select>
          </label>
          <label className="inline sub">
            <input type="checkbox" checked={plan.protect.loudPlaces} onChange={(e) => set({ protect: { ...plan.protect, loudPlaces: e.target.checked } })} /> Earplugs in places louder than 60 dBA
          </label>
          <DayBar result={r} />
          <p className="muted small">16-hour workday, the period the flight rule averages over. Earplugs count as {PLUG_DB.toFixed(1)} dB of protection, from NASA's treadmill figure.</p>

          <h3>Earphones and personal audio</h3>
          <label className="slider">
            <span>Listening time</span>
            <input type="range" min="0" max="240" step="15" value={plan.audio.minutes} onChange={(e) => set({ audio: { ...plan.audio, minutes: Number(e.target.value) } })} />
            <span className="val">{plan.audio.minutes} min</span>
          </label>
          <label className="slider">
            <span>Level at your ear (your estimate)</span>
            <input type="range" min="60" max="100" step="5" value={plan.audio.dba} onChange={(e) => set({ audio: { ...plan.audio, dba: Number(e.target.value) } })} />
            <span className="val">{plan.audio.dba} dBA</span>
          </label>
          <p className="muted small">NASA and CSA acousticians say crew exposure from earphones is unknown. Reference: WHO's safe-listening standard allows adults the equivalent of 80 dB for 40 hours a week; NASA caps personal audio at 115 dBA at the ear ([V2 6106]).</p>

          <h3>Sleep (8 h)</h3>
          <label className="select">
            Sleep in
            <select value={plan.sleepAt} onChange={(e) => set({ sleepAt: e.target.value })}>
              {sleeps.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.dba} dBA)</option>)}
            </select>
          </label>
        </div>

        <div className="planner-results">
          <ForYourEars data={data} result={r} />
          <AllowanceCard result={r} />
          <div className={`result-card ${STATUS[r.work.status].cls}`}>
            <span className="big">{r.work.leqDba.toFixed(1)} dBA</span>
            <span>16-hour workday average (Flight Rule B13-152)</span>
            <p>{STATUS[r.work.status].text}</p>
          </div>
          <div className={`result-card ${STATUS[r.sleep.status].cls}`}>
            <span className="big">{r.sleep.leqDba.toFixed(1)} dBA</span>
            <span>Tonight</span>
            <p>{STATUS[r.sleep.status].text}</p>
          </div>
          <p className="reality">
            <strong>Reality check:</strong> NASA's crew dosimeters measured real workday averages of 68.7 to 70.8 dBA (Limardo et al. 2021), inside the
            band where protection depends on the individual. Everyday crew activity was the largest source of events above 85 dBA.
          </p>
        </div>
      </div>

      <section className="daylog">
        <h3>Your week</h3>
        <WeekView logs={logs} />
      </section>
      <DayLog plan={plan} logs={logs} setLogs={setLogs} />
      <p className="muted">
        Sources: activity levels and earplug effect from NASA's noise-exposure worked example (Allen &amp; Danielson 2020); module levels from Allen 2024;
        limits from Flight Rule B13-152 and NASA-STD-3001 [V2 6115]; personal audio reference from the WHO-ITU safe-listening standard (H.870).
      </p>
    </section>
  );
}

// End of the day: what actually happened. Starts from the plan; one tap to log.
function DayLog({ plan, logs, setLogs }) {
  const [entry, setEntry] = useState(() => ({ ...plan, events: [] }));
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
          <button className="link-button" onClick={() => setEntry({ ...plan, events: [] })}>Reset to today's plan</button>
          {ACTIVITIES.map((a) => (
            <div key={a.id} className="activity-row">
              <label className="slider">
                <span>{a.id === 't2' ? 'T2 treadmill' : 'ARED'}</span>
                <input type="range" min="0" max={MAX_ACTIVITY_MIN} step="15" value={entry.activities[a.id] ?? 0} onChange={(e) => setEntry({ ...setActivity(entry, a.id, Number(e.target.value)), events: entry.events })} />
                <span className="val">{entry.activities[a.id] ?? 0} min</span>
              </label>
              <label className="inline sub">
                <input type="checkbox" checked={!!entry.protect?.[a.id]} onChange={(e) => update({ protect: { ...entry.protect, [a.id]: e.target.checked } })} /> Wore earplugs
              </label>
            </div>
          ))}
          <label className="slider">
            <span>Earphones</span>
            <input type="range" min="0" max="240" step="15" value={entry.audio?.minutes ?? 0} onChange={(e) => update({ audio: { ...entry.audio, minutes: Number(e.target.value) } })} />
            <span className="val">{entry.audio?.minutes ?? 0} min</span>
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
                <span className="muted">{l.activities?.t2 ? `treadmill ${l.activities.t2} min${(l.protect?.t2 ?? l.earplugs) ? ' with earplugs' : ''}` : 'no treadmill'}{l.events?.length ? ` · ${l.events.length} loud event${l.events.length > 1 ? 's' : ''}` : ''}</span>
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
