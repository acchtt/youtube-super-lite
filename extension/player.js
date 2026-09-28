'use strict';

const params = new URLSearchParams(location.search);
const videoId = params.get('v') || '';
const player = document.getElementById('player');
const title = document.getElementById('title');
const channel = document.getElementById('channel');
const fullYoutube = document.getElementById('fullYoutube');
const fullYoutubeSecondary = document.getElementById('fullYoutubeSecondary');
const browseYoutube = document.getElementById('browseYoutube');
const back = document.getElementById('back');
const search = document.getElementById('search');
const query = document.getElementById('query');

function parseStart(value) {
  if (!value) return 0;
  if (/^\d+$/.test(value)) return Number(value);

  const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (!match) return 0;
  return (Number(match[1] || 0) * 3600) +
    (Number(match[2] || 0) * 60) +
    Number(match[3] || 0);
}

function buildSourceUrl() {
  const raw = params.get('source') || '';
  try {
    const source = new URL(raw);
    if (/^(?:www\.)?youtube\.com$/.test(source.hostname) && source.pathname === '/watch') {
      return source;
    }
  } catch (_) {}

  const source = new URL('https://www.youtube.com/watch');
  source.searchParams.set('v', videoId);

  for (const key of ['list', 'index', 't', 'start']) {
    const value = params.get(key);
    if (value) source.searchParams.set(key, value);
  }

  return source;
}

function fullYouTubeUrl() {
  const source = buildSourceUrl();
  source.searchParams.set('aero_full', '1');
  return source.toString();
}

function buildEmbedUrl() {
  const embed = new URL('https://www.youtube.com/embed/' + encodeURIComponent(videoId));
  embed.searchParams.set('autoplay', '1');
  embed.searchParams.set('playsinline', '1');
  embed.searchParams.set('rel', '0');
  embed.searchParams.set('modestbranding', '1');

  const list = params.get('list');
  const index = params.get('index');
  const start = parseStart(params.get('start') || params.get('t'));

  if (list) embed.searchParams.set('list', list);
  if (index && /^\d+$/.test(index)) embed.searchParams.set('index', index);
  if (start > 0) embed.searchParams.set('start', String(start));

  return embed.toString();
}

async function loadMetadata() {
  try {
    const oembed = new URL('https://www.youtube.com/oembed');
    oembed.searchParams.set('url', 'https://www.youtube.com/watch?v=' + encodeURIComponent(videoId));
    oembed.searchParams.set('format', 'json');

    const response = await fetch(oembed, { credentials:'omit' });
    if (!response.ok) throw new Error('Metadata unavailable.');

    const data = await response.json();
    if (data.title) {
      title.textContent = data.title;
      document.title = data.title + ' — Super Lite';
    }
    if (data.author_name) channel.textContent = data.author_name;
  } catch (_) {
    title.textContent = 'YouTube video';
    channel.textContent = 'Super Lite';
  }
}

if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
  title.textContent = 'Invalid YouTube video';
  channel.textContent = 'Return to YouTube and choose a video.';
  player.remove();
} else {
  player.src = buildEmbedUrl();
  const fullUrl = fullYouTubeUrl();
  fullYoutube.href = fullUrl;
  fullYoutubeSecondary.href = fullUrl;
  loadMetadata();
}

browseYoutube.href = 'https://www.youtube.com/';

back.addEventListener('click', () => {
  if (history.length > 1) history.back();
  else location.href = 'https://www.youtube.com/';
});

search.addEventListener('submit', event => {
  event.preventDefault();
  const value = query.value.trim();
  if (!value) return;

  const target = new URL('https://www.youtube.com/results');
  target.searchParams.set('search_query', value);
  location.href = target.toString();
});
