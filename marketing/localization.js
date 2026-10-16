Promise.resolve(window.marketingSessionReady).then(() => {
  const isUk = window.marketingCountry === 'GB' || navigator.language?.toLowerCase() === 'en-gb';
  window.marketingIsUk = isUk;

  if (!isUk) return;
  document.documentElement.dataset.marketRegion = 'uk';

  const companyUrl = 'https://find-and-update.company-information.service.gov.uk/company/09896045';
  const companyLabel = 'Company number 09896045';
  const companyAriaLabel = 'View company number 09896045 on Companies House';

  const headerRegulatory = document.querySelector('.header-regulatory');
  if (headerRegulatory) {
    headerRegulatory.href = companyUrl;
    headerRegulatory.setAttribute('aria-label', companyAriaLabel);
    const logo = headerRegulatory.querySelector('img');
    const label = headerRegulatory.querySelector('span');
    if (logo) {
      logo.src = '/assets/regulatory/fca.png';
      logo.alt = 'Financial Conduct Authority (FCA)';
    }
    if (label) label.textContent = companyLabel;
  }

  const footerRegulatoryLogo = document.querySelector('.marketing-footer__asic');
  if (footerRegulatoryLogo) {
    footerRegulatoryLogo.href = companyUrl;
    footerRegulatoryLogo.setAttribute('aria-label', companyAriaLabel);
    const logo = footerRegulatoryLogo.querySelector('img');
    if (logo) {
      logo.src = '/assets/regulatory/fca.png';
      logo.alt = 'Financial Conduct Authority (FCA)';
    }
  }

  const footerCompanyLink = document.querySelector('.marketing-footer__abn');
  if (footerCompanyLink) {
    footerCompanyLink.href = companyUrl;
    footerCompanyLink.textContent = companyLabel;
    footerCompanyLink.setAttribute('aria-label', companyAriaLabel);
  }

  const ukBanks = [
    ['barclays.svg', 'Barclays'],
    ['lloyds.svg', 'Lloyds Bank'],
    ['natwest.svg', 'NatWest'],
    ['hsbc-uk.svg', 'HSBC UK'],
    ['santander-uk.svg', 'Santander UK'],
    ['royal-bank-of-scotland.svg', 'Royal Bank of Scotland'],
    ['monzo.svg', 'Monzo'],
    ['starling-bank.svg', 'Starling Bank']
  ];
  const grid = document.getElementById('bankPartnerGrid');
  if (grid) {
    grid.innerHTML = ukBanks.map(([file, name]) => {
      const logoClass = file.startsWith('natwest')
        ? ' uk-bank-logo-natwest'
        : (file.startsWith('royal-bank') ? ' uk-bank-logo-rbs' : '');
      return `<div class="uk-bank-card${logoClass}"><span class="uk-bank-logo-frame"><img src="/assets/europe-bank-logos/United%20Kingdom/${file}" alt="${name}"></span><span>${name}</span></div>`;
    }
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
