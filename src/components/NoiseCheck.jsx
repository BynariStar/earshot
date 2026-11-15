// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
import { useEffect, useRef, useState } from 'react';
import { NOISE_LIMITS } from '../lib/micnoise.js';

// Background-noise check with the device microphone. Browser processing (echo cancellation,
// noise suppression, automatic gain) is switched off so the level isn't "cleaned up"; if the browser
// keeps any of it on anyway, we say so, because it makes the room read quieter than it is.
// The microphone is not calibrated, so levels are relative (dB below digital full scale, dBFS).
//
// Two readings, both as RMS of the time signal:
// - overall: the whole microphone signal;
// - low pitches: the signal through a 177-707 Hz band-pass (the octave bands around 250 and 500 Hz),
//   because low pitches are the easiest to mask. (An earlier FFT-based version under-read this band
//   by about 42 dB, so it never failed; checked with a fake microphone playing a known 300 Hz hum.)
const MEASURE_MS = 3000;

const rmsDb = (buf) => 20 * Math.log10(Math.sqrt(buf.reduce((s, x) => s + x * x, 0) / buf.length) || 1e-9);
const powerMean = (dbs) => 10 * Math.log10(dbs.reduce((s, d) => s + 10 ** (d / 10), 0) / dbs.length);

export default function NoiseCheck({ onResult }) {
  const [state, setState] = useState('idle'); // idle | measuring | done | denied
  const [levels, setLevels] = useState(null);
  const stopRef = useRef(null);

  useEffect(() => () => stopRef.current?.(), []);

  async function measure() {
    setState('measuring');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const settings = stream.getAudioTracks()[0]?.getSettings?.() ?? {};
      const processingOn = ['echoCancellation', 'noiseSuppression', 'autoGainControl'].filter((k) => settings[k] === true);
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaStreamSource(stream);
      const all = ctx.createAnalyser();
      all.fftSize = 2048;
      src.connect(all);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 177;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 707;
      const low = ctx.createAnalyser();
      low.fftSize = 2048;
      src.connect(hp).connect(lp).connect(low);
      const bufAll = new Float32Array(all.fftSize);
      const bufLow = new Float32Array(low.fftSize);
      const samples = [];
      const started = performance.now();
      stopRef.current = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (ctx.state !== 'closed') ctx.close().catch(() => {});
        stopRef.current = null;
      };
      await new Promise((resolve) => {
        const tick = () => {
          all.getFloatTimeDomainData(bufAll);
          low.getFloatTimeDomainData(bufLow);
          // Skip the first 300 ms while the filters settle.
          if (performance.now() - started > 300) samples.push({ overall: rmsDb(bufAll), low: rmsDb(bufLow) });
          if (performance.now() - started < MEASURE_MS) requestAnimationFrame(tick);
          else resolve();
        };
        tick();
      });
      stopRef.current();
      const result = {
        overall: powerMean(samples.map((s) => s.overall)),
        low: powerMean(samples.map((s) => s.low)),
        processingOn,
      };
      result.pass = result.overall <= NOISE_LIMITS.overall && result.low <= NOISE_LIMITS.low;
      setLevels(result);
      setState('done');
      onResult(result);
    } catch {
      setState('denied');
      onResult({ pass: false, denied: true });
    }
  }

  return (
    <div className="noise-check">
      {state === 'idle' && (
        <button className="secondary" onClick={measure}>
          Check background noise (3 seconds)
        </button>
      )}
      {state === 'measuring' && <p>Listening… stay quiet for 3 seconds.</p>}
      {state === 'denied' && <p className="warn">Microphone not available, so the noise level is unknown.</p>}
      {state === 'done' && levels && (
        <>
          <p className={levels.pass ? 'good' : 'warn'}>
            {levels.pass
              ? 'Quiet enough to test.'
              : `Too noisy for a reliable test${levels.low > NOISE_LIMITS.low ? ', especially at low pitches' : ''}. Move somewhere quieter or close the door, then check again.`}
          </p>
          <p className="muted">
            Overall {levels.overall.toFixed(0)} dBFS (limit {NOISE_LIMITS.overall}); low pitches {levels.low.toFixed(0)} dBFS (limit{' '}
            {NOISE_LIMITS.low}). Uncalibrated microphone; limits are provisional.
          </p>
          {levels.processingOn.length > 0 && (
            <p className="warn">
              Your browser kept {levels.processingOn.join(' and ')} switched on, so the room may read quieter than it really is.
            </p>
          )}
        </>
      )}
      {(state === 'done' || state === 'denied') && (
        <button className="link-button" onClick={measure}>
          Check again
        </button>
      )}
    </div>
  );
}
