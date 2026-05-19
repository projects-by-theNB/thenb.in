      var NT_MAILER_URL = 'https://mailer.nbnext.in/api/v1/mail/send';
      var NT_MAILER_KEY = 'REPLACE_WITH_YOUR_MAILER_SECRET_KEY';
      var NT_NOTIFY     = ['mahavirnn@gmail.com', 'nnautatva@gmail.com'];

      var _leadName = '', _leadEmail = '', _leadSent = false;

      /* Called by Google One Tap when user clicks their Google account */
      function handleGoogleLead(response) {
        try {
          var parts = response.credential.split('.');
          var payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          _leadName  = payload.name  || '';
          _leadEmail = payload.email || '';
          localStorage.setItem('nt_lead_captured', '1');
          showPhoneCard(_leadName);
        } catch (e) {}
      }

      /* Fires exactly once — one email per address in NT_NOTIFY */
      function sendLead(name, email, phone) {
        if (_leadSent) return;
        _leadSent = true;
        if (!NT_MAILER_KEY || NT_MAILER_KEY.indexOf('REPLACE') !== -1) return;

        var subject = '\uD83D\uDD14 New Visitor: ' + name + ' \u2014 navlakha.tech';
        var content = ntBuildEmail(name, email, phone, window.location.href);

        NT_NOTIFY.forEach(function(toEmail) {
          fetch(NT_MAILER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subject: subject,
              content: content,
              email_secret_key: NT_MAILER_KEY,
              to_email: toEmail
            })
          }).catch(function() {});
        });
      }

      /* HTML email template — same table-based style used across NB Next apps */
      function ntBuildEmail(name, email, phone, page) {
        var e = ntEncode;
        return [
          '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>',
          '<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">',
          '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">',
          '<tr><td align="center">',
          '<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">',

          /* Header */
          '<tr><td style="background:#1a1a2e;padding:22px 32px;">',
          '<p style="margin:0;font-size:11px;color:#00fd59;letter-spacing:1px;text-transform:uppercase;">Landing Page · navlakha.tech</p>',
          '<h1 style="margin:6px 0 0;font-size:19px;color:#fff;">New Visitor Signed In</h1>',
          '</td></tr>',

          /* Body */
          '<tr><td style="padding:28px 32px;">',
          '<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;font-size:14px;">',

          '<tr style="background:#f9fafb;">',
          '<td style="padding:10px 16px;color:#6b7280;width:36%;border-bottom:1px solid #e5e7eb;">Name</td>',
          '<td style="padding:10px 16px;font-weight:600;color:#111827;border-bottom:1px solid #e5e7eb;">' + e(name) + '</td></tr>',

          '<tr>',
          '<td style="padding:10px 16px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Email</td>',
          '<td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;"><a href="mailto:' + e(email) + '" style="color:#0f766e;">' + e(email) + '</a></td></tr>',

          '<tr style="background:#f9fafb;">',
          '<td style="padding:10px 16px;color:#6b7280;border-bottom:1px solid #e5e7eb;">WhatsApp</td>',
          '<td style="padding:10px 16px;font-weight:600;color:#111827;border-bottom:1px solid #e5e7eb;">' + e(phone || '(not shared)') + '</td></tr>',

          '<tr>',
          '<td style="padding:10px 16px;color:#6b7280;">Page</td>',
          '<td style="padding:10px 16px;font-size:12px;color:#374151;">' + e(page) + '</td></tr>',

          '</table></td></tr>',

          /* Footer */
          '<tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center;">',
          '<p style="margin:0;font-size:12px;color:#9ca3af;">Automated notification · Navlakha Technologies · navlakha.tech</p>',
          '</td></tr>',

          '</table></td></tr></table>',
          '</body></html>'
        ].join('');
      }

      function ntEncode(s) {
        return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      }

      /* Small floating card asking for WhatsApp number after Google sign-in */
      function showPhoneCard(name) {
        var first = name ? name.split(' ')[0] : '';
        var card = document.createElement('div');
        card.id = 'nt-phone-card';
        card.style.cssText = [
          'position:fixed','bottom:24px','right:24px',
          'background:#fff','border-radius:12px',
          'box-shadow:0 6px 32px rgba(0,0,0,0.18)',
          'padding:20px 22px','width:300px','z-index:99999',
          'font-family:inherit','animation:ntSlideIn 0.3s ease'
        ].join(';');
        card.innerHTML = [
          '<style>',
          '@keyframes ntSlideIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}',
          '#nt-phone-card input{width:100%;border:1.5px solid #ddd;border-radius:6px;padding:9px 11px;font-size:14px;outline:none;box-sizing:border-box;margin:10px 0 12px;}',
          '#nt-phone-card input:focus{border-color:#00fd59;}',
          '#nt-phone-card .nt-btn-row{display:flex;gap:8px;}',
          '#nt-phone-card .nt-submit{flex:1;background:#00fd59;color:#111;border:none;border-radius:6px;padding:9px;font-weight:700;cursor:pointer;font-size:14px;}',
          '#nt-phone-card .nt-submit:hover{background:#00e04f;}',
          '#nt-phone-card .nt-skip{background:none;border:none;color:#888;cursor:pointer;font-size:13px;padding:9px 4px;}',
          '#nt-phone-card .nt-skip:hover{color:#444;}',
          '#nt-phone-card .nt-close{position:absolute;top:10px;right:13px;background:none;border:none;font-size:18px;color:#aaa;cursor:pointer;line-height:1;}',
          '</style>',
          '<button class="nt-close" onclick="ntCloseCard(false)" aria-label="Close">&times;</button>',
          '<p style="margin:0 0 4px;font-weight:700;font-size:15px;color:#111;">Thanks' + (first ? ', ' + first : '') + '!</p>',
          '<p style="margin:0;font-size:13px;color:#555;line-height:1.45;">Share your WhatsApp number and we\'ll reach out personally.</p>',
          '<input id="nt-phone-input" type="tel" placeholder="+91 98765 43210" maxlength="15" />',
          '<div class="nt-btn-row">',
            '<button class="nt-submit" onclick="ntSubmitPhone()">Send</button>',
            '<button class="nt-skip" onclick="ntCloseCard(false)">Skip</button>',
          '</div>'
        ].join('');
        document.body.appendChild(card);
        var inp = document.getElementById('nt-phone-input');
        if (inp) inp.addEventListener('keydown', function(e) { if (e.key === 'Enter') ntSubmitPhone(); });
      }

      function ntSubmitPhone() {
        var phone = (document.getElementById('nt-phone-input') || {}).value || '';
        sendLead(_leadName, _leadEmail, phone.trim());
        ntCloseCard(true);
      }

      function ntCloseCard(withPhone) {
        sendLead(_leadName, _leadEmail, ''); // no-op if already sent
        var card = document.getElementById('nt-phone-card');
        if (card && card.parentNode) card.parentNode.removeChild(card);
        ntShowToast(withPhone ? "Got it! We'll WhatsApp you soon." : "Thanks! We'll be in touch.");
      }

      function ntShowToast(msg) {
        var t = document.createElement('div');
        t.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:#00fd59;color:#111;padding:13px 28px;border-radius:8px;font-weight:600;font-size:15px;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,0.25);white-space:nowrap';
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(function() { if (t.parentNode) t.parentNode.removeChild(t); }, 4000);
      }
