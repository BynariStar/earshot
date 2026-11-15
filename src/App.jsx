// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// App shell: a home screen of section cards; each section opens full screen with a back arrow.
// Routes live in the URL hash (#/ears, #/station, ...) so the phone's back button works like an app's.
import { Suspense, lazy, useEffect, useState } from 'react';
import Hub from './components/Hub.jsx';
import Home from './components/Home.jsx';
import TestFlow from './components/TestFlow.jsx';
import Planner from './components/Planner.jsx';
import IsThisNormal from './components/IsThisNormal.jsx';
import Tests from './components/Tests.jsx';
import SuddenResponse from './components/SuddenResponse.jsx';
import { load, save, clearAll, withoutTest, latestCheck } from './lib/storage.js';
import { loadPlan, savePlan, computePlan } from './lib/plan.js';
import { demoState } from './lib/demo.js';
import './App.css';

// The 3D station pulls in three.js; load it only when that section opens.
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

const TITLES = { ears: 'My ears', station: 'Station noise', plan: 'Plan a workday', test: 'Hearing test' };

export default function App() {
  const [data, setData] = useState(load);
  const [plan, setPlanState] = useState(loadPlan);
  const [route, go] = useRoute();
  const [section, sub] = route.split('/');

  const setPlan = (p) => {
    setPlanState(p);
    savePlan(p);
  };

  // The "Is this normal?" noise comparison reads the planned day.
  useEffect(() => {
    const { work } = computePlan(plan);
    try {
      localStorage.setItem('earshot.plannedDay', JSON.stringify({ leqDba: work.leqDba, status: work.status }));
    } catch {
      /* storage unavailable */
    }
  }, [plan]);

  function saveTest(test, profilePatch) {
    setData((d) => {
      const next = { ...d, tests: [...d.tests, test], profile: { ...(d.profile ?? {}), ...(profilePatch ?? {}) } };
      save(next);
      return next;
    });
  }
  function deleteTest(id) {
    setData((d) => {
      const next = withoutTest(d, id);
      save(next);
      return next;
    });
  }
  function loadDemo() {
    const d = demoState();
    save(d);
    setData(d);
  }
  function exitDemo() {
    clearAll();
    setData(load());
  }
  const startTest = (role) => go(`test/${role}`);

  if (!section || !TITLES[section]) {
    return (
      <div className="app">
        <Hub data={data} plan={plan} go={go} onStartTest={startTest} onLoadDemo={loadDemo} onExitDemo={exitDemo} onReset={() => setData(load())} />
        <Footer />
      </div>
    );
  }

  const back = section === 'test' ? () => go('ears') : () => go('');
  const earsTab = section === 'ears' ? sub || 'overview' : null;
  const hasSudden = latestCheck(data)?.confirmedFindings?.some((f) => f.kind === 'sudden');
  const earsTabs = [['overview', 'Overview'], ['tests', 'My tests'], ['normal', 'Is this normal?']];
  if (hasSudden || data.demo || earsTab === 'sudden') earsTabs.push(['sudden', hasSudden ? 'Sudden drop: act now' : 'Sudden drop (example)']);

  return (
    <div className="app">
      <header className="appbar">
        <button className="back" onClick={back} aria-label="Back">
          <span aria-hidden="true">‹</span>
        </button>
        <h1>{TITLES[section]}</h1>
        {section === 'ears' && <span className="badge personal">Personal</span>}
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
          <Home data={data} onStartTest={startTest} onLoadDemo={loadDemo} onOpenNormal={() => go('ears/normal')} onOpenSudden={() => go('ears/sudden')} onExitDemo={exitDemo} />
        )}
        {earsTab === 'tests' && <Tests data={data} onDelete={deleteTest} onStartTest={startTest} />}
        {earsTab === 'sudden' && <SuddenResponse data={data} onRetest={() => startTest('check')} />}
        {earsTab === 'normal' && <IsThisNormal data={data} onStartTest={() => startTest('baseline')} />}
        {section === 'test' && <TestFlow key={sub} role={sub === 'baseline' ? 'baseline' : 'check'} data={data} onSave={saveTest} onDone={() => go('ears')} onOpenSudden={() => go('ears/sudden')} />}
        {section === 'station' && (
          <Suspense fallback={<p className="muted">Loading the station…</p>}>
            <Station />
          </Suspense>
        )}
        {section === 'plan' && <Planner plan={plan} setPlan={setPlan} />}
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
