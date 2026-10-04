/**
 * formatters.js
 * Specialized formatting functions for currencies, card digits, dates, and phone numbers.
 */

/**
 * Format currency gracefully based on country specs
 * e.g., $ 250 AUD or € 220 EUR
 */
export function formatCurrency(amount, currencyCode, symbol) {
  if (amount === undefined || amount === null) return '—';
  const formatted = Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  return `${symbol}${formatted} ${currencyCode}`;
}

/**
 * Formats a card number string by adding spaces based on the detected brand
 * e.g., AMEX: 4-6-5 format, others: 4-4-4-4 format
 */
export function formatCardNumber(rawDigits, brand) {
  const clean = rawDigits.replace(/\D/g, '');
  if (brand === 'amex') {
    // AMEX format is 4-6-5
    const match = clean.match(/^(\d{1,4})(\d{0,6})(\d{0,5})$/);
    if (match) {
      return [match[1], match[2], match[3]].filter(Boolean).join(' ');
    }
  } else {
    // General format is 4-4-4-4
    const match = clean.match(/.{1,4}/g);
    if (match) {
      return match.join(' ');
    }
  }
  return clean;
}

/**
 * Format phone digits to keep them clean
 */
export function formatPhoneNumber(rawDigits) {
  return rawDigits.replace(/[^\d+]/g, '');
}

/**
 * Formats a date into a clean locale-string
 */
export function formatDateTime(timestamp) {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }) + ' - ' + new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Returns a crisp, premium SVG logo markup for recognized payment card brands.
 * Designed with perfect vector viewBox and clean inline styling.
 */
export function getBrandLogoSvg(brand) {
  const b = (brand || '').toLowerCase();
  
  if (b === 'visa') {
    // Elegant, premium official Visa wordmark, properly proportioned
    return `
      <svg class="visa-svg" viewBox="0 0 24 15" fill="none" style="height: 100%; width: auto; max-height: 20px; display: block; color: #ffffff;" aria-label="Visa">
        <path d="M10.1 1.2h2.2l-1.4 8.2h-2.2z" fill="currentColor" />
        <path d="M17.3 1.2c-.4 0-.8.2-.9.6l-3.2 7.6h2.3l.5-1.3h2.8l.3 1.3h2l-1.7-8.2h-2.1zm-.7 5.1l.9-2.5.5 2.5h-1.4z" fill="currentColor" />
        <path d="M5.3 1.2L3.1 6.8l-.2-1.2C2.5 3.1 1.3 1.5 1.3 1.5L3.4 9.4h2.3l3.4-8.2z" fill="currentColor" />
        <path d="M8.8 3.8c0-1.4-1.9-1.5-1.9-2.1 0-.2.2-.4.6-.4.5 0 1.2.2 1.6.4l.4-1.7C9 0 8.2-.1 7.3-.1c-2.3 0-3.9 1.2-3.9 3 0 1.3 1.2 2 2.1 2.5.9.4 1.2.7 1.2 1.1 0 .6-.7.9-1.4.9-.9 0-1.6-.2-2-.4l-.4 1.7c.5.2 1.5.4 2.5.4 2.4 0 4-1.2 4-3.1z" fill="currentColor" />
      </svg>
    `;
  }
  
  if (b === 'mastercard') {
    // Perfectly aligned interlocking circles with orange center overlap
    return `
      <svg class="mastercard-svg" viewBox="0 0 24 18" style="height: 100%; width: auto; max-height: 22px; display: block;" aria-label="Mastercard">
        <circle cx="7.5" cy="9" r="6" fill="#EB001B" />
        <circle cx="16.5" cy="9" r="6" fill="#F79E1B" fill-opacity="0.9" />
        <path d="M12 4.3a5.9 5.9 0 0 0-2.3 4.7 5.9 5.9 0 0 0 2.3 4.7 5.9 5.9 0 0 0 2.3-4.7 5.9 5.9 0 0 0-2.3-4.7z" fill="#FF5F00" />
      </svg>
    `;
  }
  
  if (b === 'amex') {
    // Official blue box representation with white AMEX lettering
    return `
      <svg class="amex-svg" viewBox="0 0 24 24" style="height: 100%; width: auto; max-height: 22px; display: block; border-radius: 3px;" aria-label="American Express">
        <rect width="24" height="24" rx="3" fill="#0070CD" />
        <path d="M3.2 8h2.3l.4 1.1h1.6L7.9 8h2.3v7.8H8.2v-2.5H5.7v2.5H3.2V8zm3.4 3.5l-.5-1.5-.5 1.5H6.6zm4.3-3.5h2.5l1.1 2 1.1-2h2.5v7.8h-2.1v-3.8l-1.5 2.6H13l-1.5-2.6v3.8h-2.1V8zm7.9 0h3.8v1.7H20.5v1.3H22.4v1.7H20.5v1.5H22.6v1.7H18.8V8z" fill="#FFFFFF"/>
      </svg>
    `;
  }
  
  if (b === 'maestro') {
    // Interlocking red and blue circles with violet center overlap
    return `
      <svg class="maestro-svg" viewBox="0 0 24 18" style="height: 100%; width: auto; max-height: 22px; display: block;" aria-label="Maestro">
        <circle cx="7.5" cy="9" r="6" fill="#EB001B" />
        <circle cx="16.5" cy="9" r="6" fill="#00A2E5" fill-opacity="0.9" />
        <path d="M12 4.3a5.9 5.9 0 0 0-2.3 4.7 5.9 5.9 0 0 0 2.3 4.7 5.9 5.9 0 0 0 2.3-4.7 5.9 5.9 0 0 0-2.3-4.7z" fill="#7C1A7D" />
      </svg>
    `;
  }
  
  return '';
}
