/**
 * agent.js
 * Sales Agent Panel Controller.
 * Handles client registrations, real-time tracking subscriptions, and interactive UI components.
 */

import { initThemeToggle, $, $all } from '../js/core/ui.js';
import { generateSessionId, copyToClipboard } from '../js/utils/helpers.js';
import { formatPhoneNumber } from '../js/utils/formatters.js';
import { COUNTRIES, PRIORITY, SESSION_STATUS, createDefaultSession } from '../js/utils/constants.js';
import { findCountryByCode, findCountryByName, searchCountries } from '../js/utils/countryCatalog.js';
import { sessionService } from '../js/services/sessionService.js';
import { realtimeService } from '../js/services/realtimeService.js';
import { notificationService } from '../js/services/notificationService.js';
import { ProgressBar } from '../js/components/progressBar.js';
import { StatusBadge } from '../js/components/statusBadge.js';
import { SessionCard } from '../js/components/sessionCard.js';
import { Modal, maskCardNumber } from '../js/components/modal.js';
import { validateEmail, validatePhone } from '../js/core/validator.js';

let activeSessionId = null;
let unsubscribeSession = null;
let unsubscribeEvents = null;
let unsubscribeAll = null;
let selectedCountry = null;
let activeIndex = -1;
let currentUser = null;
let allSessions = [];
let sessionSourceFilter = 'regular';

document.addEventListener('DOMContentLoaded', () => {
  // Load standard light/dark theme preference
  initThemeToggle();
  
  // Setup searchable country dropdown
  initCountryDropdown();

  // Load agent profile details
  loadAgentProfile();

  // Populate an initial random Internal Client ID if field exists
  const internalIdEl = $('#internalId');
  if (internalIdEl) {
    internalIdEl.value = `CLI-${Math.floor(100000 + Math.random() * 900000)}`;
    internalIdEl.closest('.floating-group').classList.add('has-value');
  }

  // Input listeners for real-time validation
  setupFormValidators();

  // Primary Action Button Bind
  $('#generate-btn').addEventListener('click', handleGenerateLink);

  $all('.session-source-option').forEach(button => {
    button.addEventListener('click', () => {
      sessionSourceFilter = button.dataset.sessionSource || 'regular';
      $all('.session-source-option').forEach(option => {
        const isActive = option.dataset.sessionSource === sessionSourceFilter;
        option.classList.toggle('active', isActive);
        option.setAttribute('aria-pressed', String(isActive));
      });
      renderAgentSessions();
    });
  });

  // Copy the generated client onboarding link.
  const copyBtn = $('#copy-link-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const url = $('#onboarding-url-input')?.value;
      if (!url) return;

      const copied = await copyToClipboard(url);
      if (copied) {
        copyBtn.classList.add('copied');
        notificationService.showToast('Link Copied', 'The client onboarding link is ready to share.', 'success');
        setTimeout(() => copyBtn.classList.remove('copied'), 2000);
      } else {
        notificationService.showToast('Copy Failed', 'Please highlight and copy the link manually.', 'warning');
      }
    });
  }

  // Start real-time subscription for all sessions (to list agent's sessions)
  initSessionsSubscription();

  // Logout button bind
  const logoutBtn = $('#logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
});

/**
 * Fetch and load agent profile details
 */
async function loadAgentProfile() {
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
      currentUser = user;
      // Update header profile badge
      const nameEl = $('#agent-profile-name');
      const roleEl = $('#agent-profile-role');
      const avatarEl = $('#agent-avatar');
      
      if (nameEl) nameEl.textContent = `${user.firstName} ${user.lastName}`;
      if (roleEl) roleEl.textContent = user.role === 'Manager' ? 'Super Administrator' : 'Sales Representative';
      if (avatarEl) {
        avatarEl.textContent = user.firstName.charAt(0).toUpperCase();
        avatarEl.style.backgroundColor = user.role === 'Manager' ? 'var(--success)' : 'var(--primary)';
      }

      // Show Back to Operations link if user is a Manager
      const backofficeLinkContainer = $('#backoffice-link-container');
      if (backofficeLinkContainer) {
        backofficeLinkContainer.style.display = user.role === 'Manager' ? 'block' : 'none';
      }

      // Rerender list of sessions once the agent's name is loaded
      renderAgentSessions();

      // Pre-select Assigned Agent dropdown if option exists
      const agentDropdown = $('#assignedAgent');
      if (agentDropdown) {
        const fullName = `${user.firstName} ${user.lastName}`;
        // Map common seeding names
        let selectVal = 'Agent Sarah';
        if (fullName.includes('Sarah')) selectVal = 'Agent Sarah';
        else if (fullName.includes('Alex')) selectVal = 'Agent Alex';
        else if (fullName.includes('Marcus')) selectVal = 'Agent Marcus';
        else if (fullName.includes('Elena')) selectVal = 'Agent Elena';
        else {
          // If manager or other name, add custom option
          const opt = document.createElement('option');
          opt.value = fullName;
          opt.textContent = fullName;
          agentDropdown.appendChild(opt);
          selectVal = fullName;
        }
        agentDropdown.value = selectVal;
      }
    }
  } catch (error) {
    console.error('Failed to load agent profile:', error);
  }
}

