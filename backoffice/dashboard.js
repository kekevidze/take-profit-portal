/**
 * dashboard.js
 * Operations Control Center.
 * Handles live KPI tracking, session list auditing, search filtering, and custom audio chime notifications.
 */

import { initThemeToggle, $, $all, openModal } from '../js/core/ui.js';
import { formatTimeAgo, playNotificationSound, copyToClipboard } from '../js/utils/helpers.js';
import { formatCurrency, formatDateTime } from '../js/utils/formatters.js';
import { SESSION_STATUS, PRIORITY, COUNTRIES, CONFIG } from '../js/utils/constants.js';
import { sessionService } from '../js/services/sessionService.js';
import { realtimeService } from '../js/services/realtimeService.js';
import { analyticsService } from '../js/services/analyticsService.js';
import { notificationService } from '../js/services/notificationService.js';
import { SessionCard } from '../js/components/sessionCard.js';
import { StatusBadge } from '../js/components/statusBadge.js';
import { Modal, maskCardNumber } from '../js/components/modal.js';
import { ProgressBar } from '../js/components/progressBar.js';
import { Timeline } from '../js/components/timeline.js';

let sessions = [];
let activeSessionId = null;
let currentFilter = 'all';
let searchQuery = '';
let currentSort = 'activity';
let datePreset = 'any';
let dateFrom = '';
let dateTo = '';
let queueToolbarCollapsed = true;
let listDensityCompact = false;
let activeInspectorTab = 'overview';
let activeMainView = 'queue';
let unsubscribeSessionsList = null;
let unsubscribeActiveSession = null;
let notificationsList = [];
let editingAgentId = null;

const VIEW_TITLES = {
  queue: 'Transactions',
  insights: 'Insights',
  team: 'Team',
  settings: 'Settings'
};

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  loadManagerProfile();
  setupNotificationsCenter();
  subscribeToSessionsStream();
  bindQueueViewEvents();
  setupTabListeners();
  setupMobileNav();

  const logoutBtn = $('#logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && activeMainView === 'queue' && sessions.length > 0) {
      sessionService.checkStaleSessions(sessions);
    }
  });

  setInterval(async () => {
    if (document.visibilityState !== 'visible' || activeMainView !== 'queue') return;
    if (sessions.length > 0) await sessionService.checkStaleSessions(sessions);
  }, 15000);

  updateKPICards();
  renderSessionsList();
});

function bindQueueViewEvents() {
  loadDateFilterFromStorage();
  syncDateFilterUI();
  initQueueToolbarCollapse();

  const searchInput = $('#sessions-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim().toLowerCase();
      renderSessionsList();
    });
  }

  const datePresetSelect = $('#sessions-date-preset');
  if (datePresetSelect) {
    datePresetSelect.addEventListener('change', (e) => {
      datePreset = e.target.value || 'any';
      persistDateFilter();
      syncDateFilterUI();
      renderSessionsList();
    });
  }

  const dateFromInput = $('#sessions-date-from');
  const dateToInput = $('#sessions-date-to');
  const onCustomDateChange = () => {
    dateFrom = dateFromInput?.value || '';
    dateTo = dateToInput?.value || '';
    if (dateFrom && dateTo && dateFrom > dateTo) {
      notificationService.showToast('Invalid date range', 'From date must be on or before To date.', 'warning');
      return;
    }
    persistDateFilter();
    renderSessionsList();
  };
  if (dateFromInput) dateFromInput.addEventListener('change', onCustomDateChange);
  if (dateToInput) dateToInput.addEventListener('change', onCustomDateChange);

  $all('.filter-tag').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget;
      $all('.filter-tag').forEach(b => b.classList.remove('active'));
      target.classList.add('active');
      currentFilter = target.dataset.filter;
      renderSessionsList();
    });
  });

  const sortSelect = $('#sessions-sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      renderSessionsList();
    });
  }

  const exportBtn = $('#export-csv-btn');
  if (exportBtn) exportBtn.addEventListener('click', exportCompletedToCSV);

  const densityBtn = $('#density-toggle-btn');
  if (densityBtn) {
    densityBtn.addEventListener('click', () => {
      listDensityCompact = !listDensityCompact;
      densityBtn.textContent = listDensityCompact ? 'Comfortable' : 'Compact';
      const list = $('#sessions-list-wrapper');
      if (list) list.classList.toggle('density-compact', listDensityCompact);
    });
  }

  $all('.inspector-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      setInspectorTab(tab.dataset.inspectorTab);
    });
  });

  const backBtn = $('#inspector-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      closeMobileInspector();
      if (activeSessionId) selectSession(activeSessionId);
    });
  }

  const overflowBtn = $('#inspector-overflow-btn');
  const overflowMenu = $('#inspector-overflow-menu');
  if (overflowBtn && overflowMenu) {
    overflowBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = overflowMenu.classList.toggle('hidden');
      overflowBtn.setAttribute('aria-expanded', String(!open));
    });
    document.addEventListener('click', () => {
      overflowMenu.classList.add('hidden');
      overflowBtn.setAttribute('aria-expanded', 'false');
    });
    overflowMenu.addEventListener('click', (e) => e.stopPropagation());
  }
}

function setupMobileNav() {
  const menuBtn = $('#mobile-menu-btn');
  const sidebar = $('#app-sidebar');
  const backdrop = $('#sidebar-backdrop');
  const closeSidebar = () => {
    sidebar?.classList.remove('open');
    backdrop?.classList.remove('show');
    backdrop?.classList.add('hidden');
  };
  menuBtn?.addEventListener('click', () => {
    sidebar?.classList.toggle('open');
    backdrop?.classList.toggle('hidden');
    backdrop?.classList.toggle('show');
  });
  backdrop?.addEventListener('click', closeSidebar);
  $all('.nav-item[data-tab]').forEach(item => {
    item.addEventListener('click', closeSidebar);
  });
}

function openMobileInspector() {
  $('#sessions-detail-pane')?.classList.add('inspector-open');
  $('.queue-list-column')?.classList.add('inspector-open');
}

function closeMobileInspector() {
  $('#sessions-detail-pane')?.classList.remove('inspector-open');
  $('.queue-list-column')?.classList.remove('inspector-open');
}

function setInspectorTab(tabId) {
  activeInspectorTab = tabId;
  $all('.inspector-tab').forEach(t => {
    const active = t.dataset.inspectorTab === tabId;
    t.classList.toggle('active', active);
    t.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  $all('.inspector-panel-body').forEach(panel => {
    panel.classList.toggle('hidden', panel.dataset.panel !== tabId);
  });
}

/**
 * Fetch and load manager profile details
 */
async function loadManagerProfile() {
  try {
    let user;
    try {
      const response = await fetch('/api/auth/me');
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || contentType.includes('text/html')) {
        const localUser = sessionStorage.getItem('current_user') || localStorage.getItem('current_user');
        if (localUser) {
          user = JSON.parse(localUser);
        } else {
          window.location.href = '/login/index.html';
          return;
        }
      } else {
        const data = await response.json();
        user = data.user;
      }
    } catch (e) {
      const localUser = sessionStorage.getItem('current_user') || localStorage.getItem('current_user');
      if (localUser) {
        user = JSON.parse(localUser);
      } else {
        window.location.href = '/login/index.html';
        return;
      }
    }

    if (user) {
      const nameEl = $('#manager-profile-name');
      const roleEl = $('#manager-profile-role');
      const avatarEl = $('#manager-avatar');

      if (nameEl) nameEl.textContent = `${user.firstName} ${user.lastName}`;
      if (roleEl) roleEl.textContent = user.role === 'Manager' ? 'Super Administrator' : 'Sales Representative';
      if (avatarEl) {
        avatarEl.textContent = user.firstName.charAt(0).toUpperCase();
      }
    }
  } catch (error) {
    console.error('Failed to load manager profile:', error);
  }
}

/**
 * Handle manager log out
 */
async function handleLogout() {
  try {
    sessionStorage.removeItem('current_user');
    localStorage.removeItem('current_user');
    const response = await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login/index.html';
  } catch (error) {
    console.error('Logout failed:', error);
    window.location.href = '/login/index.html';
  }
}

/**
 * Setup Realtime sessions subscription stream
 */
function subscribeToSessionsStream() {
  if (unsubscribeSessionsList) unsubscribeSessionsList();

  unsubscribeSessionsList = sessionService.subscribeToAllSessions((updatedSessions) => {
    // Detect changes to show Toast alerts and play chimes!
    detectNewEventsAndAlert(updatedSessions);

    sessions = updatedSessions;
    
    updateKPICards();
    if (activeMainView === 'insights') renderInsightsView();
    renderSessionsList();

    // Redraw details pane if active
    if (activeSessionId) {
      renderDetailsPane();
    }
  });
}

/**
 * Detect changes (like page open, ready, complete) to play sound alerts
 */
function detectNewEventsAndAlert(newSessionsList) {
  if (sessions.length === 0) return; // Ignore initial load baseline
  
  newSessionsList.forEach(newSession => {
    const oldSession = sessions.find(s => s.id === newSession.id);
    if (!oldSession) {
      // Brand new session created by an agent
      triggerAlert('New Lead Registered', `Client ${newSession.client.firstName || ''} ${newSession.client.lastName || ''} was registered under ${newSession.agent}.`, 'info');
      return;
    }

    // State Transitions
    if (newSession.status !== oldSession.status) {
      if (newSession.status === SESSION_STATUS.OPENED) {
        triggerAlert('Client Connected', `Client ${newSession.client.firstName || 'Anonymous'} has opened the deposit page.`, 'success');
      } else if (newSession.status === SESSION_STATUS.READY) {
        triggerAlert('Form Pre-Qualified', `Client ${newSession.client.firstName || 'Anonymous'} has successfully completed all billing fields.`, 'warning');
      } else if (newSession.status === SESSION_STATUS.SUBMITTED) {
        triggerAlert('Transaction Processing', `Client ${newSession.client.firstName || 'Anonymous'} is submitting card details...`, 'info');
      } else if (newSession.status === SESSION_STATUS.COMPLETED) {
        triggerAlert('Deposit Settled!', `Payment processed successfully for ${newSession.client.firstName || 'Anonymous'}.`, 'success');
      } else if (newSession.status === SESSION_STATUS.DISCONNECTED) {
        triggerAlert('Client Connection Lost', `The active connection for ${newSession.client.firstName || 'Anonymous'} has dropped.`, 'danger');
      }
    }
  });
}

function triggerAlert(title, body, type) {
  // 1. Render custom animated toast and play high-quality sound chime
  notificationService.showToast(title, body, type);

  // 2. Append to operations notification center list
  notificationsList.unshift({
    id: 'notif-' + Date.now() + Math.random().toString(36).substring(3, 7),
    title,
    body,
    timestamp: Date.now(),
    type
  });

  updateNotificationsUI();
}

/**
 * Redraw global metric cards
 */
function startOfLocalDay(dateValue = new Date()) {
  const d = new Date(dateValue);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfLocalDay(dateValue = new Date()) {
  const d = new Date(dateValue);
  d.setHours(23, 59, 59, 999);
  return d;
}

function isSameLocalDay(dateValue, reference = new Date()) {
  const d = new Date(dateValue);
  return d.getDate() === reference.getDate() &&
    d.getMonth() === reference.getMonth() &&
    d.getFullYear() === reference.getFullYear();
}

function parseDateInputValue(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [y, m, day] = dateStr.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  if (d.getFullYear() !== y || d.getMonth() !== m - 1 || d.getDate() !== day) return null;
  return d;
}

function resolveDateRange(preset, fromStr, toStr) {
  const now = new Date();
  if (!preset || preset === 'any') return null;

  if (preset === 'today') {
    return { startMs: startOfLocalDay(now).getTime(), endMs: endOfLocalDay(now).getTime() };
  }
  if (preset === 'yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { startMs: startOfLocalDay(y).getTime(), endMs: endOfLocalDay(y).getTime() };
  }
  if (preset === '7d') {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    return { startMs: startOfLocalDay(start).getTime(), endMs: endOfLocalDay(now).getTime() };
  }
  if (preset === '30d') {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    return { startMs: startOfLocalDay(start).getTime(), endMs: endOfLocalDay(now).getTime() };
  }
  if (preset === 'custom') {
    const fromD = parseDateInputValue(fromStr);
    const toD = parseDateInputValue(toStr);
    if (!fromD || !toD) return null;
    if (fromStr > toStr) return null;
    return { startMs: startOfLocalDay(fromD).getTime(), endMs: endOfLocalDay(toD).getTime() };
  }
  return null;
}

function sessionCreatedInRange(session, range) {
  if (!session?.createdAt || !range) return false;
  const t = new Date(session.createdAt).getTime();
  if (Number.isNaN(t)) return false;
  return t >= range.startMs && t <= range.endMs;
}

function isDateFilterActive() {
  return resolveDateRange(datePreset, dateFrom, dateTo) !== null;
}

function loadDateFilterFromStorage() {
  try {
    const storedPreset = sessionStorage.getItem('manager_date_preset');
    if (storedPreset) datePreset = storedPreset;
    dateFrom = sessionStorage.getItem('manager_date_from') || '';
    dateTo = sessionStorage.getItem('manager_date_to') || '';
  } catch (e) {
    /* ignore */
  }
}

function persistDateFilter() {
  try {
    sessionStorage.setItem('manager_date_preset', datePreset);
    sessionStorage.setItem('manager_date_from', dateFrom);
    sessionStorage.setItem('manager_date_to', dateTo);
  } catch (e) {
    /* ignore */
  }
}

function syncDateFilterUI() {
  const presetEl = $('#sessions-date-preset');
  const fromEl = $('#sessions-date-from');
  const toEl = $('#sessions-date-to');
  const customWrap = $('#sessions-date-custom');
  if (presetEl) presetEl.value = datePreset;
  if (fromEl) fromEl.value = dateFrom;
  if (toEl) toEl.value = dateTo;
  if (customWrap) customWrap.classList.toggle('hidden', datePreset !== 'custom');
}

function initQueueToolbarCollapse() {
  try {
    const stored = sessionStorage.getItem('manager_queue_toolbar_collapsed');
    queueToolbarCollapsed = stored === null ? true : stored === '1';
  } catch (e) {
    queueToolbarCollapsed = true;
  }

  const toggle = $('#queue-toolbar-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      queueToolbarCollapsed = !queueToolbarCollapsed;
      try {
        sessionStorage.setItem('manager_queue_toolbar_collapsed', queueToolbarCollapsed ? '1' : '0');
      } catch (e) {
        /* ignore */
      }
      applyQueueToolbarCollapsedState();
    });
  }
  applyQueueToolbarCollapsedState();
}

