// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
import { useState } from 'react';
import Home from './components/Home.jsx';
import TestFlow from './components/TestFlow.jsx';
import Station from './components/Station.jsx';
import About from './components/About.jsx';
import IsThisNormal from './components/IsThisNormal.jsx';
import { load, save, clearAll } from './lib/storage.js';
import { demoState } from './lib/demo.js';
import './App.css';

export default function App() {
  const [data, setData] = useState(load);
  const [view, setView] = useState({ name: 'home' });

  function saveTest(test, profilePatch) {
    setData((d) => {
      const next = { ...d, tests: [...d.tests, test], profile: { ...(d.profile ?? {}), ...(profilePatch ?? {}) } };
      save(next);
      return next;
    });
  }

  const nav = [
    ['home', 'My ears'],
    ['normal', 'Is this normal?'],
    ['station', 'Station noise'],
    ['about', 'Sources'],
  ];

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setView({ name: 'home' })}>
          <img className="brand-mark" src="./favicon.svg" alt="" aria-hidden="true" />
          Earshot
        </button>
        <nav>
          {nav.map(([name, label]) => (
            <button key={name} className={view.name === name ? 'nav on' : 'nav'} onClick={() => setView({ name })}>
              {label}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {view.name === 'home' && (
          <Home
            data={data}
            onStartTest={(role) => setView({ name: 'test', role })}
            onLoadDemo={() => {
              const d = demoState();
              save(d);
              setData(d);
            }}
            onOpenNormal={() => setView({ name: 'normal' })}
            onExitDemo={() => {
              clearAll();
              setData(load());
            }}
          />
        )}
        {view.name === 'test' && <TestFlow role={view.role} data={data} onSave={saveTest} onDone={() => setView({ name: 'home' })} />}
        {view.name === 'normal' && <IsThisNormal data={data} onStartTest={() => setView({ name: 'test', role: 'baseline' })} />}
        {view.name === 'station' && <Station />}
        {view.name === 'about' && <About data={data} onReset={() => setData(load())} />}
      </main>
      <footer className="footer">
        Research prototype for NASA Space Apps 2026, not a medical device. Your results stay on this device. AI-assisted: code largely written
        with Claude (Anthropic), reviewed by team Earshot.
      </footer>
    </div>
  );
}
