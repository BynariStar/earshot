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
          <button key={s.id} className={`choice station-choice${station === s.id ? ' on' : ''}`} onClick={() => setStation(s.id)}>
            <img src={`./stations/${s.id}.jpg`} alt="" aria-hidden="true" />
            <strong>{s.name}</strong>
            <span className="muted small">{STATION_NOTES[s.id]}</span>
          </button>
        ))}
      </div>

      <h2>Me</h2>
      <div className="choice-grid">
        <button className={`choice own${persona === 'own' ? ' on' : ''}`} onClick={() => setPersona('own')}>
          <strong>Take my own baseline</strong>
          <span className="muted small">Two 8-minute tests on your own wired headphones, in a quiet room. Results stay on this device.</span>
        </button>
      </div>

      <h2>Or choose a simulation</h2>
      <p className="muted small section-note">Built from NASA's published hearing statistics. Not real people.</p>
      <div className="choice-grid">
        {PERSONAS.map((p) => (
          <button key={p.id} className={`choice${persona === p.id ? ' on' : ''}`} onClick={() => setPersona(p.id)}>
            <strong>{p.name} · {p.tag}</strong>
            <span className="muted small">{p.story}</span>
          </button>
        ))}
      </div>

      <div className="welcome-go">
        <button className="primary" onClick={() => onStart({ station, persona, events: [] })}>Start</button>
        
      </div>
    </div>
  );
}
