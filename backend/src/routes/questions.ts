import { Hono } from "hono";
import { requireRole } from "../middlewares/role.js";
import { questionLimitMiddleware, checkFullAccess, getQuestionRatios } from "../middlewares/questionLimit.js";
import * as questionService from "../services/questionService.js";

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

    const questions = await questionService.getQuestionsByDocument(documentId);
    const totalCount = questions.length;

    const hasFullAccess = await checkFullAccess(role, user, documentId);

    if (hasFullAccess) {
      return c.json({
        questions,
        totalCount,
        lockedCount: 0,
        ratioPercent: 100,
        limitApplied: false,
      });
    }

    const ratios = await getQuestionRatios();
    const targetRole = role === "guest" ? "free" : role;
    const limitRatio = ratios[targetRole] !== undefined ? ratios[targetRole] : 20;

    const limitCount = Math.max(1, Math.round(totalCount * (limitRatio / 100)));
    const lockedCount = Math.max(0, totalCount - limitCount);

    const allowedQuestions = questions.slice(0, limitCount);

    return c.json({
      questions: allowedQuestions,
      totalCount,
      lockedCount,
      ratioPercent: limitRatio,
      limitApplied: true,
    });
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

export default questionsRouter;
