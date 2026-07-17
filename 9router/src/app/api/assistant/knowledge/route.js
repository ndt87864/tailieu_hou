import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const url = new URL(request.url);
  const username = url.searchParams.get("username") || "admin";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  try {
    // 1. List subjects (folders) in knowledge/{username}
    const { data: rootItems, error: rootError } = await supabase.storage
      .from("ai_assistant")
      .list(`knowledge/${username}`);

    if (rootError) throw rootError;

    const subjectNames = (rootItems || [])
      .filter(item => !item.id && item.name !== ".emptyFolderPlaceholder")
      .map(item => item.name);

    const filesBySubject = {};

    // 2. Fetch files for each subject in parallel
    await Promise.all(
      subjectNames.map(async (subj) => {
        const { data: fileItems, error: fileError } = await supabase.storage
          .from("ai_assistant")
          .list(`knowledge/${username}/${subj}`);

        if (!fileError && fileItems) {
          const listWithUrls = fileItems
            .filter(f => f.name !== ".emptyFolderPlaceholder")
            .map(f => {
              const { data: urlData } = supabase.storage
                .from("ai_assistant")
                .getPublicUrl(`knowledge/${username}/${subj}/${f.name}`);
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

    return NextResponse.json({
      subjects: subjectNames,
      filesBySubject
    });
  } catch (err) {
    console.error("Failed to load knowledge in backend:", err);
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

    if (!subject || !filename || !file) {
      return NextResponse.json({ error: "subject, filename, and file are required" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const filePath = `knowledge/${username}/${subject}/${filename}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data, error } = await supabase.storage
      .from("ai_assistant")
      .upload(filePath, buffer, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: true
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from("ai_assistant")
      .getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      filePath,
      fileUrl: urlData?.publicUrl || ""
    });
  } catch (err) {
    console.error("Failed to upload knowledge in backend:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const url = new URL(request.url);
    const username = url.searchParams.get("username") || "admin";
    const subject = url.searchParams.get("subject");
    const filename = url.searchParams.get("filename");

    if (!subject || !filename) {
      return NextResponse.json({ error: "subject and filename are required" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const filePath = `knowledge/${username}/${subject}/${filename}`;

    const { data, error } = await supabase.storage
      .from("ai_assistant")
      .remove([filePath]);

    if (error) throw error;

    if (!data || data.length === 0) {
      return NextResponse.json({
        error: "Không thể xóa file. Lệnh xóa bị từ chối bởi RLS Policy (DELETE) trên Supabase của bạn. Vui lòng cấp quyền DELETE cho vai trò anon/public trên bảng storage.objects."
      }, { status: 403 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to delete knowledge in backend:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
