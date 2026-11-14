// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
import { fractionFromApex, spiralPath, spiralPoint } from '../lib/cochlea.js';
import { FREQUENCIES } from '../lib/rules.js';

const STATUS_COLOR = {
  untested: 'var(--region-untested)',
  ok: 'var(--ok)',
  watch: 'var(--watch)',
  shift: 'var(--shift)',
  urgent: 'var(--urgent)',
};

// Band edges a sixth of an octave either side of each test frequency.
const band = (f) => [f / 2 ** (1 / 6), f * 2 ** (1 / 6)];
// t runs from 0 at the base (outer) to 1 at the apex (centre).
const tOf = (f) => 1 - fractionFromApex(f);

export default function Cochlea({ ear, statuses, selected, onSelect, size = 300 }) {
  const mirror = ear === 'left' ? -1 : 1;
  const geom = {
    cx: size / 2,
    cy: size / 2,
    rOuter: size * 0.44,
    rInner: size * 0.06,
    startAngle: ear === 'left' ? 0 : Math.PI,
    direction: mirror,
  };
  const tube = spiralPath(0.0, 0.97, geom, 300);
  const base = spiralPoint(0, geom);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="cochlea" role="group" aria-label={`${ear} ear cochlea`}>
      <path d={tube} className="cochlea-tube" />
      {FREQUENCIES.map((f) => {
        const [lo, hi] = band(f);
        const d = spiralPath(tOf(hi), tOf(lo), geom, 40);
        const status = statuses?.[f] ?? 'untested';
        const isSel = selected?.ear === ear && selected?.frequency === f;
        const mid = spiralPoint(tOf(f), { ...geom, rOuter: geom.rOuter + 16, rInner: geom.rInner + 16 });
        return (
          <g key={f}>
            <path
              d={d}
              className={`cochlea-region${isSel ? ' selected' : ''}`}
              stroke={STATUS_COLOR[status]}
              tabIndex={0}
              role="button"
              aria-label={`${ear} ear, ${f} Hz, ${status}`}
              onClick={() => onSelect({ ear, frequency: f })}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect({ ear, frequency: f })}
            />
            <text x={mid.x} y={mid.y} className="cochlea-label" textAnchor="middle" dominantBaseline="middle">
              {f >= 1000 ? `${f / 1000}k` : f}
            </text>
          </g>
        );
      })}
      <text x={base.x} y={base.y + (ear === 'left' ? -14 : 18)} className="cochlea-end" textAnchor="middle">
        base · high pitch
      </text>
      <text x={size / 2} y={size / 2 + 4} className="cochlea-end" textAnchor="middle">
        apex
      </text>
    </svg>
  );
}
