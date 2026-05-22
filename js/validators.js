/**
 * Shared form validators — single source of truth for every form on the site
 * (chatbot, book-demo, order).
 *
 *   NTValidators.isValidPhoneDigits('98765 43210')  // true
 *   NTValidators.isValidEmail('a@b.com')            // true
 *
 * Past bugs this guards against:
 *   - "455800.90..#,,;#,," sneaking past a digit-count-only phone check
 *     because stripping \D left 8 digits. Format check rejects it now.
 */
(function () {
  'use strict';

  if (window.NTValidators) return;

  // Phone local-part: only digits and common formatting (spaces, parens,
  // dashes). The "+CC" dial code lives on the picker and is not part of
  // this input. At least 7 digits required.
  function isValidPhoneDigits(input) {
    var s = String(input == null ? '' : input).trim();
    if (!s) return false;
    if (!/^[0-9\s()\-]+$/.test(s)) return false;
    return s.replace(/\D/g, '').length >= 7;
  }

  // Liberal email shape check — server-side does the authoritative validation,
  // this just catches obvious typos before the network call.
  function isValidEmail(input) {
    var s = String(input == null ? '' : input).trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }

  window.NTValidators = {
    isValidPhoneDigits: isValidPhoneDigits,
    isValidEmail:       isValidEmail
  };
})();