function applyQueueToolbarCollapsedState() {
  const toolbar = $('#queue-toolbar');
  const toggle = $('#queue-toolbar-toggle');
  if (toolbar) toolbar.classList.toggle('is-collapsed', queueToolbarCollapsed);
  if (toggle) toggle.setAttribute('aria-expanded', String(!queueToolbarCollapsed));
  updateQueueToolbarCollapsedHint();
}

function updateQueueToolbarCollapsedHint() {
  const hint = $('#queue-toolbar-collapsed-hint');
  if (!hint) return;
  if (!queueToolbarCollapsed) {
    hint.textContent = '';
    hint.setAttribute('aria-hidden', 'true');
    return;
  }
  const parts = [];
  const activeFilter = document.querySelector('.filter-tag.active');
  if (activeFilter) parts.push(activeFilter.textContent.trim());
  const dateSummary = $('#sessions-date-summary')?.textContent?.trim();
  if (dateSummary) parts.push(dateSummary);
  if (searchQuery) parts.push(`Search: “${searchQuery}”`);
  hint.textContent = parts.join(' · ') || 'Expanded view hidden';
  hint.setAttribute('aria-hidden', 'false');
}

function updateDateFilterSummary(matchCount) {
  const el = $('#sessions-date-summary');
  if (!el) return;

  const parts = [];
  if (typeof matchCount === 'number') {
    parts.push(`Showing ${matchCount} transaction${matchCount === 1 ? '' : 's'}`);
  }

  const range = resolveDateRange(datePreset, dateFrom, dateTo);
  if (range) {
    const fmt = (ms) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    parts.push(`${fmt(range.startMs)} – ${fmt(range.endMs)}`);
  } else if (datePreset === 'custom' && (dateFrom || dateTo)) {
    parts.push('Select both From and To dates');
  }

  el.textContent = parts.join(' · ');
}

function countCompletedToday(allSessions) {
  return allSessions.filter(s =>
    s.status === SESSION_STATUS.COMPLETED &&
    isSameLocalDay(s.updatedAt || s.createdAt)
  ).length;
}

function dailySuccessRatePercent(allSessions) {
  const todaySessions = allSessions.filter(s => isSameLocalDay(s.createdAt));
  if (todaySessions.length === 0) return 0;
  const completed = todaySessions.filter(s => s.status === SESSION_STATUS.COMPLETED).length;
  return Math.round((completed / todaySessions.length) * 100);
}

function countInProgress(allSessions) {
  return allSessions.filter(s =>
    s.status !== SESSION_STATUS.COMPLETED &&
    s.status !== SESSION_STATUS.DISCONNECTED &&
    (s.progress?.percent || 0) > 0
  ).length;
}

function updateKPICards() {
  const metrics = analyticsService.getOverviewMetrics(sessions);
  const activeSessionsEl = $('#metric-active-sessions');
  const inProgressEl = $('#metric-in-progress');
  const completedTodayEl = $('#metric-completed-today');
  const successRateEl = $('#metric-success-rate');
  if (activeSessionsEl) activeSessionsEl.textContent = metrics.activeSessions;
  if (inProgressEl) inProgressEl.textContent = countInProgress(sessions);
  if (completedTodayEl) completedTodayEl.textContent = countCompletedToday(sessions);
  if (successRateEl) successRateEl.textContent = `${dailySuccessRatePercent(sessions)}%`;
}

function getFilteredSessions() {
  let filtered = sessions;

  if (currentFilter === 'online') {
    filtered = filtered.filter(s => s.connection === 'online');
  } else if (currentFilter === 'deposits') {
    filtered = filtered.filter(s => !s.isAnonymous && s.id.startsWith('DEP-'));
  } else if (currentFilter === 'anonymous') {
    filtered = filtered.filter(s => s.isAnonymous);
  } else if (currentFilter === 'high-priority') {
    filtered = filtered.filter(s => s.priority === PRIORITY.HIGH);
  } else if (currentFilter !== 'all') {
    filtered = filtered.filter(s => s.status === currentFilter);
  }

  const dateRange = resolveDateRange(datePreset, dateFrom, dateTo);
  if (dateRange) {
    filtered = filtered.filter(s => sessionCreatedInRange(s, dateRange));
  }

  if (searchQuery) {
    filtered = filtered.filter(s => {
      const client = s.client || {};
      const name = `${client.firstName || ''} ${client.lastName || ''}`.toLowerCase();
      const email = (client.email || '').toLowerCase();
      const id = s.id.toLowerCase();
      const agent = (s.agent || '').toLowerCase();
      const campaign = (s.campaignName || '').toLowerCase();
      return name.includes(searchQuery) || email.includes(searchQuery) ||
        id.includes(searchQuery) || agent.includes(searchQuery) || campaign.includes(searchQuery);
    });
  }

  filtered.sort((a, b) => {
    if (currentSort === 'progress') {
      return (b.progress?.percent || 0) - (a.progress?.percent || 0);
    }
    if (currentSort === 'agent') {
      return (a.agent || '').localeCompare(b.agent || '');
    }
    if (a.connection === 'online' && b.connection !== 'online') return -1;
    if (a.connection !== 'online' && b.connection === 'online') return 1;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });

  return filtered;
}

/**
 * Renders sessions browser list
 */
function renderSessionsList() {
  const wrapper = $('#sessions-list-wrapper');
  if (!wrapper) return;

  const filtered = getFilteredSessions();
  updateDateFilterSummary(filtered.length);
  updateQueueToolbarCollapsedHint();

  wrapper.innerHTML = '';
  if (filtered.length === 0) {
    const dateHint = isDateFilterActive()
      ? '<p style="margin-top: 8px; font-size: 0.8rem;">Try widening the date range.</p>'
      : '';
    wrapper.innerHTML = `
      <div class="text-center text-tertiary" style="padding: var(--spacing-xl) 0; font-size: 0.85rem;">
        No sessions matched criteria.
        ${dateHint}
      </div>
    `;
    return;
  }

  filtered.forEach(session => {
    const cardHtml = SessionCard.renderHTML(session, session.id === activeSessionId);
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = cardHtml;
    const cardEl = tempDiv.firstElementChild;
    
    // Select click binding
    cardEl.addEventListener('click', () => {
      selectSession(session.id);
    });

    wrapper.appendChild(cardEl);
  });
}

function selectSession(id) {
  if (activeSessionId === id) {
    activeSessionId = null;
    closeMobileInspector();
    $('#detail-placeholder')?.classList.remove('hidden');
    $('#detail-card-view')?.classList.add('hidden');
    renderSessionsList();
    return;
  }

  activeSessionId = id;
  activeInspectorTab = 'overview';
  $('#detail-placeholder')?.classList.add('hidden');
  $('#detail-card-view')?.classList.remove('hidden');
  openMobileInspector();
  renderDetailsPane();
  renderSessionsList();
}

function formatInspectorLeadTitle(session) {
  const client = session?.client || {};
  const fullName = `${(client.firstName || '').trim()} ${(client.lastName || '').trim()}`.trim();
  if (fullName) return fullName;
  const email = (client.email || '').trim();
  if (email) return email;
  return session?.id || '—';
}

/**
 * Renders detailed inspection details for the selected session
 */
