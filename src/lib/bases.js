// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// SIMULATED Moon and Mars bases. None of these habitats exists or has measured noise data, so every level
// here is derived and labelled as such:
//
// 1. "Built to NASA limits": NASA-STD-3001 Vol. 2, Table 6.6-3 octave-band limits, NC-50 in work areas and
//    NC-40 in sleep areas on missions over 30 days (NC-50 for 30 days or less, Table 6.6-2). We convert each
//    curve to one dBA number by A-weighting every octave band and summing: the level if every band sat at its
//    limit, i.e. the most a compliant room could be. Exercise: Table 6.6-4 intermittent limit for 1 hour (65 dBA).
// 2. "ISS-like": each area takes NASA's measured level for the ISS module that holds the same equipment
//    (Allen 2024; Node 1 and the treadmill from NASA's NEET worked example, Allen & Danielson 2020).
// 3. Cabin pressure (exploration atmosphere): see pressureDelta() below.
//
// Layouts:
// - Moon: NASA's reference internal layout of the Artemis Surface Habitat (Burke & Howard, ASCEND 2022):
//   three levels (metallic base with suitport airlock; two inflatable decks), crew of 2, 30-day missions,
//   able to run at 8.2 psia / 34% O2 or 10.2 psia / 26.5% O2.
// - Mars: the room list and privacy-gradient order of NASA's CHAPEA analog habitat, Mars Dune Alpha
//   (four crew quarters at one end, shared living in the middle, work, medical and food growing at the
//   other end, bathrooms near the quarters and near the airlock). Schematic, not its floor plan.

const A_WEIGHT = [-26.2, -16.1, -8.6, -3.2, 0, 1.2, 1.0, -1.1, -6.6]; // 63 Hz ... 16 kHz octave bands (IEC 61672)
const NC50 = [71, 64, 58, 54, 51, 49, 48, 47, 46]; // NASA-STD-3001 Vol 2 Table 6.6-3, work areas
const NC40 = [64, 56, 50, 44, 41, 39, 38, 37, 36]; // sleep areas

export function curveToDba(bands) {
  return 10 * Math.log10(bands.reduce((s, L, i) => s + 10 ** ((L + A_WEIGHT[i]) / 10), 0));
}
export const SPEC_WORK_DBA = curveToDba(NC50);
export const SPEC_SLEEP_DBA = curveToDba(NC40);
export const SPEC_EXERCISE_1H_DBA = 65; // Table 6.6-4: hardware running 1 h a day, at 0.6 m

// ISS reference levels (dBA) for the "ISS-like" mapping.
const ISS_REF = {
  node3: { dba: 55.9, why: 'Node 3 (Tranquility), which holds the ISS toilet, water recovery, oxygen generation and exercise equipment' },
  cq: { dba: 51.3, why: 'the four US crew quarters in Node 2 (average of 51.6, 51.5, 53.5 and 48.5 dBA)' },
  node1: { dba: 60.2, why: "Node 1 (Unity), where the US galley and dining table are (NASA's NEET example)" },
  lab: { dba: 60.0, why: 'the US Lab (Destiny), with workstations, research racks and CO₂ removal' },
  cof: { dba: 56.8, why: 'Columbus, a research module' },
  t2: { dba: 84.5, why: "the ISS T2 treadmill at the runner's head (NASA's NEET example)" },
};

// --- Cabin pressure -----------------------------------------------------------------------------------
// Our first-order estimate from textbook relations, labelled as such in the app:
// - Fan sound power: L_W changes by 50·log10(N2/N1) + 20·log10(ρ2/ρ1) (the fan laws for sound power).
// - Room sound pressure for the same sound power: intensity I = p²/(ρc), so L_p shifts by 10·log10(ρ2c2/ρ1c1).
// - Speed of sound depends on temperature and gas, not pressure; with more O₂ the gas is slightly heavier.
// Two bounding cases: fans kept at the same speed (less air mass moved), or sped up to move the same air
// mass for cooling and CO₂ removal (N ∝ 1/ρ, since volume flow ∝ N).
export const ATMOSPHERES = {
  '14.7': { psia: 14.7, o2: 0.21, label: '14.7 psia, 21% O₂ (ISS, sea level)' },
  '10.2': { psia: 10.2, o2: 0.265, label: '10.2 psia, 26.5% O₂' },
  '8.2': { psia: 8.2, o2: 0.34, label: '8.2 psia, 34% O₂ (NASA exploration atmosphere)' },
};
const molarMass = (o2) => o2 * 32.0 + (1 - o2) * 28.01;

