/* Muted background videos: autoplay when permitted, manual play/pause always available. */
(function () {
  'use strict';
  function setup(video) {
    var shell = video.closest('[data-video-shell]');
    var button = shell && shell.querySelector('[data-video-toggle]');
    if (!button) return;
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var userPaused = false;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    function sync() {
      if (video.error) {
        button.textContent = 'Video unavailable';
        button.setAttribute('aria-label', 'Video unavailable');
        button.disabled = true;
        return;
      }
      var playing = !video.paused && !video.ended;
      var label = playing ? 'Pause video' : 'Play video';
      button.textContent = label;
      button.setAttribute('aria-label', label);
      button.setAttribute('aria-pressed', playing ? 'true' : 'false');
    }
    function start() {
      if (video.error) return sync();
      try {
        var pending = video.play();
        if (pending && typeof pending.then === 'function') {
          pending.then(sync, sync);
        }
      } catch (e) { sync(); }
    }
    button.addEventListener('click', function () {
      if (video.paused || video.ended) {
        userPaused = false;
        start();
      } else {
        userPaused = true;
        video.pause();
      }
      sync();
    });
    video.addEventListener('playing', sync);
    video.addEventListener('pause', sync);
    video.addEventListener('error', sync);
    video.addEventListener('loadeddata', sync);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && !reduce && !userPaused && video.paused) start();
    });
    window.addEventListener('pageshow', function () {
      if (!reduce && !userPaused && video.paused) start();
    });
    if (reduce) video.pause();
    else start();
    sync();
  }
  function init() {
    var videos = document.querySelectorAll('video[data-background-video]');
    for (var i = 0; i < videos.length; i++) setup(videos[i]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
