'use strict';

window.CloudState = (() => {
  let saveSettingsTimer = null;
  let pendingSettings = null;
  let lastVideoWriteAt = 0;
  let lastPlaylistWriteAt = 0;

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
      lastVideo: data.lastVideo || null,
      lastPlaylist: data.lastPlaylist || null
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

  function saveLastPlaylist(lastPlaylist, force = false) {
    const now = Date.now();
    if (!force && now - lastPlaylistWriteAt < 3000) return;
    lastPlaylistWriteAt = now;
    return request('/api/state', {
      method: 'PATCH',
      keepalive: !!force,
      body: JSON.stringify({ lastPlaylist })
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

  async function loadProfile() {
    const data = await request('/api/profile');
    return data.profile || null;
  }

  function saveProfile(profile) {
    return request('/api/profile', {
      method: 'PUT',
      body: JSON.stringify({ profile })
    });
  }

  function clearProfile() {
    return request('/api/profile', { method:'DELETE' });
  }

  async function readLegacyIndexedDbProfile() {
    if (!('indexedDB' in window)) return null;
    if (indexedDB.databases) {
      try {
        const dbs = await indexedDB.databases();
        if (!dbs.some(db => db && db.name === 'yt-super-lite-profile')) return null;
      } catch (_) {}
    }

    return new Promise(resolve => {
      const req = indexedDB.open('yt-super-lite-profile', 1);
      let created = false;
      req.onupgradeneeded = () => { created = true; };
      req.onerror = () => resolve(null);
      req.onsuccess = () => {
        const db = req.result;
        if (created || !db.objectStoreNames.contains('profile')) {
          db.close();
          resolve(null);
          return;
        }
        const tx = db.transaction('profile', 'readonly');
        const get = tx.objectStore('profile').get('current');
        get.onsuccess = () => {
          const value = get.result || null;
          db.close();
          resolve(value);
        };
        get.onerror = () => {
          db.close();
          resolve(null);
        };
      };
    });
  }

  async function migrateLegacyBrowserData() {
    const legacyKeys = [
      'yt-super-lite-v2',
      'yt-super-lite-video-history-v1',
      'yt-super-lite-last-video-v1',
      'yt-super-lite-last-playlist-v1',
      'yt-super-lite-personalized-recent-v1'
    ];

    const present = legacyKeys.some(key => localStorage.getItem(key) != null);
    let legacyProfile = null;
    try { legacyProfile = await readLegacyIndexedDbProfile(); } catch (_) {}

    if (!present && !legacyProfile) return false;

    try {
      const settings = JSON.parse(localStorage.getItem('yt-super-lite-v2') || 'null');
      const history = JSON.parse(localStorage.getItem('yt-super-lite-video-history-v1') || 'null');
      const lastVideo = JSON.parse(localStorage.getItem('yt-super-lite-last-video-v1') || 'null');
      const lastPlaylist = JSON.parse(localStorage.getItem('yt-super-lite-last-playlist-v1') || 'null');

      const writes = [];
      if (settings || lastVideo || lastPlaylist) {
        writes.push(request('/api/state', {
          method: 'PATCH',
          body: JSON.stringify({
            ...(settings ? { settings } : {}),
            ...(lastVideo ? { lastVideo } : {}),
            ...(lastPlaylist ? { lastPlaylist } : {})
          })
        }));
      }
      if (Array.isArray(history) && history.length) {
        writes.push(replaceHistory(history.slice(0, 200)));
      }
      if (legacyProfile) writes.push(saveProfile(legacyProfile));

      await Promise.all(writes);

      legacyKeys.forEach(key => localStorage.removeItem(key));
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
    loadState, saveSettings, saveLastVideo, saveLastPlaylist,
    loadHistory, addHistory, replaceHistory, clearHistory,
    loadProfile, saveProfile, clearProfile, migrateLegacyBrowserData
  };
})();
