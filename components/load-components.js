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

  function loadScript(src) {
    if (document.querySelector('script[src="' + src + '"]')) return;
    var s = document.createElement('script');
    s.src = src;
    s.defer = true;
    document.head.appendChild(s);
  }

  function init() {
    loadHtml('header-placeholder', COMPONENTS + 'header.html', initHeader);
    loadHtml('footer-placeholder', COMPONENTS + 'footer.html', initFooter);
    loadHtml('module-details-placeholder', 'sections/module-details.html');
    // config.js exposes window.AppConfig (mailer creds + Google client ID)
    // — load it first so chatbot + Google sign-in can use it on every page.
    loadScript('lib/custom/js/config.js');
    loadScript('js/attribution.js');
    loadScript('js/profile.js');
    // Passive context (device, browser, scroll depth, sessions, page views)
    // — depends on NTProfile so loads after it.
    loadScript('js/client-context.js');
    loadScript('js/click-tracking.js');
    loadScript('js/demo-chatbot.js');
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
