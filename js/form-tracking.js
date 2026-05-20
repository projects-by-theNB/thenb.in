/**
 * Form-field abandonment tracker.
 *
 * Auto-binds to any <form data-track-form="form_name"> on the page and
 * emits the following dataLayer events:
 *
 *   form_start          — first focus into any non-button field
 *   form_field_complete — blur with a non-empty value (once per field)
 *   form_abandon        — pagehide while started but not submitted; payload
 *                         includes last_field, fields_completed, fields_total
 *
 * Combined with the existing lead_submit / order_submit events, this lets
 * GTM build a real funnel (impressions -> starts -> completions -> submits)
 * and surface the single field that bleeds the most leads.
 *
 * The module is a no-op on pages without [data-track-form] so it's safe to
 * load globally via load-components.js.
 */
(function () {
  'use strict';

  if (window.__ntFormTrackingMounted) return;
  window.__ntFormTrackingMounted = true;

  window.dataLayer = window.dataLayer || [];

  function isTrackable(el) {
    if (!el) return false;
    var tag = el.tagName;
    if (tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') return false;
    var type = (el.type || '').toLowerCase();
    if (type === 'submit' || type === 'button' || type === 'hidden' || type === 'reset') return false;
    return true;
  }

  function fieldKey(el) {
    return el.name || el.id || el.type || 'unknown';
  }

  function init(form) {
    var formName = form.getAttribute('data-track-form');
    if (!formName) return;

    var started = false;
    var submitted = false;
    var abandoned = false;
    var completed = {};
    var lastFieldName = null;

    function countTrackable() {
      var n = 0;
      form.querySelectorAll('input, select, textarea').forEach(function (el) {
        if (isTrackable(el)) n++;
      });
      return n;
    }

    form.addEventListener('focusin', function (e) {
      var el = e.target;
      if (!isTrackable(el)) return;
      lastFieldName = fieldKey(el);
      if (!started) {
        started = true;
        window.dataLayer.push({
          event: 'form_start',
          form_name: formName,
          page_path: location.pathname
        });
      }
    });

    form.addEventListener('focusout', function (e) {
      var el = e.target;
      if (!isTrackable(el)) return;
      var name = fieldKey(el);
      var value = (el.value == null ? '' : String(el.value)).trim();
      if (value && !completed[name]) {
        completed[name] = true;
        window.dataLayer.push({
          event: 'form_field_complete',
          form_name: formName,
          field: name,
          page_path: location.pathname
        });
      }
    });

    // 'submit' fires only when validation passes — for forms that
    // preventDefault and validate manually (book-demo, order), this still
    // fires regardless. Marks the form as "done" so abandon doesn't fire.
    form.addEventListener('submit', function () {
      submitted = true;
    });

    function fireAbandon() {
      if (!started || submitted || abandoned) return;
      abandoned = true;
      window.dataLayer.push({
        event: 'form_abandon',
        form_name: formName,
        last_field: lastFieldName,
        fields_completed: Object.keys(completed).length,
        fields_total: countTrackable(),
        page_path: location.pathname
      });
    }

    // pagehide is the standard signal for navigation/close on desktop.
    // visibilitychange + 'hidden' covers mobile cases where pagehide is
    // not reliably fired (Safari iOS backgrounding the tab).
    window.addEventListener('pagehide', fireAbandon);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') fireAbandon();
    });
  }

  function bootstrap() {
    document.querySelectorAll('form[data-track-form]').forEach(init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
