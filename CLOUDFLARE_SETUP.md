# Cloudflare Pages + D1 setup

Aero × IVE is deployed with Cloudflare Pages, Pages Functions (Workers runtime), and D1.

## Current production configuration

- Repository: acchtt/youtube-super-lite
- Production branch: main
- Pages hostname: aero-x-ive.pages.dev
- D1 database: youtube-super-lite
- D1 binding variable: DB

## What is stored in D1

Persistent settings, queue, last video + timestamp, last playlist/radio, playback history, and the compact personalization profile are stored in D1.

The browser keeps an opaque HttpOnly session cookie so D1 knows which anonymous records belong to that browser.

On the first successful Cloudflare load, the frontend can migrate legacy Super Lite localStorage/IndexedDB data into D1 and then remove those legacy records.

## 1. Create the D1 database

In Cloudflare Dashboard:

1. Workers & Pages -> D1 SQL Database -> Create.
2. Name it youtube-super-lite.
3. Open its Console and run the contents of schema.sql.

## 2. Create/import the Pages project

1. Workers & Pages -> Create -> Pages -> Import an existing Git repository.
2. Choose acchtt/youtube-super-lite.
3. Use production branch main.
4. No build command is required.
5. Build output directory: .
6. Deploy.

Pages Functions in /functions run on the Workers runtime automatically.

## 3. Bind D1

In the Pages project:

1. Settings -> Bindings.
2. Add -> D1 database binding.
3. Variable name: DB
4. Database: youtube-super-lite
5. Save, then redeploy.

The API endpoints are:
- GET/PATCH /api/state
- GET/POST/PUT/DELETE /api/history
- GET /api/oauth-config

## 4. Anonymous session behavior

The application uses the HttpOnly cookie yt_super_lite_sid to associate the current browser with its D1 records.

This does not provide automatic cross-device synchronization. A login/pairing identity layer would be required for that.

## Optional Wrangler configuration

wrangler.toml.example is included if Wrangler-managed configuration is needed later. Replace the D1 database ID and rename it to wrangler.toml.


## 5. Experimental YouTube OAuth (v0.15.3)

Aero's **Connect YouTube** experiment uses Google Identity Services' browser token model with the minimum read-only YouTube scope:

`https://www.googleapis.com/auth/youtube.readonly`

The OAuth access token stays in browser memory only. Aero does not store it in D1, cookies, localStorage, or Cloudflare.

### Google Cloud configuration

1. Create or select a Google Cloud project.
2. Enable **YouTube Data API v3** for that project.
3. Configure the OAuth consent screen.
4. Create an **OAuth 2.0 Client ID** for a **Web application**.
5. Add this Authorized JavaScript origin:
   - `https://aero-x-ive.pages.dev`
6. If testing a local Pages/dev origin, add that exact origin separately.
7. Copy the resulting `*.apps.googleusercontent.com` client ID.

### Cloudflare Pages variable

In the Aero Pages project:

1. Settings -> Variables and Secrets.
2. Add a plain-text variable:
   - Name: `GOOGLE_OAUTH_CLIENT_ID`
   - Value: your Web OAuth client ID.
3. Redeploy production.

A Google OAuth **client secret is not used by this browser-token experiment**.

When configured, Aero's top bar enables **Connect YouTube**. Successful authorization is verified with the official YouTube Data API using `channels.list?part=snippet,contentDetails&mine=true`.
