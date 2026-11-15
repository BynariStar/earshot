// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Instead of a small dropdown: a large button showing the current choice, opening a sheet of large rows.
import { useState } from 'react';
import Sheet from './Sheet.jsx';

export default function Picker({ label, value, options, onChange, className = '' }) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <>
      <button className={`picker ${className}`} onClick={() => setOpen(true)}>
        <span className="picker-label">{label}</span>
        <span className="picker-value">{current?.label ?? 'Choose'}</span>
        <span aria-hidden="true">›</span>
      </button>
      {open && (
        <Sheet title={label} onClose={() => setOpen(false)}>
          <div className="rows">
            {options.map((o) => (
              <button key={String(o.value)} className={`row${o.value === value ? ' on' : ''}`} onClick={() => { onChange(o.value); setOpen(false); }}>
                <span>{o.label}{o.note && <span className="muted small"> {o.note}</span>}</span>
                {o.value === value && <span aria-hidden="true">✓</span>}
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </>
  );
}
