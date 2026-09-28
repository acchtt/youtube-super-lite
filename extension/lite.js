'use strict';

(() => {
  const DEFAULTS = Object.freeze({
    liteEnabled: true,
    showHomeFeed: false,
    showRelated: false,
    showComments: false,
    showShorts: false,
    showMixPanel: true,
    showDescription: false
  });

  const MIX_STORAGE_PREFIX = 'aero_super_lite_mix:';

  function safeUrl(value = location.href) {
    try {
      return new URL(value, location.origin);
    } catch (_) {
      return null;
    }
  }

  function validVideoId(value) {
    return /^[A-Za-z0-9_-]{11}$/.test(value || '');
  }

  function pageKind(url = safeUrl()) {
    if (!url) return 'other';
    if (url.pathname === '/') return 'home';
    if (url.pathname === '/results') return 'search';
    if (url.pathname === '/watch') return 'watch';
    if (url.pathname.startsWith('/embed/')) return 'embed';
    if (url.pathname.startsWith('/shorts/')) return 'shorts';
    if (url.pathname.startsWith('/playlist')) return 'playlist';
    return 'other';
  }

  function parseStart(value) {
    if (!value) return 0;
    if (/^\d+$/.test(value)) return Number(value);

    const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
    if (!match) return 0;

    return (Number(match[1] || 0) * 3600) +
      (Number(match[2] || 0) * 60) +
      Number(match[3] || 0);
  }

  function buildEmbedUrlFromWatch(source) {
    const url = typeof source === 'string' ? safeUrl(source) : source;
    if (!url) return '';
    if (url.hostname.replace(/^www\./, '') !== 'youtube.com') return '';
    if (url.pathname !== '/watch') return '';

    const videoId = url.searchParams.get('v') || '';
    if (!validVideoId(videoId)) return '';

    const embed = new URL('https://www.youtube.com/embed/' + videoId);
    embed.searchParams.set('autoplay', '1');
    embed.searchParams.set('controls', '1');
    embed.searchParams.set('playsinline', '1');
    embed.searchParams.set('rel', '0');

    const listId = url.searchParams.get('list') || '';
    const index = url.searchParams.get('index') || '';
    const start = parseStart(url.searchParams.get('start') || url.searchParams.get('t') || '');

    if (listId) embed.searchParams.set('aero_list', listId);
    if (index && /^\d+$/.test(index)) embed.searchParams.set('aero_index', index);
    embed.searchParams.set('aero_seed', videoId);
    if (start > 0) embed.searchParams.set('start', String(start));

    return embed.toString();
  }

  function redirectWatchToEmbed() {
    const url = safeUrl();
    if (!url || url.pathname !== '/watch') return false;
    if (url.searchParams.get('aero_native') === '1') return false;

    const target = buildEmbedUrlFromWatch(url);
    if (!target) return false;

    try {
      sessionStorage.setItem('aero_super_lite_source_watch', url.toString());
    } catch (_) {}

    location.replace(target);
    return true;
  }

  if (redirectWatchToEmbed()) return;

  const here = safeUrl();
  if (!here) return;

  if (here.pathname.startsWith('/embed/')) {
    initEmbedMode(here);
    return;
  }

  let settings = { ...DEFAULTS };

  function applyBrowseState() {
    const root = document.documentElement;
    if (!root) return;

    root.dataset.aeroLite = settings.liteEnabled ? 'on' : 'off';
    root.dataset.aeroPage = pageKind();
    root.dataset.aeroHomeFeed = settings.showHomeFeed ? 'show' : 'hide';
    root.dataset.aeroRelated = settings.showRelated ? 'show' : 'hide';
    root.dataset.aeroComments = settings.showComments ? 'show' : 'hide';
    root.dataset.aeroShorts = settings.showShorts ? 'show' : 'hide';
    root.dataset.aeroMixPanel = settings.showMixPanel ? 'show' : 'hide';
    root.dataset.aeroDescription = settings.showDescription ? 'show' : 'hide';
  }

  async function loadSettings() {
    try {
      settings = { ...DEFAULTS, ...(await chrome.storage.sync.get(DEFAULTS)) };
    } catch (_) {
      settings = { ...DEFAULTS };
    }
    applyBrowseState();
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') return;

    let changed = false;
    for (const key of Object.keys(DEFAULTS)) {
      if (!changes[key]) continue;
      settings[key] = changes[key].newValue;
      changed = true;
    }

    if (changed) applyBrowseState();
  });

  document.addEventListener('click', event => {
    if (!settings.liteEnabled) return;
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const anchor = event.target && event.target.closest
      ? event.target.closest('a[href]')
      : null;
    if (!anchor) return;
    if (anchor.target && anchor.target !== '_self') return;

    const target = buildEmbedUrlFromWatch(anchor.href);
    if (!target) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    try {
      sessionStorage.setItem('aero_super_lite_source_watch', anchor.href);
    } catch (_) {}

    location.href = target;
  }, true);

  document.addEventListener('yt-navigate-finish', applyBrowseState, true);
  document.addEventListener('yt-page-data-updated', applyBrowseState, true);
  window.addEventListener('popstate', applyBrowseState);

  applyBrowseState();
  loadSettings();

  function initEmbedMode(embedUrl) {
    const match = embedUrl.pathname.match(/^\/embed\/([A-Za-z0-9_-]{11})/);
    if (!match) return;

    let currentVideoId = match[1];
    const listId = embedUrl.searchParams.get('aero_list') || '';
    const seedId = embedUrl.searchParams.get('aero_seed') || currentVideoId;
    const requestedIndex = /^\d+$/.test(embedUrl.searchParams.get('aero_index') || '')
      ? Number(embedUrl.searchParams.get('aero_index'))
      : -1;

    let queue = [];
    let currentIndex = requestedIndex;
    let endedBoundVideo = null;

    document.documentElement.dataset.aeroEmbed = 'on';
    document.documentElement.dataset.aeroListId = listId;
    document.documentElement.dataset.aeroMixSeedId = seedId;
    document.documentElement.dataset.aeroPlaylistIds = '[]';
    document.documentElement.dataset.aeroPlaylistIndex = String(currentIndex);
    document.documentElement.dataset.aeroCurrentVideoId = currentVideoId;

    function queueKey() {
      return MIX_STORAGE_PREFIX + (listId || 'none');
    }

    function publishState() {
      const root = document.documentElement;
      if (!root) return;

      root.dataset.aeroListId = listId;
      root.dataset.aeroMixSeedId = seedId;
      root.dataset.aeroPlaylistIds = JSON.stringify(queue.slice(0, 100));
      root.dataset.aeroPlaylistIndex = String(currentIndex);
      root.dataset.aeroCurrentVideoId = currentVideoId;

      try {
        if (listId && queue.length) {
          sessionStorage.setItem(queueKey(), JSON.stringify({
            listId,
            seedId,
            ids: queue.slice(0, 100)
          }));
        }
      } catch (_) {}

      updateOverlay();
    }

    function buildEmbedFor(videoId, index) {
      const target = new URL('https://www.youtube.com/embed/' + videoId);
      target.searchParams.set('autoplay', '1');
      target.searchParams.set('controls', '1');
      target.searchParams.set('playsinline', '1');
      target.searchParams.set('rel', '0');
      if (listId) target.searchParams.set('aero_list', listId);
      target.searchParams.set('aero_seed', seedId);
      if (Number.isInteger(index) && index >= 0) {
        target.searchParams.set('aero_index', String(index));
      }
      return target.toString();
    }

    function buildFullWatchUrl() {
      const target = new URL('https://www.youtube.com/watch');
      target.searchParams.set('v', currentVideoId);
      if (listId) target.searchParams.set('list', listId);
      if (Number.isInteger(currentIndex) && currentIndex >= 0) {
        target.searchParams.set('index', String(currentIndex));
      }
      target.searchParams.set('aero_native', '1');
      return target.toString();
    }

    function goToIndex(index) {
      if (!queue.length) return;
      if (index < 0 || index >= queue.length) return;

      currentIndex = index;
      currentVideoId = queue[index];
      publishState();
      location.replace(buildEmbedFor(currentVideoId, currentIndex));
    }

    function goNext() {
      if (!queue.length) return;
      const base = currentIndex >= 0 ? currentIndex : queue.indexOf(currentVideoId);
      const next = base + 1;
      if (next >= 0 && next < queue.length) goToIndex(next);
    }

    function goPrev() {
      if (!queue.length) return;
      const base = currentIndex >= 0 ? currentIndex : queue.indexOf(currentVideoId);
      goToIndex(Math.max(0, base - 1));
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

    async function loadQueue() {
      if (!listId) return;

      try {
        const cached = JSON.parse(sessionStorage.getItem(queueKey()) || 'null');
        if (cached && cached.listId === listId && Array.isArray(cached.ids) && cached.ids.length > 1) {
          queue = cached.ids.filter(validVideoId).slice(0, 100);
        }
      } catch (_) {}

      if (!queue.length) {
        try {
          const source = new URL('https://www.youtube.com/watch');
          source.searchParams.set('v', seedId);
          source.searchParams.set('list', listId);
          if (requestedIndex >= 0) source.searchParams.set('index', String(requestedIndex));
          source.searchParams.set('aero_native', '1');

          const response = await fetch(source.toString(), {
            credentials: 'include',
            cache: 'no-store'
          });

          if (!response.ok) throw new Error('Mix fetch failed');

          let html = await response.text();
          queue = extractPlaylistIds(html);
          html = '';
        } catch (_) {
          queue = [];
        }
      }

      if (queue.length) {
        if (
          requestedIndex >= 0 &&
          requestedIndex < queue.length &&
          queue[requestedIndex] === currentVideoId
        ) {
          currentIndex = requestedIndex;
        } else {
          currentIndex = queue.indexOf(currentVideoId);
          if (currentIndex < 0) currentIndex = 0;
        }
      }

      publishState();
    }

    function ensureOverlay() {
      if (document.getElementById('aero-embed-controls')) return;

      const controls = document.createElement('div');
      controls.id = 'aero-embed-controls';
      controls.innerHTML =
        '<button id="aero-embed-home" type="button">YouTube</button>' +
        '<button id="aero-embed-prev" type="button">‹</button>' +
        '<span id="aero-embed-status">Super Lite</span>' +
        '<button id="aero-embed-next" type="button">›</button>' +
        '<a id="aero-embed-full" href="#">Full page</a>';

      document.documentElement.appendChild(controls);

      document.getElementById('aero-embed-home').addEventListener('click', () => {
        location.href = 'https://www.youtube.com/';
      });

      document.getElementById('aero-embed-prev').addEventListener('click', goPrev);
      document.getElementById('aero-embed-next').addEventListener('click', goNext);

      document.getElementById('aero-embed-full').href = buildFullWatchUrl();
    }

    function updateOverlay() {
      ensureOverlay();

      const status = document.getElementById('aero-embed-status');
      const prev = document.getElementById('aero-embed-prev');
      const next = document.getElementById('aero-embed-next');
      const full = document.getElementById('aero-embed-full');

      if (status) {
        status.textContent = listId
          ? (queue.length && currentIndex >= 0
              ? 'Mix ' + (currentIndex + 1) + ' / ' + queue.length
              : 'Mix')
          : 'Cinema';
      }

      if (prev) prev.hidden = !listId;
      if (next) next.hidden = !listId;
      if (full) full.href = buildFullWatchUrl();
    }

    function bindEndedEvent() {
      const video = document.querySelector('video');
      if (!video || video === endedBoundVideo) return false;

      endedBoundVideo = video;
      video.addEventListener('ended', () => {
        if (queue.length) goNext();
      });

      return true;
    }

    function scheduleVideoBinding() {
      if (bindEndedEvent()) return;
      setTimeout(bindEndedEvent, 500);
      setTimeout(bindEndedEvent, 1500);
      setTimeout(bindEndedEvent, 3000);
    }

    function beginEmbedUi() {
      ensureOverlay();
      updateOverlay();
      loadQueue();
      scheduleVideoBinding();
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', beginEmbedUi, { once:true });
    } else {
      beginEmbedUi();
    }
  }
})();
