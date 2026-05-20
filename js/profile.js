/**
 * Persistent visitor profile.
 *
 * Auto-tracks every product page the visitor has ever browsed (localStorage,
 * 365 d TTL). The demo-chatbot reads this to pre-tick interests so a visitor
 * who has hopped between /hrms, /erp and /crm sees all three pre-selected
 * when they finally open the chat.
 *
 * Also stores contact details and interests collected by the chatbot so
 * (a) returning visitors get their phone/name pre-filled, and
 * (b) when the chatbot re-collects interests, anything outside what's
 *     already been emailed is flagged as NEW in the subject + body so
 *     the team can see at a glance that this is an upsell signal,
 *     not a duplicate lead.
 *
 * Exposed via window.NTProfile.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'nt_profile_v1';
  var TTL_MS = 365 * 24 * 60 * 60 * 1000;

  /** filename → interest key (matches demo-chatbot INTERESTS list). */
  var PRODUCT_BY_PAGE = {
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
  };

  function detectCurrentProduct() {
    var page = (location.pathname.split('/').pop() || '').toLowerCase();
    return PRODUCT_BY_PAGE[page] || null;
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || !obj.last_seen) return null;
      if (Date.now() - obj.last_seen > TTL_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return obj;
    } catch (e) { return null; }
  }

  function persist() {
    profile.last_seen = Date.now();
    if (!profile.first_seen) profile.first_seen = Date.now();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); } catch (e) {}
  }

  function blankProfile() {
    return {
      first_seen: Date.now(),
      last_seen:  Date.now(),
      // contact (filled in by chatbot)
      name: '', phone: '', email: '', company: '',
      // true once the email has been confirmed via Google sign-in
      // (i.e. comes from a verified identity provider, not a free-text input)
      email_verified: false,
      team_size: '', requirements: '',
      // interests the visitor has signalled.
      // Two modes:
      //   - interests_owned_by_user === false (default): interests is a union
      //     of visited product pages + anything they tap in the chatbot.
      //     Visiting /erp auto-appends 'erp' here.
      //   - interests_owned_by_user === true: the user has explicitly
      //     submitted via the chat interests step — `interests` is then a
      //     verbatim mirror of their chat selection. New page visits do NOT
      //     re-append to `interests` (they still go to `visited_products`).
      // Flipped to true by NTProfile.setInterests().
      interests: [],
      interests_owned_by_user: false,
      // baseline of interests that have already been sent to the team email.
      // Anything in `interests` but NOT here is flagged as NEW.
      emailed_interests: [],
      // raw page-visit history for context (never reset by chat behaviour)
      visited_products: [],
      visited_pages: [],
      // furthest chat stage ever reached
      max_stage_reached: 0,

      /* ---------- passive context (no user input required) -------------- */
      // Stable device/browser/OS fingerprint captured on first visit.
      // Set by NTProfile.setClientContext() — only writes once.
      client_context: null,
      // Number of distinct sessions (30-min activity window). Bumped on
      // each pageload where Date.now() - last_activity_at > 30 min.
      session_count: 0,
      last_session_at: 0,
      last_activity_at: 0,
      // Total pageviews ever + a capped per-path counter (top entries kept).
      total_page_views: 0,
      page_views_by_path: {},
      // Highest scroll percent ever reached, anywhere on the site (0–100).
      max_scroll_depth: 0,
      // Cumulative milliseconds with the tab visible across all sessions.
      total_time_on_site_ms: 0,
      // Cumulative count of times the chatbot panel was opened.
      chat_open_count: 0,
      // How many emails have been sent to the team about this lead.
      // Bumped by NTProfile.bumpEmailsSentCount() right before each send.
      emails_sent_count: 0
    };
  }

  function dedupePush(arr, v) {
    if (v == null) return arr;
    if (arr.indexOf(v) === -1) arr.push(v);
    return arr;
  }

  var profile = load() || blankProfile();

  // Backfill fields if the stored shape is older.
  ['name', 'phone', 'email', 'company', 'team_size', 'requirements'].forEach(function (k) {
    if (typeof profile[k] !== 'string') profile[k] = '';
  });
  ['interests', 'emailed_interests', 'visited_products', 'visited_pages'].forEach(function (k) {
    if (!Array.isArray(profile[k])) profile[k] = [];
  });
  if (typeof profile.max_stage_reached !== 'number') profile.max_stage_reached = 0;
  if (typeof profile.email_verified !== 'boolean') profile.email_verified = false;
  if (typeof profile.interests_owned_by_user !== 'boolean') profile.interests_owned_by_user = false;

  // Backfill new passive-context fields for older stored profiles.
  if (typeof profile.session_count !== 'number')        profile.session_count = 0;
  if (typeof profile.last_session_at !== 'number')      profile.last_session_at = 0;
  if (typeof profile.last_activity_at !== 'number')     profile.last_activity_at = 0;
  if (typeof profile.total_page_views !== 'number')     profile.total_page_views = 0;
  if (typeof profile.max_scroll_depth !== 'number')     profile.max_scroll_depth = 0;
  if (typeof profile.total_time_on_site_ms !== 'number') profile.total_time_on_site_ms = 0;
  if (typeof profile.chat_open_count !== 'number')      profile.chat_open_count = 0;
  if (typeof profile.emails_sent_count !== 'number')    profile.emails_sent_count = 0;
  if (!profile.page_views_by_path || typeof profile.page_views_by_path !== 'object') profile.page_views_by_path = {};
  if (typeof profile.client_context === 'undefined')    profile.client_context = null;

  /* ---------- record this page visit -------------------------------------- */
  (function trackVisit() {
    var key = detectCurrentProduct();
    if (key) {
      dedupePush(profile.visited_products, key);
      // Visiting a product page is a soft signal of interest, so seed
      // `interests` with it — UNLESS the user has explicitly chosen via
      // the chatbot, in which case their selection is authoritative and
      // we don't want to re-add things they may have intentionally unticked.
      if (!profile.interests_owned_by_user) {
        dedupePush(profile.interests, key);
      }
    }
    var page = location.pathname || '';
    if (page) dedupePush(profile.visited_pages, page);
    persist();
  })();

  /* ---------- public surface --------------------------------------------- */
  window.NTProfile = {
    PRODUCT_BY_PAGE: PRODUCT_BY_PAGE,

    /** Snapshot of the persisted profile (caller-safe copy). */
    get: function () {
      try { return JSON.parse(JSON.stringify(profile)); }
      catch (e) { return Object.assign({}, profile); }
    },

    /** Returns the interest key for the page the visitor is currently on, or null. */
    getCurrentProduct: detectCurrentProduct,

    /** All product-interest keys derived from visited pages. */
    getVisitedProducts: function () { return profile.visited_products.slice(); },

    /** Union of visited products + interests selected via chat. */
    getKnownInterests: function () { return profile.interests.slice(); },

    /** Interests in `current` not yet emailed to the team. */
    getNewInterests: function (current) {
      var emailed = profile.emailed_interests;
      return (current || []).filter(function (k) { return emailed.indexOf(k) === -1; });
    },

    /** Mark interests as having been emailed. Called after a stage email is sent. */
    markInterestsEmailed: function (interests) {
      (interests || []).forEach(function (k) { dedupePush(profile.emailed_interests, k); });
      persist();
    },

    /** Merge contact / chat data into the profile. */
    update: function (patch) {
      if (!patch) return;
      Object.keys(patch).forEach(function (k) {
        var v = patch[k];
        if (k === 'interests' && Array.isArray(v)) {
          // Once the user has explicitly chosen via the chat, their selection
          // is authoritative — silently ignore any merge attempt here. Use
          // setInterests() to update from a deliberate user action.
          if (profile.interests_owned_by_user) return;
          v.forEach(function (it) { dedupePush(profile.interests, it); });
        } else if (k === 'max_stage_reached') {
          if (typeof v === 'number' && v > profile.max_stage_reached) profile.max_stage_reached = v;
        } else if (v !== undefined && v !== null && v !== '') {
          profile[k] = v;
        }
      });
      persist();
    },

    /**
     * Explicit user submission from the chat interests step.
     * Replaces `interests` verbatim (including reducing to an empty set if
     * the user unticked everything) and flips `interests_owned_by_user` so
     * subsequent page visits stop auto-appending.
     */
    setInterests: function (arr) {
      profile.interests = Array.isArray(arr) ? arr.slice() : [];
      profile.interests_owned_by_user = true;
      persist();
    },

    /** True if the chatbot has previously captured contact info. */
    isReturning: function () {
      return Boolean(profile.phone || profile.email || profile.name);
    },

    /* ---------- passive-context helpers ----------------------------- */

    /** Capture the stable device/browser/OS fingerprint exactly once. */
    setClientContext: function (ctx) {
      if (!ctx || profile.client_context) return;
      profile.client_context = ctx;
      persist();
    },

    /**
     * Update the volatile parts of client_context on every pageload
     * (viewport, connection, online state). Stable parts are preserved.
     */
    updateVolatileContext: function (volatile) {
      if (!volatile) return;
      if (!profile.client_context) profile.client_context = {};
      Object.keys(volatile).forEach(function (k) { profile.client_context[k] = volatile[k]; });
      persist();
    },

    /**
     * Treat the current pageload as a new session if more than 30 min
     * have passed since last activity. Returns true if a new session
     * was started, false otherwise.
     */
    bumpSession: function (gapMs) {
      var threshold = typeof gapMs === 'number' ? gapMs : 30 * 60 * 1000;
      var now = Date.now();
      var newSession = !profile.last_activity_at || (now - profile.last_activity_at > threshold);
      if (newSession) {
        profile.session_count += 1;
        profile.last_session_at = now;
      }
      profile.last_activity_at = now;
      persist();
      return newSession;
    },

    /**
     * Record a pageview. Per-path counter is capped at 30 keys to keep
     * localStorage bounded — beyond that, only existing entries increment.
     */
    recordPageView: function (path) {
      profile.total_page_views += 1;
      var key = String(path || location.pathname);
      var map = profile.page_views_by_path;
      if (map[key] || Object.keys(map).length < 30) {
        map[key] = (map[key] || 0) + 1;
      }
      profile.last_activity_at = Date.now();
      persist();
    },

    /** Keep the highest scroll depth ever observed. Ignores lower values. */
    recordScrollDepth: function (percent) {
      var p = Math.max(0, Math.min(100, Math.round(percent || 0)));
      if (p > profile.max_scroll_depth) {
        profile.max_scroll_depth = p;
        persist();
      }
    },

    /** Add visible time (ms) to the running total. */
    addTimeOnSite: function (deltaMs) {
      var d = Math.max(0, Math.floor(deltaMs || 0));
      if (d === 0) return;
      profile.total_time_on_site_ms += d;
      profile.last_activity_at = Date.now();
      persist();
    },

    /** Increment the chat-open counter. */
    bumpChatOpenCount: function () {
      profile.chat_open_count = (profile.chat_open_count || 0) + 1;
      profile.last_activity_at = Date.now();
      persist();
    },

    /**
     * Increment the team-email counter and return the new count. Call this
     * right before firing each email so the email body can report its own
     * sequence number (Mail #N).
     */
    bumpEmailsSentCount: function () {
      profile.emails_sent_count = (profile.emails_sent_count || 0) + 1;
      profile.last_activity_at = Date.now();
      persist();
      return profile.emails_sent_count;
    },

    /** Wipe everything — useful for QA and "Forget me" actions. */
    forget: function () {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      profile = blankProfile();
    }
  };
})();
