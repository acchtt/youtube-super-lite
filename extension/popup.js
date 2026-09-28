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
    setStatus(
      key === 'liteEnabled' && !input.checked
        ? 'Super Lite browsing is off. The v0.7 watch takeover remains the active experiment.'
        : 'Settings updated.',
      'ok'
    );
  });
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active:true, currentWindow:true });
  return tabs && tabs[0] ? tabs[0] : null;
}

function scrapeCurrentMix() {
  let pageUrl;
  try {
    pageUrl = new URL(location.href);
  } catch (_) {
    return { error:'This page is not a valid YouTube Mix.' };
  }

  const root = document.documentElement;
  if (root && root.dataset.aeroTakeover === 'on') {
    const listId = root.dataset.aeroListId || pageUrl.searchParams.get('list') || '';
    const seedId = root.dataset.aeroMixSeedId || pageUrl.searchParams.get('v') || '';
    let ids = [];

    try {
      const parsed = JSON.parse(root.dataset.aeroPlaylistIds || '[]');
      if (Array.isArray(parsed)) {
        ids = parsed.filter(id => typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id));
      }
    } catch (_) {}

    if (!listId) return { error:'This lightweight watch page is not currently playing a Mix/playlist.' };
    if (ids.length < 2) {
      return { error:'The Mix queue is not ready yet. Let playback start, then try Capture current Mix again.' };
    }

    return {
      snapshot: {
        seedId,
        listId,
        ids: ids.slice(0, 100)
      }
    };
  }

  if (pageUrl.hostname.replace(/^www\./, '') !== 'youtube.com' || pageUrl.pathname !== '/watch') {
    return { error:'Open a YouTube Mix/watch page first.' };
  }

  const seedId = pageUrl.searchParams.get('v') || '';
  const listId = pageUrl.searchParams.get('list') || '';
  if (!seedId || !listId) {
    return { error:'This YouTube page does not contain a Mix/playlist.' };
  }

  const panels = Array.from(document.querySelectorAll('ytd-playlist-panel-renderer'))
    .filter(panel => panel.offsetParent !== null && panel.querySelector('ytd-playlist-panel-video-renderer'));

  const panel =
    panels.find(candidate => candidate.querySelector('ytd-playlist-panel-video-renderer[selected]')) ||
    panels[0] ||
    null;

  const rows = panel
    ? Array.from(panel.querySelectorAll('ytd-playlist-panel-video-renderer'))
    : [];

  if (rows.length < 2) {
    return { error:'The visible Mix panel is not loaded yet.' };
  }

  const ids = [];

  for (const row of rows) {
    const anchor =
      row.querySelector('a#wc-endpoint[href*="/watch?"]') ||
      row.querySelector('a#video-title[href*="/watch?"]') ||
      row.querySelector('a[href*="/watch?"]');

    if (!anchor) continue;

    let url;
    try {
      url = new URL(anchor.href || anchor.getAttribute('href'), location.origin);
    } catch (_) {
      continue;
    }

    const id = url.searchParams.get('v') || '';
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) continue;

    ids.push(id);
    if (ids.length >= 100) break;
  }

  if (ids.length < 2) {
    return { error:'Aero could not read enough songs from the visible Mix panel.' };
  }

  return { snapshot:{ seedId, listId, ids } };
}

nativeButton.addEventListener('click', async () => {
  try {
    const tab = await getActiveTab();
    if (!tab || !tab.id) throw new Error('No active tab found.');

    const url = new URL(String(tab.url || ''));
    if (url.hostname.replace(/^www\./, '') !== 'youtube.com' || url.pathname !== '/watch') {
      throw new Error('Open a YouTube watch page first.');
    }

    url.searchParams.set('aero_native', '1');
    await chrome.tabs.update(tab.id, { url:url.toString() });
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

    setStatus(
      'Captured ' + compact.ids.length + ' songs in player order. Opening Aero…',
      'ok'
    );

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
