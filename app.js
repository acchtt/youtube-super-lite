'use strict';

const HISTORY_LIMIT = 200;

const state = {
  autoplay: true,
  cinema: true,
  repeat: 'off',
  speed: 1,
  volume: null,
  muted: null,
  bridgeIndex: 0
};

let player = null;
let playerReady = false;
let pending = [];
let videoHistory = [];
let lastVideo = null;
let lastObservedVideoId = '';
let currentTabTrack = { title:'', author:'', state:'idle' };
let mixBridge = { snapshot:null, receivedAt:0, isNewCapture:false };
let bridgePlayback = null;

const $ = id => document.getElementById(id);
const els = {
  homePanel: $('homePanel'),
  loadingCard: $('loadingCard'),
  mixReadyCard: $('mixReadyCard'),
  mixEyebrow: $('mixEyebrow'),
  mixReadyTitle: $('mixReadyTitle'),
  mixReadyMeta: $('mixReadyMeta'),
  playMixBtn: $('playMixBtn'),
  emptyMixCard: $('emptyMixCard'),
  message: $('message'),
  mediaLayout: $('mediaLayout'),
  nowTitle: $('nowTitle'),
  nowMeta: $('nowMeta'),
  mixProgress: $('mixProgress'),
  prev: $('prevBtn'),
  toggle: $('toggleBtn'),
  next: $('nextBtn'),
  autoplay: $('autoplayToggle'),
  cinema: $('cinemaToggle'),
  repeat: $('repeatSelect'),
  speed: $('speedSelect'),
  mixStatus: $('mixStatus'),
  historyCard: $('historyCard'),
  historyList: $('historyList'),
  historyCount: $('historyCount'),
  emptyHistory: $('emptyHistory'),
  clearHistory: $('clearHistoryBtn'),
  resumeVideoBox: $('resumeVideoBox'),
  resumeVideoTitle: $('resumeVideoTitle'),
  resumeVideoMeta: $('resumeVideoMeta'),
  resumeVideoBtn: $('resumeVideoBtn')
};

async function loadState() {
  const remote = await CloudState.loadState();
  const saved = remote.settings || {};

  if (typeof saved.autoplay === 'boolean') state.autoplay = saved.autoplay;
  if (typeof saved.cinema === 'boolean') state.cinema = saved.cinema;
  if (['off','one','queue'].includes(saved.repeat)) state.repeat = saved.repeat;
  if ([0.5,0.75,1,1.25,1.5,1.75,2].includes(Number(saved.speed))) {
    state.speed = Number(saved.speed);
  }
  if (Number.isFinite(saved.volume) && saved.volume >= 0 && saved.volume <= 100) {
    state.volume = saved.volume;
  }
  if (typeof saved.muted === 'boolean') state.muted = saved.muted;
  if (Number.isInteger(saved.bridgeIndex) && saved.bridgeIndex >= 0) {
    state.bridgeIndex = saved.bridgeIndex;
  }

  if (saved.bridgeSnapshot) {
    const restored = sanitizeBridgeSnapshot(saved.bridgeSnapshot);
    if (restored) mixBridge.snapshot = restored;
  }

  lastVideo = remote.lastVideo || null;
}

function saveState() {
  CloudState.saveSettings({
    autoplay: state.autoplay,
    cinema: state.cinema,
    repeat: state.repeat,
    speed: state.speed,
    volume: state.volume,
    muted: state.muted,
    bridgeIndex: state.bridgeIndex,
    bridgeSnapshot: mixBridge.snapshot ? {
      listId: mixBridge.snapshot.listId,
      seedId: mixBridge.snapshot.seedId || '',
      capturedAt: mixBridge.snapshot.capturedAt || Date.now(),
      ids: mixBridge.snapshot.ids.slice(0, 120)
    } : null
  });
}

function syncSettings() {
  els.autoplay.checked = state.autoplay;
  els.cinema.checked = state.cinema;
  els.repeat.value = state.repeat;
  els.speed.value = String(state.speed);
  document.body.classList.toggle('cinema', state.cinema);
}

