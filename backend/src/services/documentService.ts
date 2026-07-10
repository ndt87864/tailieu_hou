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

    const [docResult, coursesResult] = await Promise.all([
      query,
      supabaseAdmin.from("crawler_courses").select("document_id")
    ]);

    if (docResult.error) {
      console.warn("Could not fetch documents from database:", docResult.error.message);
      return [];
    }

    const documents = docResult.data ?? [];
    const courseDocIds = new Set(coursesResult.data?.map(c => c.document_id).filter(Boolean));

    documents.forEach((doc: any) => {
      doc.crawler_courses = courseDocIds.has(doc.id) ? [{ id: doc.id }] : [];
    });

    return documents;
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

  const [docResult, coursesResult] = await Promise.all([
    docQuery,
    supabaseAdmin.from("crawler_courses").select("document_id")
  ]);

  if (docResult.error || !docResult.data) {
    console.warn("Could not fetch documents from database:", docResult.error?.message);
    return [];
  }

  const allDocs = docResult.data;
  const courseDocIds = new Set(coursesResult.data?.map(c => c.document_id).filter(Boolean));

  allDocs.forEach((doc: any) => {
    doc.crawler_courses = courseDocIds.has(doc.id) ? [{ id: doc.id }] : [];
  });

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
  const fetcher = async () => {
    const { data, error } = await supabaseAdmin
      .from("documents")
      .select("*")
      .eq("id", id)
      .single();

    if (error) return null;
    return data;
  };

  return cacheGetOrSet<Document | null>(
    `${CACHE_PREFIX}:item:${id}`,
    fetcher,
    60_000
  );
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

export const getCrawlerDataForDoc = async (documentId: string) => {
  const cacheKey = `${CACHE_PREFIX}:crawler_data:${documentId}`;
  
  return cacheGetOrSet(
    cacheKey,
    async () => {
      const { data: courses, error: courseError } = await supabaseAdmin
        .from("crawler_courses")
        .select("*")
        .eq("document_id", documentId);

      if (courseError) {
        console.error("Error fetching crawler courses:", courseError.message);
        return { courses: [], resources: [], questions: [] };
      }

      if (!courses || courses.length === 0) {
        return { courses: [], resources: [], questions: [] };
      }

      const courseIds = courses.map(c => c.id);

      const { data: resources, error: resError } = await supabaseAdmin
        .from("crawler_resources")
        .select("*")
        .in("course_id", courseIds)
        .order("created_at", { ascending: true });

      const { data: questions, error: qError } = await supabaseAdmin
        .from("crawler_questions")
        .select("*")
        .in("course_id", courseIds)
        .order("created_at", { ascending: true });

      return {
        courses: courses || [],
        resources: resources || [],
        questions: questions || [],
      };
    },
    300_000 // Cache trong 5 phút
  );
};

export const getCrawlerDataMetadata = async (documentId: string) => {
  const cacheKey = `${CACHE_PREFIX}:crawler_metadata:${documentId}`;

  return cacheGetOrSet(
    cacheKey,
    async () => {
      const { data: courses, error: courseError } = await supabaseAdmin
        .from("crawler_courses")
        .select("*, crawler_resources(week_name)")
        .eq("document_id", documentId);

      if (courseError) {
        console.error("Error fetching crawler courses metadata:", courseError.message);
        return { courses: [], weeks: [] };
      }

      if (!courses || courses.length === 0) {
        return { courses: [], weeks: [] };
      }

      const weekSet = new Set<string>();
      courses.forEach((c: any) => {
        if (Array.isArray(c.crawler_resources)) {
          c.crawler_resources.forEach((r: any) => {
            if (r.week_name) weekSet.add(r.week_name);
          });
        }
        // Xóa thuộc tính crawler_resources lồng để trả về object sạch
        delete c.crawler_resources;
      });

      const weeks = Array.from(weekSet).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
      );

      return {
        courses: courses || [],
        weeks
      };
    },
    300_000 // Cache 5 phút
  );
};

export const getCrawlerDataFiltered = async (courseIds: string[], weeks: string[]) => {
  if (courseIds.length === 0 || weeks.length === 0) {
    return { resources: [], questions: [] };
  }

  const [resResult, qResult] = await Promise.all([
    supabaseAdmin
      .from("crawler_resources")
      .select("*")
      .in("course_id", courseIds)
      .in("week_name", weeks)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("crawler_questions")
      .select("*")
      .in("course_id", courseIds)
      .in("week_name", weeks)
      .order("created_at", { ascending: true })
  ]);

  return {
    resources: resResult.data || [],
    questions: qResult.data || []
  };
};

export const getCrawlerResourcesFiltered = async (documentId: string, courseIds: string[], weeks: string[]) => {
  const cacheKey = `${CACHE_PREFIX}:resources_filtered:${documentId}:${courseIds.join("-")}:${weeks.join("-")}`;

  return cacheGetOrSet(
    cacheKey,
    async () => {
      let targetCourseIds = courseIds;
      if (targetCourseIds.length === 0) {
        const { data: courses } = await supabaseAdmin
          .from("crawler_courses")
          .select("id")
          .eq("document_id", documentId);
        targetCourseIds = courses?.map(c => c.id) || [];
      }

      if (targetCourseIds.length === 0) return { resources: [], questionCount: 0 };

      let query = supabaseAdmin
        .from("crawler_resources")
        .select("*")
        .in("course_id", targetCourseIds);

      let qQuery = supabaseAdmin
        .from("crawler_questions")
        .select("*", { count: "exact", head: true })
        .in("course_id", targetCourseIds);

      if (weeks.length > 0) {
        query = query.in("week_name", weeks);
        qQuery = qQuery.in("week_name", weeks);
      }

      const [resResult, qCountResult] = await Promise.all([
        query.order("created_at", { ascending: true }),
        qQuery
      ]);

      if (resResult.error) {
        console.error("Error fetching filtered resources:", resResult.error.message);
        return { resources: [], questionCount: 0 };
      }
      return {
        resources: resResult.data || [],
        questionCount: qCountResult.count || 0
      };
    },
    300_000 // Cache 5 phút
  );
};

export const getCrawlerQuestionsFiltered = async (documentId: string, courseIds: string[], weeks: string[]) => {
  const cacheKey = `${CACHE_PREFIX}:questions_filtered:${documentId}:${courseIds.join("-")}:${weeks.join("-")}`;

  return cacheGetOrSet(
    cacheKey,
    async () => {
      let targetCourseIds = courseIds;
      if (targetCourseIds.length === 0) {
        const { data: courses } = await supabaseAdmin
          .from("crawler_courses")
          .select("id")
          .eq("document_id", documentId);
        targetCourseIds = courses?.map(c => c.id) || [];
      }

      if (targetCourseIds.length === 0) return [];

      let query = supabaseAdmin
        .from("crawler_questions")
        .select("*")
        .in("course_id", targetCourseIds);

      if (weeks.length > 0) {
        query = query.in("week_name", weeks);
      }

      const { data, error } = await query.order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching filtered questions:", error.message);
        return [];
      }
      return data || [];
    },
    300_000 // Cache 5 phút
  );
};



