'use strict';

const DEFAULTS = Object.freeze({
  liteEnabled: true,
  litePlayerEnabled: true,
  showHomeFeed: false,
  showRelated: false,
  showComments: false,
  showShorts: false,
  showMixPanel: true,
  showDescription: false
});

let settings = { ...DEFAULTS };
let settingsReady = false;

function pageKind() {
  const path = location.pathname;
  if (path === '/') return 'home';
  if (path === '/watch') return 'watch';
  if (path === '/results') return 'search';
  if (path.startsWith('/shorts/')) return 'shorts';
  if (path.startsWith('/playlist')) return 'playlist';
  return 'other';
}

function isFullYouTubeBypass(url = new URL(location.href)) {
  return url.pathname === '/watch' && url.searchParams.get('aero_full') === '1';
}

function applyState() {
  const root = document.documentElement;
  if (!root) return;

  let bypass = false;
  try {
    bypass = isFullYouTubeBypass();
  } catch (_) {}

  root.dataset.aeroLite = settings.liteEnabled && !bypass ? 'on' : 'off';
  root.dataset.aeroPage = pageKind();
  root.dataset.aeroHomeFeed = settings.showHomeFeed ? 'show' : 'hide';
  root.dataset.aeroRelated = settings.showRelated ? 'show' : 'hide';
  root.dataset.aeroComments = settings.showComments ? 'show' : 'hide';
  root.dataset.aeroShorts = settings.showShorts ? 'show' : 'hide';
  root.dataset.aeroMixPanel = settings.showMixPanel ? 'show' : 'hide';
  root.dataset.aeroDescription = settings.showDescription ? 'show' : 'hide';
}

function buildLitePlayerUrl(sourceHref) {
  let source;
  try {
    source = new URL(sourceHref, location.origin);
  } catch (_) {
    return '';
  }

  if (!/^https:\/\/(?:www\.)?youtube\.com$/.test(source.origin)) return '';
  if (source.pathname !== '/watch') return '';
  if (source.searchParams.get('aero_full') === '1') return '';

  const videoId = source.searchParams.get('v') || '';
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return '';

  const params = new URLSearchParams();
  params.set('v', videoId);

  for (const key of ['list', 'index', 't', 'start']) {
    const value = source.searchParams.get(key);
    if (value) params.set(key, value);
  }

  params.set('source', source.toString());
  return chrome.runtime.getURL('player.html') + '?' + params.toString();
}

function maybeRouteToLitePlayer(sourceHref = location.href, replace = true) {
  if (!settingsReady || !settings.liteEnabled || !settings.litePlayerEnabled) return false;

  const target = buildLitePlayerUrl(sourceHref);
  if (!target) return false;

  if (replace) location.replace(target);
  else location.href = target;
  return true;
}

async function loadSettings() {
  try {
    settings = { ...DEFAULTS, ...(await chrome.storage.sync.get(DEFAULTS)) };
  } catch (_) {
    settings = { ...DEFAULTS };
  }

  settingsReady = true;
  applyState();
  maybeRouteToLitePlayer(location.href, true);
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync') return;

  let changed = false;
  for (const key of Object.keys(DEFAULTS)) {
    if (!changes[key]) continue;
    settings[key] = changes[key].newValue;
    changed = true;
  }

  if (!changed) return;
  settingsReady = true;
  applyState();
  maybeRouteToLitePlayer(location.href, true);
});

document.addEventListener('click', event => {
  if (!settingsReady || !settings.liteEnabled || !settings.litePlayerEnabled) return;
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  const anchor = event.target && event.target.closest
    ? event.target.closest('a[href]')
    : null;
  if (!anchor) return;
  if (anchor.target && anchor.target !== '_self') return;

  const target = buildLitePlayerUrl(anchor.href);
  if (!target) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  location.href = target;
}, true);

document.addEventListener('yt-navigate-start', () => {
  queueMicrotask(() => maybeRouteToLitePlayer(location.href, true));
}, true);

document.addEventListener('yt-navigate-finish', applyState, true);
document.addEventListener('yt-page-data-updated', applyState, true);
window.addEventListener('popstate', () => {
  applyState();
  maybeRouteToLitePlayer(location.href, true);
});

applyState();
loadSettings();
