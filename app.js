'use strict';

const STORAGE_KEY = 'yt-super-lite-v1';
const state = {
  queue: [],
  index: -1,
  playlistMode: null,
  autoplay: true,
  lowMemory: true,
  shuffle: false,
  repeat: 'off',
  speed: 1,
  refreshEvery: 8,
  playsSinceRefresh: 0
};

let player = null;
let playerReady = false;
let pending = [];
let draggedIndex = null;

const $ = (id) => document.getElementById(id);
const els = {
  input: $('urlInput'), playNow: $('playNowBtn'), add: $('addBtn'), message: $('message'),
  nowTitle: $('nowTitle'), nowMeta: $('nowMeta'), queueList: $('queueList'),
  queueCount: $('queueCount'), emptyQueue: $('emptyQueue'), clear: $('clearBtn'),
  prev: $('prevBtn'), toggle: $('toggleBtn'), next: $('nextBtn'),
  autoplay: $('autoplayToggle'), lowMemory: $('lowMemoryToggle'), shuffle: $('shuffleToggle'),
  repeat: $('repeatSelect'), speed: $('speedSelect'), refresh: $('refreshSelect'),
  memoryLabel: $('memoryLabel'), playlistMode: $('playlistMode')
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (Array.isArray(saved.queue)) state.queue = saved.queue.filter(x => x && x.id);
    ['autoplay','lowMemory','shuffle'].forEach(k => {
      if (typeof saved[k] === 'boolean') state[k] = saved[k];
    });
    if (['off','one','queue'].includes(saved.repeat)) state.repeat = saved.repeat;
    if ([0.5,0.75,1,1.25,1.5,1.75,2].includes(Number(saved.speed))) state.speed = Number(saved.speed);
    if ([5,8,12,20].includes(Number(saved.refreshEvery))) state.refreshEvery = Number(saved.refreshEvery);
  } catch (_) {}
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    queue: state.queue,
    autoplay: state.autoplay,
    lowMemory: state.lowMemory,
    shuffle: state.shuffle,
    repeat: state.repeat,
    speed: state.speed,
    refreshEvery: state.refreshEvery
  }));
}

function syncSettings() {
  els.autoplay.checked = state.autoplay;
  els.lowMemory.checked = state.lowMemory;
  els.shuffle.checked = state.shuffle;
  els.repeat.value = state.repeat;
  els.speed.value = String(state.speed);
  els.refresh.value = String(state.refreshEvery);
  els.memoryLabel.textContent = state.lowMemory ? 'Low-memory mode on' : 'Low-memory mode off';
}

function setMessage(text, kind) {
  els.message.textContent = text || '';
  els.message.className = 'message' + (kind ? ' ' + kind : '');
}

function videoIdFrom(value) {
  const raw = String(value || '').trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return u.pathname.split('/').filter(Boolean)[0] || null;
    if (host.endsWith('youtube.com')) {
      if (u.searchParams.get('v')) return u.searchParams.get('v');
      const parts = u.pathname.split('/').filter(Boolean);
      if (['shorts','embed','live'].includes(parts[0]) && parts[1]) return parts[1];
    }
  } catch (_) {}
  return null;
}

function playlistIdFrom(value) {
  try {
    const u = new URL(String(value || '').trim());
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      return u.searchParams.get('list');
    }
  } catch (_) {}
  return null;
}

function parseInput() {
  const lines = els.input.value.split(/\n|\s+(?=https?:\/\/)/).map(s => s.trim()).filter(Boolean);
  const videos = [];
  let playlist = null;
  for (const line of lines) {
    const listId = playlistIdFrom(line);
    const vid = videoIdFrom(line);
    if (listId && lines.length === 1) playlist = { id: listId, videoId: vid };
    else if (vid) videos.push({ id: vid, title: '' });
  }
  return { videos, playlist };
}