function setMessage(text, kind) {
  if (!els.message) return;
  els.message.textContent = text || '';
  els.message.className = 'message' + (kind ? ' ' + kind : '');
}

function sanitizeBridgeSnapshot(payload) {
  if (!payload || typeof payload !== 'object') return null;

  const listId = String(payload.listId || '').trim();
  if (!listId) return null;

  const rawIds = Array.isArray(payload.ids)
    ? payload.ids
    : (Array.isArray(payload.items) ? payload.items.map(item => item && item.id) : []);

  const ids = rawIds
    .map(id => String(id || '').trim())
    .filter(id => /^[A-Za-z0-9_-]{11}$/.test(id))
    .slice(0, 120);

  if (ids.length < 2) return null;

  return {
    listId,
    seedId: String(payload.seedId || '').trim(),
    capturedAt: Number(payload.capturedAt) || Date.now(),
    ids
  };
}

function applyBridgeSnapshot(payload, resetIndex = false) {
  const snapshot = sanitizeBridgeSnapshot(payload);
  if (!snapshot) return false;

  mixBridge.snapshot = snapshot;
  mixBridge.receivedAt = Date.now();
  mixBridge.isNewCapture = !!resetIndex;

  if (resetIndex || state.bridgeIndex >= snapshot.ids.length) state.bridgeIndex = 0;

  saveState();
  renderMixStatus();
  renderHomeState();

  setMessage('Mix captured · ' + snapshot.ids.length + ' tracks in exact order.', 'ok');
  return true;
}

function importMixFromHash() {
  const prefix = '#aeroMix=';
  if (!location.hash.startsWith(prefix)) return false;

  try {
    let encoded = location.hash.slice(prefix.length).replace(/-/g, '+').replace(/_/g, '/');
    while (encoded.length % 4) encoded += '=';
    const payload = JSON.parse(atob(encoded));
    if (!payload || payload.v !== 1 || !Array.isArray(payload.ids)) return false;

    const ok = applyBridgeSnapshot({
      listId: payload.listId || '',
      seedId: payload.seedId || '',
      capturedAt: Date.now(),
      ids: payload.ids
    }, true);

    if (ok) history.replaceState(null, '', location.pathname + location.search);
    return ok;
  } catch (_) {
    return false;
  }
}

function renderMixStatus() {
  if (!els.mixStatus) return;

  if (bridgePlayback && bridgePlayback.ids.length) {
    els.mixStatus.textContent =
      'Mix ' + (bridgePlayback.index + 1) + ' / ' + bridgePlayback.ids.length;
    els.mixStatus.classList.add('active');
    return;
  }

  const snapshot = mixBridge.snapshot;
  if (snapshot && snapshot.ids.length) {
    els.mixStatus.textContent = mixBridge.isNewCapture
      ? ('Mix captured · ' + snapshot.ids.length + ' tracks')
      : ('Mix ready · ' + snapshot.ids.length + ' tracks');
    els.mixStatus.classList.add('active');
    return;
  }

  els.mixStatus.textContent = 'No Mix loaded';
  els.mixStatus.classList.remove('active');
}

function renderHomeState() {
  const snapshot = mixBridge.snapshot;
  const hasMix = !!(snapshot && snapshot.ids.length > 1);

  els.loadingCard.classList.add('hidden');
  els.mixReadyCard.classList.toggle('hidden', !hasMix);
  els.emptyMixCard.classList.toggle('hidden', hasMix);
  els.homePanel.setAttribute('aria-busy', 'false');

  if (hasMix) {
    const canResume = !mixBridge.isNewCapture &&
      state.bridgeIndex > 0 &&
      state.bridgeIndex < snapshot.ids.length;

    els.mixEyebrow.textContent = mixBridge.isNewCapture ? 'MIX CAPTURED' : 'CAPTURED MIX';
    els.mixReadyTitle.textContent = mixBridge.isNewCapture
      ? 'Your Mix is ready'
      : 'Captured YouTube Mix';
    els.mixReadyMeta.textContent = [
      snapshot.ids.length + ' tracks',
      'exact order',
      canResume ? ('resume at ' + (state.bridgeIndex + 1) + '/' + snapshot.ids.length) : ''
    ].filter(Boolean).join(' · ');
    els.playMixBtn.textContent = canResume ? 'Resume Mix' : 'Play Mix';
  }
}

