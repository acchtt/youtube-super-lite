'use strict';

const HISTORY_LIMIT = 200;
const state = {
  queue: [],
  index: -1,
  playlistMode: null,
  autoplayMode: 'personalized',
  autoplay: true,
  lowMemory: true,
  cinema: true,
  shuffle: false,
  tasteGate: 'balanced',
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
let tasteGateSkips = 0;
let tasteGateChecking = false;
let videoHistory = [];
let lastPlaylist = null;
let lastVideo = null;
let currentTabTrack = { title:'', author:'', state:'idle' };

const $ = id => document.getElementById(id);
const els = {
  input: $('urlInput'), playNow: $('playNowBtn'), add: $('addBtn'), message: $('message'),
  nowTitle: $('nowTitle'), nowMeta: $('nowMeta'), queueList: $('queueList'),
  queueCount: $('queueCount'), emptyQueue: $('emptyQueue'), clear: $('clearBtn'),
  prev: $('prevBtn'), toggle: $('toggleBtn'), next: $('nextBtn'),
  autoplayMode: $('autoplayModeSelect'), autoplay: $('autoplayToggle'),
  lowMemory: $('lowMemoryToggle'), cinema: $('cinemaToggle'), shuffle: $('shuffleToggle'),
  tasteGate: $('tasteGateSelect'),
  repeat: $('repeatSelect'), speed: $('speedSelect'), refresh: $('refreshSelect'),
  memoryLabel: $('memoryLabel'), playlistMode: $('playlistMode'),
  takeoutInput: $('takeoutInput'), importTakeout: $('importTakeoutBtn'),
  startPersonalized: $('startPersonalizedBtn'), forgetProfile: $('forgetProfileBtn'),
  profileStatus: $('profileStatus'), profileStats: $('profileStats'),
  startupGate: $('startupGate'), startupForm: $('startupForm'),
  startupUrl: $('startupUrl'), startupError: $('startupError'), startupSkip: $('startupSkip'),
  mediaLayout: $('mediaLayout'),
  historyList: $('historyList'), historyCount: $('historyCount'),
  emptyHistory: $('emptyHistory'), clearHistory: $('clearHistoryBtn'),
  resumeVideoBox: $('resumeVideoBox'), resumeVideoTitle: $('resumeVideoTitle'),
  resumeVideoMeta: $('resumeVideoMeta'), resumeVideoBtn: $('resumeVideoBtn'),
  resumePlaylistBox: $('resumePlaylistBox'), resumePlaylistTitle: $('resumePlaylistTitle'),
  resumePlaylistMeta: $('resumePlaylistMeta'), resumePlaylistBtn: $('resumePlaylistBtn')
};

async function loadState() {
  const remote = await CloudState.loadState();
  const saved = remote.settings || {};

  if (Array.isArray(saved.queue)) state.queue = saved.queue.filter(x => x && x.id);
  ['autoplay','lowMemory','cinema','shuffle'].forEach(k => {
    if (typeof saved[k] === 'boolean') state[k] = saved[k];
  });
  if (['personalized','mix','queue'].includes(saved.autoplayMode)) state.autoplayMode = saved.autoplayMode;
  if (['off','balanced','strict'].includes(saved.tasteGate)) state.tasteGate = saved.tasteGate;
  if (['off','one','queue'].includes(saved.repeat)) state.repeat = saved.repeat;
  if ([0.5,0.75,1,1.25,1.5,1.75,2].includes(Number(saved.speed))) state.speed = Number(saved.speed);
  if ([5,8,12,20].includes(Number(saved.refreshEvery))) state.refreshEvery = Number(saved.refreshEvery);
  if (Number.isFinite(saved.volume) && saved.volume >= 0 && saved.volume <= 100) state.volume = saved.volume;
  if (typeof saved.muted === 'boolean') state.muted = saved.muted;

  lastVideo = remote.lastVideo || null;
  lastPlaylist = remote.lastPlaylist || null;
}

function saveState() {
  CloudState.saveSettings({
    queue: state.queue,
    autoplayMode: state.autoplayMode,
    autoplay: state.autoplay,
    lowMemory: state.lowMemory,
    cinema: state.cinema,
    shuffle: state.shuffle,
    tasteGate: state.tasteGate,
    repeat: state.repeat,
    speed: state.speed,
    refreshEvery: state.refreshEvery,
    volume: state.volume,
    muted: state.muted
  });
}

function syncSettings() {
  els.autoplayMode.value = state.autoplayMode;
  els.autoplay.checked = state.autoplay;
  els.lowMemory.checked = state.lowMemory;
  els.cinema.checked = state.cinema;
  document.body.classList.toggle('cinema', state.cinema);
  els.shuffle.checked = state.shuffle;
  els.tasteGate.value = state.tasteGate;
  els.repeat.value = state.repeat;
  els.speed.value = String(state.speed);
  els.refresh.value = String(state.refreshEvery);
  els.memoryLabel.textContent = state.lowMemory ? 'Low-memory mode on' : 'Low-memory mode off';
}

function setMessage(text, kind) {
  els.message.textContent = text || '';
  els.message.className = 'message' + (kind ? ' ' + kind : '');
}


function cleanTabText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function renderTabTitle() {
  const title = cleanTabText(currentTabTrack.title);
  const author = cleanTabText(currentTabTrack.author);

  if (!title) {
    document.title = 'Aero × IVE · v0.10.9';
    return;
  }

  const icon = currentTabTrack.state === 'paused' ? '⏸' :
    currentTabTrack.state === 'playing' ? '▶' : '♪';
  const suffix = author ? ' · ' + author : '';
  document.title = icon + ' ' + title + suffix;
}

function setTabTrack(title, author, playbackState) {
  currentTabTrack = {
    title: cleanTabText(title),
    author: cleanTabText(author),
    state: playbackState || currentTabTrack.state || 'playing'
  };
  renderTabTitle();
}

function setTabPlaybackState(playbackState) {
  currentTabTrack.state = playbackState;
  renderTabTitle();
}

function renderProfile() {
  if (!els.profileStatus || !els.profileStats || !els.startPersonalized || !els.forgetProfile) return;
  if (!profile) {
    els.profileStatus.textContent = 'No YouTube Takeout profile imported';
    els.profileStats.textContent = 'Import your YouTube Takeout ZIP. It is parsed in this browser, then only the compact profile is stored in Cloudflare D1.';
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

function playbackContextFrom(value) {
  const raw = String(value || '').trim();
  const id = videoIdFrom(raw);
  if (!id) return null;

  let listId = null;
  let listIndex = null;
  try {
    const u = new URL(raw);
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      listId = u.searchParams.get('list') || null;
      const index = Number(u.searchParams.get('index'));
      if (Number.isInteger(index) && index > 0) listIndex = index - 1;
    }
  } catch (_) {}

  return { id, title:'', listId, listIndex };
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
    const context = playbackContextFrom(line);

    // Always play the exact watch video first, but preserve any list= context
    // so the continuation uses the same playlist/radio the user pasted.
    if (context) {
      videos.push(context);
      continue;
    }

    if (lines.length === 1 && isStandalonePlaylistUrl(line)) {
      const listId = playlistIdFrom(line);
      if (listId) playlist = { id: listId, videoId: null };
    }
  }
  return { videos, playlist };
}

function videoIdFromStartup(value) {
  const context = playbackContextFrom(value);
  return context ? context.id : null;
}

function closeStartupGate() {
  if (els.startupGate) els.startupGate.classList.add('hidden');
  document.body.classList.remove('startup-locked');
}

function showMediaLayout() {
  if (els.mediaLayout) els.mediaLayout.classList.remove('hidden');
}

function startFromStartupPrompt() {
  const value = String(els.startupUrl && els.startupUrl.value || '').trim();
  const context = playbackContextFrom(value);

  if (!context) {
    if (els.startupError) els.startupError.textContent = 'Paste a valid YouTube video link or 11-character video ID.';
    if (els.startupUrl) els.startupUrl.focus();
    return;
  }

  if (els.startupError) els.startupError.textContent = '';
  if (els.input) els.input.value = value;

  closeStartupGate();

  // Startup choice is always exact. If YouTube supplied list= in the copied
  // URL, preserve it for the continuation instead of regenerating a new RD list.
  playExactManual(context);
  setMessage(
    context.listId
      ? 'Session started inside the exact playlist/Radio from your pasted URL.'
      : 'Session started from your chosen video. Its YouTube Radio will continue afterward.',
    'ok'
  );
}

function saveLastVideo(force = false) {
  if (lastVideo && lastVideo.id) CloudState.saveLastVideo(lastVideo, force);
}

function rememberLastVideo(details = {}, force = false) {
  if (!details.id) return;

  lastVideo = {
    id: details.id,
    title: details.title || (lastVideo && lastVideo.id === details.id ? lastVideo.title : '') || 'YouTube video',
    channel: details.channel || (lastVideo && lastVideo.id === details.id ? lastVideo.channel : '') || '',
    seconds: Number.isFinite(details.seconds) ? Math.max(0, details.seconds) :
      (lastVideo && lastVideo.id === details.id && Number.isFinite(lastVideo.seconds) ? lastVideo.seconds : 0),
    listId: details.listId || (state.playlistMode && state.playlistMode.id) || null,
    listIndex: Number.isInteger(details.listIndex) ? details.listIndex : null,
    savedAt: Date.now()
  };
  saveLastVideo(force);
  renderResumeVideo();
}

function formatPlaybackTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours
    ? hours + ':' + String(minutes).padStart(2, '0') + ':' + String(secs).padStart(2, '0')
    : minutes + ':' + String(secs).padStart(2, '0');
}

