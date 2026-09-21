'use strict';

const DEFAULT_TRACKERS = [
  {
    repo: 'acchtt/youtube-super-lite',
    workflow: 'pages.yml',
    label: 'YouTube Super Lite',
    site: 'https://acchtt.github.io/youtube-super-lite/'
  },
  {
    repo: 'acchtt/football-v2',
    workflow: 'pages.yml',
    label: 'Football V2',
    site: 'https://acchtt.github.io/football-v2/'
  },
  {
    repo: 'acchtt/SlipTrace',
    workflow: 'pages.yml',
    label: 'SlipTrace',
    site: 'https://acchtt.github.io/SlipTrace/'
  }
];

const STORAGE_KEY = 'deployment-tracker-custom-v1';
const TOKEN_KEY = 'deployment-tracker-token-v1';
const PUBLIC_INTERVAL = 240000;
const TOKEN_INTERVAL = 15000;

const $ = id => document.getElementById(id);
const els = {
  cards: $('cards'), template: $('cardTemplate'), refresh: $('refreshBtn'),
  auto: $('autoRefresh'), lastUpdated: $('lastUpdated'), rate: $('rateInfo'),
  liveDot: $('liveDot'), liveLabel: $('liveLabel'), nextRefresh: $('nextRefresh'),
  token: $('tokenInput'), saveToken: $('saveTokenBtn'), clearToken: $('clearTokenBtn'),
  trackedList: $('trackedList'), addForm: $('addForm'), repoInput: $('repoInput'),
  workflowInput: $('workflowInput'), labelInput: $('labelInput'), siteInput: $('siteInput')
};

let customTrackers = loadCustom();
let token = sessionStorage.getItem(TOKEN_KEY) || '';
let timer = null;
let countdown = null;
let nextAt = 0;
let refreshing = false;
let controller = null;

function loadCustom() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch (_) { return []; }
}

function saveCustom() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customTrackers));
}

function trackers() {
  return [...DEFAULT_TRACKERS, ...customTrackers];
}

function keyOf(t) {
  return t.repo.toLowerCase() + '|' + t.workflow.toLowerCase();
}

function escapeText(value) {
  return String(value == null ? '' : value);
}

function statusInfo(run) {
  if (!run) return { state:'failure', pill:'NO RUN', title:'No workflow run found', detail:'Check workflow filename or GitHub Actions.' };
  if (run.status !== 'completed') {
    const queued = ['queued','requested','waiting','pending'].includes(run.status);
    return {
      state:'running',
      pill: queued ? 'QUEUED' : 'DEPLOYING',
      title: queued ? 'Waiting to start' : 'Deployment in progress',
      detail: run.name || 'GitHub Actions'
    };
  }
  switch (run.conclusion) {
    case 'success': return { state:'success', pill:'LIVE', title:'Deployment successful', detail:'Latest tracked workflow finished successfully.' };
    case 'failure': return { state:'failure', pill:'FAILED', title:'Deployment failed', detail:'Open the workflow run to inspect the failure.' };
    case 'timed_out': return { state:'failure', pill:'TIMED OUT', title:'Deployment timed out', detail:'The workflow exceeded its allowed runtime.' };
    case 'cancelled': return { state:'cancelled', pill:'CANCELLED', title:'Deployment cancelled', detail:'The latest workflow run was cancelled.' };
    case 'action_required': return { state:'failure', pill:'ACTION NEEDED', title:'Action required', detail:'GitHub is waiting for manual action.' };
    case 'skipped': return { state:'cancelled', pill:'SKIPPED', title:'Deployment skipped', detail:'The latest workflow run was skipped.' };
    default: return { state:'cancelled', pill:(run.conclusion || 'DONE').toUpperCase(), title:'Workflow completed', detail:'Conclusion: ' + (run.conclusion || 'unknown') };
  }
}

function relativeTime(value) {
  if (!value) return '—';
  const ms = Date.now() - new Date(value).getTime();
  const abs = Math.abs(ms);
  if (abs < 60000) return 'just now';
  if (abs < 3600000) return Math.floor(abs / 60000) + 'm ago';
  if (abs < 86400000) return Math.floor(abs / 3600000) + 'h ago';
  return Math.floor(abs / 86400000) + 'd ago';
}

