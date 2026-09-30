# Aero × IVE

A lightweight YouTube player for exact personalized Mix queues captured from youtube.com.

Aero × IVE is an unofficial fan-made edition and is not affiliated with IVE or Starship Entertainment.

Production: https://aero-x-ive.pages.dev

## Development handoff

Before continuing development in a new chat/session, read HANDOFF.md. It is the canonical project state and must be updated whenever the project changes.

## Current product

Aero intentionally keeps the runtime small: one YouTube iframe, plain HTML/CSS/JavaScript, Cloudflare Pages Functions, and D1 persistence.

The companion extension is now testing **Aero Native Mode v0.10.0**: an Aero-style watch interface running directly on the real signed-in `youtube.com/watch` page. It preserves YouTube's first-party player/session/history while hiding most of the normal watch shell. The known-good v0.4.0 Super Lite build remains the baseline, and Mix Bridge capture to standalone Aero remains available for A/B testing.

Current features:
- experimental **YouTube History session test** for browsers that isolate cross-site YouTube storage;
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

## Aero Native + Mix Bridge

Extension v0.10.0 adds experimental Aero Native Mode on top of the v0.4.0 CSS-first baseline. Native Mode stays on the real first-party `youtube.com/watch` page, keeps YouTube's native player/session/history, and replaces the surrounding watch-page presentation with a small Aero shell. It still uses no service worker, polling loop, or MutationObserver.

The Mix Bridge remains explicit: it reads the active visible YouTube Mix panel once, preserves visible row order, and transfers only the ordered IDs through a short URL fragment for standalone Aero comparison.

See `extension/README.md`.

## Experimental YouTube History session test

Aero v0.15.5 removes the OAuth experiment after a successful OAuth login still failed to place iframe-played videos into normal YouTube History.

The current experiment keeps the existing lightweight `www.youtube.com` iframe and tests browser session access instead. On Brave, cross-site cookies/storage are blocked or partitioned by default, so the user must allow YouTube cross-site storage for `aero-x-ive.pages.dev` (or temporarily lower Shields for Aero only), reload Aero, then play a fresh track and check normal YouTube History.

Aero now lazily creates the first YouTube iframe only when a video is requested. It sets the complete iframe `allow` policy — including `storage-access` — before assigning the first `www.youtube.com/embed/VIDEO_ID` URL, then attaches the official IFrame Player API to that existing iframe. This removes the previous timing flaw where the permission was added only after `onReady`. It still does not grant storage access by itself; the browser and embedded YouTube document remain in control.

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
