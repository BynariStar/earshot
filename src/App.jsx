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
import TestsMenu from './components/TestsMenu.jsx';
import TabBar from './components/TabBar.jsx';
import AlertsSheet from './components/AlertsSheet.jsx';
import { load, save, withoutTest, latestCheck, baselineTests } from './lib/storage.js';
import { loadPlan, savePlan, computePlan, applyFlags, normalize, scheduleFor } from './lib/plan.js';
import { loadSession, saveSession, loadSim, saveSim, clearSim } from './lib/session.js';
import { personaById, customPersona, simulatedThresholds } from './lib/personas.js';
import { hearingState, TARGETS } from './lib/personal.js';
import { buildAlerts, alertKey as bellKey } from './lib/alerts.js';
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

const TITLES = { ears: 'My ears', station: 'Explore the data', plan: 'Today', test: 'Hearing test', quick: 'Quick check', about: 'Sources and disclosures' };
const APP_START = Date.now();

const personaFor = (s) => (!s || s.persona === 'own' ? null : s.persona === 'custom' ? customPersona(s.custom) : personaById(s.persona));
function dataFor(s) {
  if (!s || s.persona === 'own') return load();
  const p = personaFor(s);
  const d = loadSim(s.persona) ?? { ...p.state(), quick: [] };
  return { ...d, profile: { ...(d.profile ?? {}), age: p.age, sex: p.sex } };
}

