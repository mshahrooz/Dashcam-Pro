/* Homepage-only mobile card carousels: swipe, arrows and pagination dots.
   Desktop retains the original CSS grid layouts. No external libraries. */
(function () {
  'use strict';

  function initMobileCarousels() {
    var mobile = window.matchMedia('(max-width: 767px)');
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var names = {
      process: 'Our process',
      cases: 'Featured case studies',
      reviews: 'Customer reviews'
    };

    document.querySelectorAll('[data-mobile-carousel]').forEach(function (track) {
      if (track.dataset.carouselReady) return;
      var cards = Array.prototype.slice.call(track.children);
      if (cards.length < 2) return;
      track.dataset.carouselReady = 'true';

      var name = names[track.dataset.mobileCarousel] || 'Cards';
      var nav = document.createElement('div');
      nav.className = 'bdp-mobile-carousel-nav';
      nav.setAttribute('role', 'group');
      nav.setAttribute('aria-label', name + ' slide navigation');

      var prev = document.createElement('button');
      prev.type = 'button';
      prev.className = 'bdp-carousel-arrow';
      prev.textContent = '‹';
      prev.setAttribute('aria-label', 'Previous ' + name.toLowerCase() + ' card');

      var dots = document.createElement('div');
      dots.className = 'bdp-carousel-dots';
      dots.setAttribute('role', 'group');
      dots.setAttribute('aria-label', 'Choose a ' + name.toLowerCase() + ' slide');

      var next = document.createElement('button');
      next.type = 'button';
      next.className = 'bdp-carousel-arrow';
      next.textContent = '›';
      next.setAttribute('aria-label', 'Next ' + name.toLowerCase() + ' card');

      var dotButtons = cards.map(function (_card, n) {
        var dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'bdp-carousel-dot';
        dot.setAttribute('aria-label', 'Go to slide ' + (n + 1) + ' of ' + cards.length);
        dot.addEventListener('click', function () { goTo(n); });
        dots.appendChild(dot);
        return dot;
      });

      nav.appendChild(prev);
      nav.appendChild(dots);
      nav.appendChild(next);
      track.insertAdjacentElement('afterend', nav);

      var active = 0;
      var frame = 0;

      function leftFor(index) {
        // Bounding rectangles keep positioning correct even if CSS gaps change.
        return Math.max(0, track.scrollLeft +
          cards[index].getBoundingClientRect().left -
          track.getBoundingClientRect().left);
      }

      function nearestCard() {
        var left = track.getBoundingClientRect().left;
        var closest = 0;
        var distance = Infinity;
        cards.forEach(function (card, n) {
          var delta = Math.abs(card.getBoundingClientRect().left - left);
          if (delta < distance) {
            distance = delta;
            closest = n;
          }
        });
        return closest;
      }

      function showState(index) {
        active = Math.max(0, Math.min(cards.length - 1, index));
        dotButtons.forEach(function (dot, n) {
          if (n === active) dot.setAttribute('aria-current', 'true');
          else dot.removeAttribute('aria-current');
        });
        prev.disabled = active === 0;
        next.disabled = active === cards.length - 1;
      }

      function goTo(index) {
        if (!mobile.matches) return;
        index = Math.max(0, Math.min(cards.length - 1, index));
        showState(index);
        if (typeof track.scrollTo === 'function') {
          track.scrollTo({
            left: leftFor(index),
            behavior: reducedMotion.matches ? 'auto' : 'smooth'
          });
        } else {
          track.scrollLeft = leftFor(index);
        }
      }

      prev.addEventListener('click', function () { goTo(active - 1); });
      next.addEventListener('click', function () { goTo(active + 1); });

      track.addEventListener('scroll', function () {
        if (!mobile.matches || frame) return;
        frame = window.requestAnimationFrame(function () {
          frame = 0;
          showState(nearestCard());
        });
      }, { passive: true });

      track.addEventListener('keydown', function (event) {
        if (!mobile.matches || event.target !== track) return;
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          goTo(active + 1);
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          goTo(active - 1);
        }
      });

      function updateMode() {
        if (mobile.matches) {
          track.setAttribute('role', 'region');
          track.setAttribute('aria-roledescription', 'carousel');
          track.setAttribute('aria-label', name);
          track.setAttribute('tabindex', '0');
          cards.forEach(function (card, n) {
            card.setAttribute('role', 'group');
            card.setAttribute('aria-roledescription', 'slide');
            card.setAttribute('aria-label', (n + 1) + ' of ' + cards.length);
          });
        } else {
          track.removeAttribute('role');
          track.removeAttribute('aria-roledescription');
          track.removeAttribute('aria-label');
          track.removeAttribute('tabindex');
          cards.forEach(function (card) {
            card.removeAttribute('role');
            card.removeAttribute('aria-roledescription');
            card.removeAttribute('aria-label');
          });
        }
        showState(mobile.matches ? nearestCard() : 0);
      }

      if (mobile.addEventListener) mobile.addEventListener('change', updateMode);
      else mobile.addListener(updateMode);
      window.addEventListener('resize', function () {
        if (!mobile.matches) return;
        if (frame) window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(function () {
          frame = 0;
          showState(nearestCard());
        });
      }, { passive: true });

      updateMode();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileCarousels);
  } else {
    initMobileCarousels();
  }
})();
