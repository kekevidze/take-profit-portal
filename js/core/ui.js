/**
 * ui.js
 * Shared client-side UI helper functions, theme toggling, and modal controls.
 */

/**
 * Safely query an element, avoiding runtime null exceptions
 */
export function $(selector) {
  return document.querySelector(selector);
}

/**
 * Safely query multiple elements
 */
export function $all(selector) {
  return document.querySelectorAll(selector);
}

/**
 * Init Light/Dark Theme toggle capability and load user preference
 */
export function initThemeToggle() {
  const body = document.body;
  const savedTheme = localStorage.getItem('portal_theme') || 'dark';
  
  if (savedTheme === 'light') {
    body.classList.add('light-theme');
  } else {
    body.classList.remove('light-theme');
  }

  // Bind all triggers (if exist on page)
  $all('.theme-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const isLight = body.classList.toggle('light-theme');
      localStorage.setItem('portal_theme', isLight ? 'light' : 'dark');
      console.log(`Theme toggled to: ${isLight ? 'LIGHT' : 'DARK'}`);
    });
  });
}

/**
 * Renders a simple, clean modal dialog
 */
export function openModal(id, title, contentHtml, onCloseCallback = null) {
  // Remove existing if any
  const existing = document.getElementById(id);
  if (existing) existing.remove();

  const backdrop = document.createElement('div');
  backdrop.id = id;
  backdrop.className = 'modal-backdrop';
  backdrop.style.position = 'fixed';
  backdrop.style.inset = '0';
  backdrop.style.backgroundColor = 'rgba(0, 0, 0, 0.65)';
  backdrop.style.backdropFilter = 'blur(4px)';
  backdrop.style.display = 'flex';
  backdrop.style.alignItems = 'center';
  backdrop.style.justifyContent = 'center';
  backdrop.style.zIndex = '9999';

  const modal = document.createElement('div');
  modal.className = 'card animate-modal-in';
  modal.style.width = '100%';
  modal.style.maxWidth = '480px';
  modal.style.padding = 'var(--spacing-lg)';
  modal.style.backgroundColor = 'var(--surface)';
  modal.style.border = '1px solid var(--border)';
  modal.style.boxShadow = 'var(--shadow-lg)';

  modal.innerHTML = `
    <div class="card-header" style="margin-bottom: var(--spacing-md); border-bottom: 1px solid var(--border); padding-bottom: var(--spacing-sm);">
      <h3 class="card-title">${title}</h3>
      <button class="btn-icon btn-sm btn-tertiary" style="width: 24px; height: 24px;" id="${id}-close-btn">
        <svg viewBox="0 0 24 24" width="16" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
    <div class="modal-content" style="margin-bottom: var(--spacing-lg);">
      ${contentHtml}
    </div>
  `;

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  const closeFn = () => {
    backdrop.remove();
    if (onCloseCallback) onCloseCallback();
  };

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeFn();
  });
  
  document.getElementById(`${id}-close-btn`).addEventListener('click', closeFn);
}
