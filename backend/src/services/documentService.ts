import { supabaseAdmin } from "../config/db.js";
import type { Document } from "../types/index.js";
import { cacheGetOrSet, cacheInvalidatePrefix } from "../utils/cache.js";

// TTL cho các loại cache
const TTL_GROUPED = 60_000;   // 60 giây
const TTL_ALL_DOCS = 60_000;  // 60 giây

// Prefix dùng để invalidate hàng loạt
const CACHE_PREFIX = "docs";

export const listDocuments = async (
  categoryId?: string,
  isPremiumUser = false
): Promise<Document[]> => {
  const fetcher = async () => {
    let query = supabaseAdmin
      .from("documents")
      .select("*, category:categories(title, logo, stt)")
      .eq("active", true)
      .order("created_at", { ascending: true });

    // Nếu không phải premium, ẩn các tài liệu premium
    if (!isPremiumUser) {
      query = query.eq("premium", false);
    }

    if (categoryId) {
      if (categoryId === "other") {
        query = query.is("category_id", null);
      } else {
        query = query.eq("category_id", categoryId);
      }
    }

    const { data, error } = await query;
    if (error) {
      console.warn("Could not fetch documents from database:", error.message);
      return [];
    }
    return (data as any) ?? [];
  };

  // Chỉ cache khi không có filter và không phải premium (để tránh leak data)
  if (!categoryId && !isPremiumUser) {
    return cacheGetOrSet<Document[]>(`${CACHE_PREFIX}:all`, fetcher, TTL_ALL_DOCS);
  }
  if (!categoryId && isPremiumUser) {
    return cacheGetOrSet<Document[]>(`${CACHE_PREFIX}:all:premium`, fetcher, TTL_ALL_DOCS);
  }
  return fetcher();
};


export const getGroupedDocumentsPreview = async (
  isPremiumUser = false
): Promise<any[]> => {
  const cacheKey = isPremiumUser
    ? `${CACHE_PREFIX}:grouped:premium`
    : `${CACHE_PREFIX}:grouped`;
  return cacheGetOrSet(cacheKey, () => _fetchGroupedDocuments(isPremiumUser, true), TTL_GROUPED);
};

/** Không giới hạn số tài liệu — dùng cho sidebar cần hiển thị đầy đủ */
export const getGroupedDocumentsFull = async (
  isPremiumUser = false
): Promise<any[]> => {
  const cacheKey = isPremiumUser
    ? `${CACHE_PREFIX}:grouped:full:premium`
    : `${CACHE_PREFIX}:grouped:full`;
  return cacheGetOrSet(cacheKey, () => _fetchGroupedDocuments(isPremiumUser, false), TTL_GROUPED);
};


/** Hàm thực thi fetch (tách ra để dùng trong cacheGetOrSet) */
async function _fetchGroupedDocuments(isPremiumUser = false, preview = true): Promise<any[]> {
  // 1. Lấy tất cả categories đang active
  let catQuery = supabaseAdmin
    .from("categories")
    .select("id, title, logo, stt, premium")
    .eq("active", true)
    .order("stt", { ascending: true });

  // Nếu không phải premium, ẩn category premium
  if (!isPremiumUser) {
    catQuery = catQuery.eq("premium", false);
  }

  const { data: categories, error: catError } = await catQuery;

  if (catError) {
    console.warn("Could not fetch categories from database:", catError.message);
    return [];
  }
  if (!categories) return [];

  // 2. Lấy tất cả active documents
  let docQuery = supabaseAdmin
    .from("documents")
    .select("*, category:categories(title, logo)")
    .eq("active", true)
    .order("created_at", { ascending: true });

  if (!isPremiumUser) {
    docQuery = docQuery.eq("premium", false);
  }

  const { data: allDocs, error: docError } = await docQuery;
  if (docError || !allDocs) {
    console.warn("Could not fetch documents from database:", docError?.message);
    return [];
  }

  // 3. Phân nhóm trong bộ nhớ (In-memory grouping & counting)
  const docsByCat = new Map<string | null, any[]>();
  allDocs.forEach((doc) => {
    const catId = doc.category_id;
    if (!docsByCat.has(catId)) {
      docsByCat.set(catId, []);
    }
    docsByCat.get(catId)!.push(doc);
  });

  const result: any[] = [];

  // 4. Map từng category với documents tương ứng
  categories.forEach((cat) => {
    const catDocs = docsByCat.get(cat.id) ?? [];
    if (catDocs.length === 0) return; // Chỉ lấy các nhóm có tài liệu hoạt động

    // Giới hạn 10 docs nếu ở chế độ preview
    const documentsToShow = preview ? catDocs.slice(0, 10) : catDocs;

    result.push({
      id: cat.id,
      title: cat.title,
      logo: cat.logo,
      documents: documentsToShow,
      total_count: catDocs.length,
    });
  });

  // 5. Thêm nhóm "Khác" (no category) nếu có
  const noCatDocs = docsByCat.get(null) ?? [];
  if (noCatDocs.length > 0) {
    const documentsToShow = preview ? noCatDocs.slice(0, 10) : noCatDocs;
    result.push({
      id: "other",
      title: "Khác",
      documents: documentsToShow,
      total_count: noCatDocs.length,
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
  updates: Partial<Pick<Document, "title" | "description" | "category_id" | "active" | "premium">>
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
