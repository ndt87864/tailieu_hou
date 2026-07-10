import { supabaseAdmin } from "../config/db.js";
import type { Document } from "../types/index.js";
import { cacheGetOrSet, cacheInvalidatePrefix } from "../utils/cache.js";

// TTL cho các loại cache (12 giờ vì đã có cơ chế invalidate cache khi admin thay đổi dữ liệu)
const TTL_GROUPED = 12 * 60 * 60 * 1000;
const TTL_ALL_DOCS = 12 * 60 * 60 * 1000;

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
      console.error("Error listing documents:", error.message);
      return [];
    }
    return data || [];
  };

  // Chỉ cache khi không có filter và không phải premium (để tránh leak data)
  if (!categoryId && !isPremiumUser) {
    return cacheGetOrSet<Document[]>(`${CACHE_PREFIX}:all:free`, fetcher, TTL_ALL_DOCS);
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


async function _fetchGroupedDocuments(isPremiumUser = false, preview = true): Promise<any[]> {
  // 1. Lấy thông tin categories (chỉ lấy category active)
  let catOnlyQuery = supabaseAdmin
    .from("categories")
    .select("id, title, logo, stt, premium")
    .eq("active", true)
    .order("stt", { ascending: true });

  if (!isPremiumUser) {
    catOnlyQuery = catOnlyQuery.eq("premium", false);
  }

  // 2. Lấy thông tin documents active
  let docOnlyQuery = supabaseAdmin
    .from("documents")
    .select("id, title, description, category_id, slug, created_at, updated_at, active, premium")
    .eq("active", true)
    .order("created_at", { ascending: true });

  if (!isPremiumUser) {
    docOnlyQuery = docOnlyQuery.eq("premium", false);
  }

  // 3. Lấy crawler courses mapping
  const coursesOnlyQuery = supabaseAdmin
    .from("crawler_courses")
    .select("id, document_id");

  // Thực thi song song 3 truy vấn phẳng
  const [catsResult, docsResult, coursesResult] = await Promise.all([
    catOnlyQuery,
    docOnlyQuery,
    coursesOnlyQuery
  ]);

  if (catsResult.error) {
    console.warn("Could not fetch categories from database:", catsResult.error.message);
    return [];
  }

  const catsData = catsResult.data || [];
  const docsData = docsResult.data || [];
  const coursesData = coursesResult.data || [];

  // Gom nhóm crawler_courses theo document_id để tránh O(N^2)
  const coursesByDoc = new Map<string, any[]>();
  coursesData.forEach((c: any) => {
    if (c.document_id) {
      if (!coursesByDoc.has(c.document_id)) {
        coursesByDoc.set(c.document_id, []);
      }
      coursesByDoc.get(c.document_id)!.push({ id: c.id });
    }
  });

  // Gom nhóm documents theo category_id
  const docsByCat = new Map<string, any[]>();
  const noCatDocs: any[] = [];

  docsData.forEach((d: any) => {
    const docWithCourses = {
      ...d,
      crawler_courses: coursesByDoc.get(d.id) || []
    };
    if (d.category_id) {
      if (!docsByCat.has(d.category_id)) {
        docsByCat.set(d.category_id, []);
      }
      docsByCat.get(d.category_id)!.push(docWithCourses);
    } else {
      noCatDocs.push(docWithCourses);
    }
  });

  const result: any[] = [];

  // Xây dựng cấu trúc cây phân cấp
  catsData.forEach((cat: any) => {
    const catDocs = docsByCat.get(cat.id) || [];
    if (catDocs.length === 0) return; // Chỉ hiển thị các nhóm có tài liệu hoạt động

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

  // Nhóm các tài liệu không có danh mục ("Khác")
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
      // 1. Lấy thông tin crawler_courses trước
      const { data: courses, error: courseError } = await supabaseAdmin
        .from("crawler_courses")
        .select("*")
        .eq("document_id", documentId);

      if (courseError) {
        console.error("Error fetching crawler courses metadata:", courseError.message);
        return { courses: [], weeks: [] };
      }

      if (!courses || courses.length === 0) {
        return { courses: [], weeks: [] };
      }

      // 2. Lấy danh sách week_name từ crawler_resources của các courses đó bằng truy vấn riêng biệt, siêu nhanh
      const courseIds = courses.map((c: any) => c.id);
      const { data: resources, error: resourceError } = await supabaseAdmin
        .from("crawler_resources")
        .select("week_name")
        .in("course_id", courseIds);

      if (resourceError) {
        console.error("Error fetching crawler resources week_names:", resourceError.message);
      }

      const weekSet = new Set<string>();
      if (resources && Array.isArray(resources)) {
        resources.forEach((r: any) => {
          if (r.week_name) weekSet.add(r.week_name);
        });
      }

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



