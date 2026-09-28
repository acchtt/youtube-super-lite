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

const MIX_STORAGE_PREFIX = 'aero_super_lite_mix:';
const captureButton = document.getElementById('capture');
const nativeButton = document.getElementById('native');
const status = document.getElementById('status');
const settingInputs = Object.fromEntries(
  Object.keys(DEFAULTS).map(key => [key, document.getElementById(key)])
);

function setStatus(text, kind) {
  status.textContent = text;
  status.className = kind || '';
}

async function loadSettings() {
  const saved = await chrome.storage.sync.get(DEFAULTS);
  for (const [key, input] of Object.entries(settingInputs)) {
    input.checked = Boolean(saved[key]);
  }
}

for (const [key, input] of Object.entries(settingInputs)) {
  input.addEventListener('change', async () => {
    await chrome.storage.sync.set({ [key]: input.checked });
    setStatus('Settings updated.', 'ok');
  });
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active:true, currentWindow:true });
  return tabs && tabs[0] ? tabs[0] : null;
}

function watchUrlFromTabUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch (_) {
    return null;
  }

  const host = url.hostname.replace(/^www\./, '');
  if (host !== 'youtube.com') return null;

  if (url.pathname === '/watch') {
    url.searchParams.set('aero_native', '1');
    return url;
  }

  const match = url.pathname.match(/^\/embed\/([A-Za-z0-9_-]{11})/);
  if (!match) return null;

  const watch = new URL('https://www.youtube.com/watch');
  watch.searchParams.set('v', match[1]);

  const listId = url.searchParams.get('aero_list') || '';
  const index = url.searchParams.get('aero_index') || '';

  if (listId) watch.searchParams.set('list', listId);
  if (index && /^\d+$/.test(index)) watch.searchParams.set('index', index);
  watch.searchParams.set('aero_native', '1');
  return watch;
}

function scrapeCurrentMix() {
  let pageUrl;
  try {
    pageUrl = new URL(location.href);
  } catch (_) {
    return { error:'This page is not a valid YouTube page.' };
  }

  const root = document.documentElement;
  const listId =
    (root && root.dataset.aeroListId) ||
    pageUrl.searchParams.get('aero_list') ||
    pageUrl.searchParams.get('list') ||
    '';

  const seedId =
    (root && root.dataset.aeroMixSeedId) ||
    pageUrl.searchParams.get('aero_seed') ||
    pageUrl.searchParams.get('v') ||
    (pageUrl.pathname.match(/^\/embed\/([A-Za-z0-9_-]{11})/) || [])[1] ||
    '';

  if (root && root.dataset.aeroEmbed === 'on') {
    let ids = [];

    try {
      const parsed = JSON.parse(root.dataset.aeroPlaylistIds || '[]');
      if (Array.isArray(parsed)) {
        ids = parsed.filter(id => typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id));
      }
    } catch (_) {}

    if (!ids.length && listId) {
      try {
        const cached = JSON.parse(sessionStorage.getItem(MIX_STORAGE_PREFIX + listId) || 'null');
        if (cached && Array.isArray(cached.ids)) {
          ids = cached.ids.filter(id => typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id));
        }
      } catch (_) {}
    }

    if (!listId) return { error:'This video is not currently part of a Mix/playlist.' };
    if (ids.length < 2) return { error:'Mix order is not ready yet. Wait a moment and try again.' };

    return { snapshot:{ seedId, listId, ids:ids.slice(0,100) } };
  }

  if (pageUrl.pathname !== '/watch') {
    return { error:'Open a YouTube Mix/watch page first.' };
  }

  const nativeListId = pageUrl.searchParams.get('list') || '';
  const nativeSeedId = pageUrl.searchParams.get('v') || '';
  if (!nativeSeedId || !nativeListId) {
    return { error:'This YouTube page does not contain a Mix/playlist.' };
  }

  const panels = Array.from(document.querySelectorAll('ytd-playlist-panel-renderer'))
    .filter(panel => panel.offsetParent !== null && panel.querySelector('ytd-playlist-panel-video-renderer'));

  const panel =
    panels.find(candidate => candidate.querySelector('ytd-playlist-panel-video-renderer[selected]')) ||
    panels[0] ||
    null;

  const rows = panel ? Array.from(panel.querySelectorAll('ytd-playlist-panel-video-renderer')) : [];
  const ids = [];

  for (const row of rows) {
    const anchor =
      row.querySelector('a#wc-endpoint[href*="/watch?"]') ||
      row.querySelector('a#video-title[href*="/watch?"]') ||
      row.querySelector('a[href*="/watch?"]');

    if (!anchor) continue;

    try {
      const u = new URL(anchor.href || anchor.getAttribute('href'), location.origin);
      const id = u.searchParams.get('v') || '';
      if (/^[A-Za-z0-9_-]{11}$/.test(id)) ids.push(id);
    } catch (_) {}

    if (ids.length >= 100) break;
  }

  if (ids.length < 2) return { error:'Aero could not read enough songs from the visible Mix panel.' };

  return { snapshot:{ seedId:nativeSeedId, listId:nativeListId, ids } };
}

nativeButton.addEventListener('click', async () => {
  try {
    const tab = await getActiveTab();
    if (!tab || !tab.id) throw new Error('No active tab found.');

    const target = watchUrlFromTabUrl(String(tab.url || ''));
    if (!target) throw new Error('Open a YouTube video first.');

    await chrome.tabs.update(tab.id, { url:target.toString() });
    window.close();
  } catch (error) {
    setStatus(error && error.message ? error.message : 'Could not open native page.', 'err');
  }
});

captureButton.addEventListener('click', async () => {
  captureButton.disabled = true;
  setStatus('Reading the current Mix…');

  try {
    const tab = await getActiveTab();
    if (!tab || !tab.id) throw new Error('No active tab found.');

    const url = String(tab.url || '');
    if (!url.startsWith('https://www.youtube.com/') && !url.startsWith('https://youtube.com/')) {
      throw new Error('Open the personalized Mix on youtube.com first.');
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapeCurrentMix
    });

    const result = results && results[0] && results[0].result;
    if (!result) throw new Error('The Mix could not be read.');
    if (result.error) throw new Error(result.error);

    const compact = {
      v: 1,
      listId: result.snapshot.listId,
      seedId: result.snapshot.seedId,
      ids: result.snapshot.ids
    };

    const encoded = btoa(JSON.stringify(compact))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');

    setStatus('Captured ' + compact.ids.length + ' songs. Opening Aero…', 'ok');

    await chrome.tabs.create({
      url: 'https://aero-x-ive.pages.dev/#aeroMix=' + encoded
    });
  } catch (error) {
    setStatus(error && error.message ? error.message : 'Capture failed.', 'err');
  } finally {
    captureButton.disabled = false;
  }
});

loadSettings().catch(() => setStatus('Could not load extension settings.', 'err'));
