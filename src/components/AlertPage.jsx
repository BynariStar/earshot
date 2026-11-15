// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// A new urgent or warning alert takes over the screen once, so it can't be missed. After the crew member
// acts on it or dismisses it, it stays in the alert list on the home screen.
import { useEffect, useRef } from 'react';

const LEVEL = { urgent: 'Act now', warn: 'Heads up' };

export default function AlertPage({ alert, onAct, onDismiss }) {
  const first = useRef(null);
  useEffect(() => {
    first.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onDismiss();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [alert, onDismiss]);
  return (
    <div className={`alert-page level-${alert.level}`} role="alertdialog" aria-modal="true" aria-labelledby="alert-page-title" aria-describedby="alert-page-body">
      <div className="alert-page-card">
        <p className="alert-page-level">
          <span className="alert-page-icon" aria-hidden="true">{alert.level === 'urgent' ? '!' : '▲'}</span>
          {LEVEL[alert.level] ?? 'Alert'}
        </p>
        <h2 id="alert-page-title">{alert.title}</h2>
        <p id="alert-page-body">{alert.body}</p>
        <div className="alert-page-actions">
          {alert.actions.map((x, i) => (
            <button key={x.label} ref={i === 0 ? first : null} className={i === 0 ? 'primary' : 'secondary'} onClick={() => onAct(x)}>
              {x.label}
            </button>
          ))}
        </div>
        <button className="link-button" ref={alert.actions.length ? null : first} onClick={onDismiss}>
          Not now: keep it in my alerts
        </button>
      </div>
    </div>
  );
}
