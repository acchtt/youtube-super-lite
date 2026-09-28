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
        <div id="aero-mix-count" class="aero-mix-count">Reading Mix…</div>
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
  let playlistIndex = -1;
  let currentVideoId = videoId;
  let advancing = false;

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
    // Important: never pass list/listType here. Dynamic RD... YouTube Mix IDs
    // can leave the embedded player spinning indefinitely. Always start from
    // the concrete video ID; Mix playback is driven by our extracted queue.
    const embed = new URL('https://www.youtube.com/embed/' + encodeURIComponent(videoId));
    embed.searchParams.set('autoplay', '1');
    embed.searchParams.set('controls', '1');
    embed.searchParams.set('playsinline', '1');
    embed.searchParams.set('rel', '0');
    embed.searchParams.set('enablejsapi', '1');
    embed.searchParams.set('origin', location.origin);

    const start = parseStart(startValue);
    if (start > 0) embed.searchParams.set('start', String(start));

    return embed.toString();
  }

  const frame = document.createElement('iframe');
  frame.id = 'aero-player-frame';
  frame.title = 'YouTube video player';
  frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  frame.allowFullscreen = true;
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  frame.src = buildEmbedUrl();
  stage.appendChild(frame);

  function publishQueueState() {
    root.dataset.aeroPlaylistIds = JSON.stringify(playlistIds.slice(0, 100));
    root.dataset.aeroPlaylistIndex = String(playlistIndex);
    root.dataset.aeroCurrentVideoId = currentVideoId;
    root.dataset.aeroListId = listId;
    root.dataset.aeroMixSeedId = seedId;

    if (!listId) return;

    if (playlistIds.length) {
      const position = playlistIndex >= 0 ? playlistIndex + 1 : 1;
      mixCount.textContent = position + ' / ' + playlistIds.length;
    } else {
      mixCount.textContent = 'Mix unavailable';
    }
  }

  function syncAddress() {
    const currentUrl = new URL(location.href);
    currentUrl.searchParams.set('v', currentVideoId);
    currentUrl.searchParams.delete('aero_native');

    if (listId) {
      currentUrl.searchParams.set('list', listId);
      if (playlistIndex >= 0) currentUrl.searchParams.set('index', String(playlistIndex));
    }

    history.replaceState(null, '', currentUrl.toString());
    updateLinks();
  }

  function syncMetadata() {
    if (!player) return;

    try {
      const data = player.getVideoData ? (player.getVideoData() || {}) : {};
      if (data.video_id) currentVideoId = data.video_id;
      if (data.title) {
        title.textContent = data.title;
        document.title = data.title + ' — Super Lite';
      }
      if (data.author) channel.textContent = data.author;
    } catch (_) {}

    if (playlistIds.length) {
      const exact = playlistIds.indexOf(currentVideoId);
      if (exact >= 0) playlistIndex = exact;
    }

    publishQueueState();
    syncAddress();
  }

  function extractPlaylistIds(html) {
    const ids = [];
    const regex = /"playlistPanelVideoRenderer":\{"videoId":"([A-Za-z0-9_-]{11})"/g;
    let match;

    while ((match = regex.exec(html)) && ids.length < 100) {
      ids.push(match[1]);
    }

    return ids;
  }

  async function loadMixQueue() {
    if (!listId) return;

    try {
      const source = new URL(pageUrl.toString());
      source.searchParams.set('aero_native', '1');

      const response = await fetch(source.toString(), {
        credentials: 'include',
        cache: 'no-store'
      });

      if (!response.ok) throw new Error('Mix source unavailable');

      let html = await response.text();
      const ids = extractPlaylistIds(html);
      html = '';

      if (ids.length < 2) throw new Error('Mix queue not found');

      playlistIds = ids;

      const requestedIndex = /^\d+$/.test(rawIndex) ? Number(rawIndex) : -1;
      if (
        requestedIndex >= 0 &&
        requestedIndex < playlistIds.length &&
        playlistIds[requestedIndex] === currentVideoId
      ) {
        playlistIndex = requestedIndex;
      } else {
        playlistIndex = playlistIds.indexOf(currentVideoId);
        if (playlistIndex < 0) playlistIndex = 0;
      }

      publishQueueState();
      syncAddress();
    } catch (_) {
      playlistIds = [];
      playlistIndex = -1;
      publishQueueState();
    }
  }

  function playQueueIndex(index) {
    if (!player || !playlistIds.length) return;
    if (index < 0 || index >= playlistIds.length) return;

    playlistIndex = index;
    currentVideoId = playlistIds[index];
    advancing = true;

    publishQueueState();
    syncAddress();

    try {
      player.loadVideoById(currentVideoId);
    } finally {
      setTimeout(() => {
        advancing = false;
        syncMetadata();
      }, 250);
    }
  }

  function attachPlayerApi() {
    if (!window.YT || typeof window.YT.Player !== 'function' || player) return;

    try {
      player = new window.YT.Player(frame, {
        events: {
          onReady() {
            syncMetadata();
            setTimeout(syncMetadata, 700);
          },
          onStateChange(event) {
            syncMetadata();

            // ENDED = 0. Advance through the inertly extracted Mix queue
            // instead of asking the iframe to resolve an RD... radio list.
            if (event.data === 0 && !advancing && playlistIds.length) {
              const nextIndex = playlistIndex + 1;
              if (nextIndex < playlistIds.length) playQueueIndex(nextIndex);
            }
          },
          onError(event) {
            title.textContent = 'YouTube player error ' + event.data;
            channel.textContent = 'Use Full YouTube for this video.';
          }
        }
      });
    } catch (_) {}
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
    if (!playlistIds.length) return;
    playQueueIndex(playlistIndex > 0 ? playlistIndex - 1 : 0);
  });

  next.addEventListener('click', () => {
    if (!playlistIds.length) return;
    const target = playlistIndex + 1;
    if (target < playlistIds.length) playQueueIndex(target);
  });

  updateLinks();
  loadMixQueue();

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
