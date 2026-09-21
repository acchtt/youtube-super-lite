# YouTube Super Lite

A tiny, dependency-free YouTube queue/player designed for long playback sessions on low-memory PCs.

## Why it is lighter

The site keeps only one YouTube iframe player and avoids the heavy parts of youtube.com: home feed, comments, Shorts, notifications, endless recommendations, and large client-side application state.

**Low-memory mode** periodically destroys and recreates the player after a configurable number of completed videos. This is meant to release playback state that may accumulate during long sessions.

## Features

- Paste a YouTube video URL, raw video ID, or playlist URL
- Paste multiple video links and build a queue
- Autoplay next
- Previous / next
- Shuffle
- Repeat one / repeat queue
- Playback speed
- Drag to reorder the custom queue
- Queue and preferences saved in localStorage
- Keyboard shortcuts
- Responsive dark interface
- No frameworks, build step, analytics, or API key
- One embedded player at a time

## Important limitations

- The first playback normally needs a user click because browsers restrict autoplay with sound.
- Playlist URLs can be played directly, but they are not expanded into the custom queue because doing that reliably requires YouTube Data API access.
- This project still uses YouTube's official iframe player, so the player itself has YouTube's normal memory cost. The goal is to remove the much heavier surrounding youtube.com interface.
- Individual videos can disable embedding, in which case the player will show an error.

## Local use

Serve the repository with any static HTTP server. For example:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## GitHub Pages

The repository includes a Pages workflow. Once Pages is enabled for GitHub Actions, pushes to `main` deploy automatically.

## Privacy

This site contains no analytics. YouTube receives the normal requests required by its embedded player.

## License

MIT