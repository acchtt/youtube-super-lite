'use strict';

(() => {
  let parsed;
  try {
    parsed = new URL(location.href);
  } catch (_) {
    return;
  }

  const host = parsed.hostname.replace(/^www\./, '');
  const isWatch = host === 'youtube.com' && parsed.pathname === '/watch';
  const validVideo = /^[A-Za-z0-9_-]{11}$/.test(parsed.searchParams.get('v') || '');

  // v0.7 takeover owns normal watch pages. aero_native=1 is an intentional
  // escape hatch to the untouched full YouTube watch page.
  if (isWatch && (validVideo || parsed.searchParams.get('aero_native') === '1')) return;

  const DEFAULTS = Object.freeze({
    liteEnabled: true,
    showHomeFeed: false,
    showRelated: false,
    showComments: false,
    showShorts: false,
    showMixPanel: true,
    showDescription: false
  });

  let settings = { ...DEFAULTS };

  function pageKind() {
    const path = location.pathname;
    if (path === '/') return 'home';
    if (path === '/results') return 'search';
    if (path.startsWith('/shorts/')) return 'shorts';
    if (path.startsWith('/playlist')) return 'playlist';
    return 'other';
  }

  function applyState() {
    const root = document.documentElement;
    if (!root) return;

    root.dataset.aeroLite = settings.liteEnabled ? 'on' : 'off';
    root.dataset.aeroPage = pageKind();
    root.dataset.aeroHomeFeed = settings.showHomeFeed ? 'show' : 'hide';
    root.dataset.aeroRelated = settings.showRelated ? 'show' : 'hide';
    root.dataset.aeroComments = settings.showComments ? 'show' : 'hide';
    root.dataset.aeroShorts = settings.showShorts ? 'show' : 'hide';
    root.dataset.aeroMixPanel = settings.showMixPanel ? 'show' : 'hide';
    root.dataset.aeroDescription = settings.showDescription ? 'show' : 'hide';
  }

  function watchTarget(href) {
    let target;
    try {
      target = new URL(href, location.origin);
    } catch (_) {
      return '';
    }

    if (target.hostname.replace(/^www\./, '') !== 'youtube.com') return '';
    if (target.pathname !== '/watch') return '';
    if (!/^[A-Za-z0-9_-]{11}$/.test(target.searchParams.get('v') || '')) return '';
    return target.toString();
  }

  async function loadSettings() {
    try {
      settings = { ...DEFAULTS, ...(await chrome.storage.sync.get(DEFAULTS)) };
    } catch (_) {
      settings = { ...DEFAULTS };
    }
    applyState();
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') return;

    let changed = false;
    for (const key of Object.keys(DEFAULTS)) {
      if (!changes[key]) continue;
      settings[key] = changes[key].newValue;
      changed = true;
    }

    if (changed) applyState();
  });

  document.addEventListener('click', event => {
    if (!settings.liteEnabled) return;
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const anchor = event.target && event.target.closest
      ? event.target.closest('a[href]')
      : null;
    if (!anchor) return;
    if (anchor.target && anchor.target !== '_self') return;

    const target = watchTarget(anchor.href);
    if (!target) return;

    // Force a real document navigation so takeover-main.js runs before the
    // native YouTube watch SPA has a chance to boot.
    event.preventDefault();
    event.stopImmediatePropagation();
    location.assign(target);
  }, true);

  document.addEventListener('yt-navigate-finish', applyState, true);
  document.addEventListener('yt-page-data-updated', applyState, true);
  window.addEventListener('popstate', applyState);

  applyState();
  loadSettings();
})();
