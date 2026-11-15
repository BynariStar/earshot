// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// A SCHEMATIC layout of the ISS pressurized modules for the 3D view: which module docks to which, with
// rough sizes in metres. Not to scale in detail. Coordinates (three.js): x = forward, y = up (zenith),
// z = starboard. Module ids match src/data/iss_modules.json; modules without an id there have no dBA value.
//
// Docking layout (public ISS configuration): Unity (Node 1) at the centre; Destiny forward of it, then
// Harmony (Node 2) with Columbus to starboard and Kibo to port (Kibo's logistics module on top);
// Tranquility (Node 3) to port of Unity with the Cupola below and the PMM forward; the Quest airlock to
// starboard of Unity; Zarya aft of Unity, then Zvezda; Poisk on top of Zvezda, Nauka below it with
// Prichal below Nauka; Rassvet below Zarya.

export const ISS_PARTS = [
  { id: 'node1', label: 'Node 1 (Unity)', axis: 'x', pos: [0, 0, 0], len: 5.5, r: 2.2 },
  { id: 'lab', label: 'U.S. Lab (Destiny)', axis: 'x', pos: [7, 0, 0], len: 8.5, r: 2.2 },
  { id: 'node2', label: 'Node 2 (Harmony)', axis: 'x', pos: [14.9, 0, 0], len: 7.2, r: 2.2 },
  { id: 'cof', label: 'Columbus (ESA)', axis: 'z', pos: [14.9, 0, 5.7], len: 7, r: 2.2 },
  { id: 'jem', label: 'Kibo (JAXA)', axis: 'z', pos: [14.9, 0, -7.8], len: 11.2, r: 2.2 },
  { id: 'jlp', label: 'Kibo Logistics Module', axis: 'y', pos: [14.9, 4.3, -7.8], len: 4.2, r: 2.1 },
  { id: 'node3', label: 'Node 3 (Tranquility)', axis: 'z', pos: [0, 0, -5.7], len: 7, r: 2.2 },
  { id: 'cupola', label: 'Cupola', axis: 'y', pos: [0, -3.0, -5.7], len: 1.6, r: 1.5, rTop: 1.0 },
  { id: 'pmm', label: 'Permanent Multipurpose Module', axis: 'x', pos: [5.5, 0, -5.7], len: 6.6, r: 2.2 },
  { id: 'airlock', label: 'Quest airlock', axis: 'z', pos: [0, 0, 5.0], len: 5.5, r: 2.0 },
  { id: 'pma1', label: 'Pressurized Mating Adapter 1', axis: 'x', pos: [-3.6, 0, 0], len: 1.8, r: 1.4, struct: true },
  { id: 'fgb', label: 'FGB (Zarya)', axis: 'x', pos: [-11.0, 0, 0], len: 12.6, r: 2.05 },
  { id: 'sm', label: 'Service Module (Zvezda)', axis: 'x', pos: [-23.9, 0, 0], len: 13.1, r: 2.1 },
  { id: 'mrm2', label: 'MRM2 (Poisk)', axis: 'y', pos: [-19, 4.1, 0], len: 4.0, r: 1.3 },
  { id: 'mrm1', label: 'MRM1 (Rassvet)', axis: 'y', pos: [-11, -5.05, 0], len: 6.0, r: 1.2 },
  { id: 'mlm', label: 'Multipurpose Laboratory Module (Nauka)', axis: 'y', pos: [-19, -8.6, 0], len: 13, r: 2.1 },
  { id: 'nm', label: 'Node Module (Prichal)', sphere: true, pos: [-19, -16.8, 0], r: 1.65 },
];

// Sleep stations sit inside these modules (ids from iss_modules.json).
export const SLEEP_IN = {
  node2: ['cq_stbd', 'cq_port', 'cq_zenith', 'cq_nadir'],
  cof: ['casa'],
  sm: ['kayuta_sm_stbd', 'kayuta_sm_port'],
  mlm: ['kayuta_mlm'],
};

// Where the T2 treadmill is (Node 3), for the simulated day.
export const T2_MODULE = 'node3';

// Colour bins anchored to NASA levels: 50 dBA sleep target, 60 dBA where the flight rule starts
// recommending protection (for a workday average), 65+ the loudest ISS modules.
export const NOISE_BINS = [
  { max: 50, color: '#3ccf8e', label: '≤ 50 dBA (sleep target)' },
  { max: 60, color: '#f2c94c', label: '50–60 dBA' },
  { max: 65, color: '#f2994a', label: '60–65 dBA' },
  { max: Infinity, color: '#eb5757', label: '65+ dBA' },
];
export const NO_DATA_COLOR = '#6b7088';

export function noiseColor(dba) {
  if (!Number.isFinite(dba)) return NO_DATA_COLOR;
  return NOISE_BINS.find((b) => dba <= b.max).color;
}
