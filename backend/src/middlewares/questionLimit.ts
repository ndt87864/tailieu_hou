import type { MiddlewareHandler } from "hono";
import { type UserRole } from "../types/index.js";
import { supabaseAdmin } from "../config/db.js";
import { cacheGetOrSet } from "../utils/cache.js";

export async function getQuestionRatios(): Promise<Record<string, number>> {
  try {
    return await cacheGetOrSet(
      "question:ratios",
      async () => {
        const { data, error } = await supabaseAdmin
          .from("question_ratios")
          .select("role, ratio_percent");

        if (error || !data) {
          console.warn("Could not fetch question_ratios from database, using defaults:", error?.message);
          return { free: 20, plus: 50, pro: 70 };
        }

        const ratios: Record<string, number> = {};
        data.forEach((row) => {
          ratios[row.role] = row.ratio_percent;
        });
        return ratios;
      },
      300_000 // Cache 5 phút
    );
  } catch (err: any) {
    console.warn("Error getting question ratios, using defaults:", err.message);
    return { free: 20, plus: 50, pro: 70 };
  }
}

export async function checkFullAccess(role: string, user: any, docId: string | undefined): Promise<boolean> {
  // Admin / management / ultra: bypass hoàn toàn
  if (role === "admin" || role === "management" || role === "ultra") {
    return true;
  }

  // Pro / plus: kiểm tra quyền premium — chạy 2 queries song song
  if ((role === "pro" || role === "plus") && docId && user) {
    if (role === "plus") {
      // Plus: kiểm tra theo document_id trực tiếp (không cần category_id)
      const { data: premiumAccess } = await supabaseAdmin
        .from("premium_user")
        .select("id")
        .eq("profile_id", user.id)
        .eq("document_id", docId)
        .maybeSingle();

      if (premiumAccess) {
        return true;
      }
    } else {
      // Pro: cần category_id của doc → chạy song song cả 2 queries
      const [docResult, premiumByDocResult] = await Promise.all([
        supabaseAdmin
          .from("documents")
          .select("category_id")
          .eq("id", docId)
          .maybeSingle(),
        // Thử luôn theo document_id (fallback nếu không có category)
        supabaseAdmin
          .from("premium_user")
          .select("id, category_id")
          .eq("profile_id", user.id)
          .maybeSingle(),
      ]);

      const categoryId = docResult.data?.category_id;

      if (categoryId && premiumByDocResult.data) {
        // Kiểm tra category match
        if (premiumByDocResult.data.category_id === categoryId) {
          return true;
        }
      } else if (categoryId) {
        // Fallback: query cụ thể theo category_id
        const { data: premiumAccess } = await supabaseAdmin
          .from("premium_user")
          .select("id")
          .eq("profile_id", user.id)
          .eq("category_id", categoryId)
          .maybeSingle();

        if (premiumAccess) {
          return true;
        }
      }
    }
  }
  return false;
}

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

  const hasFullAccess = await checkFullAccess(role, user, docId);
  if (hasFullAccess) {
    c.res = c.json({ ...data, questions, limitApplied: false }, 200);
    return;
  }

  // Lấy cấu hình tỷ lệ câu hỏi từ DB/cache
  const ratios = await getQuestionRatios();
  const targetRole = role === "guest" ? "free" : role;
  const limitRatio = ratios[targetRole] !== undefined ? ratios[targetRole] : 20;

  // Tính số câu được xem theo tỷ lệ đã cấu hình
  const limitCount = Math.max(1, Math.round(questions.length * (limitRatio / 100)));

  const limited = questions.slice(0, limitCount).map((q: any) => ({ ...q, isPremiumLocked: false }));
  const locked = questions.slice(limitCount).map((q: any) => ({
    id: q.id,
    document_id: q.document_id,
    order_index: q.order_index,
    question: "Nội dung câu hỏi này đã bị khóa. Vui lòng nâng cấp tài khoản để xem tiếp.",
    answer: "",
    choices: ["Khóa", "Khóa", "Khóa", "Khóa"],
    url_question: null,
    url_answer: null,
    isPremiumLocked: true,
  }));

  c.res = c.json({ ...data, questions: [...limited, ...locked], limitApplied: true, limitCount, totalCount: questions.length }, 200);
};
