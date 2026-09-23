'use strict';

const button = document.getElementById('capture');
const status = document.getElementById('status');

function setStatus(text, kind) {
  status.textContent = text;
  status.className = kind || '';
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active:true, currentWindow:true });
  return tabs && tabs[0] ? tabs[0] : null;
}

function scrapeCurrentMix() {
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();

  let pageUrl;
  try {
    pageUrl = new URL(location.href);
  } catch (_) {
    return { error:'This page is not a valid YouTube Mix.' };
  }

  if (pageUrl.hostname.replace(/^www\./, '') !== 'youtube.com' || pageUrl.pathname !== '/watch') {
    return { error:'Open a YouTube watch page first.' };
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
  const rows = panel ? Array.from(panel.querySelectorAll('ytd-playlist-panel-video-renderer')) : [];

  if (rows.length < 2) {
    return { error:'The visible Mix panel is not loaded yet. Wait for the playlist to appear, then try again.' };
  }

  const items = [];

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

    const titleNode = row.querySelector('#video-title');
    const channelNode =
      row.querySelector('#byline') ||
      row.querySelector('ytd-channel-name') ||
      row.querySelector('.ytd-channel-name');
    const indexRaw = Number(url.searchParams.get('index'));

    items.push({
      id,
      title: clean(titleNode && (titleNode.getAttribute('title') || titleNode.textContent)),
      channel: clean(channelNode && channelNode.textContent),
      index: Number.isInteger(indexRaw) && indexRaw > 0 ? indexRaw - 1 : null
    });

    if (items.length >= 100) break;
  }

  // Important: preserve the active playlist panel's rendered DOM sequence
  // exactly. On dynamic YouTube Mixes, ?index= values are not reliable enough
  // to reconstruct the visible order and sorting by them can scramble tracks.

  if (items.length < 2) {
    return { error:'Aero could not read enough songs from the visible Mix panel.' };
  }

  return {
    snapshot: {
      seedId,
      listId,
      sourceUrl: pageUrl.href,
      pageTitle: clean(document.title),
      capturedAt: Date.now(),
      items
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
    if (!url.startsWith('https://www.youtube.com/')) {
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
      ids: result.snapshot.items
    };
    const encoded = btoa(JSON.stringify(compact))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
    const aeroUrl = 'https://aero-x-ive.pages.dev/#aeroMix=' + encoded;

    setStatus(
      'Captured ' + result.snapshot.items.length + ' songs in visible list order. Opening Aero…',
      'ok'
    );
    await chrome.tabs.create({ url: aeroUrl });
  } catch (error) {
    setStatus(error && error.message ? error.message : 'Capture failed.', 'err');
  } finally {
    button.disabled = false;
  }
});
