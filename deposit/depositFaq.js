/**
 * Deposit page — Learn more FAQ modal
 */

let overlayEl = null;
let faqHtmlPromise = null;

function loadFaqContent() {
  if (!faqHtmlPromise) {
    faqHtmlPromise = fetch('/deposit/faq-content.html')
      .then((res) => (res.ok ? res.text() : ''))
      .catch(() => '');
  }
  return faqHtmlPromise;
}

function closeFaqModal() {
  if (!overlayEl) return;
  overlayEl.classList.remove('is-open');
  document.body.style.overflow = '';
}

function ensureOverlay() {
  if (overlayEl) return overlayEl;

  overlayEl = document.createElement('div');
  overlayEl.id = 'depositFaqOverlay';
  overlayEl.className = 'deposit-faq-overlay';
  overlayEl.setAttribute('role', 'dialog');
  overlayEl.setAttribute('aria-modal', 'true');
  overlayEl.setAttribute('aria-labelledby', 'depositFaqTitle');

  overlayEl.innerHTML = `
    <div class="deposit-faq-modal">
      <button type="button" class="deposit-faq-close-circle" id="depositFaqCloseCircle" aria-label="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
      <div class="deposit-faq-scroll" id="depositFaqScroll"></div>
      <div class="deposit-faq-footer">
        <button type="button" class="deposit-faq-close-btn" id="depositFaqCloseBtn">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlayEl);

  overlayEl.querySelector('#depositFaqCloseCircle')?.addEventListener('click', closeFaqModal);
  overlayEl.querySelector('#depositFaqCloseBtn')?.addEventListener('click', closeFaqModal);
  overlayEl.addEventListener('click', (e) => {
    if (e.target === overlayEl) closeFaqModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlayEl?.classList.contains('is-open')) {
      closeFaqModal();
    }
  });

  return overlayEl;
}

export async function openDepositFaqModal() {
  const overlay = ensureOverlay();
  const scroll = overlay.querySelector('#depositFaqScroll');
  if (scroll && !scroll.dataset.loaded) {
    scroll.innerHTML = '<p style="text-align:center;color:#64748b;">Loading…</p>';
    const html = await loadFaqContent();
    scroll.innerHTML = html || '<p>FAQ content is unavailable.</p>';
    scroll.dataset.loaded = '1';
  }
  overlay.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

export function initDepositFaqModal() {
  const btn = document.getElementById('depositLearnMoreBtn');
  if (btn) {
    btn.addEventListener('click', () => {
      void openDepositFaqModal();
    });
  }
}
