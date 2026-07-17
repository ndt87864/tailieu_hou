import { NextResponse } from "next/server";
import { turso } from "@/lib/tursoClient";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get("chat_id") || searchParams.get("chatId");
    const username = searchParams.get("username") || "default_user"; // We will pass username from UI

    if (!chatId) {
      return NextResponse.json({ error: "Missing chat_id" }, { status: 400 });
    }

    const result = await turso.execute({
      sql: `SELECT * FROM report_sections WHERE chat_id = ? AND username = ? ORDER BY created_at ASC`,
      args: [chatId, username],
    });

    return NextResponse.json({ ok: true, data: result.rows });
  } catch (error) {
    console.error("[report-assistant/report] GET error:", error);
    return NextResponse.json({ error: String(error.message || error) }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { chat_id, username, sections } = body;

    if (!chat_id || !username || !Array.isArray(sections)) {
      return NextResponse.json({ error: "Missing chat_id, username, or sections array" }, { status: 400 });
    }

    if (sections.length === 0) {
      return NextResponse.json({ ok: true, message: "No sections to migrate" });
    }

    // Check if report already exists in Turso
    const existing = await turso.execute({
      sql: `SELECT COUNT(*) as count FROM report_sections WHERE chat_id = ? AND username = ?`,
      args: [chat_id, username],
    });
    
    if (existing.rows[0]?.count > 0) {
      return NextResponse.json({ ok: true, message: "Report already exists in Turso DB" });
    }

    // Migrate sections
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      if (!section.content || !section.content.trim()) continue;

      await turso.execute({
        sql: `
          INSERT INTO report_sections (
            id, chat_id, username, report_title, section_id, section_title, content
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          crypto.randomUUID(),
          chat_id,
          username,
          section.title || "Báo cáo Kiến tập",
          section.id || `section_${i}`,
          section.title || "",
          section.content
        ],
      });
    }

    return NextResponse.json({ ok: true, migrated: true });
  } catch (error) {
    console.error("[report-assistant/report] POST error:", error);
    return NextResponse.json({ error: String(error.message || error) }, { status: 500 });
  }
}
