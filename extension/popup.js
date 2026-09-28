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

const button = document.getElementById('capture');
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

    if (key === 'hardReloadVideos') {
      setStatus(
        input.checked
          ? 'RAM reset enabled. New videos will use fresh native YouTube page loads.'
          : 'RAM reset disabled. YouTube SPA navigation will be used.',
        'ok'
      );
    } else if (key === 'liteEnabled' && !input.checked) {
      setStatus('Super Lite is off. YouTube is back to its normal layout.', 'ok');
    } else {
      setStatus('Settings updated.', 'ok');
    }
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
    return { error:'The visible Mix panel is not loaded yet. Keep the Mix panel enabled, wait for it to appear, then try again.' };
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

  return {
    snapshot: {
      seedId,
      listId,
      ids
    }
  };
}

button.addEventListener('click', async () => {
  button.disabled = true;
  setStatus('Capturing the visible Mix…');

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
      'Captured ' + compact.ids.length + ' songs in visible list order. Opening Aero…',
      'ok'
    );

    await chrome.tabs.create({
      url: 'https://aero-x-ive.pages.dev/#aeroMix=' + encoded
    });
  } catch (error) {
    setStatus(error && error.message ? error.message : 'Capture failed.', 'err');
  } finally {
    button.disabled = false;
  }
});

loadSettings().catch(() => setStatus('Could not load extension settings.', 'err'));