function renderQueue() {
  els.queueList.textContent = '';
  els.queueCount.textContent = state.queue.length + (state.queue.length === 1 ? ' video' : ' videos');
  els.emptyQueue.classList.toggle('hidden', state.queue.length > 0 || !!state.playlistMode);
  els.playlistMode.classList.toggle('hidden', !state.playlistMode);
  els.playlistMode.textContent = state.playlistMode ? 'Playlist mode · ' + state.playlistMode.id : '';

  state.queue.forEach((item, i) => {
    const li = document.createElement('li');
    li.className = 'queue-item' + (!state.playlistMode && i === state.index ? ' active' : '');
    li.draggable = true;
    li.dataset.index = String(i);

    const num = document.createElement('span');
    num.className = 'queue-index';
    num.textContent = String(i + 1);

    const title = document.createElement('div');
    title.className = 'queue-title';
    const strong = document.createElement('strong');
    strong.textContent = item.title || 'YouTube video';
    const id = document.createElement('span');
    id.textContent = item.id;
    title.append(strong, id);

    const actions = document.createElement('div');
    actions.className = 'item-actions';
    const play = document.createElement('button');
    play.textContent = '▶';
    play.title = 'Play';
    play.addEventListener('click', () => playQueueIndex(i));
    const remove = document.createElement('button');
    remove.textContent = '✕';
    remove.title = 'Remove';
    remove.addEventListener('click', () => removeQueueItem(i));
    actions.append(play, remove);

    li.append(num, title, actions);
    li.addEventListener('dragstart', () => {
      draggedIndex = i;
      li.classList.add('dragging');
    });
    li.addEventListener('dragend', () => {
      draggedIndex = null;
      li.classList.remove('dragging');
    });
    li.addEventListener('dragover', e => e.preventDefault());
    li.addEventListener('drop', e => {
      e.preventDefault();
      if (draggedIndex === null || draggedIndex === i) return;
      const moved = state.queue.splice(draggedIndex, 1)[0];
      state.queue.splice(i, 0, moved);
      if (state.index === draggedIndex) state.index = i;
      else if (draggedIndex < state.index && i >= state.index) state.index--;
      else if (draggedIndex > state.index && i <= state.index) state.index++;
      saveState();
      renderQueue();
    });
    els.queueList.append(li);
  });
}

function createPlayer(onReadyAction) {
  playerReady = false;
  player = new YT.Player('player', {
    width: '100%',
    height: '100%',
    playerVars: {
      autoplay: 0,
      controls: 1,
      rel: 0,
      playsinline: 1,
      iv_load_policy: 3
    },
    events: {
      onReady: event => {
        playerReady = true;
        try { event.target.setPlaybackRate(state.speed); } catch (_) {}
        const jobs = pending.splice(0);
        jobs.forEach(fn => fn());
        if (onReadyAction) onReadyAction(event.target);
      },
      onStateChange: onPlayerStateChange,
      onError: e => setMessage('YouTube player error ' + e.data + '. The video may be unavailable or blocked from embeds.', 'error')
    }
  });
}

window.onYouTubeIframeAPIReady = () => createPlayer();

function whenReady(fn) {
  if (playerReady && player) fn();
  else pending.push(fn);
}

function rebuildPlayer(action) {
  playerReady = false;
  pending = [];
  try { if (player) player.destroy(); } catch (_) {}
  player = null;
  state.playsSinceRefresh = 0;
  const container = document.createElement('div');
  container.id = 'player';
  document.querySelector('.aspect').appendChild(container);
  createPlayer(action);
}

function loadVideoInto(target, item) {
  state.playlistMode = null;
  target.loadVideoById(item.id);
  try { target.setPlaybackRate(state.speed); } catch (_) {}
  renderQueue();
}

function playQueueIndex(i, useFreshPlayer) {
  if (!state.queue[i]) return;
  state.index = i;
  state.playlistMode = null;
  const item = state.queue[i];
  els.nowTitle.textContent = item.title || 'Loading…';
  els.nowMeta.textContent = item.id;
  renderQueue();
  saveState();
  if (useFreshPlayer) rebuildPlayer(target => loadVideoInto(target, item));
  else whenReady(() => loadVideoInto(player, item));
}

