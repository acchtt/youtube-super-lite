'use strict';

const DEFAULTS = Object.freeze({
  liteEnabled: true,
  memoryResetEvery: 3,
  showHomeFeed: false,
  showRelated: false,
  showComments: false,
  showShorts: false,
  showMixPanel: true,
  showDescription: false
});

const THEATER_RESTORE_KEY = 'aero_super_lite_restore_theater';

let settings = { ...DEFAULTS };
let settingsReady = false;
let lastWatchIdentity = getWatchIdentity();
let videosInDocument = lastWatchIdentity ? 1 : 0;
let resetScheduled = false;

function pageKind() {
  const path = location.pathname;
  if (path === '/') return 'home';
  if (path === '/watch') return 'watch';
  if (path === '/results') return 'search';
  if (path.startsWith('/shorts/')) return 'shorts';
  if (path.startsWith('/playlist')) return 'playlist';
  return 'other';
}

function getWatchIdentity() {
  if (location.pathname !== '/watch') return '';

  let url;
  try {
    url = new URL(location.href);
  } catch (_) {
    return '';
  }

  const videoId = url.searchParams.get('v') || '';
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return '';

  // Include list + index so repeated videos in a Mix/playlist still count as
  // separate playlist positions while the actual current URL is preserved.
  return [
    videoId,
    url.searchParams.get('list') || '',
    url.searchParams.get('index') || ''
  ].join('|');
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

function rememberTheaterMode() {
  try {
    const flexy = document.querySelector('ytd-watch-flexy');
    if (flexy && flexy.hasAttribute('theater')) {
      sessionStorage.setItem(THEATER_RESTORE_KEY, '1');
    } else {
      sessionStorage.removeItem(THEATER_RESTORE_KEY);
    }
  } catch (_) {}
}

function restoreTheaterMode() {
  let shouldRestore = false;

  try {
    shouldRestore = sessionStorage.getItem(THEATER_RESTORE_KEY) === '1';
  } catch (_) {
    return false;
  }

  if (!shouldRestore || location.pathname !== '/watch') return false;

  const flexy = document.querySelector('ytd-watch-flexy');
  if (!flexy) return false;

  if (flexy.hasAttribute('theater')) {
    try { sessionStorage.removeItem(THEATER_RESTORE_KEY); } catch (_) {}
    return true;
  }

  const sizeButton = document.querySelector('.ytp-size-button');
  if (!sizeButton) return false;

  sizeButton.click();

  try { sessionStorage.removeItem(THEATER_RESTORE_KEY); } catch (_) {}
  return true;
}

function scheduleTheaterRestoreAttempts() {
  restoreTheaterMode();
  setTimeout(restoreTheaterMode, 300);
  setTimeout(restoreTheaterMode, 900);
  setTimeout(restoreTheaterMode, 1800);
}

function memoryResetThreshold() {
  const value = Number(settings.memoryResetEvery);
  return Number.isInteger(value) && value >= 2 ? value : 0;
}

function maybeResetMemory() {
  if (!settingsReady || !settings.liteEnabled || resetScheduled) return;

  const threshold = memoryResetThreshold();
  if (!threshold || location.pathname !== '/watch') return;
  if (videosInDocument < threshold) return;

  resetScheduled = true;
  rememberTheaterMode();

  // Wait briefly for YouTube to settle the new video's exact v/list/index URL.
  // location.reload() then reloads that URL unchanged, so native Mix state,
  // account/history behavior, player controls and quality selection stay native.
  setTimeout(() => {
    location.reload();
  }, 250);
}

function observeVideoNavigation() {
  const currentIdentity = getWatchIdentity();
  if (!currentIdentity) return;

  if (!lastWatchIdentity) {
    lastWatchIdentity = currentIdentity;
    videosInDocument = Math.max(videosInDocument, 1);
    maybeResetMemory();
    return;
  }

  if (currentIdentity === lastWatchIdentity) return;

  lastWatchIdentity = currentIdentity;
  videosInDocument += 1;
  maybeResetMemory();
}

async function loadSettings() {
  try {
    settings = { ...DEFAULTS, ...(await chrome.storage.sync.get(DEFAULTS)) };
  } catch (_) {
    settings = { ...DEFAULTS };
  }

  settingsReady = true;
  applyState();
  scheduleTheaterRestoreAttempts();
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync') return;

  let changed = false;
  for (const key of Object.keys(DEFAULTS)) {
    if (!changes[key]) continue;
    settings[key] = changes[key].newValue;
    changed = true;
  }

  if (changed) {
    settingsReady = true;
    applyState();
  }
});

document.addEventListener('yt-navigate-finish', () => {
  applyState();
  observeVideoNavigation();
  restoreTheaterMode();
}, true);

document.addEventListener('yt-page-data-updated', () => {
  applyState();
  restoreTheaterMode();
}, true);

window.addEventListener('popstate', () => {
  applyState();
  observeVideoNavigation();
});

applyState();
loadSettings();
