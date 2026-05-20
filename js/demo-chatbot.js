/**
 * Navlakha Technologies — bottom-right demo chatbot.
 *
 * Flow is fully driven by the `STEPS` array below. Each step sends an email
 * in the background using `STEP_META` for the icon + display label; later
 * emails include earlier data, and the final stage adds a ✅ COMPLETE tag.
 * To reorder, rename, or add a step, edit `STEPS` and `STEP_META` — nothing
 * else hardcodes a step number.
 *
 * Submit triggers: Enter key, or click on the primary button for each step.
 * State persisted to sessionStorage so closing/reopening resumes mid-flow.
 *
 * Pushes dataLayer events:
 *   chat_open, chat_step_complete (with step name), lead_submit, lead_success.
 */
(function () {
  'use strict';

  if (window.__ntChatbotMounted) return;
  window.__ntChatbotMounted = true;

  var STORAGE_KEY = 'nt_chat_state_v1';
  var WA_NUMBER = '918275269688';

  var STEPS = ['phone', 'interests', 'team_size', 'mail', 'name', 'requirements'];
  var TOTAL_STEPS = STEPS.length;

  /**
   * Per-step metadata.
   *   - icon  : emoji used in the email subject line
   *   - label : short text used in the email subject line
   *   - send_mail : if true, sendStageEmail() fires a backend email at this
   *                 step. If false/missing, the step is silent (state is
   *                 still saved and profile is still updated).
   */
  var STEP_META = {
    // Phone is the ignition — the moment we have it, the profile is "live"
    // and the first email goes out. Every subsequent step is an UPDATE email
    // carrying the full profile snapshot. Toggle send_mail off here only if
    // you want that step to be silent.
    phone:        { icon: '📞', label: 'phone',        send_mail: true },
    interests:    { icon: '🎯', label: 'interests',    send_mail: true },
    team_size:    { icon: '👥', label: 'team size',    send_mail: true },
    mail:         { icon: '✉️', label: 'email',        send_mail: true },
    name:         { icon: '👤', label: 'name',         send_mail: true },
    requirements: { icon: '📝', label: 'requirements', send_mail: true }
  };

  function stepNumberOf(stepName) { return STEPS.indexOf(stepName) + 1; }
  function isFinalStage(stageNum) { return stageNum === STEPS.length; }

  var INTERESTS = [
    { key: 'attendance_payroll', label: 'Attendance & Payroll (HRMS)' },
    { key: 'erp',                label: 'ERP Suite' },
    { key: 'inventory',          label: 'Store & Inventory' },
    { key: 'crm',                label: 'Sales Tracking & CRM' },
    { key: 'custom',             label: 'Custom Software' },
    { key: 'visitor_mgmt',       label: 'Visitor Management' },
    { key: 'safechat',           label: 'Privacy Chatbox' }
  ];

  var TEAM_SIZES = ['1 – 10', '11 – 50', '51 – 200', '201 – 1,000', '1,000+'];

  /** Returns the interest key for the current page, or null. */
  function detectProductInterest() {
    if (window.NTProfile && typeof window.NTProfile.getCurrentProduct === 'function') {
      return window.NTProfile.getCurrentProduct();
    }
    return null;
  }

  function getProfile() {
    return (window.NTProfile && typeof window.NTProfile.get === 'function')
      ? window.NTProfile.get() : null;
  }

  function initialState() {
    return {
      open: false,
      step: 0,
      stageEmailed: 0,
      resetCount: 0,
      autoTaggedFrom: null,
      data: {
        phone: '', interests: [], team_size: '',
        email: '', email_verified: false,
        name: '', requirements: ''
      },
      messages: []
    };
  }

  /**
   * Pre-fill the chat with everything we already know about the visitor:
   *   1. Every product page they've ever visited (from NTProfile) becomes
   *      a pre-ticked interest.
   *   2. The current page (if a product) is also pre-ticked and noted as
   *      the auto-tag source so the bot can mention it by name.
   *   3. If they've completed the chat before, name/phone/team_size are
   *      pre-filled (returning-visitor experience).
   *
   * Runs every chat init AND on reset so a visitor who browses /hrms then
   * /erp sees both ticked, even mid-session.
   */
  function applyProfileToState() {
    if (!state) return;
    var profile = getProfile();

    if (profile) {
      if (!state.data.phone        && profile.phone)        state.data.phone        = profile.phone;
      if (!state.data.name         && profile.name)         state.data.name         = profile.name;
      if (!state.data.team_size    && profile.team_size)    state.data.team_size    = profile.team_size;
      if (!state.data.requirements && profile.requirements) state.data.requirements = profile.requirements;
      if (!state.data.email        && profile.email)        state.data.email        = profile.email;
      if (!state.data.email_verified && profile.email_verified) state.data.email_verified = true;
    }

    // Only seed interests once per chat session — once the user has picked
    // anything in chat, don't override their selection on later page visits.
    if (state.autoTaggedFrom || (state.data.interests && state.data.interests.length > 0)) {
      return;
    }

    var currentKey = detectProductInterest();
    var preTick;
    if (profile && profile.interests_owned_by_user) {
      // User has explicitly chosen via the chat — pre-tick exactly their
      // last submission. Don't add the current page back in (they may have
      // intentionally unticked it).
      preTick = (profile.interests || []).slice();
    } else {
      // Fresh / auto-tracked path: union prior visited products + current page.
      preTick = (profile && profile.interests) ? profile.interests.slice() : [];
      if (currentKey && preTick.indexOf(currentKey) === -1) preTick.push(currentKey);
    }

    if (preTick.length === 0) return;
    state.data.interests = preTick;
    state.autoTaggedFrom = currentKey || preTick[0];
    saveState();
  }

  var state = loadState() || initialState();
  if (state.resetCount == null) state.resetCount = 0;
  if (typeof state.autoTaggedFrom === 'undefined') state.autoTaggedFrom = null;
  applyProfileToState();

  var dom = {};

  function saveState() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function loadState() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  /**
   * Inject a <link> to the external chatbot stylesheet.
   * The path is resolved relative to the current page, matching how the rest
   * of the site references lib/custom/css/*.
   */
  function injectStyles() {
    if (document.getElementById('nt-chat-styles')) return;
    var link = document.createElement('link');
    link.id = 'nt-chat-styles';
    link.rel = 'stylesheet';
    link.href = 'lib/custom/css/chatbot.css';
    document.head.appendChild(link);
  }

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    if (children) [].concat(children).forEach(function (c) {
      if (c == null) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }

  function mount() {
    injectStyles();
    var root = document.getElementById('nt-chatbot-root') || document.body;

    dom.launcher = el('button', {
      class: 'nt-chat-launcher',
      'aria-label': 'Open chat to book a free demo',
      type: 'button',
      onclick: open
    }, [
      el('span', { class: 'nt-chat-launcher-ico', 'aria-hidden': 'true' }, [
        el('i', { class: 'fa fa-comments' })
      ]),
      el('span', { class: 'nt-chat-launcher-text' }, [
        el('span', { class: 'nt-chat-launcher-title' }, 'Chat with us'),
        el('span', { class: 'nt-chat-launcher-sub' }, 'Book a free demo')
      ])
    ]);

    root.appendChild(dom.launcher);

    if (state.open) renderPanel();
  }

  function open() {
    state.open = true;
    saveState();
    pushEvent('chat_open');
    if (window.NTProfile && window.NTProfile.bumpChatOpenCount) {
      window.NTProfile.bumpChatOpenCount();
    }
    renderPanel();
  }

  function close() {
    state.open = false;
    saveState();
    var panel = dom.panel;
    dom.panel = null;
    if (!panel || !panel.parentNode) return;

    panel.classList.add('is-leaving');
    var removed = false;
    var remove = function () {
      if (removed) return;
      removed = true;
      if (panel.parentNode) panel.parentNode.removeChild(panel);
    };
    panel.addEventListener('animationend', remove, { once: true });
    // Safety fallback if reduced-motion / animation suppressed / event never fires.
    setTimeout(remove, 400);
  }

  function hasProgress() {
    var d = state.data || {};
    return Boolean(d.phone || (d.interests && d.interests.length) ||
                   d.team_size || d.requirements || d.name);
  }

  function askReset() {
    if (!hasProgress()) { resetChat(); return; }

    // Avoid stacking multiple confirm cards.
    var existing = dom.body && dom.body.querySelector('.nt-chat-confirm');
    if (existing) { existing.scrollIntoView({ block: 'nearest' }); return; }

    var card = el('div', { class: 'nt-chat-confirm', role: 'alertdialog' }, [
      el('p', null, 'Start over? You will lose your current progress in this chat.'),
      el('div', { class: 'actions' }, [
        el('button', {
          class: 'yes', type: 'button',
          onclick: function () {
            if (card.parentNode) card.parentNode.removeChild(card);
            resetChat();
          }
        }, 'Yes, restart'),
        el('button', {
          class: 'no', type: 'button',
          onclick: function () { if (card.parentNode) card.parentNode.removeChild(card); }
        }, 'Cancel')
      ])
    ]);
    dom.body.appendChild(card);
    scrollBodyToBottom();
  }

  function resetChat() {
    var keepResetCount = (state.resetCount || 0) + 1;
    state = initialState();
    state.open = true;
    state.resetCount = keepResetCount;
    applyProfileToState();
    saveState();
    pushEvent('chat_reset', { reset_count: keepResetCount });
    renderPanel();
  }

  function renderPanel() {
    if (dom.panel && dom.panel.parentNode) dom.panel.parentNode.removeChild(dom.panel);

    dom.panel = el('div', { class: 'nt-chat-panel', role: 'dialog', 'aria-label': 'Demo chat' });

    // Stop clicks on header action buttons from bubbling to the header itself
    // (which is wired to minimize the chat).
    var stopAndCall = function (fn) {
      return function (e) { e.stopPropagation(); fn(); };
    };

    var resetBtnAttrs = {
      class: 'nt-chat-head-btn', type: 'button',
      'aria-label': 'Start over', title: 'Start over',
      onclick: stopAndCall(askReset)
    };

    var head = el('div', {
      class: 'nt-chat-head', role: 'button', tabindex: '0',
      'aria-label': 'Minimize chat', title: 'Click to minimize',
      onclick: close,
      onkeydown: function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); close(); }
      }
    }, [
      el('div', { class: 'nt-chat-head-avatar' }, 'NT'),
      el('div', { class: 'nt-chat-head-text' }, [
        el('p', { class: 'nt-chat-head-title' }, 'Navlakha Technologies'),
        el('p', { class: 'nt-chat-head-sub' }, 'Online — replies in ~5 min')
      ]),
      el('div', { class: 'nt-chat-head-actions' }, [
        el('button', resetBtnAttrs, [el('i', { class: 'fa fa-refresh', 'aria-hidden': 'true' })]),
        el('button', {
          class: 'nt-chat-head-btn close', type: 'button',
          'aria-label': 'Close chat', onclick: stopAndCall(close)
        }, '×')
      ])
    ]);

    dom.body = el('div', { class: 'nt-chat-body' });
    dom.foot = el('div', { class: 'nt-chat-foot' });

    dom.panel.appendChild(head);
    dom.panel.appendChild(dom.body);
    dom.panel.appendChild(dom.foot);
    (document.getElementById('nt-chatbot-root') || document.body).appendChild(dom.panel);

    state.messages.forEach(function (m) { renderMessage(m.who, m.text, false); });

    if (state.messages.length === 0) {
      var profile = getProfile();
      var firstName = profile && profile.name ? profile.name.split(' ')[0] : '';
      if (firstName) {
        sayBot('Welcome back, ' + firstName + '! 👋');
      } else {
        sayBot("Hi! I'm here to set up your free demo — should take under a minute.");
      }
      if (profile && profile.phone) {
        sayBot("Confirm the phone number we have, or update it below.");
      } else {
        sayBot("What's your phone or WhatsApp number? We'll reach out within an hour.");
      }
    }
    renderStep();
  }

  function renderMessage(who, text, animate) {
    var node = el('div', { class: 'nt-chat-msg ' + who }, text);
    if (!animate) node.style.animation = 'none';
    dom.body.appendChild(node);
    scrollBodyToBottom();
  }

  function sayBot(text) {
    state.messages.push({ who: 'bot', text: text });
    renderMessage('bot', text, true);
    saveState();
  }

  function sayUser(text) {
    state.messages.push({ who: 'user', text: text });
    renderMessage('user', text, true);
    saveState();
  }

  function clearFoot() { dom.foot.innerHTML = ''; }

  /**
   * Anchor the chat body to the latest message. Wrapped in rAF so the browser
   * has a chance to lay out any just-mounted footer controls (chip rows,
   * quick-replies, textareas) before we measure scrollHeight — otherwise the
   * bot's question gets hidden under a footer that grew after the scroll.
   */
  function scrollBodyToBottom() {
    if (!dom.body) return;
    var go = function () { dom.body.scrollTop = dom.body.scrollHeight; };
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(function () { requestAnimationFrame(go); });
    } else {
      setTimeout(go, 16);
    }
  }

  function renderStep() {
    clearFoot();
    var stepName = STEPS[state.step];
    if (!stepName) { renderSuccess(); scrollBodyToBottom(); return; }

    if (stepName === 'phone')             renderPhoneStep();
    else if (stepName === 'interests')    renderInterestsStep();
    else if (stepName === 'team_size')    renderTeamSizeStep();
    else if (stepName === 'mail')         renderMailStep();
    else if (stepName === 'requirements') renderRequirementsStep();
    else if (stepName === 'name')         renderNameStep();

    scrollBodyToBottom();
  }

  /* ---------- Step: phone ------------------------------------------------ */
  function renderPhoneStep() {
    var input = el('input', {
      class: 'nt-chat-input', type: 'tel', inputmode: 'numeric',
      autocomplete: 'tel', placeholder: '+91 98765 43210',
      'aria-label': 'Phone or WhatsApp number'
    });
    input.value = state.data.phone || '';

    var errBox = el('div', { class: 'nt-chat-error' });

    var submit = function () {
      var v = (input.value || '').trim();
      if (v.replace(/\D/g, '').length < 7) {
        errBox.textContent = 'Please enter a valid phone number.';
        input.focus();
        return;
      }
      errBox.textContent = '';
      state.data.phone = v;
      sayUser(v);
      advance('phone');
    };

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
    });

    var btn = el('button', {
      class: 'nt-chat-send', type: 'button', onclick: submit
    }, [el('i', { class: 'fa fa-paper-plane', 'aria-hidden': 'true' }), ' Send']);

    dom.foot.appendChild(el('div', { class: 'nt-chat-input-row' }, [input, btn]));
    dom.foot.appendChild(errBox);
    setTimeout(function () { input.focus(); }, 60);
  }

  /* ---------- Step: interests (multi-select) ----------------------------- */
  function renderInterestsStep() {
    // `selected` is the live, editable working copy. Whatever's in here when
    // the user clicks Continue replaces state.data.interests entirely — so an
    // unticked auto-tag stays unticked.
    var selected = (state.data.interests || []).slice();
    var chips = el('div', { class: 'nt-chat-chips' });

    INTERESTS.forEach(function (item) {
      var isSel = selected.indexOf(item.key) !== -1;
      var chip = el('button', {
        type: 'button',
        class: 'nt-chat-chip' + (isSel ? ' selected' : ''),
        'data-key': item.key
      }, item.label);
      chip.addEventListener('click', function () {
        var k = item.key, i = selected.indexOf(k);
        if (i === -1) { selected.push(k); chip.classList.add('selected'); }
        else          { selected.splice(i, 1); chip.classList.remove('selected'); }
      });
      chips.appendChild(chip);
    });

    var confirmBtn = el('button', {
      class: 'nt-chat-send', type: 'button',
      onclick: function () {
        // Respect the user's final selection verbatim — including an empty
        // set if they intentionally unticked everything.
        state.data.interests = selected;

        // If they removed the auto-tagged chip, the "I noticed you're on
        // the X page" framing no longer applies — clear the marker so any
        // downstream code (emails, future steps) stops referencing it.
        if (state.autoTaggedFrom && selected.indexOf(state.autoTaggedFrom) === -1) {
          state.autoTaggedFrom = null;
        }

        // Persist this as a deliberate user choice — replaces the profile's
        // `interests` array verbatim and prevents future page visits from
        // re-appending unticked products via auto-tracking.
        if (window.NTProfile && window.NTProfile.setInterests) {
          window.NTProfile.setInterests(selected);
        }

        var labels = INTERESTS
          .filter(function (i) { return selected.indexOf(i.key) !== -1; })
          .map(function (i) { return i.label; }).join(', ');
        sayUser(labels || '(no specific product — just exploring)');
        advance('interests');
      }
    }, 'Continue →');

    dom.foot.appendChild(chips);
    dom.foot.appendChild(el('div', { style: 'margin-top:10px;display:flex;justify-content:flex-end;' }, [confirmBtn]));
  }

  /* ---------- Step: team size (quick replies) ---------------------------- */
  function renderTeamSizeStep() {
    var quick = el('div', { class: 'nt-chat-quick' });
    TEAM_SIZES.forEach(function (size) {
      var btn = el('button', { class: 'nt-chat-quick-btn', type: 'button' }, size);
      btn.addEventListener('click', function () {
        state.data.team_size = size;
        sayUser(size);
        advance('team_size');
      });
      quick.appendChild(btn);
    });
    dom.foot.appendChild(quick);
  }

  /* ---------- Step: email (manual input + Google sign-in) ----------------- */

  // Minimal JWT decoder for the Google credential — same approach the
  // signup-popup uses. Server-side libraries should verify the signature;
  // we only need the email claim for routing.
  function decodeJwt(token) {
    try {
      var part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      var json = decodeURIComponent(atob(part).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(json);
    } catch (e) { return null; }
  }

  function ensureGoogleLibrary(cb) {
    if (window.google && window.google.accounts && window.google.accounts.id) {
      cb(); return;
    }
    var existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', cb, { once: true });
      return;
    }
    var s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = cb;
    s.onerror = function () { /* swallow — manual input still works */ };
    document.head.appendChild(s);
  }

  function looksLikeEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  function renderMailStep() {
    var input = el('input', {
      class: 'nt-chat-input', type: 'email', autocomplete: 'email',
      placeholder: 'you@company.com', 'aria-label': 'Email address'
    });
    input.value = state.data.email || '';

    var errBox = el('div', { class: 'nt-chat-error' });

    var submitManual = function () {
      var v = (input.value || '').trim();
      if (!looksLikeEmail(v)) {
        errBox.textContent = 'Please enter a valid email address.';
        input.focus();
        return;
      }
      errBox.textContent = '';
      state.data.email = v;
      state.data.email_verified = false;
      sayUser(v);
      advance('mail');
    };

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); submitManual(); }
    });

    var sendBtn = el('button', {
      class: 'nt-chat-send', type: 'button', onclick: submitManual
    }, [el('i', { class: 'fa fa-paper-plane', 'aria-hidden': 'true' }), ' Send']);

    var divider = el('div', { class: 'nt-chat-divider' }, [
      el('span', null, 'or')
    ]);

    // Placeholder for Google's official rendered button — must have a real
    // DOM id because google.accounts.id.renderButton resolves by id.
    var googleSlot = el('div', { class: 'nt-chat-google-slot', id: 'nt-chat-google-slot' });

    // Fallback button shown until the Google library has rendered its own.
    // Once GIS renders, the placeholder text is replaced with the real button.
    googleSlot.textContent = 'Loading Google sign-in…';

    dom.foot.appendChild(el('div', { class: 'nt-chat-input-row' }, [input, sendBtn]));
    dom.foot.appendChild(errBox);
    dom.foot.appendChild(divider);
    dom.foot.appendChild(googleSlot);

    setTimeout(function () { input.focus(); }, 60);

    initGoogleSlot(googleSlot);
  }

  function initGoogleSlot(slot) {
    var cfg = window.AppConfig || {};
    if (!cfg.googleClientId) {
      slot.textContent = 'Google sign-in unavailable (missing client ID).';
      slot.classList.add('is-unavailable');
      return;
    }

    ensureGoogleLibrary(function () {
      if (!window.google || !window.google.accounts || !window.google.accounts.id) {
        slot.textContent = 'Google sign-in unavailable.';
        slot.classList.add('is-unavailable');
        return;
      }
      try {
        google.accounts.id.initialize({
          client_id: cfg.googleClientId,
          callback: function (response) { onGoogleCredential(response); },
          ux_mode: 'popup',
          auto_select: false,
          context: 'signin'
        });
        slot.textContent = '';
        google.accounts.id.renderButton(slot, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          logo_alignment: 'left',
          width: 280
        });
      } catch (e) {
        slot.textContent = 'Google sign-in unavailable.';
        slot.classList.add('is-unavailable');
      }
    });
  }

  function onGoogleCredential(response) {
    if (!response || !response.credential) return;
    var claims = decodeJwt(response.credential);
    if (!claims || !claims.email) return;

    state.data.email = claims.email;
    state.data.email_verified = true;

    // Free-bonus capture: if Google has the user's name and we don't yet,
    // backfill it. Saves them retyping later.
    if (claims.name && !state.data.name) state.data.name = claims.name;

    sayUser(claims.email + ' ✓ verified');
    advance('mail');
  }

  /* ---------- Step: requirements (free text, skippable) ------------------ */
  function renderRequirementsStep() {
    var ta = el('textarea', {
      class: 'nt-chat-textarea', rows: '2',
      placeholder: 'e.g. 220 employees across 3 plants, payroll currently in Excel…',
      'aria-label': 'Specific requirements'
    });
    ta.value = state.data.requirements || '';

    var submit = function () {
      var v = (ta.value || '').trim();
      state.data.requirements = v;
      sayUser(v || '(skipped)');
      advance('requirements');
    };

    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
    });

    var send = el('button', {
      class: 'nt-chat-send', type: 'button', onclick: submit
    }, [el('i', { class: 'fa fa-paper-plane', 'aria-hidden': 'true' }), ' Send']);

    var skip = el('button', {
      class: 'nt-chat-skip', type: 'button',
      onclick: function () { state.data.requirements = ''; sayUser('(skipped)'); advance('requirements'); }
    }, 'Skip');

    dom.foot.appendChild(el('div', { class: 'nt-chat-input-row' }, [ta, send]));
    dom.foot.appendChild(el('div', { style: 'text-align:right;' }, [skip]));
    setTimeout(function () { ta.focus(); }, 60);
  }

  /* ---------- Step: name ------------------------------------------------- */
  function renderNameStep() {
    var input = el('input', {
      class: 'nt-chat-input', type: 'text', autocomplete: 'name',
      placeholder: 'Your name', 'aria-label': 'Your name'
    });
    input.value = state.data.name || '';

    var submit = function () {
      var v = (input.value || '').trim();
      if (!v) { input.focus(); return; }
      state.data.name = v;
      sayUser(v);
      advance('name');
    };

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
    });

    var btn = el('button', { class: 'nt-chat-send', type: 'button', onclick: submit },
      [el('i', { class: 'fa fa-paper-plane', 'aria-hidden': 'true' }), ' Send']);

    dom.foot.appendChild(el('div', { class: 'nt-chat-input-row' }, [input, btn]));
    setTimeout(function () { input.focus(); }, 60);
  }

  /* ---------- Step → email → advance --------------------------------------- */
  function advance(stepName) {
    var stepNum = stepNumberOf(stepName);
    pushEvent('chat_step_complete', { step: stepName, step_number: stepNum });

    sendStageEmail(stepNum, stepName);
    state.step = stepNum;
    saveState();

    showTyping();
    setTimeout(function () {
      hideTyping();
      var nextStep = STEPS[state.step];
      if (nextStep === 'interests') {
        var taggedItem = state.autoTaggedFrom
          ? INTERESTS.filter(function (x) { return x.key === state.autoTaggedFrom; })[0]
          : null;
        if (taggedItem) {
          sayBot("Got it. I noticed you're looking at " + taggedItem.label +
                 " — picked that for you. Add anything else you're interested in, or untick it.");
        } else {
          sayBot('Got it. Which products are you interested in? (Pick any that apply, or just continue.)');
        }
      }
      else if (nextStep === 'team_size')    sayBot('Thanks! How many employees do you have?');
      else if (nextStep === 'mail') {
        if (state.data.email && state.data.email_verified) {
          sayBot("We have your verified email (" + state.data.email + "). Sign in again to update, or just type a different one.");
        } else if (state.data.email) {
          sayBot("Drop your email below, or sign in with Google for a verified address.");
        } else {
          sayBot("What's the best email for you? Type it in, or sign in with Google for one-tap verified delivery.");
        }
      }
      else if (nextStep === 'name') {
        var existingName = (state.data.name || '').split(' ')[0];
        sayBot(existingName
          ? ('Almost done — confirm your name is "' + state.data.name + '", or update it below.')
          : 'Almost done — what should we call you?');
      }
      else if (nextStep === 'requirements') sayBot("Last one — anything specific we should know before the demo? (Optional — press Skip if nothing comes to mind.)");
      else                                  sayBot('All set!');
      renderStep();
    }, 600);
  }

  var typingNode = null;
  function showTyping() {
    typingNode = el('div', { class: 'nt-chat-typing', 'aria-label': 'Typing' }, [
      el('span'), el('span'), el('span')
    ]);
    dom.body.appendChild(typingNode);
    scrollBodyToBottom();
  }
  function hideTyping() {
    if (typingNode && typingNode.parentNode) typingNode.parentNode.removeChild(typingNode);
    typingNode = null;
  }

  /* ---------- Success screen ---------------------------------------------- */
  function renderSuccess() {
    clearFoot();
    var firstName = (state.data.name || '').split(' ')[0];
    var greeting = firstName ? ('Thanks, ' + firstName + '!') : 'Thanks!';

    pushEvent('lead_success', {
      form_name: 'chat_demo',
      product_interest: (state.data.interests && state.data.interests[0]) || null,
      user_data: { phone_number: state.data.phone, email: null }
    });

    var box = el('div', { class: 'nt-chat-success' }, [
      el('div', { class: 'nt-chat-success-ico' }, [el('i', { class: 'fa fa-check' })]),
      el('h4', null, greeting + " We've got your details."),
      el('p',  null, "Our team will reach out within one business day. Want to chat now?"),
      el('a', {
        class: 'wa', href: waLink(state.data),
        target: '_blank', rel: 'noopener noreferrer',
        'data-cta-type': 'whatsapp', 'data-cta-location': 'chatbot'
      }, [el('i', { class: 'fa fa-whatsapp' }), 'WhatsApp us now'])
    ]);
    dom.body.appendChild(box);
    scrollBodyToBottom();
  }

  function waLink(d) {
    var interestLabels = (d.interests || []).map(function (k) {
      var item = INTERESTS.filter(function (x) { return x.key === k; })[0];
      return item ? item.label : k;
    }).join(', ');

    var lines = ['Hi! I just submitted my details on navlakha.tech.', ''];
    if (d.name)         lines.push('Name: '         + d.name);
    if (d.phone)        lines.push('Phone: '        + d.phone);
    if (d.email)        lines.push('Email: '        + d.email + (d.email_verified ? ' (verified)' : ''));
    if (interestLabels) lines.push('Interests: '    + interestLabels);
    if (d.team_size)    lines.push('Team size: '    + d.team_size);
    if (d.requirements) lines.push('Requirements: ' + d.requirements);
    lines.push('', 'Looking forward to the demo.');

    return 'https://wa.me/' + WA_NUMBER + '/?text=' + encodeURIComponent(lines.join('\n'));
  }

  /* ---------- Email sending ----------------------------------------------- */
  /** Snapshot the chatbot answers into the persistent NTProfile. */
  function persistToProfile(stageNum) {
    if (!window.NTProfile || !window.NTProfile.update) return;
    window.NTProfile.update({
      phone:        state.data.phone,
      name:         state.data.name,
      team_size:    state.data.team_size,
      requirements: state.data.requirements,
      interests:    state.data.interests,
      email:        state.data.email,
      email_verified: !!state.data.email_verified,
      max_stage_reached: stageNum
    });
  }

  /** Returns interest keys that haven't been emailed to the team yet. */
  function computeNewInterests() {
    if (window.NTProfile && window.NTProfile.getNewInterests) {
      return window.NTProfile.getNewInterests(state.data.interests || []);
    }
    return (state.data.interests || []).slice();
  }

  function labelForInterest(key) {
    var item = INTERESTS.filter(function (x) { return x.key === key; })[0];
    return item ? item.label : key;
  }

  function sendStageEmail(stageNum, stageName) {
    if (stageNum <= state.stageEmailed) return;
    state.stageEmailed = stageNum;
    saveState();

    // Profile is updated even when the step is silent — we always want the
    // latest state on disk so a returning visitor sees their info pre-filled.
    persistToProfile(stageNum);

    // Per-step send_mail gate. Steps without `send_mail: true` complete
    // silently (no network call). State + profile are still persisted above.
    var meta = STEP_META[stageName] || {};
    if (!meta.send_mail) return;

    var cfg = window.AppConfig || {};
    if (!cfg.mailerUrl || !cfg.mailerSecretKey) return;

    var attr = (window.NTAttribution && window.NTAttribution.get) ? window.NTAttribution.get() : null;
    var profile = getProfile();
    var newInterests = stageName === 'interests' ? computeNewInterests() : [];
    var isReturning  = Boolean(profile && (profile.emailed_interests || []).length > 0);

    // Bump the lifetime mail counter BEFORE the network call so the email
    // can include its own sequence number, and so a delivery failure still
    // increments (treating "count" as "attempted").
    var mailNum = (window.NTProfile && window.NTProfile.bumpEmailsSentCount)
      ? window.NTProfile.bumpEmailsSentCount()
      : (stageNum); // graceful fallback

    var subject = subjectFor(stageNum, stageName, state.data, attr, newInterests, isReturning, mailNum);
    var content = buildEmailBody(stageNum, stageName, state.data, attr, newInterests, isReturning, profile, mailNum);
    var recipients = [
      cfg.supportEmail || 'support@navlakha.tech',
      'nnautatva@gmail.com',
      'mahavirnn@gmail.com'
    ];

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

    // After interests email goes out, baseline them in the profile so the
    // next chat session knows what's "already known" vs genuinely new.
    if (stageName === 'interests' && window.NTProfile && window.NTProfile.markInterestsEmailed) {
      window.NTProfile.markInterestsEmailed(state.data.interests || []);
    }

    if (isFinalStage(stageNum)) {
      pushEvent('lead_submit', {
        form_name: 'chat_demo',
        product_interest: (state.data.interests && state.data.interests[0]) || null,
        utm_source:   attr && attr.utm_source   || null,
        utm_medium:   attr && attr.utm_medium   || null,
        utm_campaign: attr && attr.utm_campaign || null,
        gclid:        attr && attr.gclid        || null,
        is_returning: isReturning
      });
    }
  }

  function subjectFor(stageNum, stageName, d, attr, newInterests, isReturning, mailNum) {
    var who = d.name || d.phone || 'partial';
    var src = attr && attr.utm_source ? ' [' + attr.utm_source + ']' : '';
    var meta = STEP_META[stageName] || { icon: '📝', label: stageName };
    var final = isFinalStage(stageNum);
    var icon  = final ? '✅' : meta.icon;
    var label = final ? 'COMPLETE' : meta.label;

    // Annotate the kind of email so the sales person can scan their inbox.
    var qualifier;
    if (mailNum === 1)    qualifier = ' (Profile created)';
    else if (final)       qualifier = '';
    else                  qualifier = ' (UPDATE)';

    var flags = '';
    if (stageName === 'interests' && newInterests && newInterests.length > 0) {
      flags += ' 🆕 NEW: ' + newInterests.map(labelForInterest).join(', ');
    } else if (isReturning && !final) {
      flags += ' 🔁 returning';
    }

    return 'Mail #' + mailNum + ' — ' + icon + ' ' + label + qualifier + flags + ': ' + who + src;
  }

  /**
   * Email body — structured as 5 sections so the sales person can scan top-
   * down without being overwhelmed:
   *   1. LEAD         — name, phone, email (always shown; empty = "—")
   *   2. INTEREST     — chat answers (interests, team size, requirements,
   *                     products viewed/dismissed, previously emailed)
   *   3. ENGAGEMENT   — passive: sessions, page views, scroll, time, top pages
   *   4. SOURCE       — referrer (classified) + UTM + click IDs
   *   5. TECH         — device, browser, OS, viewport, language, timezone,
   *                     connection, hardware, privacy flags
   *   6. META         — mail #, visitor age, stage, full page history
   *
   * Optional rows with no data are skipped within each section (except LEAD,
   * which always shows the three core identity rows). Sections with zero
   * rows after filtering are skipped entirely.
   */
  function buildEmailBody(stageNum, stageName, d, attr, newInterests, isReturning, profile, mailNum) {
    function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

    var newSet = (newInterests || []).reduce(function (m, k) { m[k] = true; return m; }, {});

    /* ------ Pre-built HTML cells (need rich formatting / pills) ---------- */

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

    /* ------ Section builders ----------------------------------------------- */

    // SECTION 1 — LEAD (core identity, always shown; missing = "—")
    var leadSection = {
      title: 'Lead',
      alwaysShow: true,
      rows: [
        ['Name',  d.name  || '—'],
        ['Phone', d.phone || '—'],
        { label: 'Email', html: emailCell || '—' }
      ]
    };

    // SECTION 2 — INTEREST SIGNAL
    var interestRows = [
      { label: 'Interests', html: interestCell || '—' },
      ['Team size',    d.team_size],
      ['Requirements', d.requirements]
    ];
    if (productsViewedCell) {
      interestRows.push({ label: 'Products viewed', html: productsViewedCell });
    }
    if (profile && Array.isArray(profile.emailed_interests) && profile.emailed_interests.length > 0) {
      interestRows.push(['Previously emailed',
        profile.emailed_interests.map(labelForInterest).join(', ')]);
    }
    var interestSection = { title: 'Interest signal', rows: interestRows };

    // SECTION 3 — ENGAGEMENT (passive behaviour)
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

    // SECTION 4 — SOURCE (where they came from)
    var sourceRows = [];
    if (attr) {
      var refType   = attr.landing_referrer_type;
      var refDomain = attr.landing_referrer_domain;
      var refPlat   = attr.landing_referrer_platform;
      var refQuery  = attr.landing_referrer_search_query;
      if (refType === 'direct') {
        sourceRows.push(['Referred from', 'direct (no referrer)']);
      } else if (refType) {
        var parts = [];
        if (refPlat)        parts.push(refPlat);
        else if (refDomain) parts.push(refDomain);
        parts.push('(' + refType + ')');
        if (refQuery)       parts.push('— "' + refQuery + '"');
        sourceRows.push(['Referred from', parts.join(' ')]);
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

    // SECTION 5 — TECH (device, network, hardware)
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
    var techSection = { title: 'Tech context', rows: techRows };

    // SECTION 6 — META (housekeeping)
    var metaRows = [];
    metaRows.push(['Mail #',          mailNum + ' (lifetime count for this lead)']);
    metaRows.push(['Stage reached',   stageNum + ' of ' + STEPS.length + ' — ' + stageName]);
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

    /* ------ Section renderer ---------------------------------------------- */

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

    /* ------ Banner (NEW interest / returning visitor) -------------------- */

    var banner = '';
    if (stageName === 'interests' && newInterests && newInterests.length > 0) {
      banner =
        '<tr><td style="padding:0 28px 14px;">' +
          '<div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:6px;padding:12px 14px;font-size:13px;color:#065f46;">' +
            '<strong>🆕 New interest signalled:</strong> ' +
            esc(newInterests.map(labelForInterest).join(', ')) +
          '</div>' +
        '</td></tr>';
    } else if (isReturning && !isFinalStage(stageNum)) {
      banner =
        '<tr><td style="padding:0 28px 14px;">' +
          '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:12px 14px;font-size:13px;color:#1e40af;">' +
            '<strong>🔁 Returning visitor</strong> — confirming previously-known interests.' +
          '</div>' +
        '</td></tr>';
    } else if (mailNum === 1) {
      banner =
        '<tr><td style="padding:0 28px 14px;">' +
          '<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;padding:12px 14px;font-size:13px;color:#92400e;">' +
            '<strong>📞 Profile created</strong> — first contact in this lead\'s history.' +
          '</div>' +
        '</td></tr>';
    }

    /* ------ Header + envelope -------------------------------------------- */

    var headerLabel = isFinalStage(stageNum)
      ? 'Demo Request — Complete'
      : 'Demo Chat — Mail #' + mailNum;
    var subHeader = 'Stage ' + stageNum + '/' + STEPS.length + ' · ' + stageName;

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

  /* ---------- dataLayer --------------------------------------------------- */
  function pushEvent(name, extra) {
    window.dataLayer = window.dataLayer || [];
    var payload = { event: name, page_path: location.pathname };
    if (extra) Object.keys(extra).forEach(function (k) { payload[k] = extra[k]; });
    window.dataLayer.push(payload);
  }

  /* ---------- Boot -------------------------------------------------------- */
  function boot() {
    if (!document.getElementById('nt-chatbot-root')) {
      var div = document.createElement('div');
      div.id = 'nt-chatbot-root';
      document.body.appendChild(div);
    }
    mount();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
