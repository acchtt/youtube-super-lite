import { getSession, jsonResponse, assertSameOrigin, apiError } from '../_lib/session.js';

const LIMIT = 200;

export async function onRequestGet(context) {
  const session = getSession(context.request);
  try {
    const result = await context.env.DB.prepare(`
      SELECT video_id, title, channel, source, list_id, played_at
      FROM history
      WHERE client_id = ?1
      ORDER BY played_at DESC, id DESC
      LIMIT ?2
    `).bind(session.id, LIMIT).all();

    const items = (result.results || []).map(row => ({
      id: row.video_id,
      title: row.title || '',
      channel: row.channel || '',
      source: row.source || '',
      listId: row.list_id || null,
      at: row.played_at
    }));

    return jsonResponse({ ok:true, items }, 200, session.setCookie);
  } catch (error) {
    return apiError(error, session.setCookie);
  }
}

export async function onRequestPost(context) {
  const session = getSession(context.request);
  try {
    assertSameOrigin(context.request);
    const item = await context.request.json();
    if (!item || !item.id) return jsonResponse({ ok:false, error:'Missing video id' }, 400, session.setCookie);

    const now = Number(item.at) || Date.now();
    const insert = context.env.DB.prepare(`
      INSERT INTO history (client_id, video_id, title, channel, source, list_id, played_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
    `).bind(
      session.id,
      String(item.id),
      String(item.title || ''),
      String(item.channel || ''),
      String(item.source || ''),
      item.listId ? String(item.listId) : null,
      now
    );

    const trim = context.env.DB.prepare(`
      DELETE FROM history
      WHERE client_id = ?1
        AND id NOT IN (
          SELECT id FROM history
          WHERE client_id = ?1
          ORDER BY played_at DESC, id DESC
          LIMIT ?2
        )
    `).bind(session.id, LIMIT);

    await context.env.DB.batch([insert, trim]);
    return jsonResponse({ ok:true }, 200, session.setCookie);
  } catch (error) {
    return apiError(error, session.setCookie);
  }
}

export async function onRequestPut(context) {
  const session = getSession(context.request);
  try {
    assertSameOrigin(context.request);
    const body = await context.request.json();
    const items = Array.isArray(body && body.items) ? body.items.slice(0, LIMIT) : [];

    const statements = [
      context.env.DB.prepare('DELETE FROM history WHERE client_id = ?1').bind(session.id)
    ];

    for (const item of items) {
      if (!item || !item.id) continue;
      statements.push(context.env.DB.prepare(`
        INSERT INTO history (client_id, video_id, title, channel, source, list_id, played_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
      `).bind(
        session.id,
        String(item.id),
        String(item.title || ''),
        String(item.channel || ''),
        String(item.source || ''),
        item.listId ? String(item.listId) : null,
        Number(item.at) || Date.now()
      ));
    }

    await context.env.DB.batch(statements);
    return jsonResponse({ ok:true, count:items.length }, 200, session.setCookie);
  } catch (error) {
    return apiError(error, session.setCookie);
  }
}

export async function onRequestDelete(context) {
  const session = getSession(context.request);
  try {
    assertSameOrigin(context.request);
    await context.env.DB.prepare('DELETE FROM history WHERE client_id = ?1').bind(session.id).run();
    return jsonResponse({ ok:true }, 200, session.setCookie);
  } catch (error) {
    return apiError(error, session.setCookie);
  }
}
