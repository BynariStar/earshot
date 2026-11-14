// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Compact "How unusual is this?" list: one line per dataset, verdict first.
export default function ContextStrip({ rows, onMore }) {
  return (
    <div className="context-strip">
      <h3>How unusual is this?</h3>
      <ul>
        {rows.map((r) => (
          <li key={r.id} className={`ctx ${r.level}`}>
            <span className="ctx-q">{r.question}</span>
            <span className="ctx-v">{r.verdict}</span>
          </li>
        ))}
      </ul>
      {onMore && (
        <button className="link-button" onClick={onMore}>
          See the full comparison and sources
        </button>
      )}
    </div>
  );
}
