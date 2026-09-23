# Aero × IVE

A lightweight YouTube player for exact personalized Mix queues captured from youtube.com.

Aero × IVE is an unofficial fan-made edition and is not affiliated with IVE or Starship Entertainment.

Production: https://aero-x-ive.pages.dev

## Development handoff

Before continuing development in a new chat/session, read HANDOFF.md. It is the canonical project state and must be updated whenever the project changes.

## Current product

Aero intentionally keeps the runtime small: one YouTube iframe, plain HTML/CSS/JavaScript, Cloudflare Pages Functions, and D1 persistence.

The companion **Aero Mix Bridge** extension captures the visible personalized YouTube Mix order and opens Aero with only the ordered video IDs. Aero then plays those IDs one at a time through the normal YouTube IFrame API.

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

Extension v0.3.3 has no content script or runtime attached to Aero. It performs one explicit capture on the active YouTube Mix page, preserves the visible row order, and transfers only the ordered IDs through a short URL fragment.

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
