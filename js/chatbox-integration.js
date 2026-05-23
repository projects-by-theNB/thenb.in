/**
 * Navlakha Technologies — chatbox integration shim.
 *
 * The chatbox widget itself is the generic library at
 * github.com/thenb-in/chatbox (served via jsDelivr CDN, loaded by
 * components/load-components.js). It has no NT-specific code.
 *
 * This file wires our adapters (NTVisitorProfile, NTAttribution,
 * NTIPLocation, NTDialPicker, NTValidators) and the rich, NT-specific
 * outbound email layout into a single Chatbox.init() call.
 *
 * Edit the email subject/body builders here — the library never sees
 * them, it just calls `mailer.subject(payload)` / `mailer.body(payload)`.
 */
(function () {
  'use strict';

  if (!window.Chatbox || !window.AppConfig) return;

  var CFG = window.AppConfig;
  var CHAT = CFG.chatbot || {};
  var INTERESTS = CHAT.interests || [];

  function labelForInterest(key) {
    var item = INTERESTS.filter(function (x) { return x.key === key; })[0];
    return item ? item.label : key;
  }

  /* ---- Email subject (1 line) ---------------------------------------- */
  function subjectBuilder(payload) {
    var d = payload.data;
    var s = payload.stage;
    var attr = payload.attribution;
    var who = d.name || d.phone || 'partial';
    var src = attr && attr.utm_source ? ' [' + attr.utm_source + ']' : '';
    var icon  = s.isFinal ? '✅' : (s.meta.icon  || '📝');
    var label = s.isFinal ? 'COMPLETE' : (s.meta.label || s.stageName);

    var qualifier;
    if (s.mailNum === 1) qualifier = ' (Profile created)';
    else if (s.isFinal)  qualifier = '';
    else                 qualifier = ' (UPDATE)';

    var flags = '';
    if (s.stageName === 'interests' && s.newInterests && s.newInterests.length > 0) {
      flags += ' 🆕 NEW: ' + s.newInterests.map(labelForInterest).join(', ');
    } else if (s.isReturning && !s.isFinal) {
      flags += ' 🔁 returning';
    }

    var contactSuffix = '';
    if (s.mailNum === 5) {
      var bits = [];
      if (d.phone) bits.push(d.phone);
      if (d.email) bits.push(d.email);
      if (bits.length) contactSuffix = ' (' + bits.join(' / ') + ')';
    }

    return 'Mail #' + s.mailNum + ' — ' + icon + ' ' + label + qualifier + flags + ': ' + who + contactSuffix + src;
  }

  /* ---- Email body — 6-section HTML, scannable top-down --------------- */
  function bodyBuilder(payload) {
    var d = payload.data;
    var s = payload.stage;
    var attr = payload.attribution;
    var profile = payload.profile;
    var newInterests = s.newInterests || [];

    function esc(x) { return String(x == null ? '' : x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

    var newSet = newInterests.reduce(function (m, k) { m[k] = true; return m; }, {});

    var interestPieces = (d.interests || []).map(function (k) {
      var lbl = esc(labelForInterest(k));
      return newSet[k]
        ? lbl + ' <span style="display:inline-block;font-size:10px;font-weight:700;background:#16a34a;color:#fff;padding:2px 6px;border-radius:4px;margin-left:6px;vertical-align:middle;">NEW</span>'
        : lbl;
    });
    var interestCell = interestPieces.length ? interestPieces.join(', ') : null;

    var emailCell = null;
    if (d.email) {
      var verifiedPill = d.email_verified
        ? ' <span style="display:inline-block;font-size:10px;font-weight:700;background:#16a34a;color:#fff;padding:2px 6px;border-radius:4px;margin-left:6px;vertical-align:middle;">✓ VERIFIED</span>'
        : ' <span style="display:inline-block;font-size:10px;font-weight:700;background:#94a3b8;color:#fff;padding:2px 6px;border-radius:4px;margin-left:6px;vertical-align:middle;">unverified</span>';
      emailCell = esc(d.email) + verifiedPill;
    }

    var productsViewedCell = null;
    if (profile && Array.isArray(profile.visited_products) && profile.visited_products.length > 0) {
      var pickedSet = (d.interests || []).reduce(function (m, k) { m[k] = true; return m; }, {});
      var ownsInterests = !!profile.interests_owned_by_user;
      var productPieces = profile.visited_products.map(function (k) {
        var lbl = esc(labelForInterest(k));
        if (ownsInterests && !pickedSet[k]) {
          return '<span style="color:#94a3b8;text-decoration:line-through;" title="Viewed but not selected">' + lbl + '</span>';
        }
        return lbl;
      });
      productsViewedCell = productPieces.join(', ');
    }

    /* Country / dial code */
    var ipl = (profile && profile.ip_location) || null;
    var liveDial = (window.NTIPLocation && window.NTIPLocation.getDialCode)
      ? window.NTIPLocation.getDialCode() : null;
    var dial = d.dial_code || liveDial;
    var countryCell = null;
    if (dial || (ipl && ipl.country_code)) {
      var parts = [];
      if (dial) parts.push(esc(dial));
      if (ipl && ipl.country) {
        var iso = ipl.country_code ? ' · ' + esc(ipl.country_code) : '';
        parts.push(esc(ipl.country) + iso);
      } else if (ipl && ipl.country_code) {
        parts.push(esc(ipl.country_code));
      }
      countryCell = parts.join(' — ');
    }

    /* SECTION 1 — LEAD */
    var leadSection = {
      title: 'Lead',
      alwaysShow: true,
      rows: [
        ['Name',  d.name  || '—'],
        ['Phone', d.phone || '—'],
        { label: 'Country', html: countryCell || '—' },
        { label: 'Email',   html: emailCell   || '—' }
      ]
    };
    if (d.company) leadSection.rows.push(['Company', d.company]);

    /* SECTION 2 — INTEREST SIGNAL */
    var interestRows = [
      { label: 'Interests', html: interestCell || '—' },
      ['Team size',    d.team_size],
      ['Industry',     d.industry],
      ['Requirements', d.requirements]
    ];
    if (productsViewedCell) interestRows.push({ label: 'Products viewed', html: productsViewedCell });
    if (profile && Array.isArray(profile.emailed_interests) && profile.emailed_interests.length > 0) {
      interestRows.push(['Previously emailed',
        profile.emailed_interests.map(labelForInterest).join(', ')]);
    }
    var interestSection = { title: 'Interest signal', rows: interestRows };

    /* SECTION 3 — ENGAGEMENT */
    var engagementRows = [];
    if (profile) {
      var actBits = [];
      if (profile.session_count)    actBits.push(profile.session_count + ' session'   + (profile.session_count === 1 ? '' : 's'));
      if (profile.total_page_views) actBits.push(profile.total_page_views + ' page view' + (profile.total_page_views === 1 ? '' : 's'));
      if (profile.chat_open_count)  actBits.push(profile.chat_open_count + ' chat open' + (profile.chat_open_count === 1 ? '' : 's'));
      if (actBits.length) engagementRows.push(['Activity', actBits.join(' · ')]);

      if (profile.max_scroll_depth) engagementRows.push(['Max scroll', profile.max_scroll_depth + '%']);

      if (profile.total_time_on_site_ms) {
        var sec = Math.round(profile.total_time_on_site_ms / 1000);
        var pretty = sec >= 60 ? Math.floor(sec / 60) + 'm ' + (sec % 60) + 's' : sec + 's';
        engagementRows.push(['Time on site', pretty]);
      }

      if (profile.page_views_by_path && typeof profile.page_views_by_path === 'object') {
        var top = Object.keys(profile.page_views_by_path)
          .map(function (k) { return { path: k, n: profile.page_views_by_path[k] }; })
          .sort(function (a, b) { return b.n - a.n; })
          .slice(0, 3);
        if (top.length) {
          engagementRows.push(['Top pages', top.map(function (t) { return t.path + ' (' + t.n + ')'; }).join(' · ')]);
        }
      }
    }
    var engagementSection = { title: 'Engagement', rows: engagementRows };

    /* SECTION 4 — SOURCE */
    var sourceRows = [];
    if (attr) {
      var refType   = attr.landing_referrer_type;
      var refDomain = attr.landing_referrer_domain;
      var refPlat   = attr.landing_referrer_platform;
      var refQuery  = attr.landing_referrer_search_query;
      if (refType === 'direct') {
        sourceRows.push(['Referred from', 'direct (no referrer)']);
      } else if (refType) {
        var p2 = [];
        if (refPlat)        p2.push(refPlat);
        else if (refDomain) p2.push(refDomain);
        p2.push('(' + refType + ')');
        if (refQuery)       p2.push('— "' + refQuery + '"');
        sourceRows.push(['Referred from', p2.join(' ')]);
      } else if (attr.landing_referrer) {
        sourceRows.push(['Referred from', attr.landing_referrer]);
      }

      if (attr.utm_source)   sourceRows.push(['utm_source',   attr.utm_source]);
      if (attr.utm_medium)   sourceRows.push(['utm_medium',   attr.utm_medium]);
      if (attr.utm_campaign) sourceRows.push(['utm_campaign', attr.utm_campaign]);
      if (attr.utm_term)     sourceRows.push(['utm_term',     attr.utm_term]);
      if (attr.utm_content)  sourceRows.push(['utm_content',  attr.utm_content]);
      if (attr.gclid)        sourceRows.push(['gclid',        attr.gclid]);
      if (attr.fbclid)       sourceRows.push(['fbclid',       attr.fbclid]);
      if (attr.msclkid)      sourceRows.push(['msclkid',      attr.msclkid]);
      if (attr.landing_page) sourceRows.push(['Landing page', attr.landing_page]);
    }
    var sourceSection = { title: 'Source', rows: sourceRows };

    /* SECTION 5 — TECH */
    var techRows = [];
    if (profile && profile.client_context) {
      var cc = profile.client_context;

      var deviceBits = [];
      if (cc.browser)     deviceBits.push(cc.browser + (cc.browser_version ? ' ' + cc.browser_version.split('.')[0] : ''));
      if (cc.os)          deviceBits.push('on ' + cc.os + (cc.os_version ? ' ' + cc.os_version : ''));
      if (cc.device_type) deviceBits.push('· ' + cc.device_type);
      if (deviceBits.length) techRows.push(['Device', deviceBits.join(' ')]);

      if (cc.viewport && (cc.viewport.width || cc.viewport.height)) {
        var vp = cc.viewport.width + '×' + cc.viewport.height;
        if (cc.viewport.dpr && cc.viewport.dpr !== 1) vp += ' @' + cc.viewport.dpr + 'x';
        techRows.push(['Viewport', vp]);
      }
      if (cc.screen && cc.screen.width) {
        techRows.push(['Screen', cc.screen.width + '×' + cc.screen.height +
          (cc.screen.color_depth ? ' · ' + cc.screen.color_depth + '-bit' : '')]);
      }
      if (cc.language) techRows.push(['Language', cc.language]);
      if (cc.timezone) {
        techRows.push(['Timezone', cc.timezone +
          (cc.last_seen_hour != null ? ' · ' + cc.last_seen_hour + ':00 local' : '') +
          (cc.last_seen_dow ? ' · ' + cc.last_seen_dow : '')]);
      }

      if (cc.connection) {
        var net = [];
        if (cc.connection.effective_type)      net.push(cc.connection.effective_type);
        if (cc.connection.downlink_mbps != null) net.push(cc.connection.downlink_mbps + ' Mbps');
        if (cc.connection.rtt_ms != null)      net.push(cc.connection.rtt_ms + 'ms RTT');
        if (cc.connection.save_data)           net.push('data-saver ON');
        if (net.length) techRows.push(['Connection', net.join(' · ')]);
      }
      if (cc.hardware) {
        var hw = [];
        if (cc.hardware.cores)        hw.push(cc.hardware.cores + ' cores');
        if (cc.hardware.memory_gb)    hw.push(cc.hardware.memory_gb + ' GB RAM');
        if (cc.hardware.touch_points) hw.push(cc.hardware.touch_points + ' touch');
        if (hw.length) techRows.push(['Hardware', hw.join(' · ')]);
      }
      if (cc.privacy && (cc.privacy.do_not_track || cc.privacy.global_privacy_control || !cc.privacy.cookies_enabled)) {
        var flags = [];
        if (cc.privacy.do_not_track)           flags.push('DNT');
        if (cc.privacy.global_privacy_control) flags.push('GPC');
        if (!cc.privacy.cookies_enabled)       flags.push('cookies off');
        techRows.push(['Privacy flags', flags.join(' · ')]);
      }
    }
    if (profile && profile.ip_location && profile.ip_location.ip) {
      var iplB = profile.ip_location;
      var ipBits = [iplB.ip];
      if (iplB.ip_type) ipBits.push(iplB.ip_type);
      if (iplB.isp)     ipBits.push(iplB.isp + (iplB.asn ? ' (AS' + iplB.asn + ')' : ''));
      techRows.push(['Public IP', ipBits.join(' · ')]);

      var locBits = [];
      if (iplB.city)    locBits.push(iplB.city);
      if (iplB.region)  locBits.push(iplB.region);
      if (iplB.country) locBits.push(iplB.country + (iplB.country_code ? ' (' + iplB.country_code + ')' : ''));
      if (locBits.length) techRows.push(['Location (IP)', locBits.join(', ')]);

      if (iplB.latitude != null && iplB.longitude != null) {
        var coords = iplB.latitude + ',' + iplB.longitude;
        techRows.push({
          label: 'Map',
          html: '<a href="https://www.google.com/maps?q=' + coords + '" style="color:#2563eb;">' + coords + '</a>'
        });
      }
    }
    var techSection = { title: 'Tech context', rows: techRows };

    /* SECTION 6 — META */
    var metaRows = [];
    metaRows.push(['Mail #',          s.mailNum + ' (lifetime count for this lead)']);
    metaRows.push(['Submission via',  d.source === 'book_demo' ? 'book-demo form' : 'chatbot']);
    metaRows.push(['Stage reached',   s.stageNum + ' of ' + (CHAT.steps ? CHAT.steps.length : 0) + ' — ' + s.stageName]);
    if (profile && profile.first_seen) {
      var days = Math.max(0, Math.round((Date.now() - profile.first_seen) / 86400000));
      metaRows.push(['First seen',    new Date(profile.first_seen).toISOString().slice(0, 10) +
        ' (' + days + ' day' + (days === 1 ? '' : 's') + ' ago)']);
    }
    if (profile && profile.last_session_at) {
      metaRows.push(['Last session', new Date(profile.last_session_at).toISOString().replace('T', ' ').slice(0, 16) + ' UTC']);
    }
    if (profile && Array.isArray(profile.visited_pages) && profile.visited_pages.length > 0) {
      metaRows.push(['All pages visited', profile.visited_pages.join(' · ')]);
    }
    metaRows.push(['Chat-launch page', location.href]);
    var metaSection = { title: 'Meta', rows: metaRows };

    function renderRow(r) {
      var label, value;
      if (Array.isArray(r)) {
        label = esc(r[0]);
        value = (r[1] == null || r[1] === '') ? null : esc(r[1]);
      } else {
        label = esc(r.label);
        value = (r.html == null || r.html === '') ? null : r.html;
      }
      return { label: label, value: value };
    }

    function renderSection(section) {
      var rendered = section.rows.map(renderRow);
      if (!section.alwaysShow) {
        rendered = rendered.filter(function (r) { return r.value != null; });
      }
      if (rendered.length === 0) return '';

      var trs = rendered.map(function (r, idx) {
        var border = idx === rendered.length - 1 ? '' : 'border-bottom:1px solid #f1f5f9;';
        return '<tr>' +
          '<td style="padding:7px 14px;color:#64748b;width:38%;vertical-align:top;font-size:13px;' + border + '">' + r.label + '</td>' +
          '<td style="padding:7px 14px;color:#0f172a;vertical-align:top;font-size:13px;' + border + '">' + (r.value == null ? '—' : r.value) + '</td>' +
        '</tr>';
      }).join('');

      return [
        '<tr><td style="padding:22px 28px 6px;">',
          '<div style="border-left:4px solid #2f5597;padding-left:10px;color:#0f172a;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;font-weight:700;">',
            esc(section.title),
          '</div>',
        '</td></tr>',
        '<tr><td style="padding:0 28px 4px;">',
          '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#fafbfc;border:1px solid #e5e7eb;border-radius:6px;">',
            trs,
          '</table>',
        '</td></tr>'
      ].join('');
    }

    var sections = [leadSection, interestSection, engagementSection, sourceSection, techSection, metaSection];
    var sectionsHtml = sections.map(renderSection).join('');

    /* Banner */
    var banner = '';
    if (s.stageName === 'interests' && newInterests.length > 0) {
      banner =
        '<tr><td style="padding:0 28px 14px;">' +
          '<div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:6px;padding:12px 14px;font-size:13px;color:#065f46;">' +
            '<strong>🆕 New interest signalled:</strong> ' +
            esc(newInterests.map(labelForInterest).join(', ')) +
          '</div>' +
        '</td></tr>';
    } else if (s.isReturning && !s.isFinal) {
      banner =
        '<tr><td style="padding:0 28px 14px;">' +
          '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:12px 14px;font-size:13px;color:#1e40af;">' +
            '<strong>🔁 Returning visitor</strong> — confirming previously-known interests.' +
          '</div>' +
        '</td></tr>';
    } else if (s.mailNum === 1) {
      banner =
        '<tr><td style="padding:0 28px 14px;">' +
          '<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;padding:12px 14px;font-size:13px;color:#92400e;">' +
            '<strong>📞 Profile created</strong> — first contact in this lead\'s history.' +
          '</div>' +
        '</td></tr>';
    }

    var headerLabel = s.isFinal
      ? 'Callback Request — Complete'
      : 'Callback Chat — Mail #' + s.mailNum;
    var subHeader = 'Stage ' + s.stageNum + '/' + (CHAT.steps ? CHAT.steps.length : 0) + ' · ' + s.stageName;

    return [
      '<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,Arial,sans-serif;background:#f3f4f6;padding:32px 0;margin:0;">',
      '<table width="640" align="center" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.06);">',
      '<tr><td style="background:#0f172a;color:#fff;padding:22px 28px;">',
      '<p style="margin:0;font-size:11px;color:#00fd59;letter-spacing:1px;text-transform:uppercase;">navlakha.tech · chatbot</p>',
      '<h1 style="margin:6px 0 0;font-size:20px;">' + esc(headerLabel) + '</h1>',
      '<p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">' + esc(subHeader) + '</p>',
      '</td></tr>',
      banner,
      sectionsHtml,
      '<tr><td style="padding:20px 28px;font-size:11px;color:#94a3b8;border-top:1px solid #f1f5f9;">',
        'Automated from the chatbot on navlakha.tech. Reply to this thread to contact the lead directly.',
      '</td></tr>',
      '</table></body></html>'
    ].join('');
  }

  /* ---- Profile adapter — proxies window.NTVisitorProfile ------------- */
  var profileAdapter = window.NTVisitorProfile ? {
    get:                  function ()      { return window.NTVisitorProfile.get && window.NTVisitorProfile.get(); },
    update:               function (patch) { return window.NTVisitorProfile.update && window.NTVisitorProfile.update(patch); },
    setInterests:         function (arr)   { return window.NTVisitorProfile.setInterests && window.NTVisitorProfile.setInterests(arr); },
    bumpChatOpenCount:    function ()      { return window.NTVisitorProfile.bumpChatOpenCount && window.NTVisitorProfile.bumpChatOpenCount(); },
    bumpEmailsSentCount:  function ()      { return window.NTVisitorProfile.bumpEmailsSentCount && window.NTVisitorProfile.bumpEmailsSentCount(); },
    getNewInterests:      function (cur)   { return window.NTVisitorProfile.getNewInterests ? window.NTVisitorProfile.getNewInterests(cur) : (cur || []).slice(); },
    markInterestsEmailed: function (arr)   { return window.NTVisitorProfile.markInterestsEmailed && window.NTVisitorProfile.markInterestsEmailed(arr); },
    getCurrentProduct:    function ()      { return window.NTVisitorProfile.getCurrentProduct ? window.NTVisitorProfile.getCurrentProduct() : null; }
  } : null;

  /* ---- Init ---------------------------------------------------------- */
  Chatbox.init({
    storageKey: 'nt_chat_state_v1',
    mountId:    'nt-chatbot-root',
    stylesId:   'nt-chat-styles',
    // stylesHref intentionally null — the CDN stylesheet is preloaded by
    // load-components.js (jsDelivr) so it's available before the launcher mounts.

    brand: {
      name:          'Navlakha Technologies',
      avatarText:    'NT',
      tagline:       'Online — replies in ~5 min',
      launcherTitle: 'Chat with us',
      launcherSub:   'Schedule a callback'
    },

    steps:     CHAT.steps     || ['phone', 'interests', 'team_size', 'mail', 'name', 'requirements'],
    stepMeta:  CHAT.stepMeta  || {},
    interests: INTERESTS,
    teamSizes: CHAT.teamSizes || ['1 – 10', '11 – 50', '51 – 200', '201 – 1,000', '1,000+'],

    autoExpandDelayMs:      typeof CHAT.autoExpandDelayMs === 'number' ? CHAT.autoExpandDelayMs : 10000,
    autoExpandBlockedPaths: /book-demo|thank-you|order|privacy|reach|meet/i,
    bookDemoHrefPattern:    /(?:^|\/)book-demo(?:\.html)?(?:[?#].*)?$/i,

    whatsappNumber: CFG.whatsappPrimary || '918275269688',

    googleSignIn: CFG.googleClientId ? { clientId: CFG.googleClientId, enabled: true } : null,

    mailer: (CFG.mailerUrl && CFG.mailerSecretKey) ? {
      url:        CFG.mailerUrl,
      secretKey:  CFG.mailerSecretKey,
      recipients: (CFG.recipients && CFG.recipients.length)
        ? CFG.recipients
        : [CFG.supportEmail || 'support@navlakha.tech', 'nnautatva@gmail.com', 'mahavirnn@gmail.com'],
      subject: subjectBuilder,
      body:    bodyBuilder
    } : null,

    profile:    profileAdapter,
    validators: window.NTValidators || null,
    ipLocation: window.NTIPLocation ? { getDialCode: window.NTIPLocation.getDialCode } : null,
    dialPicker: window.NTDialPicker ? { create: window.NTDialPicker.create } : null,
    attribution: window.NTAttribution ? { get: window.NTAttribution.get } : null
  });

  /* ---- Back-compat surface: window.NTChatbot ------------------------- */
  // The book-demo form and any other in-page CTAs call into NTChatbot —
  // keep the old shape so we don't have to chase every reference.
  window.NTChatbot = {
    open:           function (opts) { window.Chatbox.open(opts || {}); },
    openFocused:    function ()     { window.Chatbox.openFocused(); },
    submitFullLead: function (data, opts) { return window.Chatbox.submitFullLead(data, opts); }
  };
})();