function renderDetailsPane() {
  const session = sessions.find(s => s.id === activeSessionId);
  if (!session) return;

  // Guard: return early if the details pane is not currently in the DOM (e.g. on other tabs)
  const ind = $('#detail-live-indicator');
  if (!ind) return;

  const client = session.client || {};
  const payment = session.payment || {};
  const isOnline = session.connection === 'online';

  // 1. Connection Header
  if (isOnline) {
    ind.classList.remove('hidden');
    ind.style.display = 'inline-flex';
  } else {
    ind.classList.add('hidden');
    ind.style.display = 'none';
  }
  const displayTitle = formatInspectorLeadTitle(session);
  const titleEl = $('#detail-session-id');
  if (titleEl) {
    titleEl.textContent = displayTitle;
    titleEl.classList.toggle('mono', displayTitle === session.id);
  }
  const headerStatus = $('#detail-header-status');
  if (headerStatus) {
    headerStatus.innerHTML = StatusBadge.renderHTML(session.status || 'Waiting');
  }

  $('#inspector-overflow-menu')?.classList.add('hidden');
  $('#inspector-overflow-btn')?.setAttribute('aria-expanded', 'false');
  // 2. Client biography
  const countryData = COUNTRIES.find(c => c.code === client.country) || {};
  $('#d-firstName').textContent = client.firstName || '—';
  $('#d-lastName').textContent = client.lastName || '—';
  $('#d-email').textContent = client.email || '—';
  $('#d-phone').textContent = client.phone || '—';
  $('#d-country').textContent = countryData.name ? `${countryData.flag} ${countryData.name}` : '—';
  $('#d-city').textContent = client.city || '—';
  
  const dCampaign = $('#d-campaignName');
  if (dCampaign) {
    dCampaign.textContent = session.campaignName || 'Place Order';
  }

  const dOnboardingLink = $('#d-onboardingLink');
  if (dOnboardingLink) {
    const sessionCampaign = session.campaignName || 'Place Order';
    const linkUrl = `${window.location.origin}/deposit/index.html?session=${session.id}&campaignName=${encodeURIComponent(sessionCampaign)}`;
    dOnboardingLink.innerHTML = `
      <a href="${linkUrl}" target="_blank" class="text-accent hover:underline font-mono" style="font-size: 0.75rem; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block; vertical-align: middle;" title="${linkUrl}">${session.id}</a>
      <button class="btn btn-icon btn-sm" id="copy-backoffice-link-btn" title="Copy Link" style="width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; background: var(--surface-hover); border: 1px solid var(--border); border-radius: 4px; cursor: pointer; color: var(--text-secondary); flex-shrink: 0;">
        <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
      </button>
    `;
    const copyBtn = $('#copy-backoffice-link-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        let ok = false;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          ok = await navigator.clipboard.writeText(linkUrl).then(() => true).catch(() => false);
        }
        if (!ok) {
          // Fallback if browser permission is blocked in iframe
          try {
            const tempInput = document.createElement('input');
            tempInput.value = linkUrl;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand('copy');
            document.body.removeChild(tempInput);
            ok = true;
          } catch (err) {
            console.error(err);
          }
        }
        if (ok) {
          notificationService.showToast('Copied', 'Onboarding URL copied to clipboard.', 'success');
        } else {
          notificationService.showToast('Copy Failed', 'Please manually highlight and copy the link.', 'warning');
        }
      });
    }
  }

  const overviewStatus = $('#detail-overview-status');
  if (overviewStatus) {
    const og = session.onboardingGuide || {};
    const guideExpiresAt =
      og.guideExpiresAt ||
      (session.status === 'Completed' || session.payment?.status === 'Complete'
        ? (session.updatedAt || session.createdAt) + 24 * 60 * 60 * 1000
        : null);
    const guideExpired = guideExpiresAt && Date.now() > guideExpiresAt;
    let guideBadgeClass = 'badge-secondary';
    let guideBadgeText = 'Not opened';
    if (guideExpired) {
      guideBadgeClass = 'badge-danger';
      guideBadgeText = 'Guide expired (24h)';
    } else if (og.completedReadAt) {
      guideBadgeClass = 'badge-success';
      guideBadgeText = 'Read to bottom';
    } else if (og.openedAt) {
      guideBadgeClass = 'badge-warning';
      guideBadgeText =
        typeof og.maxScrollPercent === 'number' && og.maxScrollPercent > 0
          ? `Opened — ${og.maxScrollPercent}% scroll`
          : 'Opened — in progress';
    } else if (guideExpiresAt && (session.status === 'Completed' || session.payment?.status === 'Complete')) {
      guideBadgeText = `Available until ${new Date(guideExpiresAt).toLocaleString()}`;
    }

    overviewStatus.innerHTML = `
      <h3 class="card-title">Link &amp; email status</h3>
      <div class="list-row"><span class="list-row-label">Link</span><span class="list-row-value badge" id="d-link-status">—</span></div>
      <div class="list-row"><span class="list-row-label">Email</span><span class="list-row-value badge" id="d-email-status">—</span></div>
      <div class="list-row"><span class="list-row-label">Onboarding guide</span><span class="list-row-value badge ${guideBadgeClass}" id="d-guide-status">${guideBadgeText}</span></div>
    `;
  }

  const linkStatus = (session.link && session.link.status) || 'Active';
  const emailStatus = (session.client && session.client.emailStatus) || 'Active';

  const linkStatusEl = $('#d-link-status');
  const emailStatusEl = $('#d-email-status');

  if (linkStatusEl) {
    linkStatusEl.textContent = linkStatus.toUpperCase();
    linkStatusEl.className = 'list-row-value badge ' + (linkStatus === 'Inactive' || linkStatus === 'Disabled' ? 'badge-danger' : 'badge-success');
  }
  if (emailStatusEl) {
    emailStatusEl.textContent = emailStatus.toUpperCase();
    emailStatusEl.className = 'list-row-value badge ' + (emailStatus === 'Completed' ? 'badge-success' : 'badge-primary');
  }

  // 3. Card Metadata
  $('#d-cardBrand').textContent = (payment.brand || 'Unknown').toUpperCase();
  
  const displayDigits = (payment.cardNumber && payment.cardNumber !== 'Empty')
    ? maskCardNumber(payment.cardNumber, payment.brand)
    : (payment.digitCount !== undefined ? `${payment.digitCount} / ${payment.brand === 'amex' ? 15 : 16} digits` : '—');
  $('#d-cardDigits').textContent = displayDigits;
  
  const luhnVal = $('#d-cardLuhn');
  luhnVal.textContent = payment.validity || '—';
  luhnVal.className = payment.validity === 'Valid' ? 'text-success font-bold' : (payment.validity === 'Invalid' ? 'text-danger font-bold' : '');

  $('#d-cardExpiry').textContent = payment.expiryValid ? 'Valid Date' : 'Incomplete / Invalid';
  $('#d-cardExpiry').className = payment.expiryValid ? 'text-success font-bold' : 'text-tertiary';

  $('#d-cardCvv').textContent = payment.cvvCompleted ? 'Completed (3-4 Digits)' : 'Incomplete';
  $('#d-cardCvv').className = payment.cvvCompleted ? 'text-success font-bold' : 'text-tertiary';

  const viewCardBtn = $('#view-card-details-btn');
  if (viewCardBtn) {
    viewCardBtn.onclick = () => {
      Modal.showCardDetails(session);
    };
  }

  const deleteSessionBtn = $('#delete-session-btn');
  if (deleteSessionBtn) {
    deleteSessionBtn.onclick = () => {
      Modal.confirm(
        'Delete Session Link',
        `Are you sure you want to permanently delete this secure deposit session (${session.id})? This action will disable the client link and delete all card telemetry, and it cannot be undone.`,
        async () => {
          try {
            const success = await sessionService.deleteSession(session.id);
            if (success && !success.error) {
              notificationService.showToast('Session Deleted', 'The deposit session has been permanently removed.', 'success');
              activeSessionId = null;
              closeMobileInspector();
              $('#detail-placeholder')?.classList.remove('hidden');
              $('#detail-card-view')?.classList.add('hidden');
              renderSessionsList();
            } else {
              notificationService.showToast('Error', success.error || 'Failed to delete deposit session.', 'danger');
            }
          } catch (e) {
            console.error('Failed to delete session:', e);
            notificationService.showToast('Error', 'An unexpected error occurred during deletion.', 'danger');
          }
        }
      );
    };
  }

  // 4. Progress bar
  const percent = (session.progress && session.progress.percent) || 0;
  $('#detail-progress-wrapper').innerHTML = `
    <h3 class="card-title" style="margin-bottom: var(--spacing-sm);">Onboarding Progress</h3>
    ${ProgressBar.renderHTML(percent, session.progress.completed, session.progress.total)}
  `;

  // 5. Incomplete / Missing list
  const missingWrapper = $('#detail-missing-wrapper');
  missingWrapper.innerHTML = `<h3 class="card-title" style="margin-bottom: var(--spacing-sm);">Incomplete Form Fields</h3>`;
  const missingList = getMissingFields(session);
  
  if (missingList.length === 0) {
    missingWrapper.innerHTML += `
      <div class="flex align-center gap-xs text-success" style="font-size: 0.9rem; font-weight: 600;">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        All onboarding fields complete! Ready for settlement.
      </div>
    `;
  } else {
    const listUl = document.createElement('ul');
    listUl.style.display = 'flex';
    listUl.style.flexDirection = 'column';
    listUl.style.gap = '6px';
    listUl.style.paddingLeft = '0';
    listUl.style.listStyle = 'none';

    missingList.forEach(field => {
      const li = document.createElement('li');
      li.style.fontSize = '0.85rem';
      li.style.color = 'var(--text-secondary)';
      li.style.display = 'flex';
      li.style.alignItems = 'center';
      li.style.gap = '8px';
      li.innerHTML = `<span style="width: 6px; height: 6px; background-color: var(--danger); border-radius: 50%;"></span> ${field}`;
      listUl.appendChild(li);
    });
    missingWrapper.appendChild(listUl);
  }

  // 6. Live Timeline logs
  $('#detail-timeline-wrapper').innerHTML = Timeline.renderHTML(session.timeline);

  setupHeaderAssignAgentDropdown(session);
  renderExtraTelemetry(session);
  setInspectorTab(activeInspectorTab);
}

/**
 * Configure and wire up the top-level Assign Agent dropdown in the details pane header card
 */
let cachedAgents = null;

