// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// The (i) pattern: explanations, sources and disclaimers sit behind a small button next to what they explain.
import { useEffect, useRef, useState } from 'react';

export default function Info({ children, label = 'More information', align = 'left' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <span className="info" ref={ref}>
      <button className="info-btn" aria-label={label} aria-expanded={open} onClick={() => setOpen((o) => !o)}>i</button>
      {open && <span className={`info-pop ${align}`} role="note">{children}</span>}
    </span>
  );
}
