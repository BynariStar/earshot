// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Alerts, most urgent first. Items that need no action can be marked done (with undo); requests for a
// hearing check clear themselves when the check is done.
import { useState } from 'react';
import Sheet from './Sheet.jsx';
import { alertKey } from '../lib/alerts.js';


export default function AlertsSheet({ alerts, fresh, onDone, onUndo, onAct, onClose }) {
  const [undo, setUndo] = useState(null); // { key, title }
  const done = (a) => {
    onDone(alertKey(a));
    setUndo({ key: alertKey(a), title: a.title });
    setTimeout(() => setUndo((u) => (u?.key === alertKey(a) ? null : u)), 6000);
  };
  return (
    <Sheet title="Alerts" onClose={onClose}>
      {undo && (
        <div className="undo-row">
          <span>Marked done: {undo.title}</span>
          <button className="secondary" onClick={() => { onUndo(undo.key); setUndo(null); }}>Undo</button>
        </div>
      )}
      {alerts.length === 0 && <p className="muted">Nothing new.</p>}
      <div className="alert-rows">
        {alerts.map((a) => (
          <article key={a.id} className={`alert-row ${a.level}${fresh.includes(alertKey(a)) ? ' new' : ''}`}>
            <div className="alert-row-text">
              <h3>
                <span className={`level-icon ${a.level}`} aria-hidden="true">{a.level === 'urgent' ? '!' : a.level === 'warn' ? '▲' : 'i'}</span>
                {a.title}
              </h3>
              <p>{a.body}</p>
            </div>
            <div className="alert-row-actions">
              {a.actions.map((x, i) => (
                <button key={x.label} className={i === 0 ? 'primary' : 'secondary'} onClick={() => { onClose(); onAct(x); }}>{x.label}</button>
              ))}
              {a.dismissable && <button className="secondary done" onClick={() => done(a)}>✓ Done</button>}
            </div>
          </article>
        ))}
      </div>
    </Sheet>
  );
}
