// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
export const FLAG = 'earshot.guided';

// Start from a clean simulated session (the crew member's simulated record and schedule; your own tests stay).
export function startGuidedDemo() {
  try {
    ['earshot.session.v1', 'earshot.sim.high.v1', 'earshot.plan.v3', 'earshot.plannedDay'].forEach((k) => localStorage.removeItem(k));
    sessionStorage.setItem(FLAG, '1');
  } catch {
    /* storage unavailable */
  }
  window.location.hash = '#/welcome';
  window.location.reload();
}

