'use strict';

let timer = null;
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

  const rows = Array.from(document.querySelectorAll('ytd-playlist-panel-video-renderer'));
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
      index: Number.isInteger(indexRaw) && indexRaw > 0 ? indexRaw - 1 : null,
      selected: row.hasAttribute('selected') || row.getAttribute('aria-current') === 'true'
    });
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

function publish() {
  timer = null;
  const snapshot = extractQueue();
  if (!snapshot) return;

  const fingerprint = [
    snapshot.listId,
    snapshot.seedId,
    snapshot.items.map(item => item.id).join(',')
  ].join('|');

  if (fingerprint === lastFingerprint) return;
  lastFingerprint = fingerprint;

  try {
    chrome.runtime.sendMessage({
      type: 'AERO_MIX_SNAPSHOT',
      payload: snapshot
    });
  } catch (_) {}
}

function schedule(delay = 500) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(publish, delay);
}

document.addEventListener('yt-navigate-finish', () => schedule(250), true);
document.addEventListener('yt-page-data-updated', () => schedule(350), true);

const observer = new MutationObserver(() => {
  if (location.pathname === '/watch' && location.search.includes('list=')) schedule(700);
});
observer.observe(document.documentElement, { childList:true, subtree:true });

schedule(300);
setInterval(() => schedule(0), 5000);