export function pressureDelta(atmKey, fans = 'same-speed') {
  const ref = ATMOSPHERES['14.7'];
  const a = ATMOSPHERES[atmKey];
  const rho = (a.psia / ref.psia) * (molarMass(a.o2) / molarMass(ref.o2));
  const c = Math.sqrt(molarMass(ref.o2) / molarMass(a.o2));
  const sameSpeed = 20 * Math.log10(rho) + 10 * Math.log10(rho * c);
  const sameMass = sameSpeed + 50 * Math.log10(1 / rho);
  return { rho, sameSpeed, sameMass, applied: fans === 'same-mass' ? sameMass : sameSpeed };
}

// --- Layouts ------------------------------------------------------------------------------------------
// Parts for the 3D view: sector cylinders (Moon decks) or boxes (Mars rooms). kind: work | sleep | exercise | airlock.
const deg = (d) => (d * Math.PI) / 180;
const sector = (start, len) => [deg(start + 2), deg(len - 4)];

export const BASES = {
  moon: {
    id: 'moon',
    name: 'Moon base',
    subtitle: "NASA's reference Artemis Surface Habitat: 3 decks, 2 crew, 30-day stays",
    missionDays: 30,
    defaultAtm: '8.2',
    camera: [16, 12, 18],
    target: [0, 3.6, 0],
    decor: 'moon',
    note: "NASA paused the Gateway lunar station in March 2026 to focus on a surface base; Gateway hardware is being repurposed for it.",
    parts: [
      { id: 'm_airlock', label: 'Level 1 · Suitport airlock', kind: 'airlock', r: 2.2, len: 2.6, pos: [0, 1.3, 0], axis: 'y', theta: sector(0, 180), contains: 'Suitport airlock with two suitports and a cargo suitport', iss: null },
      { id: 'm_workshop', label: 'Level 1 · Workshop and oxygen', kind: 'work', r: 2.2, len: 2.6, pos: [0, 1.3, 0], axis: 'y', theta: sector(180, 180), contains: 'Work bench, geology workstation, EVA computer, two oxygen-generation racks', iss: 'node3' },
      { id: 'm_exercise', label: 'Level 2 · Exercise', kind: 'exercise', r: 3.25, len: 2.5, pos: [0, 3.9, 0], axis: 'y', theta: sector(0, 90), contains: 'One exercise machine (similar to an E4D)', iss: 'node3' },
      { id: 'm_hygiene', label: 'Level 2 · Hygiene', kind: 'work', r: 3.25, len: 2.5, pos: [0, 3.9, 0], axis: 'y', theta: sector(90, 90), contains: 'Private hygiene station and toilet (UWMS)', iss: 'node3' },
      { id: 'm_water', label: 'Level 2 · Water recovery and biology', kind: 'work', r: 3.25, len: 2.5, pos: [0, 3.9, 0], axis: 'y', theta: sector(180, 180), contains: 'Water, urine and brine processors; biology workstation', iss: 'node3' },
      { id: 'm_crew', label: 'Level 3 · Crew quarters', kind: 'sleep', r: 3.25, len: 2.5, pos: [0, 6.5, 0], axis: 'y', theta: sector(0, 120), contains: 'Two private crew quarters side by side (sharing one wall, which the layout paper flags acoustically)', iss: 'cq' },
      { id: 'm_galley', label: 'Level 3 · Galley and wardroom', kind: 'work', r: 3.25, len: 2.5, pos: [0, 6.5, 0], axis: 'y', theta: sector(120, 120), contains: 'Galley and wardroom table', iss: 'node1' },
      { id: 'm_work', label: 'Level 3 · Medical, computers, air revitalization', kind: 'work', r: 3.25, len: 2.5, pos: [0, 6.5, 0], axis: 'y', theta: sector(240, 120), contains: 'Medical station, general computer station, lab workstations; air revitalization racks in the core', iss: 'lab' },
    ],
  },
  mars: {
    id: 'mars',
    name: 'Mars base',
    subtitle: "Rooms of NASA's CHAPEA Mars analog habitat (Mars Dune Alpha): 4 crew, year-long stays",
    missionDays: 365,
    defaultAtm: '8.2',
    camera: [14, 14, 18],
    target: [0, 0.5, 0],
    decor: 'mars',
    note: "NASA's CHAPEA analog runs on Earth's air; a real Mars habitat would likely use a lower-pressure exploration atmosphere for frequent spacewalks.",
    parts: [
      ...[0, 1, 2, 3].map((i) => ({ id: `r_cq${i + 1}`, label: `Crew quarters ${i + 1}`, kind: 'sleep', box: [3.2, 2.6, 2.0], pos: [-7.4, 1.3, -3.3 + i * 2.2], contains: 'Private crew quarters', iss: 'cq' })),
      { id: 'r_bath1', label: 'Bathroom (quarters end)', kind: 'work', box: [2.6, 2.6, 2.6], pos: [-4.4, 1.3, -2.9], contains: 'Toilet and shower', iss: 'node3' },
      { id: 'r_fitness', label: 'Fitness', kind: 'exercise', box: [2.6, 3.2, 4.2], pos: [-4.4, 1.6, 2.1], contains: 'Exercise equipment', iss: 'node3' },
      { id: 'r_lounge', label: 'Lounge', kind: 'work', box: [3.6, 3.6, 8.8], pos: [-1.2, 1.8, 0], contains: 'Common lounge and recreation', iss: 'node1' },
      { id: 'r_galley', label: 'Galley', kind: 'work', box: [2.6, 3.2, 8.8], pos: [2.0, 1.6, 0], contains: 'Kitchen and dining', iss: 'node1' },
      { id: 'r_medical', label: 'Medical', kind: 'work', box: [2.8, 2.8, 4.2], pos: [4.8, 1.4, -2.3], contains: 'Dedicated medical station', iss: 'lab' },
      { id: 'r_work', label: 'Workstations', kind: 'work', box: [2.8, 2.8, 4.4], pos: [4.8, 1.4, 2.2], contains: 'Dedicated workstations and technical work area', iss: 'lab' },
      { id: 'r_farm', label: 'Food growing', kind: 'work', box: [2.4, 3.4, 4.2], pos: [7.4, 1.7, -2.3], contains: 'Vertical farm', iss: 'cof' },
      { id: 'r_bath2', label: 'Bathroom (work end)', kind: 'work', box: [2.4, 2.6, 2.2], pos: [7.4, 1.3, 1.3], contains: 'Toilet near the airlock', iss: 'node3' },
      { id: 'r_airlock', label: 'Airlock', kind: 'airlock', box: [2.4, 2.6, 2.0], pos: [7.4, 1.3, 3.4], contains: 'Airlock to the surface', iss: null },
    ],
  },
};

