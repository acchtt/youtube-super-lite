# Aero × IVE

A lightweight YouTube player for exact personalized Mix queues captured from youtube.com.

Aero × IVE is an unofficial fan-made edition and is not affiliated with IVE or Starship Entertainment.

Production: https://aero-x-ive.pages.dev

## Development handoff

Before continuing development in a new chat/session, read HANDOFF.md. It is the canonical project state and must be updated whenever the project changes.

## Current product

Aero intentionally keeps the runtime small: one YouTube iframe, plain HTML/CSS/JavaScript, Cloudflare Pages Functions, and D1 persistence.

The companion **YouTube Super Lite + Aero Mix Bridge** extension is currently testing a same-origin watch takeover: it stops normal youtube.com/watch startup at document start and builds a tiny official-player shell on the same YouTube URL, while retaining lightweight browse/search and Aero Mix capture.

Current features:
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

Extension v0.7.1 fixes the experimental same-origin watch takeover so the pending watch document is atomically replaced with `document.open/write/close` and an official YouTube iframe is created immediately. Extension v0.7.0 introduced the same-origin watch takeover. It stops the heavy native watch document before the YouTube SPA finishes booting, keeps the real youtube.com/watch URL, uses one official YouTube IFrame API player, provides lightweight Cinema and Mix controls, and exposes the player's ordered Mix IDs to Aero capture. The critical acceptance test is whether playback is recorded in the signed-in user's normal YouTube History.

See `extension/README.md`.

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
