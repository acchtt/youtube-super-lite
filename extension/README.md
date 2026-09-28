# YouTube Super Lite + Aero Mix Bridge

A lightweight Chrome / Edge Manifest V3 extension for `youtube.com`.

## v0.7.1 experimental: same-origin watch takeover

This build tests the architecture selected after native YouTube's stripped watch page still measured roughly 400 MB on the first video.

For normal `youtube.com/watch?v=...` pages, a MAIN-world script runs at `document_start` and uses `document.open/write/close` to atomically replace the pending watch document **before the normal YouTube watch SPA finishes booting**. v0.7.1 replaces the fragile v0.7.0 `window.stop()` DOM mutation that could leave a blank page.

Important differences from the discarded v0.5 approach:

- the top-level page remains the real `https://www.youtube.com/watch?...` URL;
- there is no `chrome-extension://` player page;
- there is no Aero-domain wrapper;
- an official YouTube iframe is created immediately, then the IFrame API attaches to it for Mix state/control; playback therefore remains visible even if the control API initializes late;
- signed-in YouTube cookies remain available to the official player;
- a one-click **Full YouTube** / popup escape hatch reloads the same video with `aero_native=1`.

### The key experiment

Play a normal video long enough that YouTube would normally record it, then check YouTube History.

If the played item is recorded correctly, this architecture gives us the strongest path toward Aero-like memory while keeping YouTube account history. If it is not recorded, the project must choose between the full native watch runtime and a separate lightweight-player history limitation.

## Playback and Cinema

The takeover shell includes:
- one official YouTube IFrame API player;
- native player controls, settings, captions, speed and fullscreen;
- the player's native quality selector, including 1080p when YouTube offers it;
- a lightweight Cinema toggle that expands the player without loading YouTube's Theater watch shell;
- search plus direct return to YouTube;
- a Full YouTube escape hatch for non-embeddable videos or account/UI features.

The extension does not force a particular stream quality.

## Mix / playlist support

When a `list` parameter is present:
- the official player receives the list/index context;
- native playlist autoplay/Next/Previous behavior remains inside the player;
- a tiny side panel exposes Previous, Next and current position/total;
- each player state change publishes the current video/list/index back into the address bar with `history.replaceState()`;
- the player's actual ordered playlist IDs are exposed to the extension through DOM dataset state;
- **Capture current Mix** reads that ordered player queue and transfers it to Aero, preserving repeated IDs when the player reports them.

The full native playlist DOM is intentionally not loaded in takeover mode because that would defeat the memory experiment.

## Browsing

Home/search/channel pages still use the v0.4-style Super Lite CSS:
- navigation shell hidden;
- homepage feed optionally hidden;
- Shorts hidden by default;
- no background service worker, polling loop, or MutationObserver.

Video links are converted to full document navigations so the document-start takeover can run before the heavy watch page initializes.
