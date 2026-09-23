'use strict';

function postToAero(type, payload) {
  window.postMessage({
    source: 'aero-mix-bridge',
    type,
    payload: payload || null
  }, window.location.origin);
}

async function sendLatest() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'AERO_GET_MIX' });
    if (response && response.payload) postToAero('AERO_MIX_SNAPSHOT', response.payload);
  } catch (_) {}
}

window.addEventListener('message', event => {
  if (event.source !== window || !event.data || typeof event.data !== 'object') return;
  if (event.data.source !== 'aero-web' || event.data.type !== 'AERO_BRIDGE_REQUEST') return;
  postToAero('AERO_BRIDGE_READY', { version: '0.1.0' });
  sendLatest();
});

chrome.runtime.onMessage.addListener(message => {
  if (!message || message.type !== 'AERO_MIX_SNAPSHOT' || !message.payload) return;
  postToAero('AERO_MIX_SNAPSHOT', message.payload);
});

postToAero('AERO_BRIDGE_READY', { version: '0.1.0' });
sendLatest();
