import { NextResponse } from "next/server";
import { getAdapter } from "@/lib/db/driver";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/db/sync — Trả về trạng thái DB hiện tại (dùng để debug)
export async function GET() {
  try {
    const db = await getAdapter();
    const tables = ["providerConnections", "settings", "apiKeys", "combos", "kv", "providerNodes", "proxyPools"];
    const state = {};
    for (const t of tables) {
      try {
        const rows = await db.all(`SELECT * FROM "${t}"`);
        state[t] = { count: rows.length };
        if (t === "providerConnections") {
          state[t].providers = rows.map(r => ({
            id: r.id?.slice(0, 8),
            provider: r.provider,
            isActive: r.isActive,
            hasData: !!r.data && r.data !== '{}'
          }));
        }
      } catch (e) {
        state[t] = { error: e.message };
      }
    }
    return NextResponse.json({
      ok: true,
      username: db.username,
      driver: db.driver,
      tables: state
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/db/sync — No-op khi dùng Supabase trực tiếp
export async function POST() {
  const db = await getAdapter();
  if (db.driver === "supabase") {
    return NextResponse.json({
      success: true,
      message: "Đang dùng Supabase trực tiếp — không cần đồng bộ thủ công.",
      driver: "supabase"
    });
  }

  return NextResponse.json(
    { error: "Chức năng đồng bộ chỉ khả dụng khi cấu hình Supabase." },
    { status: 400 }
  );
}
