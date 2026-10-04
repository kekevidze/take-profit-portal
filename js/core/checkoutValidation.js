/**
 * Shared deposit checkout validation rules (deposit page + payment API).
 */

export const CHECKOUT_OPTIONAL_BILLING_FIELDS = ['firstName', 'lastName', 'phone', 'city'];
export const CHECKOUT_REQUIRED_BILLING_FIELDS = ['email', 'country'];

export function isOptionalBillingField(name) {
  return CHECKOUT_OPTIONAL_BILLING_FIELDS.includes(name);
}

/**
 * @param {string} value
 * @param {number} [minLength=1]
 */
export function validateOptionalText(value, minLength = 1) {
  const v = (value ?? '').toString().trim();
  if (!v) return true;
  return v.length >= minLength;
}

/**
 * @param {Record<string, string>} billing
 * @param {{ validateEmail: (e: string) => boolean, validatePhone?: (p: string) => boolean, findCountryByCode?: (c: string) => unknown }} deps
 */
export function validateBillingForPayment(billing, deps) {
  if (!billing || typeof billing !== 'object') {
    return { valid: false, message: 'Incomplete billing information. Please verify required fields.' };
  }

  const email = (billing.email || '').trim();
  if (!email || !deps.validateEmail(email)) {
    return { valid: false, message: 'A valid email address is required.' };
  }

  const country = (billing.country || '').trim();
  if (!country) {
    return { valid: false, message: 'Billing country is required.' };
  }
  if (deps.findCountryByCode && !deps.findCountryByCode(country)) {
    return { valid: false, message: 'Billing country is not supported.' };
  }

  if (!validateOptionalText(billing.firstName)) {
    return { valid: false, message: 'First name is invalid.' };
  }
  if (!validateOptionalText(billing.lastName)) {
    return { valid: false, message: 'Last name is invalid.' };
  }
  if (!validateOptionalText(billing.city)) {
    return { valid: false, message: 'City is invalid.' };
  }

  const phone = (billing.phone || '').trim();
  if (phone && deps.validatePhone && !deps.validatePhone(phone)) {
    return { valid: false, message: 'Enter a valid phone number or leave it blank.' };
  }

  return { valid: true, message: '' };
}

/** @param {{ firstName?: string, lastName?: string, email?: string }} billing */
export function formatClientDisplayName(billing) {
  const name = `${billing.firstName || ''} ${billing.lastName || ''}`.trim();
  if (name) return name;
  const email = (billing.email || '').trim();
  if (email) return email;
  return 'Customer';
}
