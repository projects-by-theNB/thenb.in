/**
 * Navlakha Technologies — Signup Popup Component
 * 
 * Usage (add to any page):
 *   <script src="lib/custom/js/signup-popup.js"></script>
 *   <script>SignupPopup.init();</script>
 */

var SignupPopup = (function () {
  'use strict';

  // Configuration
  var CONFIG = {
    delayMs: 10000,            // initial delay before first show (ms)
    repeatIntervalMs: 240000,  // 4 minutes between shows for non-signed-up users
    backdropClass: 'signup-popup-backdrop',
    popupClass: 'signup-popup-container',
    googleClientId: null,
    mailerUrl: null,
    mailerSecretKey: null,
    supportEmail: 'support@navlakha.tech'
  };

  // localStorage keys
  var LS_SIGNED_UP   = 'nt_signed_up';    // '1' once user completes signup
  var LS_LAST_SHOWN  = 'nt_popup_last_shown'; // timestamp of last popup display

  var state = {
    initialized: false,
    popupShown: false,
    googleLibraryLoaded: false
  };

  /** Return true if the user has already signed up via this popup. */
  function hasSignedUp() {
    try { return localStorage.getItem(LS_SIGNED_UP) === '1'; } catch(e) { return false; }
  }

  /**
   * Read the chat profile from localStorage. Returns the parsed object or
   * null. Exposed as a function (not a cached value) because the chatbot
   * may write to localStorage after this script first runs — we re-read
   * every time so a freshly-completed chat suppresses immediately.
   */
  function readChatProfile() {
    try {
      var raw = localStorage.getItem('nt_profile_v1');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  function hasChatProfile() {
    var p = readChatProfile();
    return Boolean(p && (p.phone || p.name || p.email));
  }

  /** Either signed up via popup, or already known via chatbot. */
  var _suppressionLogged = false;
  function shouldSuppress() {
    var signed = hasSignedUp();
    var profile = readChatProfile();
    var profileMatch = Boolean(profile && (profile.phone || profile.name || profile.email));
    var suppressed = signed || profileMatch;

    // Always log the first decision per page-load so we can debug
    // mismatched-localStorage cases (e.g. dev origin vs prod origin,
    // private window, profile cleared, etc.).
    if (!_suppressionLogged) {
      _suppressionLogged = true;
      console.info('[NT discount-popup] suppression check', {
        suppressed: suppressed,
        hasSignedUp: signed,
        hasChatProfile: profileMatch,
        profileSnapshot: profile
          ? {
              phone: profile.phone || null,
              name: profile.name || null,
              email: profile.email || null,
              first_seen: profile.first_seen,
              last_seen: profile.last_seen
            }
          : null,
        origin: location.origin,
        storageKeysSeen: (function () {
          try {
            return {
              nt_signed_up: localStorage.getItem(LS_SIGNED_UP),
              nt_profile_v1_present: localStorage.getItem('nt_profile_v1') !== null
            };
          } catch (e) { return { error: String(e) }; }
        })()
      });
    }
    return suppressed;
  }

  /** Record that the popup was just displayed */
  function recordShown() {
    try { localStorage.setItem(LS_LAST_SHOWN, String(Date.now())); } catch(e) {}
  }

  /** Mark the user as permanently signed up — never show popup again */
  function markSignedUp() {
    try {
      localStorage.setItem(LS_SIGNED_UP, '1');
      // Also clear the last-shown timestamp so it doesn't linger
      localStorage.removeItem(LS_LAST_SHOWN);
    } catch(e) {}
  }

  /**
   * Calculate how many ms to wait before showing the popup.
   * - Signed up → never (returns -1)
   * - Never shown before → CONFIG.delayMs
   * - Shown recently → remaining time until 4-min window expires
   * - 4 min already passed → CONFIG.delayMs
   */
  function calcWaitMs() {
    if (shouldSuppress()) return -1;
    try {
      var last = parseInt(localStorage.getItem(LS_LAST_SHOWN) || '0', 10);
      if (!last) return CONFIG.delayMs;
      var elapsed = Date.now() - last;
      if (elapsed >= CONFIG.repeatIntervalMs) return CONFIG.delayMs;
      return CONFIG.repeatIntervalMs - elapsed;
    } catch(e) {
      return CONFIG.delayMs;
    }
  }

  /**
   * Create the popup HTML
   */
  function createPopupHTML() {
    return `
      <div class="${CONFIG.backdropClass}"></div>
      <div class="${CONFIG.popupClass}">
        <button class="popup-close-btn" aria-label="Close popup">
          <span>×</span>
        </button>
        <div class="popup-content">
          <h2>Unlock Up to 25% Discount</h2>
          <div class="popup-divider"></div>
          
          <button class="popup-btn signup-google-btn">
            <svg class="google-icon" viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign up with Google
          </button>
          
          <!-- Hidden Google Button Container -->
          <div id="google-signin-button" style="display: none;"></div>
          
          <div class="popup-footer">
            <p class="popup-small-text">We respect your privacy. No spam, only valuable updates.</p>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Inject CSS styles
   */
  function injectStyles() {
    if (document.getElementById('signup-popup-styles')) {
      return; // Already injected
    }

    var style = document.createElement('style');
    style.id = 'signup-popup-styles';
    style.textContent = `
      /* Signup Popup Backdrop */
      .signup-popup-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(5px);
        z-index: 9998;
        animation: fadeInBackdrop 0.3s ease-in-out;
      }

      /* Signup Popup Container */
      .signup-popup-container {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 9999;
        width: 90%;
        max-width: 450px;
        background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
        border-radius: 20px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        overflow: hidden;
        animation: slideUpPopup 0.4s ease-out;
      }

      /* Close Button */
      .popup-close-btn {
        position: absolute;
        top: 12px;
        right: 12px;
        width: 40px;
        height: 40px;
        border: none;
        background: rgba(74, 107, 179, 0.1);
        border-radius: 50%;
        cursor: pointer;
        font-size: 28px;
        color: #4a6bb3;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        z-index: 10000;
      }

      .popup-close-btn:hover {
        background: rgba(74, 107, 179, 0.2);
        transform: rotate(90deg);
      }

      .popup-close-btn span {
        line-height: 1;
      }

      /* Popup Content */
      .popup-content {
        padding: 50px 35px 35px;
        text-align: center;
      }

      .popup-content h2 {
        font-size: 28px;
        font-weight: 600;
        color: #2f5597;
        margin-bottom: 15px;
        font-family: "Montserrat", sans-serif;
      }

      .popup-content p {
        font-size: 15px;
        color: #6c757d;
        line-height: 1.6;
        margin-bottom: 25px;
      }

      .discount-highlight {
        color: #bb0bb3;
        font-weight: 700;
        font-size: 18px;
      }

      /* Divider */
      .popup-divider {
        height: 1px;
        background: linear-gradient(to right, transparent, #ddd, transparent);
        margin: 25px 0;
      }

      /* Google Sign Up Button */
      .signup-google-btn {
        display: inline-flex;
        padding: 14px 28px;
        background: linear-gradient(135deg, #4a6bb3 0%, #2f5597 100%);
        color: white;
        border: none;
        border-radius: 10px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        align-items: center;
        justify-content: center;
        gap: 12px;
        box-shadow: 0 8px 20px rgba(74, 107, 179, 0.3);
        font-family: "Open Sans", sans-serif;
      }

      .signup-google-btn:hover {
        background: linear-gradient(135deg, #2f5597 0%, #1a3a6b 100%);
        transform: translateY(-2px);
        box-shadow: 0 12px 28px rgba(74, 107, 179, 0.4);
      }

      .signup-google-btn:active {
        transform: translateY(0);
      }

      .google-icon {
        width: 20px;
        height: 20px;
      }

      /* Footer Text */
      .popup-footer {
        margin-top: 20px;
      }

      .popup-small-text {
        font-size: 12px;
        color: #999;
        margin: 0;
      }

      /* Animations */
      @keyframes fadeInBackdrop {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @keyframes slideUpPopup {
        from {
          opacity: 0;
          transform: translate(-50%, -45%);
        }
        to {
          opacity: 1;
          transform: translate(-50%, -50%);
        }
      }

      /* Hidden State */
      .signup-popup-hidden {
        display: none !important;
      }

      /* Mobile Responsive */
      @media (max-width: 576px) {
        .signup-popup-container {
          width: 95%;
          max-width: 100%;
        }

        .popup-content {
          padding: 40px 25px 25px;
        }

        .popup-content h2 {
          font-size: 24px;
        }

        .popup-content p {
          font-size: 14px;
        }

        .discount-highlight {
          font-size: 16px;
        }

        .signup-google-btn {
          font-size: 14px;
        }
      }

      /* Floating Signup Button — sits between WhatsApp (28px) and Back-to-top (168px) */
      .signup-popup-floating-btn {
        position: fixed;
        bottom: 98px;
        right: 28px;
        width: 56px;
        height: 56px;
        background: linear-gradient(135deg, #4a6bb3 0%, #2f5597 100%);
        border: none;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 8px 24px rgba(74, 107, 179, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9997;
        transition: all 0.3s ease;
        animation: slideInButton 0.4s ease-out;
        font-size: 24px;
      }

      .signup-popup-floating-btn:hover {
        transform: scale(1.1);
        box-shadow: 0 12px 32px rgba(74, 107, 179, 0.5);
      }

      .signup-popup-floating-btn:active {
        transform: scale(0.95);
      }

      @keyframes slideInButton {
        from {
          opacity: 0;
          transform: translateY(30px) scale(0.8);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      @keyframes slideOutButton {
        from {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        to {
          opacity: 0;
          transform: translateY(30px) scale(0.8);
        }
      }

      .signup-popup-floating-btn.hidden {
        animation: slideOutButton 0.3s ease-out forwards;
      }

      @media (max-width: 768px) {
        .signup-popup-floating-btn {
          bottom: 78px;
          right: 20px;
          width: 44px;
          height: 44px;
          font-size: 18px;
        }

        .signup-popup-floating-btn span {
          font-size: 20px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Create and show floating button
   */
  function createFloatingButton() {
    // Check if already exists
    if (document.getElementById('signup-popup-floating-btn')) {
      return;
    }

    var btn = document.createElement('button');
    btn.id = 'signup-popup-floating-btn';
    btn.className = 'signup-popup-floating-btn';
    btn.innerHTML = '<span style="font-size: 28px;">✨</span>';
    btn.setAttribute('aria-label', 'Open signup discount offer');
    btn.onclick = function() {
      show();
    };

    document.body.appendChild(btn);
  }

  /**
   * Hide floating button
   */
  function hideFloatingButton() {
    var btn = document.getElementById('signup-popup-floating-btn');
    if (btn) {
      btn.classList.add('hidden');
      setTimeout(function() {
        if (btn.parentNode) {
          btn.parentNode.removeChild(btn);
        }
      }, 300);
    }
  }

  /**
   * Show the popup
   */
  function show() {
    if (state.popupShown) return;
    if (shouldSuppress()) return;   // signed up via popup OR known via chatbot

    console.info('[NT discount-popup] showing — no suppression flag was set');

    state.popupShown = true;
    recordShown();               // stamp the time so the 4-min timer resets

    // Hide floating button when popup opens
    hideFloatingButton();

    var container = document.createElement('div');
    container.id = 'signup-popup-wrapper';
    container.innerHTML = createPopupHTML();

    document.body.appendChild(container);

    // Event listeners
    var closeBtn = document.querySelector('.popup-close-btn');
    var backdrop = document.querySelector('.signup-popup-backdrop');
    var signupBtn = document.querySelector('.signup-google-btn');

    closeBtn.addEventListener('click', close);
    backdrop.addEventListener('click', close);
    signupBtn.addEventListener('click', handleSignup);

    // Prevent body scroll when popup is shown
    document.body.style.overflow = 'hidden';
  }

  /**
   * Close the popup
   */
  function close() {
    if (!state.popupShown) return;

    state.popupShown = false;

    var wrapper = document.getElementById('signup-popup-wrapper');
    if (wrapper) {
      wrapper.style.opacity = '0';
      wrapper.style.transition = 'opacity 0.3s ease';

      setTimeout(function () {
        wrapper.remove();
        document.body.style.overflow = '';

        if (!state.popupShown && !shouldSuppress()) {
          createFloatingButton();
        }
      }, 300);
    }
  }

  /**
   * Handle signup button click - Initialize Google Sign-In
   */
  function handleSignup() {
    if (!CONFIG.googleClientId) {
      alert('Google Client ID not configured. Check your .env file and run: npm run config');
      return;
    }

    if (!state.googleLibraryLoaded) {
      loadGoogleLibrary(function () {
        triggerGoogleSignIn();
      });
    } else {
      triggerGoogleSignIn();
    }
  }

  /**
   * Load Google Identity Services library
   */
  function loadGoogleLibrary(callback) {
    if (window.google && window.google.accounts) {
      state.googleLibraryLoaded = true;
      if (callback) callback();
      return;
    }

    var script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = function () {
      state.googleLibraryLoaded = true;
      if (callback) callback();
    };
    script.onerror = function () {};
    document.head.appendChild(script);
  }

  /**
   * Trigger Google Sign-In flow
   */
  function triggerGoogleSignIn() {
    if (!window.google || !window.google.accounts) {
      return;
    }

    google.accounts.id.initialize({
      client_id: CONFIG.googleClientId,
      callback: handleGoogleResponse
    });

    google.accounts.id.renderButton(
      document.getElementById('google-signin-button'),
      {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        width: '100%'
      }
    );

    setTimeout(function() {
      var button = document.getElementById('google-signin-button').querySelector('div[role="button"]');
      if (button) {
        button.click();
      }
    }, 100);
  }

  /**
   * Show Google Sign-In popup for manual authentication
   */
  function showGoogleSignInPopup() {
    var width = 500;
    var height = 600;
    var left = (screen.width - width) / 2;
    var top = (screen.height - height) / 2;
    var windowSpecs = 'width=' + width + ',height=' + height + ',left=' + left + ',top=' + top + ',resizable=yes,scrollbars=yes';
    
    var googleAuthUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' +
      'client_id=' + encodeURIComponent(CONFIG.googleClientId) +
      '&redirect_uri=' + encodeURIComponent(window.location.href) +
      '&response_type=token' +
      '&scope=openid profile email' +
      '&state=' + Math.random().toString(36).substr(2, 9);
    
    window.open(googleAuthUrl, 'google-signin', windowSpecs);
  }

  /**
   * Handle Google Sign-In response.
   *
   * Two side effects, in order:
   *   1. SINGLE SOURCE OF TRUTH — write the Google identity (name, email,
   *      email_verified) into NTVisitorProfile so the chatbot, activity-emailer,
   *      and every other module reads the same lead. Without this, a visitor
   *      who signs up via THIS popup would still appear anonymous to the
   *      chatbot, leading to duplicate-asking.
   *   2. Fire the signup notification email to the team.
   *
   * `markSignedUp()` then sets the local `nt_signed_up` flag and the
   * popup-internal `shouldSuppress()` already covers the case where a
   * profile exists — so all future page loads keep the popup hidden.
   */
  function handleGoogleResponse(response) {
    if (response.credential) {
      try {
        var profile = decodeJWT(response.credential);

        // 1. Persist into the shared NTVisitorProfile so the chatbot et al.
        //    recognise this visitor on subsequent interactions.
        if (window.NTVisitorProfile && typeof window.NTVisitorProfile.update === 'function') {
          window.NTVisitorProfile.update({
            name:           profile.name  || '',
            email:          profile.email || '',
            email_verified: !!profile.email_verified
          });
        }

        // 2. Notify the team via mailer.
        sendSignupMail(profile);
      } catch (e) {}
    }

    // Permanently suppress the popup — user has signed up.
    markSignedUp();
    hideFloatingButton();
    close();
  }

  /**
   * Build email HTML for a new signup
   */
  function buildSignupEmailHtml(profile) {
    var name = (profile && profile.name) || '(not provided)';
    var email = (profile && profile.email) || '(not provided)';
    var picture = (profile && profile.picture) || '';
    var verified = profile && profile.email_verified ? 'Yes' : 'No';
    var locale = (profile && profile.locale) || '—';
    var when = new Date().toISOString();

    var pictureBlock = picture
      ? '<img src="' + picture + '" alt="Profile" width="72" height="72" ' +
        'style="border-radius:50%;border:2px solid #4a6bb3;" />'
      : '';

    return '' +
      '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;' +
      'border:1px solid #e6e8eb;border-radius:10px;overflow:hidden;">' +
        '<div style="background:linear-gradient(135deg,#4a6bb3 0%,#2f5597 100%);' +
        'color:#fff;padding:20px 24px;">' +
          '<h2 style="margin:0;font-size:20px;">New Google Sign-up</h2>' +
          '<p style="margin:4px 0 0;font-size:13px;opacity:.9;">' +
            'Navlakha Technologies — Landing Page' +
          '</p>' +
        '</div>' +
        '<div style="padding:24px;background:#fff;">' +
          '<div style="display:flex;align-items:center;gap:16px;margin-bottom:18px;">' +
            pictureBlock +
            '<div>' +
              '<div style="font-size:17px;font-weight:600;color:#1f2d3d;">' +
                escapeHtml(name) +
              '</div>' +
              '<div style="font-size:14px;color:#4a6bb3;">' +
                escapeHtml(email) +
              '</div>' +
            '</div>' +
          '</div>' +
          '<table style="width:100%;font-size:14px;color:#333;border-collapse:collapse;">' +
            '<tr><td style="padding:6px 0;color:#6c757d;width:140px;">Email verified</td>' +
              '<td>' + verified + '</td></tr>' +
            '<tr><td style="padding:6px 0;color:#6c757d;">Locale</td>' +
              '<td>' + escapeHtml(locale) + '</td></tr>' +
            '<tr><td style="padding:6px 0;color:#6c757d;">Signed up at</td>' +
              '<td>' + when + '</td></tr>' +
            '<tr><td style="padding:6px 0;color:#6c757d;">Source URL</td>' +
              '<td>' + escapeHtml(window.location.href) + '</td></tr>' +
          '</table>' +
        '</div>' +
      '</div>';
  }

  /**
   * Send signup notification to support inbox via the mailer endpoint
   */
  function sendSignupMail(profile) {
    if (!CONFIG.mailerUrl || !CONFIG.mailerSecretKey) {
      return;
    }

    var name = (profile && profile.name) || 'Unknown user';
    var payload = {
      subject: 'New Google sign-up: ' + name,
      content: buildSignupEmailHtml(profile),
      to_email: CONFIG.supportEmail,
      email_secret_key: CONFIG.mailerSecretKey
    };

    try {
      fetch(CONFIG.mailerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(function () {});
    } catch (e) {}
  }

  /**
   * Minimal HTML escape for user-supplied fields
   */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Decode JWT token (for client-side reading, server should verify)
   */
  function decodeJWT(token) {
    var base64Url = token.split('.')[1];
    var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    var jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join('')
    );
    return JSON.parse(jsonPayload);
  }

  /**
   * Initialize the popup
   *
   * Accepts either a config object { googleClientId, mailerUrl, mailerSecretKey, supportEmail }
   * or a bare client-id string for backwards compatibility.
   */
  function init(configOrClientId) {
    if (state.initialized) return;

    state.initialized = true;

    if (typeof configOrClientId === 'string') {
      CONFIG.googleClientId = configOrClientId;
    } else if (configOrClientId && typeof configOrClientId === 'object') {
      if (configOrClientId.googleClientId) CONFIG.googleClientId = configOrClientId.googleClientId;
      if (configOrClientId.mailerUrl) CONFIG.mailerUrl = configOrClientId.mailerUrl;
      if (configOrClientId.mailerSecretKey) CONFIG.mailerSecretKey = configOrClientId.mailerSecretKey;
      if (configOrClientId.supportEmail) CONFIG.supportEmail = configOrClientId.supportEmail;
      // Pull popup timings from AppConfig.signupPopup so the delay /
      // repeat interval are tunable from lib/custom/js/config.js without
      // touching this file.
      if (configOrClientId.signupPopup) {
        if (typeof configOrClientId.signupPopup.delayMs === 'number')          CONFIG.delayMs = configOrClientId.signupPopup.delayMs;
        if (typeof configOrClientId.signupPopup.repeatIntervalMs === 'number') CONFIG.repeatIntervalMs = configOrClientId.signupPopup.repeatIntervalMs;
      }
    }

    // Already signed up OR chatbot has the contact info — never show.
    if (shouldSuppress()) return;

    injectStyles();

    var waitMs = calcWaitMs();
    // waitMs === -1 is a safety net (already covered above, but belt-and-suspenders)
    if (waitMs < 0) return;

    console.info('[NT discount-popup] init scheduled show in', waitMs, 'ms');

    setTimeout(function () {
      // Re-check right before showing in case another tab signed up or
      // completed the chatbot meanwhile.
      if (shouldSuppress()) return;
      show();
    }, waitMs);
  }

  /**
   * Public API
   */
  return {
    init: init,
    show: show,
    close: close
  };
})();
