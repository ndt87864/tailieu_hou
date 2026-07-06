import { Hono } from "hono";
import { requireRole } from "../middlewares/role.js";
import { questionLimitMiddleware, checkFullAccess, getQuestionRatios } from "../middlewares/questionLimit.js";
import * as questionService from "../services/questionService.js";
import type { BulkCreateInput, BulkUpdateChoicesInput } from "../services/questionService.js";
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

// UPLOAD IMAGE từ Extension Scanner lên Supabase Storage
questionsRouter.post("/upload-image", async (c) => {
  try {
    const { base64, folder, fileName } = await c.req.json();
    if (!base64 || typeof base64 !== "string") {
      return c.json({ error: "Missing or invalid base64 data" }, 400);
    }
    if (folder !== "question_url" && folder !== "answer_url") {
      return c.json({ error: "Invalid folder" }, 400);
    }

    const commaIndex = base64.indexOf(",");
    const rawBase64 = commaIndex !== -1 ? base64.substring(commaIndex + 1) : base64;
    const mimeMatch = base64.match(/^data:([^;]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/png";

    let ext = "png";
    if (mimeType === "image/jpeg" || mimeType === "image/jpg") ext = "jpg";
    else if (mimeType === "image/gif") ext = "gif";
    else if (mimeType === "image/svg+xml") ext = "svg";
    else if (mimeType === "image/webp") ext = "webp";

    const buffer = Buffer.from(rawBase64, "base64");
    const randomId = Math.random().toString(36).substring(2, 15);
    const finalFileName = fileName ? fileName : `img_${Date.now()}_${randomId}.${ext}`;
    const filePath = `${folder}/${finalFileName}`;

    // Tự động kiểm tra và tạo bucket 'tailieuhou' nếu chưa tồn tại
    try {
      const { data: buckets } = await supabaseAdmin.storage.listBuckets();
      const bucketExists = buckets?.some(b => b.name === "tailieuhou");
      if (!bucketExists) {
        await supabaseAdmin.storage.createBucket("tailieuhou", {
          public: true,
        });
      }
    } catch (bucketErr) {
      console.warn("⚠️ Tự động tạo bucket 'tailieuhou' thất bại, bỏ qua:", bucketErr);
    }

    const { error } = await supabaseAdmin.storage
      .from("tailieuhou")
      .upload(filePath, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      return c.json({ error: error.message }, 400);
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from("tailieuhou")
      .getPublicUrl(filePath);

    return c.json({
      success: true,
      url: publicUrlData.publicUrl,
    }, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// UPLOAD NHIỀU ẢNH ĐỒNG THỜI từ Extension Scanner lên Supabase Storage
questionsRouter.post("/bulk-upload-images", async (c) => {
  try {
    const { images } = await c.req.json();
    if (!Array.isArray(images) || images.length === 0) {
      return c.json({ error: "Missing or invalid images array" }, 400);
    }

    // Tự động kiểm tra và tạo bucket 'tailieuhou' nếu chưa tồn tại
    try {
      const { data: buckets } = await supabaseAdmin.storage.listBuckets();
      const bucketExists = buckets?.some(b => b.name === "tailieuhou");
      if (!bucketExists) {
        await supabaseAdmin.storage.createBucket("tailieuhou", {
          public: true,
        });
      }
    } catch (bucketErr) {
      console.warn("⚠️ Tự động tạo bucket 'tailieuhou' thất bại, bỏ qua:", bucketErr);
    }

    const uploadPromises = images.map(async (img: any) => {
      const { base64, folder, fileName, originalUrl } = img;
      if (!base64 || !folder) {
        return { originalUrl, error: "Dữ liệu ảnh không hợp lệ" };
      }

      try {
        const commaIndex = base64.indexOf(",");
        const rawBase64 = commaIndex !== -1 ? base64.substring(commaIndex + 1) : base64;
        const mimeMatch = base64.match(/^data:([^;]+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : "image/png";

        let ext = "png";
        if (mimeType === "image/jpeg" || mimeType === "image/jpg") ext = "jpg";
        else if (mimeType === "image/gif") ext = "gif";
        else if (mimeType === "image/svg+xml") ext = "svg";
        else if (mimeType === "image/webp") ext = "webp";

        const buffer = Buffer.from(rawBase64, "base64");
        const randomId = Math.random().toString(36).substring(2, 15);
        const finalFileName = fileName ? fileName : `img_${Date.now()}_${randomId}.${ext}`;
        const filePath = `${folder}/${finalFileName}`;

        const { error } = await supabaseAdmin.storage
          .from("tailieuhou")
          .upload(filePath, buffer, {
            contentType: mimeType,
            upsert: true,
          });

        if (error) {
          return { originalUrl, error: error.message };
        }

        const { data: publicUrlData } = supabaseAdmin.storage
          .from("tailieuhou")
          .getPublicUrl(filePath);

        return { originalUrl, url: publicUrlData.publicUrl };
      } catch (err: any) {
        return { originalUrl, error: err.message };
      }
    });

    const results = await Promise.all(uploadPromises);
    return c.json({ success: true, uploaded: results });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// BULK INSERT từ Extension Scanner
// Body: { document_id: string, questions: { question, answer, choices?, order_index? }[] }
questionsRouter.post("/bulk", async (c) => {
  try {
    const body = await c.req.json();
    const { document_id, questions } = body as {
      document_id?: string;
      questions?: Array<{
        question: string;
        answer: string;
        choices?: string[];
        url_question?: string;
        url_answer?: string;
        order_index?: number;
      }>;
    };

    if (!document_id || typeof document_id !== "string") {
      return c.json({ error: "document_id là bắt buộc" }, 400);
    }
    if (!Array.isArray(questions) || questions.length === 0) {
      return c.json({ error: "questions phải là mảng không rỗng" }, 400);
    }
    if (questions.length > 500) {
      return c.json({ error: "Tối đa 500 câu hỏi mỗi lần gửi" }, 400);
    }

    const items: BulkCreateInput[] = questions.map((q) => ({
      document_id,
      question: String(q.question ?? ""),
      answer: String(q.answer ?? ""),
      choices: Array.isArray(q.choices) ? q.choices : [],
      url_question: q.url_question ?? null,
      url_answer: q.url_answer ?? null,
      order_index: typeof q.order_index === "number" ? q.order_index : undefined,
    }));

    const result = await questionService.bulkCreateQuestions(items);

    let message = `Đã thêm ${result.inserted} câu hỏi, bỏ qua ${result.skipped} câu trùng lặp.`;
    if (result.updatedChoices && result.updatedChoices > 0) {
      message += ` Cập nhật choices cho ${result.updatedChoices} câu hỏi.`;
    }

    return c.json({
      success: true,
      inserted: result.inserted,
      skipped: result.skipped,
      updatedChoices: result.updatedChoices || 0,
      errors: result.errors,
      message,
    }, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

// BULK UPDATE CHOICES từ Extension Scanner
// Body: { updates: { id: string, choices: string[] }[] }
questionsRouter.post("/bulk-update-choices", async (c) => {
  try {
    const body = await c.req.json();
    const updates = body?.updates as BulkUpdateChoicesInput[] | undefined;

    if (!Array.isArray(updates) || updates.length === 0) {
      return c.json({ error: "updates phải là mảng không rỗng" }, 400);
    }
    if (updates.length > 500) {
      return c.json({ error: "Tối đa 500 mục mỗi lần gửi" }, 400);
    }

    const result = await questionService.bulkUpdateChoices(updates);

    return c.json({
      success: true,
      updated: result.updated,
      errors: result.errors,
      message: `Đã cập nhật choices cho ${result.updated} câu hỏi.`,
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
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
