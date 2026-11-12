/* DashCam Pros: viewport-triggered homepage footage, immediate consultation hero. */
(function () {
  'use strict';

  function setupVideo(video) {
    var shell = video.closest('[data-video-shell]');
    var button = shell && shell.querySelector('[data-video-toggle]');
    if (!shell || !button) return;

    var viewportMode = video.getAttribute('data-play-trigger') === 'viewport';
    var inView = !viewportMode;
    var userPaused = false;
    var reducedMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var observer = null;

    // Both properties and attributes matter for iOS Safari inline autoplay.
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');

    function isPlaying() {
      return !video.paused && !video.ended && video.readyState >= 2;
    }

    function updateUI() {
      var playing = isPlaying();
      shell.classList.toggle('is-video-playing', playing);
      if (video.error) {
        button.textContent = 'Video unavailable';
        button.setAttribute('aria-label', 'Video unavailable');
        button.disabled = true;
        return;
      }
      var label = playing ? 'Pause video' : 'Play video';
      button.textContent = label;
      button.setAttribute('aria-label', label);
      button.setAttribute('aria-pressed', playing ? 'true' : 'false');
    }

    function play() {
      if (video.error) return updateUI();
      // Re-assert muted/inline state before an autoplay attempt on mobile.
      video.muted = true;
      video.playsInline = true;
      try {
        var promise = video.play();
        if (promise && typeof promise.then === 'function') {
          promise.then(updateUI, updateUI);
        }
      } catch (error) {
        updateUI();
      }
    }

    function shouldAutoplay() {
      return !reducedMotion && !userPaused && !document.hidden && inView;
    }

    function tryAutoplay() {
      if (shouldAutoplay() && video.paused) play();
    }

    function pause() {
      if (!video.paused) video.pause();
      updateUI();
    }

    // Explicit user actions override automatic pause/resume until re-enabled.
    button.addEventListener('click', function () {
      if (video.paused || video.ended) {
        userPaused = false;
        play();
      } else {
        userPaused = true;
        pause();
      }
      updateUI();
    });

    video.addEventListener('playing', updateUI);
    video.addEventListener('pause', updateUI);
    video.addEventListener('loadeddata', function () {
      updateUI();
      tryAutoplay();
    });
    video.addEventListener('error', updateUI);

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) pause();
      else tryAutoplay();
    });
    window.addEventListener('pageshow', tryAutoplay);

    if (viewportMode) {
      if ('IntersectionObserver' in window) {
        observer = new IntersectionObserver(function (entries) {
          var entry = entries[0];
          if (!entry) return;
          inView = entry.isIntersecting && entry.intersectionRatio >= 0.15;
          if (inView) tryAutoplay();
          else pause();
        }, { threshold: [0, 0.15, 0.4] });
        observer.observe(shell);
      } else {
        // Older mobile browsers still get scroll-triggered playback.
        function checkVisibility() {
          var rect = shell.getBoundingClientRect();
          var height = window.innerHeight || document.documentElement.clientHeight;
          var visible = Math.max(0, Math.min(height, rect.bottom) - Math.max(0, rect.top));
          inView = visible >= Math.min(rect.height, height) * 0.15;
          if (inView) tryAutoplay();
          else pause();
        }
        window.addEventListener('scroll', checkVisibility, { passive: true });
        window.addEventListener('resize', checkVisibility);
        checkVisibility();
      }
    } else {
      // Consultation page: start right away, without requiring scrolling.
      tryAutoplay();
    }
    updateUI();
  }

  function init() {
    var videos = document.querySelectorAll('video[data-background-video]');
    for (var i = 0; i < videos.length; i++) setupVideo(videos[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
