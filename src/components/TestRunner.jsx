// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
import { useEffect, useRef, useState } from 'react';
import { createSearch, respond } from '../lib/threshold.js';
import { playTone, unlockAudio } from '../lib/audio.js';
import { TEST_ORDER } from '../lib/testOrder.js';

const RESPONSE_WINDOW_MS = 2000; // from tone start
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randomGap = () => 1200 + Math.random() * 1800;
const fmt = (f) => (f >= 1000 ? `${f / 1000} kHz` : `${f} Hz`);

export default function TestRunner({ ears = ['right', 'left'], frequencies = TEST_ORDER, onComplete, onCancel }) {
  const [view, setView] = useState({ ear: ears[0], frequency: frequencies[0], step: 0, tone: 0, playing: false, flash: false, ask: null });
  const pressRef = useRef(null); // timestamp of the latest press
  const cancelled = useRef(false);
  const answerRef = useRef(null); // resolves the "skip this ear?" question
  const total = ears.length * frequencies.length;

  useEffect(() => {
    cancelled.current = false;
    const onKey = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        press();
      }
    };
    window.addEventListener('keydown', onKey);
    run();
    return () => {
      cancelled.current = true;
      answerRef.current?.(false);
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function press() {
    pressRef.current = performance.now();
    setView((v) => ({ ...v, flash: true }));
    setTimeout(() => setView((v) => ({ ...v, flash: false })), 150);
  }

  async function run() {
    await unlockAudio();
    const thresholds = { left: {}, right: {} };
    const outcomes = { left: {}, right: {} };
    let falseAlarms = 0;
    let presentations = 0;
    let step = 0;
    for (const ear of ears) {
      let skipEar = false;
      for (const [i, frequency] of frequencies.entries()) {
        if (cancelled.current) return;
        if (skipEar) {
          thresholds[ear][frequency] = null;
          outcomes[ear][frequency] = 'skipped';
          step++;
          continue;
        }
        setView((v) => ({ ...v, ear, frequency, step, tone: 0, playing: false, ask: null }));
        let s = createSearch(frequency, ear);
        while (!s.done) {
          if (cancelled.current) return;
          // Silent gap: a press here is a false alarm.
          const gapStart = performance.now();
          await sleep(randomGap());
          if (pressRef.current && pressRef.current > gapStart) falseAlarms++;
          const toneStart = performance.now();
          setView((v) => ({ ...v, playing: true }));
          const toneDone = playTone({ frequency, ear, level: s.level });
          await sleep(RESPONSE_WINDOW_MS);
          await toneDone;
          // The counter moves only after the response window closes, so the screen never hints that a tone is playing.
          setView((v) => ({ ...v, playing: false, tone: v.tone + 1 }));
          const heard = pressRef.current !== null && pressRef.current >= toneStart;
          presentations++;
          s = respond(s, heard);
        }
        thresholds[ear][frequency] = s.threshold;
        outcomes[ear][frequency] = s.outcome;
        step++;
        // Nothing heard at the first pitch of an ear, even at the loudest allowed level: offer to skip the
        // rest of this ear instead of playing silence-to-the-listener for several more minutes.
        if (i === 0 && s.outcome === 'no-response' && frequencies.length > 1) {
          setView((v) => ({ ...v, step, ask: { ear, frequency } }));
          skipEar = await new Promise((resolve) => (answerRef.current = resolve));
          answerRef.current = null;
        }
      }
    }
    if (!cancelled.current) onComplete({ thresholds, outcomes, falseAlarms, presentations, ears });
  }

  if (view.ask) {
    return (
      <div className="runner">
        <h2>Nothing heard in your {view.ask.ear} ear</h2>
        <p>
          You didn't respond to {fmt(view.ask.frequency)} in your {view.ask.ear} ear, even at the loudest level Earshot allows. That's recorded
          as "no response". If you already know this ear doesn't hear, skip the rest of it; otherwise check that the headphones are plugged in
          and on the right way round, then keep going.
        </p>
        <div className="row-buttons">
          <button className="primary" onClick={() => answerRef.current?.(true)}>Skip the rest of this ear</button>
          <button className="secondary" onClick={() => answerRef.current?.(false)}>Keep testing this ear</button>
        </div>
        <button className="link-button" onClick={() => { cancelled.current = true; answerRef.current?.(false); onCancel(); }}>
          Stop test
        </button>
      </div>
    );
  }

  return (
    <div className="runner">
      <p className="runner-ear">
        Testing your <strong>{view.ear}</strong> ear · {fmt(view.frequency)}
      </p>
      <div className="progress" aria-label="progress">
        <div style={{ width: `${(view.step / total) * 100}%` }} />
      </div>
      <p className="muted runner-count">
        Pitch {Math.min(view.step + 1, total)} of {total} · {view.tone} tone{view.tone === 1 ? '' : 's'} so far
      </p>
      <button className={`heard-button${view.flash ? ' flash' : ''}`} onClick={press}>
        I heard it
        <span>or press the space bar</span>
      </button>
      <p className="hint">
        Press each time you hear beeps, however faint. Some are very quiet on purpose. Don't guess during silence.
      </p>
      <button className="link-button" onClick={() => { cancelled.current = true; onCancel(); }}>
        Stop test
      </button>
    </div>
  );
}
