import { supabaseAdmin } from "../config/db.js";
import type { Question } from "../types/index.js";
import { cacheGetOrSet, cacheInvalidatePrefix } from "../utils/cache.js";

const CACHE_PREFIX = "questions";
const TTL_QUESTIONS = 120_000; // Cache 2 phút

export const getQuestionsByDocument = async (documentId: string): Promise<Question[]> => {
  const fetcher = async () => {
    const { data, error } = await supabaseAdmin
      .from("questions")
      .select("*")
      .eq("document_id", documentId)
      .order("created_at", { ascending: true });

    if (error) {
      console.warn(`Could not fetch questions for document ${documentId}:`, error.message);
      return [];
    }
    return data ?? [];
  };

  // Cache questions theo document_id
  return cacheGetOrSet<Question[]>(
    `${CACHE_PREFIX}:${documentId}`,
    fetcher,
    TTL_QUESTIONS
  );
};

export const getQuestionsByMultipleDocuments = async (documentIds: string[]): Promise<Question[]> => {
  if (documentIds.length === 0) return [];
  const results = await Promise.all(
    documentIds.map((id) => getQuestionsByDocument(id))
  );
  return results.flat();
};


export const createQuestion = async (
  q: Omit<Question, "id">
): Promise<Question> => {
  const { data, error } = await supabaseAdmin
    .from("questions")
    .insert(q)
    .select()
    .single();

  if (error) throw error;
  
  // Invalidate cache của document đó
  cacheInvalidatePrefix(`${CACHE_PREFIX}:${q.document_id}`);
  return data;
};

export const updateQuestion = async (
  id: string,
  updates: Partial<Omit<Question, "id" | "document_id">>
): Promise<Question | null> => {
  const { data, error } = await supabaseAdmin
    .from("questions")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return null;

  // Invalidate cache
  if (data?.document_id) {
    cacheInvalidatePrefix(`${CACHE_PREFIX}:${data.document_id}`);
  }
  return data;
};

export const deleteQuestion = async (id: string): Promise<boolean> => {
  // Lấy document_id trước khi xóa để invalidate cache
  const question = await getQuestionById(id);

  const { error } = await supabaseAdmin
    .from("questions")
    .delete()
    .eq("id", id);

  if (!error && question?.document_id) {
    cacheInvalidatePrefix(`${CACHE_PREFIX}:${question.document_id}`);
  }
  return !error;
};

export const deleteMultipleQuestions = async (ids: string[]): Promise<boolean> => {
  if (!ids || ids.length === 0) return true;
  
  // Lấy danh sách các document_id liên quan để invalidate cache
  const { data: questions, error: fetchError } = await supabaseAdmin
    .from("questions")
    .select("document_id")
    .in("id", ids);

  const { error } = await supabaseAdmin
    .from("questions")
    .delete()
    .in("id", ids);

  if (!error && questions) {
    const docIds = Array.from(new Set(questions.map((q) => q.document_id).filter(Boolean)));
    for (const docId of docIds) {
      cacheInvalidatePrefix(`${CACHE_PREFIX}:${docId}`);
    }
  }
  return !error;
};

export type BulkCreateInput = {
  document_id: string;
  question: string;
  answer: string;
  choices?: string[];
  url_question?: string | null;
  url_answer?: string | null;
  order_index?: number;
};

export type BulkCreateResult = {
  inserted: number;
  skipped: number;
  updatedChoices?: number;
  errors: string[];
};

/**
 * Thêm hàng loạt câu hỏi vào DB.
 * - Kiểm tra trùng lặp theo question và answer text trong cùng document_id.
 * - Câu hỏi đã tồn tại sẽ bị bỏ qua (skip), không gây lỗi.
 * - Trả về số lượng đã chèn, bỏ qua, và các lỗi nếu có.
 */
