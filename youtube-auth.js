'use strict';

(() => {
  const CONFIG_URL = '/api/oauth-config';
  const CHANNEL_URL =
    'https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&mine=true';
  const GIS_URL = 'https://accounts.google.com/gsi/client';
  const EVER_CONNECTED_KEY = 'aero_youtube_oauth_ever_connected';

  const authState = {
    config: null,
    tokenClient: null,
    accessToken: '',
    expiresAt: 0,
    expiryTimer: null,
    channel: null,
    initialized: false
  };

  const els = {};

  function cacheElements() {
    els.root = document.getElementById('youtubeAuth');
    els.connect = document.getElementById('youtubeConnectBtn');
    els.account = document.getElementById('youtubeAccount');
    els.avatar = document.getElementById('youtubeAvatar');
    els.channelName = document.getElementById('youtubeChannelName');
    els.meta = document.getElementById('youtubeAuthMeta');
    els.disconnect = document.getElementById('youtubeDisconnectBtn');
    els.note = document.getElementById('youtubeAuthNote');
  }

  function setState(name, note) {
    if (!els.root) return;
    els.root.dataset.state = name;
    if (typeof note === 'string') els.note.textContent = note;
  }

  function renderDisconnected(note) {
    if (!els.root) return;
    els.account.classList.add('hidden');
    els.connect.classList.remove('hidden');
    els.connect.disabled = !authState.config || !authState.config.enabled;
    els.connect.textContent = 'Connect YouTube';
    setState(authState.config && authState.config.enabled ? 'ready' : 'setup', note);
  }

  function renderConnected() {
    if (!els.root) return;

    const channel = authState.channel;
    const snippet = channel && channel.snippet || {};
    const thumbnail =
      snippet.thumbnails &&
      (snippet.thumbnails.default || snippet.thumbnails.medium || snippet.thumbnails.high);

    els.connect.classList.add('hidden');
    els.account.classList.remove('hidden');
    els.channelName.textContent = snippet.title || 'YouTube connected';
    els.meta.textContent = 'OAuth · YouTube Data API';

    if (thumbnail && thumbnail.url) {
      els.avatar.src = thumbnail.url;
      els.avatar.alt = snippet.title ? (snippet.title + ' channel avatar') : 'YouTube channel avatar';
      els.avatar.classList.remove('hidden');
    } else {
      els.avatar.removeAttribute('src');
      els.avatar.alt = '';
      els.avatar.classList.add('hidden');
    }

    setState(
      'connected',
      'Connected for API access in this tab. Player session is unchanged — play a fresh Aero track, then check YouTube History.'
    );
  }

  function clearToken(reason) {
    authState.accessToken = '';
    authState.expiresAt = 0;
    authState.channel = null;

    if (authState.expiryTimer) clearTimeout(authState.expiryTimer);
    authState.expiryTimer = null;

    renderDisconnected(reason || 'YouTube OAuth disconnected.');
    dispatchAuthEvent(false);
  }

  function dispatchAuthEvent(connected) {
    const channel = authState.channel;

    window.dispatchEvent(new CustomEvent('aero:youtube-auth', {
      detail: {
        connected,
        channel: channel ? {
          id: channel.id || '',
          title: channel.snippet && channel.snippet.title || '',
          likesPlaylistId:
            channel.contentDetails &&
            channel.contentDetails.relatedPlaylists &&
            channel.contentDetails.relatedPlaylists.likes || ''
        } : null
      }
    }));
  }

  function loadGis() {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-aero-gis]');
      if (existing) {
        existing.addEventListener('load', resolve, { once:true });
        existing.addEventListener('error', () => reject(new Error('Google Identity Services failed to load.')), { once:true });
        return;
      }

      const script = document.createElement('script');
      script.src = GIS_URL;
      script.async = true;
      script.defer = true;
      script.dataset.aeroGis = '1';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Google Identity Services failed to load.'));
      document.head.appendChild(script);
    });
  }

  async function loadConfig() {
    const response = await fetch(CONFIG_URL, {
      credentials: 'same-origin',
      cache: 'no-store'
    });

    if (!response.ok) throw new Error('OAuth configuration could not be loaded.');

    const config = await response.json();

    return {
      enabled: Boolean(config && config.enabled && config.clientId),
      clientId: String(config && config.clientId || ''),
      scope: String(
        config && config.scope ||
        'https://www.googleapis.com/auth/youtube.readonly'
      )
    };
  }

  async function fetchChannel(accessToken) {
    const response = await fetch(CHANNEL_URL, {
      headers: {
        Authorization: 'Bearer ' + accessToken
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      let message = 'YouTube Data API request failed.';
      try {
        const payload = await response.json();
        message =
          payload &&
          payload.error &&
          payload.error.message ||
          message;
      } catch (_) {}
      throw new Error(message);
    }

    const payload = await response.json();
    const channel = payload && Array.isArray(payload.items) ? payload.items[0] : null;

    if (!channel) {
      throw new Error('OAuth succeeded, but this Google account has no YouTube channel available to the API.');
    }

    return channel;
  }

  function armExpiryTimer(expiresInSeconds) {
    if (authState.expiryTimer) clearTimeout(authState.expiryTimer);

    const seconds = Math.max(60, Number(expiresInSeconds) || 3600);
    authState.expiresAt = Date.now() + (seconds * 1000);

    authState.expiryTimer = setTimeout(() => {
      clearToken('YouTube OAuth expired. Click Connect YouTube to authorize again.');
    }, Math.max(1000, (seconds * 1000) - 5000));
  }

  async function handleTokenResponse(response) {
    if (!response || response.error) {
      setState(
        'error',
        'YouTube OAuth was not completed' +
          (response && response.error ? ': ' + response.error : '.')
      );
      els.connect.disabled = false;
      return;
    }

    const token = String(response.access_token || '');
    if (!token) {
      setState('error', 'Google returned no access token.');
      els.connect.disabled = false;
      return;
    }

    authState.accessToken = token;
    armExpiryTimer(response.expires_in);

    try {
      authState.channel = await fetchChannel(token);
      try { localStorage.setItem(EVER_CONNECTED_KEY, '1'); } catch (_) {}
      renderConnected();
      dispatchAuthEvent(true);
    } catch (error) {
      authState.channel = null;
      setState(
        'error',
        (error && error.message ? error.message : 'YouTube account lookup failed.') +
          ' Make sure YouTube Data API v3 is enabled for the OAuth project.'
      );
      els.account.classList.add('hidden');
      els.connect.classList.remove('hidden');
      els.connect.disabled = false;
    }
  }

  async function ensureTokenClient() {
    if (authState.tokenClient) return authState.tokenClient;

    await loadGis();

    if (!window.google || !google.accounts || !google.accounts.oauth2) {
      throw new Error('Google Identity Services is unavailable.');
    }

    authState.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: authState.config.clientId,
      scope: authState.config.scope,
      callback: response => {
        handleTokenResponse(response);
      },
      error_callback: error => {
        setState(
          'error',
          'Google OAuth popup failed' +
            (error && error.type ? ': ' + error.type : '.')
        );
        els.connect.disabled = false;
      }
    });

    return authState.tokenClient;
  }

  async function connect() {
    if (!authState.config || !authState.config.enabled) {
      renderDisconnected('OAuth setup is not configured on this deployment.');
      return;
    }

    els.connect.disabled = true;
    setState('loading', 'Opening Google account authorization…');

    try {
      const client = await ensureTokenClient();

      let prompt = 'consent';
      try {
        if (localStorage.getItem(EVER_CONNECTED_KEY) === '1') prompt = '';
      } catch (_) {}

      client.requestAccessToken({ prompt });
    } catch (error) {
      els.connect.disabled = false;
      setState(
        'error',
        error && error.message ? error.message : 'Could not start YouTube OAuth.'
      );
    }
  }

  function disconnect() {
    const token = authState.accessToken;

    if (
      token &&
      window.google &&
      google.accounts &&
      google.accounts.oauth2 &&
      typeof google.accounts.oauth2.revoke === 'function'
    ) {
      google.accounts.oauth2.revoke(token, () => {
        clearToken('YouTube OAuth disconnected.');
      });
      return;
    }

    clearToken('YouTube OAuth disconnected.');
  }

  async function init() {
    if (authState.initialized) return;
    authState.initialized = true;

    cacheElements();
    if (!els.root || !els.connect || !els.disconnect) return;

    els.connect.addEventListener('click', connect);
    els.disconnect.addEventListener('click', disconnect);

    try {
      authState.config = await loadConfig();

      if (!authState.config.enabled) {
        els.connect.disabled = true;
        els.connect.textContent = 'OAuth setup needed';
        setState(
          'setup',
          'Set GOOGLE_OAUTH_CLIENT_ID in Cloudflare Pages to enable the experiment.'
        );
        return;
      }

      els.connect.disabled = false;
      renderDisconnected(
        'OAuth experiment: this authorizes YouTube Data API access; it does not inject the token into the player.'
      );
    } catch (error) {
      els.connect.disabled = true;
      setState(
        'error',
        error && error.message ? error.message : 'OAuth setup could not be loaded.'
      );
    }
  }

  window.YouTubeAuth = {
    init,
    connect,
    disconnect,
    getStatus() {
      return {
        connected: Boolean(authState.accessToken && authState.channel),
        expiresAt: authState.expiresAt,
        channel: authState.channel ? {
          id: authState.channel.id || '',
          title: authState.channel.snippet && authState.channel.snippet.title || ''
        } : null
      };
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once:true });
  } else {
    init();
  }
})();
