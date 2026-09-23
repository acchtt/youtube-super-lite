'use strict';

const STORAGE_KEY = 'latestAeroMix';
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

  const rows = document.querySelectorAll('ytd-playlist-panel-video-renderer');
  if (!rows || rows.length < 2) {
    return { error:'The Mix panel is not loaded yet. Wait for the playlist to appear, then try again.' };
  }

  const seen = new Set();
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
    if (!/^[A-Za-z0-9_-]{11}$/.test(id) || seen.has(id)) continue;
    seen.add(id);

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

    await chrome.storage.local.set({ [STORAGE_KEY]: result.snapshot });
    setStatus(
      'Captured ' + result.snapshot.items.length + ' songs. You can close the YouTube tab now.',
      'ok'
    );
  } catch (error) {
    setStatus(error && error.message ? error.message : 'Capture failed.', 'err');
  } finally {
    button.disabled = false;
  }
});
