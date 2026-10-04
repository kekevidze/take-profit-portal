/**
 * validator.js
 * Core validation engine for form fields, emails, phones, and credit card security.
 * Incorporates PCI DSS metadata requirements and Luhn checks.
 */

/**
 * Standard Email Regex validation
 */
export function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).trim().toLowerCase());
}

/**
 * Validates phone length (must have at least 7 digits after cleaning)
 */
export function validatePhone(phone) {
  const clean = phone.replace(/[^\d+]/g, '');
  return clean.length >= 7;
}

/**
 * Detects card brand based on BIN ranges
 */
export function detectCardBrand(cardNumber) {
  const clean = cardNumber.replace(/\D/g, '');
  if (/^4/.test(clean)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(clean)) return 'mastercard';
  if (/^3[47]/.test(clean)) return 'amex';
  if (/^(5[06-8]|6304|6390|67)/.test(clean)) return 'maestro';
  return null;
}

/**
 * Standard Luhn Algorithm / Modulo 10 Checksum
 */
export function luhnCheck(cardNumber) {
  const clean = cardNumber.replace(/\D/g, '');
  if (!/^\d{12,19}$/.test(clean)) return false;
  
  let sum = 0;
  let shouldDouble = false;
  
  for (let i = clean.length - 1; i >= 0; i--) {
    let digit = parseInt(clean.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

/**
 * Validates expiration date in MM/YY format, ensuring it is in the future
 */
export function validateExpiry(expiryString) {
  const match = expiryString.match(/^(\d{2})\/(\d{2})$/);
  if (!match) return false;
  
  const mm = parseInt(match[1], 10);
  const yy = parseInt(match[2], 10);
  
  if (mm < 1 || mm > 12) return false;
  
  const now = new Date();
  const currentYear = now.getFullYear() % 100; // last 2 digits
  const currentMonth = now.getMonth() + 1; // 1-indexed
  
  if (yy < currentYear) return false;
  if (yy === currentYear && mm < currentMonth) return false;
  if (yy > currentYear + 15) return false; // Prevent unrealistic future dates
  
  return true;
}

/**
 * Validates CVV length (3 digits for general cards, 4 digits for AMEX)
 */
export function validateCvv(cvv, brand) {
  const clean = cvv.replace(/\D/g, '');
  const requiredLength = brand === 'amex' ? 4 : 3;
  return clean.length === requiredLength;
}
