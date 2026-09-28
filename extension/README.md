# YouTube Super Lite + Aero Mix Bridge

## v0.9.0 experimental — native Mobile Web

Direct embed mode is retired after a normal video returned YouTube error 152-4.

v0.9 routes desktop watch URLs to native `m.youtube.com/watch` and uses a Manifest V3 network rule to send a mobile Android Chrome User-Agent to that host. The goal is to keep a real signed-in YouTube watch page and history path while avoiding the heavier desktop watch SPA.

Video/list/index/timestamp parameters are preserved. Video-link navigation is forced through a fresh page, and a mobile SPA transition to a different video/list/index is reloaded once to discard accumulated track state.

Cinema mode is CSS-only around the native mobile player. YouTube remains responsible for playback controls and available quality levels.

Mix playback stays native. **Capture current Mix** reads rendered watch links and, when available, playlist IDs contained in the page's initial YouTube data.

The popup includes an **Open desktop YouTube page** escape hatch using `aero_native=1`.

Acceptance tests:
1. plain video playback;
2. first-video RAM versus the ~400 MB desktop baseline;
3. normal signed-in YouTube History;
4. 1080p availability where expected;
5. native Mix Next/Previous/autoplay/order.
