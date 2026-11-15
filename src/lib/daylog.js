// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// End-of-day noise log: what the day actually held, as opposed to the plan. Plans are intentions; NASA's
// crew dosimeters measured real workdays louder than module averages predict (Limardo et al. 2021), so
// learning across crews needs logs. Noise only: no hearing results ever go in here.
const KEY = 'earshot.daylogs.v1';

export const LOUD_EVENTS = ['Meals or conferences got loud', 'Equipment or a fan sounded louder than usual', 'An experiment was noisy', 'Alarm or impulse noise'];

export function loadLogs() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveLogs(logs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(logs));
  } catch {
    /* storage unavailable */
  }
}

// The noise-only record a crew member could choose to share with the ground (never hearing data).
export function shareable(logs) {
  return logs.map(({ date, activities, earplugs, background, sleepAt, events }) => ({ date: date.slice(0, 10), activities, earplugs, background, sleepAt, events }));
}
