'use strict';

window.TakeoutPersonalization = (() => {
  const DB_NAME = 'yt-super-lite-profile';
  const STORE = 'profile';
  const KEY = 'current';
  const RECENT_KEY = 'yt-super-lite-personalized-recent-v1';

  let profile = null;
  let recent = [];
  try {
    recent = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    if (!Array.isArray(recent)) recent = [];
  } catch (_) { recent = []; }

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function save(value) {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    profile = value;
  }

  async function load() {
    if (profile) return profile;
    const db = await openDb();
    profile = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return profile;
  }

  async function clear() {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    profile = null;
    recent = [];
    localStorage.removeItem(RECENT_KEY);
  }

  function importZip(file, onProgress) {
    return new Promise((resolve, reject) => {
      const worker = new Worker('takeout-worker.js');
      worker.onmessage = async (event) => {
        const data = event.data || {};
        if (data.type === 'progress') {
          if (onProgress) onProgress(data.message);
          return;
        }
        if (data.type === 'done') {
          try {
            await save(data.profile);
            worker.terminate();
            resolve(data.profile);
          } catch (err) {
            worker.terminate();
            reject(err);
          }
        } else if (data.type === 'error') {
          worker.terminate();
          reject(new Error(data.message || 'Takeout import failed'));
        }
      };
      worker.onerror = (event) => {
        worker.terminate();
        reject(new Error(event.message || 'Takeout worker failed'));
      };
      file.arrayBuffer().then(buffer => worker.postMessage({ buffer }, [buffer])).catch(reject);
    });
  }

  function markPlayed(videoId, channel) {
    if (!videoId) return;
    recent = recent.filter(x => x.id !== videoId);
    recent.unshift({ id: videoId, channel: channel || '', at: Date.now() });
    recent = recent.slice(0, 120);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  }

  function weightedPick(candidates, lastChannel) {
    if (!candidates.length) return null;
    const recentIds = new Set(recent.map(x => x.id));

    // Current taste should dominate. Takeout watch history is newest-first, so
    // lower recentRank means the user watched that video more recently.
    const r = Math.random();
    let horizon = r < 0.82 ? 1200 : (r < 0.97 ? 3500 : Infinity);
    let pool = horizon === Infinity
      ? candidates
      : candidates.filter(item => item.recentRank != null && item.recentRank < horizon);

    // Graceful fallback for small/new profiles.
    if (pool.length < 40 && horizon === 1200) {
      pool = candidates.filter(item => item.recentRank != null && item.recentRank < 3500);
    }
    if (pool.length < 20) pool = candidates;

    const sampleCount = Math.min(220, pool.length);
    let best = null;
    let bestScore = -Infinity;

    for (let i = 0; i < sampleCount; i++) {
      const item = pool[Math.floor(Math.random() * pool.length)];
      if (!item) continue;

      const rank = Number.isFinite(item.recentRank) ? item.recentRank : 100000;
      const recency = 6.2 * Math.exp(-rank / 520);

      // Keep historical affinity as a supporting signal, not the main one.
      let score = Math.min(4.2, Math.log1p(Math.max(0.01, item.score || 0))) * 0.72;
      score += recency;

      // Avoid immediate repeats from Super Lite while still allowing recent
      // interests/channels to remain dominant.
      if (recentIds.has(item.id)) score -= 7.5;
      if (lastChannel && item.channel === lastChannel) score -= 0.8;

      // These are useful but can be stale, so keep the bonuses deliberately mild.
      if (item.subscribed) score += 0.14;
      if (item.playlist) score += 0.18;

      // Small exploration noise keeps the radio from becoming deterministic.
      score += Math.random() * 1.15;

      if (score > bestScore) {
        best = item;
        bestScore = score;
      }
    }

    return best || pool[Math.floor(Math.random() * pool.length)];
  }

  function pickSeed(lastChannel) {
    if (!profile || !Array.isArray(profile.candidates) || !profile.candidates.length) return null;
    return weightedPick(profile.candidates, lastChannel || '');
  }

  function get() { return profile; }

  return { load, clear, importZip, pickSeed, markPlayed, get };
})();