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

  // Stop the normal YouTube document before the heavy watch SPA can finish
  // constructing its component tree and loading secondary watch-page modules.
  window.stop();

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

  function ensureDocument() {
    let root = document.documentElement;
    if (!root) {
      root = document.createElement('html');
      document.appendChild(root);
    }

    while (root.firstChild) root.removeChild(root.firstChild);

    const head = document.createElement('head');
    const body = document.createElement('body');
    root.append(head, body);

    const charset = document.createElement('meta');
    charset.setAttribute('charset', 'utf-8');
    head.appendChild(charset);

    const viewport = document.createElement('meta');
    viewport.name = 'viewport';
    viewport.content = 'width=device-width,initial-scale=1';
    head.appendChild(viewport);

    const referrer = document.createElement('meta');
    referrer.name = 'referrer';
    referrer.content = 'strict-origin-when-cross-origin';
    head.appendChild(referrer);

    const title = document.createElement('title');
    title.textContent = 'YouTube Super Lite';
    head.appendChild(title);

    return { root, head, body };
  }

  const { root, head, body } = ensureDocument();
  root.dataset.aeroTakeover = 'on';
  root.dataset.aeroListId = listId;
  root.dataset.aeroMixSeedId = seedId;
  root.dataset.aeroPlaylistIds = '[]';
  root.dataset.aeroPlaylistIndex = '-1';
  root.dataset.aeroCurrentVideoId = videoId;

  const style = document.createElement('style');
  style.textContent = `
    :root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#080a0e;color:#f5f7fa}
    *{box-sizing:border-box}
    html,body{margin:0;min-height:100%;background:#080a0e}
    body{min-height:100vh}
    button,input{font:inherit}
    .aero-topbar{height:58px;padding:9px 14px;display:grid;grid-template-columns:auto minmax(220px,640px) auto;gap:18px;align-items:center;border-bottom:1px solid #20242b;background:#0d1015;position:sticky;top:0;z-index:10}
    .aero-brand{border:0;background:transparent;color:#f5f7fa;display:inline-flex;align-items:center;gap:9px;padding:7px 5px;font-size:12px;font-weight:800;letter-spacing:.08em;cursor:pointer}
    .aero-mark{width:22px;height:14px;border-radius:5px;background:#f1f3f5;position:relative}
    .aero-mark:after{content:"";position:absolute;left:9px;top:4px;border-left:6px solid #0d1015;border-top:3px solid transparent;border-bottom:3px solid transparent}
    .aero-search{width:100%;display:grid;grid-template-columns:1fr auto;border:1px solid #303641;border-radius:999px;overflow:hidden;background:#13171d}
    .aero-search:focus-within{border-color:#79818e}
    .aero-search input{min-width:0;border:0;outline:0;color:#f5f7fa;background:transparent;padding:9px 14px}
    .aero-search button,.aero-ghost,.aero-primary{border:0;cursor:pointer}
    .aero-search button{border-left:1px solid #303641;background:#1a1f27;color:#e8ebef;padding:0 16px}
    .aero-ghost,.aero-primary{min-height:38px;padding:9px 13px;border-radius:9px;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:700}
    .aero-ghost{border:1px solid #303641;color:#e7eaee;background:#14181f}
    .aero-primary{border:1px solid #e8ebef;color:#0d1015;background:#eef0f3}
    .aero-main{width:min(1320px,calc(100% - 28px));margin:18px auto 30px}
    .aero-layout{display:grid;grid-template-columns:minmax(0,1fr) 240px;gap:14px;align-items:start}
    body:not(.aero-has-mix) .aero-layout{grid-template-columns:minmax(0,1fr)}
    body:not(.aero-has-mix) .aero-mix{display:none}
    .aero-stage{width:100%;aspect-ratio:16/9;background:#000;border-radius:12px;overflow:hidden}
    .aero-stage iframe{width:100%!important;height:100%!important;display:block;border:0}
    .aero-meta{min-height:72px;display:flex;justify-content:space-between;align-items:center;gap:18px;padding:13px 2px 4px}
    .aero-copy{min-width:0}
    .aero-title{margin:0;font-size:clamp(16px,1.8vw,21px);line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .aero-channel{margin:5px 0 0;color:#99a2ae;font-size:13px}
    .aero-actions{display:flex;gap:8px;flex:none}
    .aero-note{margin:5px 2px 0;color:#69727e;font-size:12px}
    .aero-mix{border:1px solid #292f38;border-radius:12px;background:#10141a;padding:12px;position:sticky;top:72px}
    .aero-mix-label{font-size:11px;color:#858e9a;letter-spacing:.08em;text-transform:uppercase}
    .aero-mix-count{font-size:20px;font-weight:800;margin:4px 0 12px}
    .aero-mix-controls{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .aero-mix-controls button{min-height:40px;border:1px solid #303641;border-radius:9px;background:#171c23;color:#eef1f4;cursor:pointer;font-weight:700}
    body.aero-cinema .aero-main{width:100%;margin-top:0}
    body.aero-cinema .aero-layout{display:block}
    body.aero-cinema .aero-stage{border-radius:0;width:100%;height:min(calc(100dvh - 58px),56.25vw);aspect-ratio:auto}
    body.aero-cinema .aero-mix{display:none}
    body.aero-cinema .aero-meta,body.aero-cinema .aero-note{width:min(1320px,calc(100% - 28px));margin-left:auto;margin-right:auto}
    :focus-visible{outline:2px solid #f3f5f7;outline-offset:2px}
    @media(max-width:820px){
      .aero-topbar{grid-template-columns:auto 1fr;gap:10px}.aero-topbar>.aero-ghost{display:none}.aero-brand span:last-child{display:none}
      .aero-main{width:100%;margin-top:0}.aero-layout{display:block}.aero-stage{border-radius:0}.aero-mix{position:static;border-radius:0;border-left:0;border-right:0}
      .aero-meta{padding:12px 14px 4px}.aero-note{padding:0 12px}.aero-actions .aero-ghost{display:none}
    }
  `;
  head.appendChild(style);

  const topbar = document.createElement('header');
  topbar.className = 'aero-topbar';

  const brand = document.createElement('button');
  brand.type = 'button';
  brand.className = 'aero-brand';
  brand.setAttribute('aria-label', 'Back to YouTube');
  const mark = document.createElement('span');
  mark.className = 'aero-mark';
  mark.setAttribute('aria-hidden', 'true');
  const brandText = document.createElement('span');
  brandText.textContent = 'YT SUPER LITE';
  brand.append(mark, brandText);

  const search = document.createElement('form');
  search.className = 'aero-search';
  search.setAttribute('role', 'search');
  const query = document.createElement('input');
  query.type = 'search';
  query.autocomplete = 'off';
  query.placeholder = 'Search YouTube';
  query.setAttribute('aria-label', 'Search YouTube');
  const searchButton = document.createElement('button');
  searchButton.type = 'submit';
  searchButton.textContent = 'Search';
  search.append(query, searchButton);

  const nativeLink = document.createElement('a');
  nativeLink.className = 'aero-ghost';
  nativeLink.textContent = 'Native page';

  topbar.append(brand, search, nativeLink);

  const main = document.createElement('main');
  main.className = 'aero-main';
  const layout = document.createElement('div');
  layout.className = 'aero-layout';

  const primary = document.createElement('section');
  const stage = document.createElement('div');
  stage.className = 'aero-stage';
  const playerHost = document.createElement('div');
  playerHost.id = 'aero-player';
  stage.appendChild(playerHost);

  const meta = document.createElement('div');
  meta.className = 'aero-meta';
  const copy = document.createElement('div');
  copy.className = 'aero-copy';
  const title = document.createElement('h1');
  title.className = 'aero-title';
  title.textContent = 'Loading video…';
  const channel = document.createElement('p');
  channel.className = 'aero-channel';
  channel.textContent = 'YouTube';
  copy.append(title, channel);

  const actions = document.createElement('div');
  actions.className = 'aero-actions';
  const cinema = document.createElement('button');
  cinema.type = 'button';
  cinema.className = 'aero-ghost';
  cinema.textContent = 'Cinema';
  const fullPage = document.createElement('a');
  fullPage.className = 'aero-primary';
  fullPage.textContent = 'Full YouTube';
  actions.append(cinema, fullPage);
  meta.append(copy, actions);

  const note = document.createElement('p');
  note.className = 'aero-note';
  note.textContent = 'Experimental same-origin player. Check YouTube History after this video to verify account-history recording.';

  primary.append(stage, meta, note);

  const mix = document.createElement('aside');
  mix.className = 'aero-mix';
  const mixLabel = document.createElement('div');
  mixLabel.className = 'aero-mix-label';
  mixLabel.textContent = 'YouTube Mix / Playlist';
  const mixCount = document.createElement('div');
  mixCount.className = 'aero-mix-count';
  mixCount.textContent = 'Loading…';
  const mixControls = document.createElement('div');
  mixControls.className = 'aero-mix-controls';
  const prev = document.createElement('button');
  prev.type = 'button';
  prev.textContent = 'Previous';
  const next = document.createElement('button');
  next.type = 'button';
  next.textContent = 'Next';
  mixControls.append(prev, next);
  mix.append(mixLabel, mixCount, mixControls);

  layout.append(primary, mix);
  main.appendChild(layout);
  body.append(topbar, main);
  if (listId) body.classList.add('aero-has-mix');

  const cinemaSaved = localStorage.getItem('aero_super_lite_cinema') === '1';
  if (cinemaSaved) body.classList.add('aero-cinema');

  let player = null;
  let playlistIds = [];

  function currentNativeUrl() {
    const current = new URL(location.href);
    current.searchParams.set('aero_native', '1');
    return current.toString();
  }

  function updateLinks() {
    const href = currentNativeUrl();
    nativeLink.href = href;
    fullPage.href = href;
  }

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

  function initPlayer() {
    if (!window.YT || typeof window.YT.Player !== 'function' || player) return;

    const playerVars = {
      autoplay: 1,
      controls: 1,
      playsinline: 1,
      rel: 0,
      origin: location.origin
    };

    if (listId) {
      playerVars.listType = 'playlist';
      playerVars.list = listId;
      if (/^\d+$/.test(rawIndex)) playerVars.index = Number(rawIndex);
    }

    const start = parseStart(startValue);
    if (start > 0) playerVars.start = start;

    player = new window.YT.Player('aero-player', {
      videoId,
      playerVars,
      events: {
        onReady() {
          syncPlayerState();
          // One delayed sync lets dynamic Mixes finish exposing their queue.
          setTimeout(syncPlayerState, 800);
        },
        onStateChange() {
          syncPlayerState();
        },
        onError(event) {
          title.textContent = 'YouTube player error ' + event.data;
          channel.textContent = 'Open the full YouTube page for this video.';
        }
      }
    });
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

  window.onYouTubeIframeAPIReady = initPlayer;
  const api = document.createElement('script');
  api.src = 'https://www.youtube.com/iframe_api';
  api.async = true;
  head.appendChild(api);

  if (window.YT && typeof window.YT.Player === 'function') initPlayer();
})();