export const bulkCreateQuestions = async (
  items: BulkCreateInput[]
): Promise<BulkCreateResult> => {
  if (!items || items.length === 0) return { inserted: 0, skipped: 0, updatedChoices: 0, errors: [] };

  const documentId = items[0].document_id;

  // Lấy toàn bộ câu hỏi hiện có của document để so sánh trùng lặp
  const existing = await getQuestionsByDocument(documentId);

  const normalize = (text: string) => (text || "").trim().toLowerCase();

  // Lọc ra những câu hỏi chưa tồn tại
  const newItems: BulkCreateInput[] = [];
  let skipped = 0;
  let updatedChoices = 0;
  const errors: string[] = [];

  const updatePromises: Promise<{ id: string; error: any }>[] = [];

  for (const item of items) {
    if (!item.question?.trim()) {
      errors.push(`Bỏ qua câu hỏi rỗng.`);
      continue;
    }

    const normQ = normalize(item.question);
    const normA = normalize(item.answer);

    // Tìm câu trùng khớp cả question và answer trong existing
    const matchedDbQ = existing.find(
      (dbQ) => normalize(dbQ.question) === normQ && normalize(dbQ.answer) === normA
    );

    if (matchedDbQ) {
      const hasChoices = Array.isArray(matchedDbQ.choices) && matchedDbQ.choices.length > 0;
      if (!hasChoices && Array.isArray(item.choices) && item.choices.length > 0) {
        // Queue parallel update
        updatePromises.push((async () => {
          const { error } = await supabaseAdmin
            .from("questions")
            .update({ choices: item.choices })
            .eq("id", matchedDbQ.id);
          return { id: matchedDbQ.id, error };
        })());
      } else {
        // Đã có choices hoặc không có choices mới để cập nhật -> Bỏ qua
        skipped++;
      }
      continue;
    }

    newItems.push(item);
  }

  if (updatePromises.length > 0) {
    const updateResults = await Promise.all(updatePromises);
    for (const res of updateResults) {
      if (res.error) {
        errors.push(`ID ${res.id}: Cập nhật choices thất bại - ${res.error.message}`);
      } else {
        updatedChoices++;
      }
    }
  }

  if (newItems.length === 0) {
    return { inserted: 0, skipped, updatedChoices, errors };
  }

  // Chèn hàng loạt vào DB
  const { data, error } = await supabaseAdmin
    .from("questions")
    .insert(
      newItems.map((item, idx) => ({
        document_id: item.document_id,
        question: item.question.trim(),
        answer: item.answer?.trim() ?? "",
        choices: item.choices ?? [],
        url_question: item.url_question ?? null,
        url_answer: item.url_answer ?? null,
        order_index: item.order_index ?? existing.length + idx + 1,
      }))
    )
    .select("id");

  if (error) {
    errors.push(error.message);
    return { inserted: 0, skipped, updatedChoices, errors };
  }

  // Invalidate cache cho document này
  cacheInvalidatePrefix(`${CACHE_PREFIX}:${documentId}`);

  return {
    inserted: data?.length ?? 0,
    skipped,
    updatedChoices,
    errors,
  };
};

export const getQuestionById = async (id: string): Promise<Question | null> => {
  const { data, error } = await supabaseAdmin
    .from("questions")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data;
};

// ========== SEARCH THEO TEXT ==========
// Exact match: question IN (...texts) [optional scope theo document_ids].
// Fuzzy: ilike '%text%' (bo sang trong nhieu text) -> fallback khi exact ko ra.
// Tra ve map: result[text] = Question[].

const SEARCH_TTL = 60_000; // cache 1 phut