function renderResumeVideo() {
  if (!els.resumeVideoBox) return;
  const available = !!(lastVideo && lastVideo.id);
  els.resumeVideoBox.classList.toggle('hidden', !available);
  if (!available) return;

  els.resumeVideoTitle.textContent = lastVideo.title || 'Last played video';
  els.resumeVideoMeta.textContent = [
    lastVideo.channel,
    Number(lastVideo.seconds) >= 5 ? ('at ' + formatPlaybackTime(lastVideo.seconds)) : '',
    lastVideo.listId ? 'playlist/radio context saved' : ''
  ].filter(Boolean).join(' · ');
}

function capturePlaybackProgress(force = false) {
  if (!playerReady || !player) return;
  let data = {};
  let seconds = 0;
  let listIndex = null;
  try {
    data = player.getVideoData() || {};
    seconds = Number(player.getCurrentTime()) || 0;
    if (state.playlistMode) {
      const index = player.getPlaylistIndex();
      if (Number.isInteger(index) && index >= 0) listIndex = index;
    }
  } catch (_) {
    return;
  }

  if (!data.video_id) return;
  rememberLastVideo({
    id: data.video_id,
    title: data.title || '',
    channel: data.author || '',
    seconds,
    listId: state.playlistMode && state.playlistMode.id || null,
    listIndex
  }, force);
}

