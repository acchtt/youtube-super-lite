# YouTube Super Lite + Aero Mix Bridge

A lightweight Chrome / Edge Manifest V3 extension for `youtube.com`.

## v0.8.0 experimental: direct YouTube embed mode

v0.7's same-origin document-replacement experiment was abandoned after normal videos could still become stuck loading. v0.8 removes all watch-page document surgery.

For ordinary `youtube.com/watch?v=...` URLs, the extension redirects immediately to YouTube's own top-level `https://www.youtube.com/embed/VIDEO_ID` page.

This is not an extension page and not an Aero wrapper. It is YouTube's own lightweight player document.

The acceptance tests are reliable playback, materially lower memory than the ~400 MB native watch-page baseline, signed-in YouTube History recording, and native quality controls including 1080p when YouTube offers it.

The direct embed page is already effectively Cinema mode because the player occupies the viewport.

## Mix support

Dynamic `RD...` Mix IDs are not passed to the player. The current video starts immediately as a plain embed. The extension fetches the corresponding native watch HTML as inert text with signed-in cookies, extracts ordered `playlistPanelVideoRenderer` IDs, discards the HTML, and stores the queue in session storage.

A tiny overlay provides Previous / Next / position. When the media element ends, the extension navigates to the next lightweight embed page. The same queue is exposed to **Capture current Mix**.

No fetched watch-page scripts are executed.

## Full YouTube escape hatch

The popup and embed overlay reconstruct the current native `/watch` URL with `aero_native=1`, bypassing Super Lite for comments, description, troubleshooting, or incompatible videos.

## Browsing

Home/search/channel pages keep the v0.4-style stripped interface. Clicking a video goes directly to embed mode instead of allowing YouTube's SPA to construct the full watch page.

Architecture remains plain JS/CSS with no framework, background service worker, persistent polling loop, or MutationObserver.
