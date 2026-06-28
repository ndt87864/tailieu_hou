import { supabaseAdmin } from "../config/db.js";
import type { Document } from "../types/index.js";
import { cacheGetOrSet, cacheInvalidatePrefix } from "../utils/cache.js";

// TTL cho các loại cache
const TTL_GROUPED = 60_000;   // 60 giây
const TTL_ALL_DOCS = 60_000;  // 60 giây

// Prefix dùng để invalidate hàng loạt
const CACHE_PREFIX = "docs";

export const listDocuments = async (categoryId?: string): Promise<Document[]> => {
  const fetcher = async () => {
    let query = supabaseAdmin
      .from("documents")
      .select("*, category:categories(title, logo, stt)")
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
    return (data as any) ?? [];
  };

  // Chỉ cache khi không có filter (dùng cho sidebar)
  if (!categoryId) {
    return cacheGetOrSet<Document[]>(`${CACHE_PREFIX}:all`, fetcher, TTL_ALL_DOCS);
  }
  return fetcher();
};

export const getGroupedDocumentsPreview = async (): Promise<any[]> => {
  return cacheGetOrSet(`${CACHE_PREFIX}:grouped`, _fetchGroupedDocuments, TTL_GROUPED);
};

/** Hàm thực thi fetch (tách ra để dùng trong cacheGetOrSet) */
async function _fetchGroupedDocuments(): Promise<any[]> {
  // 1. Lấy tất cả categories
  const { data: categories, error: catError } = await supabaseAdmin
    .from("categories")
    .select("*")
    .order("stt", { ascending: true });

  if (catError) throw catError;
  if (!categories) return [];

  // 2. Chạy song song: mỗi category lấy docs + count cùng 1 lúc
  //    Dùng Promise.all thay vì for-loop tuần tự (tránh N+1 query)
  const categoryPromises = categories.map(async (cat) => {
    const [docsResult, countResult] = await Promise.all([
      supabaseAdmin
        .from("documents")
        .select("*, category:categories(title, logo)")
        .eq("category_id", cat.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabaseAdmin
        .from("documents")
        .select("*", { count: "exact", head: true })
        .eq("category_id", cat.id),
    ]);

    if (docsResult.error) throw docsResult.error;
    if (countResult.error) throw countResult.error;

    const docs = docsResult.data;
    const count = countResult.count;

    if (!docs || docs.length === 0) return null;

    return {
      id: cat.id,
      title: cat.title,
      logo: cat.logo,
      documents: docs,
      total_count: count ?? docs.length,
    };
  });

  // 3. Chạy song song cả "no category" cùng lúc với các category khác
  const noCatPromise = Promise.all([
    supabaseAdmin
      .from("documents")
      .select("*, category:categories(title, logo)")
      .is("category_id", null)
      .order("created_at", { ascending: false })
      .limit(10),
    supabaseAdmin
      .from("documents")
      .select("*", { count: "exact", head: true })
      .is("category_id", null),
  ]);

  // 4. Chờ tất cả hoàn thành song song
  const [categoryResults, [noCatDocsResult, noCatCountResult]] =
    await Promise.all([Promise.all(categoryPromises), noCatPromise]);

  if (noCatDocsResult.error) throw noCatDocsResult.error;
  if (noCatCountResult.error) throw noCatCountResult.error;

  // 5. Lọc bỏ category rỗng (null) và giữ thứ tự stt
  const result = categoryResults.filter(Boolean) as any[];

  // 6. Thêm nhóm "Khác" nếu có
  const noCatDocs = noCatDocsResult.data;
  const noCatCount = noCatCountResult.count;
  if (noCatDocs && noCatDocs.length > 0) {
    result.push({
      id: "other",
      title: "Khác",
      documents: noCatDocs,
      total_count: noCatCount ?? noCatDocs.length,
    });
  }

  return result;
}

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
  // Invalidate cache sau khi thêm mới
  cacheInvalidatePrefix(CACHE_PREFIX);
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
  // Invalidate cache sau khi cập nhật
  cacheInvalidatePrefix(CACHE_PREFIX);
  return data;
};

export const deleteDocument = async (id: string): Promise<boolean> => {
  const { error } = await supabaseAdmin
    .from("documents")
    .delete()
    .eq("id", id);

  if (!error) {
    // Invalidate cache sau khi xóa
    cacheInvalidatePrefix(CACHE_PREFIX);
  }
  return !error;
};
