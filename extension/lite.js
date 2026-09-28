'use strict';

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
  if (path === '/watch') return 'watch';
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

document.addEventListener('yt-navigate-finish', applyState, true);
document.addEventListener('yt-page-data-updated', applyState, true);
window.addEventListener('popstate', applyState);

applyState();
loadSettings();
