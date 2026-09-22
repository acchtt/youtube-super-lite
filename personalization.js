'use strict';

window.TakeoutPersonalization = (() => {
  let profile = null;
  let recent = [];

  async function save(value) {
    await CloudState.saveProfile(value);
    profile = value;
  }

  async function load() {
    if (profile) return profile;
    profile = await CloudState.loadProfile();
    return profile;
  }

  async function clear() {
    await CloudState.clearProfile();
    profile = null;
    recent = [];
  }

  function importZip(file, onProgress) {
    return new Promise((resolve, reject) => {
      const worker = new Worker('takeout-worker.js?v=0.9.0');
      worker.onmessage = async (event) => {
        const data = event.data || {};
        if (data.type === 'progress') {
          if (onProgress) onProgress(data.message);
          return;
        }
        if (data.type === 'done') {
          try {
            if (onProgress) onProgress('Saving compact profile to Cloudflare D1…');
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
  }

  function weightedPick(candidates, lastChannel) {
    if (!candidates.length) return null;
    const recentIds = new Set(recent.map(x => x.id));
    const recentChannelCounts = new Map();
    for (const entry of recent.slice(0, 8)) {
      const key = String(entry.channel || '').trim().toLowerCase();
      if (key) recentChannelCounts.set(key, (recentChannelCounts.get(key) || 0) + 1);
    }

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

    // Diversity guard: if a channel has already appeared twice in the last
    // eight Super Lite plays, avoid using that channel as the next seed when
    // there are enough alternatives.
    const variedPool = pool.filter(item => {
      const key = String(item.channel || '').trim().toLowerCase();
      return !key || (recentChannelCounts.get(key) || 0) < 2;
    });
    if (variedPool.length >= Math.min(40, Math.max(12, Math.floor(pool.length * 0.08)))) {
      pool = variedPool;
    }

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
      if (lastChannel && item.channel === lastChannel) score -= 0.9;

      const channelKey = String(item.channel || '').trim().toLowerCase();
      const recentChannelCount = channelKey ? (recentChannelCounts.get(channelKey) || 0) : 0;
      score -= recentChannelCount * 2.0;

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

  function getChannelAffinity(channelName) {
    if (!profile || !Array.isArray(profile.candidates)) return null;
    const target = String(channelName || '').trim().toLowerCase();
    if (!target) return null;

    let bestRecentRank = Infinity;
    let watchCount = 0;
    let subscribed = false;
    let matched = false;

    for (const item of profile.candidates) {
      if (String(item.channel || '').trim().toLowerCase() !== target) continue;
      matched = true;
      if (Number.isFinite(item.recentRank)) bestRecentRank = Math.min(bestRecentRank, item.recentRank);
      watchCount += Number(item.count) || 0;
      if (item.subscribed) subscribed = true;
    }

    if (!matched) return { known:false, recentRank:Infinity, watchCount:0, subscribed:false };
    return {
      known: true,
      recentRank: Number.isFinite(bestRecentRank) ? bestRecentRank : Infinity,
      watchCount,
      subscribed
    };
  }

  function hydrateRecent(items) {
    recent = Array.isArray(items) ? items.slice(0, 120).map(item => ({
      id: item.id,
      channel: item.channel || '',
      at: Number(item.at) || Date.now()
    })).filter(item => item.id) : [];
  }

  function get() { return profile; }

  return { load, clear, importZip, pickSeed, markPlayed, hydrateRecent, getChannelAffinity, get };
})();