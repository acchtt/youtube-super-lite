# YouTube Super Lite + Aero Mix Bridge

A lightweight Chrome / Edge Manifest V3 extension for `youtube.com`.

## v0.4.1: periodic native memory reset

v0.4.1 keeps the known-good v0.4.0 architecture unchanged in principle: the real desktop YouTube watch page, native player, signed-in history, Theater/Cinema mode, native quality selector and native Mix panel all remain.

The only new behavior targets the observed long-session problem where YouTube's SPA retains more memory after each video.

### Memory reset

The extension counts distinct native watch videos within the current document. By default, on the third video it:

1. waits for YouTube to finish navigating to that video;
2. records whether native Theater mode is active;
3. reloads the exact current `location.href`;
4. restores Theater mode if needed.

Because the browser reloads the exact current URL, `v`, `list`, `index`, `start_radio`, timestamps and other native YouTube query state are not reconstructed or replaced by the extension.

After the reload, the counter starts a new three-video cycle.

The popup offers:
- Off
- Every 3 videos — default
- Every 5 videos
- Every 10 videos

This is intentionally different from the rejected v0.6 approach: v0.4.1 does **not** hard-navigate every video. Normal YouTube SPA behavior remains for most transitions; periodic reloads are only used as a memory-pressure release valve.

## What remains native

- desktop youtube.com watch page;
- signed-in YouTube history/account behavior;
- native Theater/Cinema mode;
- native player settings and quality selector, including 1080p when available;
- native Mix/playlist panel;
- native Next/Previous/autoplay;
- captions, speed, volume, fullscreen and keyboard controls;
- existing Aero Mix capture.

## Super Lite defaults

Hidden by default:
- left navigation / mini guide;
- homepage recommendation feed;
- Shorts shelves/results;
- related videos;
- comments;
- live chat;
- description;
- promotional shelves;
- end-screen recommendation cards;
- filter-chip bars and some secondary masthead controls.

Kept by default:
- native player;
- search;
- title/channel metadata;
- account/session behavior;
- Mix/playlist panel.

The extension remains framework-free with no background service worker, polling loop or MutationObserver.
