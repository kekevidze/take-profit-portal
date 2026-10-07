Promise.resolve(window.marketingSessionReady).then(() => {
  const isUk = window.marketingCountry === 'GB' || navigator.language?.toLowerCase() === 'en-gb';
  window.marketingIsUk = isUk;

  if (!isUk) return;
  document.documentElement.dataset.marketRegion = 'uk';

  const ukBanks = [
    ['barclays.svg', 'Barclays'],
    ['lloyds.svg', 'Lloyds Bank'],
    ['natwest.svg', 'NatWest'],
    ['hsbc-uk.svg', 'HSBC UK'],
    ['santander-uk.svg', 'Santander UK'],
    ['nationwide.svg', 'Nationwide'],
    ['monzo.svg', 'Monzo'],
    ['starling-bank.svg', 'Starling Bank']
  ];
  const grid = document.getElementById('bankPartnerGrid');
  if (grid) {
    grid.innerHTML = ukBanks.map(([file, name]) =>
      `<div><img src="/assets/europe-bank-logos/United%20Kingdom/${file}" alt="${name}"></div>`
    ).join('');
    grid.setAttribute('aria-label', 'UK bank partner logos');
  }

  const editorialImage = document.getElementById('regionalEditorialImage');
  if (editorialImage) {
    editorialImage.src = '/assets/marketing/london-westminster.png';
    editorialImage.alt = 'Palace of Westminster and Big Ben in London';
  }

  const communityText = document.getElementById('communityRegionText');
  if (communityText) communityText.textContent = 'Recent discussion from members across the United Kingdom.';
});
