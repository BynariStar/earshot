// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Plain-language meaning and next steps for each finding, with the escalation path
// self-care -> crew medical officer -> flight surgeon on the ground.

const atLeast = (f) => (f.atLeast ? 'at least ' : '');
const freqText = (fs) => fs.map((f) => (f >= 1000 ? `${f / 1000} kHz` : `${f} Hz`)).join(', ');

export function explain(finding) {
  const ear = `${finding.ear} ear`;
  switch (finding.kind) {
    case 'sudden':
      return {
        level: 'urgent',
        title: `Sudden drop in your ${ear}`,
        what: `Your hearing at ${freqText(finding.frequencies)} is ${atLeast(finding)}${Math.round(finding.worst)} dB worse than your baseline, confirmed by a retest. NASA defines a drop of 30 dB or more as sudden hearing loss.`,
        actions: [
          'Tell your crew medical officer now. Sudden hearing loss is time-sensitive: treatment works best when started early.',
          'Open the sudden-drop response: onset time, a 30-second hum test, red-flag questions and a summary for the flight surgeon.',
          'Treatment decisions belong to the flight surgeon on the ground.',
        ],
        escalate: 'crew-medical-officer-now',
      };
    case 'low':
      return {
        level: 'shift',
        title: `Low-pitch shift in your ${ear}`,
        what: `Your 250 and 500 Hz hearing averages ${atLeast(finding)}${finding.averageDb.toFixed(0)} dB worse than your baseline, confirmed by a retest. This matches NASA's low-frequency shift rule. NASA sees it in about 40% of in-flight tests and doesn't yet know the cause; fluid shifts and pressure inside the head are leading ideas.`,
        actions: [
          'Log context: ear fullness, congestion, headache, recent pressure changes.',
          'Retest tomorrow at the same time, in the same quiet place and headphones.',
          'If it is still there on the next check, tell your crew medical officer.',
        ],
        escalate: 'crew-medical-officer-if-persists',
      };
    case 'high':
      return {
        level: 'shift',
        title: `High-pitch shift in your ${ear}`,
        what: `Your 2 to 4 kHz hearing averages ${atLeast(finding)}${finding.averageDb.toFixed(0)} dB worse than your baseline, confirmed by a retest. This matches NASA's high-frequency shift rule, the pattern noise exposure usually causes.`,
        actions: [
          'Wear hearing protection for loud activities today (see the station view for which ones).',
          'Plan quiet time: sleep in a station at or below 50 dBA if you can; 62 dBA or less still counts as hearing rest.',
          'Tell your crew medical officer, and retest within two days.',
        ],
        escalate: 'crew-medical-officer',
      };
    default:
      return null;
  }
}
