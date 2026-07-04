import { Hono } from "hono";
import { requireRole } from "../middlewares/role.js";
import { questionLimitMiddleware, checkFullAccess, getQuestionRatios } from "../middlewares/questionLimit.js";
import * as questionService from "../services/questionService.js";
import { supabaseAdmin } from "../config/db.js";
import { cacheGetOrSet } from "../utils/cache.js";

type Env = {
  Variables: {
    user: any;
    role: string;
  };
};

const questionsRouter = new Hono<Env>();

questionsRouter.post("/bulk-delete", requireRole("management"), async (c) => {
  try {
    const { ids } = await c.req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return c.json({ error: "Invalid or empty ids array" }, 400);
    }
    const ok = await questionService.deleteMultipleQuestions(ids);
    if (!ok) return c.json({ error: "Bulk delete failed" }, 400);
    return c.json({ success: true, message: `Deleted ${ids.length} questions` });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

questionsRouter.get("/document/:documentId/limited", async (c) => {
  const documentId = c.req.param("documentId");
  try {
    const role = c.get("role") || "guest";
    const user = c.get("user");
    const userId = user?.id || "anonymous";

    // Cache key starts with "questions:${documentId}" so it automatically invalidates 
    // when questions are added, updated, or deleted.
    const cacheKey = `questions:${documentId}:limited:${role}:${userId}`;

    const responseData = await cacheGetOrSet(
      cacheKey,
      async () => {
        // Run full access check, questions query, and ratios lookup in parallel to reduce latency
        const [hasFullAccess, questions, ratios] = await Promise.all([
          checkFullAccess(role, user, documentId),
          questionService.getQuestionsByDocument(documentId),
          getQuestionRatios()
        ]);

        const totalCount = questions.length;

        if (hasFullAccess) {
          return {
            questions,
            totalCount,
            lockedCount: 0,
            ratioPercent: 100,
            limitApplied: false,
          };
        }

        const targetRole = role === "guest" ? "free" : role;
        const limitRatio = ratios[targetRole] !== undefined ? ratios[targetRole] : 20;

        const limitCount = Math.max(1, Math.round(totalCount * (limitRatio / 100)));
        const lockedCount = Math.max(0, totalCount - limitCount);

        const allowedQuestions = questions.slice(0, limitCount);

        return {
          questions: allowedQuestions,
          totalCount,
          lockedCount,
          ratioPercent: limitRatio,
          limitApplied: true,
        };
      },
      120_000 // Cache for 2 minutes
    );

    return c.json(responseData);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

questionsRouter.get("/document/:documentId", questionLimitMiddleware, async (c) => {
  const documentId = c.req.param("documentId");
  try {
    const questions = await questionService.getQuestionsByDocument(documentId);
    return c.json({ questions });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

questionsRouter.get("/by-documents", requireRole("management"), async (c) => {
  const ids = c.req.query("ids");
  if (!ids) {
    return c.json({ error: "Missing ids query parameter" }, 400);
  }
  const docIds = ids.split(",").filter(Boolean);
  if (docIds.length === 0) {
    return c.json({ questions: [] });
  }
  try {
    const questions = await questionService.getQuestionsByMultipleDocuments(docIds);
    return c.json({ questions });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

questionsRouter.post("/", requireRole("management"), async (c) => {
  try {
    const body = await c.req.json();
    const { document_id, question, answer, choices, url_question, url_answer, order_index } = body;
    const q = await questionService.createQuestion({
      document_id, question, answer, choices, url_question, url_answer, order_index,
    });
    return c.json({ q }, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

questionsRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const q = await questionService.getQuestionById(id);
  if (!q) return c.json({ error: "Question not found" }, 404);
  return c.json({ question: q });
});

questionsRouter.put("/:id", requireRole("management"), async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { question, answer, choices, url_question, url_answer, order_index } = body;
    const q = await questionService.updateQuestion(id, {
      question, answer, choices, url_question, url_answer, order_index,
    });
    if (!q) return c.json({ error: "Question not found" }, 404);
    return c.json({ q });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

questionsRouter.patch("/:id", requireRole("management"), async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const q = await questionService.updateQuestion(id, body);
    if (!q) return c.json({ error: "Question not found" }, 404);
    return c.json({ q });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

questionsRouter.delete("/:id", requireRole("management"), async (c) => {
  const id = c.req.param("id");
  const ok = await questionService.deleteQuestion(id);
  if (!ok) return c.json({ error: "Delete failed" }, 400);
  return c.json({ success: true, message: "Deleted" });
});

// SEARCH theo text (exact + fuzzy fallback). Body: { questions: string[], document_ids?: string[] }
// Tra ve { results: { "<text>": Question[] } }.
questionsRouter.post("/search", async (c) => {
  try {
    const body = await c.req.json();
    const texts = Array.isArray(body?.questions) ? body.questions : [];
    const documentIds = Array.isArray(body?.document_ids) ? body.document_ids : [];

    if (texts.length === 0) {
      return c.json({ error: "questions array is required and must not be empty" }, 400);
    }
    if (texts.length > 200) {
      return c.json({ error: "Too many questions (max 200 per request)" }, 400);
    }

    const results = await questionService.searchQuestions(texts, documentIds);
    return c.json({ results });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

export default questionsRouter;