function resumeLastVideo() {
  if (!lastVideo || !lastVideo.id) return;

  closeStartupGate();

  playExactManual({
    id: lastVideo.id,
    title: lastVideo.title || '',
    listId: lastVideo.listId || null,
    listIndex: Number.isInteger(lastVideo.listIndex) ? lastVideo.listIndex : null,
    startSeconds: Number(lastVideo.seconds) >= 5 ? Number(lastVideo.seconds) : 0
  });

  setMessage(
    Number(lastVideo.seconds) >= 5
      ? 'Resuming the last video from ' + formatPlaybackTime(lastVideo.seconds) + '.'
      : 'Resuming the last played video.',
    'ok'
  );
}

function saveLastPlaylist(force = false) {
  if (lastPlaylist && lastPlaylist.id) CloudState.saveLastPlaylist(lastPlaylist, force);
}

function rememberPlaylist(mode, details = {}) {
  if (!mode || !mode.id) return;

  let playlistIndex = Number.isInteger(details.index) ? details.index : null;
  if (playlistIndex == null && playerReady && player) {
    try {
      const current = player.getPlaylistIndex();
      if (Number.isInteger(current) && current >= 0) playlistIndex = current;
    } catch (_) {}
  }

  lastPlaylist = {
    id: mode.id,
    index: playlistIndex,
    currentVideoId: details.currentVideoId || '',
    title: details.title || '',
    channel: details.channel || '',
    savedAt: Date.now(),
    personalized: !!mode.personalized,
    mix: !!mode.mix,
    radio: !!mode.radio,
    manualRadio: !!mode.manualRadio,
    sourceList: !!mode.sourceList,
    preserveSequence: !!mode.preserveSequence,
    seedId: mode.seedId || ''
  };
  saveLastPlaylist();
  renderResumePlaylist();
}

