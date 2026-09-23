'use strict';

const STORAGE_KEY = 'latestAeroMix';

function postToAero(type, payload) {
  window.postMessage({
    source: 'aero-mix-bridge',
    type,
    payload: payload || null
  }, window.location.origin);
}

async function sendLatest() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    if (result && result[STORAGE_KEY]) {
      postToAero('AERO_MIX_SNAPSHOT', result[STORAGE_KEY]);
    }
  } catch (_) {}
}

window.addEventListener('message', event => {
  if (event.source !== window || !event.data || typeof event.data !== 'object') return;
  if (event.data.source !== 'aero-web' || event.data.type !== 'AERO_BRIDGE_REQUEST') return;
  postToAero('AERO_BRIDGE_READY', { version: '0.2.0' });
  sendLatest();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes[STORAGE_KEY] || !changes[STORAGE_KEY].newValue) return;
  postToAero('AERO_MIX_SNAPSHOT', changes[STORAGE_KEY].newValue);
});

postToAero('AERO_BRIDGE_READY', { version: '0.2.0' });
sendLatest();
