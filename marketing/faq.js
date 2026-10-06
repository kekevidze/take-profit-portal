const TAB_LABELS = {
  'opening-and-controlling-your-account': 'Account',
  'payment-submission-and-the-72-hour-window': 'Payments',
  'card-and-website-security': 'Card security',
  'protecting-access-to-your-financial-account': 'Access',
  'identity-verification-and-account-checks': 'Verification',
  'funds-fees-refunds-and-account-closure': 'Funds',
  'getting-help': 'Help',
};

const tabsEl = document.getElementById('faqTabs');
const panelsEl = document.getElementById('faqPanels');
const headingEl = document.getElementById('faqHeading');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderFaq(data) {
  if (!tabsEl || !panelsEl || !data.categories?.length) return;

  if (headingEl) headingEl.textContent = data.heading;

  tabsEl.innerHTML = data.categories
    .map((cat, index) => {
      const label = TAB_LABELS[cat.id] || cat.title;
      return `<button type="button" role="tab" id="faq-tab-${cat.id}" aria-selected="${index === 0 ? 'true' : 'false'}" aria-controls="faq-panel-${cat.id}" data-faq-tab="${cat.id}">${escapeHtml(label)}</button>`;
    })
    .join('');

  panelsEl.innerHTML = data.categories
    .map((cat, index) => {
      const items = cat.questions
        .map(
          (item) => `
          <details class="faq-item">
            <summary>${escapeHtml(item.q)}</summary>
            <p>${escapeHtml(item.a)}</p>
          </details>`
        )
        .join('');
      return `
        <div class="faq-panel" role="tabpanel" id="faq-panel-${cat.id}" aria-labelledby="faq-tab-${cat.id}" data-faq-panel="${cat.id}"${index === 0 ? '' : ' hidden'}>
          <h3 class="faq-panel-title">${escapeHtml(cat.title)}</h3>
          <div class="faq-list">${items}</div>
        </div>`;
    })
    .join('');

  tabsEl.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-faq-tab]');
    if (!tab) return;
    const id = tab.dataset.faqTab;
    tabsEl.querySelectorAll('[role="tab"]').forEach((btn) => {
      btn.setAttribute('aria-selected', btn === tab ? 'true' : 'false');
    });
    panelsEl.querySelectorAll('[data-faq-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.faqPanel !== id;
    });
    tab.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  });
}

fetch('faq-data.json')
  .then((res) => {
    if (!res.ok) throw new Error('Failed to load FAQ');
    return res.json();
  })
  .then(renderFaq)
  .catch(() => {
    if (panelsEl) panelsEl.innerHTML = '<p class="faq-error">Common questions could not be loaded.</p>';
  });
