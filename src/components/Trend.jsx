// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Change from baseline over time for NASA's two rule bands, per ear, with the 10 dB rule line.
import { shifts } from '../lib/rules.js';

const SERIES = [
  { ear: 'left', band: 'low', label: 'Left ear, low pitches (250-500 Hz)', cls: 's1' },
  { ear: 'right', band: 'low', label: 'Right ear, low pitches', cls: 's2' },
  { ear: 'left', band: 'high', label: 'Left ear, high pitches (2-4 kHz)', cls: 's3' },
  { ear: 'right', band: 'high', label: 'Right ear, high pitches', cls: 's4' },
];

export default function Trend({ reference, checks }) {
  if (!reference || checks.length < 2) return null;
  const pts = checks.map((c, i) => ({ x: c.missionDay ?? i, s: shifts(reference, c.thresholds) }));
  const W = 720, H = 220, L = 40, R = 30, T = 12, B = 30;
  const xs = pts.map((p) => p.x);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const lo = -10, hi = 20;
  const X = (v) => L + ((v - x0) / (x1 - x0 || 1)) * (W - L - R);
  const Y = (v) => T + ((hi - Math.max(lo, Math.min(hi, v))) / (hi - lo)) * (H - T - B);
  const usesDays = checks.every((c) => Number.isFinite(c.missionDay));
  return (
    <figure className="trend">
      <figcaption>Change from your baseline over time (dB; higher = harder to hear)</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Hearing change over time">
        {[-10, 0, 10, 20].map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={Y(t)} y2={Y(t)} className={t === 10 ? 'rule' : 'grid'} />
            <text x={L - 6} y={Y(t) + 4} textAnchor="end" className="axis">{t > 0 ? `+${t}` : t}</text>
          </g>
        ))}
        <text x={L + 4} y={Y(10) - 5} textAnchor="start" className="axis rule-label">NASA shift rule: 10 dB</text>
        {SERIES.map((s) => {
          const vals = pts.map((p) => ({ x: p.x, y: p.s[s.ear][s.band] })).filter((v) => Number.isFinite(v.y));
          const d = vals.map((v, i) => `${i ? 'L' : 'M'}${X(v.x).toFixed(1)},${Y(v.y).toFixed(1)}`).join(' ');
          return (
            <g key={s.label} className={`trend-series ${s.cls}`}>
              <path d={d} />
              {vals.map((v, i) => <circle key={i} cx={X(v.x)} cy={Y(v.y)} r="3.5" />)}
            </g>
          );
        })}
        {pts.map((p, i) => (
          <text key={i} x={X(p.x)} y={H - 10} textAnchor={i === pts.length - 1 ? 'end' : i === 0 ? 'start' : 'middle'} className="axis">
            {usesDays ? `day ${p.x}` : `#${i + 1}`}
          </text>
        ))}
      </svg>
      <div className="trend-legend">
        {SERIES.map((s) => <span key={s.label} className={`trend-key ${s.cls}`}>{s.label}</span>)}
      </div>
    </figure>
  );
}
