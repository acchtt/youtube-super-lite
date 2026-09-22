'use strict';

const STORAGE_KEY = 'yt-super-lite-v2';
const state = {
  queue: [],
  index: -1,
  playlistMode: null,
  autoplayMode: 'personalized',
  autoplay: true,
  lowMemory: true,
  cinema: true,
  shuffle: false,
  repeat: 'off',
  speed: 1,
  refreshEvery: 8,
  playsSinceRefresh: 0,
  lastChannel: '',
  volume: null,
  muted: null
};

let player = null;
let playerReady = false;
let pending = [];
let draggedIndex = null;
let profile = null;
let manualContinuation = null;
let personalizedMixPlays = 0;
let lastObservedVideoId = '';

const $ = id => document.getElementById(id);
const els = {
  input: $('urlInput'), playNow: $('playNowBtn'), add: $('addBtn'), message: $('message'),
  nowTitle: $('nowTitle'), nowMeta: $('nowMeta'), queueList: $('queueList'),
  queueCount: $('queueCount'), emptyQueue: $('emptyQueue'), clear: $('clearBtn'),
  prev: $('prevBtn'), toggle: $('toggleBtn'), next: $('nextBtn'),
  autoplayMode: $('autoplayModeSelect'), autoplay: $('autoplayToggle'),
  lowMemory: $('lowMemoryToggle'), cinema: $('cinemaToggle'), shuffle: $('shuffleToggle'),
  repeat: $('repeatSelect'), speed: $('speedSelect'), refresh: $('refreshSelect'),
  memoryLabel: $('memoryLabel'), playlistMode: $('playlistMode'),
  takeoutInput: $('takeoutInput'), importTakeout: $('importTakeoutBtn'),
  startPersonalized: $('startPersonalizedBtn'), forgetProfile: $('forgetProfileBtn'),
  profileStatus: $('profileStatus'), profileStats: $('profileStats')
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (Array.isArray(saved.queue)) state.queue = saved.queue.filter(x => x && x.id);
    ['autoplay','lowMemory','cinema','shuffle'].forEach(k => {
      if (typeof saved[k] === 'boolean') state[k] = saved[k];
    });
    if (['personalized','mix','queue'].includes(saved.autoplayMode)) state.autoplayMode = saved.autoplayMode;
    if (['off','one','queue'].includes(saved.repeat)) state.repeat = saved.repeat;
    if ([0.5,0.75,1,1.25,1.5,1.75,2].includes(Number(saved.speed))) state.speed = Number(saved.speed);
    if ([5,8,12,20].includes(Number(saved.refreshEvery))) state.refreshEvery = Number(saved.refreshEvery);
    if (Number.isFinite(saved.volume) && saved.volume >= 0 && saved.volume <= 100) state.volume = saved.volume;
    if (typeof saved.muted === 'boolean') state.muted = saved.muted;
  } catch (_) {}
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    queue: state.queue,
    autoplayMode: state.autoplayMode,
    autoplay: state.autoplay,
    lowMemory: state.lowMemory,
    cinema: state.cinema,
    shuffle: state.shuffle,
    repeat: state.repeat,
    speed: state.speed,
    refreshEvery: state.refreshEvery,
    volume: state.volume,
    muted: state.muted
  }));
}

function syncSettings() {
  els.autoplayMode.value = state.autoplayMode;
  els.autoplay.checked = state.autoplay;
  els.lowMemory.checked = state.lowMemory;
  els.cinema.checked = state.cinema;
  document.body.classList.toggle('cinema', state.cinema);
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

function renderProfile() {
  if (!profile) {
    els.profileStatus.textContent = 'No YouTube Takeout profile imported';
    els.profileStats.textContent = 'Import your YouTube Takeout ZIP. It is parsed locally and never uploaded.';
    els.startPersonalized.disabled = true;
    els.forgetProfile.classList.add('hidden');
    return;
  }
  const s = profile.stats || {};
  els.profileStatus.textContent = 'Personalization profile ready';
  els.profileStats.textContent =
    (s.watchEvents || 0).toLocaleString() + ' watches · ' +
    (s.uniqueVideos || 0).toLocaleString() + ' unique videos · ' +
    (s.subscriptions || 0).toLocaleString() + ' subscriptions · ' +
    (s.playlistItems || 0).toLocaleString() + ' playlist items';
  els.startPersonalized.disabled = false;
  els.forgetProfile.classList.remove('hidden');
}

async function loadProfile() {
  try { profile = await TakeoutPersonalization.load(); } catch (_) { profile = null; }
  renderProfile();
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
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) return u.searchParams.get('list');
  } catch (_) {}
  return null;
}

