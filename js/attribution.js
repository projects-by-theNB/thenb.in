/**
 * Marketing attribution helper.
 *
 * First-touch model: the FIRST set of UTM params a visitor lands with is
 * persisted in localStorage for 90 days. Any later session/click that does
 * NOT carry UTMs falls back to this stored attribution — so a user who
 * lands from Google Ads, leaves, comes back direct, and then converts,
 * still gets credited to the original Google Ads click.
 *
 * Pushes `attribution_ready` to dataLayer with:
 *   utm_source, utm_medium, utm_campaign, utm_term, utm_content,
 *   gclid, fbclid, msclkid, landing_referrer, landing_referrer_domain,
 *   landing_referrer_type, landing_referrer_platform,
 *   landing_referrer_search_query, landing_page
 *
 * Read it from any later script via:
 *   window.NTAttribution.get()
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'nt_attribution_v1';
  var TTL_DAYS = 90;
  var TTL_MS = TTL_DAYS * 24 * 60 * 60 * 1000;

  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  var CLICK_ID_KEYS = ['gclid', 'fbclid', 'msclkid', 'li_fat_id', 'ttclid'];

  // Known search engines — host contains any of these strings.
  var SEARCH_ENGINES = [
    'google.', 'bing.', 'duckduckgo.', 'yahoo.', 'baidu.',
    'yandex.', 'ecosia.', 'brave.com', 'qwant.com', 'kagi.com'
  ];

  // Known social platforms — exact host or *.suffix match.
  var SOCIAL_PLATFORMS = {
    'facebook.com': 'Facebook', 'm.facebook.com': 'Facebook', 'l.facebook.com': 'Facebook',
    'fb.com': 'Facebook', 'fb.me': 'Facebook',
    'instagram.com': 'Instagram', 'l.instagram.com': 'Instagram',
    'linkedin.com': 'LinkedIn', 'lnkd.in': 'LinkedIn',
    'twitter.com': 'X (Twitter)', 'x.com': 'X (Twitter)', 't.co': 'X (Twitter)',
    'youtube.com': 'YouTube', 'm.youtube.com': 'YouTube', 'youtu.be': 'YouTube',
    'wa.me': 'WhatsApp', 'whatsapp.com': 'WhatsApp', 'web.whatsapp.com': 'WhatsApp', 'chat.whatsapp.com': 'WhatsApp',
    't.me': 'Telegram', 'telegram.org': 'Telegram',
    'reddit.com': 'Reddit',
    'medium.com': 'Medium',
    'quora.com': 'Quora',
    'pinterest.com': 'Pinterest', 'in.pinterest.com': 'Pinterest',
    'tiktok.com': 'TikTok',
    'github.com': 'GitHub',
    'producthunt.com': 'Product Hunt',
    'hackernews.com': 'Hacker News', 'news.ycombinator.com': 'Hacker News'
  };

  function classifyReferrer(referrerUrl) {
    if (!referrerUrl) return { type: 'direct', domain: null, platform: null, search_query: null };
    var url;
    try { url = new URL(referrerUrl); } catch (e) {
      return { type: 'unknown', domain: null, platform: null, search_query: null };
    }
    var host = url.hostname.toLowerCase();
    var domain = host.replace(/^www\./, '');
    if (location.hostname === host) return { type: 'internal', domain: domain, platform: null, search_query: null };

    for (var i = 0; i < SEARCH_ENGINES.length; i++) {
      if (host.indexOf(SEARCH_ENGINES[i]) !== -1) {
        var q = url.searchParams.get('q') || url.searchParams.get('query') ||
                url.searchParams.get('p') || url.searchParams.get('text');
        return { type: 'search', domain: domain, platform: domain, search_query: q || null };
      }
    }
    if (SOCIAL_PLATFORMS[host] || SOCIAL_PLATFORMS[domain]) {
      return { type: 'social', domain: domain, platform: SOCIAL_PLATFORMS[host] || SOCIAL_PLATFORMS[domain], search_query: null };
    }
    if (host.indexOf('mail.') !== -1 || host.indexOf('outlook.') !== -1) {
      return { type: 'email', domain: domain, platform: domain, search_query: null };
    }
    return { type: 'referral', domain: domain, platform: null, search_query: null };
  }

  function readCurrentParams() {
    var p = new URLSearchParams(location.search);
    var out = {};
    UTM_KEYS.concat(CLICK_ID_KEYS).forEach(function (k) {
      var v = p.get(k);
      if (v) out[k] = v;
    });
    return out;
  }

  function loadStored() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || !obj.captured_at) return null;
      if (Date.now() - obj.captured_at > TTL_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return obj;
    } catch (e) { return null; }
  }

  function persist(record) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(record)); } catch (e) {}
  }

  function decorateReferrer(record, referrerUrl) {
    var info = classifyReferrer(referrerUrl);
    record.landing_referrer               = referrerUrl || null;
    record.landing_referrer_domain        = info.domain;
    record.landing_referrer_type          = info.type;
    record.landing_referrer_platform      = info.platform;
    record.landing_referrer_search_query  = info.search_query;
    return record;
  }

  function compute() {
    var current = readCurrentParams();
    var stored = loadStored();
    var hasCurrent = Object.keys(current).length > 0;
    var referrerNow = document.referrer || '';

    if (hasCurrent && !stored) {
      var record = decorateReferrer({
        captured_at: Date.now(),
        landing_page: location.pathname + location.search
      }, referrerNow);
      UTM_KEYS.concat(CLICK_ID_KEYS).forEach(function (k) {
        record[k] = current[k] || null;
      });
      persist(record);
      return record;
    }

    if (stored) {
      // Older stored records may not have the new referrer-decoration fields;
      // re-classify on the fly so consumers never see an undefined.
      if (typeof stored.landing_referrer_type === 'undefined') {
        decorateReferrer(stored, stored.landing_referrer || null);
      }
      return stored;
    }

    if (hasCurrent) {
      var fallback = decorateReferrer({
        captured_at: Date.now(),
        landing_page: location.pathname + location.search
      }, referrerNow);
      UTM_KEYS.concat(CLICK_ID_KEYS).forEach(function (k) {
        fallback[k] = current[k] || null;
      });
      return fallback;
    }

    return decorateReferrer({
      captured_at: Date.now(),
      landing_page: location.pathname + location.search,
      utm_source: null, utm_medium: null, utm_campaign: null,
      utm_term: null, utm_content: null,
      gclid: null, fbclid: null, msclkid: null
    }, referrerNow);
  }

  var attribution = compute();

  window.NTAttribution = {
    get: function () { return Object.assign({}, attribution); }
  };

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(Object.assign({ event: 'attribution_ready' }, attribution));
})();
