import { Hono } from "hono";
import { supabaseAdmin } from "../config/db.js";
import { requireRole } from "../middlewares/role.js";
import { getCrawlerDataForDoc } from "../services/documentService.js";
import { cacheGetOrSet, cacheInvalidatePrefix } from "../utils/cache.js";

const crawlerAdminRouter = new Hono();
const CACHE_PREFIX = "docs:crawler_admin";

// Helper: chia nhỏ bulk delete thành batch để tránh giới hạn URL length của PostgREST
const CHUNK_SIZE = 100;
async function chunkDelete(table: string, ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE);
    const { error } = await supabaseAdmin.from(table).delete().in("id", chunk);
    if (error) throw error;
  }
}

// Tất cả các route này yêu cầu quyền admin (hoặc management tuỳ ý)
crawlerAdminRouter.use("*", requireRole("admin"));

crawlerAdminRouter.get("/courses", async (c) => {
  try {
    const cacheKey = `${CACHE_PREFIX}:courses`;
    const courses = await cacheGetOrSet(cacheKey, async () => {
      const { data, error } = await supabaseAdmin
        .from("crawler_courses")
        .select("*, document:documents(title)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }, 120_000); // Cache 2 phút

    return c.json({ courses });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

crawlerAdminRouter.get("/resources", async (c) => {
  try {
    const courseIdsParam = c.req.query("course_ids") || "all";
    const docIdsParam = c.req.query("document_ids");
    const cacheKey = `${CACHE_PREFIX}:resources:${courseIdsParam}:${docIdsParam || "all"}`;
    
    const resources = await cacheGetOrSet(cacheKey, async () => {
      let query = supabaseAdmin
        .from("crawler_resources")
        .select("*, course:crawler_courses(title, document_id)")
        .order("created_at", { ascending: false });
      
      if (docIdsParam) {
        const docIds = docIdsParam.split(",").filter(Boolean);
        if (docIds.length > 0) {
          // Lấy danh sách course_id thuộc các document này
          const { data: coursesData } = await supabaseAdmin
            .from("crawler_courses")
            .select("id")
            .in("document_id", docIds);
          const cIds = (coursesData || []).map((x) => x.id);
          if (cIds.length > 0) {
            query = query.in("course_id", cIds);
          } else {
            // Không tìm thấy khóa học nào khớp, trả về rỗng
            query = query.in("course_id", ["00000000-0000-0000-0000-000000000000"]);
          }
        }
      } else if (courseIdsParam !== "all") {
        const ids = courseIdsParam.split(",").filter(Boolean);
        if (ids.length > 0) query = query.in("course_id", ids);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }, 120_000); // Cache 2 phút

    return c.json({ resources });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

crawlerAdminRouter.get("/questions", async (c) => {
  try {
    const courseIdsParam = c.req.query("course_ids") || "all";
    const docIdsParam = c.req.query("document_ids");
    const cacheKey = `${CACHE_PREFIX}:questions:${courseIdsParam}:${docIdsParam || "all"}`;
    
    const questions = await cacheGetOrSet(cacheKey, async () => {
      let query = supabaseAdmin
        .from("crawler_questions")
        .select("*, course:crawler_courses(title, document_id)")
        .order("created_at", { ascending: false });
      
      if (docIdsParam) {
        const docIds = docIdsParam.split(",").filter(Boolean);
        if (docIds.length > 0) {
          // Lấy danh sách course_id thuộc các document này
          const { data: coursesData } = await supabaseAdmin
            .from("crawler_courses")
            .select("id")
            .in("document_id", docIds);
          const cIds = (coursesData || []).map((x) => x.id);
          if (cIds.length > 0) {
            query = query.in("course_id", cIds);
          } else {
            // Không tìm thấy khóa học nào khớp, trả về rỗng
            query = query.in("course_id", ["00000000-0000-0000-0000-000000000000"]);
          }
        }
      } else if (courseIdsParam !== "all") {
        const ids = courseIdsParam.split(",").filter(Boolean);
        if (ids.length > 0) query = query.in("course_id", ids);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }, 120_000); // Cache 2 phút

    return c.json({ questions });
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
    await cacheInvalidatePrefix("docs");
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
    await cacheInvalidatePrefix("docs");
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
    await cacheInvalidatePrefix("docs");
    return c.json({ success: true, message: "Course and related data deleted" });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Bulk delete (chunked để tránh giới hạn URL length của PostgREST khi có nhiều IDs)
crawlerAdminRouter.post("/courses/bulk-delete", async (c) => {
  try {
    const { ids } = await c.req.json();
    if (!ids || !Array.isArray(ids)) return c.json({ error: "Invalid ids" }, 400);
    await chunkDelete("crawler_courses", ids);
    await cacheInvalidatePrefix("docs");
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

crawlerAdminRouter.post("/resources/bulk-delete", async (c) => {
  try {
    const { ids } = await c.req.json();
    if (!ids || !Array.isArray(ids)) return c.json({ error: "Invalid ids" }, 400);
    await chunkDelete("crawler_resources", ids);
    await cacheInvalidatePrefix("docs");
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

crawlerAdminRouter.post("/questions/bulk-delete", async (c) => {
  try {
    const { ids } = await c.req.json();
    if (!ids || !Array.isArray(ids)) return c.json({ error: "Invalid ids" }, 400);
    await chunkDelete("crawler_questions", ids);
    await cacheInvalidatePrefix("docs");
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
    await cacheInvalidatePrefix("docs");
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
    await cacheInvalidatePrefix("docs");
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
    await cacheInvalidatePrefix("docs");
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

crawlerAdminRouter.post("/upload", async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body["file"];
    const folder = body["folder"] || "images";
    
    if (!file || !(file instanceof File)) {
      return c.json({ error: "No file uploaded or invalid file type" }, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type;
    const originalName = file.name;
    
    let ext = "png";
    const extMatch = originalName.match(/\.([a-zA-Z0-9]+)$/);
    if (extMatch) ext = extMatch[1];
    
    const randomId = Math.random().toString(36).substring(2, 10);
    const finalFileName = `upload_${Date.now()}_${randomId}.${ext}`;
    const filePath = `${folder}/${finalFileName}`;

    const { error } = await supabaseAdmin.storage
      .from("lms-crawler-assets")
      .upload(filePath, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) throw error;

    const { data: publicUrlData } = supabaseAdmin.storage
      .from("lms-crawler-assets")
      .getPublicUrl(filePath);

    return c.json({ success: true, url: publicUrlData.publicUrl });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

crawlerAdminRouter.post("/delete-files", async (c) => {
  try {
    const { urls } = await c.req.json();
    if (!Array.isArray(urls) || urls.length === 0) {
      return c.json({ success: true, message: "No URLs to delete" });
    }

    for (const url of urls) {
      const match = url.match(/\/storage\/v1\/object\/public\/([^\/]+)\/(.+)$/);
      if (match) {
        const bucketName = match[1];
        const filePath = match[2];
        
        const { error } = await supabaseAdmin.storage
          .from(bucketName)
          .remove([filePath]);
        if (error) {
          console.warn(`⚠️ Lỗi xóa file ${url} từ bucket:`, error.message);
        } else {
          console.log(`🗑️ Đã xóa file thành công khỏi bucket ${bucketName}: ${filePath}`);
        }
      }
    }

    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

export default crawlerAdminRouter;