// Simulated day: exercise sessions and sleep, as for the ISS view.
export const EXERCISE_SESSIONS = [[8 * 60, 9 * 60], [15 * 60, 16 * 60]];
const inRange = (t, [a, b]) => t >= a && t < b;

// Level for one area. basis: 'spec' | 'iss'. Returns { dba, why } (dba null = no value).
export function baseLevel(base, part, { basis, atm, fans, mode, t }) {
  const exercising = mode === 'now' && part.kind === 'exercise' && EXERCISE_SESSIONS.some((r) => inRange(t, r));
  if (basis === 'spec') {
    if (part.kind === 'airlock') return { dba: null, why: 'Airlocks have their own rules; no continuous-noise value applies.' };
    if (exercising) return { dba: SPEC_EXERCISE_1H_DBA, why: "Exercise session: NASA's intermittent-noise limit for hardware running 1 hour a day (Table 6.6-4, at 0.6 m)." };
    if (part.kind === 'sleep') {
      const nc40 = base.missionDays > 30;
      return { dba: nc40 ? SPEC_SLEEP_DBA : SPEC_WORK_DBA, why: nc40 ? 'Sleep area: NC-40 limit (missions over 30 days).' : 'Sleep area on a 30-day mission: NC-50 limit (NC-40 applies only to missions over 30 days).' };
    }
    return { dba: SPEC_WORK_DBA, why: 'Work area: NC-50 limit.' };
  }
  const ref = exercising ? ISS_REF.t2 : part.iss ? ISS_REF[part.iss] : null;
  if (!ref) return { dba: null, why: 'No measured ISS equivalent (NASA publishes no dBA value for the ISS airlock).' };
  const d = pressureDelta(atm, fans).applied;
  return { dba: ref.dba + d, why: `Like ${ref.why}${Math.abs(d) > 0.05 ? `, ${d > 0 ? '+' : ''}${d.toFixed(1)} dB for the cabin pressure` : ''}.` };
}
