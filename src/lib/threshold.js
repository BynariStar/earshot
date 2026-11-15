// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Threshold search: a simplified modified Hughson-Westlake procedure ("down 10, up 5"),
// the standard manual audiometry method. Familiarization follows ASHA's manual audiometry guidelines:
// if the first tone isn't heard, jump up 20 dB, then climb in 10 dB steps until a response, so an ear
// that hears nothing reaches the output cap in 4 tones instead of 9. Levels are on the app's own scale in dB, where
// 100 = digital full scale; the output cap keeps every tone at or below MAX_LEVEL.
// Thresholds on this scale are only meaningful as change from the same person's baseline
// on the same headphones and volume setting.

export const START_LEVEL = 40;
export const MIN_LEVEL = 0;
export const MAX_LEVEL = 80; // output cap: 20 dB below digital full scale
export const STEP_DOWN = 10;
export const STEP_UP = 5;
export const MAX_PRESENTATIONS = 30;
// Recorded when nothing is heard even at the cap: a lower bound ("at least this bad"), so a change to
// "can't hear it at all" still counts in NASA's averages instead of silently dropping out.
export const NO_RESPONSE_LEVEL = MAX_LEVEL + STEP_UP;
export const FIRST_JUMP = 20;
export const FAMILIARIZE_STEP = 10;

export function createSearch(frequency, ear, startLevel = START_LEVEL) {
  return {
    frequency,
    ear,
    level: startLevel,
    phase: 'familiarize', // descend until the first miss, then ascending runs
    ascending: {}, // level -> { presented, heard } counted on ascending presentations only
    presentations: 0,
    previousResponse: null,
    heardOnce: false,
    done: false,
    threshold: null,
    outcome: null, // 'threshold' | 'no-response' | 'floor' | 'unreliable'
  };
}

const clamp = (x) => Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, x));

// Feed the listener's response to the current tone; returns the next state.
export function respond(state, heard) {
  if (state.done) return state;
  const s = { ...state, ascending: { ...state.ascending }, presentations: state.presentations + 1 };
  const level = s.level;

  if (s.phase === 'search' && s.previousResponse === false) {
    // This presentation came after a miss, so it was on an ascending run.
    const rec = s.ascending[level] ?? { presented: 0, heard: 0 };
    rec.presented += 1;
    if (heard) rec.heard += 1;
    s.ascending[level] = rec;
    if (rec.heard >= 2 && rec.heard * 2 >= rec.presented) {
      return { ...s, done: true, threshold: level, outcome: 'threshold' };
    }
  }

  if (heard) {
    s.heardOnce = true;
    if (level <= MIN_LEVEL) {
      const rec = s.ascending[MIN_LEVEL] ?? { presented: 0, heard: 0 };
      if (s.previousResponse === true || rec.heard >= 1) {
        return { ...s, done: true, threshold: MIN_LEVEL, outcome: 'floor' };
      }
    }
    s.level = clamp(level - STEP_DOWN);
  } else {
    if (level >= MAX_LEVEL) {
      return { ...s, done: true, threshold: NO_RESPONSE_LEVEL, outcome: 'no-response' };
    }
    if (s.phase === 'familiarize' && !s.heardOnce) {
      s.level = clamp(level + (s.presentations === 1 ? FIRST_JUMP : FAMILIARIZE_STEP));
    } else {
      s.phase = 'search';
      s.level = clamp(level + STEP_UP);
    }
  }
  s.previousResponse = heard;
  if (s.presentations >= MAX_PRESENTATIONS) {
    return { ...s, done: true, threshold: null, outcome: 'unreliable' };
  }
  return s;
}

// Run a search against a simulated listener (used in tests and the demo crew).
export function simulate(frequency, ear, trueThreshold, { slope = 2.5, rng = Math.random } = {}) {
  let s = createSearch(frequency, ear);
  while (!s.done) {
    const pHeard = 1 / (1 + Math.exp(-(s.level - trueThreshold) / slope));
    s = respond(s, rng() < pHeard);
  }
  return s;
}
