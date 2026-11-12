/* Burnaby DashCam Pros: public page overlays, safe DOM updates, visual preview bridge. */
(function () {
  'use strict';
  var doc = document.documentElement;
  var page = doc.getAttribute('data-cms-page') || 'index.html';
  var root = doc.getAttribute('data-cms-root') || './';
  var allowedImage = /^(?:https?:\/\/|\.{0,2}\/|assets\/|generated\/|data:image\/(?:png|jpeg|webp|gif);base64,)/i;
  var allowedHref = /^(?:https?:\/\/|mailto:|tel:|\/|#|\.\.?\/|[a-z0-9][a-z0-9/._#?=&%-]*$)/i;
  function text(id, value) {
    var el = document.querySelector('[data-cms-text="' + id + '"]');
    if (el && typeof value === 'string') {
      // Do not revive the obsolete service heading from an older saved CMS draft.
      var nextText = page === 'services.html' && id === 't0052' && value.trim() === 'Six ways we protect your drive'
        ? 'Four ways we protect your drive' : value;
      el.textContent = nextText;
    }
  }
  function image(id, record) {
    var el = document.querySelector('[data-cms-img="' + id + '"]');
    if (!el || !record || typeof record !== 'object') return;
    if (typeof record.src === 'string' && allowedImage.test(record.src)) {
      var nextSrc = record.src;
      // Older CMS drafts may still point at mismatched, superseded after-images.
      if (el.classList.contains('ba-after-img')) {
        nextSrc = nextSrc.replace(/(assets\/images\/before-after\/(?:sedan|tesla|rideshare)-after)\.png(?=$|[?#])/i, '$1.svg');
      }
      el.setAttribute('src', nextSrc);
      // CMS-edited images must not retain srcsets pointing at the old image.
      el.removeAttribute('srcset');
      el.removeAttribute('sizes');
    }
    if (typeof record.alt === 'string') el.setAttribute('alt', record.alt);
  }
  function href(id, value) {
    var el = document.querySelector('[data-cms-href="' + id + '"]');
    if (el && typeof value === 'string' && allowedHref.test(value)) el.setAttribute('href', value);
  }
  function apply(record) {
    if (!record || typeof record !== 'object') return;
    Object.entries(record.text || {}).forEach(function (item) { text(item[0], item[1]); });
    Object.entries(record.images || {}).forEach(function (item) { image(item[0], item[1]); });
    Object.entries(record.links || {}).forEach(function (item) { href(item[0], item[1]); });
    Object.entries(record.placeholders || {}).forEach(function (item) {
      var el=document.querySelector('[data-cms-placeholder="'+item[0]+'"]');
      if(el && typeof item[1]==='string') el.setAttribute('placeholder',item[1]);
    });
    Object.entries(record.frames || {}).forEach(function (item) {
      var el=document.querySelector('[data-cms-frame="'+item[0]+'"]');
      if(el && typeof item[1]==='string' && /^https:\/\//i.test(item[1])) el.setAttribute('src',item[1]);
    });
    if(record.meta && typeof record.meta === 'object') {
      if(typeof record.meta.title === 'string') document.title = record.meta.title;
      if(typeof record.meta.description === 'string') {
        var meta=document.querySelector('meta[name="description"]');
        if(meta) meta.setAttribute('content',record.meta.description);
      }
    }
  }
  // The editor's same-origin iframe controls the draft. Prevent live refreshes during editing.
  window.DashcamPageCMS = { page:page, apply:apply };
  if (new URLSearchParams(location.search).has('visual-preview')) return;
  var cfg=window.DASHCAM_SUPABASE || {};
  if (!cfg.url || !cfg.anonKey) return;
  var endpoint=cfg.url.replace(/\/$/,'')+'/rest/v1/cms_content?id=eq.main&select=payload';
  fetch(endpoint,{headers:{apikey:cfg.anonKey,Accept:'application/json'},cache:'no-store'})
    .then(function(r){if(!r.ok)throw Error('CMS status '+r.status);return r.json();})
    .then(function(rows){var o=rows && rows[0] && rows[0].payload && rows[0].payload.pageOverrides;
      if(o && o[page])apply(o[page]);
    }).catch(function(){ /* The published HTML already contains the last deployed content. */ });
})();
