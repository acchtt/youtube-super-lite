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
- Current app version: v0.10.5
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

The user can paste a YouTube video, resume the previous video, resume the previous playlist/radio, or choose Skip for now.

Skip for now closes the startup gate without loading media and does not clear resume/history state.

Before media is loaded, the player, controls, history and queue layout remain hidden. The normal URL input stays visible.

### Playback

- Exact pasted video plays first.
- If a pasted watch URL contains list= context, Aero preserves that playlist/radio context.
- A plain watch URL falls back to that video's generated RD<videoId> YouTube Radio after the exact video.
- Only one YouTube iframe is kept.
- Low-memory mode periodically rebuilds the iframe; default is every 8 videos.
- Cinema mode is CSS-only.
- Volume and mute survive player rebuilds.
- Browser tab title reflects playing/paused state and the current title/channel.

### Queue and history

- Persistent video history is stored in D1.
- History limit is 200.
- Queue, playback settings, last video/timestamp and last playlist/radio are persisted through the Cloudflare state API.
- Adding items only to the queue does not reveal the hidden media layout until media is actually played.

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

Profile rendering and Takeout event wiring are guarded so absent UI elements do not throw errors.

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

No new Aero symbol has been approved yet.

The user explicitly discarded the earlier logo directions and asked to explore a symbol-only logo.

Current logo preference:
- symbol only;
- no Aero wordmark inside the logo;
- geometric/angular rather than soft ribbon forms;
- avoid the earlier curved/swooping direction;
- must work as a compact app/site icon on the dark Aero UI.

The old committed explorations under branding/aero-logo are obsolete/discarded design experiments. Do not treat them as selected branding and do not resurrect them unless the user explicitly asks.

The latest symbol concepts were generated only as chat image explorations and were not integrated into the production site.


### Fresh symbol exploration — round 2

A new from-scratch angular symbol set is committed under `branding/aero-symbol-round2/`.

It contains six unapproved directions plus a comparison page:
- 01 Vector Notch
- 02 Twin Wing
- 03 Prism Cut
- 04 Flight Core
- 05 Crosswind
- 06 Delta Frame

These were created without using the logo-generator skill and without reusing the discarded curved/swooping explorations. They are exploration assets only and are not integrated into the live header.

## Installed development skills

Project-local skills:
- .agents/skills/ui-ux-pro-max
- .agents/skills/logo-generator

They are development-time resources, not runtime site dependencies.

Skill sync workflow:
- .github/workflows/sync-ai-skills.yml

Important: the user later explicitly asked to stop using the logo skill for the current logo exploration. Do not use the logo-generator skill for the new Aero symbol unless the user asks to use it again.

## Versioning

Current version: v0.10.5

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

Review the fresh round-2 symbol set in `branding/aero-symbol-round2/` and select a direction or request another round.

No round-2 symbol is approved yet. Do not integrate one into production until the user explicitly selects it.

Once the user approves a symbol:
1. refine the selected geometry into the production asset;
2. integrate it into the Aero header/startup lockup;
3. preserve the separate IVE fan-edition treatment/disclaimer as appropriate;
4. bump the app version;
5. update this handoff with the accepted logo and implementation details.

## Last handoff update

2026-09-23 ICT

Added a fresh, from-scratch round-2 Aero symbol exploration under `branding/aero-symbol-round2/`: six angular symbol-only concepts and a comparison page. No concept is approved or integrated into production. The logo-generator skill was not used.
