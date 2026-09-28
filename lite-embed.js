'use strict';

const params = new URLSearchParams(location.search);
const videoId = params.get('v') || '';
const player = document.getElementById('player');

function safeParam(name, pattern) {
  const value = params.get(name) || '';
  return pattern.test(value) ? value : '';
}

if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
  document.body.textContent = '';
} else {
  const embed = new URL('https://www.youtube.com/embed/' + encodeURIComponent(videoId));

  for (const name of ['autoplay', 'playsinline', 'rel']) {
    const value = safeParam(name, /^(?:0|1)$/);
    if (value) embed.searchParams.set(name, value);
  }

  const list = safeParam('list', /^[A-Za-z0-9_-]{2,200}$/);
  const index = safeParam('index', /^\d{1,4}$/);
  const start = safeParam('start', /^\d{1,7}$/);

  if (list) embed.searchParams.set('list', list);
  if (index) embed.searchParams.set('index', index);
  if (start) embed.searchParams.set('start', start);

  // Keep the embed deliberately standard. The HTTPS wrapper itself is the
  // API-client identity surface YouTube requires via the HTTP Referer.
  player.src = embed.toString();
}
