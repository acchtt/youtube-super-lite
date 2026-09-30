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
- Current app version: v0.15.5
- Aero Native + YouTube Super Lite extension: v0.10.0 experimental (v0.4.0 remains known-good baseline)
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

### Aero Native + YouTube Super Lite

Extension v0.10.0 is the active first-party-player experiment. v0.4.0 remains the known-good comparison baseline.

v0.10.0 Aero Native Mode:
- runs directly on the real signed-in `youtube.com/watch` page; no embed, alternate player, or stream extraction;
- keeps YouTube's native player, controls, quality selector, captions, fullscreen, account session and first-party History behavior;
- hides normal watch-page chrome with CSS and injects one lightweight Aero header containing first-party-session status, current title, YouTube search, and Exit Aero;
- keeps the native Mix/playlist panel by default;
- Exit Aero toggles only Native Mode off and returns immediately to the v0.4-style Super Lite presentation;
- still uses no background service worker, polling loop, framework, or MutationObserver;
- uses YouTube's own SPA events to keep route/title state current;
- first acceptance test is History + playback correctness; RAM is measured separately afterward because native YouTube runtime previously measured around 400–450 MB on the current Brave/YouTube environment.

v0.4.0 baseline characteristics:
- real desktop `youtube.com` watch page and native player;
- normal signed-in YouTube history/account behavior;
- native Theater/Cinema and native quality selector, including 1080p when offered;
- native Mix/playlist panel retained by default;
- CSS-first stripping only; no DOM removal, periodic reload, alternate player, document takeover, mobile mode, or embed replacement;
- no background service worker, polling loop or MutationObserver;
- Capture current Mix reads the visible native playlist panel once, preserves rendered row order exactly including repeated IDs, and opens Aero with a compact `#aeroMix=` fragment.

Aero imports the fragment into D1-backed state and immediately removes it from the address bar.



### Standalone Aero YouTube History experiments

The standalone iframe route is currently considered exhausted for History. The user confirmed v0.15.5 still was not recognized by YouTube after OAuth had already failed and after the iframe storage-access permission was moved before first navigation.

v0.15.5 history experiment details (retained for reference):

Current experiment:
- keep the existing lightweight `www.youtube.com` IFrame API player unchanged;
- do not use OAuth for History; Data API authorization is considered unrelated to iframe viewer identity for this project;
- v0.15.5 fixes the experiment's iframe timing: Aero no longer lets `YT.Player` create the initial iframe. The first requested video causes Aero to create an existing `<iframe>` itself, set `allow` including `storage-access`, fullscreen, autoplay and media permissions, set the referrer policy, and only then assign the first `www.youtube.com/embed/VIDEO_ID?enablejsapi=1...` URL;
- after that first navigation has been configured, Aero attaches the official `YT.Player` API to the existing iframe, which Google documents as supported;
- subsequent tracks still use the same lightweight player via `loadVideoById()`; no additional YouTube page runtime is introduced;
- the `storage-access` allow token does not itself grant cookies or session access. Only the embedded YouTube document can call `requestStorageAccess()`, and browser privacy settings remain authoritative;
- Aero now shows a History-session test card with links to open first-party YouTube sign-in, reload Aero after changing browser cookie/Shields settings, and open normal YouTube History;
- Brave blocks/partitions cross-site storage by default, so the acceptance test requires allowing YouTube cross-site storage for `aero-x-ive.pages.dev` or temporarily lowering Shields for Aero only;
- after enabling cross-site session access, reload Aero, play a fresh track for a few minutes, then verify whether the video appears in normal YouTube History;
- do not claim History works until the user verifies it.

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

Current version: v0.15.5

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

2026-09-30 ICT

The user confirmed standalone Aero v0.15.5 still was not recognized by YouTube History. OAuth and iframe cross-site/session experiments are therefore no longer the active direction for History.

Extension v0.10.0 starts the new Aero Native experiment: keep the real first-party signed-in `youtube.com/watch` player/session, hide the normal shell, and inject a lightweight Aero header/search/Exit control. This should preserve normal YouTube History by construction because playback remains first-party. Test History and playback first, then measure RAM against v0.4.0 and stock YouTube.

The exact v0.4.0 extension remains the known-good rollback/comparison baseline. v0.4.1 periodic reload reached about 460 MB and v0.4.2 Deep Trim reached about 500 MB on the first video, so both are rejected. Do not reintroduce periodic reload or MutationObserver/DOM-removal trimming without explicit instruction. The next memory investigation must first identify which browser process owns the memory (YouTube renderer, GPU/video decoder, utility, or extension) before changing architecture.

Extension v0.4.0 evolves Aero Mix Bridge into YouTube Super Lite + Mix Bridge. Super Lite is default-on and CSS-first: it removes most of the normal youtube.com shell while retaining native playback/search/session behavior and the Mix panel needed for capture. The extension deliberately uses no framework, background service worker, polling loop, or MutationObserver; one small content script only applies stored switches and tracks YouTube SPA navigation. The popup can restore individual surfaces or disable Lite mode entirely. Mix capture semantics are unchanged.\n\nv0.15.2 adds `vq: 'hd1080'` to the YouTube IFrame player configuration so Aero requests 1080p as its default/preferred quality. Current YouTube IFrame API quality setter methods and `suggestedQuality` are deprecated/no-op, so Aero does not pretend to force a stream level; YouTube may still lower or raise quality adaptively based on the viewer environment. No queue, Mix Bridge, storage, or transport behavior changed.

v0.15.1 fixes Cinema sizing on wide/short desktop viewports. Cinema still preserves a true 16:9 YouTube iframe, but the app width is now capped by viewport height (with `dvh` when supported and `vh` fallback), leaving a small vertical safety margin so YouTube’s bottom controls remain visible instead of extending just below the screen. No playback lifecycle, Mix Bridge, storage, or queue behavior changed.

v0.15.0 applies the full Impeccable critique/polish pass requested after the v0.14.2 player fixes. The player now has a visible Mix-home return control that preserves current playback; while the player is open, the duplicate header Mix-status pill is hidden and the in-player N / total pill is canonical. Now Playing metadata no longer exposes the raw YouTube video ID or redundant “captured Mix” text. Keyboard hints moved into Settings to reduce persistent chrome, transport buttons were visually quieted, and the title/control bar was tightened without changing the 16:9 iframe or player lifecycle. Reaching the natural end of a captured Mix now returns to a “Mix complete” home state with Play again. Clear History is immediate but undoable for eight seconds using the existing D1 replace-history endpoint. Storage-load failures now use viewer-facing recovery copy plus a Reload action instead of D1/schema jargon. The no-Mix state links to Mix Bridge setup for first-time recovery, Settings closes on outside click/Escape, footer copy was simplified, and browser surfaces received lightweight selection/scrollbar theming. No Mix Bridge extension or YouTube playback lifecycle changes were made; Mix Bridge remains v0.3.3.