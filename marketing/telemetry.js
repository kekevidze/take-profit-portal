const VISITOR_STORAGE_KEY = 'anon_visitor_id';
let visitorId = '';
let currentSection = '';
let sectionTimer = 0;

function browserName() {
  const ua = navigator.userAgent;
  if (/Edg/i.test(ua)) return 'Edge';
  if (/Chrome/i.test(ua)) return 'Chrome';
  if (/Firefox/i.test(ua)) return 'Firefox';
  if (/Safari/i.test(ua)) return 'Safari';
  return 'Unknown';
}

function osName() {
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Mac/i.test(ua)) return 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Unknown';
}

function deviceType() {
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop';
}

function scrollPercent() {
  const available = document.documentElement.scrollHeight - innerHeight;
  return available > 0 ? Math.round((scrollY / available) * 100) : 0;
}

function sectionName(element) {
  if (element.id) return element.id.replace(/[-_]+/g, ' ');
  const heading = element.querySelector('h1, h2, [aria-label]');
  return (heading?.textContent || heading?.getAttribute?.('aria-label') || 'Marketing page')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 80);
}

async function postJson(url, body, keepalive = false) {
  if (!visitorId && !url.endsWith('/track')) return;
  try {
    return await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive
    });
  } catch (_) {
    return null;
  }
}

async function detectCountryByIp() {
  try {
    const response = await fetch('https://ipapi.co/json/');
    if (!response.ok) return '';
    const data = await response.json();
    return typeof data.country_code === 'string' ? data.country_code.toUpperCase() : '';
  } catch (_) {
    return '';
  }
}

async function startTelemetry() {
  const params = new URLSearchParams(location.search);
  const ref = (params.get('ref') || params.get('agent') || sessionStorage.getItem('demoAgentRef') || '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 64);
  const utmParams = {
    source: params.get('utm_source') || undefined,
    medium: params.get('utm_medium') || undefined,
    campaign: params.get('utm_campaign') || undefined,
    term: params.get('utm_term') || undefined,
    content: params.get('utm_content') || undefined
  };
  const ipCountry = await detectCountryByIp();
  const response = await postJson('/api/sessions/track', {
    ref,
    visitorId: localStorage.getItem(VISITOR_STORAGE_KEY) || '',
    path: `${location.pathname}${location.hash || ''}`,
    referrer: document.referrer || '',
    utmParams,
    ipCountry,
    fingerprint: {
      browser: browserName(),
      os: osName(),
      device: deviceType(),
      screen: `${screen.width}x${screen.height}`,
      language: navigator.language || 'en-US'
    }
  });
  if (!response?.ok) return '';
  const session = await response.json();
  visitorId = session.id;
  window.marketingVisitorId = visitorId;
  window.marketingCountry = session.client?.country || '';
  localStorage.setItem(VISITOR_STORAGE_KEY, visitorId);
  observeSections();
  return visitorId;
}

function reportSection(name) {
  if (!visitorId || !name || name === currentSection) return;
  clearTimeout(sectionTimer);
  sectionTimer = window.setTimeout(() => {
    currentSection = name;
    postJson(`/api/sessions/${encodeURIComponent(visitorId)}/marketing-activity`, {
      section: name,
      scrollPercent: scrollPercent()
    });
  }, 650);
}

function observeSections() {
  const sections = [...document.querySelectorAll('main > section[id], main > section:not([id])')];
  if (!('IntersectionObserver' in window) || !sections.length) {
    reportSection('Marketing page');
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter(entry => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (visible) reportSection(sectionName(visible.target));
  }, { threshold: [0.3, 0.55, 0.8], rootMargin: '-10% 0px -25% 0px' });
  sections.forEach(section => observer.observe(section));
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('a, button, [role="button"], input[type="submit"]');
  if (!target || !visitorId) return;
  const elementText = (target.getAttribute('aria-label') || target.textContent || target.value || target.title || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 80);
  const elementId = (target.id || target.dataset.action || target.getAttribute('href') || target.className || target.tagName)
    .toString()
    .replace(/[?#].*$/, '')
    .slice(0, 120);
  postJson(`/api/sessions/${encodeURIComponent(visitorId)}/click`, { elementId, elementText }, true);
});

document.addEventListener('visibilitychange', () => {
  if (!visitorId) return;
  const action = document.visibilityState === 'hidden' ? 'leave' : 'reconnect';
  postJson(`/api/sessions/${encodeURIComponent(visitorId)}/${action}`, {
    event: document.visibilityState === 'hidden' ? 'Visitor left marketing page' : 'Visitor returned to marketing page'
  }, true);
});

window.marketingSessionReady = startTelemetry();
