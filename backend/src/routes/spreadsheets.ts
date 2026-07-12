import { Hono } from "hono";
import { supabaseAdmin } from "../config/db.js";
import { requireRole } from "../middlewares/role.js";
import { cacheGetOrSet, cacheInvalidatePrefix } from "../utils/cache.js";

const spreadsheetsRouter = new Hono();

// Cho phép cả Admin và Management truy cập (Management level 90, Admin level 100)
spreadsheetsRouter.use("*", requireRole("management"));

// Helper để xóa cache liên quan đến spreadsheets khi có thay đổi dữ liệu
async function clearSpreadsheetsCache() {
  await cacheInvalidatePrefix("spreadsheets:");
}

// 1. Lấy danh sách trang tính (Có Caching)
spreadsheetsRouter.get("/", async (c) => {
  try {
    const data = await cacheGetOrSet(
      "spreadsheets:list",
      async () => {
        const { data: sheets, error } = await supabaseAdmin
          .from("spreadsheets")
          .select("id, title, created_at, updated_at, created_by")
          .order("updated_at", { ascending: false });

        if (error) {
          throw new Error(error.message);
        }
        return sheets;
      },
      30_000 // Cache 30 giây
    );

    return c.json({ data });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// 2. Lấy chi tiết trang tính (Có Caching)
spreadsheetsRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const data = await cacheGetOrSet(
      `spreadsheets:detail:${id}`,
      async () => {
        const { data: sheet, error } = await supabaseAdmin
          .from("spreadsheets")
          .select("*")
          .eq("id", id)
          .single();

        if (error) {
          throw new Error(error.message);
        }
        return sheet;
      },
      60_000 // Cache 60 giây vì chi tiết trang tính nặng hơn
    );

    return c.json({ data });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// 3. Tạo mới trang tính
spreadsheetsRouter.post("/", async (c) => {
  const user = c.get("user");
  try {
    const body = await c.req.json().catch(() => ({}));
    const title = body.title || "Trang tính chưa có tên";
    const content = body.content || { cells: {}, rowCount: 100, columnCount: 26 };

    const { data: newSheet, error } = await supabaseAdmin
      .from("spreadsheets")
      .insert({
        title,
        content,
        created_by: user?.id || null,
      })
      .select()
      .single();

    if (error) {
      return c.json({ error: error.message }, 400);
    }

    // Xóa cache
    await clearSpreadsheetsCache();

    return c.json({ data: newSheet });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// 4. Cập nhật trang tính (title và content)
spreadsheetsRouter.put("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    const updateData: any = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.content !== undefined) updateData.content = body.content;

    const { data: updatedSheet, error } = await supabaseAdmin
      .from("spreadsheets")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return c.json({ error: error.message }, 400);
    }

    // Xóa cache
    await clearSpreadsheetsCache();

    return c.json({ data: updatedSheet });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// 5. Xóa trang tính
spreadsheetsRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const { error } = await supabaseAdmin
      .from("spreadsheets")
      .delete()
      .eq("id", id);

    if (error) {
      return c.json({ error: error.message }, 400);
    }

    // Xóa cache
    await clearSpreadsheetsCache();

    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

export default spreadsheetsRouter;