function renderResumePlaylist() {
  if (!els.resumePlaylistBox) return;
  const available = !!(lastPlaylist && lastPlaylist.id);
  els.resumePlaylistBox.classList.toggle('hidden', !available);
  if (!available) return;

  const label = lastPlaylist.radio || /^RD/.test(lastPlaylist.id)
    ? 'YouTube Radio'
    : 'YouTube playlist';

  els.resumePlaylistTitle.textContent = lastPlaylist.title || label;
  els.resumePlaylistMeta.textContent = [
    lastPlaylist.channel,
    label,
    lastPlaylist.id
  ].filter(Boolean).join(' · ');
}

function resumeLastPlaylist() {
  if (!lastPlaylist || !lastPlaylist.id) return;

  showMediaLayout();
  closeStartupGate();
  manualContinuation = null;
  personalizedMixPlays = 0;

  state.playlistMode = {
    id: lastPlaylist.id,
    seedId: lastPlaylist.seedId || lastPlaylist.currentVideoId || '',
    personalized: !!lastPlaylist.personalized,
    mix: !!lastPlaylist.mix || /^RD/.test(lastPlaylist.id),
    radio: !!lastPlaylist.radio || /^RD/.test(lastPlaylist.id),
    manualRadio: !!lastPlaylist.manualRadio || /^RD/.test(lastPlaylist.id),
    sourceList: !!lastPlaylist.sourceList,
    preserveSequence: !!lastPlaylist.preserveSequence,
    resumed: true
  };
  state.index = -1;
  renderQueue();

  els.nowTitle.textContent = lastPlaylist.title || 'Resuming last playlist…';
  els.nowMeta.textContent = lastPlaylist.id;

  whenReady(() => {
    const preferredIndex = Number.isInteger(lastPlaylist.index) && lastPlaylist.index >= 0
      ? lastPlaylist.index
      : 0;

    player.loadPlaylist({
      listType: 'playlist',
      list: lastPlaylist.id,
      index: preferredIndex,
      startSeconds: 0
    });

    setTimeout(() => {
      try {
        const ids = player.getPlaylist ? player.getPlaylist() : [];
        if (lastPlaylist.currentVideoId && ids && ids.length) {
          const found = ids.indexOf(lastPlaylist.currentVideoId);
          if (found >= 0 && found !== player.getPlaylistIndex()) player.playVideoAt(found);
        }
      } catch (_) {}
    }, 900);

    try { player.setLoop(state.repeat === 'queue'); } catch (_) {}
    try { player.setShuffle(state.shuffle); } catch (_) {}
    applyAudioPrefs(player);
  });

  setMessage('Resumed the last playlist from this browser.', 'ok');
}

async function loadVideoHistory() {
  return CloudState.loadHistory();
}

function saveVideoHistory() {
  return Promise.resolve();
}

function historySource() {
  if (manualContinuation) return 'Manual';
  if (state.playlistMode && state.playlistMode.sourceList) {
    return state.playlistMode.radio ? 'Pasted radio' : 'Pasted playlist';
  }
  if (state.playlistMode && state.playlistMode.personalized) return 'Personalized';
  if (state.playlistMode && state.playlistMode.manualRadio) return 'Radio';
  if (state.playlistMode) return 'Playlist';
  if (state.index >= 0) return 'Queue';
  return 'Video';
}

function recordVideoHistory(id, title, channel) {
  if (!id) return;
  const item = {
    id,
    title: title || 'YouTube video',
    channel: channel || '',
    at: Date.now(),
    source: historySource(),
    listId: state.playlistMode && state.playlistMode.id || null
  };

  // Collapse only immediate duplicate state events; later replays remain visible.
  if (videoHistory[0] && videoHistory[0].id === id) {
    videoHistory[0] = { ...videoHistory[0], ...item };
  } else {
    videoHistory.unshift(item);
  }
  videoHistory = videoHistory.slice(0, HISTORY_LIMIT);
  CloudState.addHistory(item);
  renderVideoHistory();
}

function formatHistoryTime(value) {
  const d = new Date(value || 0);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleString([], {
    month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'
  });
}