function showMediaLayout() {
  els.homePanel.classList.add('hidden');
  els.mediaLayout.classList.remove('hidden');
}

function showHomePanel() {
  els.mediaLayout.classList.add('hidden');
  els.homePanel.classList.remove('hidden');
}

function playLoadedMix() {
  const snapshot = mixBridge.snapshot;
  if (!snapshot || snapshot.ids.length < 2) {
    setMessage('Capture a Mix with the Aero Mix Bridge extension first.', 'error');
    return;
  }

  const startIndex = mixBridge.isNewCapture
    ? 0
    : Math.max(0, Math.min(state.bridgeIndex, snapshot.ids.length - 1));

  mixBridge.isNewCapture = false;
  bridgePlayback = {
    listId: snapshot.listId,
    seedId: snapshot.seedId || snapshot.ids[0],
    ids: snapshot.ids.slice(),
    index: startIndex,
    transitioning: true,
    correctionCount: 0
  };

  showMediaLayout();
  playBridgeIndex(startIndex);
  renderMixStatus();

  setMessage(
    (startIndex > 0 ? 'Resuming' : 'Playing') + ' captured Mix in exact order.',
    'ok'
  );
}

function cleanTabText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function renderTabTitle() {
  const title = cleanTabText(currentTabTrack.title);
  const author = cleanTabText(currentTabTrack.author);

  if (!title) {
    document.title = 'Aero × IVE · v0.14.1';
    return;
  }

  const icon = currentTabTrack.state === 'paused' ? '⏸' :
    currentTabTrack.state === 'playing' ? '▶' : '♪';
  document.title = icon + ' ' + title + (author ? ' · ' + author : '');
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

function formatPlaybackTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours
    ? hours + ':' + String(minutes).padStart(2, '0') + ':' + String(secs).padStart(2, '0')
    : minutes + ':' + String(secs).padStart(2, '0');
}

function rememberLastVideo(details = {}, force = false) {
  if (!details.id) return;

  lastVideo = {
    id: details.id,
    title: details.title || (lastVideo && lastVideo.id === details.id ? lastVideo.title : '') || 'YouTube video',
    channel: details.channel || (lastVideo && lastVideo.id === details.id ? lastVideo.channel : '') || '',
    seconds: Number.isFinite(details.seconds)
      ? Math.max(0, details.seconds)
      : (lastVideo && lastVideo.id === details.id && Number.isFinite(lastVideo.seconds) ? lastVideo.seconds : 0),
    savedAt: Date.now()
  };

  CloudState.saveLastVideo(lastVideo, force);
  renderResumeVideo();
}

function renderResumeVideo() {
  if (!els.resumeVideoBox) return;
  const available = !!(lastVideo && lastVideo.id);
  els.resumeVideoBox.classList.toggle('hidden', !available);
  if (!available) return;

  els.resumeVideoTitle.textContent = lastVideo.title || 'Last played video';
  els.resumeVideoMeta.textContent = [
    lastVideo.channel,
    Number(lastVideo.seconds) >= 5 ? ('at ' + formatPlaybackTime(lastVideo.seconds)) : ''
  ].filter(Boolean).join(' · ');
}

function capturePlaybackProgress(force = false) {
  if (!playerReady || !player) return;

  try {
    const data = player.getVideoData() || {};
    if (!data.video_id) return;

    rememberLastVideo({
      id: data.video_id,
      title: data.title || '',
      channel: data.author || '',
      seconds: Number(player.getCurrentTime()) || 0
    }, force);
  } catch (_) {}
}

