// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Fleet trends (SIMULATED): what the ground could learn by pooling crews' end-of-day noise logs.
// Hearing results are never pooled here; that data stays with the crew member and the flight surgeon.
import { useMemo, useState } from 'react';
import { simulateFleet, analyzeFleet, ASSUMPTIONS, ANOMALY, DETECT_DB, EXPEDITIONS, moduleName } from '../lib/fleet.js';

const pct = (x) => `${Math.round(x * 100)}%`;
const MUTED = '#59617e';

function Stat({ value, label, sub }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
      {sub && <span className="muted small">{sub}</span>}
    </div>
  );
}

function ModuleTrend({ series, highlight }) {
  const W = 720, H = 230, L = 44, R = 110, T = 14, B = 30;
  const weeks = 26;
  const lo = -3, hi = 8;
  const X = (w) => L + ((w - 1) / (weeks - 1)) * (W - L - R);
  const Y = (v) => T + ((hi - Math.max(lo, Math.min(hi, v))) / (hi - lo)) * (H - T - B);
  const mods = Object.keys(series).sort((a, b) => (a === highlight) - (b === highlight)); // highlight drawn last
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart fleet-chart" role="img" aria-label="Weekly module noise compared with NASA averages">
      {[-2, 0, 2, 4, 6, 8].map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} className={v === 0 ? 'axis-line' : 'grid'} />
          <text x={L - 6} y={Y(v) + 4} textAnchor="end" className="axis">{v > 0 ? `+${v}` : v}</text>
        </g>
      ))}
      <line x1={L} x2={W - R} y1={Y(DETECT_DB)} y2={Y(DETECT_DB)} className="threshold" />
      <text x={W - R + 6} y={Y(DETECT_DB) + 4} className="axis">flag at +{DETECT_DB} dB</text>
      {mods.map((m) => {
        const pts = series[m];
        const on = m === highlight;
        const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.week).toFixed(1)},${Y(p.dev).toFixed(1)}`).join(' ');
        return (
          <g key={m}>
            <path d={d} fill="none" stroke={on ? 'var(--accent)' : MUTED} strokeWidth={on ? 2 : 1.25} opacity={on ? 1 : 0.7} />
            {pts.map((p) => (
              <circle key={p.week} cx={X(p.week)} cy={Y(p.dev)} r={on ? 4 : 2.5} fill={on ? 'var(--accent)' : MUTED} stroke="var(--surface)" strokeWidth="2">
                <title>{`${moduleName(m)}, week ${p.week}: ${p.dev > 0 ? '+' : ''}${p.dev.toFixed(1)} dB vs NASA average (${p.n} readings)`}</title>
              </circle>
            ))}
            {on && <text x={X(pts.at(-1).week) + 8} y={Y(pts.at(-1).dev) + 4} className="series-label">{moduleName(m)}</text>}
          </g>
        );
      })}
      <text x={L} y={H - 8} className="axis">week 1</text>
      <text x={W - R} y={H - 8} textAnchor="end" className="axis">week {weeks}</text>
    </svg>
  );
}

function SleepBars({ rows }) {
  return (
    <div className="hbars" role="table" aria-label="Nights above the 50 dBA sleep target, by sleep station">
      {rows.map((r) => (
        <div key={r.id} className="hbar" role="row" title={`${r.name}: ${r.over50} of ${r.nights} simulated nights above 50 dBA (NASA average ${r.dba} dBA)`}>
          <span className="hbar-label" role="cell">{r.name} <em>{r.dba} dBA</em></span>
          <span className="hbar-track"><span className="hbar-fill" style={{ width: `${r.share * 100}%` }} /></span>
          <span className="hbar-value" role="cell">{pct(r.share)}</span>
        </div>
      ))}
    </div>
  );
}

export default function Fleet() {
  const a = useMemo(() => analyzeFleet(simulateFleet()), []);
  const [exp, setExp] = useState(ANOMALY.expedition);
  const flagged = a.anomalies.filter((x) => x.exp === exp);
  const flaggedModule = flagged[0]?.module ?? null;
  const loudSleep = a.sleep.filter((s) => s.share > 0.5);

  return (
    <section className="fleet">
      <div className="demo-banner">
        <strong>Simulated fleet.</strong> {a.total.toLocaleString()} crew-days generated from NASA's measured module and activity levels with the
        assumptions listed below. It shows what pooling crews' end-of-day noise logs could reveal. <strong>No hearing results are pooled</strong>:
        those stay with each crew member and their flight surgeon.
      </div>

      <div className="stats">
        <Stat value={pct(a.overShare)} label="of crew-days over NASA's daily noise allowance" />
        <Stat value={pct(a.over72)} label="of workdays over the 72 dBA flight rule" sub="NASA's real crew dosimetry: 21% of sessions (risk record, Rev B.1)" />
        <Stat value={`${pct(a.plugs.without)} vs ${pct(a.plugs.with)}`} label="treadmill days over the allowance, without vs with earplugs" />
      </div>

      <article className="fleet-card">
        <h3>What pushes a day over the allowance?</h3>
        <p>
          In this simulation, <strong>every</strong> day over the allowance had a treadmill session without earplugs. That's partly built in:
          NASA's module averages alone can't push a day over, so the treadmill is the only loud source the simulation has. Real logs would
          also capture what averages miss, such as loud meals, conferences and experiments, which NASA's dosimetry found to be the largest
          source of events above 85 dBA.
        </p>
      </article>

      <article className="fleet-card">
        <div className="fleet-card-head">
          <h3>Is any module getting louder?</h3>
          <div className="segmented" role="tablist" aria-label="Expedition">
            {EXPEDITIONS.map((e) => (
              <button key={e} role="tab" aria-selected={exp === e} className={exp === e ? 'on' : ''} onClick={() => setExp(e)}>Expedition {e}</button>
            ))}
          </div>
        </div>
        <p className="muted small">Weekly average of the crew's module readings minus NASA's measured average for that module. One line per module; flagged ones in blue.</p>
        <ModuleTrend series={a.series[exp]} highlight={flaggedModule} />
        <p>
          {flagged.length
            ? `Flagged: ${moduleName(flaggedModule)} ran ${flagged.map((f) => `+${f.dev.toFixed(1)} dB in week ${f.week}`).join(', ')}. This is the injected example; in real data this is the pattern of a clogged fan, like the episodes NASA traced in 2009, 2012 and 2018.`
            : `Nothing flagged in Expedition ${exp}: every module stays within ${DETECT_DB} dB of its NASA average.`}
        </p>
      </article>

      <article className="fleet-card">
        <h3>Which sleep stations miss the 50 dBA target?</h3>
        <p className="muted small">Share of simulated nights above NASA's 50 dBA sleep target (Flight Rule B13-152). NASA's measured sleep averages were 53.9 dBA (US) and 55.5 dBA (Russian segment), so this pattern matches reality.</p>
        <SleepBars rows={a.sleep} />
      </article>

      <article className="fleet-card fixes">
        <h3>What the ground team would fix for the next expedition</h3>
        <ol>
          <li><strong>Make treadmill earplugs the default:</strong> without them, {pct(a.plugs.without)} of treadmill days went over the allowance; with them, {pct(a.plugs.with)}.</li>
          {flaggedModule && <li><strong>Inspect the {moduleName(flaggedModule)} fans:</strong> the module ran {DETECT_DB} dB or more above its NASA average for {flagged.length} weeks.</li>}
          <li>
            <strong>Quiet the sleep stations:</strong> {loudSleep.length} of {a.sleep.length} were above the 50 dBA target on most nights; start with
            the loudest, {[...a.sleep].sort((x, y) => y.dba - x.dba)[0].name} ({[...a.sleep].sort((x, y) => y.dba - x.dba)[0].dba} dBA).
          </li>
        </ol>
      </article>

      <details className="fleet-card">
        <summary>Assumptions and numbers</summary>
        <ul>{ASSUMPTIONS.map((x) => <li key={x}>{x}</li>)}</ul>
        <table className="audiogram-table">
          <thead><tr><th>Sleep station</th><th>NASA avg (dBA)</th><th>Nights above 50 dBA</th></tr></thead>
          <tbody>{a.sleep.map((s) => <tr key={s.id}><td>{s.name}</td><td>{s.dba}</td><td>{s.over50} of {s.nights}</td></tr>)}</tbody>
        </table>
        <p className="muted small">Flagged weeks (all expeditions): {a.anomalies.map((x) => `${x.exp} · ${moduleName(x.module)} · week ${x.week} · +${x.dev.toFixed(1)} dB`).join('; ') || 'none'}.</p>
      </details>
    </section>
  );
}
