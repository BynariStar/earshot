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

export function buildAlerts({ station, data, events, plan, planFlags, hearing, quick }) {
  const st = STATIONS[station];
  const out = [];
  const check = latestCheck(data);
  const sudden = check?.confirmedFindings?.find((f) => f.kind === 'sudden');
  if (sudden) {
    out.push({ id: 'sudden', level: 'urgent', title: `Sudden drop in your ${sudden.ear} ear`, body: 'Time-sensitive. Tell your crew medical officer now and open the response: onset, hum test, summary for the flight surgeon.', actions: [{ label: 'Open the response', to: 'ears/sudden' }] });
  }

  const lastQuick = quick?.[0];
  const fault = events.find((e) => e.type === 'fan-fault');
  const ringing = events.find((e) => e.type === 'ringing');
  const loud = events.find((e) => e.type === 'loud');
  const live = events.find((e) => e.type === 'live');

  if (ringing) {
    const done = lastQuick && lastQuick.at > ringing.at;
    if (!done) out.push({ id: 'ringing', level: 'urgent', title: `Ringing in your ${ringing.ear ?? 'right'} ear`, body: 'Take a 2-minute check now, before anything else: 1 to 4 kHz, both ears.', actions: [{ label: 'Quick check now', to: 'quick/ringing' }] });
  }

  if (fault) {
    const sig = SIGNATURES.find((s) => s.id === FAULT_SIGNATURE);
    out.push({
      id: 'fault',
      level: 'warn',
      title: `${st.faultName} is louder than normal: +${FAULT_RISE_DB} dB at ${sig.bands.map(bandLabel).join(' and ')} (+${faultDelta(st.faultModule).toFixed(1)} dBA overall)`,
      body: `Likely source: ${sig.name.toLowerCase()}. ${sig.basis} Wear earplugs while you're there. A noise-only report went to the ground.`,
      actions: [{ label: 'Show on the map', to: `home/${st.faultModule}` }, ...(events.some((e) => e.type === 'was-there') ? [] : [{ label: 'I was in there', event: { type: 'was-there' } }]), { label: 'Plan around it', to: 'plan' }],
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
        title: loud ? 'Loud exposure today: treadmill without earplugs' : exposure === live ? `You were in ${live.where} during ${live.during}` : `You spent time in ${st.faultName} during the fault`,
        body: `Take a 2-minute check tonight at ${pitches.map(bandLabel).join(', ')}: the pitches that noise reaches. A change right after noise can be temporary, so Earshot rechecks tomorrow.`,
        actions: [{ label: 'Quick check', to: `quick/${exposure.type}` }],
      });
    }
  }

  if (lastQuick) {
    if (lastQuick.worst >= 30) out.push({ id: 'q30', level: 'urgent', title: `Quick check: ${lastQuick.worst} dB drop at ${bandLabel(lastQuick.worstAt)}`, body: 'Possible sudden drop. Run the full check now to confirm.', actions: [{ label: 'Full check now', to: 'test/check' }] });
    else if (lastQuick.worst >= 10) out.push({ id: 'q10', level: 'warn', title: `Quick check: ${lastQuick.worst} dB worse at ${bandLabel(lastQuick.worstAt)}`, body: 'Often temporary after loud noise. Protect your ears today, keep tonight quiet, and recheck tomorrow; if it stays, Earshot runs the full check.', actions: [{ label: 'See my ears', to: 'ears' }] });
    else out.push({ id: 'q0', level: 'ok', title: 'Quick check: no change', body: `Within ${lastQuick.worst} dB of your baseline at the pitches tested.`, actions: [] });
  }

  if (planFlags?.length) {
    out.push({ id: 'flags', level: 'info', title: `Today's plan: earplugs for ${planFlags.map((f) => f.name).join(', ')}`, body: 'Flagged automatically from NASA’s rules and your own hearing checks.', actions: [{ label: 'Plan my day', to: 'plan' }] });
  }
  if (hearing?.state === 'high') out.push({ id: 'targets', level: 'info', title: 'Stricter noise targets are on for your ears', body: 'Your last check shows a small change at the pitches noise affects.', actions: [{ label: 'See my ears', to: 'ears' }] });
  if (baselineTests(data).length < 2) out.push({ id: 'baseline', level: 'info', title: 'Set your baseline', body: 'Two short tests on your own headphones; everything else builds on them.', actions: [{ label: 'Start', to: 'test/baseline' }] });

  const order = { urgent: 0, warn: 1, info: 2, ok: 3 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}
