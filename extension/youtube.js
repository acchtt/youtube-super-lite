'use strict';

const STORAGE_KEY = 'latestAeroMix';
let timer = null;
let intervalId = null;
let lastFingerprint = '';

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function currentWatchContext() {
  try {
    const url = new URL(location.href);
    if (url.pathname !== '/watch') return null;
    const seedId = url.searchParams.get('v') || '';
    const listId = url.searchParams.get('list') || '';
    if (!seedId || !listId) return null;
    return { url, seedId, listId };
  } catch (_) {
    return null;
  }
}

function extractQueue() {
  const context = currentWatchContext();
  if (!context) return null;

  const rows = document.querySelectorAll('ytd-playlist-panel-video-renderer');
  if (rows.length < 2) return null;

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

  if (items.length < 2) return null;

  return {
    seedId: context.seedId,
    listId: context.listId,
    sourceUrl: context.url.href,
    pageTitle: clean(document.title),
    capturedAt: Date.now(),
    items
  };
}

async function publish() {
  timer = null;
  if (document.hidden) return;

  const snapshot = extractQueue();
  if (!snapshot) return;

  const fingerprint =
    snapshot.listId + '|' +
    snapshot.seedId + '|' +
    snapshot.items.map(item => item.id).join(',');

  if (fingerprint === lastFingerprint) return;
  lastFingerprint = fingerprint;

  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: snapshot });
  } catch (_) {}
}

function schedule(delay = 800) {
  if (document.hidden) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(publish, delay);
}

function startPolling() {
  if (intervalId) return;
  intervalId = setInterval(() => {
    if (!document.hidden && currentWatchContext()) schedule(0);
  }, 15000);
}

function stopPolling() {
  if (!intervalId) return;
  clearInterval(intervalId);
  intervalId = null;
}

document.addEventListener('yt-navigate-finish', () => schedule(600), true);
document.addEventListener('yt-page-data-updated', () => schedule(900), true);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (timer) clearTimeout(timer);
    timer = null;
    stopPolling();
  } else {
    schedule(300);
    startPolling();
  }
});

schedule(500);
startPolling();
