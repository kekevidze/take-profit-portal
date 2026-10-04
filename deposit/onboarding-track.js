/**
 * Include on any post-deposit guide page. Tracks open + scroll when enabled in manager settings.
 */

import { fetchOnboardingGuideAccess, renderGuideBlockedPage } from './onboarding-access.js';

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

async function postGuideEvent(sessionId, body) {
  try {
    await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/onboarding-guide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (e) {
    console.warn('Onboarding guide telemetry failed', e);
  }
}

function computeScrollPercent() {
  const doc = document.documentElement;
  const scrollTop = window.scrollY || doc.scrollTop;
  const viewport = window.innerHeight;
  const full = doc.scrollHeight - viewport;
  if (full <= 0) return 100;
  return Math.min(100, Math.round((scrollTop / full) * 100));
}

export async function initOnboardingGuideTracking(options = {}) {
  const sessionId = getQueryParam('session');
  if (!sessionId) return;

  const access = await fetchOnboardingGuideAccess(sessionId);
  if (!access.allowed) {
    renderGuideBlockedPage(access.title || 'Website under technical renovation');
    return;
  }

  const bar = options.progressBarEl;
  const sentinel = options.endSentinelEl;

  let trackScroll = false;
  try {
    const res = await fetch('/api/onboarding-guide/config');
    if (res.ok) {
      const cfg = await res.json();
      trackScroll = cfg.trackScrollCompletion === true;
    }
  } catch (_) {
    /* ignore */
  }

  await postGuideEvent(sessionId, { event: 'opened' });

  let lastSent = -1;
  let scrollTimer = null;

  const sendScroll = () => {
    if (!trackScroll) return;
    const pct = computeScrollPercent();
    if (bar) bar.style.width = `${pct}%`;
    if (pct <= lastSent && pct < 95) return;
    if (pct - lastSent < 5 && pct < 95) return;
    lastSent = pct;
    void postGuideEvent(sessionId, { event: 'scroll', scrollPercent: pct });
  };

  const onScroll = () => {
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(sendScroll, 400);
  };

  window.addEventListener('scroll', onScroll, { passive: true });

  if (sentinel && trackScroll && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void postGuideEvent(sessionId, { event: 'scroll', scrollPercent: 100 });
          if (bar) bar.style.width = '100%';
        }
      },
      { root: null, threshold: 0.5 }
    );
    observer.observe(sentinel);
  }

  sendScroll();
}
