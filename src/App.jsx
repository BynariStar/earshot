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
import AlertPage from './components/AlertPage.jsx';
import { load, save, withoutTest, latestCheck, baselineTests } from './lib/storage.js';
import { loadPlan, savePlan, computePlan, applyFlags, normalize, DEFAULT_FILL, DEFAULT_SLEEP } from './lib/plan.js';
import { loadSession, saveSession, loadSim, saveSim, clearSim } from './lib/session.js';
import { personaById, simulatedThresholds } from './lib/personas.js';
import { hearingState, TARGETS } from './lib/personal.js';
import { buildAlerts } from './lib/alerts.js';
import { liveHit, incidentPitches, incidentDelta, partLabel, spectrumIdOf } from './lib/live.js';
import About from './components/About.jsx';
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

const TITLES = { ears: 'My ears', station: 'Explore the data', plan: 'Plan my day', test: 'Hearing test', quick: 'Quick check', about: 'How Earshot works' };
const APP_START = Date.now();

function dataFor(personaId) {
  if (personaId === 'own') return load();
  const p = personaById(personaId);
  const d = loadSim(personaId) ?? { ...p.state(), quick: [] };
  return { ...d, profile: { ...(d.profile ?? {}), age: p.age, sex: p.sex } };
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
  const changeSession = (fn) =>
    setSessionState((prev) => {
      const next = fn(prev);
      saveSession(next);
      return next;
    });
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

  const hearing = hearingState(data);
  const flags = applyFlags(effectivePlan, TARGETS[hearing.state].protectAbove);
  const planResult = computePlan(flags.plan);
  // My ears' "could noise explain it?" reads the planned day, with the earplugs Earshot flagged.
  useEffect(() => {
    try {
      localStorage.setItem('earshot.plannedDay', JSON.stringify({ leqDba: planResult.work.leqDba, status: planResult.work.status }));
    } catch {
      /* storage unavailable */
    }
  }, [planResult.work.leqDba, planResult.work.status]);

  // Live feed: one clock per session, so it keeps running while you're on other pages. Earshot is assumed to
  // know where the crew member is (simulated); an incident in their area raises an exposure alert by itself.
  const liveStart = session?.liveStart ?? APP_START;
  useEffect(() => {
    if (!session) return undefined;
    const id = setInterval(() => {
      if ((session.events ?? []).some((e) => e.type === 'live')) return;
      const hit = liveHit(session.station, (Date.now() - liveStart) / 1000);
      if (!hit) return;
      const delta = incidentDelta(hit, spectrumIdOf(session.station, hit.part));
      const cause = hit.kind === 'fault' ? `Likely ${hit.during}, +${delta.toFixed(1)} dBA` : `${hit.during[0].toUpperCase()}${hit.during.slice(1)}`;
      const e = { type: 'live', part: hit.part, where: partLabel(session.station, hit.part), cause, pitches: incidentPitches(hit), at: Date.now() };
      changeSession((prev) => ({ ...prev, events: [...(prev.events ?? []).filter((x) => x.type !== 'live'), e] }));
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.station, session?.events, liveStart]);
  const alerts = session
    ? buildAlerts({ station: session.station, data, events: session.events ?? [], plan: planResult, planFlags: flags.flagged, hearing, quick: data.quick ?? [] })
    : [];

  // A new urgent or warning alert opens full screen once (not during a test, and not on the page it points to).
  const alertKey = (a) => `${a.id}:${a.title}`;
  const seen = session?.seen ?? [];
  const busy = section === 'test' || section === 'quick' || section === 'welcome' || route === 'ears/sudden';
  const pageAlert = busy
    ? null
    : alerts.find((a) => (a.level === 'urgent' || a.level === 'warn') && !seen.includes(alertKey(a)) && !a.actions.some((x) => x.to && x.to === route));
  function dismissAlert(a) {
    setSession({ ...session, seen: [...seen, alertKey(a)] });
  }
  function actOnAlert(a, x) {
    const s1 = { ...session, seen: [...seen, alertKey(a)] };
    if (x.event) setSession({ ...s1, events: [...(s1.events ?? []).filter((e) => e.type !== x.event.type), { ...x.event, at: Date.now() }] });
    else {
      setSession(s1);
      go(x.to);
    }
  }
  const overlay = pageAlert && <AlertPage alert={pageAlert} onAct={(x) => actOnAlert(pageAlert, x)} onDismiss={() => dismissAlert(pageAlert)} />;

  function start(s) {
    setSession({ ...s, seen: [], liveStart: Date.now() });
    setData(dataFor(s.persona));
    go('');
  }
  function addEvent(e) {
    changeSession((prev) => ({ ...prev, events: [...(prev.events ?? []).filter((x) => x.type !== e.type), { ...e, at: Date.now() }] }));
  }
  function clearEvents() {
    setSession({ ...session, events: [], seen: [], liveStart: Date.now() });
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
          liveStart={liveStart}
        />
        <Footer />
        {overlay}
      </div>
    );
  }

  const back = section === 'test' ? () => go('ears') : () => go('');
  const earsTab = section === 'ears' ? sub || 'overview' : null;
  const hasSudden = latestCheck(data)?.confirmedFindings?.some((f) => f.kind === 'sudden');
  const earsTabs = [['overview', 'Overview'], ['tests', 'My tests']];
  if (hasSudden || earsTab === 'sudden') earsTabs.push(['sudden', 'Sudden drop: act now']);

  return (
    <div className="app">
      <header className="appbar">
        <button className="back" onClick={back} aria-label="Back">
          <span aria-hidden="true">‹</span>
        </button>
        <h1>{TITLES[section]}</h1>
        {section === 'ears' && persona && <span className="muted appbar-sub">{persona.name} (simulated)</span>}
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
          <Home data={data} onStartTest={startTest} onOpenSudden={() => go('ears/sudden')} simulated={!!persona} />
        )}
        {earsTab === 'tests' && <Tests data={data} onDelete={deleteTest} onStartTest={startTest} />}
        {earsTab === 'sudden' && <SuddenResponse data={data} onRetest={() => go('quick/ringing')} />}
        {earsTab === 'normal' && <IsThisNormal data={data} onStartTest={() => startTest('baseline')} />}
        {section === 'test' && <TestFlow key={sub} role={sub === 'baseline' ? 'baseline' : 'check'} data={data} onSave={saveTest} onDone={() => go('ears')} onOpenSudden={() => go('ears/sudden')} />}
        {section === 'quick' && <QuickCheck key={sub} kind={sub || 'general'} data={data} persona={persona} events={session.events ?? []} onSave={saveQuick} onSimulatedFullCheck={simulatedFullCheck} go={go} />}
        {section === 'station' && (
          <Suspense fallback={<p className="muted">Loading the station…</p>}>
            <Station demoEvents={session.events ?? []} liveStart={liveStart} youStation={session.station} />
          </Suspense>
        )}
        {section === 'about' && <About data={data} onReset={() => setData(dataFor(session.persona))} />}
        {section === 'plan' && <Planner plan={effectivePlan} setPlan={setPlan} data={data} lockedBase={session.station} />}
      </main>
      <Footer />
      {overlay}
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
