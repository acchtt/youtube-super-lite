# YouTube Super Lite + Aero Mix Bridge

A lightweight Chrome / Edge Manifest V3 extension for `youtube.com`.

## v0.5.1: Lite Watch Player

The extension now separates **browsing** from **watching**:

- YouTube search, results, channels and browsing stay on normal youtube.com.
- Opening a normal `/watch?v=...` URL is routed into an extension-owned **Lite Player** page.
- Lite Player contains a small search bar, basic metadata, and one YouTube embed reached through the tiny HTTPS `lite-embed.html` wrapper on the Aero domain.
- The HTTPS wrapper exists specifically to supply the normal HTTP referrer YouTube now requires for embedded playback; direct YouTube iframes from `chrome-extension://` pages can fail with Error 153.
- URL playlist/list/index/start parameters are forwarded to the embed when present.
- **Full YouTube** adds a one-page bypass flag so comments, description, native playlist UI, or Aero Mix capture can still be used.
- The popup includes a **Lite watch player** switch. Turning it off falls back to the v0.4-style CSS stripping on normal YouTube watch pages.

This remains framework-free and intentionally small: no service worker, polling loop, MutationObserver, React/Vue/etc., or custom playback engine. The wrapper is a static HTML page plus a tiny script and does not load the Aero app shell.

## Install / update locally

1. Pull the latest repository.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable **Developer mode**.
4. Load the repository's `extension` folder if this is a first install.
5. For an existing install, click **Reload**.
6. Refresh any already-open YouTube tabs.

## Super Lite browsing defaults

Hidden by default on normal YouTube pages:
- left navigation / mini guide;
- homepage recommendation feed;
- Shorts shelves/results;
- filter-chip bars;
- some secondary masthead controls.

When Lite Player is disabled and the native watch page is used, Super Lite also hides related videos, comments, live chat, description, promotional shelves and end-screen recommendation cards according to the popup switches.

## Aero Mix capture

Lite Player is optimized for playback, not DOM scraping. To capture the exact visible personalized Mix order:

1. From Lite Player choose **Full YouTube**.
2. Wait for the native Mix/playlist panel to render.
3. Open the extension popup.
4. Click **Capture current Mix**.

The capture path still preserves visible row order exactly, including repeated IDs, and transfers only a compact ID list to Aero × IVE.
