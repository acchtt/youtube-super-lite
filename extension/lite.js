'use strict';

const DEFAULTS = Object.freeze({
  liteEnabled: true,
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
let hardReloadQueued = false;

function pageKind(url = location.href) {
  let parsed;
  try {
    parsed = new URL(url, location.origin);
  } catch (_) {
    return 'other';
  }

  const path = parsed.pathname;
  if (path === '/') return 'home';
  if (path === '/watch') return 'watch';
  if (path === '/results') return 'search';
  if (path.startsWith('/shorts/')) return 'shorts';
  if (path.startsWith('/playlist')) return 'playlist';
  return 'other';
}

function watchKey(url = location.href) {
  let parsed;
  try {
    parsed = new URL(url, location.origin);
  } catch (_) {
    return '';
  }

  if (!/^(?:www\.)?youtube\.com$/.test(parsed.hostname)) return '';
  if (parsed.pathname !== '/watch') return '';

  const videoId = parsed.searchParams.get('v') || '';
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return '';

  // list + index are part of the identity so repeated videos inside a Mix
  // still receive a fresh document when their playlist position changes.
  return [
    videoId,
    parsed.searchParams.get('list') || '',
    parsed.searchParams.get('index') || ''
  ].join('|');
}

const documentStartKind = pageKind();
const documentStartWatchKey = watchKey();
let leftStartingWatch = false;

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

function shouldHardNavigate(targetHref) {
  if (!settingsReady || !settings.liteEnabled || !settings.hardReloadVideos) return false;

  let target;
  try {
    target = new URL(targetHref, location.origin);
  } catch (_) {
    return false;
  }

  if (!/^(?:www\.)?youtube\.com$/.test(target.hostname)) return false;
  if (target.pathname !== '/watch') return false;

  const targetKey = watchKey(target.toString());
  if (!targetKey) return false;

  // Entering watch from Home/Search should always start a fresh document.
  if (pageKind() !== 'watch') return true;

  return targetKey !== watchKey();
}

function forceFreshCurrentWatchIfNeeded() {
  if (!settingsReady || !settings.liteEnabled || !settings.hardReloadVideos) return;
  if (hardReloadQueued || pageKind() !== 'watch') return;

  const currentKey = watchKey();
  if (!currentKey) return;

  // If this document did not begin on this exact watch/list/index state,
  // YouTube reached it through SPA navigation. Reload once to discard the
  // previous video's application state and component/cache accumulation.
  const needsFreshDocument =
    documentStartKind !== 'watch' ||
    leftStartingWatch ||
    currentKey !== documentStartWatchKey;

  if (!needsFreshDocument) return;

  hardReloadQueued = true;
  location.reload();
}

async function loadSettings() {
  try {
    settings = { ...DEFAULTS, ...(await chrome.storage.sync.get(DEFAULTS)) };
  } catch (_) {
    settings = { ...DEFAULTS };
  }

  settingsReady = true;
  applyState();
  forceFreshCurrentWatchIfNeeded();
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
});

document.addEventListener('click', event => {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  const anchor = event.target && event.target.closest
    ? event.target.closest('a[href]')
    : null;
  if (!anchor) return;
  if (anchor.target && anchor.target !== '_self') return;
  if (!shouldHardNavigate(anchor.href)) return;

  // Bypass YouTube's SPA router for video changes. Native YouTube still owns
  // playback, history, theater mode, quality controls and Mix behavior.
  event.preventDefault();
  event.stopImmediatePropagation();
  location.assign(anchor.href);
}, true);

document.addEventListener('yt-navigate-finish', () => {
  applyState();

  if (pageKind() !== 'watch' && documentStartKind === 'watch') {
    leftStartingWatch = true;
  }

  forceFreshCurrentWatchIfNeeded();
}, true);

document.addEventListener('yt-page-data-updated', applyState, true);

window.addEventListener('popstate', () => {
  applyState();

  if (pageKind() !== 'watch' && documentStartKind === 'watch') {
    leftStartingWatch = true;
  }

  forceFreshCurrentWatchIfNeeded();
});

applyState();
loadSettings();
