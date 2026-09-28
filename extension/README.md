# YouTube Super Lite + Aero Mix Bridge

A lightweight Chrome / Edge Manifest V3 extension for `youtube.com`.

## v0.4.2: Deep Trim

v0.4.2 returns fully to the successful v0.4 native-desktop architecture and removes the failed v0.4.1 periodic reload experiment.

The extension still uses:
- the real desktop `youtube.com/watch` page;
- the native YouTube player;
- normal signed-in YouTube history;
- native Theater/Cinema mode;
- YouTube's own quality selector, including 1080p when available;
- the native Mix/playlist panel and native Mix playback.

### Deep Trim

v0.4 originally hid unwanted modules with CSS. Deep Trim keeps that CSS for instant layout stability, then physically removes selected hidden modules from the DOM after YouTube inserts them.

Default trimmed modules include:
- comments;
- related/recommendation renderer;
- Shorts shelves/results;
- guide/mini-guide;
- filter-chip bars;
- live chat;
- merch/offers/donations/tickets/product shelves;
- end-screen recommendation cards;
- hidden homepage feed;
- hidden description metadata.

The native player and `ytd-playlist-panel-renderer` are explicitly protected. The Mix panel remains CSS-only even if the user chooses to hide it, because removing the playlist component could interfere with YouTube's Mix state.

One debounced `MutationObserver` watches only for DOM insertions and schedules trimming during idle time. It ignores removals, so Deep Trim does not continuously react to its own work.

Deep Trim can be disabled in the popup. If a user restores a surface that was physically removed, the extension reloads the current native YouTube page once so YouTube can recreate that surface.

## Architecture

Still intentionally small:
- plain JS/CSS;
- no frontend framework;
- no background service worker;
- no polling loop;
- one insertion-only MutationObserver;
- one content script plus CSS;
- native YouTube playback/session/Mix behavior.

## Aero Mix capture

Mix capture is unchanged. It reads the visible native playlist panel once, preserves exact visible row order including repeated IDs, and opens Aero with the compact captured queue.
