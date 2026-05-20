(function ($) {
  "use strict";

  // Preloader (if the #preloader div exists)
  $(window).on('load', function () {
    if ($('#preloader').length) {
      $('#preloader').delay(100).fadeOut('slow', function () {
        $(this).remove();
      });
    }
  });

  // Back to top button (footer injected via components/footer.html)
  function updateBackToTop() {
    if ($(window).scrollTop() > 100) {
      $('.back-to-top').addClass('visible');
    } else {
      $('.back-to-top').removeClass('visible');
    }
  }
  $(window).on('scroll', updateBackToTop);
  updateBackToTop();

  $(document).on('click', '.back-to-top', function (e) {
    e.preventDefault();
    $('html, body').animate({ scrollTop: 0 }, 1500, 'easeInOutExpo');
    return false;
  });

  // Initiate the wowjs animation library
  new WOW().init();

  // Header scroll class
  $(window).scroll(function() {
    if ($(this).scrollTop() > 100) {
      $('#header').addClass('header-scrolled');
    } else {
      $('#header').removeClass('header-scrolled');
    }
  });

  if ($(window).scrollTop() > 100) {
    $('#header').addClass('header-scrolled');
  }

  // Smooth scroll for the navigation and links with .scrollto classes
  $('.main-nav a, .mobile-nav a, .scrollto').on('click', function() {
    if (location.pathname.replace(/^\//, '') == this.pathname.replace(/^\//, '') && location.hostname == this.hostname) {
      var target = $(this.hash);
      if (target.length) {
        var top_space = 0;

        if ($('#header').length) {
          top_space = $('#header').outerHeight();

          if (! $('#header').hasClass('header-scrolled')) {
            top_space = top_space - 40;
          }
        }

        $('html, body').animate({
          scrollTop: target.offset().top - top_space
        }, 1500, 'easeInOutExpo');

        if ($(this).parents('.main-nav, .mobile-nav').length) {
          $('.main-nav .active, .mobile-nav .active').removeClass('active');
          $(this).closest('li').addClass('active');
        }

        if ($('body').hasClass('mobile-nav-active')) {
          $('body').removeClass('mobile-nav-active');
          $('.mobile-nav-toggle i').toggleClass('fa-times fa-bars');
          $('.mobile-nav-overly').fadeOut();
        }
        return false;
      }
    }
  });

  // Navigation active state on scroll
  var nav_sections = $('section');
  var main_nav = $('.main-nav, .mobile-nav');
  var main_nav_height = $('#header').outerHeight();

  $(window).on('scroll', function () {
    var cur_pos = $(this).scrollTop();
  
    nav_sections.each(function() {
      var top = $(this).offset().top - main_nav_height,
          bottom = top + $(this).outerHeight();
  
      if (cur_pos >= top && cur_pos <= bottom) {
        main_nav.find('li').removeClass('active');
        main_nav.find('a[href="#'+$(this).attr('id')+'"]').parent('li').addClass('active');
      }
    });
  });

  // jQuery counterUp (used in Whu Us section)
  $('[data-toggle="counter-up"]').counterUp({
    delay: 10,
    time: 1000
  });

  // Porfolio isotope and filter
  $(window).on('load', function () {
    var portfolioIsotope = $('.portfolio-container').isotope({
      itemSelector: '.portfolio-item'
    });
    $('#portfolio-flters li').on( 'click', function() {
      $("#portfolio-flters li").removeClass('filter-active');
      $(this).addClass('filter-active');
  
      portfolioIsotope.isotope({ filter: $(this).data('filter') });
    });
  });

  // Testimonials carousel (uses the Owl Carousel library)
  $(".testimonials-carousel").owlCarousel({
    autoplay: true,
    dots: true,
    loop: true,
    items: 1
  });

  // Clients carousel (uses the Owl Carousel library)
  $(".clients-carousel").owlCarousel({
    autoplay: true,
    dots: true,
    loop: true,
    responsive: { 0: { items: 2 }, 768: { items: 4 }, 900: { items: 6 }
    }
  });

  // Module card click → navigate to dedicated product page, fallback to overlay
  var modulePageMap = {
    'hrms':      'hrms.html',
    'erp':       'erp.html',
    'inventory': 'inventory.html',
    'crm':       'crm.html',
    'custom':    'custom.html',
    'gatepass':  'gatepass.html',
    'safechat':  'safechat.html'
  };

  $('.module-card').on('click', function(e) {
    // Let native link clicks pass through
    if ($(e.target).closest('a').length) return;

    var moduleType = $(this).data('module');
    var pageUrl = modulePageMap[moduleType];

    if (pageUrl) {
      window.location.href = pageUrl;
    } else {
      // Fallback: show overlay for modules without a dedicated page
      var detailsContent = $('#details-' + moduleType).html();
      if (detailsContent) {
        $('#overlayDetails').html(detailsContent);
        $('#moduleOverlay').fadeIn(300).css('display', 'flex');
        $('body').addClass('overlay-open');
      }
    }
  });

  // Close overlay
  $('#closeOverlay, #moduleOverlay').on('click', function(e) {
    if (e.target === this) {
      $('#moduleOverlay').fadeOut(300);
      $('body').removeClass('overlay-open');
    }
  });

  // Close overlay on escape key
  $(document).on('keydown', function(e) {
    if (e.key === 'Escape' && $('#moduleOverlay').is(':visible')) {
      $('#moduleOverlay').fadeOut(300);
      $('body').removeClass('overlay-open');
    }
  });

  // Interactive celebration effects
  $('.party-popper, .confetti').on('click', function() {
    // Create explosion effect
    const $this = $(this);
    const originalText = $this.text();
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd', '#ff6348'];
    
    // Change color temporarily
    $this.css('color', colors[Math.floor(Math.random() * colors.length)]);
    $this.css('transform', 'scale(2) rotate(720deg)');
    
    // Create mini explosion particles
    for (let i = 0; i < 8; i++) {
      const particle = $('<div>').addClass('explosion-particle').text('✨');
      particle.css({
        position: 'absolute',
        left: $this.offset().left + Math.random() * 50 - 25,
        top: $this.offset().top + Math.random() * 50 - 25,
        color: colors[Math.floor(Math.random() * colors.length)],
        fontSize: '12px',
        zIndex: 1000,
        pointerEvents: 'none',
        animation: 'explosion 0.8s ease-out forwards'
      });
      $('body').append(particle);
      
      setTimeout(() => particle.remove(), 800);
    }
    
    // Reset after animation
    setTimeout(() => {
      $this.css('transform', '');
      $this.css('color', '');
    }, 500);
  });

  $('.celebration-text').on('click', function() {
    const $this = $(this);
    const messages = ['🎊 4 YEARS! 🎊', '🎉 CELEBRATE! 🎉', '✨ AMAZING! ✨', '🚀 SUCCESS! 🚀', '💪 AWESOME! 💪', '🌟 FANTASTIC! 🌟'];
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    
    $this.text(randomMessage);
    $this.css('animation', 'pulse 0.3s ease-in-out');
    
    setTimeout(() => {
      $this.css('animation', 'bounce 2s ease-in-out infinite');
    }, 300);
  });

  // Add explosion animation to CSS dynamically
  if (!$('#explosion-style').length) {
    $('head').append(`
      <style id="explosion-style">
        @keyframes explosion {
          0% { transform: scale(0) rotate(0deg); opacity: 1; }
          50% { transform: scale(1.5) rotate(180deg); opacity: 0.8; }
          100% { transform: scale(0) rotate(360deg); opacity: 0; }
        }
      </style>
    `);
  }

  // Auto-trigger celebration effects periodically
  setInterval(() => {
    const randomPopper = $('.party-popper').eq(Math.floor(Math.random() * $('.party-popper').length));
    if (randomPopper.length) {
      randomPopper.trigger('click');
    }
  }, 3000);

  // Mouse movement effects
  $('#call-to-action').on('mousemove', function(e) {
    const $this = $(this);
    const rect = this.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Create ripple effect
    const ripple = $('<div>').addClass('mouse-ripple');
    ripple.css({
      position: 'absolute',
      left: x + 'px',
      top: y + 'px',
      width: '20px',
      height: '20px',
      background: 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 70%)',
      borderRadius: '50%',
      pointerEvents: 'none',
      zIndex: 5,
      animation: 'ripple 1s ease-out forwards'
    });
    
    $this.append(ripple);
    setTimeout(() => ripple.remove(), 1000);
  });

  // Add ripple animation
  if (!$('#ripple-style').length) {
    $('head').append(`
      <style id="ripple-style">
        @keyframes ripple {
          0% { transform: scale(0); opacity: 1; }
          100% { transform: scale(4); opacity: 0; }
        }
      </style>
    `);
  }

})(jQuery);

