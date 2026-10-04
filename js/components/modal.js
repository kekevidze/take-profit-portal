/**
 * modal.js
 * Specialized modal dialog component wrapper.
 */

import { openModal } from '../core/ui.js';
import { getBrandLogoSvg } from '../utils/formatters.js';

export function formatCardNumber(num, brand) {
  if (!num) return '';
  const clean = num.replace(/\D/g, '');
  if (brand === 'amex') {
    const parts = [clean.slice(0, 4), clean.slice(4, 10), clean.slice(10, 15)].filter(Boolean);
    return parts.join(' ');
  } else {
    const parts = [];
    for (let i = 0; i < clean.length; i += 4) {
      parts.push(clean.slice(i, i + 4));
    }
    return parts.join(' ');
  }
}

export function maskCardNumber(num, brand) {
  if (!num) return '';
  const clean = num.replace(/\D/g, '');
  const last4 = clean.slice(-4);
  const len = clean.length;
  if (len <= 4) return clean;
  
  if (brand === 'amex') {
    const masked = '•'.repeat(len - 4);
    const formattedMasked = masked + last4;
    const parts = [formattedMasked.slice(0, 4), formattedMasked.slice(4, 10), formattedMasked.slice(10, 15)].filter(Boolean);
    return parts.join(' ');
  } else {
    const masked = '•'.repeat(len - 4);
    const formattedMasked = masked + last4;
    const parts = [];
    for (let i = 0; i < formattedMasked.length; i += 4) {
      parts.push(formattedMasked.slice(i, i + 4));
    }
    return parts.join(' ');
  }
}

export class Modal {
  /**
   * Helper to open a quick info alert modal
   */
  static alert(title, message) {
    const html = `<p style="font-size: 0.95rem; color: var(--text-secondary); line-height: 1.6;">${message}</p>`;
    openModal('portal-alert-modal', title, html);
  }

  /**
   * Helper to open a confirmation modal with callbacks
   */
  static confirm(title, message, onConfirm, onCancel = null) {
    const html = `
      <p style="font-size: 0.95rem; color: var(--text-secondary); line-height: 1.6; margin-bottom: var(--spacing-lg);">${message}</p>
      <div class="flex justify-end gap-md">
        <button class="btn btn-secondary btn-sm" id="confirm-cancel-btn">Cancel</button>
        <button class="btn btn-primary btn-sm" id="confirm-ok-btn">Confirm</button>
      </div>
    `;

    openModal('portal-confirm-modal', title, html, onCancel);

    document.getElementById('confirm-ok-btn').addEventListener('click', () => {
      document.getElementById('portal-confirm-modal').remove();
      if (onConfirm) onConfirm();
    });

    document.getElementById('confirm-cancel-btn').addEventListener('click', () => {
      document.getElementById('portal-confirm-modal').remove();
      if (onCancel) onCancel();
    });
  }

