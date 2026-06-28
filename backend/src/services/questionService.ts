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
      .order("order_index", { ascending: true });

    if (error) throw error;
    return data ?? [];
  };

  // Cache questions theo document_id
  return cacheGetOrSet<Question[]>(
    `${CACHE_PREFIX}:${documentId}`,
    fetcher,
    TTL_QUESTIONS
  );
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

export const getQuestionById = async (id: string): Promise<Question | null> => {
  const { data, error } = await supabaseAdmin
    .from("questions")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data;
};