function renderVideoHistory() {
  if (!els.historyList) return;
  els.historyList.textContent = '';
  if (els.historyCount) {
    els.historyCount.textContent = videoHistory.length + (videoHistory.length === 1 ? ' video' : ' videos');
  }
  if (els.emptyHistory) els.emptyHistory.classList.toggle('hidden', videoHistory.length > 0);

  videoHistory.slice(0, 60).forEach(item => {
    const li = document.createElement('li');
    li.className = 'history-item';

    const copy = document.createElement('div');
    copy.className = 'history-copy';
    const title = document.createElement('strong');
    title.className = 'history-title';
    title.textContent = item.title || 'YouTube video';
    const meta = document.createElement('span');
    meta.className = 'history-meta';
    meta.textContent = [item.channel, item.source, formatHistoryTime(item.at)].filter(Boolean).join(' · ');
    copy.append(title, meta);

    const play = document.createElement('button');
    play.type = 'button';
    play.className = 'history-play';
    play.textContent = '▶';
    play.title = 'Play this video';
    play.addEventListener('click', () => {
      playExactManual({ id:item.id, title:item.title || '', listId:null, listIndex:null });
      setMessage('Playing from local video history.', 'ok');
      window.scrollTo({ top:0, behavior:'smooth' });
    });

    li.append(copy, play);
    els.historyList.appendChild(li);
  });
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
    host: 'https://www.youtube.com',
    playerVars: {
      autoplay: 0,
      controls: 1,
      rel: 1,
      playsinline: 1,
      iv_load_policy: 3,
      origin: window.location.origin
    },
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
  showMediaLayout();
  tasteGateSkips = 0;
  personalizedMixPlays = 0;

  // Deterministic first-track rule: never let list=/RD context choose the
  // initial iframe item. The exact pasted v= ID is always loaded directly.
  manualContinuation = {
    seed: item,
    started: false,
    listId: item.listId || null,
    listIndex: Number.isInteger(item.listIndex) ? item.listIndex : null
  };

  if (item.listId) {
    const isRadio = /^RD/.test(item.listId);
    rememberPlaylist({
      id: item.listId,
      seedId: item.id,
      personalized: false,
      mix: isRadio,
      radio: isRadio,
      manualRadio: isRadio,
      sourceList: true,
      preserveSequence: true
    }, {
      index: Number.isInteger(item.listIndex) ? item.listIndex : null,
      currentVideoId: item.id,
      title: item.title || ''
    });
  }

  state.playlistMode = null;
  state.index = -1;
  els.nowTitle.textContent = 'Loading exact requested video…';
  els.nowMeta.textContent = item.id;
  renderQueue();

  whenReady(() => {
    try { player.stopVideo(); } catch (_) {}
    const startSeconds = Number(item.startSeconds) || 0;
    if (startSeconds > 0) {
      player.loadVideoById({ videoId:item.id, startSeconds });
    } else {
      player.loadVideoById(item.id);
    }
    try { player.setPlaybackRate(state.speed); } catch (_) {}
    applyAudioPrefs(player);
  });
}

function continueAfterManualVideo() {
  if (!manualContinuation) return false;
  tasteGateSkips = 0;

  // Ignore a stale ENDED event from the previously loaded playlist/video.
  // Only start the radio after the exact requested seed has actually played.
  if (!manualContinuation.started) return true;

  const next = manualContinuation;
  manualContinuation = null;
  personalizedMixPlays = 0;

  const listId = next.listId || ('RD' + next.seed.id);
  const isRadio = /^RD/.test(listId);
  state.playlistMode = {
    id: listId,
    seedId: next.seed.id,
    personalized: false,
    mix: isRadio,
    radio: isRadio,
    manualRadio: isRadio,
    sourceList: !!next.listId,
    preserveSequence: !!next.listId
  };
  state.index = -1;
  rememberPlaylist(state.playlistMode, {
    index: Number.isInteger(next.listIndex) ? next.listIndex : 0,
    currentVideoId: next.seed.id,
    title: next.seed.title || ''
  });
  renderQueue();

  const action = target => {
    target.loadPlaylist({ listType: 'playlist', list: listId, index: 0, startSeconds: 0 });
    setTimeout(() => {
      try {
        const ids = target.getPlaylist ? target.getPlaylist() : [];
        const seedIndex = ids ? ids.indexOf(next.seed.id) : -1;
        if (seedIndex >= 0 && ids.length > 1) {
          target.playVideoAt((seedIndex + 1) % ids.length);
        } else if (Number.isInteger(next.listIndex) && ids && ids.length) {
          const nextIndex = Math.min(next.listIndex + 1, ids.length - 1);
          target.playVideoAt(nextIndex);
        }
      } catch (_) {}
    }, 900);
    try { target.setLoop(state.repeat === 'queue'); } catch (_) {}
    try { target.setShuffle(state.shuffle); } catch (_) {}
  };

  const fresh = state.lowMemory && state.playsSinceRefresh >= state.refreshEvery;
  if (fresh) rebuildPlayer(action);
  else whenReady(() => action(player));

  setMessage(
    next.listId
      ? 'Requested video finished. Continuing with the playlist/Radio from the pasted URL.'
      : 'Requested video finished. Continuing with its generated YouTube Radio.',
    'ok'
  );
  return true;
}

