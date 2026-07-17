import { NextResponse } from "next/server";

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

  if (!username) {
    return NextResponse.json({ error: "username is required" }, { status: 400 });
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    let apiUrl = `${supabaseUrl}/rest/v1/knowledge_content?username=eq.${encodeURIComponent(username)}&select=*`;
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
    return NextResponse.json({ data });
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

    if (!username || !subject || !filename || !content_text) {
      return NextResponse.json(
        { error: "username, subject, filename and content_text are required" },
        { status: 400 }
      );
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

  if (!username || !subject || !filename) {
    return NextResponse.json(
      { error: "username, subject and filename are required" },
      { status: 400 }
    );
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

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
