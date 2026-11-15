// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// One line: your largest change from baseline at any pitch, check by check, against NASA's 10 dB shift line.
// Points take the status colour; the label at the end names where the latest largest change is.
import { shifts, isNoResponse } from '../lib/rules.js';

const STATUS = (d) => (d >= 30 ? 'urgent' : d >= 10 ? 'shift' : d >= 5 ? 'watch' : 'ok');
const hz = (f) => (f >= 1000 ? `${f / 1000} kHz` : `${f} Hz`);

function largest(reference, thresholds) {
  const s = shifts(reference, thresholds);
  let best = { d: -Infinity };
  for (const ear of ['left', 'right'])
    for (const [f, d] of Object.entries(s[ear].perFreq ?? {})) {
      if (!Number.isFinite(d) || isNoResponse(reference[ear][f])) continue;
      if (d > best.d) best = { d, ear, f: Number(f) };
    }
  return best;
}

export default function Trend({ reference, checks }) {
  if (!reference || checks.length < 2) return null;
  const pts = checks.map((c, i) => ({ x: c.missionDay ?? i, ...largest(reference, c.thresholds) })).filter((p) => Number.isFinite(p.d));
  if (pts.length < 2) return null;
  const W = 720, H = 180, L = 40, R = 120, T = 14, B = 28;
  const x0 = Math.min(...pts.map((p) => p.x)), x1 = Math.max(...pts.map((p) => p.x));
  const hi = Math.max(20, Math.ceil(Math.max(...pts.map((p) => p.d)) / 10) * 10);
  const lo = 0;
  const X = (v) => L + ((v - x0) / (x1 - x0 || 1)) * (W - L - R);
  const Y = (v) => T + ((hi - Math.max(lo, Math.min(hi, v))) / (hi - lo)) * (H - T - B);
  const usesDays = checks.every((c) => Number.isFinite(c.missionDay));
  const last = pts[pts.length - 1];
  return (
    <figure className="trend">
      <figcaption>Your largest change, check by check</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Largest change from baseline over time; latest ${Math.round(last.d)} dB at ${hz(last.f)}, ${last.ear} ear`}>
        {[0, 10, 20, ...(hi > 20 ? [hi] : [])].map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={Y(t)} y2={Y(t)} className={t === 10 ? 'rule' : 'grid'} />
            <text x={L - 6} y={Y(t) + 4} textAnchor="end" className="axis">{t ? `+${t}` : 0}</text>
          </g>
        ))}
        <text x={W - R + 6} y={Y(10) + 4} className="axis rule-label">NASA shift</text>
        <path d={pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.d).toFixed(1)}`).join(' ')} className="trend-line" />
        {pts.map((p, i) => (
          <circle key={i} cx={X(p.x)} cy={Y(p.d)} r="5" className={`trend-dot ${STATUS(p.d)}`}>
            <title>{`${usesDays ? `Day ${p.x}` : `Check ${i + 1}`}: ${Math.round(p.d)} dB, ${p.ear} ear, ${hz(p.f)}`}</title>
          </circle>
        ))}
        <text x={X(last.x) + 10} y={Y(last.d) + 4} className="axis trend-end">{`${last.ear === 'left' ? 'Left' : 'Right'} ear, ${hz(last.f)}`}</text>
        {pts.map((p, i) => (
          <text key={i} x={X(p.x)} y={H - 8} textAnchor="middle" className="axis">{usesDays ? `day ${p.x}` : `#${i + 1}`}</text>
        ))}
      </svg>
    </figure>
  );
}
