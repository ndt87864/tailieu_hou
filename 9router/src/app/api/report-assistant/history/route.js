import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

function cleanString(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function buildTranscript(messages) {
  if (!Array.isArray(messages)) return "";
  return messages
    .map((message) => {
      const role = cleanString(message?.role, "unknown").toUpperCase();
      const content =
        typeof message?.content === "string"
          ? message.content
          : JSON.stringify(message?.content ?? "");
      return `${role}: ${content}`;
    })
    .join("\n\n");
}

function normalizeSession(username, session) {
  const sessionId = cleanString(session?.id);
  if (!sessionId) return null;
  const messages = Array.isArray(session?.messages) ? session.messages : [];
  const now = new Date().toISOString();

  return {
    id: sessionId,
    username,
    session_id: sessionId,
    title: cleanString(session?.title, "New Chat"),
    model: cleanString(session?.modelId || session?.model),
    messages,
    transcript: buildTranscript(messages),
    storage_url: session?.storageUrl || session?.storage_url || null,
    created_at: cleanString(session?.createdAt || session?.created_at, now),
    updated_at: cleanString(session?.updatedAt || session?.updated_at, now),
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = cleanString(searchParams.get("username"), "admin").toLowerCase();

    const { data, error } = await supabase
      .from("report_assistant_chats")
      .select("*")
      .eq("username", username)
      .order("updated_at", { ascending: false });

    if (error) {
      console.warn("[report-assistant/history] GET error from db", error);
      return NextResponse.json({ ok: false, error: String(error.message || error) }, { status: 200 });
    }

    const sessions = (data || []).map((row) => ({
      id: row.id,
      title: row.title,
      modelId: row.model,
      messages: row.messages || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({ ok: true, sessions });
  } catch (err) {
    console.error("[report-assistant/history] GET error", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 200 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { username, sessions } = body || {};
    if (!username || !Array.isArray(sessions)) {
      return NextResponse.json({ error: "username and sessions required" }, { status: 400 });
    }

    const cleanUsername = cleanString(username, "admin").toLowerCase();
    const rows = sessions
      .map((session) => normalizeSession(cleanUsername, session))
      .filter(Boolean);

    if (rows.length === 0) {
      const { error } = await supabase
        .from("report_assistant_chats")
        .delete()
        .eq("username", cleanUsername);

      if (error) {
        console.warn("[report-assistant/history] delete error", error);
        return NextResponse.json({ ok: false, warning: String(error.message || error) }, { status: 200 });
      }

      return NextResponse.json({ ok: true, data: [], count: 0 }, { status: 200 });
    }

    const { data, error } = await supabase
      .from("report_assistant_chats")
      .upsert(rows, { onConflict: "id" })
      .select("id, username, session_id, title, model, created_at, updated_at");

    if (error) {
      console.warn("[report-assistant/history] upsert error", error);
      // Do not fail client flow. Return OK with warning so assistant continues to talk.
      return NextResponse.json({ ok: false, warning: String(error.message || error) }, { status: 200 });
    }

    return NextResponse.json({ ok: true, data, count: rows.length }, { status: 200 });
  } catch (err) {
    console.error("[report-assistant/history] error", err);
    // Swallow server-side errors to avoid breaking client chat flow
    return NextResponse.json({ ok: false, warning: String(err) }, { status: 200 });
  }
}
