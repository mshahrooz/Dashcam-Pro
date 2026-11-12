/* Burnaby DashCam Pros: viewport-autoplay for native homepage video, immediate hero playback. */
(function () {
  'use strict';

  function setupVideo(video) {
    var shell = video.closest('[data-video-shell]');
    if (!shell) return;

    var button = shell.querySelector('[data-video-toggle]');
    var nativeControls = video.hasAttribute('controls');
    var viewportMode = video.getAttribute('data-play-trigger') === 'viewport';
    var inView = !viewportMode;
    var userPaused = false;
    var automaticPausePending = false;
    var reducedMotion = !!(window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    // Muted autoplay with inline playback is required for mobile Safari/Chrome.
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
      if (!button) return; // Native player owns its play, scrub, volume and fullscreen controls.
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
      try {
        var pending = video.play();
        if (pending && typeof pending.then === 'function') {
          pending.then(updateUI, updateUI);
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

    function pauseAutomatically() {
      if (!video.paused) {
        automaticPausePending = true;
        video.pause();
      }
      updateUI();
    }

    if (button) {
      button.addEventListener('click', function () {
        if (video.paused || video.ended) {
          userPaused = false;
          play();
        } else {
          userPaused = true;
          pauseAutomatically();
        }
      });
    }

    video.addEventListener('play', function () {
      if (nativeControls) userPaused = false;
      updateUI();
    });
    video.addEventListener('playing', updateUI);
    video.addEventListener('pause', function () {
      if (nativeControls && !automaticPausePending && inView && !document.hidden) {
        userPaused = true;
      }
      automaticPausePending = false;
      updateUI();
    });
    video.addEventListener('loadeddata', function () {
      updateUI();
      tryAutoplay();
    });
    video.addEventListener('error', updateUI);

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) pauseAutomatically();
      else tryAutoplay();
    });
    window.addEventListener('pageshow', tryAutoplay);

    if (viewportMode) {
      if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function (entries) {
          var entry = entries[0];
          if (!entry) return;
          inView = entry.isIntersecting && entry.intersectionRatio >= 0.15;
          if (inView) tryAutoplay();
          else pauseAutomatically();
        }, { threshold: [0, 0.15, 0.4] });
        observer.observe(shell);
      } else {
        function checkVisibility() {
          var rect = shell.getBoundingClientRect();
          var viewHeight = window.innerHeight || document.documentElement.clientHeight;
          var visible = Math.max(0, Math.min(viewHeight, rect.bottom) - Math.max(0, rect.top));
          inView = visible >= Math.min(rect.height, viewHeight) * 0.15;
          if (inView) tryAutoplay();
          else pauseAutomatically();
        }
        window.addEventListener('scroll', checkVisibility, { passive: true });
        window.addEventListener('resize', checkVisibility);
        checkVisibility();
      }
    } else {
      // Book Installation hero starts as soon as page markup is ready.
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
