# YouTube Super Lite + Aero Mix Bridge

A lightweight Chrome / Edge Manifest V3 extension for `youtube.com`.

## v0.6.0: native YouTube + fresh-video navigation

v0.6.0 removes the extension-owned Lite Player experiment and returns to the successful v0.4 principle: **the actual youtube.com watch page and native YouTube player remain in use**.

The memory-focused change is navigation:

- video links bypass YouTube's SPA router and use a normal browser navigation;
- player-driven Next/Previous/autoplay transitions are detected after YouTube navigates and reloaded once into a fresh document;
- each new video therefore discards the previous watch page's accumulated SPA/component/cache state instead of carrying it indefinitely;
- playlist identity includes `v`, `list`, and `index`, so repeated video IDs at different Mix positions still receive a fresh document.

## What remains native

Because playback stays on youtube.com:

- watched videos use the normal signed-in YouTube history path;
- native Theater/Cinema mode remains available;
- native quality controls remain available, including 1080p when YouTube offers it for the video/environment;
- captions, playback speed, volume, fullscreen and keyboard controls remain native;
- native Mix/playlist panels, Next/Previous, autoplay and playlist order remain intact.

The extension does not claim to force 1080p; YouTube still controls stream availability and adaptive quality.

## Super Lite defaults

Hidden by default:
- left navigation / mini guide;
- homepage recommendation feed;
- Shorts shelves/results;
- related videos;
- comments;
- live chat;
- description;
- merch / offer / donation / ticket shelves;
- end-screen recommendation cards;
- filter-chip bars and some secondary masthead controls.

Kept by default:
- native YouTube player and controls;
- search/account session;
- video title/channel metadata;
- native Mix / playlist panel.

The popup can restore individual surfaces and can independently disable **Reset RAM between videos** if normal SPA navigation is preferred.

## Aero Mix capture

The existing Mix Bridge behavior is preserved:

1. Open the personalized Mix / Radio on youtube.com.
2. Keep **Mix / playlist panel** enabled and wait for the visible panel to render.
3. Open the extension popup.
4. Click **Capture current Mix**.
5. Aero opens with the captured visible order.

Capture preserves rendered row order exactly, including repeated video IDs.

## Architecture

Still intentionally small:
- plain JS/CSS;
- no framework;
- no background service worker;
- no polling loop;
- no MutationObserver;
- `chrome.storage.sync` only for settings.

The hard-navigation reset targets long-session RAM growth; it does not make the native YouTube application as small as Aero's separate one-iframe player.
