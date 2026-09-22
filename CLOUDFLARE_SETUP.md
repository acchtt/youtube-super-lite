# Cloudflare Pages + D1 setup

This branch is prepared for Cloudflare Pages with Pages Functions (Workers runtime) and D1.

## What moves off the browser

Persistent settings, queue, last video + timestamp, last playlist/radio, playback history, and the compact Takeout personalization profile are stored in D1. The browser keeps only an opaque HttpOnly session cookie so D1 knows which anonymous record belongs to this browser.

On the first successful Cloudflare load, the frontend migrates the old Super Lite localStorage/IndexedDB data into D1, then removes those legacy browser records.

## 1. Create the D1 database

In Cloudflare Dashboard:

1. Workers & Pages -> D1 SQL Database -> Create.
2. Name it `youtube-super-lite`.
3. Open its Console and run the contents of `schema.sql`.

## 2. Create the Pages project

1. Workers & Pages -> Create -> Pages -> Import an existing Git repository.
2. Choose `acchtt/youtube-super-lite`.
3. Use production branch `cloudflare-pages`.
4. No build command is required.
5. Build output directory: `.`
6. Deploy.

Pages Functions in `/functions` run on the Workers runtime automatically.

## 3. Bind D1

In the Pages project:

1. Settings -> Bindings.
2. Add -> D1 database binding.
3. Variable name: `DB`
4. Database: `youtube-super-lite`
5. Save, then redeploy.

The API endpoints are:
- `GET/PATCH /api/state`
- `GET/POST/PUT/DELETE /api/history`
- `GET/PUT/DELETE /api/profile`

## 4. pages.dev address

The Pages project receives `<project-name>.pages.dev`.

Choose the project name carefully. Cloudflare currently does not support changing an existing `*.pages.dev` subdomain; to change that hostname you need a new Pages project. You can add or change a custom domain later without changing the app code.

## Optional Wrangler configuration

`wrangler.toml.example` is included if you later want Wrangler-managed configuration. Replace the D1 database ID and rename it to `wrangler.toml`.