async function setupHeaderAssignAgentDropdown(session) {
  const selectEl = $('#header-assign-agent-select');
  if (!selectEl) return;

  // If the select is currently active (user is looking at it or has it open), do not overwrite it
  if (document.activeElement === selectEl) {
    return;
  }

  // Pre-fetch active agents list if not already in cache
  if (!cachedAgents) {
    try {
      const response = await fetch('/api/agents');
      if (response.ok) {
        cachedAgents = await response.json();
      }
    } catch (e) {
      console.error('Failed to pre-fetch agents in header:', e);
    }
  }

  // Determine current selected value
  let currentAssignedAgentId = session.agentId || "";
  if (!currentAssignedAgentId && session.agent && cachedAgents) {
    const matched = cachedAgents.find(a => 
      session.agent === `Agent ${a.firstName}` || 
      session.agent === `Administrator ${a.firstName}` ||
      session.agent.toLowerCase().includes(a.firstName.toLowerCase())
    );
    if (matched) {
      currentAssignedAgentId = matched.id;
    }
  }

  const isDifferentSession = selectEl.dataset.sessionId !== session.id;

  if (isDifferentSession || selectEl.options.length <= 1) {
    selectEl.dataset.sessionId = session.id;

    let html = '<option value="">Unassigned</option>';
    if (cachedAgents && cachedAgents.length > 0) {
      cachedAgents.forEach(a => {
        const isSelected = (currentAssignedAgentId === a.id);
        const name = `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.email;
        const suffix = a.role === 'Manager' ? ' · Admin' : '';
        html += `<option value="${a.id}" ${isSelected ? 'selected' : ''} title="${a.email}">${name}${suffix}</option>`;
      });
    } else {
      if (session.agent) {
        html += `<option value="" selected style="background-color: var(--surface); color: var(--text-primary);">${session.agent}</option>`;
      }
    }
    selectEl.innerHTML = html;

    // Use onchange directly to ensure we don't need cloneNode() and preserve element identity
    selectEl.onchange = async () => {
      const agentId = selectEl.value;
      try {
        const res = await fetch('/api/sessions/reassign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: session.id, agentId })
        });
        if (res.ok) {
          notificationService.showToast('Lead Reassigned', 'Successfully updated lead ownership.', 'success');
          const updatedSession = await res.json();
          const idx = sessions.findIndex(s => s.id === session.id);
          if (idx !== -1) {
            sessions[idx] = updatedSession;
            renderDetailsPane();
            renderSessionsList();
          }
        } else {
          const errData = await res.json();
          notificationService.showToast('Reassignment Failed', errData.error || 'Server error', 'danger');
          setupHeaderAssignAgentDropdown(session);
        }
      } catch (e) {
        notificationService.showToast('Network Error', 'Could not connect to back office.', 'danger');
        setupHeaderAssignAgentDropdown(session);
      }
    };
  }

  // Ensure value is synchronized correctly with backend state
  if (selectEl.value !== currentAssignedAgentId) {
    selectEl.value = currentAssignedAgentId;
  }
}

/**
 * Renders extra traffic attribution, device signature, interaction streams,
 * and interaction telemetry for the session inspector.
 */
async function renderExtraTelemetry(session) {
  const detailCardView = $('#detail-card-view');
  if (!detailCardView) return;

  // Ensure wrappers exist
  let attrWrapper = $('#detail-attribution-wrapper');
  if (!attrWrapper) {
    attrWrapper = document.createElement('div');
    attrWrapper.id = 'detail-attribution-wrapper';
    attrWrapper.className = 'card flex-col gap-md';
    attrWrapper.style.marginTop = 'var(--spacing-md)';
    detailCardView.appendChild(attrWrapper);
  }

  let interactWrapper = $('#detail-interaction-wrapper');
  if (!interactWrapper) {
    interactWrapper = document.createElement('div');
    interactWrapper.id = 'detail-interaction-wrapper';
    interactWrapper.className = 'card flex-col gap-md';
    interactWrapper.style.marginTop = 'var(--spacing-md)';
    detailCardView.appendChild(interactWrapper);
  }

  // Render Attribution & Device Fingerprint Card
  const fp = session.fingerprint || {};
  const utm = session.utmParams || {};
  
  attrWrapper.innerHTML = `
    <h3 class="card-title" style="margin-bottom: var(--spacing-sm); border-bottom: 1px solid var(--border); padding-bottom: 8px;">Traffic Attribution & Device Fingerprint</h3>
    <div class="grid-2col" style="gap: 20px;">
      <div class="flex-col gap-sm">
        <h4 style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-tertiary); letter-spacing: 0.05em;">Campaign & Referral</h4>
        <div class="list-row"><span class="list-row-label">Tracking ID</span><span class="list-row-value mono" style="font-size: 0.8rem;">${session.trackingId || 'Direct / None'}</span></div>
        <div class="list-row"><span class="list-row-label">Assigned Agent</span><span class="list-row-value">${session.agent || 'None'}</span></div>
        <div class="list-row"><span class="list-row-label">Referrer</span><span class="list-row-value text-truncate" title="${session.referrer || 'Direct visit'}" style="max-width: 180px;">${session.referrer || 'Direct visit'}</span></div>
        <div class="list-row"><span class="list-row-label">UTM Source</span><span class="list-row-value">${utm.source || '—'}</span></div>
        <div class="list-row"><span class="list-row-label">UTM Campaign</span><span class="list-row-value">${utm.campaign || '—'}</span></div>
      </div>
      <div class="flex-col gap-sm">
        <h4 style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-tertiary); letter-spacing: 0.05em;">Device Signature</h4>
        <div class="list-row"><span class="list-row-label">Browser</span><span class="list-row-value">${fp.browser || '—'}</span></div>
        <div class="list-row"><span class="list-row-label">Operating System</span><span class="list-row-value">${fp.os || '—'}</span></div>
        <div class="list-row"><span class="list-row-label">Device Type</span><span class="list-row-value">${fp.device || '—'}</span></div>
        <div class="list-row"><span class="list-row-label">Screen Resolution</span><span class="list-row-value mono" style="font-size: 0.8rem;">${fp.screen || '—'}</span></div>
        <div class="list-row"><span class="list-row-label">Browser Language</span><span class="list-row-value">${fp.language || '—'}</span></div>
      </div>
    </div>
  `;

  // Render Page & Button Action Telemetry Card
  const pageViews = session.pageViews || [];
  const clicks = session.clicks || [];
  
  let pageViewsHTML = pageViews.length === 0 
    ? `<div style="font-size: 0.8rem; color: var(--text-tertiary); font-style: italic;">No page visits recorded.</div>`
    : pageViews.map(pv => `
        <div class="flex justify-between align-center" style="font-size: 0.8rem; border-bottom: 1px solid var(--border); padding: 4px 0;">
          <span class="mono text-truncate" style="max-width: 250px; color: var(--text-secondary);">${pv.path}</span>
          <span style="color: var(--text-tertiary); font-size: 0.75rem;">${new Date(pv.timestamp).toLocaleTimeString()}</span>
        </div>
      `).join('');

  let clicksHTML = clicks.length === 0
    ? `<div style="font-size: 0.8rem; color: var(--text-tertiary); font-style: italic;">No button/link clicks recorded yet.</div>`
    : clicks.map(c => `
        <div class="flex justify-between align-center" style="font-size: 0.8rem; border-bottom: 1px solid var(--border); padding: 4px 0;">
          <span style="color: var(--text-primary); font-weight: 500;">Clicked "${c.elementText || c.elementId}"</span>
          <span style="color: var(--text-tertiary); font-size: 0.75rem;">${new Date(c.timestamp).toLocaleTimeString()}</span>
        </div>
      `).join('');

  interactWrapper.innerHTML = `
    <h3 class="card-title" style="margin-bottom: var(--spacing-sm); border-bottom: 1px solid var(--border); padding-bottom: 8px;">Activity Telemetry & Interaction Stream</h3>
    <div class="grid-2col" style="gap: 20px;">
      <div class="flex-col gap-sm">
        <h4 style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-tertiary); letter-spacing: 0.05em; margin-bottom: 6px;">Page Browsing Sequence (${pageViews.length})</h4>
        <div style="max-height: 150px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;">
          ${pageViewsHTML}
        </div>
      </div>
      <div class="flex-col gap-sm">
        <h4 style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-tertiary); letter-spacing: 0.05em; margin-bottom: 6px;">Click Stream Telemetry (${clicks.length})</h4>
        <div style="max-height: 150px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;">
          ${clicksHTML}
        </div>
      </div>
    </div>
  `;
}

function getMissingFields(session) {
  const missing = [];
  const client = session.client || {};
  const payment = session.payment || {};

  if (!client.firstName) missing.push('Billing First Name');
  if (!client.lastName) missing.push('Billing Last Name');
  if (!client.email) missing.push('Billing Email');
  if (!client.phone) missing.push('Billing Phone Number');
  if (!client.city) missing.push('Billing City');
  if (!payment.digitCount || payment.digitCount < 12) missing.push('Card Number (Clean Digits)');
  if (!payment.expiryValid) missing.push('Expiration Date MM/YY');
  if (!payment.cvvCompleted) missing.push('Card Secure CVV Code');

  return missing;
}

/**
 * Configure Operations Notification Dropdown Utilities
 */
function setupNotificationsCenter() {
  const bellBtn = $('#notification-bell-btn');
  const ddown = $('#notification-dropdown-box');

  bellBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    ddown.classList.toggle('show');
  });

  document.addEventListener('click', () => {
    ddown.classList.remove('show');
  });

  ddown.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  $('#clear-notifications-btn').addEventListener('click', () => {
    notificationsList = [];
    updateNotificationsUI();
  });
}

function updateNotificationsUI() {
  const listWrapper = $('#notification-list-wrapper');
  const countBadge = $('#notification-count-badge');

  if (notificationsList.length === 0) {
    listWrapper.innerHTML = `
      <div class="text-center text-tertiary" style="padding: var(--spacing-lg) 0; font-size: 0.8rem;">No new notifications.</div>
    `;
    countBadge.classList.add('hidden');
    countBadge.textContent = '0';
    return;
  }

  countBadge.classList.remove('hidden');
  countBadge.textContent = notificationsList.length;

  listWrapper.innerHTML = notificationsList.map(n => {
    let colorStyle = 'color: var(--primary);';
    if (n.type === 'success') colorStyle = 'color: var(--success);';
    else if (n.type === 'warning') colorStyle = 'color: var(--warning);';
    else if (n.type === 'danger') colorStyle = 'color: var(--danger);';

    return `
      <div class="list-row" style="align-items: flex-start; gap: 8px;">
        <div style="width: 6px; height: 6px; border-radius: 50%; background-color: currentColor; margin-top: 6px; ${colorStyle}"></div>
        <div class="flex-1" style="min-width: 0;">
          <h5 style="font-size: 0.8rem; font-weight: 700; color: var(--text-primary); margin-bottom: 1px;">${n.title}</h5>
          <p class="text-truncate" style="font-size: 0.75rem; color: var(--text-secondary);">${n.body}</p>
        </div>
        <span style="font-size: 0.7rem; color: var(--text-tertiary); align-self: flex-end;">${formatTimeAgo(n.timestamp)}</span>
      </div>
    `;
  }).join('');
}

/**
 * Main view routing (static HTML panels — no innerHTML rebuild)
 */
function setupTabListeners() {
  $all('.nav-item[data-tab]').forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      switchView(tab.dataset.tab);
    });
  });
}

function switchView(tabId) {
  activeMainView = tabId;
  $all('.nav-item[data-tab]').forEach(t => {
    const active = t.dataset.tab === tabId;
    t.classList.toggle('active', active);
    if (active) t.setAttribute('aria-current', 'page');
    else t.removeAttribute('aria-current');
  });

  $all('.manager-view').forEach(v => v.classList.add('hidden'));
  const viewEl = $(`#view-${tabId}`);
  if (viewEl) viewEl.classList.remove('hidden');

  const titleEl = $('#top-nav-title');
  if (titleEl) titleEl.textContent = VIEW_TITLES[tabId] || 'Manager';

  if (tabId === 'queue') {
    updateKPICards();
    renderSessionsList();
    if (activeSessionId) renderDetailsPane();
  } else if (tabId === 'insights') {
    renderInsightsView();
  } else if (tabId === 'team') {
    loadSettingsTab();
  } else if (tabId === 'settings') {
    loadDepositSettingsPage();
  }
}

function bindFloatingLabelsIn(root) {
  if (!root) return;
  root.querySelectorAll('.floating-input').forEach(input => {
    const parent = input.closest('.floating-group');
    if (!parent) return;
    input.addEventListener('focus', () => parent.classList.add('focused'));
    input.addEventListener('blur', () => {
      parent.classList.remove('focused');
      if (input.value.trim() !== '') parent.classList.add('has-value');
      else parent.classList.remove('has-value');
    });
    if (input.value.trim() !== '') parent.classList.add('has-value');
  });
}

