// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Start screen: where you are, and who you are (your own baseline, or a simulated crew member).
import { useState } from 'react';
import { STATIONS } from '../lib/session.js';
import { PERSONAS, CONDITIONS, ageOffsetDb } from '../lib/personas.js';
import Stepper from './Stepper.jsx';

const STATION_NOTES = {
  iss: "NASA's measured module levels and spectra (2022–2024).",
  moon: "Simulated: NASA's reference Artemis surface habitat.",
  mars: "Simulated: the rooms of NASA's CHAPEA Mars analog.",
};

export default function Welcome({ onStart, initial, onAbout, onExplore }) {
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

      <h2>Choose a simulation</h2>
      <p className="muted small section-note">Crew members built from NASA's published hearing statistics (not real people), or your own ears.</p>
      <div className="choice-grid">
        {PERSONAS.map((p) => (
          <button key={p.id} className={`choice with-icon${persona === p.id ? ' on' : ''}`} onClick={() => setPersona(p.id)}>
            <ChoiceIcon name={p.id} />
            <strong>{p.name} · {p.tag}</strong>
            <span className="muted small">{p.story}</span>
          </button>
        ))}
        <button className={`choice with-icon own${persona === 'custom' ? ' on' : ''}`} onClick={() => setPersona('custom')}>
          <ChoiceIcon name="custom" />
          <strong>Build your own</strong>
          <span className="muted small">Choose age, sex and what's happening to their ears.</span>
        </button>
        <button className={`choice with-icon own${persona === 'own' ? ' on' : ''}`} onClick={() => setPersona('own')}>
          <ChoiceIcon name="own" />
          <strong>Take my own baseline</strong>
          <span className="muted small">Two 8-minute tests on your own wired headphones, in a quiet room. Results stay on this device.</span>
        </button>
      </div>
      {persona === 'custom' && (
        <div className="custom-form">
          <Stepper label="Age" value={custom.age} step={1} min={25} max={65} presets={[30, 45, 60]} unit="" format={(v) => `${v}`} onChange={(v) => setC({ age: v })} />
          <div className="field">
            <span>Sex</span>
            <div className="segmented">
              {[['female', 'Female'], ['male', 'Male']].map(([v, l]) => <button key={v} className={custom.sex === v ? 'on' : ''} onClick={() => setC({ sex: v })}>{l}</button>)}
            </div>
          </div>
          <div className="field">
            <span>Ears</span>
            <div className="segmented wrap">
              {CONDITIONS.map((c) => <button key={c.id} className={custom.condition === c.id ? 'on' : ''} onClick={() => setC({ condition: c.id })}>{c.label}</button>)}
            </div>
          </div>
          {custom.condition !== 'steady' && (
            <div className="field">
              <span>Which ear</span>
              <div className="segmented">
                {[['left', 'Left'], ['right', 'Right']].map(([v, l]) => <button key={v} className={custom.ear === v ? 'on' : ''} onClick={() => setC({ ear: v })}>{l}</button>)}
              </div>
            </div>
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
        <button className="secondary" onClick={onExplore}>Explore the data</button>
        <button className="secondary" onClick={onAbout}>Sources and disclosures</button>
      </p>
    </div>
  );
}

// One simple line icon per choice: steady, high-pitch change, low-pitch change, sudden drop, build your own, own ears.
const ICONS = {
  steady: <><path d="M3 12h4l2-3 3 6 2-3h7" /></>,
  high: <><path d="M3 15c2 0 2-6 4-6s2 6 4 6 2-6 4-6 2 6 4 6" /><path d="M18 3l3 3-3 3M21 6h-5" /></>,
  low: <><path d="M3 12c3 0 3-5 6-5s3 10 6 10 3-5 6-5" /><path d="M6 20h12" /></>,
  sudden: <><path d="M3 6h7l3 12h8" /><path d="M17 14l4 4-4 4" /></>,
  custom: <><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></>,
  own: <><path d="M4 15v-3a8 8 0 0 1 16 0v3" /><rect x="3" y="14" width="5" height="7" rx="2" /><rect x="16" y="14" width="5" height="7" rx="2" /></>,
};
function ChoiceIcon({ name }) {
  return (
    <svg className="choice-icon" width="32" height="32" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  );
}
