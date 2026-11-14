// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
import { useEffect, useRef, useState } from 'react';
import { createSearch, respond } from '../lib/threshold.js';
import { playTone, unlockAudio } from '../lib/audio.js';

// Standard audiometry order: start at 1 kHz, go up, then down to the low pitches.
export const TEST_ORDER = [1000, 2000, 3000, 4000, 500, 250];
const RESPONSE_WINDOW_MS = 2000; // from tone start
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randomGap = () => 1200 + Math.random() * 1800;

export default function TestRunner({ ears = ['right', 'left'], frequencies = TEST_ORDER, onComplete, onCancel }) {
  const [view, setView] = useState({ ear: ears[0], frequency: frequencies[0], step: 0, playing: false, flash: false });
  const pressRef = useRef(null); // timestamp of the latest press
  const cancelled = useRef(false);
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
      for (const frequency of frequencies) {
        if (cancelled.current) return;
        setView({ ear, frequency, step, playing: false, flash: false });
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
          setView((v) => ({ ...v, playing: false }));
          const heard = pressRef.current !== null && pressRef.current >= toneStart;
          presentations++;
          s = respond(s, heard);
        }
        thresholds[ear][frequency] = s.threshold;
        outcomes[ear][frequency] = s.outcome;
        step++;
      }
    }
    if (!cancelled.current) onComplete({ thresholds, outcomes, falseAlarms, presentations });
  }

  return (
    <div className="runner">
      <p className="runner-ear">
        Testing your <strong>{view.ear}</strong> ear · {view.frequency >= 1000 ? `${view.frequency / 1000} kHz` : `${view.frequency} Hz`}
      </p>
      <div className="progress" aria-label="progress">
        <div style={{ width: `${(view.step / total) * 100}%` }} />
      </div>
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
