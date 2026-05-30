/**
 * Loads shared header and footer HTML into every page.
 * Requires: <div id="header-placeholder"></div> and <div id="footer-placeholder"></div>
 */
(function () {
  'use strict';

  var COMPONENTS = 'components/';

  function isHomePage() {
    var page = window.location.pathname.split('/').pop();
    return !page || page === 'index.html';
  }

  function loadHtml(placeholderId, url, callback) {
    var el = document.getElementById(placeholderId);
    if (!el) return Promise.resolve();
    return fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('Failed to load ' + url);
        return r.text();
      })
      .then(function (html) {
        el.outerHTML = html;
        if (callback) callback();
      })
      .catch(function (err) {
        console.error('[load-components]', placeholderId, err);
      });
  }

  function configureHomeHeader() {
    if (!isHomePage()) return;

    document.body.classList.add('page-home');

    var header = document.getElementById('header');
    if (header) header.classList.remove('header-pages');

    var spacer = document.getElementById('header-spacer');
    if (spacer) spacer.classList.add('header-spacer--home');

    document.querySelectorAll('#header .main-nav a[href^="index.html#"]').forEach(function (link) {
      link.setAttribute('href', link.getAttribute('href').replace('index.html', ''));
      link.classList.add('scrollto');
    });

    var homeLink = document.querySelector('#header .main-nav > ul > li > a[href="index.html"]');
    if (homeLink) {
      homeLink.setAttribute('href', '#intro');
      homeLink.classList.add('scrollto');
    }

    document.querySelectorAll('#header .logo a[href="index.html"]').forEach(function (link) {
      link.setAttribute('href', '#intro');
      link.classList.add('scrollto');
    });
  }

  function setActiveNav() {
    var page = window.location.pathname.split('/').pop() || 'index.html';
    var links = document.querySelectorAll('#header .main-nav > ul > li > a');
    links.forEach(function (link) {
      var href = (link.getAttribute('href') || '').split('#')[0];
      if (href === page || (isHomePage() && (!href || href === 'index.html' || href === '#intro'))) {
        link.parentElement.classList.add('active');
      }
    });

    document.querySelectorAll('#header .main-nav a').forEach(function (link) {
      var href = (link.getAttribute('href') || '').split('#')[0];
      if (href === page) {
        var li = link.parentElement;
        while (li && li.id !== 'header') {
          if (li.tagName === 'LI') li.classList.add('active');
          li = li.parentElement;
        }
      }
    });
  }

  function initHeader() {
    configureHomeHeader();
    setActiveNav();
    if (typeof window.NTMobileNavInit === 'function') {
      window.NTMobileNavInit();
    }
  }

  function initFooter() {
    if (typeof jQuery !== 'undefined') {
      jQuery(window).trigger('scroll');
    }
  }

  // The testimonials partial is injected async, so its Owl carousel must be
  // initialised here (after the markup lands) rather than on DOMReady.
  function initTestimonialsCarousel() {
    if (typeof jQuery === 'undefined' || !jQuery.fn.owlCarousel) return;
    var $c = jQuery('.testimonials-carousel');
    if (!$c.length || $c.hasClass('owl-loaded')) return;
    // Continuous, never-stopping glide: a linear transition whose speed
    // equals the timeout removes the pause between slides, so the strip
    // scrolls smoothly on its own. Pauses on hover so people can read.
    $c.owlCarousel({
      autoplay: true,
      autoplayTimeout: 5000,
      autoplaySpeed: 5000,
      smartSpeed: 5000,
      slideTransition: 'linear',
      autoplayHoverPause: true,
      dots: false,
      nav: false,
      loop: true,
      margin: 24,
      responsive: {
        0:    { items: 1 },
        640:  { items: 2 },
        1000: { items: 3 }
      }
    });
  }

  // NTForms (chatbox/src/forms.js) takes all of its dependencies as adapters
  // — pass the site's primitives in once they've loaded. Polls because all
  // of these load via defer and may not be on window yet. Idempotent: only
  // calls NTForms.configure() once.
  var _ntFormsConfigured = false;
  function configureNTFormsWhenReady(retries) {
    if (_ntFormsConfigured) return;
    if (typeof retries !== 'number') retries = 40;
    if (window.NTForms && window.NTForms.configure &&
        window.NTValidators && window.NTDialPicker && window.NTIPLocation &&
        window.AppConfig) {
      window.NTForms.configure({
        validators:   window.NTValidators,
        dialPicker:   window.NTDialPicker,
        ipLocation:   window.NTIPLocation,
        googleSignIn: window.AppConfig.googleClientId
                        ? { clientId: window.AppConfig.googleClientId }
                        : null,
        profile:      window.NTVisitorProfile || null
      });
      _ntFormsConfigured = true;
      return;
    }
    if (retries <= 0) return;
    setTimeout(function () { configureNTFormsWhenReady(retries - 1); }, 80);
  }

  function loadScript(src) {
    if (document.querySelector('script[src="' + src + '"]')) return;
    var s = document.createElement('script');
    s.src = src;
    s.defer = true;
    // Dynamically-inserted scripts default to async — force in-order
    // execution so things like chatbox-integration.js can rely on the
    // library script that came before it.
    s.async = false;
    document.head.appendChild(s);
  }

  function init() {
    loadHtml('header-placeholder', COMPONENTS + 'header.html', initHeader);
    loadHtml('footer-placeholder', COMPONENTS + 'footer.html', initFooter);
    loadHtml('module-details-placeholder', 'sections/module-details.html');
    loadHtml('modules-placeholder', 'sections/product-modules.html');
    loadHtml('testimonials-placeholder', 'sections/testimonials.html', initTestimonialsCarousel);
    loadHtml('privacy-cta-placeholder', COMPONENTS + 'privacy-cta.html');
    loadHtml('why-choose-placeholder', 'sections/why-choose.html');
    loadHtml('journey-placeholder', 'sections/journey.html');
    // config.js exposes window.AppConfig (mailer creds + Google client ID)
    // — load it first so chatbot + Google sign-in can use it on every page.
    loadScript('lib/custom/js/config.js');
    loadScript('js/attribution.js');
    loadScript('js/visitor-profile.js');
    // Passive context (device, browser, scroll depth, sessions, page views)
    // — depends on NTVisitorProfile so loads after it.
    loadScript('js/client-context.js');
    // Shared form validators (phone, email). Single source of truth used by
    // chatbot, book-demo, and order forms — load before anything that runs
    // a submit validation.
    loadScript('js/validators.js');
    loadScript('js/cta-tracking.js');
    // No-op on pages without [data-track-form]; safe to load globally.
    loadScript('js/form-tracking.js');
    // Chatbox widget + sibling adapters — served from jsDelivr (source at
    // https://github.com/thenb-in/chatbox). Pin to an exact tag in prod so
    // a bad commit can't break every site at once; bump deliberately on
    // release. To force-refresh after a tag move:
    //   purge.jsdelivr.net/gh/thenb-in/chatbox@TAG/...
    //
    // Sibling modules loaded from the same release:
    //   - ip-location.js — public IP + coarse geo; writes into
    //     NTVisitorProfile.ip_location for the email body rows. Also
    //     supplies the country list for dial-picker.
    //   - dial-picker.js — compact searchable country-code popover used by
    //     the chatbot phone step and the book-demo form. Depends on
    //     NTIPLocation, so loads after it.
    //   - chatbox.js     — exposes window.Chatbox (chat widget).
    //   - forms.js       — exposes window.NTForms (regular-form wiring).
    // chatbox-integration.js wires the site's adapters;
    // configureNTFormsWhenReady() wires the same adapters into NTForms once
    // it lands on window.
    var chatboxRel = 'main';
    var chatboxBase = 'https://cdn.jsdelivr.net/gh/thenb-in/chatbox@' + chatboxRel + '/src/';
    var cbStyle = document.createElement('link');
    cbStyle.rel  = 'stylesheet';
    cbStyle.href = chatboxBase + 'chatbox.css';
    document.head.appendChild(cbStyle);
    loadScript(chatboxBase + 'ip-location.js');
    loadScript(chatboxBase + 'dial-picker.js');
    loadScript(chatboxBase + 'chatbox.js');
    loadScript(chatboxBase + 'forms.js');
    configureNTFormsWhenReady();
    loadScript('js/chatbox-integration.js');
    // Sends mails when a known profile (phone OR email) keeps interacting
    // with the site outside the chatbot — session returns, pricing views,
    // deep scrolls, repeat product visits. Rate-limited inside.
    loadScript('js/activity-emailer.js');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
