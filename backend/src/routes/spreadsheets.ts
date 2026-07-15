import { Hono } from "hono";
import { supabaseAdmin } from "../config/db.js";
import { requireRole } from "../middlewares/role.js";
import { cacheGetOrSet, cacheInvalidatePrefix } from "../utils/cache.js";

type Env = {
  Variables: {
    user: any;
  };
};

const spreadsheetsRouter = new Hono<Env>();

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
          .select("id, title, created_at, updated_at, created_by, isStarred:content->isStarred")
          .order("updated_at", { ascending: false });

        if (error) {
          throw new Error(error.message);
        }

        return (sheets || []).map((s: any) => {
          return {
            id: s.id,
            title: s.title,
            created_at: s.created_at,
            updated_at: s.updated_at,
            created_by: s.created_by,
            content: {
              isStarred: !!s.isStarred
            }
          };
        });
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
    let content = body.content || { sheets: [{ name: "Sheet1", cells: {}, rowCount: 500, colCount: 26, isVip: false }] };

    // Tối ưu hóa: Nếu frontend gửi yêu cầu tạo kèm VIP templates qua mảng tên
    if (body.vipTemplateNames && Array.isArray(body.vipTemplateNames) && body.vipTemplateNames.length > 0) {
      const { data: templates, error: tError } = await supabaseAdmin
        .from("vip_sheet_templates")
        .select("content")
        .in("name", body.vipTemplateNames);

      if (!tError && templates && templates.length > 0) {
        content = {
          sheets: templates.map((t: any) => ({
            ...t.content,
            isVip: true
          }))
        };
      }
    }

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
    if (body.content !== undefined) {
      const { data: oldSheet } = await supabaseAdmin
        .from("spreadsheets")
        .select("content")
        .eq("id", id)
        .single();
      const oldContent = oldSheet?.content || {};
      updateData.content = { ...oldContent, ...body.content };
    }

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

// 6. Lấy danh sách VIP templates
spreadsheetsRouter.get("/vip-templates/list", async (c) => {
  try {
    const { data: templates, error } = await supabaseAdmin
      .from("vip_sheet_templates")
      .select("id, name")
      .order("created_at", { ascending: false });

    if (error) {
      return c.json({ error: error.message }, 400);
    }
    return c.json({ data: templates });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// 7. Tạo hoặc cập nhật VIP template
spreadsheetsRouter.post("/vip-templates", async (c) => {
  try {
    const body = await c.req.json();
    const { name, content } = body;
    if (!name || !content) {
      return c.json({ error: "Missing name or content" }, 400);
    }

    const { data, error } = await supabaseAdmin
      .from("vip_sheet_templates")
      .upsert({ name, content, updated_at: new Date().toISOString() }, { onConflict: "name" })
      .select()
      .single();

    if (error) {
      return c.json({ error: error.message }, 400);
    }
    return c.json({ data });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// 8. Xóa VIP template theo name
spreadsheetsRouter.delete("/vip-templates/name/:name", async (c) => {
  const name = c.req.param("name");
  try {
    const { error } = await supabaseAdmin
      .from("vip_sheet_templates")
      .delete()
      .eq("name", name);

    if (error) {
      return c.json({ error: error.message }, 400);
    }
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

export default spreadsheetsRouter;
