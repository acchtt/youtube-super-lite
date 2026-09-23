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
let mixBridge = { snapshot:null, receivedAt:0 };
let bridgePlayback = null;

const $ = id => document.getElementById(id);
const els = {
  appShell: $('appShell'),
  message: $('message'),
  nowTitle: $('nowTitle'),
  nowMeta: $('nowMeta'),
  prev: $('prevBtn'),
  toggle: $('toggleBtn'),
  next: $('nextBtn'),
  autoplay: $('autoplayToggle'),
  cinema: $('cinemaToggle'),
  repeat: $('repeatSelect'),
  speed: $('speedSelect'),
  startupGate: $('startupGate'),
  startupSkip: $('startupSkip'),
  mediaLayout: $('mediaLayout'),
  historyList: $('historyList'),
  historyCount: $('historyCount'),
  emptyHistory: $('emptyHistory'),
  clearHistory: $('clearHistoryBtn'),
  resumeVideoBox: $('resumeVideoBox'),
  resumeVideoTitle: $('resumeVideoTitle'),
  resumeVideoMeta: $('resumeVideoMeta'),
  resumeVideoBtn: $('resumeVideoBtn'),
  loadedMixBox: $('loadedMixBox'),
  loadedMixTitle: $('loadedMixTitle'),
  loadedMixMeta: $('loadedMixMeta'),
  loadedMixBtn: $('loadedMixBtn'),
  mixBridgeStatus: $('mixBridgeStatus')
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
  if (resetIndex || state.bridgeIndex >= snapshot.ids.length) state.bridgeIndex = 0;

  saveState();
  renderMixBridgeStatus();
  renderLoadedMixOption();

  setMessage('Loaded ' + snapshot.ids.length + ' captured Mix tracks in exact order.', 'ok');
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

function renderMixBridgeStatus() {
  if (!els.mixBridgeStatus) return;
  const count = mixBridge.snapshot ? mixBridge.snapshot.ids.length : 0;
  els.mixBridgeStatus.textContent = count ? ('Mix loaded · ' + count) : 'No Mix loaded';
  els.mixBridgeStatus.title = count
    ? 'Captured Mix is stored with Aero state.'
    : 'Capture a YouTube Mix with the Aero Mix Bridge extension.';
}

function renderLoadedMixOption() {
  if (!els.loadedMixBox) return;
  const snapshot = mixBridge.snapshot;
  const available = !!(snapshot && snapshot.ids.length > 1);
  els.loadedMixBox.classList.toggle('hidden', !available);
  if (!available) return;

  const canResume = state.bridgeIndex > 0 && state.bridgeIndex < snapshot.ids.length;
  els.loadedMixTitle.textContent = 'Captured YouTube Mix';
  els.loadedMixMeta.textContent = [
    snapshot.ids.length + ' songs',
    'exact order',
    canResume ? ('track ' + (state.bridgeIndex + 1)) : ''
  ].filter(Boolean).join(' · ');
  els.loadedMixBtn.textContent = canResume ? 'Resume Mix' : 'Play loaded songs';
}

function closeStartupGate() {
  if (els.startupGate) els.startupGate.classList.add('hidden');
  document.body.classList.remove('startup-locked');
  if (els.appShell) els.appShell.removeAttribute('inert');
}

function showMediaLayout() {
  if (els.mediaLayout) els.mediaLayout.classList.remove('hidden');
}

function playLoadedMix() {
  const snapshot = mixBridge.snapshot;
  if (!snapshot || snapshot.ids.length < 2) {
    setMessage('Capture a Mix with the Aero Mix Bridge extension first.', 'error');
    return;
  }

  const startIndex = Math.max(0, Math.min(state.bridgeIndex, snapshot.ids.length - 1));

  closeStartupGate();
  showMediaLayout();
  bridgePlayback = {
    listId: snapshot.listId,
    seedId: snapshot.seedId || snapshot.ids[0],
    ids: snapshot.ids.slice(),
    index: startIndex,
    transitioning: true,
    correctionCount: 0
  };

  playBridgeIndex(startIndex);
  setMessage(
    (startIndex > 0 ? 'Resuming' : 'Playing') + ' the captured Mix in exact order.',
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
    document.title = 'Aero × IVE · v0.13.0';
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
  closeStartupGate();
  showMediaLayout();
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

    const play = document.createElement('button');
    play.type = 'button';
    play.className = 'history-play';
    play.setAttribute('aria-label', 'Play ' + (item.title || 'video'));
    play.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
    play.addEventListener('click', () => {
      bridgePlayback = null;
      closeStartupGate();
      showMediaLayout();
      updateTransport();
      whenReady(() => loadVideoInto(player, item.id, 0));
      setMessage('Playing from video history.', 'ok');
      window.scrollTo({ top:0, behavior:'smooth' });
    });

    copy.append(title, meta);
    li.append(copy, play);
    els.historyList.appendChild(li);
  });
}

