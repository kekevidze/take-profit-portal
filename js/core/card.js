/**
 * card.js
 * Controls the 3D payment card preview flipping and live element formatting.
 * Handles crisp SVG branding for Visa, Mastercard, American Express, and Maestro.
 */

import { detectCardBrand } from './validator.js';
import { formatCardNumber, getBrandLogoSvg } from '../utils/formatters.js';
import { CONFIG } from '../utils/constants.js';

export class CardPreviewManager {
  constructor(cardInputId, expiryInputId, cvvInputId, innerId, numDisplayId, expDisplayId, cvvDisplayId, brandFrontId, brandIconId = null) {
    this.cardInput = document.getElementById(cardInputId);
    this.expiryInput = document.getElementById(expiryInputId);
    this.cvvInput = document.getElementById(cvvInputId);
    this.inner = document.getElementById(innerId);
    this.numDisplay = document.getElementById(numDisplayId);
    this.expDisplay = document.getElementById(expDisplayId);
    this.cvvDisplay = document.getElementById(cvvDisplayId);
    this.brandFront = document.getElementById(brandFrontId);
    this.brandIcon = brandIconId ? document.getElementById(brandIconId) : null;

    if (this.cardInput) this.init();
  }

  init() {
    // Flip card to back on CVV focus
    if (this.cvvInput && this.inner) {
      this.cvvInput.addEventListener('focus', () => this.inner.classList.add('flipped'));
      this.cvvInput.addEventListener('blur', () => this.inner.classList.remove('flipped'));
    }

    // Format card input and update mock card
    if (this.cardInput) {
      this.cardInput.addEventListener('input', (e) => this.handleCardNumberInput(e));

      // Force run once on initial page load if value is pre-populated
      if (this.cardInput.value) {
        this.handleCardNumberInput({ target: this.cardInput });
      }
    }

    // Format expiry input and update mock card
    if (this.expiryInput) {
      this.expiryInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '');
        val = val.slice(0, 4);
        if (val.length >= 2) {
          e.target.value = val.slice(0, 2) + '/' + val.slice(2);
        } else {
          e.target.value = val;
        }
        if (this.expDisplay) {
          this.expDisplay.textContent = e.target.value || 'MM/YY';
        }
      });

      if (this.expiryInput.value && this.expDisplay) {
        this.expDisplay.textContent = this.expiryInput.value;
      }
    }

    // Format CVV input and update mock card
    if (this.cvvInput) {
      this.cvvInput.addEventListener('input', (e) => {
        const rawNum = this.cardInput ? this.cardInput.value.replace(/\D/g, '') : '';
        const brand = detectCardBrand(rawNum);
        const maxCvv = brand === 'amex' ? 4 : 3;

        let val = e.target.value.replace(/\D/g, '');
        val = val.slice(0, maxCvv);
        e.target.value = val;

        if (this.cvvDisplay) {
          this.cvvDisplay.textContent = val || '•••';
        }
      });

      if (this.cvvInput.value && this.cvvDisplay) {
        this.cvvDisplay.textContent = this.cvvInput.value;
      }
    }
  }

  handleCardNumberInput(e) {
    let raw = e.target.value.replace(/\D/g, '');
    const brand = detectCardBrand(raw);
    const maxDigits = brand === 'amex' ? 15 : (brand === 'maestro' ? 19 : 16);
    
    raw = raw.slice(0, maxDigits);
    const formatted = formatCardNumber(raw, brand);
    
    e.target.value = formatted;

    // Sync CVV length limit based on detected card brand
    const maxCvv = brand === 'amex' ? 4 : 3;
    if (this.cvvInput) {
      let cvvVal = this.cvvInput.value.replace(/\D/g, '');
      if (cvvVal.length > maxCvv) {
        cvvVal = cvvVal.slice(0, maxCvv);
        this.cvvInput.value = cvvVal;
        if (this.cvvDisplay) {
          this.cvvDisplay.textContent = cvvVal || '•••';
        }
      }
    }
    
    // Update card face classes
    const frontFace = this.inner?.querySelector('.front');
    const backFace = this.inner?.querySelector('.back');
    if (frontFace && backFace) {
      // Clear existing brand classes
      frontFace.className = 'cc-face front';
      backFace.className = 'cc-face back';
      if (brand) {
        frontFace.classList.add(brand);
        backFace.classList.add(brand);
      }
    }

    // Update Brand Logos
    if (this.brandFront) {
      const svg = getBrandLogoSvg(brand);
      if (svg) {
        this.brandFront.innerHTML = svg;
      } else if (brand) {
        this.brandFront.innerHTML = `<span class="badge badge-primary" style="background-color: rgba(255,255,255,0.15); border-color: rgba(255,255,255,0.3); color: #ffffff;">${brand.toUpperCase()}</span>`;
      } else {
        this.brandFront.innerHTML = '&nbsp;';
      }
    }

    // Update Input Brand Icon if elements exist
    if (this.brandIcon) {
      const svg = getBrandLogoSvg(brand);
      if (svg) {
        this.brandIcon.innerHTML = `<div class="brand-logo-img">${svg}</div>`;
      } else if (brand) {
        this.brandIcon.innerHTML = `<span class="badge badge-primary brand-logo-img" style="background-color: rgba(255,255,255,0.15); color: #ffffff; font-size: 0.7rem; padding: 2px 4px; display: inline-block;">${brand.toUpperCase()}</span>`;
      } else {
        this.brandIcon.innerHTML = '';
      }
    }

    // Format mockup number with dots
    const maskTemplate = brand === 'amex' ? '#### ###### #####' : '#### #### #### ####';
    let output = '';
    let rawIndex = 0;
    
    for (let i = 0; i < maskTemplate.length; i++) {
      if (maskTemplate[i] === '#') {
        output += rawIndex < raw.length ? raw[rawIndex] : '•';
        rawIndex++;
      } else {
        output += maskTemplate[i];
      }
    }
    
    if (this.numDisplay) this.numDisplay.textContent = output;
  }
}
export default CardPreviewManager;
