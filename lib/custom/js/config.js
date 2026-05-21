/**
 * Site-wide configuration. Loaded first on every page (via
 * components/load-components.js or directly in book-demo/order/index pages)
 * so every downstream module can read from window.AppConfig.
 *
 * Edit values HERE — not in the JS files that consume them. Each module
 * falls back to a sensible default if a key is missing, so removing a key
 * won't crash anything (it'll just use the baked-in default).
 *
 * Style: keep `false`/`null`/numbers as native JS types — these are read
 * by modules at runtime, not by template engines.
 */
var AppConfig = {

  /* ============== 3rd-party credentials =============== */
  googleClientId:    '758924686012-i3avfd0oo0iqnu81a7ddkt945mt55s4s.apps.googleusercontent.com',
  mailerUrl:         'https://mailer.nbnext.in/api/v1/mail/send',
  mailerSecretKey:   'af276633-02dc-4078-bd96-80d117145961',
  supportEmail:      'support@navlakha.tech',
  // Microsoft Clarity project ID (heatmaps + session recordings). The
  // Clarity loader is inlined in js/consent-and-tags.js — to swap the ID,
  // grep-replace the literal 'wu8165tr26'. This key is documentation only.
  clarityProjectId:  'wu8165tr26',
  // GA4 Measurement ID. Actual configuration lives in GTM container
  // GTM-KBSL779S (Google Tag → Tag ID). No site JS reads this key — it's
  // documentation only. To rotate, update GTM then edit this line.
  ga4MeasurementId:  'G-1XPJ432D61',
  // GTM container ID. Loaded from js/consent-and-tags.js — to rotate,
  // grep-replace 'GTM-KBSL779S' across the codebase.
  gtmContainerId:    'GTM-KBSL779S',

  /* ============== Where outbound emails go =============== */
  // Every email (chatbot stages, activity notifications, order, book-demo)
  // is fanned out to these addresses. Add / remove sales reps here without
  // touching JS.
  recipients: [
    'support@navlakha.tech',
  ],

  /* ============== Phone / WhatsApp =============== */
  // Primary WA used for direct-message buttons, chat success screen, etc.
  whatsappPrimary:   '918275269688',
  // Secondary number — floating WhatsApp button, etc.
  whatsappSecondary: '919404065828',
  // Display strings (for static HTML where we can't run JS to format)
  phoneDisplay:      '+91 8275269688',

  /* ============== Order form =============== */
  // % discount shown on the order page banner + button pill. Marketing dial.
  orderDiscountPct: 10,

  /* ============== Persistence =============== */
  // localStorage TTLs — older records are dropped on next read.
  profileTtlDays:     365,
  attributionTtlDays: 90,

  /* ============== Activity emailer =============== */
  // Triggers + rate limits for the passive activity emailer (fires only
  // once we have a profile = phone OR email).
  activity: {
    deepScrollPct:          80,                   // % scroll on a product page that fires `deep_scroll`
    repeatProductThreshold: 3,                    // visits to same product page that fire `repeat_product`
    cooldownMs:             30 * 60 * 1000,       // min gap between any two activity emails (30 min)
    dailyMax:               3,                    // hard cap per rolling 24h window
    kindCooldownMs:         6  * 60 * 60 * 1000   // min gap between same-kind emails (6 h)
  },

  /* ============== Chatbot flow =============== */
  // To reorder or rename steps, edit this list — every dependent UI label
  // and email subject auto-derives from it.
  chatbot: {
    // Delay before the chat panel auto-expands on page load. Matches the
    // Intercom / Drift convention of a brief grace period so the page can
    // finish settling visually before the panel pops up.
    autoExpandDelayMs: 10 * 1000,  // 10 seconds for pop-up.
    steps: ['phone', 'interests', 'team_size', 'mail', 'name', 'requirements'],
    stepMeta: {
      phone:        { icon: '📞', label: 'phone',        send_mail: true },
      interests:    { icon: '🎯', label: 'interests',    send_mail: true },
      team_size:    { icon: '👥', label: 'team size',    send_mail: true },
      mail:         { icon: '✉️', label: 'email',        send_mail: true },
      name:         { icon: '👤', label: 'name',         send_mail: true },
      requirements: { icon: '📝', label: 'requirements', send_mail: true }
    },
    // Multi-select chips shown at the 'interests' step.
    interests: [
      { key: 'attendance_payroll', label: 'Attendance & Payroll (HRMS)' },
      { key: 'erp',                label: 'ERP Suite' },
      { key: 'inventory',          label: 'Store & Inventory' },
      { key: 'crm',                label: 'Sales Tracking & CRM' },
      { key: 'custom',             label: 'Custom Software' },
      { key: 'visitor_mgmt',       label: 'Visitor Management' },
      { key: 'safechat',           label: 'Privacy Chatbox' }
    ],
    // Quick-reply buttons shown at the 'team_size' step.
    teamSizes: ['1 – 10', '11 – 50', '51 – 200', '201 – 1,000', '1,000+']
  },

  /* ============== Page → product mapping =============== */
  // Used by profile.js (visit tracking), demo-chatbot.js (auto-tag),
  // and cta-tracking.js (event labels). Single source of truth.
  productByPage: {
    'hrms.html':                'attendance_payroll',
    'contractor-hrms.html':     'attendance_payroll',
    'casual-labour-hrms.html':  'attendance_payroll',
    'erp.html':                 'erp',
    'erp-purchase.html':        'erp',
    'erp-sales.html':           'erp',
    'erp-manufacturing.html':   'erp',
    'erp-quality-control.html': 'erp',
    'erp-asset-management.html':'erp',
    'inventory.html':           'inventory',
    'crm.html':                 'crm',
    'custom.html':              'custom',
    'gatepass.html':            'visitor_mgmt',
    'safechat.html':            'safechat'
  },

  /* ============== Signup discount popup =============== */
  // Used by lib/custom/js/signup-popup.js. The "Unlock Up to 25% Discount"
  // modal that shows once per visit unless a profile already exists.
  signupPopup: {
    delayMs:           70 * 1000,        // initial show after page load (1 min after chatbox auto-expands)
    repeatIntervalMs:  4  * 60 * 1000    // gap between subsequent shows for users who keep closing (4 min)
  }
};
