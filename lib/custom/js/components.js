/**
 * Navlakha Technologies — Shared Page Components
 *
 * Usage (at bottom of any product page, BEFORE mobile-nav.js and index.js):
 *
 *   <script src="lib/custom/js/components.js"></script>
 *   <script>NTComponents.init('hrms');</script>
 *
 * Valid page keys: 'hrms' | 'inventory' | 'crm' | 'custom' | 'gatepass' | 'safechat'
 */

var NTComponents = (function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  NAV DATA — single source of truth for all product links            */
  /* ------------------------------------------------------------------ */
  var NAV_PRODUCTS = [
    { key: 'hrms',      href: 'hrms.html',      label: 'HRMS &amp; Payroll' },
    { key: 'inventory', href: 'inventory.html',  label: 'Store &amp; Inventory' },
    { key: 'crm',       href: 'crm.html',        label: 'Sales Tracking &amp; CRM' },
    { key: 'custom',    href: 'custom.html',      label: 'Custom Applications' },
    { key: 'gatepass',  href: 'gatepass.html',   label: 'Visitor Management' },
    { key: 'safechat',  href: 'safechat.html',   label: 'Privacy Chatbox' }
  ];

  /* ------------------------------------------------------------------ */
  /*  HEADER                                                              */
  /* ------------------------------------------------------------------ */
  function buildHeader(activePage) {
    var dropdownItems = NAV_PRODUCTS.map(function (p) {
      var activeClass = p.key === activePage ? ' class="active"' : '';
      return '<li' + activeClass + '><a href="' + p.href + '">' + p.label + '</a></li>';
    }).join('\n              ');

    return [
      '<header id="header" class="header-pages">',
      '  <div class="container">',
      '    <div class="logo float-left">',
      '      <h1 class="text">',
      '        <a href="index.html"><img src="img/NT_new_logo.png" alt="Navlakha Technologies Logo"></a>',
      '        <a href="index.html"><span>Navlakha Technologies</span></a>',
      '      </h1>',
      '    </div>',
      '    <nav class="main-nav float-right d-none d-lg-block">',
      '      <ul>',
      '        <li><a href="index.html">Home</a></li>',
      '        <li class="drop-down active"><a href="index.html#modules">Products</a>',
      '          <ul>',
      '            ' + dropdownItems,
      '          </ul>',
      '        </li>',
      (activePage === 'hrms' ? '        <li><a href="#pricing">Pricing</a></li>' : ''),
      '        <li><a href="index.html#why-us">About Us</a></li>',
      '        <li><a href="https://thenb.nbnext.in/contact-us">Contact Us</a></li>',
      '      </ul>',
      '    </nav>',
      '  </div>',
      '</header>',
      '<button type="button" class="mobile-nav-toggle d-lg-none"><i class="fa fa-bars"></i></button>',
      '<div style="height:80px"></div>'
    ].join('\n');
  }

  /* ------------------------------------------------------------------ */
  /*  WHATSAPP FLOATING BUTTON                                           */
  /* ------------------------------------------------------------------ */
  var WA_MESSAGES = {
    '':          'Hi! I\'d like to know more about Navlakha Technologies and your solutions.',
    'hrms':      'Hi! I\'m interested in your HRMS & Payroll solution. Can we have a quick chat?',
    'inventory': 'Hi! I\'m interested in your Store & Inventory Management solution. Can we have a quick chat?',
    'crm':       'Hi! I\'m interested in your Sales Tracking & CRM solution. Can we have a quick chat?',
    'custom':    'Hi! I\'m looking to build a Custom Application. Can we discuss my requirements?',
    'gatepass':  'Hi! I\'m interested in your Visitor Management solution. Can we have a quick chat?',
    'safechat':  'Hi! I\'m interested in your Privacy Chatbox solution. Can we have a quick chat?'
  };

  /* ------------------------------------------------------------------ */
  /*  FOOTER                                                              */
  /* ------------------------------------------------------------------ */
  function buildFooter(pageKey) {
    var msg = WA_MESSAGES[pageKey] || WA_MESSAGES[''];
    var waUrl = 'https://wa.me/919404065828/?text=' + encodeURIComponent(msg);
    return [
      '<footer id="footer" class="section-bg">',
      '  <div class="footer-top">',
      '    <div class="container">',
      '      <div class="row">',

      '        <div class="col-lg-8 footer-cta-col">',
      '          <div class="row">',
      '            <div class="col-sm-9">',
      '              <div class="form" id="contact-us">',
      '                <h4 class="cta-title" style="color:#fff;">Ready to Transform Your Business?</h4>',
      '                <p class="cta-text">Speak directly with our founders and explore how your operations can be optimised with practical, easy-to-use solutions.</p>',
      '                <p class="cta-text" style="margin-bottom:12px;">Already have something in mind? Let\'s talk.</p>',
      '                <a class="cta-btn align-middle" target="_blank" rel="noopener noreferrer"',
      '                   href="https://wa.me/918275269688/?text=Hi, how I can automate my business!?">',
      '                  <i class="fa fa-whatsapp"></i> Let\'s chat',
      '                </a>',
      '              </div>',
      '            </div>',
      '          </div>',
      '        </div>',

      '        <div class="col-lg-4">',
      '          <div class="footer-links">',
      '            <h4 class="cta-title" style="color:#fff;">Contact Us</h4>',
      '            <p class="cta-text">',
      '              <b>The Navlakha Brothers</b><br>',
      '              <i class="fa fa-map-marker" style="display:inline-block;width:20px;color:#00fd59;"></i> Mumbai &bull; Jalna',
      '            </p>',
      '            <div class="cta-text">',
      '              <strong style="display:inline-block;width:20px;"><i class="fa fa-phone"></i></strong>:',
      '              <a href="tel:+918275269688" class="contact-href">+91 8275269688</a>',
      '            </div>',
      '            <div class="cta-text">',
      '              <strong style="display:inline-block;width:20px;"><i class="fa fa-phone"></i></strong>:',
      '              <a href="tel:+919404065828" class="contact-href">+91 9404065828</a>',
      '            </div>',
      '            <div class="cta-text">',
      '              <strong style="display:inline-block;width:20px;"><i class="fa fa-envelope"></i></strong>:',
      '              <a href="mailto:contact@navlakha.tech" class="contact-href">contact@navlakha.tech</a>',
      '            </div>',
      '          </div>',
      '          <div class="social-links" style="margin-top:14px;">',
      '            <a href="https://www.linkedin.com/company/navlakha-tech" class="linkedin"><i class="fa fa-linkedin"></i></a>',
      '            <a href="https://www.instagram.com/navlakha_tech" class="instagram"><i class="fa fa-instagram"></i></a>',
      '          </div>',
      '        </div>',

      '      </div>',
      '    </div>',
      '  </div>',
      '  <div class="container">',
      '    <div class="copyright cta-text">',
      '      &copy; 2021&ndash;2025 Navlakha Technologies. All rights reserved.',
      '    </div>',
      '  </div>',
      '</footer>',
      '<a href="#" class="back-to-top"><i class="fa fa-chevron-up"></i></a>',
      '<a href="' + waUrl + '" class="nt-wa-btn" target="_blank" rel="noopener noreferrer" aria-label="Chat with us on WhatsApp">',
      '  <i class="fa fa-whatsapp"></i>',
      '  <span class="nt-wa-tooltip">Chat with us</span>',
      '</a>'
    ].join('\n');
  }

  /* ------------------------------------------------------------------ */
  /*  PUBLIC: init                                                        */
  /* ------------------------------------------------------------------ */
  function init(activePage) {
    var page = activePage || '';
    var headerMount = document.getElementById('nt-header');
    var footerMount = document.getElementById('nt-footer');

    if (headerMount) {
      headerMount.innerHTML = buildHeader(page);
      // Initialise mobile nav now that the header is in the DOM
      if (typeof window.NTMobileNavInit === 'function') {
        window.NTMobileNavInit();
      }
    }
    if (footerMount) {
      footerMount.innerHTML = buildFooter(page);
    }
  }

  return { init: init };

}());
