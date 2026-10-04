/**
 * countryCatalog.js
 * Searchable world country list with deposit billing defaults merged in.
 */

import allCountriesRaw from './allCountries.json';

/** ISO 3166-1 alpha-2 codes excluded from selectable countries. */
const EXCLUDED_COUNTRY_CODES = new Set([
  'BY', // Belarus
  'CN', // China
  'IL', // Israel
  'IR', // Iran
  'KP', // North Korea
  'PS', // Palestinian Territories
  'RU', // Russia
  'UA', // Ukraine
  'US', // United States
]);

/** Deposit defaults that override generated catalog entries. */
const BILLING_OVERRIDES = {
  NO: {
    phoneCode: '+47',
    currency: 'NOK',
    symbol: 'kr',
    amount: 2400,
    hasCustomBilling: true,
  },
  IM: {
    phoneCode: '+44',
    currency: 'IMP',
    symbol: '£',
    amount: 186,
    hasCustomBilling: true,
  },
};

const allCountries = allCountriesRaw
  .filter((c) => !EXCLUDED_COUNTRY_CODES.has(c.code))
  .map((c) => (BILLING_OVERRIDES[c.code] ? { ...c, ...BILLING_OVERRIDES[c.code] } : c));

const byCode = new Map(allCountries.map((c) => [c.code, c]));

/** @typedef {{ code: string, name: string, flag: string, phoneCode: string, currency: string, symbol: string, amount: number, hasCustomBilling?: boolean }} CountryRecord */

/** Full sorted list (A–Z), minus excluded territories. */
export const ALL_COUNTRIES = allCountries;

/** @param {string} code */
export function findCountryByCode(code) {
  if (!code || typeof code !== 'string') return null;
  return byCode.get(code.trim().toUpperCase()) || null;
}

/**
 * Deposit amount/currency for a billing country. Catalog defaults win when the
 * session has a mismatched currency (e.g. legacy 250 USD with country NO).
 * @param {CountryRecord | null} countryRecord
 * @param {{ country?: string, depositAmount?: number, preferredCurrency?: string } | null | undefined} client
 */
export function resolveBillingForCountry(countryRecord, client) {
  if (!countryRecord) {
    return {
      amount: client?.depositAmount ?? 250,
      currency: client?.preferredCurrency ?? 'USD',
      symbol: '$',
    };
  }

  const sessionMatchesCountry =
    client?.country === countryRecord.code &&
    client?.preferredCurrency === countryRecord.currency &&
    typeof client?.depositAmount === 'number' &&
    client.depositAmount > 0;

  if (sessionMatchesCountry) {
    return {
      amount: client.depositAmount,
      currency: client.preferredCurrency,
      symbol: countryRecord.symbol || '$',
    };
  }

  return {
    amount: countryRecord.amount,
    currency: countryRecord.currency,
    symbol: countryRecord.symbol || '$',
  };
}

/** @param {string} name */
export function findCountryByName(name) {
  const n = (name || '').trim().toLowerCase();
  if (!n) return null;
  return allCountries.find((c) => c.name.toLowerCase() === n) || null;
}

/**
 * @param {string} query
 * @param {number} [limit=80]
 * @returns {CountryRecord[]}
 */
export function searchCountries(query, limit = 80) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return allCountries.slice(0, limit);
  const matches = allCountries.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q)
  );
  return matches.slice(0, limit);
}

export default ALL_COUNTRIES;
