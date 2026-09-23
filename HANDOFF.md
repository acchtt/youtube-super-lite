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
- Product role: lightweight YouTube player / unofficial IVE fan edition
- Production: https://aero-x-ive.pages.dev
- Current app version: v0.11.8
- Deployment: Cloudflare Pages from main
- D1 database: youtube-super-lite
- D1 binding: DB

Aero × IVE must remain clearly described as an unofficial fan-made edition and must not imply endorsement or affiliation with IVE or Starship Entertainment.

## Product goal

Keep YouTube playback lightweight for long sessions, especially on low-memory PCs.

The app intentionally avoids the normal YouTube page shell: feed/homepage, comments, Shorts, notifications, infinite recommendation UI, and other page/application bloat.

Keep runtime additions small. Prefer plain HTML/CSS/JS and lightweight assets over heavy frameworks unless there is a compelling reason.

## Current application behavior

### Startup

A startup gate appears on every load.

The user can paste a YouTube video, play the currently captured Mix Bridge songs, resume the previous video, resume the previous playlist/radio, or choose Skip for now.

Skip for now closes the startup gate without loading media and does not clear resume/history state.

Before media is loaded, the player, controls, history and queue layout remain hidden. The normal URL input stays visible.

### Playback

- Exact pasted video plays first.
- If a pasted watch URL contains `list=` context, Aero always loads the exact pasted `v=` directly first. When the optional Aero Mix Bridge has captured a matching youtube.com Mix, Aero uses the captured video-ID array for 2nd track onward, preserving the exact visible personalized queue instead of regenerating the RD list in the embed. Without a matching snapshot it falls back to the embedded YouTube playlist/Radio.
- A plain watch URL falls back to that video's generated `RD<videoId>` YouTube Radio after the exact video; pressing Next early also enters that generated radio rather than Personalized mode.
- Only one YouTube iframe is kept.
- v0.11.8 restores the known-good pre-bridge v0.10.9 player lifecycle for all playback. Bridged Mixes no longer alter iframe creation, viewport size, or rebuild cadence; they only feed the next captured video ID into the same player. Normal Low-memory periodic rebuild behavior remains unchanged.
- Cinema mode is CSS-only.
- Volume and mute survive player rebuilds.
- Browser tab title reflects playing/paused state and the current title/channel.

### Queue and history

- Persistent video history is stored in D1.
- History limit is 200.
- Queue, playback settings, last video/timestamp and last playlist/radio are persisted through the Cloudflare state API.
- Adding items only to the queue does not reveal the hidden media layout until media is actually played.


## Aero Mix Bridge

Aero has an optional Chrome/Edge Manifest V3 companion extension under `extension/`. Extension v0.2.1 uses explicit one-click capture only and preserves YouTube's canonical playlist order.

Purpose:
- capture the personalized Mix queue from the actual signed-in youtube.com watch page;
- store the latest queue locally in extension storage;
- bridge the ordered video IDs into `aero-x-ive.pages.dev`;
- let Aero preserve the captured fixed queue while feeding only one video ID at a time to the iframe after the exact pasted seed.

Files:
- `extension/manifest.json`
- `extension/popup.html`
- `extension/popup.js`
- `extension/aero.js`
- `extension/README.md`

Extension v0.2.1 runs no persistent script, observer, timer, or polling loop on youtube.com. Capture is restricted to the active visible playlist panel, and captured items are sorted by YouTube's own `?index=` values with DOM order only as fallback. The user opens the desired Mix, clicks the extension icon, and presses “Capture current Mix”. The popup injects a one-shot scraper into the active YouTube tab, stores up to 100 visible playlist items in chrome.storage.local, then stops. The YouTube tab can be closed immediately afterward. On Aero, the content script forwards the saved snapshot through same-page `window.postMessage`. A matching snapshot is used when its `listId` matches the pasted URL and contains the pasted seed video. The startup gate exposes a “Play loaded songs” card whenever a captured snapshot is available.

The extension does not force YouTube Watch History entries. Actual Watch History remains best-effort through the standard signed-in YouTube embed; do not add hidden/background playback hacks unless explicitly requested and carefully reassessed.

## Storage and backend

Cloudflare Pages Functions provide:

- GET/PATCH /api/state
- GET/POST/PUT/DELETE /api/history
- GET/PUT/DELETE /api/profile

Main files:
- functions/_lib/session.js
- functions/api/state.js
- functions/api/history.js
- functions/api/profile.js
- cloud-state.js
- schema.sql

Anonymous session cookie: yt_super_lite_sid

