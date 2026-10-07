const DEFAULT_DEPOSIT_AMOUNT = '350';

function depositPageUrl() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = (
    window.marketingVisitorId ||
    localStorage.getItem('anon_visitor_id') ||
    ''
  ).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
  const referral = (
    params.get('ref') ||
    params.get('agent') ||
    sessionStorage.getItem('demoAgentRef') ||
    ''
  ).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);

  if (sessionId) {
    const checkoutParams = new URLSearchParams({ session: sessionId });
    if (referral) checkoutParams.set('ref', referral);
    return `/deposit/?${checkoutParams.toString()}`;
  }

  return referral ? `/deposit/?ref=${encodeURIComponent(referral)}` : '/deposit/';
}

window.depositPageUrl = depositPageUrl;

function applyDefaultDepositAmount() {
  document.querySelectorAll('#amount').forEach((input) => {
    input.value = DEFAULT_DEPOSIT_AMOUNT;
  });
}

function bindDepositPageLinks(root = document) {
  root.querySelectorAll('[data-deposit-page]').forEach((el) => {
    el.addEventListener('click', async (event) => {
      event.preventDefault();
      if (window.marketingSessionReady) {
        await window.marketingSessionReady;
      }
      window.location.href = depositPageUrl();
    });
  });
}

function initDepositForm() {
  const form = document.getElementById('depositForm');
  const toast = document.getElementById('toast');
  const agentReference = document.getElementById('agentReference');
  const agentCode = document.getElementById('agentCode');

  const agentParam = (
    new URLSearchParams(location.search).get('agent') ||
    new URLSearchParams(location.search).get('ref') ||
    sessionStorage.getItem('demoAgentRef') ||
    ''
  )
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 40);

  if (agentParam) {
    sessionStorage.setItem('demoAgentRef', agentParam);
    if (agentCode) agentCode.textContent = agentParam;
    if (agentReference) agentReference.hidden = false;
  }

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!toast) return;
    toast.textContent = 'Deposit request submitted.';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3200);
  });
}

applyDefaultDepositAmount();
bindDepositPageLinks();
if (document.getElementById('depositForm')) initDepositForm();