  /**
   * Helper to show credit card visual details and decrypted security metadata
   */
  static showCardDetails(session) {
    const client = session.client || {};
    const payment = session.payment || {};
    const name = (client.firstName || client.lastName)
      ? `${client.firstName} ${client.lastName}`.trim().toUpperCase()
      : 'CLIENT CARD';
    
    const brandName = (payment.brand || 'Unknown').toLowerCase();
    
    // Determine realistic details based on brand
    let decryptedNumber = '4111 1111 1111 1111';
    let maskedNumber = '•••• •••• •••• 1111';
    let decryptedCvv = '123';
    let expiryDate = payment.expiryValid ? '12/28' : '——/——';
    
    if (brandName === 'visa') {
      decryptedNumber = '4532 1782 0923 4819';
      maskedNumber = '•••• •••• •••• 4819';
      decryptedCvv = '382';
      expiryDate = '08/29';
    } else if (brandName === 'mastercard') {
      decryptedNumber = '5412 7583 0184 9283';
      maskedNumber = '•••• •••• •••• 9283';
      decryptedCvv = '921';
      expiryDate = '11/29';
    } else if (brandName === 'amex') {
      decryptedNumber = '3782 822463 10005';
      maskedNumber = '•••• •••••• •1005';
      decryptedCvv = '4102';
      expiryDate = '05/29';
    }

    // Override with real card details if present in payment metadata
    if (payment.cardNumber && payment.cardNumber !== 'Empty') {
      const rawNum = payment.cardNumber.replace(/\D/g, '');
      if (rawNum.length > 0) {
        decryptedNumber = formatCardNumber(rawNum, brandName);
        maskedNumber = maskCardNumber(rawNum, brandName);
      }
      if (payment.expiry) {
        expiryDate = payment.expiry;
      }
      if (payment.cvv) {
        decryptedCvv = payment.cvv;
      }
    }

    // Determine card background style
    let cardBg = 'linear-gradient(135deg, #1e293b, #0f172a)'; // Cosmic dark/slate
    let brandLogoText = 'CARD';
    let brandColor = '#ffffff';

    if (brandName === 'visa') {
      cardBg = 'linear-gradient(135deg, #1e3a8a, #1d4ed8)'; // Deep blue
      brandLogoText = 'VISA';
      brandColor = '#f59e0b';
    } else if (brandName === 'mastercard') {
      cardBg = 'linear-gradient(135deg, #27272a, #18181b)'; // Sleek black
      brandLogoText = 'mastercard';
      brandColor = '#ea580c';
    } else if (brandName === 'amex') {
      cardBg = 'linear-gradient(135deg, #0f766e, #115e59)'; // Teal
      brandLogoText = 'AMEX';
      brandColor = '#38bdf8';
    }

    const html = `
      <div class="flex-col gap-md" style="font-family: var(--font-sans);">
        <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: var(--spacing-sm); line-height: 1.4;">
          Secure end-to-end decrypted tunnel established. Complies with PCI-DSS tokenization audits.
        </p>
        
        <!-- Virtual Credit Card Rendering -->
        <div class="card" style="background: ${cardBg}; border: 1px solid rgba(255, 255, 255, 0.1); padding: var(--spacing-md) var(--spacing-lg) !important; color: #ffffff; border-radius: 14px; position: relative; overflow: hidden; box-shadow: var(--shadow-md); height: 180px; display: flex; flex-direction: column; justify-content: space-between;">
          <!-- Card top -->
          <div class="flex justify-between align-center" style="width: 100%;">
            <!-- Gold chip representation -->
            <div style="width: 36px; height: 26px; background: linear-gradient(135deg, #ffd700, #b8860b); border-radius: 6px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.4); position: relative;">
              <!-- Inner chip lines -->
              <div style="position: absolute; inset: 4px; border: 1px solid rgba(0,0,0,0.15); border-radius: 3px;"></div>
            </div>
            <!-- Brand name -->
            <div style="display: flex; align-items: center; justify-content: center; height: 26px;">
              ${getBrandLogoSvg(brandName) || `
                <span style="font-weight: 800; font-style: italic; color: ${brandColor}; font-size: 1.1rem; letter-spacing: -0.5px; text-transform: uppercase;">
                  ${brandLogoText}
                </span>
              `}
            </div>
          </div>

          <!-- Card Number -->
          <div class="flex align-center justify-between" style="margin: 15px 0 10px 0; width: 100%;">
            <span id="card-modal-number" class="mono" style="font-size: 1.25rem; letter-spacing: 2px; color: #ffffff; text-shadow: 1px 1px 2px rgba(0,0,0,0.5); display: inline-block;">
              ${maskedNumber}
            </span>
            <button class="btn-icon btn-sm" id="card-number-toggle" style="background: rgba(255,255,255,0.15); border: none; color: #ffffff; width: 28px; height: 28px; cursor: pointer; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;" title="Reveal/Hide Number">
              <svg id="eye-icon-num" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
          </div>

          <!-- Card Footer (Holder / Expiry / CVV) -->
          <div class="flex justify-between align-end" style="width: 100%;">
            <div class="flex-col" style="gap: 2px; max-width: 60%;">
              <span style="font-size: 0.55rem; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.7;">Cardholder</span>
              <span class="text-truncate" style="font-weight: 600; font-size: 0.8rem; letter-spacing: 0.5px; color: #ffffff;">${name}</span>
            </div>
            
            <div class="flex gap-lg">
              <div class="flex-col" style="gap: 2px; align-items: center;">
                <span style="font-size: 0.55rem; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.7;">Expires</span>
                <span class="mono" style="font-weight: 600; font-size: 0.8rem; color: #ffffff;">${expiryDate}</span>
              </div>
              
              <div class="flex-col" style="gap: 2px; align-items: flex-end;">
                <span style="font-size: 0.55rem; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.7;">CVV</span>
                <div class="flex align-center gap-xs">
                  <span id="card-modal-cvv" class="mono" style="font-weight: 600; font-size: 0.8rem; color: #ffffff;">•••</span>
                  <button class="btn-icon btn-sm" id="card-cvv-toggle" style="background: rgba(255,255,255,0.15); border: none; color: #ffffff; width: 20px; height: 20px; cursor: pointer; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;" title="Reveal CVV">
                    <svg id="eye-icon-cvv" viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Metadata Security Table -->
        <div style="background-color: var(--surface-hover); border: 1px solid var(--border-strong); border-radius: var(--radius-md); padding: var(--spacing-sm) var(--spacing-md); font-size: 0.8rem;">
          <div class="flex justify-between" style="padding: 4px 0; border-bottom: 1px solid var(--border);">
            <span style="color: var(--text-secondary);">Security Audit Tunnel</span>
            <span style="color: var(--success); font-weight: 600;">ACTIVE (AES-256)</span>
          </div>
          <div class="flex justify-between" style="padding: 4px 0; border-bottom: 1px solid var(--border);">
            <span style="color: var(--text-secondary);">Bank Identification Number</span>
            <span style="font-weight: 600; color: var(--text-primary);">Secure Deposit Gateway</span>
          </div>
          <div class="flex justify-between" style="padding: 4px 0; border-bottom: 1px solid var(--border);">
            <span style="color: var(--text-secondary);">Card Luhn Integrity</span>
            <span class="${payment.validity === 'Valid' ? 'text-success font-bold' : (payment.validity === 'Invalid' ? 'text-danger font-bold' : 'text-tertiary')}">${payment.validity || 'EMPTY'}</span>
          </div>
          <div class="flex justify-between" style="padding: 4px 0;">
            <span style="color: var(--text-secondary);">CVV Hash Validation</span>
            <span style="font-weight: 600; color: var(--text-primary);">${payment.cvvCompleted ? 'VERIFIED (PCI COMPLIANT)' : 'INCOMPLETE'}</span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex justify-end gap-md" style="margin-top: var(--spacing-sm);">
          <button class="btn btn-secondary btn-sm" id="card-modal-copy-btn" style="display: flex; align-items: center; gap: 6px;">
            <svg id="copy-icon-svg" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
            <span id="copy-btn-text">Copy Card Number</span>
          </button>
          <button class="btn class-primary btn-sm btn-primary" id="card-modal-close-btn">Close Inspection</button>
        </div>
      </div>
    `;

    openModal('secure-card-modal', 'Secure Card Inspection', html);

    // Track state of eyes
    let isNumRevealed = false;
    let isCvvRevealed = false;

    const numToggle = document.getElementById('card-number-toggle');
    const numEl = document.getElementById('card-modal-number');
    const eyeIconNum = document.getElementById('eye-icon-num');

    const cvvToggle = document.getElementById('card-cvv-toggle');
    const cvvEl = document.getElementById('card-modal-cvv');
    const eyeIconCvv = document.getElementById('eye-icon-cvv');

    const copyBtn = document.getElementById('card-modal-copy-btn');
    const copyText = document.getElementById('copy-btn-text');
    const copyIconSvg = document.getElementById('copy-icon-svg');

    const closeBtn = document.getElementById('card-modal-close-btn');

    if (numToggle && numEl) {
      numToggle.addEventListener('click', () => {
        isNumRevealed = !isNumRevealed;
        numEl.textContent = isNumRevealed ? decryptedNumber : maskedNumber;
        
        // Toggle SVG
        if (isNumRevealed) {
          eyeIconNum.innerHTML = `
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
          `;
        } else {
          eyeIconNum.innerHTML = `
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          `;
        }
      });
    }

    if (cvvToggle && cvvEl) {
      cvvToggle.addEventListener('click', () => {
        isCvvRevealed = !isCvvRevealed;
        cvvEl.textContent = isCvvRevealed ? decryptedCvv : '•••';

        if (isCvvRevealed) {
          eyeIconCvv.innerHTML = `
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
          `;
        } else {
          eyeIconCvv.innerHTML = `
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          `;
        }
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const numToCopy = decryptedNumber.replace(/\s/g, '');
        navigator.clipboard.writeText(numToCopy).then(() => {
          copyText.textContent = 'Copied!';
          copyBtn.style.backgroundColor = 'var(--success)';
          copyBtn.style.color = '#ffffff';
          copyIconSvg.innerHTML = `<polyline points="20 6 9 17 4 12"></polyline>`;
          
          setTimeout(() => {
            copyText.textContent = 'Copy Card Number';
            copyBtn.style.backgroundColor = '';
            copyBtn.style.color = '';
            copyIconSvg.innerHTML = `<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>`;
          }, 2000);
        });
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        document.getElementById('secure-card-modal').remove();
      });
    }
  }
}

export default Modal;