/**
 * Handle log out action
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
 * Setup searchable country dropdown
 */
function initCountryDropdown() {
  const input = $('#countryInput');
  const list = $('#countryList');
  const phoneCodeEl = $('#phoneCode');
  const phoneWrap = $('.phone-wrap');

  function renderList(filter) {
    const f = (filter || '').trim().toLowerCase();
    const matches = searchCountries(f, 80);
    list.innerHTML = '';
    
    if (matches.length === 0) {
      list.innerHTML = '<div class="combobox-empty">No matching countries</div>';
    } else {
      matches.forEach(c => {
        const opt = document.createElement('div');
        opt.className = 'combobox-option';
        opt.dataset.code = c.code;
        opt.innerHTML = `<span class="option-flag">${c.flag}</span><span>${c.name}</span><span class="option-code">${c.phoneCode}</span>`;
        
        opt.addEventListener('mousedown', (e) => {
          e.preventDefault();
          selectCountryItem(c);
          list.classList.remove('show');
        });
        list.appendChild(opt);
      });
    }
    activeIndex = -1;
  }

  function selectCountryItem(country) {
    selectedCountry = country;
    input.value = `${country.flag} ${country.name}`;
    input.closest('.combo-field').classList.add('has-value');
    
    // Update phone prefix
    if (country.phoneCode) {
      phoneCodeEl.textContent = country.phoneCode;
      phoneWrap.classList.add('has-phone-code');
    } else {
      phoneCodeEl.textContent = '';
      phoneWrap.classList.remove('has-phone-code');
    }
    
    const countryGroup = $('[data-field="country"]');
    countryGroup.classList.remove('error');
    countryGroup.classList.add('success');

    // Auto-populate preferred currency and deposit amount from country metadata
    const currencyDropdown = $('#preferredCurrency');
    const amountInput = $('#depositAmount');

    if (currencyDropdown && country.currency) {
      currencyDropdown.value = country.currency;
    }
    if (amountInput) {
      amountInput.value = country.amount || 200;
      const amountGroup = amountInput.closest('.floating-group');
      if (amountGroup) {
        amountGroup.classList.add('has-value');
        amountGroup.classList.remove('error');
        amountGroup.classList.add('success');
      }
    }
  }

  input.addEventListener('focus', () => {
    list.classList.add('show');
    renderList('');
    input.select();
  });

  input.addEventListener('input', () => {
    selectedCountry = null;
    phoneCodeEl.textContent = '';
    phoneWrap.classList.remove('has-phone-code');
    list.classList.add('show');
    renderList(input.value);
  });

  input.addEventListener('blur', () => {
    setTimeout(() => {
      list.classList.remove('show');
      validateCountryField();
    }, 150);
  });

  input.addEventListener('keydown', (e) => {
    const opts = list.querySelectorAll('.combobox-option');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, opts.length - 1);
      updateActiveOption(opts);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      updateActiveOption(opts);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && opts[activeIndex]) {
        const code = opts[activeIndex].dataset.code;
        const country = findCountryByCode(code);
        selectCountryItem(country);
        list.classList.remove('show');
      }
    }
  });
}

function updateActiveOption(opts) {
  opts.forEach((o, i) => o.classList.toggle('active', i === activeIndex));
  if (opts[activeIndex]) opts[activeIndex].scrollIntoView({ block: 'nearest' });
}

