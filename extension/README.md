# Aero Mix Bridge

A tiny Chrome / Edge Manifest V3 companion extension for Aero × IVE.

It solves one specific limitation of the YouTube IFrame API: an `RD...` Mix ID does not reproduce the exact account-personalized queue shown on youtube.com.

## Install locally

1. Clone or download this repository.
2. Open `chrome://extensions` in Chrome, or `edge://extensions` in Edge.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select the repository's `extension` folder.

## Use

1. Sign into YouTube normally.
2. Open the personalized Mix / Radio on youtube.com and wait for the playlist panel to appear.
3. Click the **Aero Mix Bridge** extension icon.
4. Click **Capture current Mix**.
5. Wait for the popup to say how many songs were captured.
6. You can now close the YouTube tab.
7. Open Aero at https://aero-x-ive.pages.dev.
8. The startup screen should show **LOADED MIX** and **Play loaded songs**.

## Low-memory design

Version 0.2.1 does **no background monitoring on YouTube**. It also captures only the active visible playlist panel and sorts captured songs by YouTube's own playlist `index`, preventing stale SPA DOM nodes from scrambling the queue.

There is:
- no YouTube content script;
- no MutationObserver;
- no polling timer;
- no background service worker;
- no continuous playlist scanning.

The extension touches the YouTube tab only when you explicitly click **Capture current Mix**. It executes one short scraper, stores up to 100 video IDs/titles/channels in extension-local storage, and then stops.

This is intentionally designed so you can close the heavy youtube.com Mix tab after capture and continue playback in Aero.

## Privacy / data

The extension reads only the visible Mix playlist panel when you press the capture button. The latest snapshot is stored in browser extension storage and exposed only to `https://aero-x-ive.pages.dev`.

It does not read passwords or Google cookies and does not send the queue to a third-party server.

## YouTube watch history

Aero still uses the standard YouTube embedded player. If YouTube recognizes your signed-in session and records embed playback, those plays may appear in YouTube Watch History. The extension does not fabricate background plays or call unofficial Watch History endpoints.

## Exact order

Aero Mix Bridge treats a captured Mix as a fixed sequence. Aero's general Shuffle setting is ignored for bridged Mix playback. After upgrading from 0.2.0 to 0.2.1, recapture the Mix once so the saved snapshot comes from the active visible playlist panel.
