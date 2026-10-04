/**
 * notificationService.js
 * Manages native push notifications, in-app toast alerts, and audible chime cues.
 */

import { CONFIG } from '../utils/constants.js';
import { playNotificationSound } from '../utils/helpers.js';

class NotificationService {
  constructor() {
    this.hasPermission = false;
    this._requestPermission();
  }

  /**
   * Request native browser notification permission
   */
  async _requestPermission() {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        this.hasPermission = true;
      } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        this.hasPermission = permission === 'granted';
      }
    }
  }

  /**
   * Trigger an in-app animated toast alert banner
   */
  showToast(title, body, type = 'info') {
    // Play pleasant notification sound chime
    playNotificationSound(CONFIG.NOTIFICATION_SOUND_URL);

    // Create toast container if not exists
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.position = 'fixed';
      container.style.bottom = '24px';
      container.style.right = '24px';
      container.style.zIndex = '9999';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.gap = '12px';
      document.body.appendChild(container);
    }

    // Create single toast element
    const toast = document.createElement('div');
    toast.className = `card animate-modal-in flex align-center gap-md`;
    toast.style.width = '350px';
    toast.style.padding = '14px 18px';
    toast.style.backgroundColor = 'var(--surface)';
    toast.style.border = '1px solid var(--border-strong)';
    toast.style.borderRadius = 'var(--radius-md)';
    toast.style.boxShadow = 'var(--shadow-lg)';

    // Icon based on type
    let colorClass = 'text-accent';
    let iconSvg = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    
    if (type === 'success') {
      colorClass = 'text-success';
      iconSvg = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
    } else if (type === 'warning') {
      colorClass = 'text-warning';
      iconSvg = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
    } else if (type === 'danger') {
      colorClass = 'text-danger';
      iconSvg = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    }

    toast.innerHTML = `
      <div class="${colorClass}">${iconSvg}</div>
      <div class="flex-1" style="min-width: 0;">
        <h4 style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary); margin-bottom: 2px;">${title}</h4>
        <p class="text-truncate" style="font-size: 0.8rem; color: var(--text-secondary);">${body}</p>
      </div>
      <button class="btn-icon btn-sm btn-tertiary" style="width: 24px; height: 24px;" onclick="this.parentElement.remove()">
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    `;

    container.appendChild(toast);

    // Auto-remove toast after 5 seconds
    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.transition = 'opacity 0.3s var(--ease-in-out), transform 0.3s var(--ease-in-out)';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px) scale(0.95)';
        setTimeout(() => toast.remove(), 300);
      }
    }, 5000);

    // Trigger native browser notification if allowed and tab is out of focus
    if (this.hasPermission && document.visibilityState === 'hidden') {
      try {
        new Notification(title, { body: body, icon: '/favicon.ico' });
      } catch (err) {
        console.warn('Native notification failed:', err);
      }
    }
  }
}

export const notificationService = new NotificationService();
export default notificationService;