function playPlaylist(listId, videoId) {
  state.playlistMode = { id: listId };
  state.index = -1;
  renderQueue();
  els.nowTitle.textContent = 'YouTube playlist';
  els.nowMeta.textContent = listId;
  whenReady(() => {
    player.loadPlaylist({
      listType: 'playlist',
      list: listId,
      index: 0,
      startSeconds: 0
    });
    if (videoId) {
      setTimeout(() => {
        const ids = player.getPlaylist ? player.getPlaylist() : null;
        const idx = ids ? ids.indexOf(videoId) : -1;
        if (idx >= 0) player.playVideoAt(idx);
      }, 900);
    }
    applyPlaylistOptions();
  });
}

function applyPlaylistOptions() {
  if (!playerReady || !player || !state.playlistMode) return;
  try { player.setLoop(state.repeat === 'queue'); } catch (_) {}
  try { player.setShuffle(state.shuffle); } catch (_) {}
}

function addVideos(items, playFirst) {
  if (!items.length) return;
  const start = state.queue.length;
  const existing = new Set(state.queue.map(x => x.id));
  for (const item of items) if (!existing.has(item.id)) {
    state.queue.push(item);
    existing.add(item.id);
  }
  saveState();
  renderQueue();
  setMessage(items.length + (items.length === 1 ? ' video processed.' : ' videos processed.'), 'ok');
  if (playFirst) playQueueIndex(Math.min(start, state.queue.length - 1));
}

function removeQueueItem(i) {
  state.queue.splice(i, 1);
  if (i < state.index) state.index--;
  else if (i === state.index) state.index = Math.min(state.index, state.queue.length - 1);
  saveState();
  renderQueue();
}

function nextQueueIndex() {
  if (!state.queue.length) return -1;
  if (state.shuffle && state.queue.length > 1) {
    let n = state.index;
    while (n === state.index) n = Math.floor(Math.random() * state.queue.length);
    return n;
  }
  if (state.index + 1 < state.queue.length) return state.index + 1;
  return state.repeat === 'queue' ? 0 : -1;
}

function next() {
  if (state.playlistMode) {
    whenReady(() => player.nextVideo());
    return;
  }
  const n = nextQueueIndex();
  if (n >= 0) playQueueIndex(n);
}

function previous() {
  if (state.playlistMode) {
    whenReady(() => player.previousVideo());
    return;
  }
  if (!state.queue.length) return;
  const p = state.index > 0 ? state.index - 1 : (state.repeat === 'queue' ? state.queue.length - 1 : 0);
  playQueueIndex(p);
}

function maybeRefreshThenPlay(i) {
  const shouldRefresh = state.lowMemory && state.playsSinceRefresh >= state.refreshEvery;
  playQueueIndex(i, shouldRefresh);
  if (!shouldRefresh) return;
  setMessage('Player refreshed to release accumulated playback state.', 'ok');
}

function refreshPlaylistAfterEnd() {
  if (!playerReady || !player) return false;
  if (!(state.lowMemory && state.playsSinceRefresh >= state.refreshEvery)) return false;
  let ids = [];
  let current = 0;
  try {
    ids = player.getPlaylist() || [];
    current = player.getPlaylistIndex();
  } catch (_) {}
  if (!ids.length) return false;
  let nextIndex = current + 1;
  if (nextIndex >= ids.length) nextIndex = state.repeat === 'queue' ? 0 : -1;
  if (nextIndex < 0) return false;
  rebuildPlayer(target => {
    target.loadPlaylist(ids, nextIndex, 0);
    try { target.setLoop(state.repeat === 'queue'); } catch (_) {}
    try { target.setShuffle(state.shuffle); } catch (_) {}
  });
  setMessage('Playlist player refreshed to keep memory use down.', 'ok');
  return true;
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.PLAYING) {
    els.toggle.textContent = '❚❚';
    setTimeout(updateVideoData, 250);
  } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.CUED) {
    els.toggle.textContent = '▶';
  } else if (event.data === YT.PlayerState.ENDED) {
    els.toggle.textContent = '▶';
    state.playsSinceRefresh++;
    if (state.repeat === 'one') {
      player.seekTo(0);
      player.playVideo();
      return;
    }
    if (!state.autoplay) return;
    if (state.playlistMode) {
      if (refreshPlaylistAfterEnd()) return;
      return;
    }
    const n = nextQueueIndex();
    if (n >= 0) maybeRefreshThenPlay(n);
  }
}