function resumeLastVideo() {
  if (!lastVideo || !lastVideo.id) return;

  bridgePlayback = null;
  mixBridge.isNewCapture = false;
  showMediaLayout();
  renderMixStatus();
  updateTransport();

  const startSeconds = Number(lastVideo.seconds) >= 5 ? Number(lastVideo.seconds) : 0;
  whenReady(() => loadVideoInto(player, lastVideo.id, startSeconds));

  setMessage(
    startSeconds > 0
      ? 'Resuming the last video from ' + formatPlaybackTime(startSeconds) + '.'
      : 'Resuming the last played video.',
    'ok'
  );
}

async function loadVideoHistory() {
  return CloudState.loadHistory();
}

function historySource() {
  return bridgePlayback ? 'Captured Mix' : 'Video';
}

function recordVideoHistory(id, title, channel) {
  if (!id) return;

  const item = {
    id,
    title: title || 'YouTube video',
    channel: channel || '',
    at: Date.now(),
    source: historySource(),
    listId: bridgePlayback ? bridgePlayback.listId : null
  };

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
    month:'short',
    day:'numeric',
    hour:'2-digit',
    minute:'2-digit'
  });
}

function playHistoryItem(item) {
  if (!item || !item.id) return;

  bridgePlayback = null;
  mixBridge.isNewCapture = false;
  showMediaLayout();
  renderMixStatus();
  updateTransport();

  whenReady(() => loadVideoInto(player, item.id, 0));
  setMessage('Playing from video history.', 'ok');
  window.scrollTo({ top:0, behavior:'auto' });
}

function renderVideoHistory() {
  if (!els.historyList) return;

  els.historyList.textContent = '';
  els.historyCard.setAttribute('aria-busy', 'false');
  els.historyCount.textContent =
    videoHistory.length + (videoHistory.length === 1 ? ' video' : ' videos');
  els.emptyHistory.classList.toggle('hidden', videoHistory.length > 0);

  videoHistory.slice(0, 60).forEach(item => {
    const li = document.createElement('li');
    li.className = 'history-item';

    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'history-row';
    row.setAttribute('aria-label', 'Play ' + (item.title || 'video'));
    row.addEventListener('click', () => playHistoryItem(item));

    const copy = document.createElement('span');
    copy.className = 'history-copy';

    const title = document.createElement('span');
    title.className = 'history-title';
    title.textContent = item.title || 'YouTube video';

    const meta = document.createElement('span');
    meta.className = 'history-meta';
    meta.textContent = [item.channel, item.source, formatHistoryTime(item.at)]
      .filter(Boolean)
      .join(' · ');

    const icon = document.createElement('span');
    icon.className = 'history-play-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';

    copy.append(title, meta);
    row.append(copy, icon);
    li.appendChild(row);
    els.historyList.appendChild(li);
  });
}

function renderMixProgress() {
  if (!bridgePlayback) {
    els.mixProgress.classList.add('hidden');
    els.mixProgress.textContent = '';
    return;
  }

  els.mixProgress.textContent =
    (bridgePlayback.index + 1) + ' / ' + bridgePlayback.ids.length;
  els.mixProgress.classList.remove('hidden');
}

function updateTransport() {
  const hasBridge = !!(bridgePlayback && bridgePlayback.ids.length);
  if (!hasBridge) {
    els.prev.disabled = true;
    els.next.disabled = true;
    renderMixProgress();
    return;
  }

  els.prev.disabled = bridgePlayback.index <= 0 && state.repeat !== 'queue';
  els.next.disabled = bridgePlayback.index >= bridgePlayback.ids.length - 1 && state.repeat !== 'queue';
  renderMixProgress();
}

function applyAudioPrefs(target) {
  if (!target) return;
  try {
    if (Number.isFinite(state.volume)) target.setVolume(state.volume);
    if (state.muted === true) target.mute();
    else if (state.muted === false) target.unMute();
  } catch (_) {}
}

function captureAudioPrefs() {
  if (!playerReady || !player) return;
  try {
    const volume = Number(player.getVolume());
    if (Number.isFinite(volume)) state.volume = volume;
    state.muted = !!player.isMuted();
    saveState();
  } catch (_) {}
}

