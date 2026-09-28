'use strict';

(() => {
  const DEFAULTS = Object.freeze({
    liteEnabled: true,
    cinemaMode: true,
    hardReloadVideos: true,
    showHomeFeed: false,
    showRelated: false,
    showComments: false,
    showShorts: false,
    showMixPanel: true,
    showDescription: false
  });

  let settings = { ...DEFAULTS };
  let settingsReady = false;
  let reloadQueued = false;

  function parseUrl(value = location.href) {
    try { return new URL(value, location.origin); }
    catch (_) { return null; }
  }

  function validVideo(id) {
    return /^[A-Za-z0-9_-]{11}$/.test(id || '');
  }

  function watchKey(url = parseUrl()) {
    if (!url || url.pathname !== '/watch') return '';
    const v = url.searchParams.get('v') || '';
    if (!validVideo(v)) return '';
    return [v, url.searchParams.get('list') || '', url.searchParams.get('index') || ''].join('|');
  }

  function toMobileWatch(source) {
    const url = typeof source === 'string' ? parseUrl(source) : source;
    if (!url || url.pathname !== '/watch') return '';
    const host = url.hostname.replace(/^www\./, '');
    if (host !== 'youtube.com' && host !== 'm.youtube.com') return '';
    if (!validVideo(url.searchParams.get('v') || '')) return '';

    const target = new URL(url.toString());
    target.hostname = 'm.youtube.com';
    target.searchParams.set('app', 'mobile');
    target.searchParams.set('aero_mobile', '1');
    target.searchParams.delete('aero_native');
    return target.toString();
  }

  const startUrl = parseUrl();
  const startKey = watchKey(startUrl);
  const startedOnMobile = Boolean(startUrl && startUrl.hostname === 'm.youtube.com');

  if (
    startUrl &&
    startUrl.pathname === '/watch' &&
    startUrl.hostname !== 'm.youtube.com' &&
    startUrl.searchParams.get('aero_native') !== '1' &&
    startUrl.searchParams.get('aero_mobile') !== '1'
  ) {
    const target = toMobileWatch(startUrl);
    if (target) {
      location.replace(target);
      return;
    }
  }

  function pageKind() {
    const url = parseUrl();
    if (!url) return 'other';
    if (url.pathname === '/') return 'home';
    if (url.pathname === '/watch') return 'watch';
    if (url.pathname === '/results') return 'search';
    if (url.pathname.startsWith('/shorts/')) return 'shorts';
    return 'other';
  }

  function applyState() {
    const root = document.documentElement;
    if (!root) return;
    const mobile = location.hostname === 'm.youtube.com';

    root.dataset.aeroLite = settings.liteEnabled ? 'on' : 'off';
    root.dataset.aeroMobile = mobile ? 'on' : 'off';
    root.dataset.aeroCinema = settings.cinemaMode ? 'on' : 'off';
    root.dataset.aeroPage = pageKind();
    root.dataset.aeroHomeFeed = settings.showHomeFeed ? 'show' : 'hide';
    root.dataset.aeroRelated = settings.showRelated ? 'show' : 'hide';
    root.dataset.aeroComments = settings.showComments ? 'show' : 'hide';
    root.dataset.aeroShorts = settings.showShorts ? 'show' : 'hide';
    root.dataset.aeroMixPanel = settings.showMixPanel ? 'show' : 'hide';
    root.dataset.aeroDescription = settings.showDescription ? 'show' : 'hide';
  }

  function resetAfterSpaVideoChange() {
    if (
      !settingsReady ||
      !settings.liteEnabled ||
      !settings.hardReloadVideos ||
      reloadQueued ||
      location.hostname !== 'm.youtube.com' ||
      pageKind() !== 'watch'
    ) return;

    const current = watchKey();
    if (startedOnMobile && startKey && current && current !== startKey) {
      reloadQueued = true;
      location.reload();
    }
  }

  async function loadSettings() {
    try {
      settings = { ...DEFAULTS, ...(await chrome.storage.sync.get(DEFAULTS)) };
    } catch (_) {}
    settingsReady = true;
    applyState();
    resetAfterSpaVideoChange();
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    for (const key of Object.keys(DEFAULTS)) {
      if (changes[key]) settings[key] = changes[key].newValue;
    }
    settingsReady = true;
    applyState();
  });

  document.addEventListener('click', event => {
    if (!settingsReady || !settings.liteEnabled) return;
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const anchor = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!anchor || (anchor.target && anchor.target !== '_self')) return;

    const target = toMobileWatch(anchor.href);
    if (!target) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    location.assign(target);
  }, true);

  document.addEventListener('yt-navigate-finish', () => {
    applyState();
    resetAfterSpaVideoChange();
  }, true);
  document.addEventListener('yt-page-data-updated', applyState, true);
  window.addEventListener('popstate', () => {
    applyState();
    resetAfterSpaVideoChange();
  });

  applyState();
  loadSettings();
})();
