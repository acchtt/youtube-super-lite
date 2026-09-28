# Aero × IVE

A lightweight YouTube player for exact personalized Mix queues captured from youtube.com.

Aero × IVE is an unofficial fan-made edition and is not affiliated with IVE or Starship Entertainment.

Production: https://aero-x-ive.pages.dev

## Development handoff

Before continuing development in a new chat/session, read HANDOFF.md. It is the canonical project state and must be updated whenever the project changes.

## Current product

Aero intentionally keeps the runtime small: one YouTube iframe, plain HTML/CSS/JavaScript, Cloudflare Pages Functions, and D1 persistence.

The companion **YouTube Super Lite + Aero Mix Bridge** extension keeps the native youtube.com player/history/Mix experience, strips most surrounding UI, and forces a fresh native page between videos to limit long-session SPA memory growth.

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

Extension v0.6.0 returns to native YouTube playback and removes the extension-owned Lite Player. Video changes use fresh page navigations instead of retaining the previous YouTube SPA watch state, while native history, Theater mode, quality controls and Mix/playlist behavior remain available. Exact Mix capture is preserved.

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