function duration(run) {
  if (!run || !run.run_started_at) return '—';
  const start = new Date(run.run_started_at).getTime();
  const end = run.status === 'completed' && run.updated_at ? new Date(run.updated_at).getTime() : Date.now();
  const sec = Math.max(0, Math.floor((end - start) / 1000));
  if (sec < 60) return sec + 's';
  const min = Math.floor(sec / 60);
  if (min < 60) return min + 'm ' + (sec % 60) + 's';
  return Math.floor(min / 60) + 'h ' + (min % 60) + 'm';
}

function historyState(run) {
  if (!run) return 'cancelled';
  if (run.status !== 'completed') return 'running';
  return run.conclusion === 'success' ? 'success' :
    ['failure','timed_out','action_required'].includes(run.conclusion) ? 'failure' : 'cancelled';
}

function makeCard(tracker) {
  const node = els.template.content.firstElementChild.cloneNode(true);
  node.dataset.key = keyOf(tracker);
  node.querySelector('.repo-name').textContent = tracker.label || tracker.repo.split('/')[1];
  node.querySelector('.repo-name').href = 'https://github.com/' + tracker.repo;
  node.querySelector('.workflow-name').textContent = tracker.repo + ' · ' + tracker.workflow;
  const runLink = node.querySelector('.run-link');
  runLink.href = 'https://github.com/' + tracker.repo + '/actions/workflows/' + encodeURIComponent(tracker.workflow);
  const site = node.querySelector('.site-link');
  if (tracker.site) site.href = tracker.site;
  else site.classList.add('hidden');
  return node;
}

function renderCards() {
  els.cards.textContent = '';
  trackers().forEach(t => els.cards.appendChild(makeCard(t)));
  renderTrackedList();
}

function renderTrackedList() {
  els.trackedList.textContent = '';
  trackers().forEach((t, i) => {
    const chip = document.createElement('span');
    chip.className = 'tracked-chip';
    const name = document.createElement('span');
    name.textContent = (t.label || t.repo) + ' · ' + t.workflow;
    chip.appendChild(name);
    if (i >= DEFAULT_TRACKERS.length) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.title = 'Remove';
      remove.textContent = '✕';
      remove.addEventListener('click', () => {
        customTrackers.splice(i - DEFAULT_TRACKERS.length, 1);
        saveCustom();
        renderCards();
        refreshAll();
      });
      chip.appendChild(remove);
    }
    els.trackedList.appendChild(chip);
  });
}

