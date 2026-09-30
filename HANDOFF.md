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
- Aero Native + YouTube Super Lite extension: v0.10.1 active baseline (v0.4.0 remains known-good fallback)
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

Extension v0.10.1 is the active first-party-player baseline. v0.4.0 remains the known-good fallback/comparison baseline.

v0.10.1 Aero Native Mode:
- first-party YouTube History is confirmed working;
- real signed-in `youtube.com/watch` page, native player, quality selector, captions, fullscreen and Mix/playlist panel remain;
- Aero Native is independent from the legacy `liteEnabled` master switch;
- no background service worker, polling loop, framework, MutationObserver, alternate player, or stream extraction;
- measured roughly ~335 MB during early use and ~440 MB after 10 videos in the user's Brave environment;
- the ~105 MB growth over 10 videos remains the current memory problem to investigate.

Rejected v0.10.2 Hard Navigation experiment:
- forced full document navigations between videos and added a fallback reload after SPA-driven video changes;
- Mix/playlist panel disappeared during the experiment;
- RAM worsened dramatically to about ~880 MB after only a few videos;
- do not reintroduce hard-navigation/reload-per-video behavior without a substantially different mechanism and explicit instruction.

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

v0.10.2 Hard Navigation was tested and rejected. It removed the usable Mix/playlist experience and RAM rose to about ~880 MB after only a few videos. The extension has been restored to v0.10.1, which remains the best current first-party baseline: normal YouTube History works, Mix panel works, and observed RAM was about ~335 MB initially and ~440 MB after 10 videos.

Do not reintroduce per-video full-page reloads, periodic reloads, or the earlier Deep Trim/MutationObserver DOM-removal experiments. The next memory investigation should target why native YouTube retains roughly ~10 MB per video across SPA transitions without changing player/session architecture.

Standalone Aero v0.15.5 remains separate. Its OAuth and iframe storage-access experiments did not produce normal YouTube History, so the active History-capable path remains first-party Aero Native.

The exact v0.4.0 extension remains the known-good fallback/comparison baseline.