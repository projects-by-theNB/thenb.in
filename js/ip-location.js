/**
 * Passive IP + coarse-location collector.
 *
 * Fires one network call per visitor lifetime, persists the result onto
 * NTVisitorProfile under `ip_location`, and exposes window.NTIPLocation.get()
 * as a synchronous snapshot for the email builders.
 *
 * Provider chain (tries each until one resolves):
 *   1. https://ipwho.is/       — IP + city/region/country + ASN/ISP (free, no key, CORS)
 *   2. https://api.ipify.org/  — IP only fallback (free, no key, CORS)
 *
 * The fetch is fire-and-forget: every email builder is tolerant of a null
 * snapshot, so a slow provider just means the very first email may omit
 * the network rows. Subsequent emails read the persisted value.
 */
(function () {
  'use strict';

  if (window.__ntIPLocationMounted) return;
  window.__ntIPLocationMounted = true;

  // Re-fetch at most once every 7 days — IP/ISP can change for a returning
  // visitor (new network, travel). Cached longer than that = stale rows in
  // the sales email.
  var REFRESH_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

  function getStored() {
    if (!window.NTVisitorProfile || !window.NTVisitorProfile.get) return null;
    var p = window.NTVisitorProfile.get();
    return (p && p.ip_location) || null;
  }

  function needsRefresh(stored) {
    if (!stored || !stored.fetched_at) return true;
    return Date.now() - stored.fetched_at > REFRESH_AFTER_MS;
  }

  function normaliseIpwho(d) {
    if (!d || d.success === false || !d.ip) return null;
    return {
      ip:        d.ip,
      ip_type:   d.type || null,
      city:      d.city || null,
      region:    d.region || null,
      country:   d.country || null,
      country_code: d.country_code || null,
      postal:    d.postal || null,
      latitude:  d.latitude  != null ? d.latitude  : null,
      longitude: d.longitude != null ? d.longitude : null,
      timezone:  (d.timezone && d.timezone.id) || null,
      isp:       (d.connection && (d.connection.isp || d.connection.org)) || null,
      asn:       (d.connection && d.connection.asn) || null,
      source:    'ipwho.is',
      fetched_at: Date.now()
    };
  }

  function fetchIpwho() {
    return fetch('https://ipwho.is/', { method: 'GET', mode: 'cors', credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(normaliseIpwho);
  }

  function fetchIpifyFallback() {
    return fetch('https://api.ipify.org?format=json', { method: 'GET', mode: 'cors', credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.ip) return null;
        return {
          ip: d.ip, ip_type: null,
          city: null, region: null, country: null, country_code: null, postal: null,
          latitude: null, longitude: null, timezone: null, isp: null, asn: null,
          source: 'ipify.org', fetched_at: Date.now()
        };
      });
  }

  function persist(data) {
    if (!data) return;
    if (window.NTVisitorProfile && window.NTVisitorProfile.setIPLocation) {
      window.NTVisitorProfile.setIPLocation(data);
    }
  }

  function boot() {
    if (!window.NTVisitorProfile) {
      return setTimeout(boot, 50);
    }
    var stored = getStored();
    if (!needsRefresh(stored)) return;

    fetchIpwho()
      .catch(function () { return null; })
      .then(function (data) {
        if (data) return data;
        return fetchIpifyFallback().catch(function () { return null; });
      })
      .then(persist);
  }

  window.NTIPLocation = {
    /** Synchronous snapshot from the profile, or null if not yet fetched. */
    get: getStored,
    /** Force a re-fetch (used for QA / "Forget me" reset flows). */
    refresh: function () {
      fetchIpwho()
        .catch(function () { return fetchIpifyFallback().catch(function () { return null; }); })
        .then(persist);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
