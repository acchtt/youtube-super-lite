# Aero × IVE — Permanent Project Handoff

> Required first read for every new development chat/session.
>
> This is the canonical cross-chat project state. Keep it current whenever the project changes.

## Permanent maintenance rule

After every committed project update — code, UI, behavior, branding, storage, deployment/configuration, or workflow — update HANDOFF.md in the same work session.

Record what changed, the current version if relevant, changed behavior/architecture, unresolved work, and decisions that must not be accidentally reversed. Do not present exploratory or rejected work as current.

AGENTS.md contains the standing repository instruction for this rule.

## Project identity

- Repository: acchtt/youtube-super-lite
- Canonical branch: main
- Product name: Aero × IVE
- Product role: lightweight YouTube Mix player / unofficial IVE fan edition
- Production: https://aero-x-ive.pages.dev
- Current app version: v0.14.2
- Mix Bridge extension: v0.3.3
- Deployment: Cloudflare Pages from main
- D1 database: youtube-super-lite
- D1 binding: DB

Aero × IVE must remain clearly described as an unofficial fan-made edition and must not imply endorsement or affiliation with IVE or Starship Entertainment.

## Product goal

Keep personalized YouTube Mix playback lightweight for long sessions, especially on low-memory PCs.

The app intentionally avoids the normal YouTube page shell and now avoids obsolete internal recommendation/personalization systems too.

Keep runtime additions small. Prefer plain HTML/CSS/JS and lightweight assets over heavy frameworks unless there is a compelling reason.

## Current application behavior

### Startup / home

The old blocking startup modal was removed in v0.14.0.

The normal page is now the landing state:
- while D1 is loading, a visible static “Loading Aero…” state is shown;
- when a captured Mix exists, Aero shows a prominent Mix card with track count, exact-order status, and Play/Resume Mix;
- a capture opened from Mix Bridge is explicitly labeled “MIX CAPTURED” and resets playback to track 1;
- when no Mix exists, Aero shows a simple instruction to capture one with the extension;
- the last played video remains available as a secondary Continue Watching action;
- history remains accessible below the home/player area.

### Playback

- Aero keeps one standard youtube.com IFrame API player.
- Captured Mixes use a separate lightweight `bridgePlayback` queue and feed one video ID at a time with `loadVideoById()`.
- Exact-ID guards verify that the iframe is playing the captured ID and correct unexpected video changes.
- Previous/Next operate only on the captured Mix.
- Autoplay, repeat-one/repeat-Mix, playback speed and CSS-only Cinema mode remain.
- Volume/mute and last-video progress are persisted.
- Browser tab title reflects the current video.

### Mix Bridge

Extension v0.3.3:
- has only `activeTab` + `scripting` permissions;
- has no Aero content script, storage listener, background service worker, observer, or polling loop;
- captures the active visible YouTube Mix panel once;
- preserves rendered row order exactly, including repeated IDs;
- opens Aero with a compact `#aeroMix=` fragment containing list/seed IDs and ordered video IDs.

Aero imports the fragment into D1-backed state and immediately removes it from the address bar.

### History and storage

Persistent video history is stored in D1 with a limit of 200 entries.

Current Cloudflare Pages Functions:
- GET/PATCH `/api/state`
- GET/POST/PUT/DELETE `/api/history`

The anonymous session cookie `yt_super_lite_sid` remains HttpOnly, Secure, SameSite=Lax, with a one-year Max-Age.

This is browser-scoped persistence, not cross-device account sync.

## Removed obsolete functionality — do not restore unless explicitly requested

v0.13.0 removed:
- manual YouTube URL/video ID/playlist inputs;
- Open YouTube link in the Aero header;
- custom manual queue UI and queue state;
- embedded playlist/Radio continuation and generated RD fallback;
- Personalized/Taste modes;
- YouTube Takeout import/profile functionality;
- `personalization.js`;
- `takeout-worker.js`;
- `functions/api/profile.js`;
- D1 profile API usage and profile table from the setup schema;
- old last-playlist runtime/API state;
- Shuffle (captured Mixes are exact-order);
- low-memory/refresh-player controls that no longer affected captured playback;
- Deployments link from the runtime header.

Legacy browser profile IndexedDB is deleted opportunistically by the migration helper, but no profile data is migrated or used.

## Current UI

The UI remains dark, lightweight and IVE-inspired:
- dark charcoal surfaces;
- lilac, pink and ice-blue accent treatment;
- CSS Aero mark as the temporary legacy placeholder;
- inline SVG IVE treatment;
- FAN EDITION badge.

v0.14.0 applies the second UI/UX Pro Max pass:
- no blocking startup modal;
- D1 loading feedback is visible in the normal page;
- new captures have a clear primary Play Mix state;
- Mix progress is first-class in the header and player (for example 12 / 43);
- dynamic Mix state uses a dedicated accessible `role="status"` component instead of the version badge;
- the visible version moved to the footer;
- history rows are full-row accessible play buttons;
- transport remains primary while only Cinema is exposed as a quick setting;
- v0.14.1 merges transport, Cinema, Settings, and shortcut hints into the same player/title card instead of a separate controls card;
- Autoplay, Repeat and Speed moved into a compact Settings disclosure;
- transport/history icons remain inline SVG with >=44px targets;
- visible `:focus-visible` rings and reduced-motion handling remain;
- the dark palette and static lightweight background remain; no heavy glass/animation effects were added.

## Logo work — critical current status

All previous Aero logo explorations have been explicitly discarded.

There is currently no approved logo direction, no active concept set, and no design preference that should be inherited from discarded work.

The existing CSS Aero mark in the live production header is only a temporary legacy placeholder until a new logo is approved.

Project-local skills:
- .agents/skills/ui-ux-pro-max
- .agents/skills/logo-generator

Do not use the logo-generator skill unless the user explicitly asks to use it again.

## Versioning

Current version: v0.14.2

When bumping the visible app version, keep these aligned:
- application-version meta
- document title
- version badge
- CSS/JS cache-busting query strings
- fallback/default title in app.js

## Deployment notes

Cloudflare Pages production tracks `main`.

Current intended production configuration:
- hostname: aero-x-ive.pages.dev
- D1 binding variable: DB
- D1 database: youtube-super-lite

## Working style for future chats

When GitHub access is available and the user asks for a repo change:
- perform the change instead of only giving manual patch instructions;
- fetch fresh SHAs before updating existing files;
- work on main unless explicitly told otherwise;
- verify the result when practical;
- update HANDOFF.md in the same committed project change.

## Last handoff update

2026-09-23 ICT

v0.14.2 fixes the large black side bars visible in Cinema mode after the title/control consolidation. The cause was the old `max-height:82vh` rule on a full-width 16:9 aspect box: once the width became large, the height cap forced the iframe viewport away from 16:9 and YouTube letterboxed/pillarboxed the video inside it. Cinema now keeps the video viewport at a true full-width 16:9 with no height-only cap. The merged v0.14.1 title/control bar remains unchanged. This is CSS/UI-only; player lifecycle, Mix Bridge v0.3.3, exact-order playback, D1, and memory behavior are unchanged.