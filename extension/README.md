# Aero Mix Bridge

A tiny Chrome / Edge Manifest V3 companion extension for Aero × IVE.

It captures the visible personalized Mix order from youtube.com and hands only the ordered video IDs to Aero.

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

## v0.3.3 low-memory architecture

The extension has no content script, storage listener, background service worker, MutationObserver, or polling loop.

It uses only:
- `activeTab` while you click the extension;
- one `scripting.executeScript` call to read the visible Mix;
- one compact URL fragment containing the ordered video IDs.

Capture preserves the active visible playlist panel's rendered row order exactly and keeps repeated video IDs when YouTube shows them.

Aero imports the fragment into its D1-backed state and removes the fragment from the address bar. The extension is not present in the Aero tab after transfer.
