export function getSession(request) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(part => {
      const i = part.indexOf('=');
      if (i < 0) return ['', ''];
      return [part.slice(0, i).trim(), decodeURIComponent(part.slice(i + 1).trim())];
    }).filter(([key]) => key)
  );

  let id = cookies.yt_super_lite_sid;
  let setCookie = null;

  if (!id || !/^[a-f0-9-]{20,64}$/i.test(id)) {
    id = crypto.randomUUID();
    setCookie = [
      'yt_super_lite_sid=' + encodeURIComponent(id),
      'Path=/',
      'HttpOnly',
      'Secure',
      'SameSite=Lax',
      'Max-Age=31536000'
    ].join('; ');
  }

  return { id, setCookie };
}

export function jsonResponse(data, status = 200, setCookie = null, extraHeaders = {}) {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  if (setCookie) headers.append('Set-Cookie', setCookie);
  return new Response(JSON.stringify(data), { status, headers });
}

export function parseJson(value, fallback = null) {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch (_) { return fallback; }
}

export function assertSameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return;
  const url = new URL(request.url);
  if (origin !== url.origin) {
    const error = new Error('Cross-origin write blocked');
    error.status = 403;
    throw error;
  }
}

export function apiError(error, setCookie = null) {
  const status = Number(error && error.status) || 500;
  const message = status >= 500 ? 'Server error' : (error && error.message) || 'Request failed';
  return jsonResponse({ ok:false, error:message }, status, setCookie);
}
