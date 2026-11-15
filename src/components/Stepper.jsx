// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Instead of a slider: large - and + buttons, the value, and preset chips. Nothing needs dragging.
export default function Stepper({ label, value, onChange, step, min, max, presets = [], unit = 'min', format }) {
  const show = format ?? ((v) => `${v} ${unit}`);
  const set = (v) => onChange(Math.max(min, Math.min(max, v)));
  return (
    <div className="stepper">
      <span className="stepper-label">{label}</span>
      <div className="stepper-row">
        <button className="step-btn" onClick={() => set(value - step)} disabled={value <= min} aria-label={`Less ${label}`}>−</button>
        <span className="step-val">{show(value)}</span>
        <button className="step-btn" onClick={() => set(value + step)} disabled={value >= max} aria-label={`More ${label}`}>+</button>
        {presets.map((p) => (
          <button key={p} className={`chip-btn${p === value ? ' on' : ''}`} onClick={() => set(p)}>{show(p)}</button>
        ))}
      </div>
    </div>
  );
}
