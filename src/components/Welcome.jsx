// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Start screen: where you are, and who you are (your own baseline, or a simulated crew member).
import { useState } from 'react';
import { STATIONS } from '../lib/session.js';
import { PERSONAS } from '../lib/personas.js';

const STATION_NOTES = {
  iss: "NASA's measured module levels and spectra (2022–2024).",
  moon: "Simulated: NASA's reference Artemis surface habitat.",
  mars: "Simulated: the rooms of NASA's CHAPEA Mars analog.",
};

export default function Welcome({ onStart, initial }) {
  const [station, setStation] = useState(initial?.station ?? 'iss');
  const [persona, setPersona] = useState(initial?.persona ?? 'high');
  return (
    <div className="welcome">
      <header className="hub-head">
        <img className="brand-mark" src="./favicon.svg" alt="" aria-hidden="true" />
        <div>
          <h1>Earshot</h1>
          <p className="muted">Watches the noise around you, catches hearing changes early, and tells you what to do.</p>
        </div>
      </header>

      <h2>Where are you?</h2>
      <div className="choice-grid three">
        {Object.values(STATIONS).map((s) => (
          <button key={s.id} className={`choice${station === s.id ? ' on' : ''}`} onClick={() => setStation(s.id)}>
            <strong>{s.name}</strong>
            <span className="muted small">{STATION_NOTES[s.id]}</span>
          </button>
        ))}
      </div>

      <h2>Who are you?</h2>
      <div className="choice-grid">
        <button className={`choice own${persona === 'own' ? ' on' : ''}`} onClick={() => setPersona('own')}>
          <strong>Me: take my own baseline</strong>
          <span className="muted small">Real tests on your own wired headphones in a quiet room. Two baseline tests of about 8 minutes, then everything adapts to your ears. Results stay on this device.</span>
        </button>
        {PERSONAS.map((p) => (
          <button key={p.id} className={`choice${persona === p.id ? ' on' : ''}`} onClick={() => setPersona(p.id)}>
            <strong>{p.name} · {p.tag}</strong>
            <span className="muted small">{p.story}</span>
            <span className="badge sim">Simulated</span>
          </button>
        ))}
      </div>

      <div className="welcome-go">
        <button className="primary" onClick={() => onStart({ station, persona, events: [] })}>Start</button>
        <span className="muted small">Simulated crew members are built from NASA's published statistics; they aren't real people. Use the Demo menu inside to trigger events.</span>
      </div>
    </div>
  );
}
