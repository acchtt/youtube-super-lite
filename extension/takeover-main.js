'use strict';

(() => {
  let pageUrl;
  try {
    pageUrl = new URL(location.href);
  } catch (_) {
    return;
  }

  const host = pageUrl.hostname.replace(/^www\./, '');
  const videoId = pageUrl.searchParams.get('v') || '';
  const isWatch =
    host === 'youtube.com' &&
    pageUrl.pathname === '/watch' &&
    /^[A-Za-z0-9_-]{11}$/.test(videoId);

  if (!isWatch || pageUrl.searchParams.get('aero_native') === '1') return;

  const listId = pageUrl.searchParams.get('list') || '';
  const rawIndex = pageUrl.searchParams.get('index') || '';
  const startValue = pageUrl.searchParams.get('start') || pageUrl.searchParams.get('t') || '';
  const seedId = videoId;

  function parseStart(value) {
    if (!value) return 0;
    if (/^\d+$/.test(value)) return Number(value);

    const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
    if (!match) return 0;

    return (Number(match[1] || 0) * 3600) +
      (Number(match[2] || 0) * 60) +
      Number(match[3] || 0);
  }

  // document.open() atomically replaces the pending YouTube document and
  // aborts its parser/network-driven page construction. This is more reliable
  // at document_start than calling window.stop() and mutating a half-created DOM.
  try {
    document.open('text/html', 'replace');
    document.write(`<!doctype html>
<html data-aero-takeover="on">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <title>YouTube Super Lite</title>
</head>
<body>
  <header class="aero-topbar">
    <button id="aero-brand" class="aero-brand" type="button" aria-label="Back to YouTube">
      <span class="aero-mark" aria-hidden="true"></span>
      <span>YT SUPER LITE</span>
    </button>

    <form id="aero-search" class="aero-search" role="search">
      <input id="aero-query" type="search" autocomplete="off" placeholder="Search YouTube" aria-label="Search YouTube">
      <button type="submit">Search</button>
    </form>

    <a id="aero-native-top" class="aero-ghost" href="#">Native page</a>
  </header>

  <main class="aero-main">
    <div class="aero-layout">
      <section class="aero-primary">
        <div id="aero-stage" class="aero-stage"></div>

        <div class="aero-meta">
          <div class="aero-copy">
            <h1 id="aero-title" class="aero-title">Loading video…</h1>
            <p id="aero-channel" class="aero-channel">YouTube</p>
          </div>

          <div class="aero-actions">
            <button id="aero-cinema" class="aero-ghost" type="button">Cinema</button>
            <a id="aero-native" class="aero-primary-button" href="#">Full YouTube</a>
          </div>
        </div>

        <p class="aero-note">Experimental same-origin player. Check YouTube History after this video to verify account-history recording.</p>
      </section>

      <aside id="aero-mix" class="aero-mix">
        <div class="aero-mix-label">YouTube Mix / Playlist</div>
        <div id="aero-mix-count" class="aero-mix-count">Loading…</div>
        <div class="aero-mix-controls">
          <button id="aero-prev" type="button">Previous</button>
          <button id="aero-next" type="button">Next</button>
        </div>
      </aside>
    </div>
  </main>
</body>
</html>`);
    document.close();
  } catch (_) {
    return;
  }

  const root = document.documentElement;
  const body = document.body;
  const stage = document.getElementById('aero-stage');
  const title = document.getElementById('aero-title');
  const channel = document.getElementById('aero-channel');
  const mixCount = document.getElementById('aero-mix-count');
  const brand = document.getElementById('aero-brand');
  const search = document.getElementById('aero-search');
  const query = document.getElementById('aero-query');
  const cinema = document.getElementById('aero-cinema');
  const prev = document.getElementById('aero-prev');
  const next = document.getElementById('aero-next');
  const nativeTop = document.getElementById('aero-native-top');
  const native = document.getElementById('aero-native');

  root.dataset.aeroTakeover = 'on';
  root.dataset.aeroListId = listId;
  root.dataset.aeroMixSeedId = seedId;
  root.dataset.aeroPlaylistIds = '[]';
  root.dataset.aeroPlaylistIndex = '-1';
  root.dataset.aeroCurrentVideoId = videoId;

  if (listId) body.classList.add('aero-has-mix');

  if (localStorage.getItem('aero_super_lite_cinema') === '1') {
    body.classList.add('aero-cinema');
  }

  let player = null;
  let playlistIds = [];

  function currentNativeUrl() {
    const current = new URL(location.href);
    current.searchParams.set('aero_native', '1');
    return current.toString();
  }

  function updateLinks() {
    const href = currentNativeUrl();
    native.href = href;
    nativeTop.href = href;
  }

  function buildEmbedUrl() {
    const embed = new URL('https://www.youtube.com/embed/' + encodeURIComponent(videoId));
    embed.searchParams.set('autoplay', '1');
    embed.searchParams.set('controls', '1');
    embed.searchParams.set('playsinline', '1');
    embed.searchParams.set('rel', '0');
    embed.searchParams.set('enablejsapi', '1');
    embed.searchParams.set('origin', location.origin);

    if (listId) {
      embed.searchParams.set('listType', 'playlist');
      embed.searchParams.set('list', listId);
      if (/^\d+$/.test(rawIndex)) embed.searchParams.set('index', rawIndex);
    }

    const start = parseStart(startValue);
    if (start > 0) embed.searchParams.set('start', String(start));

    return embed.toString();
  }

  // Create the iframe immediately. Even if the IFrame API script is delayed
  // or rejected, the user still gets a playable official YouTube embed.
  const frame = document.createElement('iframe');
  frame.id = 'aero-player-frame';
  frame.title = 'YouTube video player';
  frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  frame.allowFullscreen = true;
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  frame.src = buildEmbedUrl();
  stage.appendChild(frame);

  function syncPlayerState() {
    if (!player) return;

    let currentId = videoId;
    let currentIndex = -1;
    let data = {};

    try {
      data = player.getVideoData ? (player.getVideoData() || {}) : {};
      if (data.video_id) currentId = data.video_id;
    } catch (_) {}

    try {
      const rawPlaylist = player.getPlaylist ? player.getPlaylist() : null;
      if (Array.isArray(rawPlaylist) && rawPlaylist.length) {
        playlistIds = rawPlaylist
          .filter(id => typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id))
          .slice(0, 100);
      }
    } catch (_) {}

    try {
      currentIndex = player.getPlaylistIndex ? player.getPlaylistIndex() : -1;
    } catch (_) {}

    root.dataset.aeroPlaylistIds = JSON.stringify(playlistIds);
    root.dataset.aeroPlaylistIndex = String(Number.isInteger(currentIndex) ? currentIndex : -1);
    root.dataset.aeroCurrentVideoId = currentId;
    root.dataset.aeroListId = listId;
    root.dataset.aeroMixSeedId = seedId;

    if (data.title) {
      title.textContent = data.title;
      document.title = data.title + ' — Super Lite';
    }
    if (data.author) channel.textContent = data.author;

    if (listId) {
      const total = playlistIds.length;
      const position = currentIndex >= 0 ? currentIndex + 1 : 1;
      mixCount.textContent = total ? position + ' / ' + total : 'Mix active';
    }

    const currentUrl = new URL(location.href);
    currentUrl.searchParams.set('v', currentId);
    currentUrl.searchParams.delete('aero_native');

    if (listId) {
      currentUrl.searchParams.set('list', listId);
      if (currentIndex >= 0) currentUrl.searchParams.set('index', String(currentIndex));
    }

    history.replaceState(null, '', currentUrl.toString());
    updateLinks();
  }

  function attachPlayerApi() {
    if (!window.YT || typeof window.YT.Player !== 'function' || player) return;

    try {
      player = new window.YT.Player(frame, {
        events: {
          onReady() {
            syncPlayerState();
            setTimeout(syncPlayerState, 800);
          },
          onStateChange() {
            syncPlayerState();
          },
          onError(event) {
            title.textContent = 'YouTube player error ' + event.data;
            channel.textContent = 'Use Full YouTube for this video.';
          }
        }
      });
    } catch (_) {
      // The already-created iframe remains independently playable.
    }
  }

  brand.addEventListener('click', () => {
    location.href = 'https://www.youtube.com/';
  });

  search.addEventListener('submit', event => {
    event.preventDefault();
    const value = query.value.trim();
    if (!value) return;

    const target = new URL('https://www.youtube.com/results');
    target.searchParams.set('search_query', value);
    location.href = target.toString();
  });

  cinema.addEventListener('click', () => {
    const active = body.classList.toggle('aero-cinema');
    localStorage.setItem('aero_super_lite_cinema', active ? '1' : '0');
  });

  prev.addEventListener('click', () => {
    if (player && player.previousVideo) player.previousVideo();
  });

  next.addEventListener('click', () => {
    if (player && player.nextVideo) player.nextVideo();
  });

  updateLinks();

  window.onYouTubeIframeAPIReady = attachPlayerApi;

  const api = document.createElement('script');
  api.src = 'https://www.youtube.com/iframe_api';
  api.async = true;
  api.onerror = () => {
    channel.textContent = 'Player controls API unavailable; video playback still works.';
  };
  document.head.appendChild(api);

  if (window.YT && typeof window.YT.Player === 'function') {
    attachPlayerApi();
  }
})();
