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
    const windowSize = Math.min(candidates.length, Math.random() < 0.78 ? 1800 : 6500);
    const sampleCount = Math.min(180, windowSize);
    let best = null;
    let bestScore = -Infinity;

    for (let i = 0; i < sampleCount; i++) {
      const item = candidates[Math.floor(Math.random() * windowSize)];
      if (!item) continue;
      let score = Math.log1p(Math.max(0.01, item.score || 0));
      if (recentIds.has(item.id)) score -= 5;
      if (item.recentRank != null && item.recentRank < 120) score -= 1.6;
      else if (item.recentRank != null && item.recentRank < 500) score -= 0.7;
      if (lastChannel && item.channel === lastChannel) score -= 1.0;
      if (item.subscribed) score += 0.32;
      if (item.playlist) score += 0.4;
      score += Math.random() * 1.35;
      if (score > bestScore) {
        best = item;
        bestScore = score;
      }
    }
    return best || candidates[Math.floor(Math.random() * windowSize)];
  }

  function pickSeed(lastChannel) {
    if (!profile || !Array.isArray(profile.candidates) || !profile.candidates.length) return null;
    return weightedPick(profile.candidates, lastChannel || '');
  }

  function get() { return profile; }

  return { load, clear, importZip, pickSeed, markPlayed, get };
})();