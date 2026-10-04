import { initOnboardingGuideTracking } from './onboarding-track.js';

document.addEventListener('DOMContentLoaded', () => {
  const sessionId = new URLSearchParams(window.location.search).get('session');
  if (!sessionId) {
    const lead = document.querySelector('.welcome-lead');
    if (lead) {
      lead.textContent =
        'Thank you for completing your deposit. Your account manager will follow up with next steps.';
    }
    return;
  }

  initOnboardingGuideTracking({
    endSentinelEl: document.getElementById('welcomeEndSentinel')
  });
});
