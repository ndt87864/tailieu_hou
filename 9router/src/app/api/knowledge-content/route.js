import { NextResponse } from "next/server";
import { getDashboardAuthSession } from "@/lib/auth/dashboardSession";
import { isRestrictedUser, isRestrictedReportAssistantSubject } from "@/lib/userResourceMapping";

const CACHE_TTL_MS = Number.parseInt(process.env.KNOWLEDGE_CONTENT_CACHE_TTL_MS || "1800000", 10);
const memoryCache = globalThis.__knowledgeContentRouteCache || new Map();
globalThis.__knowledgeContentRouteCache = memoryCache;

function getCacheKey(username, includeContent, subject = "", filename = "", scope = "full") {
  return [
    String(username || "admin").toLowerCase(),
    String(scope || "full").toLowerCase(),
    includeContent ? "full" : "meta",
    subject || "__all__",
    filename || "",
  ].join("|");
}

function readCache(username, includeContent, subject = "", filename = "", scope = "full") {
  const cached = memoryCache.get(getCacheKey(username, includeContent, subject, filename, scope));
  if (!cached || cached.expiresAt <= Date.now()) return null;
  return cached.data;
}

function writeCache(username, includeContent, subject = "", filename = "", data, scope = "full") {
  if (!Number.isFinite(CACHE_TTL_MS) || CACHE_TTL_MS <= 0) return;
  memoryCache.set(getCacheKey(username, includeContent, subject, filename, scope), {
    expiresAt: Date.now() + CACHE_TTL_MS,
    data: Array.isArray(data) ? data : [],
  });
}

function clearUserCache(username) {
  const normalized = String(username || "admin").toLowerCase();
  for (const key of memoryCache.keys()) {
    if (key.startsWith(`${normalized}|`)) memoryCache.delete(key);
  }
}

function filterRows(rows, subject, filename) {
  return (rows || []).filter((row) => {
    if (subject && row.subject !== subject) return false;
    if (filename && row.filename !== filename) return false;
    return true;
  });
}

/**
 * GET /api/knowledge-content?username=xxx&subject=yyy&filename=zzz
 * Returns the extracted text content for a knowledge file.
 *
 * GET /api/knowledge-content?username=xxx
 * Returns all content entries for a user.
 */
export async function GET(request) {
  const url = new URL(request.url);
  const username = url.searchParams.get("username");
  const subject = url.searchParams.get("subject");
  const filename = url.searchParams.get("filename");
  const includeContent = url.searchParams.get("includeContent") === "1" || url.searchParams.get("content") === "1";
  const authToken = request.cookies.get("auth_token")?.value || null;
  const session = authToken ? await getDashboardAuthSession(authToken) : null;
  const restricted = isRestrictedUser(session?.username);
  const cacheScope = restricted ? "restricted" : "full";

  if (!username) {
    return NextResponse.json({ error: "username is required" }, { status: 400 });
  }
  if (restricted && subject && !isRestrictedReportAssistantSubject(subject)) {
    return NextResponse.json({ error: "Restricted accounts can only use el67, sl06, and sl07." }, { status: 403 });
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const selectColumns = includeContent || subject || filename
      ? "*"
      : "id,username,subject,filename,page_count,file_url,updated_at";

    const cached = readCache(username, includeContent || !!subject || !!filename, subject, filename, cacheScope);
    if (cached) {
      return NextResponse.json({ data: cached, cache: "memory" });
    }

    let apiUrl = `${supabaseUrl}/rest/v1/knowledge_content?username=eq.${encodeURIComponent(username)}&select=${encodeURIComponent(selectColumns)}`;
    if (subject) apiUrl += `&subject=eq.${encodeURIComponent(subject)}`;
    if (filename) apiUrl += `&filename=eq.${encodeURIComponent(filename)}`;

    const res = await fetch(apiUrl, {
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }

    const data = await res.json();
    const rows = Array.isArray(data) ? data : [];
    const filteredRows = restricted
      ? rows.filter((row) => isRestrictedReportAssistantSubject(row?.subject))
      : rows;
    writeCache(username, includeContent || !!subject || !!filename, subject, filename, filteredRows, cacheScope);
    return NextResponse.json({ data: filteredRows });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/knowledge-content
 * Body: { username, subject, filename, content_text, page_count, file_url }
 * Upserts the extracted text content for a knowledge file.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { username, subject, filename, content_text, page_count, file_url } = body;
    const authToken = request.cookies.get("auth_token")?.value || null;
    const session = authToken ? await getDashboardAuthSession(authToken) : null;
    const restricted = isRestrictedUser(session?.username);

    if (!username || !subject || !filename || !content_text) {
      return NextResponse.json(
        { error: "username, subject, filename and content_text are required" },
        { status: 400 }
      );
    }
    if (restricted && !isRestrictedReportAssistantSubject(subject)) {
      return NextResponse.json({ error: "Restricted accounts can only use el67, sl06, and sl07." }, { status: 403 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const payload = {
      username,
      subject,
      filename,
      content_text,
      page_count: page_count || 0,
      file_url: file_url || "",
      updated_at: new Date().toISOString(),
    };

    const res = await fetch(`${supabaseUrl}/rest/v1/knowledge_content`, {
      method: "POST",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }

    clearUserCache(username);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/knowledge-content?username=xxx&subject=yyy&filename=zzz
 * Deletes content entry for a specific knowledge file.
 */
export async function DELETE(request) {
  const url = new URL(request.url);
  const username = url.searchParams.get("username");
  const subject = url.searchParams.get("subject");
  const filename = url.searchParams.get("filename");
  const authToken = request.cookies.get("auth_token")?.value || null;
  const session = authToken ? await getDashboardAuthSession(authToken) : null;
  const restricted = isRestrictedUser(session?.username);

  if (!username || !subject || !filename) {
    return NextResponse.json(
      { error: "username, subject and filename are required" },
      { status: 400 }
    );
  }
  if (restricted && !isRestrictedReportAssistantSubject(subject)) {
    return NextResponse.json({ error: "Restricted accounts can only use el67, sl06, and sl07." }, { status: 403 });
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const apiUrl = `${supabaseUrl}/rest/v1/knowledge_content?username=eq.${encodeURIComponent(username)}&subject=eq.${encodeURIComponent(subject)}&filename=eq.${encodeURIComponent(filename)}`;

    const res = await fetch(apiUrl, {
      method: "DELETE",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }

    clearUserCache(username);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
