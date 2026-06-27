import { Hono } from "hono";
import * as examService from "../services/examService.js";

const examRouter = new Hono();

examRouter.get("/search", async (c) => {
  try {
    const q = c.req.query("q") || "";
    if (!q.trim()) {
      return c.json({ error: "Query parameter 'q' is required" }, 400);
    }
    const results = await examService.searchExamSchedule(q);
    return c.json({ results });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

export default examRouter;
