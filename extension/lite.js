'use strict';

const DEFAULTS = Object.freeze({
  liteEnabled: true,
  nativeMode: true,
  showHomeFeed: false,
  showRelated: false,
  showComments: false,
  showShorts: false,
  showMixPanel: true,
  showDescription: false
});

let settings = { ...DEFAULTS };
let shellMountQueued = false;

function pageKind() {
  const path = location.pathname;
  if (path === '/') return 'home';
  if (path === '/watch') return 'watch';
  if (path === '/results') return 'search';
  if (path.startsWith('/shorts/')) return 'shorts';
  if (path.startsWith('/playlist')) return 'playlist';
  return 'other';
}

function nativeModeActive() {
  return Boolean(
    settings.nativeMode &&
    pageKind() === 'watch'
  );
}

function currentVideoTitle() {
  const selectors = [
    'ytd-watch-metadata h1 yt-formatted-string',
    'h1.ytd-watch-metadata yt-formatted-string',
    'meta[name="title"]'
  ];

  for (const selector of selectors) {
    const node = document.querySelector(selector);
    const value = node
      ? (node.getAttribute && node.getAttribute('content')) || node.textContent
      : '';
    const clean = String(value || '').replace(/\s+/g, ' ').trim();
    if (clean) return clean;
  }

  return document.title
    .replace(/\s*-\s*YouTube\s*$/i, '')
    .replace(/^\(\d+\)\s*/, '')
    .trim();
}

function removeNativeShell() {
  const shell = document.getElementById('aero-native-shell');
  if (shell) shell.remove();
}

function updateNativeShell() {
  const shell = document.getElementById('aero-native-shell');
  if (!shell) return;

  const title = shell.querySelector('[data-aero-native-title]');
  if (title) title.textContent = currentVideoTitle() || 'YouTube video';

  const search = shell.querySelector('input[type="search"]');
  if (search && document.activeElement !== search) {
    search.placeholder = 'Search YouTube';
  }
}

function mountNativeShell() {
  shellMountQueued = false;

  if (!nativeModeActive()) {
    removeNativeShell();
    return;
  }

  if (!document.body) {
    if (!shellMountQueued) {
      shellMountQueued = true;
      document.addEventListener('DOMContentLoaded', mountNativeShell, { once:true });
    }
    return;
  }

  let shell = document.getElementById('aero-native-shell');

  if (!shell) {
    shell = document.createElement('header');
    shell.id = 'aero-native-shell';
    shell.setAttribute('role', 'banner');
    shell.innerHTML = `
      <div class="aero-native-brand" aria-label="Aero Native">
        <span class="aero-native-mark" aria-hidden="true"></span>
        <span class="aero-native-word">Aero</span>
        <span class="aero-native-x">×</span>
        <span class="aero-native-youtube">YouTube</span>
        <span class="aero-native-badge">NATIVE</span>
      </div>

      <div class="aero-native-current" title="Current YouTube video">
        <span class="aero-native-session">FIRST-PARTY YOUTUBE SESSION</span>
        <strong data-aero-native-title>YouTube video</strong>
      </div>

      <form class="aero-native-search" role="search">
        <input type="search" autocomplete="off" spellcheck="false" aria-label="Search YouTube" placeholder="Search YouTube">
        <button type="submit">Search</button>
      </form>

      <button class="aero-native-exit" type="button">Exit Aero</button>
    `;

    shell.querySelector('.aero-native-search').addEventListener('submit', event => {
      event.preventDefault();
      const input = shell.querySelector('input[type="search"]');
      const query = String(input && input.value || '').trim();
      if (!query) return;
      location.href = '/results?search_query=' + encodeURIComponent(query);
    });

    shell.querySelector('.aero-native-exit').addEventListener('click', async () => {
      settings.nativeMode = false;
      applyState();
      try {
        await chrome.storage.sync.set({ nativeMode:false });
      } catch (_) {}
    });

    document.body.prepend(shell);
  }

  updateNativeShell();
}

function applyState() {
  const root = document.documentElement;
  if (!root) return;

  const kind = pageKind();
  root.dataset.aeroLite = settings.liteEnabled ? 'on' : 'off';
  root.dataset.aeroNative = (
    settings.nativeMode &&
    kind === 'watch'
  ) ? 'on' : 'off';
  root.dataset.aeroPage = kind;
  root.dataset.aeroHomeFeed = settings.showHomeFeed ? 'show' : 'hide';
  root.dataset.aeroRelated = settings.showRelated ? 'show' : 'hide';
  root.dataset.aeroComments = settings.showComments ? 'show' : 'hide';
  root.dataset.aeroShorts = settings.showShorts ? 'show' : 'hide';
  root.dataset.aeroMixPanel = settings.showMixPanel ? 'show' : 'hide';
  root.dataset.aeroDescription = settings.showDescription ? 'show' : 'hide';

  mountNativeShell();
}

async function loadSettings() {
  try {
    const saved = await chrome.storage.sync.get(null);
    const hasNativePreference = Object.prototype.hasOwnProperty.call(saved, 'nativeMode');

    settings = { ...DEFAULTS, ...saved };

    // v0.10.1 migration: Native Mode is independent from the legacy Super Lite
    // master switch. Existing v0.4.x users should see the new experiment on
    // first upgrade even if Super Lite had previously been stored as off.
    if (!hasNativePreference) {
      settings.nativeMode = true;
      await chrome.storage.sync.set({ nativeMode:true });
    }
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

function refreshForYouTubeNavigation() {
  applyState();
  updateNativeShell();
}

document.addEventListener('yt-navigate-finish', refreshForYouTubeNavigation, true);
document.addEventListener('yt-page-data-updated', refreshForYouTubeNavigation, true);
window.addEventListener('popstate', refreshForYouTubeNavigation);

applyState();
loadSettings();