function createPlayer() {
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

function loadVideoInto(target, videoId, startSeconds = 0) {
  try { target.stopVideo(); } catch (_) {}

  if (startSeconds > 0) {
    target.loadVideoById({ videoId, startSeconds });
  } else {
    target.loadVideoById(videoId);
  }

  try { target.setPlaybackRate(state.speed); } catch (_) {}
  applyAudioPrefs(target);
}

function playBridgeIndex(index) {
  if (!bridgePlayback || !bridgePlayback.ids.length) return false;

  let nextIndex = Number(index);
  if (!Number.isInteger(nextIndex)) return false;

  if (nextIndex < 0) {
    nextIndex = state.repeat === 'queue' ? bridgePlayback.ids.length - 1 : 0;
  }
  if (nextIndex >= bridgePlayback.ids.length) {
    if (state.repeat === 'queue') nextIndex = 0;
    else return false;
  }

  const id = bridgePlayback.ids[nextIndex];
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return false;

  bridgePlayback.index = nextIndex;
  bridgePlayback.transitioning = true;
  bridgePlayback.correctionCount = 0;
  state.bridgeIndex = nextIndex;

  saveState();
  renderHomeState();
  renderMixStatus();
  updateTransport();

  whenReady(() => loadVideoInto(player, id, 0));
  return true;
}

function next() {
  if (!bridgePlayback) return;
  if (!playBridgeIndex(bridgePlayback.index + 1)) {
    setMessage('End of captured Mix.', 'ok');
  }
}

function previous() {
  if (!bridgePlayback) return;
  playBridgeIndex(bridgePlayback.index - 1);
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.PLAYING) {
    els.toggle.classList.add('is-playing');
    els.toggle.setAttribute('aria-label', 'Pause');
    setTabPlaybackState('playing');
    setTimeout(updateVideoData, 250);
    return;
  }

  if (event.data === YT.PlayerState.PAUSED) {
    els.toggle.classList.remove('is-playing');
    els.toggle.setAttribute('aria-label', 'Play');
    setTabPlaybackState('paused');
    return;
  }

  if (event.data !== YT.PlayerState.ENDED) return;

  els.toggle.classList.remove('is-playing');
  els.toggle.setAttribute('aria-label', 'Play');
  captureAudioPrefs();

  if (state.repeat === 'one') {
    player.seekTo(0);
    player.playVideo();
    return;
  }

  if (!state.autoplay || !bridgePlayback) return;
  if (bridgePlayback.transitioning) return;

  let currentId = '';
  try {
    const data = player.getVideoData ? player.getVideoData() : null;
    currentId = data && data.video_id || '';
  } catch (_) {}

  const expectedId = bridgePlayback.ids[bridgePlayback.index] || '';
  if (currentId && expectedId && currentId !== expectedId) return;

  if (!playBridgeIndex(bridgePlayback.index + 1)) {
    setMessage('End of captured Mix.', 'ok');
  }
}

function updateVideoData() {
  if (!playerReady || !player) return;

  let data = {};
  try { data = player.getVideoData() || {}; } catch (_) {}

  const id = data.video_id || '';

  if (bridgePlayback && id) {
    const expectedId = bridgePlayback.ids[bridgePlayback.index] || '';

    if (expectedId && id === expectedId) {
      bridgePlayback.transitioning = false;
      bridgePlayback.correctionCount = 0;
    } else if (
      expectedId &&
      id !== expectedId &&
      (bridgePlayback.correctionCount || 0) < 2
    ) {
      bridgePlayback.transitioning = true;
      bridgePlayback.correctionCount = (bridgePlayback.correctionCount || 0) + 1;
      setMessage(
        'YouTube started a different video. Correcting to captured track ' +
        (bridgePlayback.index + 1) + '/' + bridgePlayback.ids.length + '.',
        'error'
      );
      player.loadVideoById(expectedId);
      return;
    }
  }

  if (data.title) els.nowTitle.textContent = data.title;

  els.nowMeta.textContent = bridgePlayback
    ? [data.author, id, 'captured Mix'].filter(Boolean).join(' · ')
    : [data.author, id].filter(Boolean).join(' · ');

  renderMixStatus();
  renderMixProgress();

  if (data.title) setTabTrack(data.title, data.author || '', 'playing');

  if (id && id !== lastObservedVideoId) {
    lastObservedVideoId = id;

    rememberLastVideo({
      id,
      title: data.title || '',
      channel: data.author || '',
      seconds: 0
    });

    recordVideoHistory(id, data.title || '', data.author || '');
  }

  updateTransport();
}

