import { Hono } from "hono";
import * as examService from "../services/examService.js";

type Env = {
  Variables: {
    user: any;
    role: string;
  };
};

const examRouter = new Hono<Env>();

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

examRouter.post("/register", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = await c.req.json();
    if (!body.studentId || !body.selectedIds || !body.billUrl) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const result = await examService.pushToRegistrationQueue(body);
    return c.json({ success: true, data: result });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

export default examRouter;
