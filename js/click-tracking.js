      (function () {
        // Map of CSS selector → {event name, label} sent to GA4
        var TRACK = [
          // Hero CTAs
          { sel: '.hero-btn-primary',            ev: 'cta_click',      lb: 'hero_book_demo_wa' },
          { sel: '.hero-btn-secondary',           ev: 'cta_click',      lb: 'hero_see_products' },

          // Product clicks — covers both nav dropdown AND card arrows
          { sel: 'a[href="hrms.html"]',           ev: 'product_click',  lb: 'hrms' },
          { sel: 'a[href="inventory.html"]',       ev: 'product_click',  lb: 'inventory' },
          { sel: 'a[href="crm.html"]',             ev: 'product_click',  lb: 'crm' },
          { sel: 'a[href="custom.html"]',          ev: 'product_click',  lb: 'custom_dev' },
          { sel: 'a[href="gatepass.html"]',        ev: 'product_click',  lb: 'gatepass' },
          { sel: 'a[href="safechat.html"]',        ev: 'product_click',  lb: 'safechat' },
          { sel: 'a[href="hrms.html#pricing"]',    ev: 'product_click',  lb: 'hrms_pricing' },
          { sel: 'a[href="nbnext.html"]',          ev: 'product_click',  lb: 'nbnext_platform' },

          // WhatsApp touchpoints (by location class / parent)
          { sel: '.nt-wa-btn',                     ev: 'whatsapp_click', lb: 'sticky_float' },
          { sel: '.cta-btn',                       ev: 'whatsapp_click', lb: 'cta_section' },

          // Contact actions
          { sel: 'a[href^="tel:"]',                ev: 'contact_click',  lb: 'phone' },
          { sel: 'a[href^="mailto:"]',             ev: 'contact_click',  lb: 'email' },

          // Social links
          { sel: 'a.linkedin',                     ev: 'social_click',   lb: 'linkedin' },
          { sel: 'a.instagram',                    ev: 'social_click',   lb: 'instagram' },
        ];

        function track(ev, lb) {
          if (typeof gtag === 'function') {
            gtag('event', ev, { event_category: 'engagement', event_label: lb });
          }
        }

        // Attach after DOM is ready
        document.addEventListener('DOMContentLoaded', function () {
          TRACK.forEach(function (rule) {
            document.querySelectorAll(rule.sel).forEach(function (el) {
              el.addEventListener('click', function () { track(rule.ev, rule.lb); });
            });
          });
        });
      })();
