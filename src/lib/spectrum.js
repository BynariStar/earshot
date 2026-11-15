// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Octave-band noise spectra (63 Hz to 8 kHz) for ISS modules, from NASA's 2024 ISS acoustics status
// report (Allen, ICES-2024-354):
// - "digitised": read from the vector data of the paper's figures; each reproduces NASA's dBA within 0.1 dB.
// - "nc": the paper gives only an NC rating (its spectrum figure is an image, or not shown). We draw that
//   rating's NC curve, interpolated between the standard NC curves (ANSI S12.2; NC-50 matches NASA-STD-3001
//   Table 6.6-3 exactly). It's an upper bound in every band, not the measured shape.
import data from '../data/spectra.json';

export const BANDS = data.bands;
const A_WEIGHT = [-26.2, -16.1, -8.6, -3.2, 0, 1.2, 1.0, -1.1];
const NC_TABLE = {
  15: [47, 36, 29, 22, 17, 14, 12, 11],
  20: [51, 40, 33, 26, 22, 19, 17, 16],
  25: [54, 44, 37, 31, 27, 24, 22, 21],
  30: [57, 48, 41, 35, 31, 29, 28, 27],
  35: [60, 52, 45, 40, 36, 34, 33, 32],
  40: [64, 56, 50, 45, 41, 39, 38, 37],
  45: [67, 60, 54, 49, 46, 44, 43, 42],
  50: [71, 64, 58, 54, 51, 49, 48, 47],
  55: [74, 67, 62, 58, 56, 54, 53, 52],
  60: [77, 71, 67, 63, 61, 59, 58, 57],
  65: [80, 75, 71, 68, 66, 64, 63, 62],
  70: [83, 79, 75, 72, 71, 70, 69, 68],
};

export function ncCurve(n) {
  const lo = Math.max(15, Math.min(65, Math.floor(n / 5) * 5));
  const hi = lo + 5;
  const t = (n - lo) / 5;
  return NC_TABLE[lo].map((v, i) => Math.round((v + t * (NC_TABLE[hi][i] - v)) * 10) / 10);
}

export function dbaOf(bands) {
  return 10 * Math.log10(bands.reduce((s, L, i) => s + 10 ** ((L + A_WEIGHT[i]) / 10), 0));
}

// { kind: 'digitised' | 'nc', bands, nc } or null when NASA gives neither.
export function spectrumOf(id) {
  if (data.spectra[id]) return { kind: 'digitised', bands: data.spectra[id].bands, nc: data.nc[id] ?? null };
  if (data.nc[id]) return { kind: 'nc', bands: ncCurve(data.nc[id]), nc: data.nc[id] };
  return null;
}

export const sourceNote = (id) => data.sources[id] ?? null;
export const SIGNATURES = data.signatures;

// Which tested pitches (and cochlea regions) carry most of the A-weighted energy.
const TO_TESTED = { 250: [250], 500: [500], 1000: [1000], 2000: [2000, 3000], 4000: [4000] };
export function dominantBands(bands, top = 2) {
  const e = bands.map((L, i) => ({ band: BANDS[i], e: 10 ** ((L + A_WEIGHT[i]) / 10) }));
  const total = e.reduce((a, x) => a + x.e, 0);
  return e
    .map((x) => ({ ...x, share: x.e / total }))
    .sort((a, b) => b.share - a.share)
    .slice(0, top)
    .map((x) => ({ band: x.band, share: x.share, tested: TO_TESTED[x.band] ?? [] }));
}

// A fault adds energy in a signature's bands. Returns the faulty spectrum.
export function withFault(bands, signatureId, riseDb) {
  const sig = SIGNATURES.find((s) => s.id === signatureId);
  return bands.map((L, i) => (sig.bands.includes(BANDS[i]) ? L + riseDb : L));
}

// Match a spectrum's rise over its normal to the closest NASA-sourced signature.
export function likelySource(normal, now) {
  const rise = now.map((L, i) => Math.max(0, L - normal[i]));
  const total = rise.reduce((a, b) => a + b, 0);
  if (total < 3) return null;
  const scored = SIGNATURES.map((s) => {
    const inBands = BANDS.reduce((a, b, i) => a + (s.bands.includes(b) ? rise[i] : 0), 0);
    return { ...s, confidence: inBands / total };
  }).sort((a, b) => b.confidence - a.confidence);
  return scored[0].confidence >= 0.5 ? scored[0] : null;
}

export const bandLabel = (b) => (b >= 1000 ? `${b / 1000} kHz` : `${b} Hz`);

// How much a module's dBA rises when a fault adds riseDb in the signature's bands. Modules without a NASA
// spectrum use Node 2's (an NC-53.6 envelope) as a stand-in.
export function faultDelta(id, signatureId = 'stalled-fan', riseDb = 8) {
  const sp = spectrumOf(id) ?? spectrumOf('node2');
  return dbaOf(withFault(sp.bands, signatureId, riseDb)) - dbaOf(sp.bands);
}
