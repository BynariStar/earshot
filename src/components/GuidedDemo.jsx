// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// The guided demo: about a minute, on rails. A visible cursor moves to each control and clicks it for real,
// so what's shown is the app itself; a caption says what's happening. Space pauses, → skips ahead, Esc exits.
// It steers only the simulation (the live feed's clock and the time of day), through 'earshot-demo' events.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { startGuidedDemo, FLAG } from '../lib/guided.js';
const ABORT = new Error('guided demo stopped');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const send = (detail) => window.dispatchEvent(new CustomEvent('earshot-demo', { detail }));

const SCRIPT = [
  async (d) => {
    d.say("Earshot checks astronauts' hearing and the noise around them. Crew member B: 60 days into an ISS mission (simulated).");
    await d.wait(2500);
    await d.tap('.station-choice', 'International Space Station');
    await d.tap('.choice', 'Crew member B');
    await d.tap('button.primary', 'Start');
    await d.wait(1200);
  },
  async (d) => {
    send({ type: 'live-at', s: 8 });
    d.say('A ventilation fan stalls in Harmony, where B is working. Earshot tells B what to wear there.');
    const btn = await d.find('.alert-page button.primary', 'Show the source', 12000);
    await d.wait(3000);
    await d.tap(btn);
    send({ type: 'pause' });
    d.say("It matched the noise to a NASA fault signature: the likely source, its spectrum, and the right protection for it.");
    await d.wait(5500);
  },
  async (d) => {
    d.say('Columbus has been getting louder for 5 days: an early warning, before a fan fails.');
    await d.tap('.callout.trend');
    await d.wait(5000);
  },
  async (d) => {
    send({ type: 'clock', min: 17 * 60 + 45 });
    d.say("15 minutes before a loud slot on B's schedule, Earshot reminds them.");
    const btn = await d.find('.alert-page button.primary', 'See today', 8000);
    await d.wait(3000);
    await d.tap(btn);
    d.say("Today: protection matched to each place's noise, and B's weakest pitch, 4 kHz, protected first.");
    await d.wait(6000);
  },
  async (d) => {
    d.say('After the loud exposure, Earshot asks for a 2-minute check of the pitches that noise reaches.');
    await d.tap('.tab', 'Alerts');
    await d.wait(1200);
    await d.tap('.alert-row button', 'Quick check');
    await d.wait(800);
    await d.tap('.scenarios .row', 'No change');
    await d.tap('button.primary', 'Simulate');
    d.say('No lasting change: every pitch within a few dB of baseline.');
    await d.wait(3000);
  },
  async (d) => {
    d.say("My ears: each ear against B's own baseline, using NASA's definition of a hearing shift.");
    await d.tap('button', 'Back to my ears');
    await d.wait(3000);
    await d.tap('.normal-btn');
    d.say("Is this normal? Checked against NASA's astronaut data and the Canadian Space Agency's PRET data.");
    await d.wait(6000);
  },
  async (d) => {
    await d.tap('.sheet-x');
    d.say('Earshot: proactive hearing protection for astronauts, built on NASA data.');
    await d.wait(4000);
  },
];

export default function GuidedDemo() {
  const [on, setOn] = useState(false);
  const [caption, setCaption] = useState('');
  const [paused, setPaused] = useState(false);
  const [step, setStep] = useState(0);
  const [cursor, setCursor] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2, click: false });
  const ctl = useRef({ paused: false, skip: false, abort: false });

  useEffect(() => {
    let flagged = false;
    try {
      flagged = sessionStorage.getItem(FLAG) === '1';
      sessionStorage.removeItem(FLAG);
    } catch {
      /* storage unavailable */
    }
    // ?demo in the address starts it too (for recording).
    if (!flagged && /[?&]demo\b/.test(window.location.search)) {
      window.history.replaceState(null, '', window.location.pathname + window.location.hash);
      startGuidedDemo();
      return;
    }
    if (flagged) setOn(true);
  }, []);

  useEffect(() => {
    if (!on) return undefined;
    const c = ctl.current;
    c.abort = false;
    const wait = async (ms) => {
      let t = 0;
      while (t < ms) {
        if (c.abort) throw ABORT;
        if (c.skip) { c.skip = false; return; }
        await sleep(100);
        if (!c.paused) t += 100;
      }
    };
    const match = (el, text) => !text || (el.innerText || el.getAttribute('aria-label') || '').includes(text);
    const find = async (sel, text, timeout = 8000) => {
      for (let t = 0; t < timeout; t += 150) {
        if (c.abort) throw ABORT;
        const el = [...document.querySelectorAll(sel)].find((e) => match(e, text) && e.getClientRects().length);
        if (el) return el;
        await sleep(150);
      }
      throw new Error(`guided demo: no ${sel} ${text ?? ''}`);
    };
    const tap = async (target, text) => {
      const el = typeof target === 'string' ? await find(target, text) : target;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      await sleep(350);
      const r = el.getBoundingClientRect();
      setCursor({ x: r.left + r.width / 2, y: r.top + r.height / 2, click: false });
      await wait(800);
      setCursor((p) => ({ ...p, click: true }));
      await sleep(180);
      el.click();
      await sleep(320);
      setCursor((p) => ({ ...p, click: false }));
      await wait(400);
    };
    const d = { wait, find, tap, say: setCaption };
    (async () => {
      try {
        for (let i = 0; i < SCRIPT.length; i++) {
          setStep(i + 1);
          await SCRIPT[i](d);
        }
      } catch (e) {
        if (e !== ABORT) console.warn(e);
      }
      send({ type: 'clock', min: null });
      setOn(false);
    })();
    const onKey = (e) => {
      if (e.key === ' ') { e.preventDefault(); e.stopPropagation(); c.paused = !c.paused; setPaused(c.paused); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); c.skip = true; }
      else if (e.key === 'Escape') { c.abort = true; }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      c.abort = true;
      window.removeEventListener('keydown', onKey, true);
    };
  }, [on]);

  if (!on) return null;
  const c = ctl.current;
  return createPortal(
    <>
      <div className={`demo-cursor${cursor.click ? ' click' : ''}`} style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }} aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 24 24"><path d="M4 2l16 10-7 1.5L10 21z" fill="#fff" stroke="#111" strokeWidth="1.5" strokeLinejoin="round" /></svg>
        <span className="demo-ripple" />
      </div>
      <div className="demo-caption" role="status" aria-live="polite">
        <span className="demo-step">{step}/{SCRIPT.length}</span>
        <p>{caption}</p>
        <div className="demo-ctl">
          <button onClick={() => { c.paused = !c.paused; setPaused(c.paused); }} aria-label={paused ? 'Play' : 'Pause'}>{paused ? '▶' : '❚❚'}</button>
          <button onClick={() => { c.skip = true; }} aria-label="Skip ahead">›</button>
          <button onClick={() => { c.abort = true; }} aria-label="Exit the demo">×</button>
        </div>
      </div>
    </>,
    document.body
  );
}
