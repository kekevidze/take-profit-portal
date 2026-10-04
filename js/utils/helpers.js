/**
 * helpers.js
 * Utility helper functions for UI, clipboard, time, debouncing, and sound.
 */

/**
 * Generates a unique, elegant 8-character alphanumeric session ID
 * e.g., DEP-9D82JKL4
 * Uses cryptographically secure random values when available.
 */
export function generateSessionId() {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Excluded confusing letters (I, O)
  let result = '';
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const array = new Uint32Array(8);
    window.crypto.getRandomValues(array);
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(array[i] % chars.length);
    }
  } else {
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  return `DEP-${result}`;
}

/**
 * Escapes special HTML characters to prevent Cross-Site Scripting (XSS)
 */
export function escapeHTML(str) {
  if (typeof str !== 'string') {
    if (str === null || str === undefined) return '';
    return String(str);
  }
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Safely parse query parameters from the window's URL
 */
export function getQueryParam(param) {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
  } catch (error) {
    console.error('Failed to parse query param:', error);
    return null;
  }
}

/**
 * Format a Unix timestamp into a highly readable relative string (e.g., "5s ago", "just now")
 */
export function formatTimeAgo(timestamp) {
  if (!timestamp) return 'Never';
  const diff = Date.now() - timestamp;
  if (diff < 1000) return 'just now';
  if (diff < 60000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

/**
 * Standard debounce to avoid flooding realtime sockets on continuous keystrokes
 */
export function debounce(func, delay) {
  let timer;
  return function (...args) {
    const context = this;
    clearTimeout(timer);
    timer = setTimeout(() => func.apply(context, args), delay);
  };
}

/**
 * Copies text safely to the clipboard and triggers a visual callback
 */
export async function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }
  }
  
  // Fallback for older environments/browsers
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed'; // Avoid scrolling
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textArea);
    return success;
  } catch (err) {
    console.error('Fallback copy failed:', err);
    return false;
  }
}

/**
 * Triggers a pleasant, high-quality audio chime for real-time notifications
 */
export function playNotificationSound(soundUrl) {
  try {
    const audio = new Audio(soundUrl);
    audio.volume = 0.5;
    audio.play().catch(e => {
      // Browsers often block audio on first load before user interaction
      console.log('Audio autoplay prevented. Will play on next user interaction.');
    });
  } catch (error) {
    console.warn('Audio play failed:', error);
  }
}
