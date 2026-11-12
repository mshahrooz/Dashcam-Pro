/* ===================================================================
   Burnaby DashCam Pros — shared client-side JS
   Loaded on every page. Handles:
     - mobile nav drawer open/close + outside-click
     - sticky header shadow on scroll
     - lucide icon init
     - reveal-on-scroll
     - before/after drag slider
     - simulated contact + newsletter form submission
   No external deps beyond lucide (loaded in <head>).
   =================================================================== */
(function () {
  'use strict';

  /* ---------- Mobile drawer ---------- */
  function initDrawer() {
    var trigger = document.getElementById('nav-trigger');
    var close   = document.getElementById('nav-close');
    var overlay = document.getElementById('nav-overlay');
    if (!trigger) return;

    function open()  { document.body.classList.add('drawer-open'); document.documentElement.classList.add('drawer-open'); }
    function shut()  { document.body.classList.remove('drawer-open'); document.documentElement.classList.remove('drawer-open'); }

    trigger.addEventListener('click', open);
    if (close)   close.addEventListener('click', shut);
    if (overlay) overlay.addEventListener('click', shut);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') shut(); });
    // Close drawer when any link inside it is clicked
    document.querySelectorAll('#nav-panel a').forEach(function (a) {
      a.addEventListener('click', shut);
    });
  }

  /* ---------- Sticky header shadow ---------- */
  function initHeaderScroll() {
    var header = document.getElementById('navbar');
    if (!header) return;
    var onScroll = function () {
      if (window.scrollY > 8) header.classList.add('shadow-md', 'border-zinc-200');
      else header.classList.remove('shadow-md', 'border-zinc-200');
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- Reveal on scroll ---------- */
  function initReveal() {
    var els = document.querySelectorAll('.reveal');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Before/After slider (clip-path approach) ----------
     Layout: .ba-after-img is the full-width base; .ba-before-img sits
     on top and is clipped to the left of the handle via clip-path.
     Left of handle = Before, right = After.
  */
  function initSliders() {
    document.querySelectorAll('.ba-slider').forEach(function (slider) {
      if (slider.dataset.baInit) return;
      slider.dataset.baInit = '1';

      var beforeImg = slider.querySelector('.ba-before-img');
      var handle    = slider.querySelector('.ba-handle');
      var knob      = slider.querySelector('.ba-handle-knob');
      if (!beforeImg || !handle) return;

      var pos = 50; // percent

      function setPos(p) {
        pos = Math.max(0, Math.min(100, p));
        beforeImg.style.clipPath = 'inset(0 ' + (100 - pos) + '% 0 0)';
        handle.style.left = pos + '%';
      }
      setPos(50);

      var dragging = false;

      function pctFromEvent(clientX) {
        var rect = slider.getBoundingClientRect();
        return ((clientX - rect.left) / rect.width) * 100;
      }

      function startDrag(clientX) {
        dragging = true;
        document.body.style.userSelect = 'none';
        setPos(pctFromEvent(clientX));
      }
      function moveDrag(clientX) { if (dragging) setPos(pctFromEvent(clientX)); }
      function endDrag() { dragging = false; document.body.style.userSelect = ''; }

      handle.addEventListener('mousedown',  function (e) { startDrag(e.clientX); e.preventDefault(); });
      slider.addEventListener('mousedown',  function (e) { startDrag(e.clientX); });
      window.addEventListener('mousemove',  function (e) { moveDrag(e.clientX); });
      window.addEventListener('mouseup',    endDrag);

      handle.addEventListener('touchstart', function (e) { startDrag(e.touches[0].clientX); }, { passive: true });
      slider.addEventListener('touchstart', function (e) { startDrag(e.touches[0].clientX); }, { passive: true });
      window.addEventListener('touchmove',  function (e) { if (dragging) { moveDrag(e.touches[0].clientX); e.preventDefault(); } }, { passive: false });
      window.addEventListener('touchend',   endDrag);

      // Keyboard accessibility on the knob
      if (knob) {
        knob.setAttribute('tabindex', '0');
        knob.setAttribute('role', 'slider');
        knob.setAttribute('aria-label', 'Drag to compare before and after');
        knob.addEventListener('keydown', function (e) {
          if (e.key === 'ArrowLeft')  { setPos(pos - 4); e.preventDefault(); }
          if (e.key === 'ArrowRight') { setPos(pos + 4); e.preventDefault(); }
        });
      }
    });
  }

  /* ---------- Simulated forms ---------- */
  function initForms() {
    // Contact / install-request form
    document.querySelectorAll('form[data-form="contact"]').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var ok = form.querySelector('[data-form-ok]');
        if (ok) { ok.classList.remove('hidden'); ok.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        form.reset();
      });
    });
    // Newsletter signup
    document.querySelectorAll('form[data-form="newsletter"]').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var ok = form.querySelector('[data-form-ok]');
        if (ok) { ok.classList.remove('hidden'); }
        form.reset();
      });
    });
  }

  /* ---------- Tab switcher (used on case-studies index if needed) --- */
  function initTabs() {
    document.querySelectorAll('[data-tabs]').forEach(function (root) {
      var buttons = root.querySelectorAll('[data-tab]');
      var panels  = root.querySelectorAll('[data-panel]');
      buttons.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var name = btn.getAttribute('data-tab');
          buttons.forEach(function (b) {
            b.classList.toggle('bg-red-600', b === btn);
            b.classList.toggle('text-white', b === btn);
            b.classList.toggle('text-zinc-600', b !== btn);
          });
          panels.forEach(function (p) {
            p.classList.toggle('hidden', p.getAttribute('data-panel-name') !== name);
          });
        });
      });
    });
  }

  /* ---------- Boot ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    initDrawer();
    initHeaderScroll();
    initReveal();
    initSliders();
    initForms();
    initTabs();
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
  });
})();
