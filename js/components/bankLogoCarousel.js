/**
 * bankLogoCarousel.js
 * Infinite bank-logo marquees on the deposit page (by billing region).
 */

const LEGACY_MANIFEST_URL = '/assets/current-bank-logos/manifest.json';
const EUROPE_MANIFEST_URL = '/assets/europe-bank-logos/manifest.json';

/** UK billing countries — UK-only bank logo set. */
const UK_COUNTRY_CODES = new Set(['GB', 'GG', 'IM', 'JE']);

/** Billing countries that show the wider European / Nordic logo set (excludes UK). */
const EUROPE_COUNTRY_CODES = new Set([
  'AD', 'AL', 'AT', 'AX', 'BE', 'BG', 'BA', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FO', 'FR',
  'GI', 'GR', 'HR', 'HU', 'IE', 'IS', 'IT', 'LI', 'LT', 'LU', 'LV', 'MC', 'MD', 'ME', 'MK', 'MT', 'NL',
  'NO', 'PL', 'PT', 'RO', 'RS', 'SE', 'SI', 'SK', 'SM', 'VA', 'XK',
]);

let manifestCache = null;

function resolveCarouselRegion(countryCode) {
  if (!countryCode) return null;
  const code = countryCode.trim().toUpperCase();
  if (code === 'AU') return 'AU';
  if (UK_COUNTRY_CODES.has(code)) return 'UK';
  if (EUROPE_COUNTRY_CODES.has(code)) return 'EUROPE';
  return null;
}

const EXCLUDED_BANK_NAMES = new Set(['Zopa']);

function filterBankList(banks) {
  return banks.filter(
    (b) => !EXCLUDED_BANK_NAMES.has(b.name) && !b.src.toLowerCase().includes('zopa')
  );
}

function titleCaseAlt(name) {
  return name.replace(/\s+/g, ' ').trim();
}

/** Reorder so consecutive items (including loop seam) avoid duplicate names when possible. */
function orderAvoidAdjacentRepeats(items) {
  if (items.length <= 1) return [...items];
  const pool = [...items];
  const ordered = [pool.shift()];
  while (pool.length) {
    let pickedIdx = pool.findIndex((c) => c.name !== ordered[ordered.length - 1].name);
    if (pickedIdx === -1) pickedIdx = 0;
    ordered.push(pool.splice(pickedIdx, 1)[0]);
  }
  if (ordered.length > 1 && ordered[0].name === ordered[ordered.length - 1].name) {
    const swapIdx = ordered.findIndex((c, i) => i > 0 && c.name !== ordered[0].name);
    if (swapIdx > 0) {
      const tmp = ordered[swapIdx];
      ordered[swapIdx] = ordered[ordered.length - 1];
      ordered[ordered.length - 1] = tmp;
    }
  }
  return ordered;
}

function splitBetweenRows(items) {
  const top = [];
  const bottom = [];
  items.forEach((item, index) => {
    if (index % 2 === 0) top.push(item);
    else bottom.push(item);
  });
  if (bottom.length === 0 && top.length > 1) {
    bottom.push(top.pop());
  }
  return {
    top: orderAvoidAdjacentRepeats(top),
    bottom: orderAvoidAdjacentRepeats(bottom),
  };
}

function buildGroup(items, { clone }) {
  const ul = document.createElement('ul');
  ul.className = 'bank-carousel__group' + (clone ? ' bank-carousel__group--clone' : '');
  if (clone) ul.setAttribute('aria-hidden', 'true');

  items.forEach((bank) => {
    const li = document.createElement('li');
    li.className = 'bank-carousel__item';
    const img = document.createElement('img');
    img.src = bank.src;
    img.alt = titleCaseAlt(bank.name);
    img.loading = 'lazy';
    img.decoding = 'async';
    li.appendChild(img);
    ul.appendChild(li);
  });
  return ul;
}

function renderCarousel(rootEl, items, direction) {
  if (!rootEl) return;
  rootEl.innerHTML = '';
  if (!items.length) return;

  const ordered = orderAvoidAdjacentRepeats(items);
  const duration = Math.max(36, Math.min(90, ordered.length * 2.2));

  const carousel = document.createElement('div');
  carousel.className = `bank-carousel bank-carousel--${direction}`;
  carousel.tabIndex = 0;
  carousel.setAttribute('role', 'region');
  carousel.setAttribute('aria-label', 'Bank logos');

  const track = document.createElement('div');
  track.className = 'bank-carousel__track';
  track.style.setProperty('--carousel-duration', `${duration}s`);

  track.appendChild(buildGroup(ordered, { clone: false }));
  track.appendChild(buildGroup(ordered, { clone: true }));

  carousel.appendChild(track);
  rootEl.appendChild(carousel);
}

async function loadManifests() {
  if (manifestCache) return manifestCache;
  const [legacyRes, europeRes] = await Promise.all([
    fetch(LEGACY_MANIFEST_URL),
    fetch(EUROPE_MANIFEST_URL),
  ]);
  const legacy = legacyRes.ok ? await legacyRes.json() : {};
  const europe = europeRes.ok ? await europeRes.json() : {};
  manifestCache = { ...legacy, ...europe };
  return manifestCache;
}

/**
 * Show / refresh carousels for European (incl. Nordic) or Australian billing countries.
 */
export async function updateBankLogoCarousels(countryCode) {
  const region = resolveCarouselRegion(countryCode);
  const topSection = document.getElementById('bankCarouselTop');
  const bottomSection = document.getElementById('bankCarouselBottom');
  const topMount = document.getElementById('bankCarouselTopMount');
  const bottomMount = document.getElementById('bankCarouselBottomMount');

  if (!topSection || !bottomSection || !topMount || !bottomMount) return;

  if (!region) {
    topSection.hidden = true;
    bottomSection.hidden = true;
    return;
  }

  try {
    const manifest = await loadManifests();
    let banks = filterBankList(manifest[region] || []);
    if (region === 'EUROPE') {
      banks = banks.filter((b) => !b.src.includes('/United Kingdom/'));
    }
    if (!banks.length) {
      topSection.hidden = true;
      bottomSection.hidden = true;
      return;
    }

    const { top, bottom } = splitBetweenRows(banks);

    renderCarousel(topMount, top, 'left');
    renderCarousel(bottomMount, bottom, 'right');

    topSection.hidden = false;
    bottomSection.hidden = false;
  } catch (err) {
    console.warn('Bank logo carousels failed to load:', err);
    topSection.hidden = true;
    bottomSection.hidden = true;
  }
}

export async function initBankLogoCarousels(initialCountryCode) {
  await updateBankLogoCarousels(initialCountryCode || null);
}
