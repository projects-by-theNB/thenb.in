/**
 * Shared form validators — single source of truth for every form on the site
 * (chatbot, book-demo, order).
 *
 *   NTValidators.isValidPhoneDigits('98765 43210', '+91')  // true
 *   NTValidators.isValidPhoneDigits('98628195865', '+91')  // false (11 digits for IN)
 *   NTValidators.isValidEmail('a@b.com')                   // true
 *
 * Phone validation is two-tier:
 *   1. Synchronous format check — only digits + common formatting characters,
 *      ≥ 7 digits. Catches the obvious garbage ("455800.90..#,,;#,,").
 *   2. Country-aware check via libphonenumber-js (lazy-loaded from CDN). If
 *      the library has finished loading AND the caller passed a dial code,
 *      we run the per-country rule (length, prefix, mobile vs. landline).
 *      Until the library is ready, only the format check applies — submits
 *      stay synchronous and never block on a CDN.
 *
 * Past bugs this guards against:
 *   - "455800.90..#,,;#,,"  — sneaked past a digit-count-only check.
 *   - "98628195865" with +91 — 11 digits, accepted by a loose ≥7 check;
 *     libphonenumber correctly rejects (IN mobiles are exactly 10 digits).
 */
(function () {
  'use strict';

  if (window.NTValidators) return;

  // Pinned version — bump deliberately when libphonenumber metadata adds new
  // countries. Loaded via UMD bundle so it works without a module loader.
  var LIB_URL = 'https://unpkg.com/libphonenumber-js@1.11.17/bundle/libphonenumber-js.min.js';

  function loadLibPhoneNumber() {
    if (window.libphonenumber) return;
    if (document.querySelector('script[data-nt-libphone]')) return;
    var s = document.createElement('script');
    s.src = LIB_URL;
    s.async = true;
    s.defer = true;
    s.setAttribute('data-nt-libphone', '1');
    document.head.appendChild(s);
  }

  // Tier 1 — synchronous format check. Allows digits + common phone
  // formatting (spaces, parens, dashes), with an optional leading "+" for
  // forms (like order.html) that don't have a separate dial-code picker and
  // may receive pre-filled numbers in "+91 …" form. At least 7 digits.
  function looksLikePhone(input) {
    var s = String(input == null ? '' : input).trim();
    if (!s) return false;
    if (!/^\+?[0-9\s()\-]+$/.test(s)) return false;
    return s.replace(/\D/g, '').length >= 7;
  }

  // Tier 2 — country-aware check via libphonenumber-js. If the input already
  // starts with "+", it's passed through as-is (the library will detect the
  // country). Otherwise we prepend the caller-supplied dial code. Returns
  // null when the library isn't ready, so the caller can fall back.
  function strictPhoneCheck(input, dialCode) {
    var lib = window.libphonenumber;
    if (!lib) return null;
    var s = String(input == null ? '' : input).trim();
    var combined;
    if (s.charAt(0) === '+')      combined = s;
    else if (dialCode)            combined = String(dialCode).trim() + ' ' + s;
    else                          return null; // no country context; can't run strict check
    try {
      return !!lib.isValidPhoneNumber(combined);
    } catch (e) {
      return null;
    }
  }

  // Public API — caller passes dial code (e.g. '+91') when available so the
  // strict check can run. Without a dial code, only the format check runs.
  function isValidPhoneDigits(input, dialCode) {
    if (!looksLikePhone(input)) return false;
    var strict = strictPhoneCheck(input, dialCode);
    return strict === null ? true : strict;
  }

  // Liberal email shape check — server-side does the authoritative
  // validation; this just catches obvious typos before the network call.
  function isValidEmail(input) {
    var s = String(input == null ? '' : input).trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }

  // Kick off the lib load now so by the time the user clicks submit, it's
  // almost always parsed. Failure is silent — synchronous format check
  // still protects us.
  loadLibPhoneNumber();

  window.NTValidators = {
    isValidPhoneDigits: isValidPhoneDigits,
    isValidEmail:       isValidEmail
  };
})();
