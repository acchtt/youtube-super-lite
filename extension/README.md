# Aero Native + YouTube Super Lite

A lightweight Chrome / Edge / Brave Manifest V3 extension for `youtube.com`.

## v0.10.0 experiment: Aero Native Mode

Aero Native Mode keeps playback on the **real first-party `youtube.com/watch` page**. It does not embed YouTube somewhere else and it does not replace YouTube's media player.

The extension:
- keeps the native signed-in YouTube player, account session, quality selector, captions, fullscreen and normal watch-history behavior;
- hides the normal watch-page shell around the player;
- adds a lightweight Aero header with first-party session status, current title, YouTube search, and an **Exit Aero** button;
- keeps the visible Mix / playlist panel by default;
- uses the existing YouTube SPA navigation events instead of a MutationObserver or polling loop;
- remains plain JavaScript + CSS with no framework and no background service worker.

**Exit Aero** disables only Aero Native Mode and immediately restores the v0.4-style Super Lite layout. Turning Super Lite off restores normal YouTube.

The known-good **v0.4.0** CSS-first build remains the comparison baseline. v0.10.0 is the active first-party-player experiment.

## Why this experiment exists

The standalone Aero iframe player could not get normal YouTube History to recognize playback, even after OAuth and cross-site storage experiments. Aero Native avoids that boundary entirely: the player is the normal signed-in YouTube watch page, so playback happens in YouTube's own first-party session.

The tradeoff is memory. A native YouTube watch page has measured much higher RAM than standalone Aero, so v0.10.0 first tests functionality/history. RAM optimization comes only after confirming the native-mode UX is viable.

## Install locally

1. Clone or download this repository.
2. Open `brave://extensions`, `chrome://extensions`, or `edge://extensions`.
3. Enable **Developer mode**.
4. If this extension was already loaded, click **Reload**.
5. Otherwise choose **Load unpacked** and select the repository's `extension` folder.
6. Open a normal signed-in YouTube watch page.

Aero Native Mode is enabled by default. Open the extension popup to disable it.

## Super Lite / Native defaults

Enabled:
- Super Lite;
- Aero Native watch mode;
- Mix / playlist panel.

Hidden by default outside the native watch shell:
- homepage recommendation feed;
- Shorts shelves/results;
- related videos;
- comments;
- live chat;
- description;
- merch/offer/donation/ticket shelves;
- end-screen recommendation cards.

## Low-overhead architecture

- no background service worker;
- no polling loop;
- no MutationObserver;
- one content script;
- one CSS file;
- `chrome.storage.sync` for settings;
- YouTube's own `yt-navigate-finish` and `yt-page-data-updated` events for SPA route updates.

Aero Native does not claim to reduce the memory of YouTube's player/runtime by itself. It mainly replaces the visible shell while preserving first-party playback.

## Standalone Aero Mix capture

The existing bridge remains available for comparison:

1. Open a YouTube Mix/Radio and wait for its playlist panel.
2. Keep **Mix / playlist panel** enabled.
3. Open the extension.
4. Choose **Capture Mix to standalone Aero**.

That opens `aero-x-ive.pages.dev` with the exact visible queue order. It is useful for A/B testing standalone iframe Aero against first-party Aero Native.
