'use strict';

const STORAGE_KEY = 'latestAeroMix';

function validSnapshot(value) {
  return !!(
    value &&
    typeof value === 'object' &&
    typeof value.listId === 'string' &&
    Array.isArray(value.items) &&
    value.items.length > 1
  );
}

async function broadcast(snapshot) {
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({ url: 'https://aero-x-ive.pages.dev/*' });
  } catch (_) {
    return;
  }

  for (const tab of tabs) {
    if (!tab.id) continue;
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'AERO_MIX_SNAPSHOT',
        payload: snapshot
      });
    } catch (_) {}
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') return;

  if (message.type === 'AERO_MIX_SNAPSHOT' && validSnapshot(message.payload)) {
    const snapshot = message.payload;
    chrome.storage.local.set({ [STORAGE_KEY]: snapshot }).then(() => broadcast(snapshot));
    sendResponse({ ok: true });
    return;
  }

  if (message.type === 'AERO_GET_MIX') {
    chrome.storage.local.get(STORAGE_KEY).then(result => {
      const snapshot = result[STORAGE_KEY];
      sendResponse({ ok: true, payload: validSnapshot(snapshot) ? snapshot : null });
    }).catch(() => sendResponse({ ok: false, payload: null }));
    return true;
  }
});
