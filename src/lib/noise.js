// Noise exposure math, following NASA's own definitions.
//
// - 24-hour noise dose: NASA-STD-3001 Vol. 2 Rev F, requirement [V2 6115]:
//   D = 100 * sum(Cn / Tn), with Tn = 480 / 2^((Ln - 75) / 3) minutes.
//   D <= 100 is the limit (equivalent to 75 dBA for 8 hours, 3 dB exchange rate).
// - ISS Flight Rule B13-152 (as summarized by Allen & Danielson 2020 and Allen 2024):
//   16-hour workday exposure above 72 dBA requires hearing protection during loud activities,
//   above 60 dBA protection is recommended; sleep target 50 dBA; 62 dBA counts as hearing rest.

export const LIMITS = {
  doseMax: 100,
  workdayHours: 16,
  workdayRequireDba: 72,
  workdayRecommendDba: 60,
  sleepTargetDba: 50,
  hearingRestDba: 62,
  hazardDba: 85, // [V2 6077] hazard limit
};

// Effective earplug attenuation implied by NASA's worked example (Allen & Danielson 2020):
// one hour on the T2 treadmill (84.5 dBA) lifts a 16-hour day to 72.8 dBA, or 63.7 dBA with earplugs.
// Solving those two numbers gives about 13 dB of effective attenuation (our calculation).
export const EARPLUG_EFFECTIVE_DB = 13;

export function allowedMinutes(dba) {
  return 480 / 2 ** ((dba - 75) / 3);
}

// segments: [{ dba, minutes }]
export function dose(segments) {
  return 100 * segments.reduce((sum, s) => sum + s.minutes / allowedMinutes(s.dba), 0);
}

export function leq(segments) {
  const total = segments.reduce((sum, s) => sum + s.minutes, 0);
  if (total === 0) return NaN;
  const energy = segments.reduce((sum, s) => sum + s.minutes * 10 ** (s.dba / 10), 0);
  return 10 * Math.log10(energy / total);
}

// Per-minute series (e.g. NASA chamber dosimetry) to segments.
export function seriesToSegments(levels) {
  return levels.map((dba) => ({ dba, minutes: 1 }));
}

// Apply hearing protection to the segments marked protected.
export function withProtection(segments, attenuationDb = EARPLUG_EFFECTIVE_DB) {
  return segments.map((s) => (s.protected ? { ...s, dba: s.dba - attenuationDb } : s));
}

// Evaluate a 16-hour workday against Flight Rule B13-152.
export function workdayStatus(segments) {
  const level = leq(segments);
  let status = 'ok';
  if (level > LIMITS.workdayRequireDba) status = 'protection-required';
  else if (level > LIMITS.workdayRecommendDba) status = 'protection-recommended';
  return { leqDba: level, status };
}

export function sleepStatus(segments) {
  const level = leq(segments);
  let status = 'restful';
  if (level > LIMITS.hearingRestDba) status = 'no-hearing-rest';
  else if (level > LIMITS.sleepTargetDba) status = 'above-sleep-target';
  return { leqDba: level, status };
}

// Which activities in a day push the workday over the limit? Returns segments sorted by
// their share of the day's acoustic energy, loudest contribution first.
export function biggestContributors(segments) {
  const total = segments.reduce((sum, s) => sum + s.minutes * 10 ** (s.dba / 10), 0);
  return segments
    .map((s) => ({ ...s, share: (s.minutes * 10 ** (s.dba / 10)) / total }))
    .sort((a, b) => b.share - a.share);
}
