import { supabaseAdmin } from "../config/db.js";
import type { Document } from "../types/index.js";
import { cacheGetOrSet, cacheInvalidatePrefix } from "../utils/cache.js";

// TTL cho các loại cache (12 giờ vì đã có cơ chế invalidate cache khi admin thay đổi dữ liệu)
const TTL_GROUPED = 12 * 60 * 60 * 1000;
const TTL_ALL_DOCS = 12 * 60 * 60 * 1000;

// Prefix dùng để invalidate hàng loạt
const CACHE_PREFIX = "docs";

const getSimilarity = (s1: string, s2: string): number => {
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0;
  
  const clean = (str: string) => str.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();

  const n1 = clean(s1);
  const n2 = clean(s2);

  if (n1 === n2) return 1.0;
  if (n1.includes(n2) || n2.includes(n1)) {
    const minLen = Math.min(n1.length, n2.length);
    const maxLen = Math.max(n1.length, n2.length);
    return 0.9 + (minLen / maxLen) * 0.1;
  }

  const matrix: number[][] = [];
  for (let i = 0; i <= n1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= n2.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= n1.length; i++) {
    for (let j = 1; j <= n2.length; j++) {
      if (n1[i - 1] === n2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  const dist = matrix[n1.length][n2.length];
  const maxLen = Math.max(n1.length, n2.length);
  return 1.0 - dist / maxLen;
};

export const listDocuments = async (
  categoryId?: string,
  isPremiumUser = false,
  search?: string,
  lms?: boolean
): Promise<Document[]> => {
  const fetcher = async () => {
    const selectStr = lms 
      ? "*, category:categories(title, logo, stt), crawler_courses:crawler_courses!inner(id)" 
      : "*, category:categories(title, logo, stt)";
    
    const cleanSearch = search ? search.trim() : "";
    if (search && !cleanSearch) {
      return []; // Không cho phép tìm kiếm chỉ toàn khoảng trắng
    }

    if (cleanSearch) {
      // 1. Thử tìm kiếm chính xác trước (khớp 100% bằng ILIKE)
      let strictQuery = supabaseAdmin
        .from("documents")
        .select(selectStr)
        .eq("active", true)
        .not("category_id", "is", null)
        .ilike("title", `%${cleanSearch}%`)
        .order("created_at", { ascending: true });

      if (!isPremiumUser) {
        strictQuery = strictQuery.eq("premium", false);
      }
      if (categoryId) {
        strictQuery = strictQuery.eq("category_id", categoryId);
      }

      const { data: strictData, error: strictError } = await strictQuery;
      if (!strictError && strictData && strictData.length > 0) {
        return strictData;
      }

      // 2. Chấp nhận kết quả khớp thấp hơn (tối thiểu 90%) nếu không khớp 100%
      let allQuery = supabaseAdmin
        .from("documents")
        .select(selectStr)
        .eq("active", true)
        .not("category_id", "is", null);

      if (!isPremiumUser) {
        allQuery = allQuery.eq("premium", false);
      }
      if (categoryId) {
        allQuery = allQuery.eq("category_id", categoryId);
      }

      const { data: allData, error: allError } = await allQuery;
      if (allError || !allData) {
        return [];
      }

      const matched = allData.map(doc => {
        const score = getSimilarity(doc.title, cleanSearch);
        return { doc, score };
      })
      .filter(item => item.score >= 0.88) // Lọc kết quả tương đồng tối thiểu ~90%
      .sort((a, b) => b.score - a.score)
      .map(item => item.doc);

      return matched;
    }

    let query = supabaseAdmin
      .from("documents")
      .select(selectStr)
      .eq("active", true)
      .not("category_id", "is", null)
      .order("created_at", { ascending: true });

    if (!isPremiumUser) {
      query = query.eq("premium", false);
    }

    if (categoryId) {
      query = query.eq("category_id", categoryId);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error listing documents:", error.message);
      return [];
    }
    return data || [];
  };

  // Chỉ cache khi không có filter và không phải premium
  if (!categoryId && !search && !lms && !isPremiumUser) {
    return cacheGetOrSet<Document[]>(`${CACHE_PREFIX}:all:free`, fetcher, TTL_ALL_DOCS);
  }
  if (!categoryId && !search && !lms && isPremiumUser) {
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

export const getGroupedDocumentsLMS = async (
  isPremiumUser = false
): Promise<any[]> => {
  const cacheKey = isPremiumUser
    ? `${CACHE_PREFIX}:grouped:lms:premium`
    : `${CACHE_PREFIX}:grouped:lms`;
  return cacheGetOrSet(cacheKey, () => _fetchGroupedDocumentsLMS(isPremiumUser), TTL_GROUPED);
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
    .not("category_id", "is", null)
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

      const [resResult, qResult] = await Promise.all([
        supabaseAdmin
          .from("crawler_resources")
          .select("*")
          .in("course_id", courseIds)
          .order("created_at", { ascending: true }),
        supabaseAdmin
          .from("crawler_questions")
          .select("*")
          .in("course_id", courseIds)
          .order("created_at", { ascending: true })
      ]);

      const allResources = resResult.data || [];
      const filteredResources: any[] = [];
      const idsToDelete: string[] = [];

      allResources.forEach((res: any) => {
        const url = res.content_url || "";
        const cleanUrl = url.split("?")[0].toLowerCase();
        const isWebFile = cleanUrl.endsWith(".php") || cleanUrl.endsWith(".html") || cleanUrl.endsWith(".htm");

        if (isWebFile) {
          idsToDelete.push(res.id);
        } else {
          filteredResources.push(res);
        }
      });

      // Kích hoạt việc xóa bất đồng bộ trong background để làm sạch database
      if (idsToDelete.length > 0) {
        supabaseAdmin.from("crawler_resources")
          .delete()
          .in("id", idsToDelete)
          .then(({ error }) => {
            if (error) {
              console.error("Lỗi tự động xóa file web ở DB:", error.message);
            } else {
              console.log(`[Auto-Clean] Đã tự động loại bỏ ${idsToDelete.length} tài nguyên web (.php/.html) khỏi DB.`);
            }
          });
      }

      return {
        courses: courses || [],
        resources: filteredResources,
        questions: qResult.data || [],
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

export const getCrawlerResourcesFiltered = async (documentId: string) => {
  const cacheKey = `${CACHE_PREFIX}:resources_filtered:${documentId}`;

  return cacheGetOrSet(
    cacheKey,
    async () => {
      const { data: courses } = await supabaseAdmin
        .from("crawler_courses")
        .select("id")
        .eq("document_id", documentId);
      const targetCourseIds = courses?.map(c => c.id) || [];

      if (targetCourseIds.length === 0) return { resources: [], questionCount: 0 };

      let query = supabaseAdmin
        .from("crawler_resources")
        .select("*")
        .in("course_id", targetCourseIds)
        .eq("type", "file");

      let qQuery = supabaseAdmin
        .from("crawler_questions")
        .select("*", { count: "exact", head: true })
        .in("course_id", targetCourseIds);

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

export const getCrawlerQuestionsFiltered = async (documentId: string) => {
  const cacheKey = `${CACHE_PREFIX}:questions_filtered:${documentId}`;

  return cacheGetOrSet(
    cacheKey,
    async () => {
      const { data: courses } = await supabaseAdmin
        .from("crawler_courses")
        .select("id")
        .eq("document_id", documentId);
      const targetCourseIds = courses?.map(c => c.id) || [];

      if (targetCourseIds.length === 0) return [];

      let query = supabaseAdmin
        .from("crawler_questions")
        .select("*")
        .in("course_id", targetCourseIds);

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

/** Hàm fetch danh sách các tài liệu đã có dữ liệu LMS crawler (lọc ngay tại DB) */
async function _fetchGroupedDocumentsLMS(isPremiumUser = false): Promise<any[]> {
  // Query 1: Lấy tất cả active categories và các active documents lồng bên trong (chỉ giữ documents có crawler_courses qua !inner join)
  let catQuery = supabaseAdmin
    .from("categories")
    .select(`
      id, title, logo, stt, premium,
      documents:documents(
        id, title, description, category_id, slug, created_at, updated_at, active, premium,
        crawler_courses:crawler_courses!inner(id)
      )
    `)
    .eq("active", true)
    .eq("documents.active", true)
    .order("stt", { ascending: true })
    .order("created_at", { referencedTable: "documents", ascending: true });

  if (!isPremiumUser) {
    catQuery = catQuery.eq("premium", false).eq("documents.premium", false);
  }

  // Chạy truy vấn lấy danh mục
  const catResult = await catQuery;

  if (catResult.error) {
    console.warn("Could not fetch LMS grouped categories from database:", catResult.error.message);
    return [];
  }

  const categories = catResult.data || [];
  const result: any[] = [];

  // 1. Xử lý các categories và documents tương ứng
  categories.forEach((cat: any) => {
    const catDocs = cat.documents || [];
    if (catDocs.length === 0) return; // Chỉ lấy các nhóm có tài liệu hoạt động

    result.push({
      id: cat.id,
      title: cat.title,
      logo: cat.logo,
      documents: catDocs,
      total_count: catDocs.length,
    });
  });

  return result;
}

export const getCategoryById = async (
  id: string,
  isPremiumUser = false,
  lms = false
): Promise<any | null> => {
  const fetcher = async () => {
    // 1. Lấy thông tin category
    let catQuery = supabaseAdmin
      .from("categories")
      .select("id, title, logo, stt, premium, active")
      .eq("id", id)
      .eq("active", true)
      .single();
      
    const { data: catData, error: catError } = await catQuery;
    if (catError || !catData) return null;
    
    // Nếu category là premium nhưng user không phải premium
    if (catData.premium && !isPremiumUser) return null;

    // 2. Lấy danh sách documents của category này
    let docQuery = supabaseAdmin
      .from("documents")
      .select("id, title, description, category_id, slug, created_at, updated_at, active, premium")
      .eq("category_id", id)
      .eq("active", true)
      .order("created_at", { ascending: true });

    if (!isPremiumUser) {
      docQuery = docQuery.eq("premium", false);
    }

    const { data: docsData, error: docsError } = await docQuery;
    if (docsError) {
      console.error("Error fetching category docs:", docsError.message);
      return null;
    }

    let documents = docsData || [];

    if (documents.length > 0) {
      const docIds = documents.map(d => d.id);

      if (lms) {
        // Mode bài làm (lms = true)
        // 1. Lấy toàn bộ crawler_courses của các documents này
        const { data: coursesData } = await supabaseAdmin
          .from("crawler_courses")
          .select("id, document_id")
          .in("document_id", docIds);

        const courses = coursesData || [];
        const courseIdsByDocMap = new Map<string, string[]>();
        courses.forEach(c => {
          if (c.document_id) {
            if (!courseIdsByDocMap.has(c.document_id)) {
              courseIdsByDocMap.set(c.document_id, []);
            }
            courseIdsByDocMap.get(c.document_id)!.push(c.id);
          }
        });

        // Đếm resources và questions theo từng document một cách an toàn và tối ưu
        const counts = await Promise.all(
          documents.map(async (d) => {
            const docCourseIds = courseIdsByDocMap.get(d.id) || [];
            if (docCourseIds.length === 0) {
              return { docId: d.id, resources_count: 0, questions_count: 0 };
            }

            // Đếm crawler_resources cho document này
            const { count: resCount } = await supabaseAdmin
              .from("crawler_resources")
              .select("*", { count: "exact", head: true })
              .in("course_id", docCourseIds);

            // Đếm crawler_questions cho document này
            const { count: qCount } = await supabaseAdmin
              .from("crawler_questions")
              .select("*", { count: "exact", head: true })
              .in("course_id", docCourseIds);

            return {
              docId: d.id,
              resources_count: resCount || 0,
              questions_count: qCount || 0
            };
          })
        );

        const resourceCountMap = new Map<string, number>();
        const questionCountMap = new Map<string, number>();
        counts.forEach(c => {
          resourceCountMap.set(c.docId, c.resources_count);
          questionCountMap.set(c.docId, c.questions_count);
        });

        // 4. Map kết quả counts và lọc bỏ những document có cả 2 count = 0
        documents = documents
          .map(d => ({
            ...d,
            courses_count: (courseIdsByDocMap.get(d.id) || []).length,
            resources_count: resourceCountMap.get(d.id) || 0,
            questions_count: questionCountMap.get(d.id) || 0
          }))
          .filter(d => d.resources_count > 0 || d.questions_count > 0);
      } else {
        // Mode câu hỏi (lms = false)
        // Chỉ cần đếm count questions từ bảng "questions" cho mỗi document
        const counts = await Promise.all(
          docIds.map(async (docId) => {
            const { count } = await supabaseAdmin
              .from("questions")
              .select("*", { count: "exact", head: true })
              .eq("document_id", docId);
            return { docId, count: count || 0 };
          })
        );

        const questionCountMap = new Map<string, number>();
        counts.forEach(c => {
          questionCountMap.set(c.docId, c.count);
        });

        // Map kết quả counts và chỉ giữ lại những document có câu hỏi (questions_count > 0)
        documents = documents
          .map(d => ({
            ...d,
            courses_count: 0,
            resources_count: 0,
            questions_count: questionCountMap.get(d.id) || 0
          }))
          .filter(d => d.questions_count > 0);
      }
    }

    return {
      id: catData.id,
      title: catData.title,
      logo: catData.logo,
      documents
    };
  };

  const cacheKey = `${CACHE_PREFIX}:category:${id}:${isPremiumUser ? "premium" : "free"}:${lms ? "lms" : "normal"}`;
  return cacheGetOrSet(cacheKey, fetcher, 5 * 60 * 1000);
};

export const listCategories = async (
  isPremiumUser = false,
  lms = false
): Promise<any[]> => {
  const fetcher = async () => {
    let query = supabaseAdmin
      .from("categories")
      .select("id, title, logo, stt, premium, active")
      .eq("active", true)
      .order("stt", { ascending: true });

    if (!isPremiumUser) {
      query = query.eq("premium", false);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error listing categories:", error.message);
      return [];
    }

    let categories = data || [];

    // Nếu ở chế độ bài học (lms), chỉ lấy các categories có chứa bài giảng hoặc câu hỏi
    if (lms && categories.length > 0) {
      const catIds = categories.map(c => c.id);

      // 1. Lấy tất cả documents của các categories này kèm thông tin category_id
      const { data: docsData } = await supabaseAdmin
        .from("documents")
        .select("id, category_id")
        .in("category_id", catIds)
        .eq("active", true);

      const docs = docsData || [];
      if (docs.length > 0) {
        const docIds = docs.map(d => d.id);

        // 2. Lấy toàn bộ crawler_courses của các documents này
        const { data: coursesData } = await supabaseAdmin
          .from("crawler_courses")
          .select("id, document_id")
          .in("document_id", docIds);

        const courses = coursesData || [];
        if (courses.length > 0) {
          const courseIds = courses.map(c => c.id);

          // 3. Đếm xem có resources nào thuộc các courseIds này không
          const { data: resData } = await supabaseAdmin
            .from("crawler_resources")
            .select("course_id")
            .in("course_id", courseIds)
            .limit(1000); // Lấy giới hạn để kiểm tra sự tồn tại

          // 4. Đếm xem có questions nào thuộc các courseIds này không
          const { data: qData } = await supabaseAdmin
            .from("crawler_questions")
            .select("course_id")
            .in("course_id", courseIds)
            .limit(1000);

          const coursesWithContent = new Set<string>();
          (resData || []).forEach(r => {
            if (r.course_id) coursesWithContent.add(r.course_id);
          });
          (qData || []).forEach(q => {
            if (q.course_id) coursesWithContent.add(q.course_id);
          });

          // Tìm các document_id có chứa các course có nội dung
          const docsWithContent = new Set<string>();
          courses.forEach(c => {
            if (c.document_id && coursesWithContent.has(c.id)) {
              docsWithContent.add(c.document_id);
            }
          });

          // Tìm các category_id chứa các document có nội dung
          const categoriesWithContent = new Set<string>();
          docs.forEach(d => {
            if (d.category_id && docsWithContent.has(d.id)) {
              categoriesWithContent.add(d.category_id);
            }
          });

          // Lọc lại danh sách categories
          categories = categories.filter(c => categoriesWithContent.has(c.id));
        } else {
          categories = [];
        }
      } else {
        categories = [];
      }
    }

    return categories;
  };

  const cacheKey = `${CACHE_PREFIX}:categories:list:${isPremiumUser ? "premium" : "free"}:${lms ? "lms" : "normal"}`;
  return cacheGetOrSet(cacheKey, fetcher, 12 * 60 * 60 * 1000);
};



