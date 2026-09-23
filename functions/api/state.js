import { getSession, jsonResponse, parseJson, assertSameOrigin, apiError } from '../_lib/session.js';

export async function onRequestGet(context) {
  const session = getSession(context.request);
  try {
    const row = await context.env.DB.prepare(
      'SELECT settings_json, last_video_json, updated_at FROM app_state WHERE client_id = ?1'
    ).bind(session.id).first();

    return jsonResponse({
      ok: true,
      settings: parseJson(row && row.settings_json, {}),
      lastVideo: parseJson(row && row.last_video_json, null),
      updatedAt: row && row.updated_at || null
    }, 200, session.setCookie);
  } catch (error) {
    return apiError(error, session.setCookie);
  }
}

export async function onRequestPatch(context) {
  const session = getSession(context.request);
  try {
    assertSameOrigin(context.request);
    const body = await context.request.json();

    const settings = Object.prototype.hasOwnProperty.call(body, 'settings')
      ? JSON.stringify(body.settings || {})
      : null;
    const lastVideo = Object.prototype.hasOwnProperty.call(body, 'lastVideo')
      ? JSON.stringify(body.lastVideo || null)
      : null;
    const now = Date.now();

    await context.env.DB.prepare(`
      INSERT INTO app_state (client_id, settings_json, last_video_json, updated_at)
      VALUES (?1, ?2, ?3, ?4)
      ON CONFLICT(client_id) DO UPDATE SET
        settings_json = CASE WHEN ?2 IS NULL THEN app_state.settings_json ELSE ?2 END,
        last_video_json = CASE WHEN ?3 IS NULL THEN app_state.last_video_json ELSE ?3 END,
        updated_at = ?4
    `).bind(session.id, settings, lastVideo, now).run();

    return jsonResponse({ ok:true, updatedAt:now }, 200, session.setCookie);
  } catch (error) {
    return apiError(error, session.setCookie);
  }
}
