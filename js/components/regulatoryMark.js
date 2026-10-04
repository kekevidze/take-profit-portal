/**
 * regulatoryMark.js
 * Single regulatory authority logo shown by billing country (deposit page footer).
 */

const EUROPE_ESMA_COUNTRY_CODES = new Set([
  'AD', 'AL', 'AT', 'AX', 'BE', 'BG', 'BA', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FO', 'FR',
  'GG', 'GI', 'GR', 'HR', 'HU', 'IM', 'IS', 'IT', 'JE', 'LI', 'LT', 'LU', 'LV', 'MC', 'MD', 'ME', 'MK',
  'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'RS', 'SE', 'SI', 'SK', 'SM', 'VA', 'XK',
]);

const REGULATORY_MARKS = {
  AU: {
    src: '/assets/regulatory/asic.png',
    alt: 'Australian Securities and Investments Commission (ASIC)',
  },
  GB: {
    src: '/assets/regulatory/fca.png',
    alt: 'Financial Conduct Authority (FCA)',
  },
  IE: {
    src: '/assets/regulatory/central-bank-of-ireland.png',
    alt: 'Central Bank of Ireland',
  },
  ESMA: {
    src: '/assets/regulatory/esma.png',
    alt: 'European Securities and Markets Authority (ESMA)',
  },
};

/**
 * @param {string | null | undefined} countryCode
 * @returns {{ src: string, alt: string } | null}
 */
export function resolveRegulatoryMark(countryCode) {
  if (!countryCode) return null;
  const code = countryCode.trim().toUpperCase();
  if (code === 'AU') return REGULATORY_MARKS.AU;
  if (code === 'GB') return REGULATORY_MARKS.GB;
  if (code === 'IE') return REGULATORY_MARKS.IE;
  if (EUROPE_ESMA_COUNTRY_CODES.has(code)) return REGULATORY_MARKS.ESMA;
  return null;
}

export function updateRegulatoryMark(countryCode) {
  const wrap = document.getElementById('regulatoryMarkWrap');
  const img = document.getElementById('regulatoryMarkImg');
  if (!wrap || !img) return;

  const mark = resolveRegulatoryMark(countryCode);
  if (!mark) {
    wrap.hidden = true;
    img.removeAttribute('src');
    img.alt = '';
    return;
  }

  img.src = mark.src;
  img.alt = mark.alt;
  wrap.hidden = false;
}

export function initRegulatoryMark(countryCode) {
  updateRegulatoryMark(countryCode || null);
}
