// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// A stylised cochlea: a tapering tube coiled 2.5 turns (wide at the base where sound enters, narrow
// at the tip), with each test pitch placed at its true position along the length (Greenwood 1990).
import { fractionFromApex } from '../lib/cochlea.js';
import { FREQUENCIES } from '../lib/rules.js';

const STATUS_COLOR = {
  untested: 'var(--region-untested)',
  ok: 'var(--ok)',
  watch: 'var(--watch)',
  shift: 'var(--shift)',
  urgent: 'var(--urgent)',
  unmeasurable: 'var(--unmeasurable)',
};

const TURNS = 2.5;
const THETA_MAX = TURNS * 2 * Math.PI;
const INNER_RATIO = 0.2; // tip radius / base radius
const B = -Math.log(INNER_RATIO) / THETA_MAX; // log-spiral tightness

// Fraction of the tube's length from the base (0) to the tip (1) -> spiral angle.
// Arc length along a log spiral is proportional to the radius, so equal length = equal radius drop.
function thetaAt(lengthFromBase) {
  return -Math.log(1 - lengthFromBase * (1 - INNER_RATIO)) / B;
}

function geometry(size, ear) {
  const cx = size / 2;
  const cy = size / 2 + size * 0.03;
  const r0 = size * 0.37;
  const w0 = size * 0.085; // tube width at the base
  const dir = ear === 'left' ? 1 : -1; // mirror the two ears
  const start = ear === 'left' ? Math.PI : 0; // base faces outward, toward the side of the head
  const at = (s) => {
    const th = thetaAt(s);
    const r = r0 * Math.exp(-B * th);
    const ang = start + dir * th;
    const p = { x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) };
    // inward normal points to the centre
    const n = { x: Math.cos(ang), y: Math.sin(ang) };
    const w = w0 * (1 - 0.5 * s);
    return { p, n, w, ang, r };
  };
  return { at, cx, cy };
}

function tubePath(geom, s0, s1, steps = 60) {
  const outer = [];
  const inner = [];
  for (let i = 0; i <= steps; i++) {
    const s = s0 + ((s1 - s0) * i) / steps;
    const { p, n, w } = geom.at(s);
    outer.push([p.x + (n.x * w) / 2, p.y + (n.y * w) / 2]);
    inner.push([p.x - (n.x * w) / 2, p.y - (n.y * w) / 2]);
  }
  const pts = [...outer, ...inner.reverse()];
  return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ') + ' Z';
}

function centrePath(geom, s0, s1, steps = 200) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const { p } = geom.at(s0 + ((s1 - s0) * i) / steps);
    pts.push(`${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`);
  }
  return pts.join(' ');
}

// Sixth-octave band around each test pitch, as fractions of length from the base.
const band = (f) => [1 - fractionFromApex(f * 2 ** (1 / 6)), 1 - fractionFromApex(f / 2 ** (1 / 6))];

export default function Cochlea({ ear, statuses, selected, onSelect, size = 300 }) {
  const geom = geometry(size, ear);
  const base = geom.at(0);
  // Short straight entry where sound arrives from the middle ear (oval window side).
  const stemLen = size * 0.08;
  const tangent = { x: -Math.sin(base.ang), y: Math.cos(base.ang) };
  const sign = ear === 'left' ? 1 : -1;
  const stemEnd = { x: base.p.x - sign * tangent.x * stemLen, y: base.p.y - sign * tangent.y * stemLen };
  const half = base.w / 2;
  const stem = `M${(base.p.x + base.n.x * half).toFixed(1)},${(base.p.y + base.n.y * half).toFixed(1)} L${(stemEnd.x + base.n.x * half).toFixed(1)},${(stemEnd.y + base.n.y * half).toFixed(1)} L${(stemEnd.x - base.n.x * half).toFixed(1)},${(stemEnd.y - base.n.y * half).toFixed(1)} L${(base.p.x - base.n.x * half).toFixed(1)},${(base.p.y - base.n.y * half).toFixed(1)} Z`;
  const gradId = `shell-${ear}`;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="cochlea" role="group" aria-label={`${ear} ear cochlea`}>
      <defs>
        <radialGradient id={gradId} cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="var(--shell-in)" />
          <stop offset="100%" stopColor="var(--shell-out)" />
        </radialGradient>
      </defs>
      <path d={stem} className="cochlea-stem" />
      <path d={tubePath(geom, 0, 1, 400)} fill={`url(#${gradId})`} className="cochlea-shell" />
      <path d={centrePath(geom, 0.0, 0.995)} className="cochlea-duct" />
      {FREQUENCIES.map((f) => {
        const [s0, s1] = band(f);
        const status = statuses?.[f] ?? 'untested';
        const isSel = selected?.ear === ear && selected?.frequency === f;
        const mid = geom.at((s0 + s1) / 2);
        const off = mid.w / 2 + 9;
        const lx = mid.p.x + mid.n.x * off;
        const ly = mid.p.y + mid.n.y * off;
        return (
          <g key={f}>
            <path
              d={tubePath(geom, s0, s1, 30)}
              className={`cochlea-region${isSel ? ' selected' : ''}`}
              fill={STATUS_COLOR[status]}
              tabIndex={0}
              role="button"
              aria-label={`${ear} ear, ${f} Hz, ${status}`}
              onClick={() => onSelect({ ear, frequency: f })}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect({ ear, frequency: f })}
            />
            <text x={lx} y={ly} className="cochlea-label" textAnchor="middle" dominantBaseline="middle">
              {f >= 1000 ? `${f / 1000}k` : f}
            </text>
          </g>
        );
      })}
      <text x={stemEnd.x} y={stemEnd.y + half + 14} className="cochlea-end" textAnchor="middle">
        sound enters
      </text>
    </svg>
  );
}
