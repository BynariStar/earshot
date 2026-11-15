// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// Bottom tab bar on every screen size: Station · Today · My ears · Alerts (with the badge).
const ICONS = {
  station: <><circle cx="12" cy="12" r="3" /><path d="M2 12h7M15 12h7M12 2v7M12 15v7" /></>,
  plan: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M8 14h2M14 14h2M8 18h2" /></>,
  ear: <><path d="M6 8.5a6 6 0 0 1 12 0c0 3.5-2.5 4.6-3.5 6.3-.9 1.6-.6 3.2-1.8 4.4A3 3 0 0 1 7.5 18" /><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.6-1.6 2.2-2 3.3" /></>,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>,
};
const Icon = ({ name }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {ICONS[name]}
  </svg>
);

export default function TabBar({ section, go, onAlerts, badge, badgeLevel }) {
  const tab = (id, label, icon, onClick, active) => (
    <button key={id} className={`tab${active ? ' on' : ''}`} onClick={onClick} aria-current={active ? 'page' : undefined}>
      <span className="tab-icon">
        <Icon name={icon} />
        {id === 'alerts' && badge > 0 && <span className={`count ${badgeLevel}`}>{badge}</span>}
      </span>
      <span>{label}</span>
    </button>
  );
  return (
    <nav className="tabbar" aria-label="Main">
      {tab('station', 'Station', 'station', () => go(''), !section || section === 'home')}
      {tab('plan', 'Today', 'plan', () => go('plan'), section === 'plan')}
      {tab('ears', 'My ears', 'ear', () => go('ears'), section === 'ears')}
      {tab('alerts', 'Alerts', 'bell', onAlerts, false)}
    </nav>
  );
}
