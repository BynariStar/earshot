// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Which station you're on, who you are (your own baseline or a simulated crew member), and today's
// demo events. Simulated crew data is kept apart from your own results so switching never overwrites them.
const KEY = 'earshot.session.v1';
const SIM_KEY = (id) => `earshot.sim.${id}.v1`;

export const STATIONS = {
  iss: { id: 'iss', name: 'International Space Station', short: 'ISS', faultModule: 'node2', faultName: 'Node 2 (Harmony)' },
  moon: { id: 'moon', name: 'Moon base', short: 'Moon base', faultModule: 'm_work', faultName: 'Level 3 · Medical, computers, air revitalization' },
  mars: { id: 'mars', name: 'Mars base', short: 'Mars base', faultModule: 'r_work', faultName: 'Workstations' },
};

export function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}
export function saveSession(s) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}
export function loadSim(id) {
  try {
    return JSON.parse(localStorage.getItem(SIM_KEY(id)) || 'null');
  } catch {
    return null;
  }
}
export function saveSim(id, data) {
  try {
    localStorage.setItem(SIM_KEY(id), JSON.stringify(data));
  } catch {
    /* storage unavailable */
  }
}
export function clearSim(id) {
  try {
    localStorage.removeItem(SIM_KEY(id));
  } catch {
    /* storage unavailable */
  }
}
