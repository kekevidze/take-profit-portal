/**
 * Post-deposit onboarding guide — 24h access window and renovation block page.
 */

export async function fetchOnboardingGuideAccess(sessionId) {
  if (!sessionId) {
    return { allowed: false, expired: false, title: 'Unable to open onboarding guide', message: 'Invalid session.' };
  }
  try {
    const res = await fetch(
      `/api/onboarding-guide/access?session=${encodeURIComponent(sessionId)}`
    );
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) {
      return {
        allowed: false,
        expired: false,
        title: 'Unable to open onboarding guide',
        message: 'Please refresh the page or contact your account manager if the problem continues.'
      };
    }
    return await res.json();
  } catch {
    return {
      allowed: false,
      expired: false,
      title: 'Unable to open onboarding guide',
      message: 'Please refresh the page or contact your account manager if the problem continues.'
    };
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderGuideBlockedPage(title) {
  const safeTitle = escapeHtml(title);
  document.documentElement.lang = 'en';
  document.body.innerHTML = `
    <div class="modal-backdrop show" style="background-color: #f8fafc; display: flex; align-items: center; justify-content: center; position: fixed; inset: 0; z-index: 9999; font-family: Inter, system-ui, sans-serif;">
      <div class="card text-center" style="max-width: 480px; padding: 32px; display: flex; flex-direction: column; align-items: center; gap: 16px; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 8px 30px rgba(15,23,42,0.08); background: #fff; margin: 24px;">
        <div style="width: 64px; height: 64px; border-radius: 50%; background-color: rgba(245, 158, 11, 0.12); border: 1.5px solid rgba(245, 158, 11, 0.35); display: flex; align-items: center; justify-content: center; color: #d97706;">
          <svg viewBox="0 0 24 24" width="36" height="36" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
        </div>
        <h2 style="font-weight: 800; letter-spacing: -0.02em; margin: 0; color: #0f172a;">${safeTitle}</h2>
      </div>
    </div>
  `;
}
