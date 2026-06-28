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
    // Admin / management / ultra: bypass hoàn toàn
    if (role === "admin" || role === "management" || role === "ultra") {
        c.res = c.json({ ...data, questions, limitApplied: false }, 200);
        return;
    }
    // Pro / plus: kiểm tra quyền premium — chạy 2 queries song song
    if ((role === "pro" || role === "plus") && docId && user) {
        // Chạy song song: lấy category_id của doc + kiểm tra premium_user
        // Lần đầu cần doc info trước, nhưng ta có thể tối ưu bằng cách
        // fetch doc + premium check theo document_id luôn (tránh waterfall)
        if (role === "plus") {
            // Plus: kiểm tra theo document_id trực tiếp (không cần category_id)
            const { data: premiumAccess } = await supabaseAdmin
                .from("premium_user")
                .select("id")
                .eq("profile_id", user.id)
                .eq("document_id", docId)
                .maybeSingle();
            if (premiumAccess) {
                c.res = c.json({ ...data, questions, limitApplied: false }, 200);
                return;
            }
        }
        else {
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
                    c.res = c.json({ ...data, questions, limitApplied: false }, 200);
                    return;
                }
            }
            else if (categoryId) {
                // Fallback: query cụ thể theo category_id
                const { data: premiumAccess } = await supabaseAdmin
                    .from("premium_user")
                    .select("id")
                    .eq("profile_id", user.id)
                    .eq("category_id", categoryId)
                    .maybeSingle();
                if (premiumAccess) {
                    c.res = c.json({ ...data, questions, limitApplied: false }, 200);
                    return;
                }
            }
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