Cookie characteristics:
- HttpOnly
- Secure
- SameSite=Lax
- one-year Max-Age

Persistent Aero app state is stored in D1. The cookie identifies the browser's D1 records.

This is not account sync. A different device/browser does not automatically receive the same D1 data because there is no login/pairing identity system.

Legacy localStorage/IndexedDB state is migrated to D1 on a successful Cloudflare load and then removed.

Do not claim that the page literally stores nothing in the browser; the anonymous session cookie still exists, and the embedded YouTube player can have its own browser behavior.

## Personalization / Takeout status

Takeout personalization code is intentionally preserved:
- personalization.js
- takeout-worker.js
- D1 profile API/table

The visible Takeout import/profile card is currently removed from the UI.

Profile rendering and Takeout event wiring are guarded so absent UI elements do not throw errors. As of v0.11.7 the D1 personalization profile is not loaded during normal startup; it is loaded lazily only if Personalized mode is actually invoked.

Do not restore the visible Takeout UI unless requested.

## Current live UI/branding

The live header currently contains:
- a CSS Aero mark;
- Aero × IVE lockup;
- inline SVG IVE treatment;
- FAN EDITION badge;
- version badge.

Current visual palette includes lilac, pink, ice blue, and dark charcoal/black surfaces.

The pink star formerly placed in the IVE SVG was removed in v0.10.5.

## Logo work — critical current status

All previous Aero logo explorations have been explicitly discarded.

There is currently no approved logo direction, no active concept set, and no design preference that should be inherited from the discarded work. Start the next logo exploration from a blank slate and use only requirements the user gives from this point forward.

The old exploration directories `branding/aero-logo/` and `branding/aero-symbol-round2/` have been removed from `main`.

Do not recreate, reference, refine, or use geometry from any earlier Aero logo concepts unless the user explicitly asks to revisit them.

The existing CSS Aero mark in the live production header is only a temporary legacy placeholder until a new logo is approved. Do not treat it as a design direction for the new exploration.

## Installed development skills

Project-local skills:
- .agents/skills/ui-ux-pro-max
- .agents/skills/logo-generator

They are development-time resources, not runtime site dependencies.

Skill sync workflow:
- .github/workflows/sync-ai-skills.yml

Important: the user later explicitly asked to stop using the logo skill for the current logo exploration. Do not use the logo-generator skill for the new Aero symbol unless the user asks to use it again.

## Versioning

Current version: v0.11.8

When bumping the visible app version, keep these aligned:
- application-version meta
- document title
- version badge
- CSS/JS cache-busting query strings
- fallback/default title in app.js

Do not bump versions for uncommitted image experiments.

## Deployment notes

Cloudflare Pages production should track main.

Current intended production configuration:
- hostname: aero-x-ive.pages.dev
- D1 binding variable: DB
- D1 database: youtube-super-lite

The historical cloudflare-pages branch is no longer canonical.

## Working style for future chats

When GitHub access is available and the user asks for a repo change:
- perform the change instead of only giving manual patch instructions;
- fetch fresh SHAs before updating existing files;
- work on main unless explicitly told otherwise;
- verify the result when practical;
- update HANDOFF.md as part of the same work.

For visual experiments, do not push branding into the production header until the user selects/approves a direction.

## Current next step

Start a completely new Aero logo exploration from a blank slate.

Do not inherit the previous symbol-only, angular, curved, wing, flight, letterform, palette, or other logo assumptions unless the user states them again.

Do not integrate a new logo into production until the user explicitly approves a direction.

Once the user approves a new logo:
1. produce/refine the production asset;
2. integrate it into the Aero header/startup lockup;
3. preserve the separate IVE fan-edition treatment/disclaimer as appropriate;
4. bump the app version;
5. update this handoff with the accepted logo and implementation details.

## Last handoff update

2026-09-23 ICT

v0.11.8 rolls back the bridge-era player-lifecycle experiments after confirming the original player could sustain Full HD below ~200 MB before Mix Bridge integration. The YouTube player creation/rebuild path is restored to the v0.10.9 known-good implementation: normal full-size iframe, rel=1, immediate IFrame API player creation, and the original periodic rebuild behavior. Removed bridge-specific hard recycling, 300 ms destroy/recreate delays, lazy-player machinery, and the half-size/scaled iframe viewport experiment. Mix Bridge remains, but it is now only a lightweight ordered-queue layer: captured IDs stay in Aero state and Next/Previous/ENDED simply call loadVideoById() on the same original player. Exact order from v0.11.5 is preserved. The lazy loading of the hidden Takeout profile remains because it is unrelated to playback and only reduces memory. Extension remains v0.2.1.