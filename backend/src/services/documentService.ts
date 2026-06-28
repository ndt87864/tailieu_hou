import { supabaseAdmin } from "../config/db.js";
import type { Document } from "../types/index.js";

export const listDocuments = async (categoryId?: string): Promise<Document[]> => {
  let query = supabaseAdmin
    .from("documents")
    .select("*, category:categories(title, logo)")
    .order("created_at", { ascending: false });

  if (categoryId) {
    if (categoryId === "other") {
      query = query.is("category_id", null);
    } else {
      query = query.eq("category_id", categoryId);
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as any ?? [];
};

export const getGroupedDocumentsPreview = async (): Promise<any[]> => {
  // 1. Get all categories
  const { data: categories, error: catError } = await supabaseAdmin
    .from("categories")
    .select("*")
    .order("stt", { ascending: true });

  if (catError) throw catError;
  if (!categories) return [];

  const result = [];
  for (const cat of categories) {
    // Get top 10 documents
    const { data: docs, error: docsError } = await supabaseAdmin
      .from("documents")
      .select("*, category:categories(title, logo)")
      .eq("category_id", cat.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (docsError) throw docsError;

    // Get total count
    const { count, error: countError } = await supabaseAdmin
      .from("documents")
      .select("*", { count: "exact", head: true })
      .eq("category_id", cat.id);

    if (countError) throw countError;

    if (docs && docs.length > 0) {
      result.push({
        id: cat.id,
        title: cat.title,
        logo: cat.logo,
        documents: docs,
        total_count: count ?? docs.length
      });
    }
  }

  // Also handle documents with no category (category_id IS NULL)
  const { data: noCatDocs, error: noCatError } = await supabaseAdmin
    .from("documents")
    .select("*, category:categories(title, logo)")
    .is("category_id", null)
    .order("created_at", { ascending: false })
    .limit(10);

  if (noCatError) throw noCatError;

  if (noCatDocs && noCatDocs.length > 0) {
    const { count: noCatCount, error: noCatCountError } = await supabaseAdmin
      .from("documents")
      .select("*", { count: "exact", head: true })
      .is("category_id", null);

    if (noCatCountError) throw noCatCountError;

    result.push({
      id: "other",
      title: "Khác",
      documents: noCatDocs,
      total_count: noCatCount ?? noCatDocs.length
    });
  }

  return result;
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
