# YouTube Super Lite + Aero Mix Bridge

A lightweight Chrome / Edge Manifest V3 extension for `youtube.com`.

It now has two jobs:

1. **Super Lite mode** strips the normal YouTube page down toward the native player, search, title/channel essentials, and optionally the visible Mix/playlist panel.
2. **Aero Mix Bridge** still captures the visible personalized Mix order and opens Aero × IVE with only the ordered video IDs.

## Install locally

1. Clone or download this repository.
2. Open `chrome://extensions` in Chrome, or `edge://extensions` in Edge.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select the repository's `extension` folder.

## Super Lite defaults

Super Lite is enabled immediately after installation.

Hidden by default:
- left navigation / mini guide;
- homepage recommendation feed;
- Shorts shelves and Shorts results;
- related videos;
- comments;
- live chat;
- description;
- merch / offer / donation / ticket shelves;
- end-screen recommendation cards;
- filter-chip bars and some secondary masthead controls.

Kept by default:
- native YouTube video player and controls;
- search;
- video title/channel metadata;
- account/session behavior;
- Mix / playlist panel, so Aero capture remains available.

Open the extension popup to restore the homepage feed, related videos, comments, Shorts, Mix panel, or description individually. Turning **Super Lite** off restores YouTube's normal layout without uninstalling the extension.

## Low-overhead architecture

v0.4.0 remains intentionally framework-free:
- no background service worker;
- no polling loop;
- no MutationObserver;
- one tiny content script;
- one CSS file that performs almost all visual stripping;
- `chrome.storage.sync` only for the seven user switches;
- YouTube's own `yt-navigate-finish` / `yt-page-data-updated` events keep route state current during SPA navigation.

This primarily removes visual/UI overhead and reclaims layout space. It does **not** pretend to stop every YouTube script or network request, so the memory reduction will be smaller than Aero × IVE's separate one-iframe player.

## Aero Mix capture

1. Sign into YouTube normally.
2. Open the personalized Mix / Radio on youtube.com and wait for the playlist panel to appear.
3. Keep **Mix / playlist panel** enabled.
4. Click the extension.
5. Click **Capture current Mix**.
6. Aero opens automatically with the captured order.

Capture still preserves the rendered row order exactly, including repeated video IDs, and transfers only a compact URL fragment.
