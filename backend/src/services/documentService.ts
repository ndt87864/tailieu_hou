import { supabaseAdmin } from "../config/db.js";
import type { Document } from "../types/index.js";

export const listDocuments = async (): Promise<Document[]> => {
  const { data, error } = await supabaseAdmin
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
};

export const getDocumentById = async (id: string): Promise<Document | null> => {
  const { data, error } = await supabaseAdmin
    .from("documents")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data;
};

export const createDocument = async (
  doc: Pick<Document, "title" | "description" | "category_id">
): Promise<Document> => {
  const { data, error } = await supabaseAdmin
    .from("documents")
    .insert(doc)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateDocument = async (
  id: string,
  updates: Partial<Pick<Document, "title" | "description" | "category_id">>
): Promise<Document | null> => {
  const { data, error } = await supabaseAdmin
    .from("documents")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return null;
  return data;
};

export const deleteDocument = async (id: string): Promise<boolean> => {
  const { error } = await supabaseAdmin
    .from("documents")
    .delete()
    .eq("id", id);

  return !error;
};
