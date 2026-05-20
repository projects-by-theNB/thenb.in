/**
 * Consent Mode v2 defaults + GTM + Microsoft Clarity, in that order.
 *
 * Runs once per page, as early as possible. Order matters: consent defaults
 * MUST be on the dataLayer before GTM fires so every downstream tag (GA4,
 * Ads, Meta) starts with the right state. All three loaders are gated to
 * the production hostname so dev / staging builds don't pollute analytics.
 *
 * Loaded via a plain (non-deferred, non-async) <script src> at the top of
 * <head> on every page so it blocks parsing for ~1 KB but runs before any
 * inline script can touch the dataLayer.
 */
(function () {
  'use strict';

  if (!/(^|\.)navlakha\.tech$/i.test(location.hostname)) return;

  // ---------- Google Consent Mode v2 ----------
  // EU/UK/EEA traffic -> denied; rest of world -> granted. Add a CMP banner
  // later and call gtag('consent','update',{...}) on accept.
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { dataLayer.push(arguments); };
  gtag('consent', 'default', {
    ad_storage:            'denied',
    ad_user_data:          'denied',
    ad_personalization:    'denied',
    analytics_storage:     'denied',
    functionality_storage: 'granted',
    security_storage:      'granted',
    wait_for_update:       500,
    region: ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','IS','LI','NO','GB','CH']
  });
  gtag('consent', 'default', {
    ad_storage:            'granted',
    ad_user_data:          'granted',
    ad_personalization:    'granted',
    analytics_storage:     'granted',
    functionality_storage: 'granted',
    security_storage:      'granted'
  });

  // ---------- Google Tag Manager ----------
  (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
  })(window, document, 'script', 'dataLayer', 'GTM-KBSL779S');

  // ---------- Microsoft Clarity ----------
  // Project ID also lives in lib/custom/js/config.js -> clarityProjectId.
  (function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src='https://www.clarity.ms/tag/'+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
  })(window, document, 'clarity', 'script', 'wu8165tr26');
})();