function validateCountryField() {
  const group = $('[data-field="country"]');
  group.classList.remove('success', 'error');
  const input = $('#countryInput');
  if (input && input.value.trim() === '') {
    return true;
  }
  if (selectedCountry) {
    group.classList.add('success');
    return true;
  } else {
    group.classList.add('error');
    return false;
  }
}

/**
 * Setup field validation focus-outs
 */
function setupFormValidators() {
  const fields = ['firstName', 'lastName', 'email', 'campaignName', 'city'];
  fields.forEach(f => {
    const el = document.getElementById(f);
    if (el) {
      el.addEventListener('input', () => validateField(f));
      el.addEventListener('blur', () => validateField(f));
      
      const parent = el.closest('.floating-group');
      if (parent) {
        el.addEventListener('focus', () => {
          parent.classList.add('focused');
          parent.classList.remove('error');
        });
        el.addEventListener('blur', () => {
          parent.classList.remove('focused');
          if (el.value.trim() !== '') {
            parent.classList.add('has-value');
          } else {
            parent.classList.remove('has-value');
          }
        });
        if (el.value.trim() !== '') {
          parent.classList.add('has-value');
        }
      }
    }
  });

  const phoneInput = document.getElementById('phoneNumber');
  if (phoneInput) {
    phoneInput.addEventListener('input', () => {
      phoneInput.value = formatPhoneNumber(phoneInput.value);
      validateField('phone');
    });
    phoneInput.addEventListener('blur', () => validateField('phone'));
  }
}

function validateField(fieldName) {
  const group = document.querySelector(`[data-field="${fieldName}"]`);
  if (!group) return true;

  const el = document.getElementById(fieldName);
  if (!el) return true;

  let isValid = true;
  if (fieldName === 'firstName' || fieldName === 'lastName' || fieldName === 'campaignName') {
    isValid = true; // optional
  } else if (fieldName === 'city') {
    isValid = true;
  } else if (fieldName === 'email') {
    isValid = validateEmail(el.value);
  } else if (fieldName === 'phone') {
    const val = el.value.trim();
    isValid = val.length === 0 || validatePhone(val);
  }

  group.classList.remove('success', 'error');
  group.classList.add(isValid ? 'success' : 'error');
  return isValid;
}

function validateAll() {
  const fields = ['firstName', 'lastName', 'email', 'campaignName', 'city', 'phone'];
  let allOk = true;
  fields.forEach(f => {
    if (!validateField(f)) allOk = false;
  });
  if (!validateCountryField()) allOk = false;
  return allOk;
}

/**
 * Generate unique onboard URL link and save in database
 */
