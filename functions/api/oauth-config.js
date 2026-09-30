const YOUTUBE_READONLY_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';

export async function onRequestGet(context) {
  const clientId = String(context.env.GOOGLE_OAUTH_CLIENT_ID || '').trim();

  return new Response(JSON.stringify({
    ok: true,
    enabled: Boolean(clientId),
    clientId,
    scope: YOUTUBE_READONLY_SCOPE
  }), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}
