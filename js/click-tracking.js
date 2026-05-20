/**
 * Standardised CTA tracking via GTM dataLayer.
 * Schema (locked — used by GA4, Google Ads, Meta, LinkedIn triggers):
 *   { event, cta_type, cta_location, page_path, product_interest }
 *
 *   cta_type:         whatsapp | phone | email | book_demo | explore_products | pricing
 *   cta_location:     hero | header | sticky | product_page | footer | body
 *   product_interest: attendance_payroll | erp | inventory | crm | custom | null
 */
(function () {
  'use strict';

  window.dataLayer = window.dataLayer || [];

  var PRODUCT_BY_HREF = {
    'hrms.html': 'attendance_payroll',
    'contractor-hrms.html': 'attendance_payroll',
    'casual-labour-hrms.html': 'attendance_payroll',
    'erp.html': 'erp',
    'erp-purchase.html': 'erp',
    'erp-sales.html': 'erp',
    'erp-manufacturing.html': 'erp',
    'erp-quality-control.html': 'erp',
    'erp-asset-management.html': 'erp',
    'inventory.html': 'inventory',
    'crm.html': 'crm',
    'custom.html': 'custom'
  };

  var PRODUCT_BY_PATH = (function () {
    var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    return PRODUCT_BY_HREF[page] || null;
  })();

  function basename(href) {
    if (!href) return '';
    var clean = href.split('#')[0].split('?')[0];
    var parts = clean.split('/');
    return (parts[parts.length - 1] || '').toLowerCase();
  }

  function productFor(el, href) {
    var explicit = el && el.getAttribute && el.getAttribute('data-product');
    if (explicit) return explicit;
    var key = basename(href);
    if (PRODUCT_BY_HREF[key]) return PRODUCT_BY_HREF[key];
    return PRODUCT_BY_PATH;
  }

  function locationFor(el) {
    if (!el) return 'body';
    var explicit = el.getAttribute && el.getAttribute('data-cta-location');
    if (explicit) return explicit;
    if (el.closest('#intro, .hero-container, .hero-ctas')) return 'hero';
    if (el.closest('#header, header')) return 'header';
    if (el.closest('#footer, footer')) return 'footer';
    if (el.closest('.nt-sticky-cta, .nt-wa-btn')) return 'sticky';
    if (el.closest('.product-page, .module-details, #pricing')) return 'product_page';
    return 'body';
  }

  function push(payload) {
    payload.page_path = location.pathname;
    window.dataLayer.push(payload);
  }

  function ctaTypeFor(a) {
    var href = (a.getAttribute('href') || '').trim();
    var lower = href.toLowerCase();
    if (lower.indexOf('wa.me') !== -1 || lower.indexOf('whatsapp.com') !== -1) return 'whatsapp';
    if (lower.indexOf('tel:') === 0) return 'phone';
    if (lower.indexOf('mailto:') === 0) return 'email';

    if (a.matches('[data-cta-type]')) return a.getAttribute('data-cta-type');

    var text = (a.textContent || '').trim().toLowerCase();
    if (a.matches('.hero-btn-primary, .book-demo, [data-cta="book_demo"]') ||
        /book\s+(a\s+)?(free\s+)?demo|free\s+demo|schedule.+demo/.test(text)) {
      return 'book_demo';
    }
    if (a.matches('.hero-btn-secondary, [data-cta="explore_products"]') ||
        /explore|learn\s+more|start\s+a\s+project|see\s+(our\s+)?products?/.test(text)) {
      return 'explore_products';
    }
    if (a.matches('[href*="#pricing"], [data-cta="pricing"]') || /pricing/.test(text)) {
      return 'pricing';
    }
    return null;
  }

  function handleClick(e) {
    var a = e.target.closest && e.target.closest('a, button');
    if (!a) return;

    var href = a.getAttribute('href') || '';
    var type = ctaTypeFor(a);
    if (!type) return;

    push({
      event: 'cta_click',
      cta_type: type,
      cta_location: locationFor(a),
      product_interest: productFor(a, href)
    });
  }

  document.addEventListener('click', handleClick, true);

  function firePricingView() {
    var path = (location.pathname + location.hash).toLowerCase();
    var isPricingPage = path.indexOf('#pricing') !== -1 ||
                        path.indexOf('/pricing') !== -1 ||
                        document.getElementById('pricing');
    if (isPricingPage) push({ event: 'view_pricing' });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', firePricingView);
  } else {
    firePricingView();
  }
  window.addEventListener('hashchange', firePricingView);
})();
