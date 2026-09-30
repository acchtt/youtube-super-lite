# Aero × IVE

A lightweight YouTube player for exact personalized Mix queues captured from youtube.com.

Aero × IVE is an unofficial fan-made edition and is not affiliated with IVE or Starship Entertainment.

Production: https://aero-x-ive.pages.dev

## Development handoff

Before continuing development in a new chat/session, read HANDOFF.md. It is the canonical project state and must be updated whenever the project changes.

## Current product

Aero intentionally keeps the runtime small: one YouTube iframe, plain HTML/CSS/JavaScript, Cloudflare Pages Functions, and D1 persistence.

The companion **YouTube Super Lite + Aero Mix Bridge** extension can strip most of the normal youtube.com shell while preserving the native player/search/session, and it still captures the visible personalized YouTube Mix order for Aero. Aero then plays captured IDs one at a time through the normal YouTube IFrame API.

Current features:
- experimental **Connect YouTube** OAuth authorization using Google Identity Services and the read-only YouTube Data API;
- exact captured Mix order;
- direct non-modal home state with Mix-ready / empty / resume states;
- first-class captured Mix position (for example 12 / 43);
- direct Player → Mix-home navigation without stopping the current track;
- end-of-Mix completion state with Play again;
- undoable history clearing;
- previous / next / play-pause;
- compact settings for autoplay, repeat and playback speed, with Cinema kept as a quick control;
- CSS-only Cinema mode;
- resume last captured Mix position;
- resume last played video and timestamp;
- fully clickable video-history rows;
- persistent video history;
- Cloudflare D1 persistence;
- anonymous HttpOnly browser session cookie.

Removed as obsolete in v0.13.0:
- manual YouTube URL/video/playlist input;
- custom queue and generated Radio fallback;
- Takeout personalization/import/profile code and API;
- Taste/Personalized modes;
- unused low-memory/refresh controls left over from playlist playback;
- runtime YouTube/Deployments links in the header.

## Mix Bridge

Extension v0.4.0 adds an optional-on-by-default Super Lite youtube.com mode using one tiny content script plus CSS, with no service worker, polling loop, or MutationObserver. The Mix Bridge capture remains explicit: it reads the active visible YouTube Mix panel once, preserves visible row order, and transfers only the ordered IDs through a short URL fragment.

See `extension/README.md`.

## Experimental YouTube OAuth

Aero v0.15.3 adds a contained OAuth experiment. **Connect YouTube** obtains a short-lived browser access token with the read-only YouTube scope, then calls `channels.list?mine=true` to verify which YouTube channel authorized Aero. The token is kept in memory only and is not stored in D1/localStorage.

This does **not** inject OAuth credentials into the YouTube iframe. The purpose is to test whether an explicitly authorized Aero session changes practical History behavior while keeping the existing lightweight player unchanged. OAuth also gives us a supported path for future playlist/subscription/account features.

Configure `GOOGLE_OAUTH_CLIENT_ID` in Cloudflare Pages before testing. See `CLOUDFLARE_SETUP.md`.

## Cloudflare storage

API endpoints:
- GET/PATCH `/api/state`
- GET/POST/PUT/DELETE `/api/history`

D1 binding: `DB`
Database: `youtube-super-lite`

The browser keeps an opaque anonymous HttpOnly session cookie so D1 can associate records with that browser. This is browser-scoped persistence, not cross-device account sync.

See `CLOUDFLARE_SETUP.md`.

## Tech

- plain HTML/CSS/JavaScript
- YouTube IFrame API
- Cloudflare Pages Functions
- Cloudflare D1
- no frontend framework

## License

MIT
