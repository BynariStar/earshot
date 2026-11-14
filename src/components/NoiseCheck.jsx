// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
import { useEffect, useRef, useState } from 'react';

// Background-noise check with the device microphone. Browser processing (echo cancellation,
// noise suppression, automatic gain) is switched off so the level isn't "cleaned up".
// The microphone is not calibrated, so levels are relative (dB below digital full scale).
// The limits are deliberately strict: low pitches (250-500 Hz) are the easiest to mask.
export const LIMITS = { overall: -50, low: -55 }; // dBFS

function bandLevel(freqData, sampleRate, fftSize, lo, hi) {
  const binHz = sampleRate / fftSize;
  let energy = 0;
  for (let i = Math.floor(lo / binHz); i <= Math.ceil(hi / binHz) && i < freqData.length; i++) {
    energy += 10 ** (freqData[i] / 10);
  }
  return 10 * Math.log10(energy || 1e-12);
}

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
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      src.connect(analyser);
      const time = new Float32Array(analyser.fftSize);
      const freq = new Float32Array(analyser.frequencyBinCount);
      const samples = [];
      const started = performance.now();
      stopRef.current = () => {
        stream.getTracks().forEach((t) => t.stop());
        ctx.close();
      };
      await new Promise((resolve) => {
        const tick = () => {
          analyser.getFloatTimeDomainData(time);
          analyser.getFloatFrequencyData(freq);
          const rms = Math.sqrt(time.reduce((s, x) => s + x * x, 0) / time.length);
          samples.push({
            overall: 20 * Math.log10(rms || 1e-9),
            low: bandLevel(freq, ctx.sampleRate, analyser.fftSize, 177, 707) - 10 * Math.log10(analyser.fftSize / 2),
          });
          if (performance.now() - started < 3000) requestAnimationFrame(tick);
          else resolve();
        };
        tick();
      });
      stopRef.current();
      const avg = (k) => 10 * Math.log10(samples.reduce((s, x) => s + 10 ** (x[k] / 10), 0) / samples.length);
      const result = { overall: avg('overall'), low: avg('low') };
      result.pass = result.overall <= LIMITS.overall && result.low <= LIMITS.low;
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
      {state === 'denied' && <p className="warn">Microphone not available. You can still test, but the result will be marked "noise not checked".</p>}
      {state === 'done' && levels && (
        <p className={levels.pass ? 'good' : 'warn'}>
          {levels.pass
            ? 'Quiet enough to test.'
            : 'Too noisy for a reliable test, especially at low pitches. Move somewhere quieter or close the door, then check again.'}{' '}
          <span className="muted">
            (overall {levels.overall.toFixed(0)} dBFS, low pitches {levels.low.toFixed(0)} dBFS; uncalibrated microphone)
          </span>
        </p>
      )}
      {state === 'done' && !levels?.pass && (
        <button className="link-button" onClick={measure}>
          Check again
        </button>
      )}
    </div>
  );
}
