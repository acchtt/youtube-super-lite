# YouTube Super Lite

A lightweight YouTube player for long sessions on low-memory PCs, with local personalization from a Google Takeout export.

## Personalized mode

Import a YouTube Takeout ZIP containing History, Subscriptions and optionally Playlists. The archive is processed inside a Web Worker in the browser. The raw Takeout data is discarded after import and **never uploaded**.

The importer builds a compact local taste profile from:

- watch frequency and recency
- channel affinity
- search-history topics
- subscriptions
- playlist membership

Personalized autoplay chooses a seed from that profile, then starts a YouTube-generated Mix from the seed. Every few videos (configurable), Low-memory mode destroys the old iframe and Personalized mode chooses a new profile-aware seed.

This is intentionally an approximation of the YouTube home/Up Next algorithm. A third-party static site cannot access Google's private account recommendation ranking. The Takeout profile gives the site your taste signals without scraping or uploading your signed-in account.

## Why it is lighter

Only one YouTube iframe player is kept. The site avoids the normal youtube.com feed, comments, Shorts, notifications, infinite recommendations UI, and large application state.

## Features

- Local Takeout ZIP importer
- Personalized / YouTube Mix / Queue-only autoplay modes
- One iframe at a time
- Periodic player rebuild in Low-memory mode
- Video URL / ID / playlist input
- Custom queue with drag ordering
- Previous / next, shuffle, repeat, playback speed
- Queue/preferences in localStorage
- Taste profile in IndexedDB
- No analytics or build framework

## Takeout privacy

Takeout parsing happens in a Web Worker. JSZip is loaded on demand only while importing. The raw archive is not committed to this repository and is not sent to the site owner.

## Limitation

YouTube's actual signed-in Home and Up Next ranking is not exposed to the iframe API, so exact account-level recommendation parity is impossible without using unsupported account scraping. Super Lite instead combines your local history profile with YouTube Mix.

## License

MIT