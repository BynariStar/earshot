// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Personal protection, built on NASA's measured module spectra (Allen 2024, ICES-2024-354).
//
// 1. Which protector. NASA lists foam ear inserts, passive muff headsets and active noise reduction (ANR)
//    headsets as ISS hearing countermeasures (NTRS 20100031889). Foam earplugs block least at low pitches;
//    ANR adds attenuation below 1 kHz (NATO RTO-MP-HFM-123). So: if most of a noise's A-weighted energy is
//    below 1 kHz, a noise-cancelling headset; otherwise foam earplugs. The 50% cut-off is OUR DESIGN CHOICE.
//    Without a measured spectrum (NC rating only, or the exercise machines) we default to foam earplugs,
//    the protection NASA measured on the treadmill.
// 2. Which noise reaches your weakest pitch. Lab studies find the largest temporary shift half an octave to
//    an octave above the noise band (Maslen 1980, summarising the TTS literature). So a pitch f is "reached"
//    by octave bands from f/2 to f. A rule of thumb from narrow-band, largely animal studies; labelled so.
// 3. Early warning. NASA trends its sound surveys to catch hardware going bad (Welsh, Denham & Allen 2011,
//    NTRS 20110023076); a Columbus fan grew noisier for about 15 days before it was switched off (Parzianello
//    et al., ESMATS 2011). The trend shown here is SIMULATED, modelled on that case.
import { spectrumOf, withFault, BANDS, A_WEIGHT, SIGNATURES } from './spectrum.js';
import { averageBaselines, isNoResponse, FREQUENCIES } from './rules.js';
import { baselineTests, latestCheck } from './storage.js';

export const PROTECTORS = {
  foam: { id: 'foam', name: 'Foam earplugs', noun: 'earplugs', short: 'Earplugs' },
  anr: { id: 'anr', name: 'Noise-cancelling headset', noun: 'a noise-cancelling headset', short: 'Headset' },
};

const energy = (bands) => bands.map((L, i) => 10 ** ((L + A_WEIGHT[i]) / 10));
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

// Share of the A-weighted energy below 1 kHz.
export function lowShare(bands) {
  const e = energy(bands);
  return sum(e.filter((_, i) => BANDS[i] < 1000)) / sum(e);
}

// { ...protector, basis: 'spectrum' | 'default', share? } for a module (by its NASA spectrum id), optionally
// with a fault ({ signature, rise }) added to it.
export function protectorFor(spectrumId, fault = null) {
  const sp = spectrumId ? spectrumOf(spectrumId) : null;
  if (!sp || sp.kind !== 'digitised') return { ...PROTECTORS.foam, basis: 'default' };
  const bands = fault?.signature ? withFault(sp.bands, fault.signature, fault.rise ?? 8) : sp.bands;
  const share = lowShare(bands);
  return { ...(share >= 0.5 ? PROTECTORS.anr : PROTECTORS.foam), basis: 'spectrum', share };
}

export function protectorWhy(p) {
  if (p.basis !== 'spectrum') return 'No measured spectrum here, so foam earplugs, the protection NASA measured on the treadmill.';
  return p.id === 'anr'
    ? `${Math.round(p.share * 100)}% of this noise is below 1 kHz, where noise cancelling works best and foam earplugs block least.`
    : `${Math.round((1 - p.share) * 100)}% of this noise is at 1 kHz or above, where foam earplugs block well.`;
}

// Pitches on watch or shifted in the latest full check: [{ ear, f, d }], largest change first.
export function watchPitches(data) {
  const b = baselineTests(data);
  const check = latestCheck(data);
  if (b.length < 2 || !check) return [];
  const ref = averageBaselines(b[0].thresholds, b[1].thresholds);
  const out = [];
  for (const ear of ['left', 'right'])
    for (const f of FREQUENCIES) {
      const r = ref[ear]?.[f];
      const v = check.thresholds?.[ear]?.[f];
      if (!Number.isFinite(r) || !Number.isFinite(v) || isNoResponse(r) || isNoResponse(v)) continue;
      if (v - r >= 5) out.push({ ear, f, d: Math.round(v - r) });
    }
  return out.sort((a, b2) => b2.d - a.d || b2.f - a.f);
}

export const reachingBands = (f) => BANDS.filter((b) => b >= f / 2 && b <= f);
const hzShort = (b) => (b >= 1000 ? `${b / 1000}` : `${b} Hz`);
export const reachLabel = (f) => {
  const bs = reachingBands(f);
  if (!bs.length) return '';
  const unit = bs[bs.length - 1] >= 1000 ? ' kHz' : '';
  return bs.length === 1 ? `${hzShort(bs[0])}${unit}` : `${hzShort(bs[0])}–${hzShort(bs[bs.length - 1])}${unit}`;
};

// A-weighted level (dBA) of a spectrum's bands that reach pitch f, or null without a measured spectrum.
export function levelReaching(spectrumId, f, fault = null) {
  const sp = spectrumId ? spectrumOf(spectrumId) : null;
  if (!sp || sp.kind !== 'digitised') return null;
  const bands = fault?.signature ? withFault(sp.bands, fault.signature, fault.rise ?? 8) : sp.bands;
  const e = energy(bands);
  const r = reachingBands(f);
  const s = sum(e.filter((_, i) => r.includes(BANDS[i])));
  return s > 0 ? 10 * Math.log10(s) : null;
}

// Does a fault signature put energy right below (or at) pitch f?
export const signatureReaches = (signatureId, f) => (SIGNATURES.find((s) => s.id === signatureId)?.bands ?? []).some((b) => b >= f / 2 && b <= f);

// Modules whose noise reaches a watch pitch strongly enough to name (55 dBA in those bands; our cut-off).
export const REACH_DBA = 55;

// Early warning: a module getting louder over days (SIMULATED, modelled on the 2011 Columbus fan).
export const TRENDS = {
  iss: { part: 'cof', spectrumId: 'cof', signature: 'stalled-fan', days: [0, 0.3, 0.7, 1.2, 1.8] },
  moon: { part: 'm_workshop', spectrumId: 'node3', signature: 'stalled-fan', days: [0, 0.3, 0.7, 1.2, 1.8] },
  mars: { part: 'r_medical', spectrumId: null, signature: 'stalled-fan', days: [0, 0.3, 0.7, 1.2, 1.8] },
};
export const trendFor = (station) => {
  const t = TRENDS[station];
  if (!t) return null;
  return { ...t, rise: t.days[t.days.length - 1], span: t.days.length };
};