async function apiFetch(url, signal) {
  const headers = { Accept:'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const response = await fetch(url, { headers, signal });
  const remaining = response.headers.get('x-ratelimit-remaining');
  const limit = response.headers.get('x-ratelimit-limit');
  if (remaining != null && limit != null) els.rate.textContent = 'API ' + remaining + '/' + limit + ' remaining';
  if (!response.ok) {
    let message = response.status + ' ' + response.statusText;
    try {
      const data = await response.json();
      if (data.message) message = data.message;
    } catch (_) {}
    throw new Error(message);
  }
  return response.json();
}

async function loadTracker(tracker, signal) {
  const workflow = encodeURIComponent(tracker.workflow);
  const url = 'https://api.github.com/repos/' + tracker.repo + '/actions/workflows/' + workflow + '/runs?per_page=5';
  const data = await apiFetch(url, signal);
  return data.workflow_runs || [];
}

function applyCard(tracker, runs) {
  const card = els.cards.querySelector('[data-key="' + CSS.escape(keyOf(tracker)) + '"]');
  if (!card) return;
  const run = runs[0] || null;
  const info = statusInfo(run);
  card.dataset.state = info.state;

  const dot = card.querySelector('.status-dot');
  dot.className = 'status-dot ' + info.state;
  card.querySelector('.status-pill').textContent = info.pill;
  card.querySelector('.status-title').textContent = info.title;
  card.querySelector('.status-detail').textContent = info.detail;
  card.querySelector('.branch').textContent = run ? run.head_branch || '—' : '—';

  const commit = card.querySelector('.commit');
  if (run && run.head_sha) {
    commit.textContent = run.head_sha.slice(0, 7);
    commit.href = 'https://github.com/' + tracker.repo + '/commit/' + run.head_sha;
  } else {
    commit.textContent = '—';
    commit.removeAttribute('href');
  }

  card.querySelector('.started').textContent = run ? relativeTime(run.run_started_at || run.created_at) : '—';
  card.querySelector('.duration').textContent = run ? duration(run) : '—';
  card.querySelector('.commit-message').textContent =
    run && run.head_commit && run.head_commit.message ? run.head_commit.message.split('\n')[0] : 'No commit message available';

  const runLink = card.querySelector('.run-link');
  if (run && run.html_url) runLink.href = run.html_url;

  const history = card.querySelector('.history');
  history.textContent = '';
  runs.slice(0, 5).forEach(r => {
    const el = document.createElement('i');
    el.className = historyState(r);
    el.title = (r.conclusion || r.status || 'unknown') + ' · ' + relativeTime(r.run_started_at || r.created_at);
    history.appendChild(el);
  });
}

function applyError(tracker, error) {
  const card = els.cards.querySelector('[data-key="' + CSS.escape(keyOf(tracker)) + '"]');
  if (!card) return;
  card.dataset.state = 'failure';
  card.querySelector('.status-dot').className = 'status-dot failure';
  card.querySelector('.status-pill').textContent = 'ERROR';
  card.querySelector('.status-title').textContent = 'Could not read deployment';
  card.querySelector('.status-detail').textContent = error.message || String(error);
}

async function refreshAll() {
  if (refreshing) return;
  refreshing = true;
  els.refresh.disabled = true;
  els.liveDot.className = 'live-dot busy';
  els.liveLabel.textContent = 'Refreshing';
  if (controller) controller.abort();
  controller = new AbortController();

  try {
    const list = trackers();
    const results = await Promise.allSettled(list.map(t => loadTracker(t, controller.signal)));
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') applyCard(list[i], result.value);
      else if (result.reason && result.reason.name !== 'AbortError') applyError(list[i], result.reason);
    });
    els.lastUpdated.textContent = 'Updated ' + new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});
    els.liveDot.className = 'live-dot on';
    els.liveLabel.textContent = token ? 'Real-time mode' : 'Public mode';
  } finally {
    refreshing = false;
    els.refresh.disabled = false;
    schedule();
  }
}

function intervalMs() {
  return token ? TOKEN_INTERVAL : PUBLIC_INTERVAL;
}

function schedule() {
  clearTimeout(timer);
  clearInterval(countdown);
  if (!els.auto.checked || document.hidden) {
    els.nextRefresh.textContent = document.hidden ? 'Paused while hidden' : 'Auto refresh off';
    return;
  }
  const ms = intervalMs();
  nextAt = Date.now() + ms;
  timer = setTimeout(refreshAll, ms);
  updateCountdown();
  countdown = setInterval(updateCountdown, 1000);
}

function updateCountdown() {
  const sec = Math.max(0, Math.ceil((nextAt - Date.now()) / 1000));
  if (sec >= 60) els.nextRefresh.textContent = 'Next update in ' + Math.ceil(sec / 60) + 'm';
  else els.nextRefresh.textContent = 'Next update in ' + sec + 's';
}

els.refresh.addEventListener('click', refreshAll);
els.auto.addEventListener('change', schedule);

els.saveToken.addEventListener('click', () => {
  const value = els.token.value.trim();
  if (!value) return;
  token = value;
  sessionStorage.setItem(TOKEN_KEY, token);
  els.token.value = '';
  els.liveLabel.textContent = 'Real-time mode';
  refreshAll();
});

els.clearToken.addEventListener('click', () => {
  token = '';
  sessionStorage.removeItem(TOKEN_KEY);
  els.token.value = '';
  els.liveLabel.textContent = 'Public mode';
  refreshAll();
});

els.addForm.addEventListener('submit', event => {
  event.preventDefault();
  const repo = els.repoInput.value.trim();
  const workflow = els.workflowInput.value.trim();
  if (!/^[^/\s]+\/[^/\s]+$/.test(repo) || !workflow) return;

  const tracker = {
    repo,
    workflow,
    label: els.labelInput.value.trim() || repo.split('/')[1],
    site: els.siteInput.value.trim()
  };

  if (trackers().some(t => keyOf(t) === keyOf(tracker))) return;
  customTrackers.push(tracker);
  saveCustom();
  els.addForm.reset();
  renderCards();
  refreshAll();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) schedule();
  else refreshAll();
});

renderCards();
if (token) {
  els.liveLabel.textContent = 'Real-time mode';
}
refreshAll();
