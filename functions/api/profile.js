import { getSession, jsonResponse, assertSameOrigin, apiError } from '../_lib/session.js';

export async function onRequestGet(context) {
  const session = getSession(context.request);
  try {
    const row = await context.env.DB.prepare(
      'SELECT profile_json, updated_at FROM profiles WHERE client_id = ?1'
    ).bind(session.id).first();

    return jsonResponse({
      ok: true,
      profile: row && row.profile_json ? JSON.parse(row.profile_json) : null,
      updatedAt: row && row.updated_at || null
    }, 200, session.setCookie);
  } catch (error) {
    return apiError(error, session.setCookie);
  }
}

export async function onRequestPut(context) {
  const session = getSession(context.request);
  try {
    assertSameOrigin(context.request);
    const body = await context.request.json();
    if (!body || !body.profile) {
      return jsonResponse({ ok:false, error:'Missing profile' }, 400, session.setCookie);
    }

    const now = Date.now();
    await context.env.DB.prepare(`
      INSERT INTO profiles (client_id, profile_json, updated_at)
      VALUES (?1, ?2, ?3)
      ON CONFLICT(client_id) DO UPDATE SET
        profile_json = excluded.profile_json,
        updated_at = excluded.updated_at
    `).bind(session.id, JSON.stringify(body.profile), now).run();

    return jsonResponse({ ok:true, updatedAt:now }, 200, session.setCookie);
  } catch (error) {
    return apiError(error, session.setCookie);
  }
}

export async function onRequestDelete(context) {
  const session = getSession(context.request);
  try {
    assertSameOrigin(context.request);
    await context.env.DB.prepare('DELETE FROM profiles WHERE client_id = ?1').bind(session.id).run();
    return jsonResponse({ ok:true }, 200, session.setCookie);
  } catch (error) {
    return apiError(error, session.setCookie);
  }
}
