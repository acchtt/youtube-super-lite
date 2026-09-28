'use strict';

const DEFAULTS = Object.freeze({
  liteEnabled: true,
  deepTrimEnabled: true,
  showHomeFeed: false,
  showRelated: false,
  showComments: false,
  showShorts: false,
  showMixPanel: true,
  showDescription: false
});

const RELOAD_TO_RESTORE_KEYS = new Set([
  'liteEnabled',
  'deepTrimEnabled',
  'showHomeFeed',
  'showRelated',
  'showComments',
  'showShorts',
  'showDescription'
]);

let settings = { ...DEFAULTS };
let settingsReady = false;
let trimScheduled = false;
let trimObserver = null;

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
  root.dataset.aeroDeepTrim = settings.deepTrimEnabled ? 'on' : 'off';
  root.dataset.aeroPage = pageKind();
  root.dataset.aeroHomeFeed = settings.showHomeFeed ? 'show' : 'hide';
  root.dataset.aeroRelated = settings.showRelated ? 'show' : 'hide';
  root.dataset.aeroComments = settings.showComments ? 'show' : 'hide';
  root.dataset.aeroShorts = settings.showShorts ? 'show' : 'hide';
  root.dataset.aeroMixPanel = settings.showMixPanel ? 'show' : 'hide';
  root.dataset.aeroDescription = settings.showDescription ? 'show' : 'hide';
}

function removeSelector(selector) {
  let nodes;
  try {
    nodes = document.querySelectorAll(selector);
  } catch (_) {
    return 0;
  }

  let removed = 0;

  for (const node of nodes) {
    // Protect all native player and Mix/playlist machinery even if a future
    // YouTube DOM change causes a broad selector to overlap it.
    if (
      node.closest &&
      (
        node.closest('#movie_player') ||
        node.closest('ytd-player') ||
        node.matches('ytd-playlist-panel-renderer') ||
        node.closest('ytd-playlist-panel-renderer')
      )
    ) {
      continue;
    }

    node.remove();
    removed += 1;
  }

  return removed;
}

function deepTrim() {
  if (!settingsReady || !settings.liteEnabled || !settings.deepTrimEnabled) return;

  // Always-disposable chrome/modules. These are not required for native
  // playback, account history, quality controls, Theater mode or Mix state.
  const alwaysRemove = [
    'ytd-guide-renderer',
    'ytd-mini-guide-renderer',
    'tp-yt-app-drawer#guide',
    'ytd-feed-filter-chip-bar-renderer',
    'yt-chip-cloud-renderer',
    'ytd-live-chat-frame',
    'ytd-merch-shelf-renderer',
    'ytd-offer-module-renderer',
    'ytd-donation-shelf-renderer',
    'ytd-ticket-shelf-renderer',
    'ytd-product-list-renderer',
    'ytd-brand-video-shelf-renderer',
    '.ytp-ce-element',
    '.ytp-endscreen-content'
  ];

  for (const selector of alwaysRemove) removeSelector(selector);

  if (!settings.showComments) {
    removeSelector('ytd-comments');
    removeSelector('ytd-comments-header-renderer');
    removeSelector('#comments');
  }

  if (!settings.showRelated) {
    // Do not remove #secondary or ytd-playlist-panel-renderer: native Mixes
    // live in the same general rail. Only remove recommendation renderers.
    removeSelector('ytd-watch-next-secondary-results-renderer');
  }

  if (!settings.showDescription) {
    removeSelector('ytd-watch-metadata #description');
    removeSelector('ytd-text-inline-expander#description-inline-expander');
    removeSelector('ytd-metadata-row-container-renderer');
  }

  if (!settings.showShorts) {
    removeSelector('ytd-reel-shelf-renderer');
    removeSelector('ytd-rich-section-renderer:has(ytd-reel-shelf-renderer)');
    removeSelector('ytd-video-renderer:has(a[href^="/shorts/"])');
    removeSelector('ytd-grid-video-renderer:has(a[href^="/shorts/"])');
    removeSelector('ytd-rich-item-renderer:has(a[href^="/shorts/"])');
  }

  if (!settings.showHomeFeed && pageKind() === 'home') {
    removeSelector('ytd-browse[page-subtype="home"] ytd-rich-grid-renderer');
  }

  // showMixPanel is deliberately CSS-only. Removing the playlist renderer
  // risks destroying YouTube's native Mix/playlist state.
}

function scheduleTrim() {
  if (
    trimScheduled ||
    !settingsReady ||
    !settings.liteEnabled ||
    !settings.deepTrimEnabled
  ) {
    return;
  }

  trimScheduled = true;

  const run = () => {
    trimScheduled = false;
    deepTrim();
  };

  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 350 });
  } else {
    setTimeout(run, 80);
  }
}

function startTrimObserver() {
  if (trimObserver || !document.documentElement) return;

  trimObserver = new MutationObserver(mutations => {
    // React only to insertions. Our own removals should not schedule another
    // pass, which keeps observer overhead very small.
    const hasInsertions = mutations.some(mutation => mutation.addedNodes.length > 0);
    if (hasInsertions) scheduleTrim();
  });

  trimObserver.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  scheduleTrim();
}

function settingChangeNeedsReload(changes) {
  if (!settings.deepTrimEnabled) return false;

  for (const [key, change] of Object.entries(changes)) {
    if (!RELOAD_TO_RESTORE_KEYS.has(key)) continue;

    if (key === 'liteEnabled' && change.oldValue === true && change.newValue === false) {
      return true;
    }

    if (key === 'deepTrimEnabled' && change.oldValue === true && change.newValue === false) {
      return true;
    }

    if (key.startsWith('show') && change.oldValue === false && change.newValue === true) {
      return true;
    }
  }

  return false;
}

async function loadSettings() {
  try {
    settings = { ...DEFAULTS, ...(await chrome.storage.sync.get(DEFAULTS)) };
  } catch (_) {
    settings = { ...DEFAULTS };
  }

  settingsReady = true;
  applyState();
  startTrimObserver();
  scheduleTrim();
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync') return;

  const previous = { ...settings };
  let changed = false;

  for (const key of Object.keys(DEFAULTS)) {
    if (!changes[key]) continue;
    settings[key] = changes[key].newValue;
    changed = true;
  }

  if (!changed) return;

  settingsReady = true;
  applyState();

  const reloadNeeded = settingChangeNeedsReload(
    Object.fromEntries(
      Object.keys(changes).map(key => [
        key,
        {
          oldValue: previous[key],
          newValue: settings[key]
        }
      ])
    )
  );

  if (reloadNeeded) {
    location.reload();
    return;
  }

  startTrimObserver();
  scheduleTrim();
});

document.addEventListener('yt-navigate-finish', () => {
  applyState();
  scheduleTrim();
}, true);

document.addEventListener('yt-page-data-updated', () => {
  applyState();
  scheduleTrim();
}, true);

window.addEventListener('popstate', () => {
  applyState();
  scheduleTrim();
});

applyState();

if (document.documentElement) startTrimObserver();
else document.addEventListener('DOMContentLoaded', startTrimObserver, { once:true });

loadSettings();