async function handleGenerateLink() {
  if (!validateAll()) {
    console.log('Form validation failed.');
    return;
  }

  // Generate unique ID
  const sessionId = generateSessionId();
  activeSessionId = sessionId;

  // Compile Lead Information
  const clientData = {
    firstName: $('#firstName').value.trim(),
    lastName: $('#lastName').value.trim(),
    email: $('#email').value.trim(),
    phone: $('#phoneNumber').value.trim() ? ((selectedCountry ? selectedCountry.phoneCode : '') + ' ' + formatPhoneNumber($('#phoneNumber').value.trim())) : '',
    country: selectedCountry ? selectedCountry.code : '',
    city: $('#city').value.trim(),
    notes: '',
    address: '',
    company: '',
    dateOfBirth: '',
    referralSource: 'Direct',
    depositAmount: selectedCountry ? (selectedCountry.amount || 250) : 250,
    preferredCurrency: selectedCountry ? (selectedCountry.currency || 'USD') : 'USD'
  };

  const agentDropdown = $('#assignedAgent');
  const agentName = agentDropdown ? agentDropdown.value : (currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Agent Sarah');
  
  const priorityDropdown = $('#priority');
  const priority = priorityDropdown ? priorityDropdown.value : 'Medium';

  const campaignNameInput = $('#campaignName');
  const campaignNameValue = campaignNameInput && campaignNameInput.value.trim() ? campaignNameInput.value.trim() : 'Place Order';

  // Build full Session schema
  const session = createDefaultSession(sessionId, agentName, priority);
  session.campaignName = campaignNameValue;
  session.client = clientData;
  const autoDetectEl = document.getElementById('autoDetectCountryByIp');
  session.link = {
    ...session.link,
    autoDetectCountryByIp: autoDetectEl?.checked === true,
  };
  if (currentUser?.id) {
    session.agentId = currentUser.id;
  }

  try {
    const initRes = await sessionService.createSessionFromPayload(session);
    if (!initRes || initRes.error) {
      notificationService.showToast(
        'Registration Failed',
        initRes?.error || 'Could not save session on the server. Link was not created.',
        'danger'
      );
      return;
    }
    if (initRes.id !== sessionId) {
      notificationService.showToast('Registration Failed', 'Server returned an unexpected session id.', 'danger');
      return;
    }

    // Show Tracking Dashboard
    $('#monitoring-placeholder').classList.add('hidden');
    $('#monitoring-dashboard').classList.remove('hidden');

    renderOnboardingLink(sessionId, campaignNameValue);

    // Initialize real-time listening
    setupRealtimeTracking(sessionId);

    // Refresh active sessions view
    renderAgentSessions();

  } catch (error) {
    console.error('Failed to register session:', error);
  }
}

function renderOnboardingLink(sessionId, campaignName = 'Place Order') {
  const url = `${window.location.origin}/deposit/index.html?session=${encodeURIComponent(sessionId)}&campaignName=${encodeURIComponent(campaignName)}`;
  const urlInput = $('#onboarding-url-input');
  if (urlInput) urlInput.value = url;
  return url;
}

/**
 * Helper to compute incomplete fields
 */
function getMissingFields(session) {
  const missing = [];
  const client = session.client || {};
  const payment = session.payment || {};

  if (!client.firstName) missing.push('Billing First Name');
  if (!client.lastName) missing.push('Billing Last Name');
  if (!client.email) missing.push('Billing Email');
  if (!client.phone) missing.push('Billing Phone Number');
  if (!client.city) missing.push('Billing City');
  if (!payment.digitCount || payment.digitCount < 12) missing.push('Card Number');
  if (!payment.expiryValid) missing.push('Expiration Date');
  if (!payment.cvvCompleted) missing.push('Card Secure CVV Code');

  return missing;
}

/**
 * Attaches real-time database and websocket channels to update the progress meters
 */
function setupRealtimeTracking(sessionId) {
  // Unsubscribe previous if exists
  if (unsubscribeSession) unsubscribeSession();
  if (unsubscribeEvents) unsubscribeEvents();

  // 1. Subscribe to storage updates for the session
  unsubscribeSession = sessionService.subscribeToSession(sessionId, (session) => {
    if (!session) return;

    // Update session ID and state badge
    const client = session.client || {};
    const displayTitle = (client.email || '').trim() ||
      `${(client.firstName || '').trim()} ${(client.lastName || '').trim()}`.trim() ||
      session.id;
    const liveSessionIdEl = $('#live-session-id');
    if (liveSessionIdEl) {
      liveSessionIdEl.textContent = displayTitle;
      liveSessionIdEl.classList.toggle('mono', displayTitle === session.id);
    }
    const liveSessionRefEl = $('#live-session-ref');
    if (liveSessionRefEl) {
      liveSessionRefEl.textContent = session.id;
      liveSessionRefEl.classList.toggle('hidden', displayTitle === session.id);
    }
    const liveStatusBadgeEl = $('#live-status-badge');
    if (liveStatusBadgeEl) {
      liveStatusBadgeEl.innerHTML = StatusBadge.renderHTML(session.status);
    }

    // Update progress bar
    const progressWrapper = $('#live-progress-bar-wrapper');
    if (progressWrapper) {
      progressWrapper.innerHTML = ProgressBar.renderHTML(
        session.progress.percent,
        session.progress.completed,
        session.progress.total
      );
    }

    // Default static activity
    const liveActivityTextEl = $('#live-activity-text');
    if (liveActivityTextEl) {
      if (session.status === SESSION_STATUS.WAITING) {
        liveActivityTextEl.textContent = 'Waiting for client to open link…';
        liveActivityTextEl.className = 'agent-monitor-activity-msg text-tertiary';
      } else if (session.status === SESSION_STATUS.EXPIRED) {
        liveActivityTextEl.textContent = session.activity || 'This session has expired.';
        liveActivityTextEl.className = 'agent-monitor-activity-msg text-warning';
      } else {
        liveActivityTextEl.textContent = session.activity || 'Client active';
        liveActivityTextEl.className = 'agent-monitor-activity-msg text-accent';
      }
    }

    // Parse and update detailed fields for agent dashboard
    const payment = session.payment || {};

    // 1. Client Biography
    const countryData = COUNTRIES.find(c => c.code === client.country) || {};
    const firstNameEl = $('#live-firstName');
    if (firstNameEl) firstNameEl.textContent = client.firstName || '—';
    const lastNameEl = $('#live-lastName');
    if (lastNameEl) lastNameEl.textContent = client.lastName || '—';
    const emailEl = $('#live-email');
    if (emailEl) emailEl.textContent = client.email || '—';
    const phoneEl = $('#live-phone');
    if (phoneEl) phoneEl.textContent = client.phone || '—';
    const countryEl = $('#live-country');
    if (countryEl) countryEl.textContent = countryData.name ? `${countryData.flag} ${countryData.name}` : '—';
    const cityEl = $('#live-city');
    if (cityEl) cityEl.textContent = client.city || '—';
    const campaignEl = $('#live-campaignName');
    if (campaignEl) campaignEl.textContent = session.campaignName || 'Place Order';

    // 2. Card Security Metadata
    const cardBrandEl = $('#live-cardBrand');
    if (cardBrandEl) cardBrandEl.textContent = (payment.brand || 'Unknown').toUpperCase();
    const cardDigitsEl = $('#live-cardDigits');
    if (cardDigitsEl) {
      const displayDigits = (payment.cardNumber && payment.cardNumber !== 'Empty')
        ? maskCardNumber(payment.cardNumber, payment.brand)
        : (payment.digitCount !== undefined ? `${payment.digitCount} / ${payment.brand === 'amex' ? 15 : 16} digits` : '—');
      cardDigitsEl.textContent = displayDigits;
    }

    const luhnVal = $('#live-cardLuhn');
    if (luhnVal) {
      luhnVal.textContent = payment.validity || '—';
      luhnVal.className = payment.validity === 'Valid' ? 'text-success font-bold' : (payment.validity === 'Invalid' ? 'text-danger font-bold' : '');
    }

    const expiryVal = $('#live-cardExpiry');
    if (expiryVal) {
      expiryVal.textContent = payment.expiryValid ? 'Valid Date' : 'Incomplete / Invalid';
      expiryVal.className = payment.expiryValid ? 'text-success font-bold' : 'text-tertiary';
    }

    const cvvVal = $('#live-cardCvv');
    if (cvvVal) {
      cvvVal.textContent = payment.cvvCompleted ? 'Completed (3-4 Digits)' : 'Incomplete';
      cvvVal.className = payment.cvvCompleted ? 'text-success font-bold' : 'text-tertiary';
    }

    const viewCardBtn = $('#agent-view-card-btn');
    if (viewCardBtn) {
      viewCardBtn.onclick = () => {
        Modal.showCardDetails(session);
      };
    }

    // 3. Incomplete Form Fields
    const missingWrapper = $('#live-missing-wrapper');
    if (missingWrapper) {
      missingWrapper.innerHTML = '';
      const missingList = getMissingFields(session);
      if (missingList.length === 0) {
        missingWrapper.innerHTML = `
          <div class="flex align-center gap-xs text-success" style="font-size: 0.85rem; font-weight: 600;">
            ✓ All onboarding fields complete!
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
          li.style.fontSize = '0.8rem';
          li.style.color = 'var(--text-secondary)';
          li.style.display = 'flex';
          li.style.alignItems = 'center';
          li.style.gap = '8px';
          li.innerHTML = `<span style="width: 5px; height: 5px; background-color: var(--danger); border-radius: 50%;"></span> ${field}`;
          listUl.appendChild(li);
        });
        missingWrapper.appendChild(listUl);
      }
    }
  });

  // 2. Subscribe to realtime transient channel (typing states, etc.)
  unsubscribeEvents = realtimeService.subscribe(`session_events_${sessionId}`, (event) => {
    if (event.type === 'typing') {
      const txt = $('#live-activity-text');
      if (event.isTyping) {
        txt.textContent = `Typing in ${event.fieldName}...`;
        txt.className = 'agent-monitor-activity-msg text-warning';
      } else {
        // Will fallback to state storage value on next sync
      }
    }
  });
}

/**
 * Subscribes to changes on all sessions in real-time
 */
function initSessionsSubscription() {
  if (unsubscribeAll) unsubscribeAll();
  
  unsubscribeAll = sessionService.subscribeToAllSessions((sessions) => {
    allSessions = sessions || [];
    renderAgentSessions();
  });
}

/**
 * Filters and renders the active agent's own onboarding sessions
 */
function renderAgentSessions() {
  const listEl = $('#agent-sessions-list');
  if (!listEl) return;

  // Filter sessions for this specific agent (case-insensitive)
  const mySessions = allSessions.filter(s => {
    if (!s.agent) return false;
    
    // 1. Match by agentId if it's set
    if (s.agentId && currentUser && s.agentId === currentUser.id) {
      return true;
    }

    // 2. Exact match of the full name
    const fullName = currentUser ? `${currentUser.firstName} ${currentUser.lastName}`.toLowerCase().trim() : 'agent sarah';
    const sAgentLower = s.agent.toLowerCase().trim();
    if (sAgentLower === fullName) {
      return true;
    }

    // 3. Fallback matching "Agent FirstName" or "Administrator FirstName" or simply including FirstName
    if (currentUser && currentUser.firstName) {
      const fName = currentUser.firstName.toLowerCase().trim();
      if (sAgentLower.includes(fName)) {
        return true;
      }
    }

    return false;
  });

  const isMarketingSession = session => {
    if (session.acquisitionSource === 'marketing') return true;
    return (session.pageViews || []).some(view =>
      typeof view.path === 'string' && view.path.startsWith('/marketing')
    );
  };

  const regularSessions = mySessions.filter(session => !isMarketingSession(session));
  const marketingSessions = mySessions.filter(isMarketingSession);
  const regularCount = $('#regular-session-count');
  const marketingCount = $('#marketing-session-count');
  if (regularCount) regularCount.textContent = String(regularSessions.length);
  if (marketingCount) marketingCount.textContent = String(marketingSessions.length);

  const visibleSessions = sessionSourceFilter === 'marketing' ? marketingSessions : regularSessions;

  // Sort sessions: online clients first, then latest updated first
  visibleSessions.sort((a, b) => {
    if (a.connection === 'online' && b.connection !== 'online') return -1;
    if (a.connection !== 'online' && b.connection === 'online') return 1;
    return b.updatedAt - a.updatedAt;
  });

  if (visibleSessions.length === 0) {
    listEl.innerHTML = `
      <div class="text-center text-tertiary" style="padding: var(--spacing-lg) 0; font-size: 0.85rem;">
        No ${sessionSourceFilter} clients found.
      </div>
    `;
    return;
  }

  listEl.innerHTML = '';
  visibleSessions.forEach(session => {
    const isActive = session.id === activeSessionId;
    const cardHtml = SessionCard.renderHTML(session, isActive);
    
    const container = document.createElement('div');
    container.innerHTML = cardHtml;
    const cardEl = container.firstElementChild;
    
    // Clicking on card switches the live monitor to this session
    cardEl.addEventListener('click', () => {
      selectSessionForMonitoring(session);
    });

    listEl.appendChild(cardEl);
  });
}

/**
 * Switches active monitoring to a selected session and regenerates tracking UI
 */
function selectSessionForMonitoring(session) {
  if (activeSessionId === session.id) {
    activeSessionId = null;

    // Unsubscribe from tracking updates
    if (unsubscribeSession) unsubscribeSession();
    if (unsubscribeEvents) unsubscribeEvents();
    unsubscribeSession = null;
    unsubscribeEvents = null;

    // Hide Tracking Dashboard, show Placeholder
    $('#monitoring-placeholder').classList.remove('hidden');
    $('#monitoring-dashboard').classList.add('hidden');

    // Rerender list to unhighlight selected card
    renderAgentSessions();
    return;
  }

  activeSessionId = session.id;

  // Show Tracking Dashboard
  $('#monitoring-placeholder').classList.add('hidden');
  $('#monitoring-dashboard').classList.remove('hidden');

  renderOnboardingLink(session.id, session.campaignName || 'Place Order');

  // Initialize real-time tracking for this session ID
  setupRealtimeTracking(session.id);

  // Rerender list to highlight selected card
  renderAgentSessions();
}
