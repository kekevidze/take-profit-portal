/**
 * router.js
 * Basic routing utility to navigate cleanly across the multi-page application.
 */

export const ROUTER = {
  getCurrentPage() {
    const path = window.location.pathname;
    if (path.includes('/agent/')) return 'agent';
    if (path.includes('/deposit/')) return 'deposit';
    if (path.includes('/backoffice/')) return 'backoffice';
    return 'portal';
  },

  /**
   * Generates a fully qualified URL for any page in the application
   */
  getURL(pagePath, queryParams = {}) {
    const origin = window.location.origin;
    let url = `${origin}/${pagePath}`;
    
    // Clean double slashes
    url = url.replace(/([^:]\/)\/+/g, '$1');

    const params = new URLSearchParams();
    Object.keys(queryParams).forEach(key => {
      if (queryParams[key]) params.append(key, queryParams[key]);
    });

    const paramStr = params.toString();
    return paramStr ? `${url}?${paramStr}` : url;
  },

  navigateTo(pagePath, queryParams = {}) {
    const targetUrl = this.getURL(pagePath, queryParams);
    console.log(`Navigating to: ${targetUrl}`);
    window.location.href = targetUrl;
  }
};

export default ROUTER;
