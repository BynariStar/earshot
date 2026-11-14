// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Where each test frequency sits along the cochlea.
// Greenwood (1990) place-frequency function for the human cochlea:
//   f = A * (10^(a*x) - k), A = 165.4, a = 2.1, k = 0.88, x = fraction of length measured from the apex.
// Greenwood, D.D. (1990). A cochlear frequency-position function for several species - 29 years later.
// J. Acoust. Soc. Am. 87(6), 2592-2605.

const A = 165.4;
const a = 2.1;
const k = 0.88;

export function fractionFromApex(frequency) {
  return Math.log10(frequency / A + k) / a;
}

export function frequencyAt(fractionFromApexValue) {
  return A * (10 ** (a * fractionFromApexValue) - k);
}

// Spiral geometry: base (high pitches) on the outside, apex (low pitches) at the centre,
// about 2.5 turns as in the human cochlea.
export const TURNS = 2.5;

export function spiralPoint(t, { cx, cy, rOuter, rInner, startAngle = Math.PI, direction = 1 }) {
  // t = 0 at the base (outer end), t = 1 at the apex (centre)
  const theta = startAngle + direction * t * TURNS * 2 * Math.PI;
  const r = rOuter - (rOuter - rInner) * t;
  return { x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) };
}

export function spiralPath(t0, t1, geom, steps = 120) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = t0 + ((t1 - t0) * i) / steps;
    const p = spiralPoint(t, geom);
    pts.push(`${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`);
  }
  return pts.join(' ');
}

// Plain-language description of what each tested pitch region does.
export const REGION_INFO = {
  250: {
    label: '250 Hz',
    hears: 'Low pitches: the hum of fans and pumps, and the deep part of voices.',
    nasa: 'NASA finds low-frequency shifts in 40.4% of in-flight hearing tests, and the cause is still unknown. Leading ideas involve fluid shifts and pressure inside the head, not noise alone.',
  },
  500: {
    label: '500 Hz',
    hears: 'Low-middle pitches: much of the power of vowels in speech.',
    nasa: "Together with 250 Hz, this is NASA's low-frequency rule: an average change of 10 dB or more.",
  },
  1000: {
    label: '1 kHz',
    hears: 'Middle pitches: the core of speech.',
    nasa: 'Tested for a complete picture; not part of either NASA shift rule.',
  },
  2000: {
    label: '2 kHz',
    hears: 'Upper-middle pitches: consonants that make speech clear.',
    nasa: "With 3 and 4 kHz, this is NASA's high-frequency rule: an average change of 10 dB or more.",
  },
  3000: {
    label: '3 kHz',
    hears: 'High pitches: sounds like "s", "f" and "th".',
    nasa: 'Part of the high-frequency rule.',
  },
  4000: {
    label: '4 kHz',
    hears: 'High pitches: where noise damage usually shows first.',
    nasa: 'Noise-induced hearing loss typically starts around 3 to 6 kHz. Russian cosmonaut data show lasting losses here after long missions.',
  },
};
