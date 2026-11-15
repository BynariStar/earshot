// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Plan my day: the answer first (which earplugs, and what that does to the day), then the day itself and the
// numbers on request. The day is assumed to come from the crew schedule (simulated); the controls are for "what if".
import { useState } from 'react';
import { noiseColor } from '../lib/issLayout.js';
import Sheet from './Sheet.jsx';
import {
  ACTIVITIES, MAX_ACTIVITY_MIN, WORKDAY_MIN, PLUG_DB, T2, DEFAULT_FILL, DEFAULT_SLEEP, computePlan, applyFlags, setActivity, setPlaceMinutes, placeOptions, sleepOptions, normalize,
} from '../lib/plan.js';
import { hearingState, TARGETS } from '../lib/personal.js';
import { BASES } from '../lib/bases.js';
import Info from './Info.jsx';
import Stepper from './Stepper.jsx';
import Picker from './Picker.jsx';

const STATUS = {
  ok: { text: 'Under 60 dBA: no protection needed', cls: 'ok' },
  'protection-recommended': { text: '60 to 72 dBA: protection depends on the individual', cls: 'watch' },
  'protection-required': { text: 'Over 72 dBA: protection required', cls: 'urgent' },
  restful: { text: 'At or under the 50 dBA target', cls: 'ok' },
  'above-sleep-target': { text: 'Above the 50 dBA target; up to 62 dBA still counts as hearing rest', cls: 'watch' },
  'no-hearing-rest': { text: 'Over 62 dBA: no hearing rest', cls: 'urgent' },
};
const hm = (min) => (min >= 60 ? (min % 60 ? `${Math.floor(min / 60)} h ${Math.round(min % 60)} min` : `${min / 60} h`) : `${Math.round(min)} min`);
const SHORT = { t2: 'Treadmill', ared: 'ARED', audio: 'Earphones' };

function DayBar({ result }) {
  return (
    <div className="daybar" aria-label="Your 16-hour workday">
      {result.day.map((s) => (
        <span key={s.id} style={{ flex: s.minutes, background: noiseColor(s.dba) }} title={`${s.name}: ${hm(s.minutes)} at ${s.dba.toFixed(1)} dBA`}>
          {s.minutes >= 90 ? SHORT[s.id] ?? s.name.replace(/^Level \d · /, '').replace(' (earplugs)', '').replace(/^.*\((.*)\)$/, '$1') : ''}
        </span>
      ))}
    </div>
  );
}

const shortName = (n) => n.replace(' (earplugs)', '').replace(/^Level \d · /, '').replace(/^.*\((.*)\)$/, '$1');