async function loadDepositSettingsPage() {
  const container = $('#view-settings');
  if (!container) return;

  let publicLandingEnabled = false;
  let publicSiteName = 'Place Order';
  let publicDisabledMessage =
    'This deposit page is not available at the moment. Please contact your account manager for a personal payment link.';
  let trackGuideScroll = false;
  let guidePagePath = '/deposit/welcome.html';
  let guideExpiredTitle = 'Website under technical renovation';
  const publicDepositUrl = `${window.location.origin}/deposit`;

  try {
    const configRes = await fetch('/api/settings', { credentials: 'include' });
    if (configRes.ok) {
      const config = await configRes.json();
      const landing = config.publicDepositLanding || {};
      publicLandingEnabled = landing.enabled === true;
      publicSiteName = landing.siteName || publicSiteName;
      publicDisabledMessage = landing.disabledMessage || publicDisabledMessage;
      trackGuideScroll = config.onboardingGuide?.trackScrollCompletion === true;
      guidePagePath = config.onboardingGuide?.pagePath || guidePagePath;
      guideExpiredTitle = config.onboardingGuide?.expiredTitle || guideExpiredTitle;
    }
  } catch (err) {
    console.error('Failed to fetch public deposit settings:', err);
  }

  container.innerHTML = `
    <div class="animate-fade-in settings-page-layout">
      <div class="card flex-col gap-md">
        <h2 class="card-title">Public deposit page</h2>
        <span class="card-subtitle">Visitors who open your site deposit URL without an agent link get a new anonymous session. Agent-specific links always work.</span>

        <div class="settings-toggle-row">
          <div class="settings-toggle-copy">
            <div class="settings-toggle-title">Enable public landing page</div>
          </div>
          <label class="toggle-switch" id="public-deposit-toggle-wrap">
            <input type="checkbox" id="public-deposit-enabled" ${publicLandingEnabled ? 'checked' : ''} aria-label="Enable public landing page" />
            <span class="toggle-switch-track" aria-hidden="true"></span>
          </label>
        </div>

        <div class="floating-group" style="margin-bottom: 0;">
          <input type="text" id="public-deposit-site-name" class="floating-input" placeholder=" " value="${publicSiteName.replace(/"/g, '&quot;')}" />
          <label for="public-deposit-site-name" class="floating-label">Website / brand name on checkout</label>
        </div>

        <div class="floating-group floating-group-textarea" style="margin-bottom: 0;">
          <textarea id="public-deposit-disabled-message" class="floating-input" placeholder=" " rows="3">${publicDisabledMessage.replace(/</g, '&lt;')}</textarea>
          <label for="public-deposit-disabled-message" class="floating-label">Message when page is disabled</label>
        </div>

        <div style="font-size: 0.8rem; color: var(--text-secondary); background: var(--surface-hover); border: 1px solid var(--border); border-radius: 8px; padding: 12px;">
          <div style="font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">Public URL (for your domain)</div>
          <code class="mono" style="font-size: 0.85rem; word-break: break-all;">${publicDepositUrl}</code>
          <div style="margin-top: 8px; color: var(--text-tertiary);">Point <strong>yoursite.com/deposit</strong> (or this host) here when you deploy on Render.</div>
        </div>

        <button type="button" id="save-public-deposit-btn" class="btn btn-primary w-full" style="height: 44px; font-weight: 600;">Save branding &amp; disabled message</button>
      </div>

      <div class="card flex-col gap-md" style="margin-top: var(--spacing-lg);">
        <h2 class="card-title">Post-payment onboarding guide</h2>
        <span class="card-subtitle">After checkout, clients are sent to the guide automatically (also via the success button) for <strong>24 hours</strong>, then see a technical renovation message. Scroll tracking is on by default; turn it off here if you do not need read-to-bottom metrics.</span>

        <div class="floating-group" style="margin-bottom: 0;">
          <input type="text" id="onboarding-guide-page-path" class="floating-input" placeholder=" " value="${guidePagePath.replace(/"/g, '&quot;')}" />
          <label for="onboarding-guide-page-path" class="floating-label">Guide page path</label>
        </div>
        <p style="font-size: 0.78rem; color: var(--text-tertiary); margin: 0;">Must start with <code class="mono">/deposit/</code> (e.g. <code class="mono">/deposit/welcome.html</code> or your own HTML file). Add <code class="mono">onboarding-track.js</code> on custom pages for scroll tracking.</p>

        <div class="settings-toggle-row">
          <div class="settings-toggle-copy">
            <div class="settings-toggle-title">Track scroll-to-bottom on guide page</div>
          </div>
          <label class="toggle-switch" id="onboarding-guide-toggle-wrap">
            <input type="checkbox" id="onboarding-guide-track-scroll" ${trackGuideScroll ? 'checked' : ''} aria-label="Track onboarding guide scroll completion" />
            <span class="toggle-switch-track" aria-hidden="true"></span>
          </label>
        </div>

        <div class="floating-group" style="margin-bottom: 0;">
          <input type="text" id="onboarding-guide-expired-title" class="floating-input" placeholder=" " value="${guideExpiredTitle.replace(/"/g, '&quot;')}" />
          <label for="onboarding-guide-expired-title" class="floating-label">Message title after 24 hours</label>
        </div>

        <button type="button" id="save-onboarding-guide-btn" class="btn btn-primary w-full" style="height: 44px; font-weight: 600;">Save onboarding guide settings</button>
      </div>
    </div>`;

  bindFloatingLabelsIn(container);

  const enabledInput = $('#public-deposit-enabled');
  const toggleWrap = $('#public-deposit-toggle-wrap');

  async function persistPublicLandingEnabled(enabled) {
    const res = await fetch('/api/settings', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicDepositLanding: { enabled } })
    });
    if (!res.ok) throw new Error('save failed');
  }

  const guideTrackInput = $('#onboarding-guide-track-scroll');
  const guideToggleWrap = $('#onboarding-guide-toggle-wrap');

  async function persistGuideTrackScroll(enabled) {
    const res = await fetch('/api/settings', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboardingGuide: { trackScrollCompletion: enabled } })
    });
    if (!res.ok) throw new Error('save failed');
  }

  const saveGuideBtn = $('#save-onboarding-guide-btn');
  if (saveGuideBtn) {
    saveGuideBtn.addEventListener('click', async () => {
      const pagePath = ($('#onboarding-guide-page-path')?.value || '').trim() || '/deposit/welcome.html';
      const expiredTitle = ($('#onboarding-guide-expired-title')?.value || '').trim() || guideExpiredTitle;
      saveGuideBtn.disabled = true;
      try {
        const res = await fetch('/api/settings', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ onboardingGuide: { pagePath, expiredTitle } })
        });
        if (res.ok) {
          notificationService.showToast('Saved', 'Onboarding guide settings updated.', 'success');
        } else {
          notificationService.showToast('Save failed', 'Could not update guide page path.', 'danger');
        }
      } catch (e) {
        notificationService.showToast('Connection error', 'Failed to save guide settings.', 'danger');
      } finally {
        saveGuideBtn.disabled = false;
      }
    });
  }

  if (guideTrackInput) {
    guideTrackInput.addEventListener('change', async () => {
      const enabled = guideTrackInput.checked;
      const previous = !enabled;
      guideTrackInput.disabled = true;
      guideToggleWrap?.classList.add('is-saving');
      try {
        await persistGuideTrackScroll(enabled);
        notificationService.showToast(
          enabled ? 'Guide tracking on' : 'Guide tracking off',
          enabled
            ? 'Managers will see scroll depth and bottom completion per session.'
            : 'Only guide opens will be recorded.',
          'success'
        );
      } catch (e) {
        guideTrackInput.checked = previous;
        notificationService.showToast('Update failed', 'Could not change onboarding guide tracking.', 'danger');
      } finally {
        guideTrackInput.disabled = false;
        guideToggleWrap?.classList.remove('is-saving');
      }
    });
  }

  if (enabledInput) {
    enabledInput.addEventListener('change', async () => {
      const enabled = enabledInput.checked;
      const previous = !enabled;
      enabledInput.disabled = true;
      toggleWrap?.classList.add('is-saving');
      try {
        await persistPublicLandingEnabled(enabled);
        notificationService.showToast(
          enabled ? 'Public landing on' : 'Public landing off',
          enabled
            ? 'Anonymous /deposit visits will open new sessions.'
            : 'Public landing is disabled; agent links still work.',
          'success'
        );
      } catch (e) {
        enabledInput.checked = previous;
        notificationService.showToast('Update failed', 'Could not change public landing.', 'danger');
      } finally {
        enabledInput.disabled = false;
        toggleWrap?.classList.remove('is-saving');
      }
    });
  }

  const saveBtn = $('#save-public-deposit-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const siteName = ($('#public-deposit-site-name')?.value || '').trim() || 'Place Order';
      const disabledMessage = ($('#public-deposit-disabled-message')?.value || '').trim();
      saveBtn.disabled = true;
      try {
        const res = await fetch('/api/settings', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publicDepositLanding: {
              siteName,
              disabledMessage: disabledMessage || publicDisabledMessage
            }
          })
        });
        if (res.ok) {
          notificationService.showToast('Saved', 'Checkout branding and disabled message updated.', 'success');
        } else {
          notificationService.showToast('Save failed', 'Could not update settings.', 'danger');
        }
      } catch (e) {
        notificationService.showToast('Connection error', 'Failed to save settings.', 'danger');
      } finally {
        saveBtn.disabled = false;
      }
    });
  }
}

function renderInsightsView() {
  const metrics = analyticsService.getOverviewMetrics(sessions);
  const kpiStrip = $('#insights-kpi-strip');
  if (kpiStrip) {
    kpiStrip.innerHTML = `
      <div class="kpi-card"><span class="kpi-value mono">${metrics.totalSessions}</span><span class="kpi-label">Total sessions</span></div>
      <div class="kpi-card"><span class="kpi-value mono">${metrics.activeSessions}</span><span class="kpi-label">Online</span></div>
      <div class="kpi-card"><span class="kpi-value mono">${metrics.completedSessions}</span><span class="kpi-label">Completed</span></div>
      <div class="kpi-card"><span class="kpi-value mono">${dailySuccessRatePercent(sessions)}%</span><span class="kpi-label">Daily success rate</span></div>
    `;
  }

  const countryDist = analyticsService.getCountryDistribution(sessions);
  const countryList = $('#insights-country-list');
  if (countryList) {
    const keys = Object.keys(countryDist).sort((a, b) => countryDist[b] - countryDist[a]);
    countryList.innerHTML = keys.length ? keys.map(code => {
      const country = COUNTRIES.find(c => c.code === code) || { flag: '🌐', name: code };
      return `<div class="list-row"><span class="list-row-label">${country.flag} ${country.name}</span><span class="list-row-value">${countryDist[code]}</span></div>`;
    }).join('') : '<p class="text-tertiary">No geographic data yet.</p>';
  }

  const statusDist = analyticsService.getStatusDistribution(sessions);
  const statusList = $('#insights-status-list');
  if (statusList) {
    statusList.innerHTML = Object.keys(statusDist).map(status =>
      `<div class="list-row"><span class="list-row-label">${status}</span><span class="list-row-value">${statusDist[status]}</span></div>`
    ).join('');
  }

  const agentDist = analyticsService.getAgentDistribution(sessions);
  const agentList = $('#insights-agent-list');
  if (agentList) {
    agentList.innerHTML = Object.keys(agentDist).sort((a, b) => agentDist[b] - agentDist[a]).map(agent =>
      `<div class="list-row"><span class="list-row-label">${agent}</span><span class="list-row-value">${agentDist[agent]} sessions</span></div>`
    ).join('');
  }
}

function workloadForUser(user, dist) {
  const agentLabel = user.role === 'Manager' ? `Administrator ${user.firstName}` : `Agent ${user.firstName}`;
  if (dist[agentLabel] !== undefined) return dist[agentLabel];
  const fullName = `${user.firstName} ${user.lastName}`;
  if (dist[fullName] !== undefined) return dist[fullName];
  return sessions.filter(s => s.agentId === user.id).length;
}


/**
 * Interactive System Configurations and transactional messaging templates tab
 */
/**
 * Interactive System Configurations - Agent Management inside Settings
 */
