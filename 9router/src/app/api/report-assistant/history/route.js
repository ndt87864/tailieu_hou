import { NextResponse } from "next/server";
import { turso } from "@/lib/tursoClient";

export const dynamic = "force-dynamic";

function cleanString(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

/**
 * GET /api/report-assistant/history?username=...
 * Fetch last 20 chat sessions for a user from Turso.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = cleanString(searchParams.get("username"), "admin").toLowerCase();

    const result = await turso.execute({
      sql: `SELECT chat_id, title, model, messages, created_at, updated_at
            FROM report_chat_sessions
            WHERE username = ?
            ORDER BY updated_at DESC
            LIMIT 20`,
      args: [username],
    });

    const sessions = (result.rows || []).map((row) => ({
      id: row.chat_id,
      chatId: row.chat_id,
      title: row.title,
      modelId: row.model,
      messages: (() => {
        try {
          return typeof row.messages === "string" ? JSON.parse(row.messages) : (row.messages || []);
        } catch { return []; }
      })(),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({ ok: true, sessions });
  } catch (err) {
    console.error("[report-assistant/history] GET error", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 200 });
  }
}

/**
 * POST /api/report-assistant/history
 * Body: { username: string, sessions: Session[] }
 *
 * Smart sync — only writes what's necessary:
 *   • Session not in Turso yet          → INSERT
 *   • Session in Turso, client is newer → UPDATE (compare updated_at ISO strings)
 *   • Session in Turso, already current → SKIP (no write)
 *
 * This prevents client from overwriting fresher server-side data and avoids
 * unnecessary writes on every heartbeat.
 *
 * Special case: empty sessions array → delete all sessions for the user.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { username, sessions } = body || {};
    if (!username || !Array.isArray(sessions)) {
      return NextResponse.json({ error: "username and sessions required" }, { status: 400 });
    }

    const cleanUsername = cleanString(username, "admin").toLowerCase();
    const now = new Date().toISOString();

    // Empty array → delete all sessions for this user
    if (sessions.length === 0) {
      await turso.execute({
        sql: `DELETE FROM report_chat_sessions WHERE username = ?`,
        args: [cleanUsername],
      });
      return NextResponse.json({ ok: true, inserted: 0, updated: 0, skipped: 0 });
    }

    // Deduplicate & validate incoming sessions (keep latest 20)
    const rows = sessions.slice(0, 20).filter((s) => cleanString(s?.id || s?.chatId || s?.chat_id));
    if (rows.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0, updated: 0, skipped: 0 });
    }
 
    // ── Fetch existing records from Turso in one query ─────────────────────
    // Build a map of { id → stored_updated_at } for quick lookup.
    const ids = rows.map((s) => cleanString(s.id || s.chatId || s.chat_id));
    const placeholders = ids.map(() => "?").join(", ");
    const existingResult = await turso.execute({
      sql: `SELECT chat_id, updated_at FROM report_chat_sessions WHERE chat_id IN (${placeholders})`,
      args: ids,
    });
 
    /** @type {Map<string, string>} sessionId → stored updated_at */
    const storedMap = new Map(
      (existingResult.rows || []).map((r) => [String(r.chat_id), String(r.updated_at || "")])
    );
 
    // ── Compare and write only what's needed ───────────────────────────────
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
 
    for (const session of rows) {
      const sessionId = cleanString(session.id || session.chatId || session.chat_id);
      if (!sessionId) continue;
 
      const clientUpdatedAt = cleanString(session.updatedAt || session.updated_at, now);
      const clientCreatedAt = cleanString(session.createdAt || session.created_at, now);
      const storedUpdatedAt = storedMap.get(sessionId);
 
      if (storedUpdatedAt === undefined) {
        // ── New session — not in Turso yet → INSERT ──────────────────────
        await turso.execute({
          sql: `INSERT INTO report_chat_sessions (chat_id, username, title, model, messages, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [
            sessionId,
            cleanUsername,
            cleanString(session.title, "New Chat"),
            cleanString(session.modelId || session.model),
            JSON.stringify(Array.isArray(session.messages) ? session.messages : []),
            clientCreatedAt,
            clientUpdatedAt,
          ],
        });
        inserted++;
      } else if (clientUpdatedAt > storedUpdatedAt) {
        // ── Client has a newer version → UPDATE ──────────────────────────
        await turso.execute({
          sql: `UPDATE report_chat_sessions
                SET title = ?, model = ?, messages = ?, updated_at = ?
                WHERE chat_id = ?`,
          args: [
            cleanString(session.title, "New Chat"),
            cleanString(session.modelId || session.model),
            JSON.stringify(Array.isArray(session.messages) ? session.messages : []),
            clientUpdatedAt,
            sessionId,
          ],
        });
        updated++;
      } else {
        // ── Turso already has the same or newer version → skip ───────────
        skipped++;
      }
    }

    return NextResponse.json({ ok: true, inserted, updated, skipped });
  } catch (err) {
    console.error("[report-assistant/history] POST error", err);
    // Swallow server-side errors to avoid breaking client chat flow
    return NextResponse.json({ ok: false, warning: String(err) }, { status: 200 });
  }
}
