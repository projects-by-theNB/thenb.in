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
 *   gclid, fbclid, msclkid, landing_referrer, landing_page
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

  function compute() {
    var current = readCurrentParams();
    var stored = loadStored();
    var hasCurrent = Object.keys(current).length > 0;

    if (hasCurrent && !stored) {
      var record = {
        captured_at: Date.now(),
        landing_page: location.pathname + location.search,
        landing_referrer: document.referrer || null
      };
      UTM_KEYS.concat(CLICK_ID_KEYS).forEach(function (k) {
        record[k] = current[k] || null;
      });
      persist(record);
      return record;
    }

    if (stored) return stored;

    if (hasCurrent) {
      var fallback = {
        captured_at: Date.now(),
        landing_page: location.pathname + location.search,
        landing_referrer: document.referrer || null
      };
      UTM_KEYS.concat(CLICK_ID_KEYS).forEach(function (k) {
        fallback[k] = current[k] || null;
      });
      return fallback;
    }

    return {
      captured_at: Date.now(),
      landing_page: location.pathname + location.search,
      landing_referrer: document.referrer || null,
      utm_source: null, utm_medium: null, utm_campaign: null,
      utm_term: null, utm_content: null,
      gclid: null, fbclid: null, msclkid: null
    };
  }

  var attribution = compute();

  window.NTAttribution = {
    get: function () { return Object.assign({}, attribution); }
  };

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(Object.assign({ event: 'attribution_ready' }, attribution));
})();