export default function Planner({ plan: rawPlan, setPlan, data, lockedBase, focus, alerts = [], events = [], go }) {
  const [editing, setEditing] = useState(focus === 'sleep' ? { type: 'sleep' } : null);
  const plan = normalize(rawPlan);
  const target = TARGETS[hearingState(data).state];
  const { plan: flaggedPlan, flagged } = applyFlags(plan, target.protectAbove);
  const r = computePlan(flaggedPlan);
  const skip = computePlan({ ...plan, protect: { t2: false, ared: false, loudPlaces: false } });
  const places = placeOptions(plan.base);
  const sleeps = sleepOptions(plan.base);
  const left = WORKDAY_MIN - r.activityMinutes;
  const set = (patch) => setPlan({ ...plan, ...patch });
  const switchBase = (b) => setPlan({ ...plan, base: b, places: [], fill: DEFAULT_FILL[b], sleepAt: DEFAULT_SLEEP[b] });
  const pct = Math.round(r.dosePct);
  const hs = hearingState(data);
  // Earplugs: flagged activities and modules, plus a module with a live fault right now.
  const live = events.find((e) => e.type === 'live');
  const earplugs = [...flagged.map((f) => SHORT[f.id] ?? f.name.replace(/^.*\((.*)\)$/, '$1'))];
  if (live && !flagged.some((f) => f.id === live.part)) earplugs.push(`${live.where.replace(/^.*\((.*)\)$/, '$1')} until it's fixed`);
  const exposure = alerts.find((a) => a.id === 'exposure');
  const sleepOk = r.sleepModule.dba <= 50;
  const editTitle = !editing ? '' : { activity: editing.id === 't2' ? 'T2 treadmill' : 'ARED exercise', place: 'Place', fill: 'The rest of the workday', audio: 'Earphones', sleep: 'Where you sleep', add: 'Add to the day' }[editing.type];
  const quietest = [...sleeps].sort((a, b) => a.dba - b.dba)[0];
  const checks = [
    { ok: r.dosePct <= target.dosePct, text: `Noise allowance: ${pct}%`, note: target.dosePct < 100 ? `your target is ${target.dosePct}% while your ears change` : 'NASA limit 100%' },
    { ok: r.work.leqDba <= 72, text: `Workday average: ${r.work.leqDba.toFixed(1)} dBA`, note: 'NASA limit 72 dBA' },
    {
      ok: r.sleepModule.dba <= target.sleepMax && r.sleepModule.dba <= 50,
      text: `Sleep: ${r.sleepModule.dba} dBA`,
      note: r.sleepModule.dba <= 50 ? 'target 50 dBA' : `target 50 dBA${quietest && quietest.dba < r.sleepModule.dba ? `; quietest: ${quietest.name}, ${quietest.dba} dBA` : ''}`,
    },
  ];

  return (
    <section className="planner-page">
      {!lockedBase && <div className="station-controls">
        <div className="segmented" role="tablist" aria-label="Base">
          {[['iss', 'ISS'], ['moon', 'Moon base'], ['mars', 'Mars base']].map(([k, label]) => (
            <button key={k} role="tab" aria-selected={plan.base === k} className={plan.base === k ? 'on' : ''} onClick={() => switchBase(k)}>{label}</button>
          ))}
        </div>
      </div>}
      {plan.base !== 'iss' && (
        <p className="muted small">Simulated {BASES[plan.base].name.toLowerCase()}: area levels are the "ISS-like" values at {BASES[plan.base].defaultAtm} psia with fans sped up, as in Station noise. Exercise uses the ISS machines' levels.</p>
      )}

      <div className="plan-answer today-grid">
        <div className="today-recs">
        <h2>Your recommendations</h2>
        <ul className="recs">
          <li>
            <span className={`rec-icon${earplugs.length ? ' todo' : ''}`} aria-hidden="true">{earplugs.length ? '!' : '✓'}</span>
            <div>
              <strong>{earplugs.length ? `Earplugs for ${listJoin(earplugs)}` : 'No earplugs needed today'}</strong>
              <span className="muted">
                {earplugs.length ? `With them, today uses ${pct}% of your noise allowance; without them, ${Math.round(skip.dosePct)}%.` : `Today uses ${pct}% of your noise allowance.`}
                <Info>
                  Earshot flags anything above {target.protectAbove} dBA{target.protectAbove < 72 ? ' (lowered from 72 dBA because your ears changed)' : ' (Flight Rule B13-152 requires protection above 72 dBA)'}, and any module with a live fault. Earplugs
                  count as {PLUG_DB.toFixed(1)} dB, from NASA's treadmill figure.
                </Info>
              </span>
            </div>
          </li>
          <li>
            <span className={`rec-icon${sleepOk ? '' : ' todo'}`} aria-hidden="true">{sleepOk ? '✓' : '!'}</span>
            <div>
              <strong>{sleepOk ? `Sleep in ${r.sleepModule.name}` : `Sleep in ${quietest.name}`}</strong>
              <span className="muted">
                {sleepOk ? `${r.sleepModule.dba} dBA, within the 50 dBA target.` : `${quietest.dba} dBA, instead of ${r.sleepModule.name} at ${r.sleepModule.dba} dBA (target 50).`}
              </span>
              {!sleepOk && <button className="secondary" onClick={() => set({ sleepAt: quietest.id })}>Switch to {quietest.name}</button>}
            </div>
          </li>
          <li>
            <span className="rec-icon" aria-hidden="true">♪</span>
            <div>
              <strong>{r.dosePct < 100 ? `Earphones: up to ${hm(r.headroom(85))} at 85 dBA` : 'No loud earphones today'}</strong>
              <span className="muted">{r.dosePct < 100 ? 'What is left of today\'s allowance. Every 3 dB quieter doubles it.' : 'Today already uses the full allowance.'}</span>
            </div>
          </li>
          <li>
            <span className={`rec-icon${exposure ? ' todo' : ''}`} aria-hidden="true">{exposure ? '!' : '○'}</span>
            <div>
              <strong>{exposure ? 'Hearing check tonight' : 'Next hearing check: when Earshot asks'}</strong>
              <span className="muted">{exposure ? exposure.body : 'After a loud exposure, Earshot asks for a 2-minute check at the pitches that noise reaches.'}</span>
              {exposure && <button className="secondary" onClick={() => go(exposure.actions[0].to)}>Quick check</button>}
            </div>
          </li>
          {hs.state === 'high' && (
            <li>
              <span className="rec-icon todo" aria-hidden="true">▲</span>
              <div>
                <strong>Stricter targets are on</strong>
                <span className="muted">
                  Earplugs above 60 dBA and half the daily allowance, until your high pitches settle.
                  <Info>{target.note ?? 'An Earshot design choice for the flight rule\'s "individual needs" band (60 to 72 dBA), not a NASA number.'}</Info>
                </span>
              </div>
            </li>
          )}
        </ul>

        </div>
        <div className="today-day">
        <h2 className="plan-sub">Your day</h2>
        <ul className="plan-checks">
          {checks.map((c) => (
            <li key={c.text} className={c.ok ? 'ok' : 'todo'}>
              <span className="mark" aria-hidden="true">{c.ok ? '✓' : '!'}</span>
              <span>{c.text} <span className="muted">({c.note})</span></span>
            </li>
          ))}
        </ul>
        <p className="muted small">
          From your crew schedule. Tap a line to change it.
          <Info>The day comes from the crew schedule (simulated; Earshot assumes it is up to date). Change it here to try a different day.</Info>
        </p>
        <div className="day-rows">
          {r.day.map((seg) => {
            const placeIndex = seg.kind === 'place' && seg.id !== 'fill' ? Number(seg.id.replace('place', '')) : null;
            const edit = seg.kind === 'activity' ? { type: 'activity', id: seg.id } : seg.id === 'fill' ? { type: 'fill' } : { type: 'place', index: placeIndex };
            return (
              <button key={seg.id} className="day-row" onClick={() => setEditing(edit)}>
                <i style={{ background: noiseColor(seg.rawDba) }} aria-hidden="true" />
                <span className="day-name">{seg.id === 'fill' ? `The rest: ${shortName(seg.name)}` : seg.kind === 'activity' ? (seg.id === 't2' ? 'T2 treadmill' : 'ARED exercise') : shortName(seg.name)}</span>
                <span className="day-meta">{hm(seg.minutes)} · {seg.rawDba} dBA</span>
                {seg.protectedNow && <span className="day-tag">Earplugs</span>}
                <span className="chev" aria-hidden="true">›</span>
              </button>
            );
          })}
          {plan.audio.minutes > 0 && (
            <button className="day-row" onClick={() => setEditing({ type: 'audio' })}>
              <i style={{ background: noiseColor(plan.audio.dba) }} aria-hidden="true" />
              <span className="day-name">Earphones</span>
              <span className="day-meta">{hm(plan.audio.minutes)} · {plan.audio.dba} dBA</span>
              <span className="chev" aria-hidden="true">›</span>
            </button>
          )}
          <button className="day-row" onClick={() => setEditing({ type: 'sleep' })}>
            <i style={{ background: noiseColor(r.sleepModule.dba) }} aria-hidden="true" />
            <span className="day-name">Sleep: {shortName(r.sleepModule.name)}</span>
            <span className="day-meta">8 h · {r.sleepModule.dba} dBA</span>
            <span className="chev" aria-hidden="true">›</span>
          </button>
          <button className="day-row add" onClick={() => setEditing({ type: 'add' })}>
            <span className="day-name">+ Add to the day</span>
          </button>
        </div>
        </div>
      </div>

      {editing && (
        <Sheet title={editTitle} onClose={() => setEditing(null)}>
          {editing.type === 'activity' && (
            <>
              <Stepper label="Time" value={plan.activities[editing.id] ?? 0} step={15} min={0} max={MAX_ACTIVITY_MIN} presets={[30, 60, 90]} format={hm} onChange={(v) => setPlan(setActivity(plan, editing.id, v))} />
              <button className="secondary" onClick={() => { setPlan(setActivity(plan, editing.id, 0)); setEditing(null); }}>Remove from the day</button>
            </>
          )}
          {editing.type === 'place' && plan.places[editing.index] && (
            <>
              <Picker
                label="Place"
                value={plan.places[editing.index].id}
                options={places.map((o) => ({ value: o.id, label: o.name, note: `${o.dba} dBA` }))}
                onChange={(v) => set({ places: plan.places.map((x, j) => (j === editing.index ? { ...x, id: v } : x)) })}
              />
              <Stepper label="Time there" value={plan.places[editing.index].minutes} step={30} min={0} max={480} presets={[60, 120, 240]} format={hm} onChange={(v) => setPlan(setPlaceMinutes(plan, editing.index, v))} />
              <button className="secondary" onClick={() => { set({ places: plan.places.filter((_, j) => j !== editing.index) }); setEditing(null); }}>Remove from the day</button>
            </>
          )}
          {editing.type === 'fill' && (
            <Picker label={`The rest (${hm(left)})`} value={plan.fill} options={places.map((o) => ({ value: o.id, label: o.name, note: `${o.dba} dBA` }))} onChange={(v) => { set({ fill: v }); setEditing(null); }} />
          )}
          {editing.type === 'audio' && (
            <>
              <Stepper label="Listening time" value={plan.audio.minutes} step={15} min={0} max={240} presets={[30, 60, 120]} format={hm} onChange={(v) => set({ audio: { ...plan.audio, minutes: v } })} />
              <Stepper label="Level at your ear (estimate)" value={plan.audio.dba} step={5} min={60} max={100} presets={[70, 80, 90]} unit="dBA" onChange={(v) => set({ audio: { ...plan.audio, dba: v } })} />
              <button className="secondary" onClick={() => { set({ audio: { ...plan.audio, minutes: 0 } }); setEditing(null); }}>Remove from the day</button>
            </>
          )}
          {editing.type === 'sleep' && (
            <div className="rows">
              {sleeps.map((m) => (
                <button key={m.id} className={`row${m.id === plan.sleepAt ? ' on' : ''}`} onClick={() => { set({ sleepAt: m.id }); setEditing(null); }}>
                  <span>{m.name} <span className="muted small">{m.dba} dBA</span></span>
                  {m.id === plan.sleepAt && <span aria-hidden="true">✓</span>}
                </button>
              ))}
            </div>
          )}
          {editing.type === 'add' && (
            <div className="rows">
              {ACTIVITIES.filter((a) => !(plan.activities[a.id] > 0)).map((a) => (
                <button key={a.id} className="row" onClick={() => { setPlan(setActivity(plan, a.id, 60)); setEditing({ type: 'activity', id: a.id }); }}>
                  <span>{a.id === 't2' ? 'T2 treadmill' : 'ARED exercise'} <span className="muted small">{a.dba} dBA</span></span>
                </button>
              ))}
              <button className="row" disabled={left <= 0} onClick={() => { setPlan(setPlaceMinutes({ ...plan, places: [...plan.places, { id: places[0].id, minutes: 0 }] }, plan.places.length, 120)); setEditing({ type: 'place', index: plan.places.length }); }}>
                <span>A place</span>
              </button>
              {plan.audio.minutes === 0 && (
                <button className="row" onClick={() => { set({ audio: { ...plan.audio, minutes: 60 } }); setEditing({ type: 'audio' }); }}>
                  <span>Earphones</span>
                </button>
              )}
            </div>
          )}
        </Sheet>
      )}
    </section>
  );
}

const listJoin = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