function playQueueIndex(i, useFreshPlayer) {
  manualContinuation = null;
  if (!state.queue[i]) return;
  showMediaLayout();
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
  showMediaLayout();
  manualContinuation = null;
  state.playlistMode = {
    id: listId,
    sourceList: true,
    preserveSequence: true,
    radio: /^RD/.test(listId),
    manualRadio: /^RD/.test(listId),
    mix: /^RD/.test(listId)
  };
  state.index = -1;
  rememberPlaylist(state.playlistMode, { currentVideoId: videoId || '' });
  renderQueue();
  els.nowTitle.textContent = 'YouTube playlist';
  els.nowMeta.textContent = listId;
  whenReady(() => loadPlaylistInto(player, listId, videoId));
}

function playMixFromSeed(item, personalized, fresh) {
  manualContinuation = null;
  personalizedMixPlays = 0;
  if (!item || !item.id) return;
  showMediaLayout();
  const listId = 'RD' + item.id;
  state.playlistMode = {
    id: listId,
    seedId: item.id,
    personalized: !!personalized,
    mix: !personalized,
    radio: true,
    manualRadio: !personalized
  };
  state.index = -1;
  rememberPlaylist(state.playlistMode, {
    index: 0,
    currentVideoId: item.id,
    title: item.title || '',
    channel: item.channel || ''
  });
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

  // If the user pasted a plain watch URL and presses Next before it ends,
  // honor that manual intent by entering the seed's YouTube Radio instead of
  // falling through to the historical Personalized profile.
  if (manualContinuation) {
    manualContinuation.started = true;
    if (continueAfterManualVideo()) return;
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
    setTabPlaybackState('playing');
    setTimeout(updateVideoData, 250);
  } else if (event.data === YT.PlayerState.PAUSED) {
    els.toggle.textContent = '▶';
    setTabPlaybackState('paused');
  } else if (event.data === YT.PlayerState.CUED) {
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

function shouldSkipRadioChannel(channelName) {
  if (state.tasteGate === 'off' || !profile) return false;
  if (!(state.playlistMode && state.playlistMode.manualRadio)) return false;
  if (state.playlistMode.preserveSequence) return false;

  const affinity = TakeoutPersonalization.getChannelAffinity(channelName);
  if (!affinity) return false;

  if (state.tasteGate === 'strict') {
    if (!affinity.known) return true;
    if (affinity.subscribed) return false;
    if (affinity.recentRank <= 1800) return false;
    return affinity.watchCount < 3;
  }

  // Balanced must be conservative because YouTube author names do not always
  // match Takeout channel labels exactly. Unknown/unmatched channels are allowed.
  // Only skip a channel when the profile positively identifies it as both stale
  // and very weak.
  if (!affinity.known) return false;
  if (affinity.subscribed) return false;
  if (affinity.recentRank <= 5000) return false;
  return affinity.watchCount < 2;
}

function skipCurrentRadioItem(channelName) {
  // Never allow the taste filter to turn into a rapid skip loop.
  if (tasteGateChecking) return;
  if (tasteGateSkips >= 2) {
    tasteGateSkips = 0;
    return;
  }
  tasteGateChecking = true;
  tasteGateSkips++;

  setMessage(
    'Skipping ' + (channelName || 'an unfamiliar channel') +
    ' because it is outside your recent Takeout taste.',
    'ok'
  );

  setTimeout(() => {
    try {
      if (playerReady && player && state.playlistMode && state.playlistMode.manualRadio) {
        player.nextVideo();
      }
    } catch (_) {}
    tasteGateChecking = false;
  }, 250);
}

function updateVideoData() {
  if (!playerReady || !player) return;
  let data = {};
  try { data = player.getVideoData() || {}; } catch (_) {}
  if (data.title) els.nowTitle.textContent = data.title;
  const id = data.video_id || '';
  if (data.author) state.lastChannel = data.author;
  if (data.title) setTabTrack(data.title, data.author || '', 'playing');
  els.nowMeta.textContent = [data.author, id].filter(Boolean).join(' · ') ||
    (state.playlistMode ? state.playlistMode.id : '');

  if (id && manualContinuation && id === manualContinuation.seed.id) {
    manualContinuation.started = true;
  }

  if (id && id !== lastObservedVideoId) {
    lastObservedVideoId = id;

    let currentListIndex = null;
    if (state.playlistMode && playerReady && player) {
      try {
        const idx = player.getPlaylistIndex();
        if (Number.isInteger(idx) && idx >= 0) currentListIndex = idx;
      } catch (_) {}
    }

    rememberLastVideo({
      id,
      title: data.title || '',
      channel: data.author || '',
      seconds: 0,
      listId: state.playlistMode && state.playlistMode.id || null,
      listIndex: currentListIndex
    });

    if (state.playlistMode && state.playlistMode.id) {
      rememberPlaylist(state.playlistMode, {
        currentVideoId: id,
        title: data.title || '',
        channel: data.author || ''
      });
    }

    recordVideoHistory(id, data.title || '', data.author || '');

    if (
      state.playlistMode &&
      state.playlistMode.manualRadio &&
      data.author &&
      shouldSkipRadioChannel(data.author)
    ) {
      skipCurrentRadioItem(data.author);
      return;
    }

    tasteGateSkips = 0;
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
    const item = parsed.videos[0];
    playExactManual(item);
    setMessage(
      item.listId
        ? 'Playing the exact video inside the playlist/Radio context you pasted.'
        : 'Playing the exact video you pasted. Its YouTube Radio starts only after it ends.',
      'ok'
    );
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

if (els.startupForm) {
  els.startupForm.addEventListener('submit', event => {
    event.preventDefault();
    startFromStartupPrompt();
  });
}

if (els.startupSkip) {
  els.startupSkip.addEventListener('click', () => {
    if (els.startupError) els.startupError.textContent = '';
    closeStartupGate();
    if (els.input) els.input.focus();
  });
}

if (els.resumeVideoBtn) {
  els.resumeVideoBtn.addEventListener('click', resumeLastVideo);
}

if (els.resumePlaylistBtn) {
  els.resumePlaylistBtn.addEventListener('click', resumeLastPlaylist);
}

if (els.importTakeout && els.takeoutInput && els.startPersonalized && els.forgetProfile) {
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
      setMessage('Takeout imported. Raw archive data was discarded; only the compact taste profile was saved to Cloudflare D1.', 'ok');
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
    setMessage('Cloudflare personalization profile deleted.', 'ok');
  });
  
  
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
if (els.clearHistory) {
  els.clearHistory.addEventListener('click', async () => {
    videoHistory = [];
    try { await CloudState.clearHistory(); } catch (_) {}
    renderVideoHistory();
    TakeoutPersonalization.hydrateRecent([]);
    setMessage('Cloudflare video history cleared.', 'ok');
  });
}

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
els.tasteGate.addEventListener('change', e => { state.tasteGate = e.target.value; saveState(); });
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

async function bootstrap() {
  try {
    await CloudState.migrateLegacyBrowserData();
    await loadState();
    videoHistory = await loadVideoHistory();
    TakeoutPersonalization.hydrateRecent(videoHistory);
    await loadProfile();

    syncSettings();
    renderQueue();
    renderVideoHistory();
    renderResumeVideo();
    renderResumePlaylist();

    if (els.startupUrl) els.startupUrl.focus();
  } catch (error) {
    console.error(error);
    if (els.startupError) {
      els.startupError.textContent =
        'Cloudflare storage is not ready yet. Create/bind the D1 database as DB, run schema.sql, then redeploy.';
    }
  }
}

bootstrap();

// The iframe API has no volume-change event. Poll lightly so user volume/mute
// survives player rebuilds. Playback progress is persisted to D1 at a throttled rate.
setInterval(captureAudioPrefs, 1500);
setInterval(capturePlaybackProgress, 10000);

window.addEventListener('pagehide', () => {
  captureAudioPrefs();
  capturePlaybackProgress(true);
  if (lastPlaylist && lastPlaylist.id) CloudState.saveLastPlaylist(lastPlaylist, true);
});