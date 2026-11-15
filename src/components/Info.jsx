// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Explanations, sources and disclaimers: a large "?" next to what they explain, opening a sheet.
import { useState } from 'react';
import Sheet from './Sheet.jsx';

export default function Info({ children, label = 'Why and where from' }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="qinfo">
      <button className="info-btn" aria-label={label} onClick={(e) => { e.stopPropagation(); setOpen(true); }}>?</button>
      {open && (
        <Sheet title={label} onClose={() => setOpen(false)}>
          <div className="info-text">{children}</div>
        </Sheet>
      )}
    </span>
  );
}
