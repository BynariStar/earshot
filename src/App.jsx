// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// App shell. Start screen (station + who you are), then a home that is the live station map with alerts.
// Routes live in the URL hash (#/ears, #/plan, ...) so the phone's back button works like an app's.
// Your own results and each simulated crew member's are stored separately, so switching never overwrites.
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import Welcome from './components/Welcome.jsx';
import StationHome from './components/StationHome.jsx';
import Home from './components/Home.jsx';
import TestFlow from './components/TestFlow.jsx';
import Planner from './components/Planner.jsx';
import IsThisNormal from './components/IsThisNormal.jsx';
import Tests from './components/Tests.jsx';
import SuddenResponse from './components/SuddenResponse.jsx';
import QuickCheck from './components/QuickCheck.jsx';
import { load, save, withoutTest, latestCheck, baselineTests } from './lib/storage.js';
import { loadPlan, savePlan, computePlan, applyFlags, normalize, DEFAULT_FILL, DEFAULT_SLEEP } from './lib/plan.js';
import { loadSession, saveSession, loadSim, saveSim, clearSim } from './lib/session.js';
import { personaById, simulatedThresholds } from './lib/personas.js';
import { hearingState, TARGETS } from './lib/personal.js';
import { buildAlerts } from './lib/alerts.js';
import { evaluate, averageBaselines } from './lib/rules.js';
import './App.css';

