# Aero Mix Bridge

A tiny Chrome / Edge Manifest V3 companion extension for Aero × IVE.

It captures the visible personalized Mix order from youtube.com without leaving any extension code attached to Aero.

## Install locally

1. Clone or download this repository.
2. Open `chrome://extensions` in Chrome, or `edge://extensions` in Edge.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select the repository's `extension` folder.

## Use

1. Sign into YouTube normally.
2. Open the personalized Mix / Radio on youtube.com and wait for the playlist panel to appear.
3. Click **Aero Mix Bridge**.
4. Click **Capture current Mix**.
5. Aero opens automatically with the captured order.
6. Close the YouTube tab and use **Play loaded songs** in Aero.

## v0.3.0 low-memory architecture

The extension has no content script on Aero and no storage listener.

It uses only:
- `activeTab` while you click the extension;
- one `scripting.executeScript` call to read the visible YouTube Mix;
- one compact URL fragment containing only the ordered video IDs.

Aero imports that fragment, stores the compact snapshot through its existing D1 state, then removes the fragment from the address bar. The extension is no longer present in the Aero tab at all.

There is no YouTube MutationObserver, polling timer, service worker, continuous scanning, or Aero extension execution.

## Exact order

Capture uses only the active visible playlist panel and sorts by YouTube's own playlist index. Aero treats the result as a fixed ordered queue and ignores the general Shuffle option for that captured Mix.

## YouTube watch history

Aero still uses the standard YouTube embedded player. Watch-history recording remains dependent on YouTube recognizing the browser session.
