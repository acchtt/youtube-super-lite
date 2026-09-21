'use strict';

const JSZIP_URL = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
const STOP = new Set([
  'the','a','an','and','or','of','to','in','on','for','with','at','from','by','is','are','was','were',
  'official','video','mv','music','live','lyrics','lyric','feat','ft','full','episode','ep','part','ver',
  'youtube','shorts','short','eng','sub','subs','hd','4k','reaction','clip','performance'
]);

function progress(message) { postMessage({ type: 'progress', message }); }
function fail(err) { postMessage({ type: 'error', message: err && err.message ? err.message : String(err) }); }

function decodeHtml(s) {
  return String(s || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;| /g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .trim();
}

function tokens(text) {
  try {
    return (String(text || '').toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || [])
      .filter(t => !STOP.has(t) && !/^\d+$/.test(t))
      .slice(0, 14);
  } catch (_) {
    return (String(text || '').toLowerCase().match(/[a-z0-9]{2,}/g) || [])
      .filter(t => !STOP.has(t) && !/^\d+$/.test(t))
      .slice(0, 14);
  }
}

function addTokens(map, text, weight) {
  const seen = new Set(tokens(text));
  for (const t of seen) map.set(t, (map.get(t) || 0) + weight);
}

function findFiles(zip, predicate) {
  return Object.values(zip.files).filter(f => !f.dir && predicate(f.name));
}

async function firstHtmlContaining(zip, needle) {
  const htmlFiles = findFiles(zip, name => /\.html$/i.test(name));
  for (const file of htmlFiles) {
    const text = await file.async('text');
    if (text.includes(needle)) return { file, text };
  }
  return null;
}

function parseWatchHtml(text) {
  const videos = new Map();
  const channels = new Map();
  const titleTokens = new Map();
  const re = /<a href="https:\/\/www\.youtube\.com\/watch\?v=([^"&]+)[^"]*">([\s\S]*?)<\/a><br><a href="https:\/\/www\.youtube\.com\/channel\/([^"]+)">([\s\S]*?)<\/a><br>([\s\S]*?)<br>/g;
  let m;
  let rank = 0;
  let events = 0;

  while ((m = re.exec(text))) {
    const id = m[1].trim();
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) continue;
    const title = decodeHtml(m[2]);
    const channelId = m[3].trim();
    const channel = decodeHtml(m[4]);
    const existing = videos.get(id) || { id, title, channelId, channel, count: 0, recentRank: rank };
    existing.count++;
    existing.recentRank = Math.min(existing.recentRank, rank);
    if (!existing.title && title) existing.title = title;
    videos.set(id, existing);

    const ch = channels.get(channelId) || { count: 0, recent: 0, channel };
    ch.count++;
    ch.recent += 1 / (1 + rank / 700);
    channels.set(channelId, ch);

    if (rank < 6000) addTokens(titleTokens, title, 1 / (1 + rank / 1200));
    rank++;
    events++;
  }
  return { videos, channels, titleTokens, events };
}

function parseSearchHtml(text, titleTokens) {
  const re = /<a href="https:\/\/www\.youtube\.com\/results\?search_query=[^"]*">([\s\S]*?)<\/a><br>/g;
  let m;
  let rank = 0;
  let events = 0;
  while ((m = re.exec(text))) {
    const query = decodeHtml(m[1]);
    if (query) {
      addTokens(titleTokens, query, 2.2 / (1 + rank / 900));
      events++;
      rank++;
    }
  }
  return events;
}

async function parseSubscriptions(zip) {
  const ids = new Set();
  const csvs = findFiles(zip, name => /\.csv$/i.test(name));
  for (const file of csvs) {
    const text = await file.async('text');
    if (!/youtube\.com\/channel\//i.test(text)) continue;
    const re = /youtube\.com\/channel\/([A-Za-z0-9_-]+)/g;
    let m;
    while ((m = re.exec(text))) ids.add(m[1]);
  }
  return ids;
}

async function parsePlaylistVideoIds(zip) {
  const ids = new Set();
  let items = 0;
  const csvs = findFiles(zip, name => /\.csv$/i.test(name));
  for (const file of csvs) {
    const text = await file.async('text');
    if (/youtube\.com\/channel\//i.test(text)) continue;
    const re = /(?:^|\r?\n)"?\s*([A-Za-z0-9_-]{11})\s*"?,/g;
    let m;
    let fileHits = 0;
    while ((m = re.exec(text))) {
      ids.add(m[1]);
      fileHits++;
    }
    items += fileHits;
  }
  return { ids, items };
}

function buildProfile(watch, subscriptions, playlistInfo, searchEvents) {
  const candidates = [];
  for (const v of watch.videos.values()) {
    const ch = watch.channels.get(v.channelId) || { count: 1, recent: 0 };
    let tokenAffinity = 0;
    for (const t of new Set(tokens(v.title))) tokenAffinity += Math.min(8, watch.titleTokens.get(t) || 0);

    const subscribed = subscriptions.has(v.channelId);
    const playlist = playlistInfo.ids.has(v.id);
    const score =
      Math.log1p(ch.count) * 2.1 +
      Math.min(8, ch.recent) * 1.2 +
      Math.log1p(v.count) * 1.7 +
      Math.min(12, tokenAffinity) * 0.55 +
      (subscribed ? 2.8 : 0) +
      (playlist ? 3.6 : 0);

    candidates.push({
      id: v.id,
      title: v.title,
      channelId: v.channelId,
      channel: v.channel,
      count: v.count,
      recentRank: v.recentRank,
      subscribed,
      playlist,
      score: Number(score.toFixed(4))
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  const limited = candidates.slice(0, 8000);

  return {
    version: 1,
    importedAt: new Date().toISOString(),
    stats: {
      watchEvents: watch.events,
      uniqueVideos: watch.videos.size,
      uniqueChannels: watch.channels.size,
      searchEvents,
      subscriptions: subscriptions.size,
      playlistItems: playlistInfo.items,
      candidates: limited.length
    },
    candidates: limited
  };
}

onmessage = async (event) => {
  try {
    progress('Loading Takeout archive…');
    importScripts(JSZIP_URL);
    const zip = await JSZip.loadAsync(event.data.buffer);

    progress('Finding watch history…');
    const watchSource = await firstHtmlContaining(zip, 'youtube.com/watch?v=');
    if (!watchSource) throw new Error('No YouTube watch-history HTML was found in this Takeout ZIP.');

    progress('Reading watch history…');
    const watch = parseWatchHtml(watchSource.text);
    watchSource.text = '';

    progress('Reading searches…');
    const searchSource = await firstHtmlContaining(zip, 'youtube.com/results?search_query=');
    const searchEvents = searchSource ? parseSearchHtml(searchSource.text, watch.titleTokens) : 0;
    if (searchSource) searchSource.text = '';

    progress('Reading subscriptions and playlists…');
    const subscriptions = await parseSubscriptions(zip);
    const playlistInfo = await parsePlaylistVideoIds(zip);

    progress('Building compact local taste profile…');
    const profile = buildProfile(watch, subscriptions, playlistInfo, searchEvents);
    postMessage({ type: 'done', profile });
  } catch (err) {
    fail(err);
  }
};