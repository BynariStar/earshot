// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Plan my day: the answer first (which earplugs, and what that does to the day), then the day itself and the
// numbers on request. The day is assumed to come from the crew schedule (simulated); the controls are for "what if".
import { noiseColor } from '../lib/issLayout.js';
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

export default function Planner({ plan: rawPlan, setPlan, data, lockedBase, focus, alerts = [], events = [], go }) {
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

      <div className="plan-answer">
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

        <h3 className="plan-sub">Your day</h3>
        <ul className="plan-checks">
          {checks.map((c) => (
            <li key={c.text} className={c.ok ? 'ok' : 'todo'}>
              <span className="mark" aria-hidden="true">{c.ok ? '✓' : '!'}</span>
              <span>{c.text} <span className="muted">({c.note})</span></span>
            </li>
          ))}
        </ul>
        <DayBar result={r} />
        <p className="muted small">
          From your crew schedule
          <Info>The day comes from the crew schedule (simulated; Earshot assumes it is up to date). Change it below to try a different day.</Info>
        </p>
      </div>

      <details className="plan-section" open={focus === 'sleep' || undefined}>
        <summary>Change the day</summary>
        <div className="planner-inputs">
          <h4>Loud activities</h4>
          {ACTIVITIES.map((a) => (
            <Stepper
              key={a.id}
              label={`${a.id === 't2' ? 'T2 treadmill' : a.name} · ${a.dba} dBA`}
              value={plan.activities[a.id] ?? 0}
              step={15}
              min={0}
              max={MAX_ACTIVITY_MIN}
              presets={[0, 30, 60, 90]}
              onChange={(v) => setPlan(setActivity(plan, a.id, v))}
            />
          ))}

          <h4>Where you'll work</h4>
          {plan.places.map((pl, i) => (
            <div key={i} className="place-block">
              <Picker
                label="Place"
                value={pl.id}
                options={places.map((o) => ({ value: o.id, label: o.name, note: `${o.dba} dBA` }))}
                onChange={(v) => set({ places: plan.places.map((x, j) => (j === i ? { ...x, id: v } : x)) })}
              />
              <Stepper label="Time there" value={pl.minutes} step={30} min={0} max={480} presets={[60, 120, 240]} format={hm} onChange={(v) => setPlan(setPlaceMinutes(plan, i, v))} />
              <button className="secondary" onClick={() => set({ places: plan.places.filter((_, j) => j !== i) })}>Remove this place</button>
            </div>
          ))}
          <button className="secondary" disabled={left <= 0} onClick={() => setPlan(setPlaceMinutes({ ...plan, places: [...plan.places, { id: places[0].id, minutes: 0 }] }, plan.places.length, 120))}>
            + Add a place
          </button>
          <div className="fill-block">
            <Picker
              label={`The rest (${hm(left)})`}
              value={plan.fill}
              options={places.map((o) => ({ value: o.id, label: o.name, note: `${o.dba} dBA` }))}
              onChange={(v) => set({ fill: v })}
            />
          </div>
          <h4>Earphones</h4>
          {plan.audio.minutes > 0 ? (
            <>
              <Stepper label="Listening time" value={plan.audio.minutes} step={15} min={0} max={240} presets={[30, 60, 120]} onChange={(v) => set({ audio: { ...plan.audio, minutes: v } })} />
              <Stepper label="Level at your ear (estimate)" value={plan.audio.dba} step={5} min={60} max={100} presets={[70, 80, 90]} unit="dBA" onChange={(v) => set({ audio: { ...plan.audio, dba: v } })} />
            </>
          ) : (
            <button className="secondary" onClick={() => set({ audio: { ...plan.audio, minutes: 60 } })}>+ Add earphones</button>
          )}
          <h4>Sleep (8 h)</h4>
          <Picker
            startOpen={focus === 'sleep'}
            label="Sleep in"
            value={plan.sleepAt}
            options={sleeps.map((m) => ({ value: m.id, label: m.name, note: `${m.dba} dBA` }))}
            onChange={(v) => set({ sleepAt: v })}
          />
        </div>
      </details>

      <details className="plan-section">
        <summary>Show the numbers</summary>
        <div className="plan-numbers">
          <p>
            <strong>Noise allowance.</strong> NASA allows 8 hours at 75 dBA per 24 hours, and half that time for every 3 dB louder (NASA-STD-3001 [V2 6115]).
            {r.top ? ` ${r.top.name} uses the most: ${Math.round(r.top.dosePct)}%.` : ''}
            {r.dosePct <= 100 ? ` Room left: about ${hm(r.headroom(T2.dba))} of treadmill without earplugs.` : ''}
          </p>
          <p><strong>Workday.</strong> {r.work.leqDba.toFixed(1)} dBA over 16 hours. {STATUS[r.work.status].text} (Flight Rule B13-152).</p>
          <p><strong>Sleep.</strong> {r.sleep.leqDba.toFixed(1)} dBA. {STATUS[r.sleep.status].text}.</p>
          {flagged.length > 0 && <p><strong>Without the earplugs.</strong> {Math.round(skip.dosePct)}% of the allowance, workday {skip.work.leqDba.toFixed(1)} dBA. Earplugs count as {PLUG_DB.toFixed(1)} dB, from NASA's treadmill figure.</p>}
          <p><strong>Real crews.</strong> NASA's crew dosimeters measured workdays of 68.7 to 70.8 dBA (Limardo et al. 2021).</p>
          <p className="muted small">
            Sources: activity levels and earplugs, Allen &amp; Danielson 2020; module levels, Allen 2024; limits, Flight Rule B13-152 and NASA-STD-3001 [V2 6115];
            earphones, WHO-ITU H.870 (80 dB for 40 hours a week) and NASA-STD-3001 [V2 6106].
          </p>
        </div>
      </details>
    </section>
  );
}

const listJoin = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
