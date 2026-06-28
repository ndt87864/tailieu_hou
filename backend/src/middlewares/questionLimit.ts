import type { MiddlewareHandler } from "hono";
import { type UserRole, FREE_QUESTION_LIMIT } from "../types/index.js";
import { supabaseAdmin } from "../config/db.js";

export const questionLimitMiddleware: MiddlewareHandler = async (c, next) => {
  await next();

  if (c.res.status !== 200 || !c.res.headers.get("content-type")?.includes("application/json")) return;

  const role: UserRole | "guest" = c.get("role") || "guest";
  const user = c.get("user");
  const docId = c.req.param("documentId") || c.req.query("documentId");
  const data = await c.res.json();

  if (!data || !Array.isArray(data.questions)) {
    c.res = c.json(data, c.res.status);
    return;
  }

  let questions = data.questions;

  if (role === "admin" || role === "management" || role === "ultra") {
    c.res = c.json({ ...data, questions, limitApplied: false }, 200);
    return;
  }

  if ((role === "pro" || role === "plus") && docId && user) {
    const { data: docData } = await supabaseAdmin
      .from("documents")
      .select("category_id")
      .eq("id", docId)
      .maybeSingle();

    if (docData) {
      const categoryId = docData.category_id;
      let query = supabaseAdmin
        .from("premium_user")
        .select("id")
        .eq("profile_id", user.id);

      if (role === "plus") {
        query = query.eq("document_id", docId);
      } else {
        query = query.eq("category_id", categoryId);
      }

      const { data: premiumAccess } = await query.maybeSingle();
      if (premiumAccess) {
        c.res = c.json({ ...data, questions, limitApplied: false }, 200);
        return;
      }
    }
  }

  // Tài khoản khách/free được xem tối thiểu 1 câu, tối đa 20% tổng số câu
  const limitCount = Math.max(1, Math.round(questions.length * 0.2));

  const limited = questions.slice(0, limitCount).map((q: any) => ({ ...q, isPremiumLocked: false }));
  const locked = questions.slice(limitCount).map((q: any) => ({
    id: q.id,
    document_id: q.document_id,
    order_index: q.order_index,
    question: "Nội dung câu hỏi này đã bị khóa. Vui lòng nâng cấp tài khoản để xem tiếp.",
    answer: "",
    choices: ["Khóa","Khóa","Khóa","Khóa"],
    url_question: null,
    url_answer: null,
    isPremiumLocked: true,
  }));

  c.res = c.json({ ...data, questions: [...limited, ...locked], limitApplied: true, limitCount, totalCount: questions.length }, 200);
};
