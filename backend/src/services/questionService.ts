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
      for (const t of missing) {
        const pattern = normalizeFuzzyPattern(t);
        if (!pattern || pattern.length < 3) {
          out[t] = [];
          continue;
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
        out[t] = error || !Array.isArray(data) ? [] : data;
      }

      queries.forEach((t) => { if (!out[t]) out[t] = []; });
      return out;
    },
    SEARCH_TTL
  );

  return cached;
};