function renderNowPlayingPosition() {
  if (!bridgePlayback) return;
  els.nowMeta.textContent =
    'Captured ' + (bridgePlayback.index + 1) + '/' + bridgePlayback.ids.length + ' · exact order';
}

function updateTransport() {
  const hasBridge = !!(bridgePlayback && bridgePlayback.ids.length);
  if (!hasBridge) {
    els.prev.disabled = true;
    els.next.disabled = true;
    return;
  }

  els.prev.disabled = bridgePlayback.index <= 0 && state.repeat !== 'queue';
  els.next.disabled = bridgePlayback.index >= bridgePlayback.ids.length - 1 && state.repeat !== 'queue';
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
  renderLoadedMixOption();
  renderNowPlayingPosition();
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
    ? [
        data.author,
        id,
        'Captured ' + (bridgePlayback.index + 1) + '/' + bridgePlayback.ids.length
      ].filter(Boolean).join(' · ')
    : [data.author, id].filter(Boolean).join(' · ');

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

  setMessage('YouTube player error ' + code + '. The video may be unavailable or blocked from embeds.', 'error');
}

if (els.startupSkip) {
  els.startupSkip.addEventListener('click', () => {
    closeStartupGate();
    showMediaLayout();
  });
}

if (els.loadedMixBtn) els.loadedMixBtn.addEventListener('click', playLoadedMix);
if (els.resumeVideoBtn) els.resumeVideoBtn.addEventListener('click', resumeLastVideo);

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

if (els.clearHistory) {
  els.clearHistory.addEventListener('click', async () => {
    videoHistory = [];
    try { await CloudState.clearHistory(); } catch (_) {}
    renderVideoHistory();
    setMessage('Video history cleared.', 'ok');
  });
}

document.addEventListener('keydown', event => {
  if (['INPUT','TEXTAREA','SELECT','BUTTON'].includes(document.activeElement.tagName)) return;

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
  try {
    await CloudState.migrateLegacyBrowserData();
    await loadState();
    videoHistory = await loadVideoHistory();

    importMixFromHash();
    syncSettings();
    renderMixBridgeStatus();
    renderLoadedMixOption();
    renderResumeVideo();
    renderVideoHistory();
    updateTransport();

    const preferred = !els.loadedMixBox.classList.contains('hidden')
      ? els.loadedMixBtn
      : (!els.resumeVideoBox.classList.contains('hidden') ? els.resumeVideoBtn : els.startupSkip);
    if (preferred) preferred.focus();
  } catch (error) {
    console.error(error);
    setMessage('Cloudflare storage is not ready. Check the D1 binding and schema.', 'error');
  }
}

bootstrap();

setInterval(captureAudioPrefs, 5000);
setInterval(capturePlaybackProgress, 15000);

window.addEventListener('pagehide', () => {
  captureAudioPrefs();
  capturePlaybackProgress(true);
});
