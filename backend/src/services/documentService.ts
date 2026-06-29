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
    .select("*")
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

  // 2. Chạy song song: mỗi category lấy docs + count cùng 1 lúc
  //    Dùng Promise.all thay vì for-loop tuần tự (tránh N+1 query)
  const categoryPromises = categories.map(async (cat) => {
    let docQuery = supabaseAdmin
      .from("documents")
      .select("*, category:categories(title, logo)")
      .eq("category_id", cat.id)
      .eq("active", true)
      .order("created_at", { ascending: true });

    // Chỉ giới hạn 10 khi ở chế độ preview (homepage)
    if (preview) {
      docQuery = docQuery.limit(10);
    }

    let cntQuery = supabaseAdmin
      .from("documents")
      .select("*", { count: "exact", head: true })
      .eq("category_id", cat.id)
      .eq("active", true);

    if (!isPremiumUser) {
      docQuery = docQuery.eq("premium", false);
      cntQuery = cntQuery.eq("premium", false);
    }

    const [docsResult, countResult] = await Promise.all([docQuery, cntQuery]);

    if (docsResult.error) {
      console.warn(`Could not fetch docs for category ${cat.id}:`, docsResult.error.message);
    }
    if (countResult.error) {
      console.warn(`Could not count docs for category ${cat.id}:`, countResult.error.message);
    }

    const docs = docsResult.error ? [] : docsResult.data;
    const count = countResult.error ? 0 : countResult.count;

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
  let noCatDocQuery = supabaseAdmin
    .from("documents")
    .select("*, category:categories(title, logo)")
    .is("category_id", null)
    .eq("active", true)
    .order("created_at", { ascending: true });

  if (preview) {
    noCatDocQuery = noCatDocQuery.limit(10);
  }

  let noCatCntQuery = supabaseAdmin
    .from("documents")
    .select("*", { count: "exact", head: true })
    .is("category_id", null)
    .eq("active", true);

  if (!isPremiumUser) {
    noCatDocQuery = noCatDocQuery.eq("premium", false);
    noCatCntQuery = noCatCntQuery.eq("premium", false);
  }

  const noCatPromise = Promise.all([noCatDocQuery, noCatCntQuery]);

  // 4. Chờ tất cả hoàn thành song song
  const [categoryResults, [noCatDocsResult, noCatCountResult]] =
    await Promise.all([Promise.all(categoryPromises), noCatPromise]);

  if (noCatDocsResult.error) {
    console.warn("Could not fetch no-category docs:", noCatDocsResult.error.message);
  }
  if (noCatCountResult.error) {
    console.warn("Could not count no-category docs:", noCatCountResult.error.message);
  }

  // 5. Lọc bỏ category rỗng (null) và giữ thứ tự stt
  const result = categoryResults.filter(Boolean) as any[];

  // 6. Thêm nhóm "Khác" nếu có
  const noCatDocs = noCatDocsResult.error ? [] : noCatDocsResult.data;
  const noCatCount = noCatCountResult.error ? 0 : noCatCountResult.count;
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
