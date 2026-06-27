import { supabaseAdmin } from "../config/db.js";
import type { Question } from "../types/index.js";

export const getQuestionsByDocument = async (documentId: string): Promise<Question[]> => {
  const { data, error } = await supabaseAdmin
    .from("questions")
    .select("*")
    .eq("document_id", documentId)
    .order("order_index", { ascending: true });

  if (error) throw error;
  return data ?? [];
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
  return data;
};

export const deleteQuestion = async (id: string): Promise<boolean> => {
  const { error } = await supabaseAdmin
    .from("questions")
    .delete()
    .eq("id", id);

  return !error;
};
