// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// The alert engine: turns the station's state, your hearing record, your plan and today's events into
// notifications with a next action. Active monitoring: noise that is unexpectedly loud, or a loud exposure,
// triggers a targeted quick hearing check instead of waiting for a scheduled one.
import { latestCheck, baselineTests } from './storage.js';
import { STATIONS } from './session.js';
import { SIGNATURES, bandLabel, faultDelta } from './spectrum.js';

export const FAULT_SIGNATURE = 'stalled-fan';
export const FAULT_RISE_DB = 8; // band rise used in the demo fault

// Pitches a quick check should test after an exposure: the bands the noise hit, plus 4 kHz, where noise
// damage usually shows first.
export function quickPitchesFor(event) {
  if (event?.pitches) return event.pitches;
  if (event?.type === 'fan-fault') {
    const sig = SIGNATURES.find((s) => s.id === FAULT_SIGNATURE);
    return [...new Set([...sig.bands.filter((b) => b >= 250 && b <= 4000), 4000])];
  }
  if (event?.type === 'ringing') return [1000, 2000, 3000, 4000];
  return [2000, 3000, 4000]; // loud exposure, e.g. treadmill without earplugs
}

export const SYMPTOMS = { ringing: 'Ringing', muffled: 'Muffled hearing', fullness: 'Ear fullness or pain' };
export const alertKey = (a) => `${a.id}:${a.title}`;
const listJoin = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

// Every alert is listed behind the bell. Only `popup` alerts also open full screen (once): a confirmed sudden
// drop, and noise where you are (wear earplugs, see the source). Requests for a hearing check never pop up.
export function buildAlerts({ station, data, events, plan, quick }) {
  const st = STATIONS[station];
  const out = [];
  const check = latestCheck(data);
  const sudden = check?.confirmedFindings?.find((f) => f.kind === 'sudden');
  if (sudden) {
    out.push({ id: 'sudden', level: 'urgent', popup: true, title: `Sudden drop in your ${sudden.ear} ear`, body: 'Tell your crew medical officer now. Treatment works best when it starts early.', actions: [{ label: 'Open the response', to: 'ears/sudden' }] });
  }

  const lastQuick = quick?.[0];
  const fault = events.find((e) => e.type === 'fan-fault');
  const ringing = events.find((e) => e.type === 'ringing');
  const loud = events.find((e) => e.type === 'loud');
  const live = events.find((e) => e.type === 'live');

  if (ringing) {
    const done = lastQuick && lastQuick.at > ringing.at;
    if (!done) out.push({ id: 'ringing', level: 'urgent', title: `${SYMPTOMS[ringing.symptom ?? 'ringing']} in your ${ringing.ear === 'both' ? 'ears' : `${ringing.ear ?? 'right'} ear`}`, body: 'Check your hearing now: 2 minutes, 1 to 4 kHz, both ears.', actions: [{ label: 'Quick check now', to: 'quick/ringing' }] });
  }

  if (fault) {
    const sig = SIGNATURES.find((s) => s.id === FAULT_SIGNATURE);
    out.push({
      id: 'fault',
      level: 'warn',
      popup: true,
      dismissable: true,
      title: `${st.faultName} is louder than normal`,
      body: `Likely a ${sig.name.toLowerCase()} (+${faultDelta(st.faultModule).toFixed(1)} dBA, louder at ${listJoin(sig.bands.map(bandLabel))}). Wear earplugs there until it's fixed.`,
      actions: [{ label: 'Show on the map', to: `home/${st.faultModule}` }, { label: 'Plan around it', to: 'plan' }],
    });
  }

  // Proactive popup: only "wear earplugs" and where the noise comes from. The hearing check goes to the bell.
  if (live) {
    out.push({
      id: 'live-earplugs',
      level: 'warn',
      popup: true,
      dismissable: true,
      title: `${live.where} got loud: wear earplugs there`,
      body: `${live.cause}. You were in ${live.where} when it started. Wear earplugs there until it's fixed.`,
      actions: live.part ? [{ label: 'Show the source', to: `home/${live.part}` }] : [],
    });
  }

  const wasThere = events.some((e) => e.type === 'was-there') || plan?.placesUsed?.includes(st.faultModule);
  const exposure = loud ?? live ?? (fault && wasThere ? fault : null);
  if (exposure) {
    const done = lastQuick && lastQuick.at > exposure.at;
    if (!done) {
      const pitches = quickPitchesFor(exposure);
      out.push({
        id: 'exposure',
        level: 'warn',
        title: 'Check your hearing tonight',
        body: `${loud ? 'You ran on the treadmill without earplugs.' : exposure === live ? `You were in ${live.where} while it was loud.` : `You were in ${st.faultName} during the fault.`} 2 minutes at ${listJoin(pitches.map(bandLabel))}, the pitches this noise reaches.`,
        actions: [{ label: 'Quick check', to: `quick/${exposure.type}` }],
      });
    }
  }

  if (lastQuick) {
    if (lastQuick.worst >= 30) out.push({ id: 'q30', level: 'urgent', title: `Quick check: ${lastQuick.worst} dB drop at ${bandLabel(lastQuick.worstAt)}`, body: 'This could be a sudden drop. Run the full check now to confirm.', actions: [{ label: 'Full check now', to: 'test/check' }] });
    else if (lastQuick.worst >= 10) out.push({ id: 'q10', level: 'info', dismissable: true, title: `Quick check: ${lastQuick.worst} dB worse at ${bandLabel(lastQuick.worstAt)}`, body: 'Often temporary after noise. Keep tonight quiet; Earshot rechecks tomorrow.', actions: [{ label: 'See my ears', to: 'ears' }] });
    else out.push({ id: 'q0', level: 'info', dismissable: true, title: 'Quick check: no change', body: `Every pitch within ${lastQuick.worst} dB of your baseline.`, actions: [] });
  }

  // Earplug flags and stricter targets are recommendations, shown on Today, not alerts.
  if (baselineTests(data).length < 2) out.push({ id: 'baseline', level: 'info', title: 'Set your baseline', body: 'Two 8-minute tests on your own headphones. Every later check compares against them.', actions: [{ label: 'Start', to: 'test/baseline' }] });

  const order = { urgent: 0, warn: 1, info: 2, ok: 3 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}
