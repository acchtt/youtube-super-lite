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
- Current app version: v0.15.2
- YouTube Super Lite + Mix Bridge extension: v0.7.0 experimental
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
- The YouTube embed requests `hd1080` as the preferred playback quality. YouTube still controls the final adaptive stream quality and may override the preference.

### YouTube Super Lite + Mix Bridge

Extension v0.7.0 experimental:
- normal `youtube.com/watch?v=...` pages are intercepted by a MAIN-world `document_start` script that calls `window.stop()` before the heavy watch SPA finishes booting;
- the top-level document remains the real youtube.com/watch origin/URL; there is no extension player page and no Aero-domain playback wrapper;
- the stopped document is replaced with one official YouTube IFrame API player plus a tiny search/title/control shell;
- native iframe player controls, captions, speed, fullscreen and quality selection remain available; Cinema is implemented as a lightweight shell layout;
- a Full YouTube escape hatch adds `aero_native=1` and reloads the same video without takeover;
- Mix/list/index context is passed into the official player; lightweight Previous/Next/status controls remain, the current v/list/index is reflected back into the address bar, and the player's ordered playlist IDs are exposed via DOM dataset state;
- Capture current Mix first reads the takeover player's actual playlist IDs, falling back to native playlist-panel scraping only on full native pages;
- browse/search pages keep the v0.4-style stripped UI and watch links are forced through a real document navigation so takeover can execute before YouTube's SPA watch route;
- the critical unresolved acceptance test is whether official-player playback in this same-origin stopped document is recorded in the signed-in user's standard YouTube History. Do not claim that this is confirmed until the user verifies it;
- there is no background service worker, polling loop, MutationObserver, frontend framework, or Aero playback dependency.

Aero imports captured Mix fragments into D1-backed state and immediately removes the fragment from its address bar.

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
- v0.15.0 adds Player → Mix-home navigation, makes player progress the canonical in-player Mix status, moves keyboard hints inside Settings, adds an end-of-Mix completion/replay state, and makes history clearing undoable;
- v0.15.1 constrains Cinema mode by viewport height as well as width so the true 16:9 YouTube iframe stays inside the visible screen on wide, short desktop windows;
- v0.15.2 adds an embed-level `hd1080` playback preference without adding deprecated quality-setter calls or changing the player lifecycle;
- Autoplay, Repeat and Speed moved into a compact Settings disclosure;
- transport/history icons remain inline SVG with >=44px targets;
- visible `:focus-visible` rings and reduced-motion handling remain;
- the dark palette and static lightweight background remain; no heavy glass/animation effects were added.

## Logo work — critical current status

All previous Aero logo explorations have been explicitly discarded.

There is currently no approved logo direction, no active concept set, and no design preference that should be inherited from discarded work.

The existing CSS Aero mark in the live production header is only a temporary legacy placeholder until a new logo is approved.

Project-local skills:
- .agents/skills/impeccable
- .agents/skills/logo-generator

Impeccable replaced UI/UX Pro Max as the project's active UI/design skill on 2026-09-23. Use Impeccable for future UI audit, critique, polish, layout, responsive, accessibility, and design-system work. This repository install includes the skill payload but does not auto-enable the optional Codex edit hook.

Do not use the logo-generator skill unless the user explicitly asks to use it again.

## Versioning

Current version: v0.15.2

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

2026-09-28 ICT

Extension v0.7.0 is the same-origin takeover experiment prompted by v0.6 reaching roughly 400 MB on the first stripped native watch page. The new architecture keeps the real youtube.com/watch top-level origin but stops its heavy document at document_start and builds only an official YouTube player shell. The primary go/no-go criterion is signed-in YouTube History recording; memory, Cinema, 1080p-capable native player controls and Mix behavior are secondary verification targets.\n\nExtension v0.6.0 removes the Lite Player architecture after clarifying the extension goal: playback must remain native YouTube so signed-in watch history, Theater/Cinema mode, 1080p-capable native quality controls, and Mix behavior are retained. The v0.4 stripped native page is restored, with a new default-on hard-navigation reset between videos/Mix positions to stop SPA state from accumulating across long sessions. Clicked watch links bypass the SPA directly; player-driven Next/Previous/autoplay transitions are reloaded once after navigation. Mix identity includes video/list/index so repeated IDs remain correct. The old v0.5 player/wrapper files are removed.\n\nExtension v0.5.1 fixes YouTube Error 153 in Lite Player. Chromium extension pages can omit the HTTP Referer required by YouTube embeds, so Lite Player no longer embeds youtube.com directly from `chrome-extension://`. It now loads the static `lite-embed.html` wrapper from the existing Aero HTTPS domain, and that wrapper hosts the single YouTube iframe with `strict-origin-when-cross-origin`. This keeps the lightweight one-player architecture and adds no background service worker or framework.\n\nExtension v0.5.0 is the first memory-focused watch-page architecture. Normal YouTube browsing/search remains available, but ordinary watch URLs are now routed into a minimal extension-owned page with one YouTube embed, so the full native watch shell does not need to stay resident during playback. A Full YouTube bypass preserves access to comments/native playlist UI and exact Mix capture. Lite Player can be disabled from the popup to fall back to v0.4 behavior. There is still no service worker, polling loop, MutationObserver, framework, or custom playback engine.\n\nExtension v0.4.0 evolves Aero Mix Bridge into YouTube Super Lite + Mix Bridge. Super Lite is default-on and CSS-first: it removes most of the normal youtube.com shell while retaining native playback/search/session behavior and the Mix panel needed for capture. The extension deliberately uses no framework, background service worker, polling loop, or MutationObserver; one small content script only applies stored switches and tracks YouTube SPA navigation. The popup can restore individual surfaces or disable Lite mode entirely. Mix capture semantics are unchanged.\n\nv0.15.2 adds `vq: 'hd1080'` to the YouTube IFrame player configuration so Aero requests 1080p as its default/preferred quality. Current YouTube IFrame API quality setter methods and `suggestedQuality` are deprecated/no-op, so Aero does not pretend to force a stream level; YouTube may still lower or raise quality adaptively based on the viewer environment. No queue, Mix Bridge, storage, or transport behavior changed.

v0.15.1 fixes Cinema sizing on wide/short desktop viewports. Cinema still preserves a true 16:9 YouTube iframe, but the app width is now capped by viewport height (with `dvh` when supported and `vh` fallback), leaving a small vertical safety margin so YouTube’s bottom controls remain visible instead of extending just below the screen. No playback lifecycle, Mix Bridge, storage, or queue behavior changed.

v0.15.0 applies the full Impeccable critique/polish pass requested after the v0.14.2 player fixes. The player now has a visible Mix-home return control that preserves current playback; while the player is open, the duplicate header Mix-status pill is hidden and the in-player N / total pill is canonical. Now Playing metadata no longer exposes the raw YouTube video ID or redundant “captured Mix” text. Keyboard hints moved into Settings to reduce persistent chrome, transport buttons were visually quieted, and the title/control bar was tightened without changing the 16:9 iframe or player lifecycle. Reaching the natural end of a captured Mix now returns to a “Mix complete” home state with Play again. Clear History is immediate but undoable for eight seconds using the existing D1 replace-history endpoint. Storage-load failures now use viewer-facing recovery copy plus a Reload action instead of D1/schema jargon. The no-Mix state links to Mix Bridge setup for first-time recovery, Settings closes on outside click/Escape, footer copy was simplified, and browser surfaces received lightweight selection/scrollbar theming. No Mix Bridge extension or YouTube playback lifecycle changes were made; Mix Bridge remains v0.3.3.