const Station = lazy(() => import('./components/Station.jsx'));
const readRoute = () => window.location.hash.replace(/^#\/?/, '');

function useRoute() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const on = () => {
      setRoute(readRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = (r) => {
    window.location.hash = r ? `/${r}` : '/';
  };
  return [route, go];
}

const TITLES = { ears: 'My ears', station: 'Station noise', plan: 'Plan my day', test: 'Hearing test', quick: 'Quick check' };

function dataFor(personaId) {
  if (personaId === 'own') return load();
  return loadSim(personaId) ?? { ...personaById(personaId).state(), quick: [] };
}

export default function App() {
  const [session, setSessionState] = useState(loadSession);
  const [data, setData] = useState(() => (session ? dataFor(session.persona) : load()));
  const [plan, setPlanState] = useState(loadPlan);
  const [route, go] = useRoute();
  const [section, sub] = route.split('/');
  const persona = session && session.persona !== 'own' ? personaById(session.persona) : null;

  const setSession = (s) => {
    setSessionState(s);
    saveSession(s);
  };
  const persist = (next) => {
    if (!session || session.persona === 'own') save(next);
    else saveSim(session.persona, next);
  };
  const update = (fn) =>
    setData((d) => {
      const next = fn(d);
      persist(next);
      return next;
    });
  const setPlan = (p) => {
    setPlanState(p);
    savePlan(p);
  };

  // The plan follows the station you're on.
  const effectivePlan = useMemo(() => {
    const p = normalize(plan);
    if (!session || p.base === session.station) return p;
    return { ...p, base: session.station, places: [], fill: DEFAULT_FILL[session.station], sleepAt: DEFAULT_SLEEP[session.station] };
  }, [plan, session]);

  // The "Is this normal?" noise comparison reads the planned day.
  useEffect(() => {
    const { work } = computePlan(effectivePlan);
    try {
      localStorage.setItem('earshot.plannedDay', JSON.stringify({ leqDba: work.leqDba, status: work.status }));
    } catch {
      /* storage unavailable */
    }
  }, [effectivePlan]);

  const hearing = hearingState(data);
  const flags = applyFlags(effectivePlan, TARGETS[hearing.state].protectAbove);
  const planResult = computePlan(flags.plan);
  const alerts = session
    ? buildAlerts({ station: session.station, data, events: session.events ?? [], plan: planResult, planFlags: flags.flagged, hearing, quick: data.quick ?? [] })
    : [];

  function start(s) {
    setSession(s);
    setData(dataFor(s.persona));
    go('');
  }
  function addEvent(e) {
    setSession({ ...session, events: [...(session.events ?? []).filter((x) => x.type !== e.type), { ...e, at: Date.now() }] });
  }
  function clearEvents() {
    setSession({ ...session, events: [] });
    if (persona) {
      clearSim(session.persona);
      setData(dataFor(session.persona));
    } else update((d) => ({ ...d, quick: [] }));
  }
  const saveTest = (test, profilePatch) => update((d) => ({ ...d, tests: [...d.tests, test], profile: { ...(d.profile ?? {}), ...(profilePatch ?? {}) } }));
  const deleteTest = (id) => update((d) => withoutTest(d, id));
  const saveQuick = (q) => update((d) => ({ ...d, quick: [q, ...(d.quick ?? [])].slice(0, 30) }));
  // A simulated crew member's full check after a quick check found a large drop (the retest is assumed to repeat it).
  function simulatedFullCheck() {
    const truth = simulatedThresholds(persona, session.events ?? []);
    const b = baselineTests(data);
    const ref = averageBaselines(b[0].thresholds, b[1].thresholds);
    const findings = evaluate(ref, truth).findings;
    saveTest({ id: crypto.randomUUID(), date: new Date().toISOString(), role: 'check', headphones: 'Crew headphones', noise: { checked: true, pass: true }, context: ['Ringing (tinnitus)'], complete: true, thresholds: truth, confirmedFindings: findings, simulated: true });
    go(findings.some((f) => f.kind === 'sudden') ? 'ears/sudden' : 'ears');
  }
  const startTest = (role) => go(`test/${role}`);

  if (!session || section === 'welcome') {
    return (
      <div className="app">
        <Welcome onStart={start} initial={session} />
        <Footer />
      </div>
    );
  }

  if (!section || section === 'home' || !TITLES[section]) {
    return (
      <div className="app">
        <StationHome
          session={session}
          persona={persona}
          alerts={alerts}
          go={go}
          focus={section === 'home' ? sub : null}
          onEvent={addEvent}
          onClearEvents={clearEvents}
          onChange={() => go('welcome')}
          data={data}
          onReset={() => setData(dataFor(session.persona))}
        />
        <Footer />
      </div>
    );
  }

  const back = section === 'test' ? () => go('ears') : () => go('');
  const earsTab = section === 'ears' ? sub || 'overview' : null;
  const hasSudden = latestCheck(data)?.confirmedFindings?.some((f) => f.kind === 'sudden');
  const earsTabs = [['overview', 'Overview'], ['tests', 'My tests'], ['normal', 'Is this normal?']];
  if (hasSudden || earsTab === 'sudden') earsTabs.push(['sudden', 'Sudden drop: act now']);

  return (
    <div className="app">
      <header className="appbar">
        <button className="back" onClick={back} aria-label="Back">
          <span aria-hidden="true">‹</span>
        </button>
        <h1>{TITLES[section]}</h1>
        {section === 'ears' && <span className="badge personal">{persona ? `${persona.name} · simulated` : 'Personal'}</span>}
      </header>

      {section === 'ears' && (
        <div className="segmented tabs-ears" role="tablist" aria-label="My ears">
          {earsTabs.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={earsTab === k} className={earsTab === k ? 'on' : ''} onClick={() => go(k === 'overview' ? 'ears' : `ears/${k}`)}>
              {label}
            </button>
          ))}
        </div>
      )}

      <main>
        {earsTab === 'overview' && (
          <Home data={data} onStartTest={startTest} onOpenNormal={() => go('ears/normal')} onOpenSudden={() => go('ears/sudden')} onExitDemo={() => go('welcome')} />
        )}
        {earsTab === 'tests' && <Tests data={data} onDelete={deleteTest} onStartTest={startTest} />}
        {earsTab === 'sudden' && <SuddenResponse data={data} onRetest={() => go('quick/ringing')} />}
        {earsTab === 'normal' && <IsThisNormal data={data} onStartTest={() => startTest('baseline')} />}
        {section === 'test' && <TestFlow key={sub} role={sub === 'baseline' ? 'baseline' : 'check'} data={data} onSave={saveTest} onDone={() => go('ears')} onOpenSudden={() => go('ears/sudden')} />}
        {section === 'quick' && <QuickCheck key={sub} kind={sub || 'general'} data={data} persona={persona} events={session.events ?? []} onSave={saveQuick} onSimulatedFullCheck={simulatedFullCheck} go={go} />}
        {section === 'station' && (
          <Suspense fallback={<p className="muted">Loading the station…</p>}>
            <Station demoEvents={session.events ?? []} />
          </Suspense>
        )}
        {section === 'plan' && <Planner plan={effectivePlan} setPlan={setPlan} data={data} lockedBase={session.station} />}
      </main>
      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="footer">
      Research prototype for NASA Space Apps 2026, not a medical device. Your results stay on this device. AI-assisted: code largely written with
      Claude (Anthropic), reviewed by team Earshot.
    </footer>
  );
}
