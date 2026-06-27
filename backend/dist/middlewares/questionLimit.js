import { supabaseAdmin } from "../config/db.js";
export const questionLimitMiddleware = async (c, next) => {
    await next();
    if (c.res.status !== 200 || !c.res.headers.get("content-type")?.includes("application/json"))
        return;
    const role = c.get("role") || "guest";
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
    if (role === "pro" && docId && user) {
        const { data: purchase } = await supabaseAdmin
            .from("user_purchases").select("id")
            .eq("user_id", user.id).eq("document_id", docId).maybeSingle();
        if (purchase) {
            c.res = c.json({ ...data, questions, limitApplied: false }, 200);
            return;
        }
    }
    // Tài khoản khách/free được xem tối thiểu 1 câu, tối đa 20% tổng số câu
    const limitCount = Math.max(1, Math.round(questions.length * 0.2));
    const limited = questions.slice(0, limitCount).map((q) => ({ ...q, isPremiumLocked: false }));
    const locked = questions.slice(limitCount).map((q) => ({
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
