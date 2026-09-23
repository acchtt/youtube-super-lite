'use strict';

window.CloudState = (() => {
  let saveSettingsTimer = null;
  let pendingSettings = null;
  let lastVideoWriteAt = 0;

  async function request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body != null && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(path, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
      headers
    });

    if (!response.ok) {
      let message = response.status + ' ' + response.statusText;
      try {
        const data = await response.json();
        if (data && data.error) message = data.error;
      } catch (_) {}
      throw new Error(message);
    }

    return response.json();
  }

  async function loadState() {
    const data = await request('/api/state');
    return {
      settings: data.settings || {},
      lastVideo: data.lastVideo || null
    };
  }

  function saveSettings(settings) {
    pendingSettings = settings;
    clearTimeout(saveSettingsTimer);
    saveSettingsTimer = setTimeout(() => {
      const value = pendingSettings;
      pendingSettings = null;
      request('/api/state', {
        method: 'PATCH',
        body: JSON.stringify({ settings:value })
      }).catch(() => {});
    }, 500);
  }

  function saveLastVideo(lastVideo, force = false) {
    const now = Date.now();
    if (!force && now - lastVideoWriteAt < 8000) return;
    lastVideoWriteAt = now;

    return request('/api/state', {
      method: 'PATCH',
      keepalive: !!force,
      body: JSON.stringify({ lastVideo })
    }).catch(() => {});
  }

  async function loadHistory() {
    const data = await request('/api/history');
    return Array.isArray(data.items) ? data.items : [];
  }

  function addHistory(item) {
    return request('/api/history', {
      method: 'POST',
      body: JSON.stringify(item)
    }).catch(() => {});
  }

  function replaceHistory(items) {
    return request('/api/history', {
      method: 'PUT',
      body: JSON.stringify({ items })
    });
  }

  function clearHistory() {
    return request('/api/history', { method:'DELETE' });
  }

  async function migrateLegacyBrowserData() {
    const cleanupKeys = [
      'yt-super-lite-v2',
      'yt-super-lite-video-history-v1',
      'yt-super-lite-last-video-v1',
      'yt-super-lite-last-playlist-v1',
      'yt-super-lite-personalized-recent-v1'
    ];

    const present = cleanupKeys.some(key => localStorage.getItem(key) != null);
    if (!present) return false;

    try {
      const settings = JSON.parse(localStorage.getItem('yt-super-lite-v2') || 'null');
      const history = JSON.parse(localStorage.getItem('yt-super-lite-video-history-v1') || 'null');
      const lastVideo = JSON.parse(localStorage.getItem('yt-super-lite-last-video-v1') || 'null');

      const writes = [];
      if (settings || lastVideo) {
        writes.push(request('/api/state', {
          method: 'PATCH',
          body: JSON.stringify({
            ...(settings ? { settings } : {}),
            ...(lastVideo ? { lastVideo } : {})
          })
        }));
      }
      if (Array.isArray(history) && history.length) {
        writes.push(replaceHistory(history.slice(0, 200)));
      }

      await Promise.all(writes);
      cleanupKeys.forEach(key => localStorage.removeItem(key));

      if ('indexedDB' in window) {
        try { indexedDB.deleteDatabase('yt-super-lite-profile'); } catch (_) {}
      }

      return true;
    } catch (error) {
      console.warn('Legacy browser-data migration failed; old data was left untouched.', error);
      return false;
    }
  }

  return {
    loadState,
    saveSettings,
    saveLastVideo,
    loadHistory,
    addHistory,
    replaceHistory,
    clearHistory,
    migrateLegacyBrowserData
  };
})();
