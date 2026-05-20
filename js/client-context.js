/**
 * Passive client-context collector.
 *
 * Captures everything we can about the visitor without asking them:
 *   - Browser, OS, device type (from userAgentData + UA regex fallback)
 *   - Screen + viewport + device pixel ratio
 *   - Language(s), timezone, day-of-week, local hour
 *   - Connection effective type, downlink, RTT, save-data flag
 *   - Hardware: cores, memory, touch points, color depth
 *   - Privacy signals: do-not-track, cookies enabled, online state
 *
 * Tracks behavioural signals during the page lifecycle:
 *   - Sessions (gap > 30 min = new session)
 *   - Total + per-path page views
 *   - Max scroll depth (% of document height ever reached)
 *   - Total visible time on site (page visibility API)
 *
 * Everything is persisted into NTProfile via its helper methods.
 * Exposes window.NTClientContext.get() for a live snapshot.
 */
(function () {
  'use strict';

  if (window.__ntClientContextMounted) return;
  window.__ntClientContextMounted = true;

  /* ---------- UA / device fingerprint ------------------------------------ */
  function parseUserAgent(ua) {
    var out = { browser: 'Unknown', browser_version: '', os: 'Unknown', os_version: '', device_type: 'desktop' };
    if (!ua) return out;

    if (/Edg\//.test(ua))                                     { out.browser = 'Edge';    out.browser_version = (/Edg\/([\d.]+)/.exec(ua)    || [])[1] || ''; }
    else if (/OPR\/|Opera/.test(ua))                          { out.browser = 'Opera';   out.browser_version = (/OPR\/([\d.]+)/.exec(ua)    || [])[1] || ''; }
    else if (/SamsungBrowser/.test(ua))                       { out.browser = 'Samsung'; out.browser_version = (/SamsungBrowser\/([\d.]+)/.exec(ua) || [])[1] || ''; }
    else if (/Chrome\//.test(ua))                             { out.browser = 'Chrome';  out.browser_version = (/Chrome\/([\d.]+)/.exec(ua) || [])[1] || ''; }
    else if (/Firefox\//.test(ua))                            { out.browser = 'Firefox'; out.browser_version = (/Firefox\/([\d.]+)/.exec(ua)|| [])[1] || ''; }
    else if (/Safari\//.test(ua))                             { out.browser = 'Safari';  out.browser_version = (/Version\/([\d.]+)/.exec(ua)|| [])[1] || ''; }

    if (/Windows NT/.test(ua))                                { out.os = 'Windows';   out.os_version = (/Windows NT ([\d.]+)/.exec(ua) || [])[1] || ''; }
    else if (/iPhone|iPad|iPod/.test(ua))                     { out.os = 'iOS';       out.os_version = ((/OS ([\d_]+)/.exec(ua) || [])[1] || '').replace(/_/g, '.'); }
    else if (/Mac OS X/.test(ua))                             { out.os = 'macOS';     out.os_version = ((/Mac OS X ([\d_]+)/.exec(ua) || [])[1] || '').replace(/_/g, '.'); }
    else if (/Android/.test(ua))                              { out.os = 'Android';   out.os_version = (/Android ([\d.]+)/.exec(ua)|| [])[1] || ''; }
    else if (/CrOS/.test(ua))                                 { out.os = 'ChromeOS'; }
    else if (/Linux/.test(ua))                                { out.os = 'Linux'; }

    if (/iPad/.test(ua) || /Tablet/.test(ua))                       out.device_type = 'tablet';
    else if (/Android/.test(ua) && !/Mobile/.test(ua))              out.device_type = 'tablet';
    else if (/Mobi|Android|iPhone|iPod|BlackBerry|IEMobile/.test(ua)) out.device_type = 'mobile';

    return out;
  }

  function collectStableContext() {
    var ua = navigator.userAgent || '';
    var parsed = parseUserAgent(ua);

    // Prefer modern userAgentData where available — more reliable than UA regex.
    if (navigator.userAgentData) {
      try {
        var d = navigator.userAgentData;
        if (Array.isArray(d.brands) && d.brands.length) {
          var primary = d.brands.find(function (b) { return /Chrome|Edge|Opera|Firefox|Safari|Samsung/i.test(b.brand); });
          if (primary) {
            parsed.browser = primary.brand.replace(/\s*Browser$/, '');
            parsed.browser_version = primary.version || parsed.browser_version;
          }
        }
        if (d.platform) parsed.os = d.platform;
        if (typeof d.mobile === 'boolean') {
          if (d.mobile && parsed.device_type === 'desktop') parsed.device_type = 'mobile';
        }
      } catch (e) {}
    }

    return {
      browser:         parsed.browser,
      browser_version: parsed.browser_version,
      os:              parsed.os,
      os_version:      parsed.os_version,
      device_type:     parsed.device_type,
      user_agent:      ua,
      language:        navigator.language || null,
      languages:       Array.isArray(navigator.languages) ? navigator.languages.slice(0, 5) : null,
      timezone:        (function () {
        try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch (e) { return null; }
      })(),
      screen: {
        width:        screen.width || null,
        height:       screen.height || null,
        color_depth:  screen.colorDepth || null,
        orientation:  (screen.orientation && screen.orientation.type) || null
      },
      hardware: {
        cores:        navigator.hardwareConcurrency || null,
        memory_gb:    navigator.deviceMemory || null,
        touch_points: navigator.maxTouchPoints || 0,
        max_touch_screen: navigator.maxTouchPoints > 0
      },
      privacy: {
        cookies_enabled:    !!navigator.cookieEnabled,
        do_not_track:       navigator.doNotTrack === '1' || navigator.doNotTrack === 'yes',
        global_privacy_control: !!navigator.globalPrivacyControl
      }
    };
  }

  function collectVolatileContext() {
    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
    var now = new Date();
    return {
      viewport: {
        width:  window.innerWidth || null,
        height: window.innerHeight || null,
        dpr:    window.devicePixelRatio || 1
      },
      connection: conn ? {
        effective_type: conn.effectiveType || null,
        downlink_mbps:  typeof conn.downlink === 'number' ? conn.downlink : null,
        rtt_ms:         typeof conn.rtt === 'number' ? conn.rtt : null,
        save_data:      !!conn.saveData
      } : null,
      online:           typeof navigator.onLine === 'boolean' ? navigator.onLine : null,
      last_seen_local:  now.toString(),
      last_seen_hour:   now.getHours(),
      last_seen_dow:    now.toLocaleDateString('en-US', { weekday: 'long' })
    };
  }

  /* ---------- scroll depth tracker --------------------------------------- */
  var pageMaxScrollPct = 0;
  function currentScrollPct() {
    var doc = document.documentElement;
    var body = document.body;
    var scrollTop  = window.scrollY || doc.scrollTop || body.scrollTop || 0;
    var viewport   = window.innerHeight || doc.clientHeight || 0;
    var totalHeight = Math.max(
      body.scrollHeight || 0, doc.scrollHeight || 0,
      body.offsetHeight || 0, doc.offsetHeight || 0,
      body.clientHeight || 0, doc.clientHeight || 0
    );
    if (totalHeight <= viewport) return 100; // fully visible without scrolling
    return Math.min(100, Math.round(((scrollTop + viewport) / totalHeight) * 100));
  }

  var scrollTicking = false;
  function onScroll() {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(function () {
      scrollTicking = false;
      var pct = currentScrollPct();
      if (pct > pageMaxScrollPct) {
        pageMaxScrollPct = pct;
        if (window.NTProfile && window.NTProfile.recordScrollDepth) {
          window.NTProfile.recordScrollDepth(pct);
        }
      }
    });
  }

  /* ---------- visible-time tracker --------------------------------------- */
  var visibleSince = document.visibilityState === 'visible' ? Date.now() : 0;
  var unflushedMs  = 0;

  function flushVisibleTime() {
    if (!visibleSince) return;
    var delta = Date.now() - visibleSince;
    if (delta > 0) {
      unflushedMs += delta;
      if (unflushedMs >= 1000 && window.NTProfile && window.NTProfile.addTimeOnSite) {
        window.NTProfile.addTimeOnSite(unflushedMs);
        unflushedMs = 0;
      }
    }
    visibleSince = Date.now();
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'visible') {
      visibleSince = Date.now();
    } else {
      flushVisibleTime();
      visibleSince = 0;
    }
  }

  function onPageHide() {
    flushVisibleTime();
    if (unflushedMs > 0 && window.NTProfile && window.NTProfile.addTimeOnSite) {
      window.NTProfile.addTimeOnSite(unflushedMs);
      unflushedMs = 0;
    }
  }

  /* ---------- boot ------------------------------------------------------- */
  function boot() {
    var profile = window.NTProfile;
    if (!profile) {
      // Profile module hasn't loaded yet — defer one tick. (Both scripts
      // are injected by load-components.js; profile.js comes first, but
      // dynamic loads can race.)
      return setTimeout(boot, 50);
    }

    var stable   = collectStableContext();
    var volatile = collectVolatileContext();

    profile.setClientContext(stable);          // writes once, then ignored
    profile.updateVolatileContext(volatile);   // refreshed every pageload
    profile.bumpSession();                     // increments if > 30 min gap
    profile.recordPageView(location.pathname);

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();  // seed the initial measurement (handles tall hero-only pages)

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onPageHide);
  }

  // Public snapshot for any later consumer (e.g. the chatbot email builder).
  window.NTClientContext = {
    get: function () {
      var ctx = window.NTProfile && window.NTProfile.get && window.NTProfile.get();
      if (!ctx) return null;
      return {
        client_context:        ctx.client_context || null,
        session_count:         ctx.session_count || 0,
        total_page_views:      ctx.total_page_views || 0,
        page_views_by_path:    ctx.page_views_by_path || {},
        max_scroll_depth:      ctx.max_scroll_depth || 0,
        total_time_on_site_ms: ctx.total_time_on_site_ms || 0,
        chat_open_count:       ctx.chat_open_count || 0,
        first_seen:            ctx.first_seen || null,
        last_activity_at:      ctx.last_activity_at || null
      };
    },
    flush: function () { onPageHide(); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