export default function App() {
  const [session, setSessionState] = useState(loadSession);
  const [data, setData] = useState(() => dataFor(session));
  const [plan, setPlanState] = useState(loadPlan);
  const [route, go] = useRoute();
  // "Show the source" and similar actions: open a module's details on the station map. A request counter makes
  // repeated taps work even when the route is already home.
  const [focusReq, setFocusReq] = useState(null);
  const follow = (to) => {
    if (to && to.startsWith('home/')) {
      setFocusReq({ id: to.slice(5), n: Date.now() });
      go('');
    } else go(to);
  };
  const [section, sub] = route.split('/');
  const persona = personaFor(session);

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
    return scheduleFor(session.station);
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
      if (session.pausedAt) return;
      const sec = (Date.now() - liveStart) / 1000;
      const hit = session.youAt ? liveHit(session.station, sec, session.youAt) : liveHit(session.station, sec);
      if (!hit || (session.events ?? []).some((e) => e.type === 'live' && e.key === hit.key)) return;
      const delta = incidentDelta(hit, spectrumIdOf(session.station, hit.part));
      const cause = hit.kind === 'fault' ? `Likely ${hit.during}, +${delta.toFixed(1)} dBA` : `${hit.during[0].toUpperCase()}${hit.during.slice(1)}`;
      const e = { type: 'live', key: hit.key, part: hit.part, where: partLabel(session.station, hit.part), cause, pitches: incidentPitches(hit), at: Date.now() };
      changeSession((prev) => ({ ...prev, events: [...(prev.events ?? []).filter((x) => x.type !== 'live'), e] }));
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.station, session?.events, session?.youAt, session?.pausedAt, liveStart]);
  // Pause/play the simulated feed: freeze its clock, then shift its start by the pause.
  const togglePause = () =>
    changeSession((prev) =>
      prev.pausedAt
        ? { ...prev, liveStart: (prev.liveStart ?? APP_START) + (Date.now() - prev.pausedAt), pausedAt: null }
        : { ...prev, liveStart: prev.liveStart ?? APP_START, pausedAt: Date.now() }
    );
  // The bell: opening it marks everything as seen; "done" removes an item until it changes.
  const markSeen = (keys) => changeSession((prev) => ({ ...prev, bellSeen: [...new Set([...(prev.bellSeen ?? []), ...keys])] }));
  const markDone = (key) => changeSession((prev) => ({ ...prev, done: [...new Set([...(prev.done ?? []), key])] }));
  const alerts = session
    ? buildAlerts({ station: session.station, data, events: session.events ?? [], plan: planResult, planFlags: flags.flagged, hearing, quick: data.quick ?? [] })
    : [];

  // A new popup alert opens full screen once (not during a test, and not on the page it points to).
  const alertKey = (a) => `${a.id}:${a.title}`;
  const seen = session?.seen ?? [];
  const busy = section === 'test' || section === 'quick' || section === 'welcome' || section === 'about' || section === 'station' || route === 'ears/sudden';
  const pageAlert = busy
    ? null
    : alerts.find((a) => a.popup && !seen.includes(alertKey(a)) && !a.actions.some((x) => x.to && x.to === route));
  function dismissAlert(a) {
    setSession({ ...session, seen: [...seen, alertKey(a)] });
  }
  function actOnAlert(a, x) {
    const s1 = { ...session, seen: [...seen, alertKey(a)] };
    if (x.event) setSession({ ...s1, events: [...(s1.events ?? []).filter((e) => e.type !== x.event.type), { ...x.event, at: Date.now() }] });
    else {
      setSession(s1);
      follow(x.to);
    }
  }
  const overlay = pageAlert && <AlertPage alert={pageAlert} onAct={(x) => actOnAlert(pageAlert, x)} onDismiss={() => dismissAlert(pageAlert)} />;
  // Alerts tab: opening it marks everything seen; the badge counts only new items, in the most severe colour.
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [fresh, setFresh] = useState([]);
  const bellList = alerts.filter((a) => !(session?.done ?? []).includes(bellKey(a)));
  const unseen = bellList.filter((a) => !(session?.bellSeen ?? []).includes(bellKey(a)));
  const badgeLevel = unseen.some((x) => x.level === 'urgent') ? 'urgent' : unseen.some((x) => x.level === 'warn') ? 'warn' : 'info';
  const openAlerts = () => {
    setFresh(unseen.map(bellKey));
    markSeen(bellList.map(bellKey));
    setAlertsOpen(true);
  };
  const showTabs = session && section !== 'test' && section !== 'quick' && section !== 'about';
  const chrome = (
    <>
      {showTabs && <TabBar section={section} go={go} onAlerts={openAlerts} badge={unseen.length} badgeLevel={badgeLevel} />}
      {alertsOpen && (
        <AlertsSheet
          alerts={bellList}
          fresh={fresh}
          onDone={markDone}
          onUndo={(k) => changeSession((prev) => ({ ...prev, done: (prev.done ?? []).filter((x) => x !== k) }))}
          onAct={(x) => (x.event ? addEvent(x.event) : follow(x.to))}
          onClose={() => setAlertsOpen(false)}
        />
      )}
      {overlay}
    </>
  );

  function start(s) {
    setSession({ ...s, seen: [], bellSeen: [], done: [], liveStart: Date.now(), pausedAt: null });
    setPlan(scheduleFor(s.station)); // each session starts from the crew's (simulated) schedule
    if (s.persona === 'custom') clearSim('custom');
    setData(dataFor(s));
    go('');
  }
  function addEvent(e) {
    changeSession((prev) => ({ ...prev, events: [...(prev.events ?? []).filter((x) => x.type !== e.type), { ...e, at: Date.now() }] }));
  }
  // A reported symptom is the user's own action, so it opens the check straight away (the alert stays until it's done).
  function reportSymptom(e) {
    addEvent(e);
    go('quick/ringing');
  }
  function clearEvents() {
    setSession({ ...session, events: [], seen: [], bellSeen: [], done: [], liveStart: Date.now(), pausedAt: null, youAt: null });
    if (persona) {
      clearSim(session.persona);
      setData(dataFor(session));
    } else update((d) => ({ ...d, quick: [] }));
  }
  const saveTest = (test, profilePatch) => update((d) => ({ ...d, tests: [...d.tests, test], profile: { ...(d.profile ?? {}), ...(profilePatch ?? {}) } }));
  const deleteTest = (id) => update((d) => withoutTest(d, id));
  const saveQuick = (q) => update((d) => ({ ...d, quick: [q, ...(d.quick ?? [])].slice(0, 30) }));
  // A simulated crew member's full check after a quick check found a large drop (the retest is assumed to repeat it).
  function simulatedFullCheck(truthOverride) {
    const truth = truthOverride ?? simulatedThresholds(persona, session.events ?? []);
    const b = baselineTests(data);
    const ref = averageBaselines(b[0].thresholds, b[1].thresholds);
    const findings = evaluate(ref, truth).findings;
    saveTest({ id: crypto.randomUUID(), date: new Date().toISOString(), role: 'check', headphones: 'Crew headphones', noise: { checked: true, pass: true }, context: ['Ringing (tinnitus)'], complete: true, thresholds: truth, confirmedFindings: findings, simulated: true });
    go(findings.some((f) => f.kind === 'sudden') ? 'ears/sudden' : 'ears');
  }
  const startTest = (role) => go(`test/${role}`);

  // Outside the app: Sources and disclosures, and Explore the data. No tabs, no alerts; back returns to the start.
  if (section === 'about' || section === 'station') {
    return (
      <div className="app standalone">
        <header className="appbar">
          <button className="back" onClick={() => go('welcome')} aria-label="Back to the start">
            <span aria-hidden="true">‹</span>
          </button>
          <h1>{section === 'about' ? 'Sources and disclosures' : 'Explore the data'}</h1>
        </header>
        <main>
          {section === 'about' ? (
            <About data={data} onReset={() => setData(dataFor(session))} />
          ) : (
            <Suspense fallback={<p className="muted">Loading the station…</p>}>
              <Station />
            </Suspense>
          )}
        </main>
      </div>
    );
  }

  if (!session || section === 'welcome') {
    return (
      <div className="app">
        <Welcome onStart={start} initial={session} onAbout={() => go('about')} onExplore={() => go('station')} />
      </div>
    );
  }

  if (!section || section === 'home' || !TITLES[section]) {
    return (
      <div className="app home-app">
        <StationHome
          session={session}
          persona={persona}
          go={go}
          focus={focusReq}
          onEvent={(e) => (e.type === 'ringing' ? reportSymptom(e) : addEvent(e))}
          onClearEvents={clearEvents}
          onChange={() => go('welcome')}
          data={data}
          liveStart={liveStart}
          pausedAt={session.pausedAt ?? null}
          onTogglePause={togglePause}
          onMoveMe={(id) => changeSession((prev) => ({ ...prev, youAt: id }))}
        />
        {chrome}
      </div>
    );
  }

  const back = section === 'test' ? () => go('ears') : () => go('');
  const earsTab = section === 'ears' ? sub || 'overview' : null;
  const hasSudden = latestCheck(data)?.confirmedFindings?.some((f) => f.kind === 'sudden');
  const earsTabs = hasSudden || earsTab === 'sudden' ? [['overview', 'Overview'], ['sudden', 'Sudden drop: act now']] : [];

  return (
    <div className="app">
      <header className="appbar">
        <button className="back" onClick={back} aria-label="Back">
          <span aria-hidden="true">‹</span>
        </button>
        <h1>{TITLES[section]}</h1>
        {section === 'ears' && persona && <span className="muted appbar-sub">{persona.name} (simulated)</span>}
        {section === 'ears' && <TestsMenu data={data} onDelete={deleteTest} />}
      </header>

      {section === 'ears' && earsTabs.length > 0 && (
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
          <Home data={data} onStartTest={startTest} onOpenSudden={() => go('ears/sudden')} simulated={!!persona} earplugs={flags.flagged.map((f) => f.name)} go={go} onReport={reportSymptom} />
        )}
        {earsTab === 'tests' && <Tests data={data} onDelete={deleteTest} onStartTest={startTest} />}
        {earsTab === 'sudden' && <SuddenResponse data={data} onRetest={() => go('quick/ringing')} />}
        {earsTab === 'normal' && <IsThisNormal data={data} onStartTest={() => startTest('baseline')} />}
        {section === 'test' && <TestFlow key={sub} role={sub === 'baseline' ? 'baseline' : 'check'} data={data} onSave={saveTest} onDone={() => go('ears')} onOpenSudden={() => go('ears/sudden')} />}
        {section === 'quick' && <QuickCheck key={sub} kind={sub || 'general'} data={data} persona={persona} events={session.events ?? []} onSave={saveQuick} onSimulatedFullCheck={simulatedFullCheck} go={go} />}
        {section === 'plan' && <Planner key={sub ?? ''} plan={effectivePlan} setPlan={setPlan} data={data} lockedBase={session.station} focus={sub} alerts={alerts} events={session.events ?? []} go={follow} />}
      </main>
      {chrome}
    </div>
  );
}