// Chuan hoa text cho fuzzy (bo dau tieng Viet, lowercase, thay space bang '*')
function normalizeFuzzyPattern(text: string): string {
  if (!text) return "";
  let cleaned = text.normalize("NFD").replace(/[̀-ͯ]/g, "");
  cleaned = cleaned.replace(
    /https?:\/\/[^\s"']+\/pluginfile\.php\/[^\s"']+\/([A-Za-z0-9_\-]+\.(?:png|jpe?g|gif|svg))/gi,
    "*$1"
  );
  let pattern = cleaned.toLowerCase().replace(/\s+/g, "*").replace(/\*+/g, "*");
  pattern = pattern.replace(/^\*+|\*+$/g, "");
  return pattern;
}

// Escape cho ilike: chi can % _ \\ (PostgREST encodeURIComponent ngoai route)
function escapeIlike(str: string): string {
  return String(str || "").replace(/[%_\\]/g, (m) => "\\" + m);
}

export const searchQuestions = async (
  texts: string[],
  documentIds: string[] = [],
): Promise<{ [text: string]: Question[] }> => {
  const queries = Array.isArray(texts)
    ? texts.map((t) => String(t || "")).filter(Boolean)
    : [];
  if (queries.length === 0) return {};

  const cacheKey = `search:${JSON.stringify({ queries, documentIds })}`;
  const cached = await cacheGetOrSet(
    cacheKey,
    async () => {
      const out: { [text: string]: Question[] } = {};

      // 1. Exact (bulk): WHERE question IN (...) [AND document_id IN (...)]
      const exactQuery = supabaseAdmin.from("questions").select("*");
      if (documentIds.length > 0) {
        exactQuery.in("document_id", documentIds);
      }
      const { data: exactRows, error: exactErr } = await exactQuery.in("question", queries);
      if (!exactErr && Array.isArray(exactRows)) {
        exactRows.forEach((row) => {
          const t = String(row.question || "");
          if (!t) return;
          if (!out[t]) out[t] = [];
          out[t].push(row);
        });
      }

      // 2. Fuzzy cho nhung text chua co exact
      const missing = queries.filter((t) => !out[t] || out[t].length === 0);
      if (missing.length > 0) {
        const fuzzyPromises = missing.map(async (t) => {
          const pattern = normalizeFuzzyPattern(t);
          if (!pattern || pattern.length < 3) {
            return { text: t, data: [], error: null };
          }
          let q = supabaseAdmin
            .from("questions")
            .select("*")
            .ilike("question", `*${escapeIlike(pattern)}*`);
          if (documentIds.length > 0) {
            q = q.in("document_id", documentIds);
          }
          q = q.limit(20);
          const { data, error } = await q;
          return { text: t, data: data ?? [], error };
        });

        const fuzzyResults = await Promise.all(fuzzyPromises);
        for (const res of fuzzyResults) {
          out[res.text] = res.error || !Array.isArray(res.data) ? [] : res.data;
        }
      }

      queries.forEach((t) => { if (!out[t]) out[t] = []; });
      return out;
    },
    SEARCH_TTL
  );

  return cached;
};

export type BulkUpdateChoicesInput = {
  id: string;
  choices: string[];
  url_question?: string | null;
  url_answer?: string | null;
};

export type BulkUpdateChoicesResult = {
  updated: number;
  errors: string[];
};

/**
 * Cập nhật hàng loạt `choices` và các trường URL (nếu có) cho các câu hỏi đã tồn tại trong DB.
 */
export const bulkUpdateChoices = async (
  items: BulkUpdateChoicesInput[]
): Promise<BulkUpdateChoicesResult> => {
  if (!items || items.length === 0) return { updated: 0, errors: [] };

  const errors: string[] = [];
  let updated = 0;

  // Run updates in parallel using Promise.all
  const promises = items.map(async (item) => {
    if (!item.id) {
      return { id: item.id, error: { message: "id không hợp lệ." } };
    }
    const updatePayload: any = {};
    if (Array.isArray(item.choices) && item.choices.length > 0) {
      updatePayload.choices = item.choices;
    }
    if (item.url_question !== undefined) {
      updatePayload.url_question = item.url_question;
    }
    if (item.url_answer !== undefined) {
      updatePayload.url_answer = item.url_answer;
    }

    if (Object.keys(updatePayload).length === 0) {
      return { id: item.id, error: { message: "Không có trường nào để cập nhật." } };
    }

    const { error } = await supabaseAdmin
      .from("questions")
      .update(updatePayload)
      .eq("id", item.id);
    return { id: item.id, error };
  });

  const results = await Promise.all(promises);

  for (const res of results) {
    if (res.error) {
      errors.push(`ID ${res.id}: ${res.error.message}`);
    } else {
      updated++;
    }
  }

  // Invalidate cache cho tất cả document liên quan
  if (updated > 0 && items.length > 0) {
    const { data: rows } = await supabaseAdmin
      .from("questions")
      .select("document_id")
      .in("id", items.map((i) => i.id));

    const docIds = Array.from(new Set((rows ?? []).map((r) => r.document_id).filter(Boolean)));
    for (const docId of docIds) {
      cacheInvalidatePrefix(`${CACHE_PREFIX}:${docId}`);
    }
  }

  return { updated, errors };
};

