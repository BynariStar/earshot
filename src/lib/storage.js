// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Everything stays on this device (browser localStorage). Nothing is sent anywhere.
const KEY = 'earshot.v1';

const empty = () => ({ profile: null, tests: [], context: [] });

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...empty(), ...JSON.parse(raw) } : empty();
  } catch {
    return empty();
  }
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable (private windows); the app still works for this session.
  }
}

export function clearAll() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

// Baselines are the first two complete tests marked as baseline; the reference is their average.
export function baselineTests(state) {
  return state.tests.filter((t) => t.role === 'baseline' && t.complete);
}

export function latestCheck(state) {
  const checks = state.tests.filter((t) => t.role !== 'baseline' && t.complete);
  return checks[checks.length - 1] ?? null;
}
