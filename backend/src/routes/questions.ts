import { Hono } from "hono";
import { requireRole } from "../middlewares/role.js";
import { questionLimitMiddleware } from "../middlewares/questionLimit.js";
import * as questionService from "../services/questionService.js";

const questionsRouter = new Hono();

questionsRouter.get("/document/:documentId", questionLimitMiddleware, async (c) => {
  const documentId = c.req.param("documentId");
  try {
    const questions = await questionService.getQuestionsByDocument(documentId);
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
