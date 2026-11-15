// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Pass limits for the microphone noise check, in dBFS (uncalibrated: dB below the microphone's full scale).
// PROVISIONAL. A laptop microphone's sensitivity and the operating system's input gain vary by device,
// so these must be set from real readings: measure a quiet room and a noisy hall on the demo device and
// put the limits between the two. The earlier -50 dBFS overall limit was far too loose (roughly a loud
// room on a typical laptop microphone, by our estimate).
export const NOISE_LIMITS = { overall: -60, low: -65 };
