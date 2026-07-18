import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { getDashboardAuthSession } from "@/lib/auth/dashboardSession";
import { isRestrictedUser, isRestrictedReportAssistantSubject } from "@/lib/userResourceMapping";

export const dynamic = "force-dynamic";

if (!global._knowledgeCache) {
  global._knowledgeCache = new Map();
}
const CACHE_TTL = 60000; // 60 seconds cache

export async function GET(request) {
  const url = new URL(request.url);
  const username = url.searchParams.get("username") || "admin";
  const type = url.searchParams.get("type") || "outlines"; // 'outlines' or 'templates'
  const authToken = request.cookies.get("auth_token")?.value || null;
  const session = authToken ? await getDashboardAuthSession(authToken) : null;
  const restricted = isRestrictedUser(session?.username);

  const cacheKey = `${username}:${type}:${restricted}`;
  const cached = global._knowledgeCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return NextResponse.json(cached.data);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  try {
    // 1. List subjects (folders) in report_assistant under {type}/{username}
    const { data: rootItems, error: rootError } = await supabase.storage
      .from("report_assistant")
      .list(`${type}/${username}`);

    if (rootError) throw rootError;

    const subjectNames = (rootItems || [])
      .filter(item => !item.id && item.name !== ".emptyFolderPlaceholder")
      .map(item => item.name)
      .filter((subject) => !restricted || isRestrictedReportAssistantSubject(subject));

    const filesBySubject = {};

    // 2. Fetch files for each subject in parallel
    await Promise.all(
      subjectNames.map(async (subj) => {
        const { data: fileItems, error: fileError } = await supabase.storage
          .from("report_assistant")
          .list(`${type}/${username}/${subj}`);

        if (!fileError && fileItems) {
          const listWithUrls = fileItems
            .filter(f => f.name !== ".emptyFolderPlaceholder")
            .map(f => {
              const { data: urlData } = supabase.storage
                .from("report_assistant")
                .getPublicUrl(`${type}/${username}/${subj}/${f.name}`);
              return {
                ...f,
                url: urlData?.publicUrl || ""
              };
            });
          filesBySubject[subj] = listWithUrls;
        } else {
          filesBySubject[subj] = [];
        }
      })
    );

    const resultData = {
      subjects: subjectNames,
      filesBySubject
    };
    global._knowledgeCache.set(cacheKey, {
      timestamp: Date.now(),
      data: resultData
    });

    return NextResponse.json(resultData);
  } catch (err) {
    console.error("Failed to load report knowledge in backend:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const username = formData.get("username") || "admin";
    const subject = formData.get("subject");
    const filename = formData.get("filename");
    const file = formData.get("file");
    const type = formData.get("type") || "outlines"; // 'outlines' or 'templates'
    const authToken = request.cookies.get("auth_token")?.value || null;
    const session = authToken ? await getDashboardAuthSession(authToken) : null;
    const restricted = isRestrictedUser(session?.username);

    if (!subject || !filename || !file) {
      return NextResponse.json({ error: "subject, filename, and file are required" }, { status: 400 });
    }
    if (restricted && !isRestrictedReportAssistantSubject(subject)) {
      return NextResponse.json({ error: "Restricted accounts can only use el67, sl06, and sl07." }, { status: 403 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const filePath = `${type}/${username}/${subject}/${filename}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data, error } = await supabase.storage
      .from("report_assistant")
      .upload(filePath, buffer, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: true
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from("report_assistant")
      .getPublicUrl(filePath);

    // Invalidate cache
    global._knowledgeCache?.clear();

    return NextResponse.json({
      success: true,
      filePath,
      fileUrl: urlData?.publicUrl || ""
    });
  } catch (err) {
    console.error("Failed to upload report knowledge in backend:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const url = new URL(request.url);
    const username = url.searchParams.get("username") || "admin";
    const subject = url.searchParams.get("subject");
    const filename = url.searchParams.get("filename");
    const type = url.searchParams.get("type") || "outlines"; // 'outlines' or 'templates'
    const authToken = request.cookies.get("auth_token")?.value || null;
    const session = authToken ? await getDashboardAuthSession(authToken) : null;
    const restricted = isRestrictedUser(session?.username);

    if (!subject || !filename) {
      return NextResponse.json({ error: "subject and filename are required" }, { status: 400 });
    }
    if (restricted && !isRestrictedReportAssistantSubject(subject)) {
      return NextResponse.json({ error: "Restricted accounts can only use el67, sl06, and sl07." }, { status: 403 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const filePath = `${type}/${username}/${subject}/${filename}`;

    const { data, error } = await supabase.storage
      .from("report_assistant")
      .remove([filePath]);

    if (error) throw error;

    if (!data || data.length === 0) {
      return NextResponse.json({
        error: "Không thể xóa file. Lệnh xóa bị từ chối bởi RLS Policy (DELETE) trên Supabase của bạn. Vui lòng cấp quyền DELETE cho vai trò anon/public trên bảng storage.objects."
      }, { status: 403 });
    }

    // Invalidate cache
    global._knowledgeCache?.clear();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to delete report knowledge in backend:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