function isStandalonePlaylistUrl(value) {
  try {
    const u = new URL(String(value || '').trim());
    const host = u.hostname.replace(/^www\./, '');
    return host.endsWith('youtube.com') && u.pathname === '/playlist' && !!u.searchParams.get('list');
  } catch (_) {}
  return false;
}

function parseInput() {
  const lines = els.input.value.split(/\n|\s+(?=https?:\/\/)/).map(s => s.trim()).filter(Boolean);
  const videos = [];
  let playlist = null;

  for (const line of lines) {
    const vid = videoIdFrom(line);

    // A watch/short/live/youtu.be URL is always an exact-video request.
    // Ignore any &list=... context YouTube appended to copied watch URLs.
    if (vid) {
      videos.push({ id: vid, title: '' });
      continue;
    }

    if (lines.length === 1 && isStandalonePlaylistUrl(line)) {
      const listId = playlistIdFrom(line);
      if (listId) playlist = { id: listId, videoId: null };
    }
  }
  return { videos, playlist };
}

function renderQueue() {
  els.queueList.textContent = '';
  els.queueCount.textContent = state.queue.length + (state.queue.length === 1 ? ' video' : ' videos');
  els.emptyQueue.classList.toggle('hidden', state.queue.length > 0 || !!state.playlistMode);
  els.playlistMode.classList.toggle('hidden', !state.playlistMode);
  if (state.playlistMode) {
    const label = state.playlistMode.personalized ? 'Personalized Mix' :
      state.playlistMode.mix ? 'YouTube Mix' : 'Playlist mode';
    els.playlistMode.textContent = label + ' · ' + state.playlistMode.id;
  }

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
    li.addEventListener('dragstart', () => { draggedIndex = i; li.classList.add('dragging'); });
    li.addEventListener('dragend', () => { draggedIndex = null; li.classList.remove('dragging'); });
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

function applyAudioPrefs(target) {
  if (!target) return;
  try {
    if (state.volume != null) target.setVolume(state.volume);
    if (state.muted === true) target.mute();
    else if (state.muted === false) target.unMute();
  } catch (_) {}
}

function captureAudioPrefs() {
  if (!playerReady || !player) return;
  try {
    const volume = player.getVolume();
    const muted = player.isMuted();
    let changed = false;
    if (Number.isFinite(volume) && volume !== state.volume) {
      state.volume = volume;
      changed = true;
    }
    if (typeof muted === 'boolean' && muted !== state.muted) {
      state.muted = muted;
      changed = true;
    }
    if (changed) saveState();
  } catch (_) {}
}

function createPlayer(onReadyAction) {
  playerReady = false;
  player = new YT.Player('player', {
    width: '100%',
    height: '100%',
    playerVars: { autoplay: 0, controls: 1, rel: 1, playsinline: 1, iv_load_policy: 3 },
    events: {
      onReady: event => {
        playerReady = true;
        try { event.target.setPlaybackRate(state.speed); } catch (_) {}
        applyAudioPrefs(event.target);
        const jobs = pending.splice(0);
        jobs.forEach(fn => fn());
        if (onReadyAction) onReadyAction(event.target);
      },
      onStateChange: onPlayerStateChange,
      onError: handlePlayerError
    }
  });
}

window.onYouTubeIframeAPIReady = () => createPlayer();

function whenReady(fn) {
  if (playerReady && player) fn();
  else pending.push(fn);
}

function rebuildPlayer(action) {
  captureAudioPrefs();
  playerReady = false;
  pending = [];
  try { if (player) player.destroy(); } catch (_) {}
  player = null;
  state.playsSinceRefresh = 0;
  const aspect = document.querySelector('.aspect');
  aspect.textContent = '';
  const container = document.createElement('div');
  container.id = 'player';
  aspect.appendChild(container);
  createPlayer(action);
}

function loadVideoInto(target, item) {
  state.playlistMode = null;
  target.loadVideoById(item.id);
  try { target.setPlaybackRate(state.speed); } catch (_) {}
  renderQueue();
}

function playExactManual(item) {
  if (!item || !item.id) return;
  // A manually pasted video is the strongest signal of current intent.
  // Always continue from that video's own YouTube Radio rather than
  // immediately handing control back to the historical Takeout profile.
  manualContinuation = { seed: item, started: false };
  state.playlistMode = null;
  state.index = -1;
  els.nowTitle.textContent = 'Loading requested video…';
  els.nowMeta.textContent = item.id;
  renderQueue();
  whenReady(() => {
    try { player.stopVideo(); } catch (_) {}
    player.loadVideoById(item.id);
    try { player.setPlaybackRate(state.speed); } catch (_) {}
    applyAudioPrefs(player);
  });
}

function continueAfterManualVideo() {
  if (!manualContinuation) return false;

  // Ignore a stale ENDED event from the previously loaded playlist/video.
  // Only start the radio after the exact requested seed has actually played.
  if (!manualContinuation.started) return true;

  const next = manualContinuation;
  manualContinuation = null;
  personalizedMixPlays = 0;

  const listId = 'RD' + next.seed.id;
  state.playlistMode = {
    id: listId,
    seedId: next.seed.id,
    personalized: false,
    mix: true,
    manualRadio: true
  };
  state.index = -1;
  renderQueue();

  const action = target => {
    target.loadPlaylist({ listType: 'playlist', list: listId, index: 0, startSeconds: 0 });
    setTimeout(() => {
      try {
        const ids = target.getPlaylist ? target.getPlaylist() : [];
        const seedIndex = ids ? ids.indexOf(next.seed.id) : -1;
        if (seedIndex >= 0 && ids.length > 1) {
          target.playVideoAt((seedIndex + 1) % ids.length);
        }
      } catch (_) {}
    }, 900);
    try { target.setLoop(state.repeat === 'queue'); } catch (_) {}
    try { target.setShuffle(state.shuffle); } catch (_) {}
  };

  const fresh = state.lowMemory && state.playsSinceRefresh >= state.refreshEvery;
  if (fresh) rebuildPlayer(action);
  else whenReady(() => action(player));

  setMessage('Requested video finished. Continuing with its YouTube Radio.', 'ok');
  return true;
}

function playQueueIndex(i, useFreshPlayer) {
  manualContinuation = null;
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

function loadPlaylistInto(target, listId, videoId) {
  target.loadPlaylist({ listType: 'playlist', list: listId, index: 0, startSeconds: 0 });
  if (videoId) {
    setTimeout(() => {
      try {
        const ids = target.getPlaylist ? target.getPlaylist() : null;
        const idx = ids ? ids.indexOf(videoId) : -1;
        if (idx >= 0) target.playVideoAt(idx);
      } catch (_) {}
    }, 900);
  }
  try { target.setLoop(state.repeat === 'queue'); } catch (_) {}
  try { target.setShuffle(state.shuffle); } catch (_) {}
}

function playPlaylist(listId, videoId) {
  manualContinuation = null;
  state.playlistMode = { id: listId };
  state.index = -1;
  renderQueue();
  els.nowTitle.textContent = 'YouTube playlist';
  els.nowMeta.textContent = listId;
  whenReady(() => loadPlaylistInto(player, listId, videoId));
}

function playMixFromSeed(item, personalized, fresh) {
  manualContinuation = null;
  personalizedMixPlays = 0;
  if (!item || !item.id) return;
  const listId = 'RD' + item.id;
  state.playlistMode = { id: listId, seedId: item.id, personalized: !!personalized, mix: !personalized };
  state.index = -1;
  if (item.channel) state.lastChannel = item.channel;
  els.nowTitle.textContent = item.title || (personalized ? 'Personalized Mix' : 'YouTube Mix');
  els.nowMeta.textContent = personalized ? 'Taste-profile seed · ' + item.id : 'YouTube Mix seed · ' + item.id;
  renderQueue();

  const action = target => {
    loadPlaylistInto(target, listId, item.id);
    setTimeout(() => {
      try {
        const ids = target.getPlaylist ? target.getPlaylist() : [];
        if (!ids || !ids.length) target.loadVideoById(item.id);
      } catch (_) { target.loadVideoById(item.id); }
    }, 1400);
  };
  if (fresh) rebuildPlayer(action);
  else whenReady(() => action(player));
}

function startPersonalized(fresh) {
  if (!profile) {
    setMessage('Import your YouTube Takeout ZIP first.', 'error');
    return;
  }
  const seed = TakeoutPersonalization.pickSeed(state.lastChannel);
  if (!seed) {
    setMessage('The imported profile has no playable seed videos.', 'error');
    return;
  }
  state.autoplayMode = 'personalized';
  els.autoplayMode.value = 'personalized';
  saveState();
  playMixFromSeed(seed, true, !!fresh);
  setMessage('Personalized radio started from your local viewing profile.', 'ok');
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
  else if (state.autoplay && state.autoplayMode === 'personalized') startPersonalized(false);
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

function refreshCurrentPlaylist() {
  if (!playerReady || !player || !state.playlistMode) return false;
  if (!(state.lowMemory && state.playsSinceRefresh >= state.refreshEvery)) return false;

  if (state.playlistMode.personalized && profile) {
    startPersonalized(true);
    setMessage('Player rebuilt and personalized seed refreshed.', 'ok');
    return true;
  }

  let ids = [];
  let current = 0;
  try { ids = player.getPlaylist() || []; current = player.getPlaylistIndex(); } catch (_) {}
  if (!ids.length) return false;
  let nextIndex = current + 1;
  if (nextIndex >= ids.length) nextIndex = state.repeat === 'queue' ? 0 : -1;
  if (nextIndex < 0) return false;
  rebuildPlayer(target => {
    target.loadPlaylist(ids, nextIndex, 0);
    try { target.setLoop(state.repeat === 'queue'); } catch (_) {}
    try { target.setShuffle(state.shuffle); } catch (_) {}
  });
  setMessage('Player rebuilt to release accumulated playback state.', 'ok');
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
    captureAudioPrefs();
    state.playsSinceRefresh++;

    if (state.repeat === 'one') {
      player.seekTo(0);
      player.playVideo();
      return;
    }
    if (!state.autoplay) return;

    if (state.playlistMode && state.playlistMode.personalized && personalizedMixPlays >= 2) {
      const fresh = state.lowMemory && state.playsSinceRefresh >= state.refreshEvery;
      startPersonalized(fresh);
      setMessage('Personalized mix reseeded to keep artist/channel variety.', 'ok');
      return;
    }

    if (state.playlistMode) {
      if (refreshCurrentPlaylist()) return;
      return;
    }

    if (continueAfterManualVideo()) return;

    if (state.autoplayMode === 'personalized' && profile) {
      startPersonalized(state.lowMemory && state.playsSinceRefresh >= state.refreshEvery);
      return;
    }
    const n = nextQueueIndex();
    if (n >= 0) playQueueIndex(n);
  }
}

function updateVideoData() {
  if (!playerReady || !player) return;
  let data = {};
  try { data = player.getVideoData() || {}; } catch (_) {}
  if (data.title) els.nowTitle.textContent = data.title;
  const id = data.video_id || '';
  if (data.author) state.lastChannel = data.author;
  els.nowMeta.textContent = [data.author, id].filter(Boolean).join(' · ') ||
    (state.playlistMode ? state.playlistMode.id : '');

  if (id && manualContinuation && id === manualContinuation.seed.id) {
    manualContinuation.started = true;
  }

  if (id && id !== lastObservedVideoId) {
    lastObservedVideoId = id;
    if (state.playlistMode && state.playlistMode.personalized) personalizedMixPlays++;
    TakeoutPersonalization.markPlayed(id, data.author || '');
  }
  if (!state.playlistMode && state.index >= 0 && state.queue[state.index] && data.title) {
    state.queue[state.index].title = data.title;
    saveState();
    renderQueue();
  }
}

function handlePlayerError(e) {
  const code = e && e.data;
  if (state.playlistMode && (state.playlistMode.personalized || state.playlistMode.mix)) {
    const seed = state.playlistMode.seedId;
    setMessage('YouTube Mix could not load for this seed. Falling back and trying another seed after it ends.', 'error');
    state.playlistMode = null;
    if (seed) whenReady(() => player.loadVideoById(seed));
    return;
  }
  setMessage('YouTube player error ' + code + '. The video may be unavailable or blocked from embeds.', 'error');
}

function playFromInput() {
  const parsed = parseInput();
  if (parsed.playlist) {
    playPlaylist(parsed.playlist.id, parsed.playlist.videoId);
    setMessage('Playlist loaded.', 'ok');
    return;
  }
  if (!parsed.videos.length) {
    setMessage('I could not find a valid YouTube video or playlist in that input.', 'error');
    return;
  }
  if (parsed.videos.length === 1 && state.autoplayMode !== 'queue') {
    playExactManual(parsed.videos[0]);
    setMessage('Playing the exact video you pasted. Related autoplay starts only after it ends.', 'ok');
    return;
  }
  addVideos(parsed.videos, true);
}

function addFromInput() {
  const parsed = parseInput();
  if (parsed.playlist) {
    setMessage('Playlist URLs play directly. Use Play now.', 'error');
    return;
  }
  if (!parsed.videos.length) {
    setMessage('I could not find a valid YouTube video URL or ID.', 'error');
    return;
  }
  addVideos(parsed.videos, false);
}

els.importTakeout.addEventListener('click', () => els.takeoutInput.click());
els.takeoutInput.addEventListener('change', async () => {
  const file = els.takeoutInput.files && els.takeoutInput.files[0];
  if (!file) return;
  els.importTakeout.disabled = true;
  els.startPersonalized.disabled = true;
  try {
    setMessage('Importing Takeout locally…');
    profile = await TakeoutPersonalization.importZip(file, msg => setMessage(msg));
    renderProfile();
    setMessage('Takeout imported. Raw archive data was discarded; only a compact local taste profile was saved.', 'ok');
  } catch (err) {
    setMessage(err.message || 'Takeout import failed.', 'error');
  } finally {
    els.importTakeout.disabled = false;
    els.takeoutInput.value = '';
  }
});
els.startPersonalized.addEventListener('click', () => startPersonalized(false));
els.forgetProfile.addEventListener('click', async () => {
  await TakeoutPersonalization.clear();
  profile = null;
  renderProfile();
  setMessage('Local personalization profile deleted.', 'ok');
});

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
  manualContinuation = null;
  saveState();
  renderQueue();
  setMessage('Queue cleared.');
});
els.autoplayMode.addEventListener('change', e => { state.autoplayMode = e.target.value; saveState(); });
els.autoplay.addEventListener('change', e => { state.autoplay = e.target.checked; saveState(); });
els.lowMemory.addEventListener('change', e => {
  state.lowMemory = e.target.checked;
  els.memoryLabel.textContent = state.lowMemory ? 'Low-memory mode on' : 'Low-memory mode off';
  saveState();
});
els.cinema.addEventListener('change', e => {
  state.cinema = e.target.checked;
  document.body.classList.toggle('cinema', state.cinema);
  saveState();
});
els.shuffle.addEventListener('change', e => { state.shuffle = e.target.checked; applyPlaylistOptions(); saveState(); });
els.repeat.addEventListener('change', e => { state.repeat = e.target.value; applyPlaylistOptions(); saveState(); });
els.speed.addEventListener('change', e => {
  state.speed = Number(e.target.value);
  whenReady(() => { try { player.setPlaybackRate(state.speed); } catch (_) {} });
  saveState();
});
els.refresh.addEventListener('change', e => { state.refreshEvery = Number(e.target.value); saveState(); });

document.addEventListener('keydown', e => {
  if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) return;
  if (e.code === 'Space') { e.preventDefault(); els.toggle.click(); }
  else if (e.key.toLowerCase() === 'n') next();
  else if (e.key.toLowerCase() === 'p') previous();
  else if (e.key === 'ArrowLeft') whenReady(() => player.seekTo(Math.max(0, player.getCurrentTime() - 5), true));
  else if (e.key === 'ArrowRight') whenReady(() => player.seekTo(player.getCurrentTime() + 5, true));
});

loadState();
syncSettings();
renderQueue();
loadProfile();

// The iframe API has no volume-change event. Poll lightly so user volume/mute
// survives player rebuilds, reloads, and future videos without writing unless changed.
setInterval(captureAudioPrefs, 1500);