async function loadSettingsTab() {
  const container = $('#view-team');
  try {
    const response = await fetch('/api/users');
    if (!response.ok) {
      if (container) container.innerHTML = `<div class="card text-center">Failed to load team profiles.</div>`;
      return;
    }
    if (!container) return;
    const users = await response.json();
    const dist = analyticsService.getAgentDistribution(sessions);

    let emergencyIpBypass = false;
    try {
      const configRes = await fetch('/api/settings');
      if (configRes.ok) {
        const config = await configRes.json();
        emergencyIpBypass = config.securitySettings?.emergencyIpBypass || false;
      }
    } catch(err) {
      console.error('Failed to fetch system settings:', err);
    }

    // Fetch client's current IP address
    let myClientIp = '127.0.0.1';
    try {
      const ipRes = await fetch('/api/ip-whitelist/my-ip');
      if (ipRes.ok) {
        const ipData = await ipRes.json();
        myClientIp = ipData.ip || '127.0.0.1';
      }
    } catch(err) {}

    // Fetch recent blocked IP attempt logs
    let ipLogs = [];
    try {
      const logsRes = await fetch('/api/ip-logs');
      if (logsRes.ok) {
        ipLogs = await logsRes.json();
      }
    } catch(err) {}

    const teamHtml = `
      <div class="animate-fade-in flex-col gap-lg" style="width: 100%;">
        <!-- TOP ROW: Directory & Routing -->
        <div class="grid-2col" style="align-items: flex-start; gap: var(--spacing-lg);">
          <!-- LEFT: Team List & Active Workloads -->
          <div class="card flex-col gap-md" style="flex: 1.3;">
            <h2 class="card-title">Sales Team Directory</h2>
            <span class="card-subtitle">Active agents, system roles, login status, and current pipeline allocations.</span>
            
            <div class="table-container" style="overflow-x: auto; margin-top: var(--spacing-sm); border: 1px solid var(--border); border-radius: var(--radius-sm);">
              <table class="data-table" style="width: 100%; border-collapse: collapse; text-align: left;">
                <thead>
                  <tr style="border-bottom: 2px solid var(--border-strong); background-color: var(--surface-hover);">
                    <th style="padding: var(--spacing-md); font-weight: 700; font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase;">Agent</th>
                    <th style="padding: var(--spacing-md); font-weight: 700; font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase;">Role</th>
                    <th style="padding: var(--spacing-md); font-weight: 700; font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase;">Workload</th>
                    <th style="padding: var(--spacing-md); font-weight: 700; font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase;">Status</th>
                    <th style="padding: var(--spacing-md); font-weight: 700; font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase;">Personal Link</th>
                    <th style="padding: var(--spacing-md); font-weight: 700; font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase; text-align: center;">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${users.map(u => {
                    const statusClass = u.status === 'Active' ? 'badge-success' : 'badge-danger';
                    const fullName = `${u.firstName} ${u.lastName}`;
                    
                    const workloadCount = workloadForUser(u, dist);

                    return `
                      <tr style="border-bottom: 1px solid var(--border); transition: background-color var(--ease-in-out) 0.2s;">
                        <td style="padding: var(--spacing-md);">
                          <div class="flex-col">
                            <span style="font-weight: 700; color: var(--text-primary);">${fullName}</span>
                            <span class="mono" style="font-size: 0.7rem; color: var(--text-tertiary);">${u.email}</span>
                          </div>
                        </td>
                        <td style="padding: var(--spacing-md);"><span class="badge ${u.role === 'Manager' ? 'badge-primary' : 'badge-gray'}">${u.role}</span></td>
                        <td style="padding: var(--spacing-md);"><span class="mono" style="font-weight: 600;">${workloadCount} Active</span></td>
                        <td style="padding: var(--spacing-md);"><span class="badge ${statusClass}">${u.status.toUpperCase()}</span></td>
                        <td style="padding: var(--spacing-md);">
                          ${u.role === 'Agent' && u.referralCode ? `
                            <button class="btn btn-secondary btn-sm copy-agent-link-btn" data-referral-code="${u.referralCode}" data-name="${fullName}" style="padding: 4px 8px; font-size: 0.75rem; font-weight: 600; white-space: nowrap;">Copy Link</button>
                          ` : '<span class="text-tertiary">—</span>'}
                        </td>
                        <td style="padding: var(--spacing-md); text-align: center;">
                          <div class="flex justify-center gap-xs">
                            <button class="btn btn-secondary btn-sm toggle-user-btn" data-id="${u.id}" data-status="${u.status}" style="padding: 4px 8px; font-size: 0.75rem; font-weight: 600;">Toggle</button>
                            <button class="btn btn-secondary btn-sm edit-user-btn" data-id="${u.id}" data-firstname="${u.firstName}" data-lastname="${u.lastName}" data-email="${u.email}" data-role="${u.role}" data-status="${u.status}" style="padding: 4px 8px; font-size: 0.75rem; font-weight: 600;">Edit</button>
                            <button class="btn btn-secondary btn-sm reset-user-btn" data-id="${u.id}" data-name="${u.firstName}" style="padding: 4px 8px; font-size: 0.75rem; font-weight: 600;">Pass</button>
                            <button class="btn btn-tertiary btn-sm delete-user-btn" data-id="${u.id}" style="padding: 4px 8px; font-size: 0.75rem; font-weight: 600; color: var(--danger);">Del</button>
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- RIGHT: Form Actions and Routing Panel -->
          <div class="flex-col gap-lg" style="flex: 0.8; width: 100%;">
            <!-- Card 1: Register Sales Agent Form -->
            <div class="card flex-col gap-md">
              <h2 class="card-title">Register Sales Agent</h2>
              <span class="card-subtitle">Generate a new login profile with role-based system access controls.</span>
              
              <form id="add-agent-form" class="flex-col gap-md" style="margin-top: var(--spacing-sm);" novalidate>
                <div class="grid-2col">
                  <div class="floating-group" style="margin-bottom: 0;">
                    <input type="text" id="a-firstName" class="floating-input" placeholder=" " required />
                    <label for="a-firstName" class="floating-label">First Name</label>
                  </div>
                  <div class="floating-group" style="margin-bottom: 0;">
                    <input type="text" id="a-lastName" class="floating-input" placeholder=" " required />
                    <label for="a-lastName" class="floating-label">Last Name</label>
                  </div>
                </div>

                <div class="floating-group" style="margin-bottom: 0;">
                  <input type="email" id="a-email" class="floating-input" placeholder=" " required />
                  <label for="a-email" class="floating-label">Email Address</label>
                </div>

                <div class="floating-group" style="margin-bottom: 0;">
                  <input type="password" id="a-password" class="floating-input" placeholder=" " required />
                  <label for="a-password" class="floating-label">Login Password</label>
                </div>

                <div class="grid-2col" style="margin-top: var(--spacing-xs);">
                  <div class="form-group" style="margin-bottom: 0;">
                    <label style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 4px; display: block;">System Role</label>
                    <select id="a-role" class="form-input" style="height: 48px; font-weight: 500;">
                      <option value="Agent" selected>Sales Agent</option>
                      <option value="Manager">Manager (Admin)</option>
                    </select>
                  </div>
                  <div class="form-group" style="margin-bottom: 0;">
                    <label style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 4px; display: block;">Default Status</label>
                    <select id="a-status" class="form-input" style="height: 48px; font-weight: 500;">
                      <option value="Active" selected>Active</option>
                      <option value="Disabled">Disabled</option>
                    </select>
                  </div>
                </div>

                <button type="submit" class="btn btn-primary w-full" style="height: 48px; font-weight: 600; margin-top: var(--spacing-sm);">Create Agent Profile</button>
              </form>
            </div>
          </div>
        </div>
      </div>`;

    const securityHtml = `<div class="animate-fade-in flex-col gap-lg" style="width: 100%;">
        <!-- BOTTOM ROW: IP Whitelist Security & Access Controls -->
        <div class="card flex-col gap-md" style="width: 100%;">
          <div class="flex align-center justify-between flex-wrap gap-md" style="border-bottom: 1px solid var(--border); padding-bottom: var(--spacing-sm);">
            <div>
              <h2 class="card-title" style="display: flex; align-items: center; gap: 8px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #38bdf8;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                IP Whitelist Security & Access Rules
              </h2>
              <span class="card-subtitle">Manage account-specific IP whitelists for Manager & Agent accounts to restrict authentication and API access to authorized network origins.</span>
            </div>
            <div class="flex align-center gap-md">
              <div style="text-align: right; font-size: 0.8rem; color: var(--text-secondary);">
                <div>Your Current IP: <strong style="color: #38bdf8;" class="mono">${myClientIp}</strong></div>
                <div style="margin-top: 2px;">Emergency Bypass: <span class="badge ${emergencyIpBypass ? 'badge-danger' : 'badge-success'}">${emergencyIpBypass ? 'ACTIVE (BYPASSED)' : 'ENFORCED (SECURE)'}</span></div>
              </div>
              <button id="toggle-emergency-bypass-btn" class="btn ${emergencyIpBypass ? 'btn-primary' : 'btn-secondary'} btn-sm" style="font-weight: 600; padding: 8px 14px;">
                ${emergencyIpBypass ? 'Deactivate Emergency Bypass' : 'Activate Emergency Override'}
              </button>
            </div>
          </div>

          <!-- Account IP Whitelist Table -->
          <div class="table-container" style="overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius-sm); margin-top: var(--spacing-xs);">
            <table class="data-table" style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead>
                <tr style="border-bottom: 2px solid var(--border-strong); background-color: var(--surface-hover);">
                  <th style="padding: var(--spacing-md); font-weight: 700; font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase;">Account</th>
                  <th style="padding: var(--spacing-md); font-weight: 700; font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase;">Role</th>
                  <th style="padding: var(--spacing-md); font-weight: 700; font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase;">Protection Status</th>
                  <th style="padding: var(--spacing-md); font-weight: 700; font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase;">Allowed IP Addresses / Subnets</th>
                  <th style="padding: var(--spacing-md); font-weight: 700; font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase; text-align: center;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${users.map(u => {
                  const isEnabled = u.ipWhitelistEnabled || false;
                  const allowedList = u.allowedIps || [];
                  return `
                    <tr style="border-bottom: 1px solid var(--border);">
                      <td style="padding: var(--spacing-md);">
                        <div class="flex-col">
                          <span style="font-weight: 700; color: var(--text-primary);">${u.firstName} ${u.lastName}</span>
                          <span class="mono" style="font-size: 0.75rem; color: var(--text-tertiary);">${u.email}</span>
                        </div>
                      </td>
                      <td style="padding: var(--spacing-md);"><span class="badge ${u.role === 'Manager' ? 'badge-primary' : 'badge-gray'}">${u.role}</span></td>
                      <td style="padding: var(--spacing-md);">
                        <span class="badge ${isEnabled ? 'badge-success' : 'badge-warning'}">
                          ${isEnabled ? 'PROTECTION ENABLED' : 'DISABLED'}
                        </span>
                      </td>
                      <td style="padding: var(--spacing-md);">
                        ${allowedList.length > 0 ? `
                          <div class="flex flex-wrap gap-xs align-center">
                            ${allowedList.map(ip => `<span class="mono" style="background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3); color: #38bdf8; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">${ip}</span>`).join('')}
                          </div>
                        ` : `<span style="font-size: 0.8rem; color: var(--text-tertiary); font-style: italic;">No IPs whitelisted</span>`}
                      </td>
                      <td style="padding: var(--spacing-md); text-align: center;">
                        <button class="btn btn-secondary btn-sm manage-ip-btn"
                          data-id="${u.id}"
                          data-name="${u.firstName} ${u.lastName}"
                          data-email="${u.email}"
                          data-enabled="${isEnabled}"
                          data-ips='${JSON.stringify(allowedList)}'
                          style="padding: 6px 12px; font-size: 0.8rem; font-weight: 600;">
                          Manage Whitelist
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <!-- Recent Blocked IP Access Log Attempts -->
          <div class="flex-col gap-sm" style="margin-top: var(--spacing-md);">
            <div class="flex align-center justify-between">
              <div>
                <h3 style="font-size: 1rem; font-weight: 700; color: var(--text-primary);">Recent Blocked Access Attempts & Security Logs</h3>
                <span style="font-size: 0.8rem; color: var(--text-secondary);">Real-time audit log of blocked logins and API requests originating from unauthorized IPs.</span>
              </div>
              ${ipLogs.length > 0 ? `
                <button id="clear-ip-logs-btn" class="btn btn-secondary btn-sm" style="font-size: 0.75rem; color: var(--danger);">Clear Audit Log</button>
              ` : ''}
            </div>

            <div class="table-container" style="overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius-sm);">
              <table class="data-table" style="width: 100%; border-collapse: collapse; text-align: left;">
                <thead>
                  <tr style="border-bottom: 2px solid var(--border-strong); background-color: var(--surface-hover);">
                    <th style="padding: var(--spacing-sm) var(--spacing-md); font-weight: 700; font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase;">Timestamp</th>
                    <th style="padding: var(--spacing-sm) var(--spacing-md); font-weight: 700; font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase;">Account / Role</th>
                    <th style="padding: var(--spacing-sm) var(--spacing-md); font-weight: 700; font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase;">Blocked Origin IP</th>
                    <th style="padding: var(--spacing-sm) var(--spacing-md); font-weight: 700; font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase;">Attempted Request</th>
                    <th style="padding: var(--spacing-sm) var(--spacing-md); font-weight: 700; font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; text-align: center;">Quick Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${ipLogs.length > 0 ? ipLogs.slice(0, 20).map(log => `
                    <tr style="border-bottom: 1px solid var(--border);">
                      <td style="padding: var(--spacing-sm) var(--spacing-md); font-size: 0.8rem; color: var(--text-secondary);" class="mono">
                        ${new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td style="padding: var(--spacing-sm) var(--spacing-md);">
                        <div class="flex-col">
                          <span style="font-weight: 600; font-size: 0.85rem; color: var(--text-primary);">${log.userName}</span>
                          <span style="font-size: 0.7rem; color: var(--text-tertiary);">${log.userEmail} (${log.role})</span>
                        </div>
                      </td>
                      <td style="padding: var(--spacing-sm) var(--spacing-md);">
                        <span class="mono" style="color: #f43f5e; font-weight: 700; background: rgba(244, 63, 94, 0.1); padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(244, 63, 94, 0.3);">
                          ${log.ipAddress}
                        </span>
                      </td>
                      <td style="padding: var(--spacing-sm) var(--spacing-md); font-size: 0.8rem; color: var(--text-secondary);">
                        ${log.actionAttempted}
                      </td>
                      <td style="padding: var(--spacing-sm) var(--spacing-md); text-align: center;">
                        ${log.userId ? `
                          <button class="btn btn-secondary btn-sm quick-whitelist-btn"
                            data-userid="${log.userId}"
                            data-ip="${log.ipAddress}"
                            style="padding: 3px 8px; font-size: 0.75rem; color: #38bdf8;">
                            + Add to Whitelist
                          </button>
                        ` : '-'}
                      </td>
                    </tr>
                  `).join('') : `
                    <tr>
                      <td colspan="5" style="padding: var(--spacing-md); text-align: center; color: var(--text-tertiary); font-style: italic;">
                        No blocked IP access attempts recorded. All network traffic compliant.
                      </td>
                    </tr>
                  `}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      </div>`;

    container.innerHTML = teamHtml + securityHtml;

    bindFloatingLabelsIn(container);

    container.querySelectorAll('.copy-agent-link-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const link = `${window.location.origin}/marketing/?ref=${encodeURIComponent(btn.dataset.referralCode || '')}`;
        const copied = await copyToClipboard(link);
        notificationService.showToast(
          copied ? 'Agent Link Copied' : 'Copy Failed',
          copied ? `${btn.dataset.name}'s personal marketing link is ready to share.` : 'Could not copy the agent link.',
          copied ? 'success' : 'danger'
        );
      });
    });

    // Form reset helper
    function resetForm() {
      editingAgentId = null;
      form.reset();
      container.querySelectorAll('.floating-group').forEach(g => {
        g.classList.remove('has-value', 'focused');
      });
      
      const formCard = $('#add-agent-form').closest('.card');
      if (formCard) {
        const titleEl = formCard.querySelector('.card-title');
        if (titleEl) titleEl.textContent = 'Register Sales Agent';
        const subtitleEl = formCard.querySelector('.card-subtitle');
        if (subtitleEl) subtitleEl.textContent = 'Generate a new login profile with role-based system access controls.';
      }
      
      const submitBtn = formCard.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.textContent = 'Create Agent Profile';
      }
      
      const cancelBtn = $('#cancel-edit-btn');
      if (cancelBtn) {
        cancelBtn.remove();
      }
    }

    // Form submit listener
    const form = $('#add-agent-form');
    if (form) form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const firstName = $('#a-firstName').value.trim();
      const lastName = $('#a-lastName').value.trim();
      const email = $('#a-email').value.trim();
      const password = $('#a-password').value.trim();
      const role = $('#a-role').value;
      const status = $('#a-status').value;

      // Validate First Name
      if (!firstName) {
        notificationService.showToast('Validation Error', 'First Name cannot be empty.', 'warning');
        return;
      }
      
      // Validate Last Name
      if (!lastName) {
        notificationService.showToast('Validation Error', 'Last Name cannot be empty.', 'warning');
        return;
      }

      // Validate Email
      if (!email) {
        notificationService.showToast('Validation Error', 'Email Address is required.', 'warning');
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        notificationService.showToast('Validation Error', 'Please enter a valid email address.', 'warning');
        return;
      }

      // Validate Password (only required on creation)
      if (!editingAgentId && !password) {
        notificationService.showToast('Validation Error', 'Password is required when creating a new agent.', 'warning');
        return;
      }

      const payload = {
        firstName,
        lastName,
        email,
        role,
        status,
        ...(password ? { password } : {}) // Password optional if editing and left empty
      };

      if (editingAgentId) {
        // Edit flow
        const updateResponse = await fetch(`/api/users/${editingAgentId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (updateResponse.ok) {
          notificationService.showToast('Success', `Agent account updated successfully for ${firstName} ${lastName}.`, 'success');
          resetForm();
          loadSettingsTab();
        } else {
          const err = await updateResponse.json();
          notificationService.showToast('Error', err.error || 'Failed to update agent account.', 'danger');
        }
      } else {
        // Create flow
        const createResponse = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (createResponse.ok) {
          notificationService.showToast('Success', `Credentials profile generated successfully for ${firstName} ${lastName}.`, 'success');
          resetForm();
          loadSettingsTab();
        } else {
          const err = await createResponse.json();
          notificationService.showToast('Error', err.error || 'Failed to register agent.', 'danger');
        }
      }
    });

    // Edit button listeners
    container.querySelectorAll('.edit-user-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        editingAgentId = btn.dataset.id;
        
        // Populate form fields
        $('#a-firstName').value = btn.dataset.firstname;
        $('#a-lastName').value = btn.dataset.lastname;
        $('#a-email').value = btn.dataset.email;
        $('#a-password').value = ''; // Password is optional when editing
        $('#a-role').value = btn.dataset.role;
        $('#a-status').value = btn.dataset.status;
        
        // Update floating labels parent classes so they look right
        container.querySelectorAll('.floating-input').forEach(input => {
          const parent = input.closest('.floating-group');
          if (parent) {
            if (input.value.trim() !== '') {
              parent.classList.add('has-value');
            } else {
              parent.classList.remove('has-value');
            }
          }
        });

        // Change card titles and button text
        const formCard = $('#add-agent-form').closest('.card');
        if (formCard) {
          const titleEl = formCard.querySelector('.card-title');
          if (titleEl) titleEl.textContent = 'Edit Sales Agent';
          const subtitleEl = formCard.querySelector('.card-subtitle');
          if (subtitleEl) subtitleEl.textContent = 'Update the login profile and system access permissions.';
        }
        
        const submitBtn = formCard.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.textContent = 'Save Agent Profile';
        }

        // Add a Cancel Edit button if it doesn't exist
        let cancelBtn = $('#cancel-edit-btn');
        if (!cancelBtn) {
          cancelBtn = document.createElement('button');
          cancelBtn.type = 'button';
          cancelBtn.id = 'cancel-edit-btn';
          cancelBtn.className = 'btn btn-secondary w-full';
          cancelBtn.style.height = '48px';
          cancelBtn.style.fontWeight = '600';
          cancelBtn.style.marginTop = 'var(--spacing-xs)';
          cancelBtn.textContent = 'Cancel Edit';
          cancelBtn.addEventListener('click', () => {
            resetForm();
          });
          submitBtn.after(cancelBtn);
        }
      });
    });

    // Toggle active status listener
    container.querySelectorAll('.toggle-user-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const currentStatus = btn.dataset.status;
        const nextStatus = currentStatus === 'Active' ? 'Disabled' : 'Active';

        const updateResponse = await fetch(`/api/users/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus })
        });

        if (updateResponse.ok) {
          notificationService.showToast('Status Updated', `Agent status changed to ${nextStatus}.`, 'success');
          loadSettingsTab();
        } else {
          notificationService.showToast('Error', 'Failed to change agent status.', 'danger');
        }
      });
    });

    // Reset password dialog using beautiful custom Modal instead of window.prompt
    container.querySelectorAll('.reset-user-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const name = btn.dataset.name;
        
        const html = `
          <div class="flex-col gap-md" style="font-family: var(--font-sans);">
            <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.4; margin-bottom: var(--spacing-sm);">
              Set a new secure login password for agent <strong>${name}</strong>.
            </p>
            <div class="floating-group focused" style="margin-bottom: var(--spacing-md); position: relative;">
              <input type="password" id="reset-password-input" class="floating-input" style="width: 100%;" required placeholder=" ">
              <label class="floating-label" for="reset-password-input">New Password</label>
            </div>
            <div class="flex justify-end gap-md">
              <button class="btn btn-secondary btn-sm" id="reset-cancel-btn">Cancel</button>
              <button class="btn btn-primary btn-sm" id="reset-submit-btn">Save Password</button>
            </div>
          </div>
        `;
        
        openModal('reset-password-modal', 'Reset Agent Password', html);
        
        const input = document.getElementById('reset-password-input');
        if (input) input.focus();

        document.getElementById('reset-cancel-btn').addEventListener('click', () => {
          document.getElementById('reset-password-modal').remove();
        });

        document.getElementById('reset-submit-btn').addEventListener('click', async () => {
          const newPassword = input.value.trim();
          if (!newPassword) {
            notificationService.showToast('Validation Error', 'Password cannot be empty.', 'warning');
            return;
          }

          const resetResponse = await fetch(`/api/users/${id}/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newPassword })
          });

          if (resetResponse.ok) {
            notificationService.showToast('Password Updated', `Password reset successfully for ${name}.`, 'success');
            document.getElementById('reset-password-modal').remove();
          } else {
            const err = await resetResponse.json();
            notificationService.showToast('Error', err.error || 'Failed to reset password.', 'danger');
          }
        });
      });
    });

    // Delete agent listener using beautiful custom Modal.confirm instead of window.confirm
    container.querySelectorAll('.delete-user-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        
        Modal.confirm(
          'Delete Agent Profile',
          'Are you sure you want to delete this agent? This will permanently delete their login credentials and database record.',
          async () => {
            const deleteResponse = await fetch(`/api/users/${id}`, { method: 'DELETE' });
            if (deleteResponse.ok) {
              notificationService.showToast('Agent Deleted', 'Agent deleted successfully.', 'success');
              loadSettingsTab();
            } else {
              const err = await deleteResponse.json().catch(() => ({}));
              notificationService.showToast('Error', err.error || 'Failed to delete agent.', 'danger');
            }
          }
        );
      });
    });

    // --- IP WHITELIST SECURITY ACTION HANDLERS ---

    // Toggle Emergency IP Bypass Handler
    const toggleEmergencyBtn = $('#toggle-emergency-bypass-btn');
    if (toggleEmergencyBtn) {
      toggleEmergencyBtn.addEventListener('click', async () => {
        const nextState = !emergencyIpBypass;
        try {
          const res = await fetch('/api/settings/emergency-ip-bypass', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emergencyIpBypass: nextState })
          });
          if (res.ok) {
            notificationService.showToast(
              nextState ? 'Emergency Override ACTIVATED' : 'Emergency Override Deactivated',
              nextState ? 'IP Whitelist checks are temporarily disabled for all accounts.' : 'IP Whitelist security enforcement is active.',
              nextState ? 'warning' : 'success'
            );
            loadSettingsTab();
          } else {
            notificationService.showToast('Error', 'Failed to update emergency bypass state.', 'danger');
          }
        } catch(e) {
          notificationService.showToast('Connection Error', 'Could not update security settings.', 'danger');
        }
      });
    }

    // Manage Account IP Whitelist Modal Handler
    container.querySelectorAll('.manage-ip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const userId = btn.dataset.id;
        const userName = btn.dataset.name;
        const userEmail = btn.dataset.email;
        let isEnabled = btn.dataset.enabled === 'true';
        let currentIps = JSON.parse(btn.dataset.ips || '[]');

        const renderModalBody = () => `
          <div class="flex-col gap-md" style="font-family: var(--font-sans);">
            <div style="background: var(--surface-hover); border: 1px solid var(--border); padding: 12px; border-radius: 8px;">
              <div style="font-size: 0.8rem; color: var(--text-secondary);">Account Target:</div>
              <div style="font-weight: 700; color: var(--text-primary); font-size: 1rem;">${userName}</div>
              <div class="mono" style="font-size: 0.75rem; color: var(--text-tertiary);">${userEmail}</div>
            </div>

            <!-- Enable/Disable Protection Switch -->
            <div class="flex align-center gap-sm" style="background: rgba(15, 23, 42, 0.6); padding: 12px; border-radius: 8px; border: 1px solid var(--border);">
              <input type="checkbox" id="modal-ip-enable-chk" ${isEnabled ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;">
              <label for="modal-ip-enable-chk" style="font-weight: 700; color: var(--text-primary); cursor: pointer; font-size: 0.9rem;">
                Enable IP Whitelist Protection for this Account
              </label>
            </div>

            <!-- Add IP Input Group -->
            <div class="flex-col gap-xs">
              <label style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">
                Add Approved IP Address or CIDR Subnet
              </label>
              <div class="flex gap-xs">
                <input type="text" id="modal-new-ip-input" class="form-input mono" placeholder="e.g. 192.168.1.50, 10.0.0.0/24, 2001:db8::1" style="flex: 1; height: 40px; font-size: 0.85rem;">
                <button id="modal-add-ip-btn" class="btn btn-primary btn-sm" style="height: 40px; padding: 0 14px; font-weight: 600;">+ Add</button>
              </div>
              <button id="modal-add-my-ip-btn" class="btn btn-secondary btn-sm w-full" style="margin-top: 4px; font-size: 0.75rem; font-weight: 600; color: #38bdf8;">
                + Add My Current Origin IP (${myClientIp})
              </button>
            </div>

            <!-- Current Whitelisted IPs List -->
            <div class="flex-col gap-xs" style="margin-top: var(--spacing-xs);">
              <label style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">
                Allowed Whitelisted IPs (<span id="modal-ip-count-badge">${currentIps.length}</span>)
              </label>
              <div id="modal-ip-list-container" class="flex flex-col gap-xs" style="max-height: 160px; overflow-y: auto; border: 1px solid var(--border); border-radius: 6px; padding: 8px;">
              </div>
            </div>

            <div class="flex justify-end gap-md" style="margin-top: var(--spacing-md); border-top: 1px solid var(--border); padding-top: var(--spacing-md);">
              <button class="btn btn-secondary btn-sm" id="modal-ip-cancel-btn">Cancel</button>
              <button class="btn btn-primary btn-sm" id="modal-ip-save-btn">Save Whitelist Settings</button>
            </div>
          </div>
        `;

        openModal('manage-ip-modal', 'Account IP Whitelist Configuration', renderModalBody());

        const updateModalList = () => {
          const listContainer = document.getElementById('modal-ip-list-container');
          const countBadge = document.getElementById('modal-ip-count-badge');
          if (countBadge) countBadge.textContent = currentIps.length;

          if (listContainer) {
            listContainer.innerHTML = currentIps.length > 0 ? currentIps.map((ip, idx) => `
              <div class="flex align-center justify-between" style="background: var(--surface-hover); padding: 6px 10px; border-radius: 4px; border: 1px solid var(--border);">
                <span class="mono" style="font-size: 0.85rem; color: #38bdf8; font-weight: 600;">${ip}</span>
                <button class="modal-remove-ip-btn btn btn-tertiary btn-sm" data-idx="${idx}" style="color: var(--danger); font-size: 0.75rem; padding: 2px 6px;">Remove</button>
              </div>
            `).join('') : '<div style="font-size: 0.8rem; color: var(--text-tertiary); font-style: italic; text-align: center; padding: 8px;">No allowed IPs configured. Access will be blocked if protection is enabled.</div>';

            listContainer.querySelectorAll('.modal-remove-ip-btn').forEach(delBtn => {
              delBtn.addEventListener('click', () => {
                const idx = parseInt(delBtn.dataset.idx, 10);
                currentIps.splice(idx, 1);
                updateModalList();
              });
            });
          }
        };

        updateModalList();

        // Add IP handler
        const addIpInput = document.getElementById('modal-new-ip-input');
        const addIpBtn = document.getElementById('modal-add-ip-btn');
        if (addIpBtn) {
          addIpBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const val = addIpInput.value.trim();
            if (!val) return;
            if (!currentIps.includes(val)) {
              currentIps.push(val);
              addIpInput.value = '';
              updateModalList();
            }
          });
        }

        // Add My Current IP handler
        const addMyIpBtn = document.getElementById('modal-add-my-ip-btn');
        if (addMyIpBtn) {
          addMyIpBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!currentIps.includes(myClientIp)) {
              currentIps.push(myClientIp);
              updateModalList();
            }
          });
        }

        // Cancel handler
        document.getElementById('modal-ip-cancel-btn').addEventListener('click', () => {
          document.getElementById('manage-ip-modal').remove();
        });

        // Save handler
        document.getElementById('modal-ip-save-btn').addEventListener('click', async () => {
          const enabledChecked = document.getElementById('modal-ip-enable-chk').checked;
          try {
            const res = await fetch(`/api/users/${userId}/ip-whitelist`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                enabled: enabledChecked,
                allowedIps: currentIps
              })
            });

            if (res.ok) {
              notificationService.showToast('Whitelist Saved', `IP Whitelist updated for ${userName}.`, 'success');
              document.getElementById('manage-ip-modal').remove();
              loadSettingsTab();
            } else {
              const err = await res.json();
              notificationService.showToast('Save Error', err.error || 'Failed to update whitelist.', 'danger');
            }
          } catch(e) {
            notificationService.showToast('Connection Error', 'Could not save IP whitelist.', 'danger');
          }
        });
      });
    });

    // Quick Whitelist IP from Blocked Attempt Log
    container.querySelectorAll('.quick-whitelist-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const userId = btn.dataset.userid;
        const ipToAdd = btn.dataset.ip;

        const targetUser = users.find(u => u.id === userId);
        if (!targetUser) return;

        const updatedIps = Array.from(new Set([...(targetUser.allowedIps || []), ipToAdd]));
        try {
          const res = await fetch(`/api/users/${userId}/ip-whitelist`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              enabled: true,
              allowedIps: updatedIps
            })
          });

          if (res.ok) {
            notificationService.showToast('IP Whitelisted', `Added ${ipToAdd} to ${targetUser.firstName}'s allowed whitelist!`, 'success');
            loadSettingsTab();
          } else {
            notificationService.showToast('Error', 'Failed to whitelist IP.', 'danger');
          }
        } catch(e) {
          notificationService.showToast('Connection Error', 'Failed to process request.', 'danger');
        }
      });
    });

    // Clear Blocked IP Logs
    const clearLogsBtn = $('#clear-ip-logs-btn');
    if (clearLogsBtn) {
      clearLogsBtn.addEventListener('click', () => {
        Modal.confirm(
          'Clear Blocked IP Logs',
          'Are you sure you want to clear all blocked IP access attempt logs?',
          async () => {
            try {
              const res = await fetch('/api/ip-logs', { method: 'DELETE' });
              if (res.ok) {
                notificationService.showToast('Audit Log Cleared', 'Blocked IP access logs cleared.', 'success');
                loadSettingsTab();
              }
            } catch(e) {}
          }
        );
      });
    }

  } catch (e) {
    console.error('Failed to load system settings form:', e);
  }
}

