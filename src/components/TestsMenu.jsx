// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// "Tests (n) ›" in the top bar opens a flyout from the right: one line per test, newest first; tap a line for its numbers or to delete it.
import { useState } from 'react';
import Sheet from './Sheet.jsx';
import { averageBaselines, shifts, isNoResponse } from '../lib/rules.js';
import { baselineTests, isNoisy } from '../lib/storage.js';
import Info from './Info.jsx';

const FREQS = [250, 500, 1000, 2000, 3000, 4000];
const hz = (f) => (f >= 1000 ? `${f / 1000}k` : `${f}`);
const hzLong = (f) => (f >= 1000 ? `${f / 1000}\u00a0kHz` : `${f}\u00a0Hz`);

function summary(t, reference) {
  if (t.role === 'baseline' || !reference) return null;
  const s = shifts(reference, t.thresholds);
  let best = null;
  for (const ear of ['left', 'right'])
    for (const f of FREQS) {
      const d = s[ear]?.perFreq?.[f];
      if (!Number.isFinite(d) || isNoResponse(reference[ear][f])) continue;
      if (!best || d > best.d) best = { d, ear, f };
    }
  if (!best) return null;
  return best.d < 5 ? 'No change' : `Largest change: ${best.ear} ${hzLong(best.f)}, +${Math.round(best.d)} dB`;
}

export default function TestsMenu({ data, onDelete }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const tests = [...data.tests].filter((t) => t.complete).reverse();
  const baselines = baselineTests(data);
  const reference = baselines.length >= 2 ? averageBaselines(baselines[0].thresholds, baselines[1].thresholds) : null;
  return (
    <div className="tests-menu">
      <button className="secondary" onClick={() => setOpen(true)}>
        Tests ({tests.length}) <span aria-hidden="true">›</span>
      </button>
      {open && (
        <Sheet side="right" title={`Tests (${tests.length})`} onClose={() => setOpen(false)}>
          {tests.length === 0 && <p className="muted small">No tests yet.</p>}
          {tests.map((t) => {
            const bIndex = baselines.findIndex((b) => b.id === t.id);
            const name = t.role === 'baseline' ? `Baseline ${bIndex >= 0 && bIndex < 2 ? bIndex + 1 : '(extra)'}` : 'Check';
            const when = Number.isFinite(t.missionDay) ? `Day ${t.missionDay}` : new Date(t.date).toLocaleDateString();
            const isOpen = expanded === t.id;
            return (
              <div key={t.id} className={`test-row${isOpen ? ' open' : ''}`}>
                <button className="test-line row" onClick={() => setExpanded(isOpen ? null : t.id)}>
                  <span className="muted">{when}</span> <strong>{name}</strong>
                  <span className="muted"> {summary(t, reference) ?? ''}</span>
                  {isNoisy(t) && <span className="warn-text"> · noisy room</span>}
                  <span aria-hidden="true" className="chev">{isOpen ? '⌄' : '›'}</span>
                </button>
                {isOpen && (
                  <div className="test-detail">
                    <table className="mini-table">
                      <thead><tr><th>Hz</th>{FREQS.map((f) => <th key={f}>{hz(f)}</th>)}</tr></thead>
                      <tbody>
                        {['left', 'right'].map((ear) => (
                          <tr key={ear}>
                            <th>{ear === 'left' ? 'L' : 'R'}</th>
                            {FREQS.map((f) => {
                              const v = t.thresholds?.[ear]?.[f];
                              const d = reference && t.role !== 'baseline' && Number.isFinite(v) && !isNoResponse(reference[ear][f]) ? v - reference[ear][f] : null;
                              return (
                                <td key={f} className={d >= 10 ? 'shift' : d >= 5 ? 'watch' : ''}>
                                  {!Number.isFinite(v) ? '–' : isNoResponse(v) ? 'NR' : Math.round(v)}
                                  {d !== null && <small>{d > 0 ? `+${Math.round(d)}` : Math.round(d)}</small>}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="test-actions">
                      <span className="muted small">
                        {t.headphones || 'Headphones not recorded'}
                        <Info align="left">Earshot's own uncalibrated scale (dB; higher = harder to hear). Only differences between your own tests mean anything. Small numbers: change from your baseline. NR: no response at the loudest level.</Info>
                      </span>
                      {confirm !== t.id && <button className="secondary" onClick={() => setConfirm(t.id)}>Delete…</button>}
                    </div>
                    {confirm === t.id && (
                      <div className="confirm-row">
                        <span>Delete this test? This can't be undone.</span>
                        <div className="confirm-buttons">
                          <button className="secondary" onClick={() => setConfirm(null)}>Keep</button>
                          <button className="danger-btn" onClick={() => { onDelete(t.id); setConfirm(null); setExpanded(null); }}>Delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </Sheet>
      )}
    </div>
  );
}
