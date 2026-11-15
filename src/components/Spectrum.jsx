// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// A module's noise by pitch (octave bands), which part of the cochlea it mostly reaches, NASA's named
// sources, and, during a fault, the likely source from NASA-sourced signatures.
import { BANDS, spectrumOf, sourceNote, dominantBands, withFault, likelySource, bandLabel, SIGNATURES } from '../lib/spectrum.js';
import { FAULT_SIGNATURE, FAULT_RISE_DB } from '../lib/alerts.js';

// fault: true (the demo fault), { signature, rise } (a live incident), or nothing.
export default function Spectrum({ id, fault, hideSource = false }) {
  const f = fault === true ? { signature: FAULT_SIGNATURE, rise: FAULT_RISE_DB } : fault || null;
  const sp = spectrumOf(id);
  const sig = SIGNATURES.find((s) => s.id === (f?.signature ?? FAULT_SIGNATURE));
  if (!sp) {
    return f ? (
      <div className="spectrum">
        <h4>Where it's coming from</h4>
        <p className="small">Likely source: <strong>{sig.name.toLowerCase()}</strong>, from the rise at {sig.bands.map(bandLabel).join(' and ')}. {sig.basis}</p>
      </div>
    ) : null;
  }
  const now = f ? withFault(sp.bands, f.signature, f.rise) : sp.bands;
  const src = f ? likelySource(sp.bands, now) : null;
  const dom = dominantBands(now);
  const W = 300, H = 130, L = 26, B = 22, T = 8;
  const lo = 20, hi = 85;
  const bw = (W - L - 4) / BANDS.length;
  const Y = (v) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  return (
    <div className="spectrum">
      <h4>By pitch</h4>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Noise level by octave band">
        {[30, 50, 70].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - 4} y1={Y(v)} y2={Y(v)} className="grid" />
            <text x={L - 4} y={Y(v) + 3} textAnchor="end" className="axis">{v}</text>
          </g>
        ))}
        {BANDS.map((b, i) => {
          const x = L + i * bw + 3;
          const top = Y(now[i]);
          const base = Y(sp.bands[i]);
          return (
            <g key={b}>
              <rect x={x} y={Y(sp.bands[i])} width={bw - 6} height={H - B - Y(sp.bands[i])} rx="3" className={sp.kind === 'nc' ? 'bar-envelope' : 'bar'}>
                <title>{`${bandLabel(b)}: ${sp.bands[i]} dB${sp.kind === 'nc' ? ' (upper bound)' : ''}`}</title>
              </rect>
              {f && now[i] > sp.bands[i] && (
                <rect x={x} y={top} width={bw - 6} height={base - top} rx="3" className="bar-fault">
                  <title>{`${bandLabel(b)} now: ${now[i]} dB (+${(now[i] - sp.bands[i]).toFixed(0)} dB)`}</title>
                </rect>
              )}
              <text x={x + (bw - 6) / 2} y={H - 8} textAnchor="middle" className="axis">{b >= 1000 ? `${b / 1000}k` : b}</text>
            </g>
          );
        })}
      </svg>
      {src && !hideSource && (
        <p className="small fault-note">
          Likely source: <strong>{src.name.toLowerCase()}</strong>. The rise is at {src.bands.map(bandLabel).join(' and ')}.
        </p>
      )}
      <p className="small">Loudest for your ears at <strong>{dom.map((d) => bandLabel(d.band)).join(' and ')}</strong>.</p>
      {sourceNote(id) && <p className="small"><span className="label-caps">NASA</span> {sourceNote(id)}</p>}
      <details className="source-note">
        <summary>Source</summary>
        <p className="muted small">
          {sp.kind === 'nc'
            ? `NASA publishes this module's noise only as a rating (NC-${sp.nc}); the dashed bars are that rating's curve, the most each band can be.`
            : "Read from the figures of NASA's 2024 ISS acoustics report (Allen, ICES-2024-354)."}
          {src ? ` ${src.basis}` : ''}

        </p>
      </details>
    </div>
  );
}