/**
 * Exports all completed deposit sessions to a CSV file and triggers automatic browser download.
 */
function exportCompletedToCSV() {
  let exportSessions = getFilteredSessions().filter(s => s.status === SESSION_STATUS.COMPLETED);
  if (exportSessions.length === 0) {
    exportSessions = sessions.filter(s => s.status === SESSION_STATUS.COMPLETED);
  }

  if (exportSessions.length === 0) {
    notificationService.showToast('Export Cancelled', 'There are no completed deposit sessions to export.', 'warning');
    return;
  }

  // Define Headers
  const headers = [
    'Session ID',
    'Agent Name',
    'Campaign Name',
    'Client First Name',
    'Client Last Name',
    'Email Address',
    'Phone Prefix',
    'Country',
    'City',
    'Deposit Amount',
    'Preferred Currency',
    'Payment Brand',
    'Payment Digits Inputted',
    'Status',
    'Onboarding Created At',
    'Last Action At'
  ];

  // Map data to rows
  const rows = exportSessions.map(s => {
    const client = s.client || {};
    const payment = s.payment || {};
    
    // Simple helper to sanitize values for CSV
    const csvSafe = (val) => {
      if (val === undefined || val === null) return '';
      let str = String(val).replace(/"/g, '""'); // escape double quotes
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str}"`;
      }
      return str;
    };

    return [
      csvSafe(s.id),
      csvSafe(s.agent),
      csvSafe(s.campaignName || 'Place Order'),
      csvSafe(client.firstName),
      csvSafe(client.lastName),
      csvSafe(client.email),
      csvSafe(client.phone),
      csvSafe(client.country),
      csvSafe(client.city),
      csvSafe(client.depositAmount),
      csvSafe(client.preferredCurrency),
      csvSafe(payment.brand),
      csvSafe(payment.digitCount ? `${payment.digitCount} Digits` : ''),
      csvSafe(s.status),
      csvSafe(new Date(s.createdAt).toISOString()),
      csvSafe(new Date(s.updatedAt).toISOString())
    ];
  });

  // Build CSV string
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  // Create Blob and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `completed_deposits_export_${new Date().toISOString().slice(0, 10)}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  notificationService.showToast('Export Successful', `Successfully exported ${exportSessions.length} completed deposit sessions!`, 'success');
}
