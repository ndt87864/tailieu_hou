import { Hono } from "hono";
import { requireRole } from "../middlewares/role.js";
import * as docService from "../services/documentService.js";
import type { UserRole } from "../types/index.js";
import { checkFullAccess, getQuestionRatios } from "../middlewares/questionLimit.js";
import { supabaseAdmin } from "../config/db.js";
import { cacheGetOrSet, cacheInvalidate } from "../utils/cache.js";

type Env = {
  Variables: {
    user: any;
    role: UserRole;
  };
};

const docsRouter = new Hono<Env>();

/** Trả về true nếu role là premium (plus/pro/ultra/management/admin) */
const isPremium = (role?: string): boolean =>
  ["plus", "pro", "ultra", "management", "admin"].includes(role ?? "");

docsRouter.get("/", async (c) => {
  try {
    const categoryId = c.req.query("category_id");
    const dbMode = c.req.query("db_mode") || "questions";
    if (dbMode === "off") {
      return c.json({ documents: [] });
    }
    if (dbMode === "question_crawler") {
      const cacheKey = "docs:crawler_courses";
      const documents = await cacheGetOrSet(
        cacheKey,
        async () => {
          const { data, error } = await supabaseAdmin
            .from("crawler_courses")
            .select("id, title");
          if (error) throw error;
          return (data || []).map((course: any) => ({
            id: course.id,
            title: course.title,
            premium: false,
            active: true
          }));
        },
        10 * 60 * 1000 // 10 phút
      );
      return c.json({ documents });
    }
    // Lấy role từ JWT payload (được gắn bởi requireRole middleware hoặc middleware auth)
    const userRole = (c.get("role") as UserRole | undefined);
    const documents = await docService.listDocuments(categoryId, isPremium(userRole));
    return c.json({ documents });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

docsRouter.get("/grouped", async (c) => {
  try {
    const userRole = (c.get("role") as UserRole | undefined);
    const full = c.req.query("full") === "true";
    const categories = full
      ? await docService.getGroupedDocumentsFull(isPremium(userRole))
      : await docService.getGroupedDocumentsPreview(isPremium(userRole));
    return c.json({ categories });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

docsRouter.get("/grouped/lms", async (c) => {
  try {
    const userRole = (c.get("role") as UserRole | undefined);
    const categories = await docService.getGroupedDocumentsLMS(isPremium(userRole));
    return c.json({ categories });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

docsRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const document = await docService.getDocumentById(id);
  if (!document) {
    return c.json({ error: "Document not found" }, 404);
  }
  return c.json({ document });
});

docsRouter.get("/:id/lessons", async (c) => {
  try {
    const id = c.req.param("id");
    const userRole = (c.get("role") as UserRole | undefined);
    
    const document = await docService.getDocumentById(id);
    if (!document) {
      return c.json({ error: "Document not found" }, 404);
    }

    const isPremiumUser = ["plus", "pro", "ultra", "management", "admin"].includes(userRole ?? "");
    if (document.premium && !isPremiumUser) {
      return c.json({ error: "Tài liệu này chỉ dành cho tài khoản Premium", isPremiumLocked: true }, 403);
    }

    const crawlerData = await docService.getCrawlerDataForDoc(id);
    return c.json({
      document,
      ...crawlerData
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

docsRouter.get("/:id/lessons/metadata", async (c) => {
  try {
    const id = c.req.param("id");
    const userRole = (c.get("role") as UserRole | undefined);
    
    const document = await docService.getDocumentById(id);
    if (!document) {
      return c.json({ error: "Document not found" }, 404);
    }

    const isPremiumUser = ["plus", "pro", "ultra", "management", "admin"].includes(userRole ?? "");
    if (document.premium && !isPremiumUser) {
      return c.json({ error: "Tài liệu này chỉ dành cho tài khoản Premium", isPremiumLocked: true }, 403);
    }

    const metadata = await docService.getCrawlerDataMetadata(id);
    return c.json({
      document,
      ...metadata
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

docsRouter.get("/:id/lessons/resources", async (c) => {
  try {
    const id = c.req.param("id");
    const userRole = (c.get("role") as UserRole | undefined);
    
    const document = await docService.getDocumentById(id);
    if (!document) {
      return c.json({ error: "Document not found" }, 404);
    }

    const isPremiumUser = ["plus", "pro", "ultra", "management", "admin"].includes(userRole ?? "");
    if (document.premium && !isPremiumUser) {
      return c.json({ error: "Tài liệu này chỉ dành cho tài khoản Premium", isPremiumLocked: true }, 403);
    }

    const result = await docService.getCrawlerResourcesFiltered(id);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

docsRouter.get("/:id/lessons/questions", async (c) => {
  try {
    const id = c.req.param("id");
    const role = (c.get("role") as UserRole | undefined) || "guest";
    const user = c.get("user");
    
    const document = await docService.getDocumentById(id);
    if (!document) {
      return c.json({ error: "Document not found" }, 404);
    }

    const isPremiumUser = ["plus", "pro", "ultra", "management", "admin"].includes(role);
    if (document.premium && !isPremiumUser) {
      return c.json({ error: "Tài liệu này chỉ dành cho tài khoản Premium", isPremiumLocked: true }, 403);
    }



    // Helper to extract week number from string (e.g. "Tuần 2 - ..." -> 2)
    const getWeekNumber = (weekName: string): number => {
      if (!weekName) return 999;
      const match = weekName.match(/Tuần\s+(\d+)/i);
      return match ? parseInt(match[1], 10) : 999;
    };

    const isBypass = process.env.BYPASS_QUESTION_LIMIT === "true";

    // Run all database calls in parallel to achieve sub-second latency
    const [allQuestions, hasFullAccess, ratios] = await Promise.all([
      docService.getCrawlerQuestionsFiltered(id),
      isBypass ? true : checkFullAccess(role, user, id),
      getQuestionRatios()
    ]);
    const questions = allQuestions;

    // Sort allQuestions so that smaller weeks come first (getting unlocked first)
    // and larger/later weeks get pushed to the end (getting locked first)
    allQuestions.sort((a, b) => {
      const wa = getWeekNumber(a.week_name);
      const wb = getWeekNumber(b.week_name);
      return wa - wb;
    });

    let allowedIds = new Set<string>();
    let limitApplied = false;
    let limitCount = allQuestions.length;

    if (!hasFullAccess) {
      const targetRole = role === "guest" ? "free" : role;
      const limitRatio = ratios[targetRole] !== undefined ? ratios[targetRole] : 20;

      limitCount = Math.max(1, Math.round(allQuestions.length * (limitRatio / 100)));
      limitApplied = true;

      const allowedQuestions = allQuestions.slice(0, limitCount);
      allowedIds = new Set(allowedQuestions.map(q => q.id));
    }

    // Apply the limit by filtering only allowed questions
    const processedQuestions = questions.filter((q: any) => {
      return hasFullAccess || allowedIds.has(q.id);
    });

    return c.json({
      questions: processedQuestions,
      limitApplied,
      limitCount,
      totalCount: allQuestions.length,
      totalFilteredCount: questions.length
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

docsRouter.post("/", requireRole("management"), async (c) => {
  try {
    const body = await c.req.json();
    const { title, description, category_id } = body;
    const document = await docService.createDocument({ title, description, category_id });
    return c.json({ document }, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

docsRouter.put("/:id", requireRole("management"), async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { title, description, category_id, active, premium } = body;
    const document = await docService.updateDocument(id, { title, description, category_id, active, premium });
    if (!document) {
      return c.json({ error: "Document not found or update failed" }, 404);
    }
    return c.json({ document });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

docsRouter.patch("/:id", requireRole("management"), async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const document = await docService.updateDocument(id, body);
    if (!document) {
      return c.json({ error: "Document not found or update failed" }, 404);
    }
    return c.json({ document });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

docsRouter.delete("/:id", requireRole("management"), async (c) => {
  const id = c.req.param("id");
  const success = await docService.deleteDocument(id);
  if (!success) {
    return c.json({ error: "Delete failed" }, 400);
  }
  return c.json({ success: true, message: "Document deleted successfully" });
});

export default docsRouter;
