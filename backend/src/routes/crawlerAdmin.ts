import { Hono } from "hono";
import { supabaseAdmin } from "../config/db.js";
import { requireRole } from "../middlewares/role.js";
import { getCrawlerDataForDoc } from "../services/documentService.js";

const crawlerAdminRouter = new Hono();

// Tất cả các route này yêu cầu quyền admin (hoặc management tuỳ ý)
crawlerAdminRouter.use("*", requireRole("admin"));

crawlerAdminRouter.get("/courses", async (c) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("crawler_courses")
      .select("*, document:documents(title)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return c.json({ courses: data });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

crawlerAdminRouter.get("/resources", async (c) => {
  try {
    const courseIdsParam = c.req.query("course_ids");
    let query = supabaseAdmin
      .from("crawler_resources")
      .select("*, course:crawler_courses(title, document_id)")
      .order("created_at", { ascending: false });
    
    if (courseIdsParam) {
      const ids = courseIdsParam.split(",").filter(Boolean);
      if (ids.length > 0) query = query.in("course_id", ids);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return c.json({ resources: data });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

crawlerAdminRouter.get("/questions", async (c) => {
  try {
    const courseIdsParam = c.req.query("course_ids");
    let query = supabaseAdmin
      .from("crawler_questions")
      .select("*, course:crawler_courses(title, document_id)")
      .order("created_at", { ascending: false });
    
    if (courseIdsParam) {
      const ids = courseIdsParam.split(",").filter(Boolean);
      if (ids.length > 0) query = query.in("course_id", ids);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return c.json({ questions: data });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Lấy toàn bộ dữ liệu crawl (course, resources, questions) của một document (Môn học)
crawlerAdminRouter.get("/doc/:documentId", async (c) => {
  try {
    const documentId = c.req.param("documentId");
    const data = await getCrawlerDataForDoc(documentId);
    
    return c.json(data);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Xóa một resource crawl cụ thể
crawlerAdminRouter.delete("/resources/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const { error } = await supabaseAdmin.from("crawler_resources").delete().eq("id", id);
    if (error) throw error;
    return c.json({ success: true, message: "Resource deleted" });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Xóa một câu hỏi crawl cụ thể
crawlerAdminRouter.delete("/questions/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const { error } = await supabaseAdmin.from("crawler_questions").delete().eq("id", id);
    if (error) throw error;
    return c.json({ success: true, message: "Question deleted" });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Xóa một course (sẽ cascade xóa luôn resources và questions theo db schema)
crawlerAdminRouter.delete("/courses/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const { error } = await supabaseAdmin.from("crawler_courses").delete().eq("id", id);
    if (error) throw error;
    return c.json({ success: true, message: "Course and related data deleted" });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Bulk delete
crawlerAdminRouter.post("/courses/bulk-delete", async (c) => {
  try {
    const { ids } = await c.req.json();
    if (!ids || !Array.isArray(ids)) return c.json({ error: "Invalid ids" }, 400);
    const { error } = await supabaseAdmin.from("crawler_courses").delete().in("id", ids);
    if (error) throw error;
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

crawlerAdminRouter.post("/resources/bulk-delete", async (c) => {
  try {
    const { ids } = await c.req.json();
    if (!ids || !Array.isArray(ids)) return c.json({ error: "Invalid ids" }, 400);
    const { error } = await supabaseAdmin.from("crawler_resources").delete().in("id", ids);
    if (error) throw error;
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

crawlerAdminRouter.post("/questions/bulk-delete", async (c) => {
  try {
    const { ids } = await c.req.json();
    if (!ids || !Array.isArray(ids)) return c.json({ error: "Invalid ids" }, 400);
    const { error } = await supabaseAdmin.from("crawler_questions").delete().in("id", ids);
    if (error) throw error;
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Updates
crawlerAdminRouter.put("/courses/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { error } = await supabaseAdmin.from("crawler_courses").update(body).eq("id", id);
    if (error) throw error;
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

crawlerAdminRouter.put("/resources/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { error } = await supabaseAdmin.from("crawler_resources").update(body).eq("id", id);
    if (error) throw error;
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

crawlerAdminRouter.put("/questions/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { error } = await supabaseAdmin.from("crawler_questions").update(body).eq("id", id);
    if (error) throw error;
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

export default crawlerAdminRouter;
