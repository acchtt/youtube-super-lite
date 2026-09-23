# Aero × IVE

A lightweight YouTube player designed for long listening/viewing sessions with less page overhead than the normal YouTube interface.

Aero × IVE is an unofficial fan-made edition and is not affiliated with IVE or Starship Entertainment.

Production: https://aero-x-ive.pages.dev

## Development handoff

Before continuing development in a new chat/session, read HANDOFF.md. It is the canonical project state and must be updated whenever the project changes.

## Why it is lighter

Aero keeps one YouTube iframe player and avoids the normal YouTube feed, comments, Shorts, notifications, infinite recommendation UI, and other page shell overhead.

## Current features

- YouTube video / video ID / playlist input
- exact pasted video plays first
- playlist/Radio context preservation when present
- optional Aero Mix Bridge extension for capturing the exact personalized Mix queue from youtube.com
- startup “Play loaded songs” option when a Mix Bridge snapshot is available
- generated YouTube Radio fallback for plain watch URLs
- custom queue
- previous / next, shuffle, repeat and playback speed
- low-memory periodic player rebuild
- CSS-only Cinema mode
- startup resume for last video and last playlist/radio
- persistent video history
- Cloudflare D1 persistence
- anonymous HttpOnly browser session cookie

## Exact personalized YouTube Mixes

The optional Chrome/Edge extension in `extension/` captures the visible personalized Mix queue from your signed-in youtube.com watch page and passes the ordered video IDs to Aero. Aero then plays that fixed queue instead of independently regenerating the `RD...` radio.

See `extension/README.md` for installation and usage.

## Cloudflare storage

Persistent Aero app data is stored in Cloudflare D1 through Pages Functions.

The browser keeps an opaque anonymous HttpOnly session cookie so D1 can associate records with that browser. This is anonymous browser-scoped persistence, not cross-device account sync.

API endpoints:
- GET/PATCH /api/state
- GET/POST/PUT/DELETE /api/history
- GET/PUT/DELETE /api/profile

D1 binding: DB
Database: youtube-super-lite

See CLOUDFLARE_SETUP.md.

## Personalization

The Takeout personalization backend/client code remains in the project, but its visible import/profile UI is currently hidden. Refer to HANDOFF.md for current behavior.

## Tech

- plain HTML/CSS/JavaScript
- YouTube IFrame API
- Cloudflare Pages Functions
- Cloudflare D1
- no frontend build framework

## License

MIT
