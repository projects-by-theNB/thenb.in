/**
 * Activity emailer — sends background mails to the team for passive visitor
 * behaviour, *only* once we have a profile (= phone OR email captured).
 *
 * Triggers (each gated by rate-limit in NTVisitorProfile.canSendActivityEmail):
 *   - 'session'         : a returning visit after a > 30 min gap
 *   - 'pricing'         : the visitor lands on the pricing section of any page
 *   - 'deep_scroll'     : reaches ≥ 80% scroll on a product page
 *   - 'repeat_product'  : 3rd visit to the same product page
 *
 * Hard caps (configurable via NTVisitorProfile.canSendActivityEmail opts):
 *   - 1 email per 30 min
 *   - 3 emails per 24h rolling window
 *   - 1 email per "kind" per 6h
 *
 * The email payload uses the same mailer endpoint and a similar layout to
 * the chatbot stage email, so the sales person sees the same structure.
 */
(function () {
  'use strict';

  if (window.__ntActivityEmailerMounted) return;
  window.__ntActivityEmailerMounted = true;

  // Config-driven thresholds (lib/custom/js/config.js → activity).
  var ACTIVITY_CFG = (window.AppConfig && window.AppConfig.activity) || {};
  var DEEP_SCROLL_PCT          = ACTIVITY_CFG.deepScrollPct          || 80;
  var REPEAT_PRODUCT_THRESHOLD = ACTIVITY_CFG.repeatProductThreshold || 3;

  /* ---------- helpers ----------------------------------------------------- */

  function hasProfile() {
    if (!window.NTVisitorProfile || !window.NTVisitorProfile.get) return false;
    var p = window.NTVisitorProfile.get();
    return Boolean(p && (p.phone || p.email));
  }

  function getProfile() {
    return (window.NTVisitorProfile && window.NTVisitorProfile.get) ? window.NTVisitorProfile.get() : null;
  }

  function getAttribution() {
    return (window.NTAttribution && window.NTAttribution.get) ? window.NTAttribution.get() : null;
  }

  function isProductPage() {
    return Boolean(window.NTVisitorProfile && window.NTVisitorProfile.getCurrentProduct && window.NTVisitorProfile.getCurrentProduct());
  }

  function isPricingContext() {
    return /pricing/i.test(location.pathname) ||
           /#pricing/.test(location.hash) ||
           Boolean(document.getElementById('pricing'));
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ---------- email envelope --------------------------------------------- */

  /**
   * Compose a compact activity email with the full profile snapshot.
   * Reuses the visual section style from the chatbot's stage email.
   */
  function buildActivityEmail(kind, headline, detail) {
    var profile = getProfile() || {};
    var attr = getAttribution();
    var name = profile.name || '';
    var phone = profile.phone || '';
    var email = profile.email || '';

    var rows = [];

    rows.push(['Trigger',  kind + ' — ' + headline]);
    if (detail)        rows.push(['Detail', detail]);
    rows.push(['Current page', location.href]);

    rows.push(['Name',  name  || '—']);
    rows.push(['Phone', phone || '—']);
    rows.push(['Email', email + (profile.email_verified ? ' ✓ verified' : '')]);

    if (Array.isArray(profile.visited_products) && profile.visited_products.length > 0) {
      rows.push(['Products viewed', profile.visited_products.join(', ')]);
    }
    if (profile.session_count) {
      rows.push(['Sessions', profile.session_count]);
    }
    if (profile.total_page_views) {
      rows.push(['Page views', profile.total_page_views]);
    }
    if (profile.max_scroll_depth) {
      rows.push(['Max scroll', profile.max_scroll_depth + '%']);
    }
    if (profile.total_time_on_site_ms) {
      var sec = Math.round(profile.total_time_on_site_ms / 1000);
      rows.push(['Time on site', sec >= 60 ? Math.floor(sec / 60) + 'm ' + (sec % 60) + 's' : sec + 's']);
    }
    if (profile.first_seen) {
      var days = Math.max(0, Math.round((Date.now() - profile.first_seen) / 86400000));
      rows.push(['Visitor age', days + ' day' + (days === 1 ? '' : 's')]);
    }

    if (attr) {
      var refType = attr.landing_referrer_type;
      var refPlat = attr.landing_referrer_platform;
      var refDom  = attr.landing_referrer_domain;
      if (refType && refType !== 'direct') {
        var rparts = [];
        if (refPlat)     rparts.push(refPlat);
        else if (refDom) rparts.push(refDom);
        rparts.push('(' + refType + ')');
        if (attr.landing_referrer_search_query) rparts.push('— "' + attr.landing_referrer_search_query + '"');
        rows.push(['Referred from', rparts.join(' ')]);
      }
      if (attr.utm_source)   rows.push(['utm_source',   attr.utm_source]);
      if (attr.utm_campaign) rows.push(['utm_campaign', attr.utm_campaign]);
      if (attr.gclid)        rows.push(['gclid',        attr.gclid]);
    }

    var trs = rows.map(function (r) {
      return '<tr>' +
        '<td style="padding:7px 14px;color:#64748b;width:38%;vertical-align:top;font-size:13px;border-bottom:1px solid #f1f5f9;">' + esc(r[0]) + '</td>' +
        '<td style="padding:7px 14px;color:#0f172a;vertical-align:top;font-size:13px;border-bottom:1px solid #f1f5f9;">' + esc(r[1]) + '</td>' +
      '</tr>';
    }).join('');

    var who = name || phone || email || 'visitor';

    return [
      '<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,Arial,sans-serif;background:#f3f4f6;padding:32px 0;margin:0;">',
      '<table width="640" align="center" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.06);">',
      '<tr><td style="background:#0f172a;color:#fff;padding:22px 28px;">',
      '<p style="margin:0;font-size:11px;color:#00fd59;letter-spacing:1px;text-transform:uppercase;">navlakha.tech · activity</p>',
      '<h1 style="margin:6px 0 0;font-size:20px;">📊 ' + esc(headline) + '</h1>',
      '<p style="margin:4px 0 0;font-size:13px;color:#94a3b8;">' + esc(who) + '</p>',
      '</td></tr>',
      '<tr><td style="padding:18px 28px;">',
        '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#fafbfc;border:1px solid #e5e7eb;border-radius:6px;">',
          trs,
        '</table>',
      '</td></tr>',
      '<tr><td style="padding:14px 28px;font-size:11px;color:#94a3b8;">',
        'Passive activity notification — not triggered by a chatbot interaction. To stop these for this lead, clear their localStorage.',
      '</td></tr>',
      '</table></body></html>'
    ].join('');
  }

  /* ---------- send ------------------------------------------------------- */

  function sendActivityEmail(kind, headline, detail) {
    if (!hasProfile()) return;
    // Pass config-driven rate limits through to NTVisitorProfile.canSendActivityEmail
    if (!window.NTVisitorProfile.canSendActivityEmail(kind, {
      cooldownMs:     ACTIVITY_CFG.cooldownMs,
      dailyMax:       ACTIVITY_CFG.dailyMax,
      kindCooldownMs: ACTIVITY_CFG.kindCooldownMs
    })) return;
    var cfg = window.AppConfig || {};
    if (!cfg.mailerUrl || !cfg.mailerSecretKey) return;

    var profile = getProfile();
    var who = profile.name || profile.phone || profile.email || 'visitor';
    var subject = '📊 Activity — ' + headline + ' · ' + who;
    var content = buildActivityEmail(kind, headline, detail || '');

    var recipients = (cfg.recipients && cfg.recipients.length)
      ? cfg.recipients
      : [cfg.supportEmail || 'support@navlakha.tech', 'nnautatva@gmail.com', 'mahavirnn@gmail.com'];

    recipients.forEach(function (to) {
      fetch(cfg.mailerUrl, {
        method: 'POST', mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject, content: content,
          email_secret_key: cfg.mailerSecretKey, to_email: to
        }),
        keepalive: true
      }).catch(function () {});
    });

    window.NTVisitorProfile.recordActivityEmail(kind);
    if (window.dataLayer) {
      window.dataLayer.push({
        event: 'activity_email_sent',
        activity_kind: kind,
        page_path: location.pathname
      });
    }
  }

  /* ---------- triggers --------------------------------------------------- */

  function checkSessionTrigger() {
    var p = getProfile();
    if (!p || !p.last_session_at) return;
    // session_count is bumped by client-context.js. If it's > 1 and the
    // current session started this pageload (cheap proxy: last_session_at
    // within last 60s), treat as a returning visit worth flagging.
    if (p.session_count <= 1) return;
    if (Date.now() - p.last_session_at > 60 * 1000) return; // session started a while ago
    sendActivityEmail(
      'session',
      'Returning visit — session #' + p.session_count,
      'On ' + location.pathname + '. Time on site so far: ' +
        (p.total_time_on_site_ms ? Math.round(p.total_time_on_site_ms / 1000) + 's' : 'n/a')
    );
  }

  function checkPricingTrigger() {
    if (!isPricingContext()) return;
    sendActivityEmail(
      'pricing',
      'Viewed pricing on ' + location.pathname,
      'Profile activity: pricing section reached.'
    );
  }

  function checkRepeatProductTrigger() {
    var p = getProfile();
    if (!p) return;
    var current = window.NTVisitorProfile.getCurrentProduct && window.NTVisitorProfile.getCurrentProduct();
    if (!current) return;
    var path = location.pathname;
    var visits = (p.page_views_by_path && p.page_views_by_path[path]) || 0;
    if (visits < REPEAT_PRODUCT_THRESHOLD) return;
    sendActivityEmail(
      'repeat_product',
      'Repeat visit (×' + visits + ') to ' + current,
      'Page: ' + path + ' viewed ' + visits + ' times.'
    );
  }

  function maybeFireDeepScroll() {
    if (!isProductPage()) return;
    var p = getProfile();
    if (!p) return;
    if ((p.max_scroll_depth || 0) < DEEP_SCROLL_PCT) return;
    sendActivityEmail(
      'deep_scroll',
      'Deep scroll (' + p.max_scroll_depth + '%) on ' + location.pathname,
      'Engaged read of a product page.'
    );
  }

  /* ---------- scroll listener -------------------------------------------- */

  var scrollTicking = false;
  function onScroll() {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(function () {
      scrollTicking = false;
      maybeFireDeepScroll();
    });
  }

  /* ---------- boot ------------------------------------------------------- */

  function boot() {
    // Wait briefly for profile + client-context to settle (both load via
    // load-components.js — order isn't guaranteed against rAF).
    setTimeout(function () {
      checkSessionTrigger();
      checkPricingTrigger();
      checkRepeatProductTrigger();
      maybeFireDeepScroll();
    }, 800);

    // Catch deep scroll if user actually scrolls after load.
    window.addEventListener('scroll', onScroll, { passive: true });

    // Pricing trigger if visitor jumps to #pricing via in-page nav.
    window.addEventListener('hashchange', checkPricingTrigger);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