function updateVideoData() {
  if (!playerReady || !player) return;
  let data = {};
  try { data = player.getVideoData() || {}; } catch (_) {}
  if (data.title) els.nowTitle.textContent = data.title;
  const id = data.video_id || '';
  els.nowMeta.textContent = id || (state.playlistMode ? state.playlistMode.id : '');
  if (!state.playlistMode && state.index >= 0 && state.queue[state.index] && data.title) {
    state.queue[state.index].title = data.title;
    saveState();
    renderQueue();
  }
}

function playFromInput() {
  const parsed = parseInput();
  if (parsed.playlist) {
    playPlaylist(parsed.playlist.id, parsed.playlist.videoId);
    setMessage('Playlist loaded. YouTube will handle the playlist sequence.', 'ok');
    return;
  }
  if (!parsed.videos.length) {
    setMessage('I could not find a valid YouTube video or playlist in that input.', 'error');
    return;
  }
  addVideos(parsed.videos, true);
}

function addFromInput() {
  const parsed = parseInput();
  if (parsed.playlist) {
    setMessage('Playlist URLs play directly. Use Play now; expanding a playlist into the custom queue would require a YouTube Data API key.', 'error');
    return;
  }
  if (!parsed.videos.length) {
    setMessage('I could not find a valid YouTube video URL or ID.', 'error');
    return;
  }
  addVideos(parsed.videos, false);
}

els.playNow.addEventListener('click', playFromInput);
els.add.addEventListener('click', addFromInput);
els.prev.addEventListener('click', previous);
els.next.addEventListener('click', next);
els.toggle.addEventListener('click', () => whenReady(() => {
  const s = player.getPlayerState();
  if (s === YT.PlayerState.PLAYING) player.pauseVideo();
  else player.playVideo();
}));
els.clear.addEventListener('click', () => {
  state.queue = [];
  state.index = -1;
  state.playlistMode = null;
  saveState();
  renderQueue();
  setMessage('Queue cleared.');
});
els.autoplay.addEventListener('change', e => { state.autoplay = e.target.checked; saveState(); });
els.lowMemory.addEventListener('change', e => {
  state.lowMemory = e.target.checked;
  els.memoryLabel.textContent = state.lowMemory ? 'Low-memory mode on' : 'Low-memory mode off';
  saveState();
});
els.shuffle.addEventListener('change', e => {
  state.shuffle = e.target.checked;
  applyPlaylistOptions();
  saveState();
});
els.repeat.addEventListener('change', e => {
  state.repeat = e.target.value;
  applyPlaylistOptions();
  saveState();
});
els.speed.addEventListener('change', e => {
  state.speed = Number(e.target.value);
  whenReady(() => {
    try { player.setPlaybackRate(state.speed); } catch (_) {}
  });
  saveState();
});
els.refresh.addEventListener('change', e => {
  state.refreshEvery = Number(e.target.value);
  saveState();
});

document.addEventListener('keydown', e => {
  if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) return;
  if (e.code === 'Space') {
    e.preventDefault();
    els.toggle.click();
  } else if (e.key.toLowerCase() === 'n') next();
  else if (e.key.toLowerCase() === 'p') previous();
  else if (e.key === 'ArrowLeft') whenReady(() => player.seekTo(Math.max(0, player.getCurrentTime() - 5), true));
  else if (e.key === 'ArrowRight') whenReady(() => player.seekTo(player.getCurrentTime() + 5, true));
});

loadState();
syncSettings();
renderQueue();