function handlePlayerError(event) {
  const code = event && event.data;

  if (bridgePlayback && playBridgeIndex(bridgePlayback.index + 1)) {
    setMessage('Skipped an unavailable captured video (YouTube error ' + code + ').', 'error');
    return;
  }

  setMessage(
    'YouTube player error ' + code + '. The video may be unavailable or blocked from embeds.',
    'error'
  );
}

els.playMixBtn.addEventListener('click', playLoadedMix);
els.resumeVideoBtn.addEventListener('click', resumeLastVideo);

els.prev.addEventListener('click', previous);
els.next.addEventListener('click', next);
els.toggle.addEventListener('click', () => whenReady(() => {
  const current = player.getPlayerState();
  if (current === YT.PlayerState.PLAYING) player.pauseVideo();
  else player.playVideo();
}));

els.autoplay.addEventListener('change', event => {
  state.autoplay = event.target.checked;
  saveState();
});

els.cinema.addEventListener('change', event => {
  state.cinema = event.target.checked;
  document.body.classList.toggle('cinema', state.cinema);
  saveState();
});

els.repeat.addEventListener('change', event => {
  state.repeat = event.target.value;
  updateTransport();
  saveState();
});

els.speed.addEventListener('change', event => {
  state.speed = Number(event.target.value);
  whenReady(() => {
    try { player.setPlaybackRate(state.speed); } catch (_) {}
  });
  saveState();
});

els.clearHistory.addEventListener('click', async () => {
  videoHistory = [];
  try { await CloudState.clearHistory(); } catch (_) {}
  renderVideoHistory();
  setMessage('Video history cleared.', 'ok');
});

document.addEventListener('keydown', event => {
  if (['INPUT','TEXTAREA','SELECT','BUTTON','SUMMARY'].includes(document.activeElement.tagName)) return;

  if (event.code === 'Space') {
    event.preventDefault();
    els.toggle.click();
  } else if (event.key.toLowerCase() === 'n') {
    next();
  } else if (event.key.toLowerCase() === 'p') {
    previous();
  } else if (event.key === 'ArrowLeft') {
    whenReady(() => player.seekTo(Math.max(0, player.getCurrentTime() - 5), true));
  } else if (event.key === 'ArrowRight') {
    whenReady(() => player.seekTo(player.getCurrentTime() + 5, true));
  }
});

async function bootstrap() {
  let importedNewMix = false;

  try {
    await CloudState.migrateLegacyBrowserData();
    await loadState();
    videoHistory = await loadVideoHistory();

    importedNewMix = importMixFromHash();

    syncSettings();
    renderHomeState();
    renderResumeVideo();
    renderVideoHistory();
    renderMixStatus();
    updateTransport();

    if (importedNewMix) {
      setTimeout(() => els.playMixBtn.focus(), 0);
    }
  } catch (error) {
    console.error(error);
    els.homePanel.setAttribute('aria-busy', 'false');
    els.loadingCard.querySelector('h2').textContent = 'Aero could not load';
    els.loadingCard.querySelector('p').textContent =
      'Cloudflare storage is not ready. Check the D1 binding and schema, then reload.';
    els.historyCard.setAttribute('aria-busy', 'false');
    els.historyCount.textContent = 'Unavailable';
    setMessage('Cloudflare storage could not be loaded.', 'error');
    renderMixStatus();
  }
}

bootstrap();

setInterval(captureAudioPrefs, 5000);
setInterval(capturePlaybackProgress, 15000);

window.addEventListener('pagehide', () => {
  captureAudioPrefs();
  capturePlaybackProgress(true);
});
