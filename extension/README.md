# Aero Mix Bridge

A small Chrome / Edge Manifest V3 companion extension for Aero × IVE.

It solves one specific limitation of the YouTube IFrame API: an `RD...` Mix ID does not reproduce the exact account-personalized queue that youtube.com shows. The extension reads the queue that youtube.com already generated for your signed-in browser session and sends that ordered list of video IDs to Aero.

## Install locally

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome, or `edge://extensions` in Edge.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select the repository's `extension` folder.
6. Keep the extension enabled.

## Use

1. Sign into YouTube normally.
2. Open the personalized Mix / Radio on youtube.com and wait for its right-side playlist to appear.
3. Open Aero at https://aero-x-ive.pages.dev.
4. The Aero header should change from **Mix Bridge: not connected** to **Mix Bridge: N tracks**.
5. Paste the same YouTube watch + `list=RD...` URL into Aero.
6. Aero plays the exact pasted seed first, then continues through the captured youtube.com queue in the same order.

The extension refreshes the snapshot on YouTube navigation/data updates and with a lightweight 15-second check while the YouTube tab is visible. It does not observe the entire YouTube DOM.

## Privacy / data

The extension reads only the visible Mix playlist panel on youtube.com and stores the latest captured queue locally in the browser extension storage. It sends that queue only to `https://aero-x-ive.pages.dev`.

It does not read passwords or Google cookies and does not send the queue to a third-party server.

## YouTube watch history

Aero still uses the standard YouTube embedded player. If YouTube recognizes your signed-in session and records embed playback, those plays may appear in YouTube Watch History. The extension does **not** fabricate background YouTube plays or use an unofficial endpoint to force Watch History entries.

## Low-memory design

Version 0.1.1 removes the full-page MutationObserver, the background service worker, and the tabs permission. The extension now uses direct extension storage between the YouTube and Aero content scripts and pauses polling while the YouTube tab is hidden.
