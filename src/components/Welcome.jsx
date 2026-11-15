// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Start screen: where you are, and who you are (your own baseline, or a simulated crew member).
import { useState } from 'react';
import { STATIONS } from '../lib/session.js';
import { PERSONAS, CONDITIONS, ageOffsetDb } from '../lib/personas.js';

const STATION_NOTES = {
  iss: "NASA's measured module levels and spectra (2022–2024).",
  moon: "Simulated: NASA's reference Artemis surface habitat.",
  mars: "Simulated: the rooms of NASA's CHAPEA Mars analog.",
};

export default function Welcome({ onStart, initial, onAbout }) {
  const [station, setStation] = useState(initial?.station ?? 'iss');
  const [persona, setPersona] = useState(initial?.persona ?? 'high');
  const [custom, setCustom] = useState(initial?.custom ?? { age: 45, sex: 'female', condition: 'high', ear: 'left' });
  const setC = (patch) => setCustom((c) => ({ ...c, ...patch }));
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
        <button className={`choice own${persona === 'custom' ? ' on' : ''}`} onClick={() => setPersona('custom')}>
          <strong>Build your own</strong>
          <span className="muted small">Choose age, sex and what's happening to their ears.</span>
        </button>
      </div>
      {persona === 'custom' && (
        <div className="custom-form">
          <label>Age <input type="number" min="25" max="65" value={custom.age} onChange={(e) => setC({ age: Math.max(25, Math.min(65, Number(e.target.value) || 25)) })} /></label>
          <label>Sex
            <select value={custom.sex} onChange={(e) => setC({ sex: e.target.value })}>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </label>
          <label>Ears
            <select value={custom.condition} onChange={(e) => setC({ condition: e.target.value })}>
              {CONDITIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          {custom.condition !== 'steady' && (
            <label>Which ear
              <select value={custom.ear} onChange={(e) => setC({ ear: e.target.value })}>
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </label>
          )}
          <p className="muted small">
            Age sets the starting hearing at high pitches from NASA's astronaut hearing-by-age table (LSAH):{' '}
            {Math.round(ageOffsetDb(custom.age, custom.sex))} dB above a {custom.sex} astronaut under 35 at 4 kHz. Approximate: NASA's table covers 6 kHz only.
          </p>
        </div>
      )}

      <div className="welcome-go">
        <button className="primary" onClick={() => onStart({ station, persona, events: [], ...(persona === 'custom' ? { custom } : {}) })}>Start</button>
        
      </div>
      <p className="muted small welcome-foot">
        Research prototype, not a medical device. <button className="link-button inline-link" onClick={onAbout}>Sources and disclosures</button>
      </p>
    </div>
  );
}
