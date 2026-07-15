import { Hono } from "hono";
import { supabaseAdmin } from "../config/db.js";
import { requireRole } from "../middlewares/role.js";
import { cacheGetOrSet, cacheInvalidatePrefix, cacheInvalidate } from "../utils/cache.js";

const adminRouter = new Hono();

// Chỉ Admin mới được truy cập các endpoint này
adminRouter.use("*", requireRole("admin"));

// =============================================================
// 1. THỐNG KÊ (DASHBOARD STATS)
// =============================================================
adminRouter.get("/stats", async (c) => {
  try {
    const stats = await cacheGetOrSet(
      "admin:stats",
      async () => {
        // Chạy song song: count queries cùng 1 lúc bằng head: true
        const [
          totalUsersRes,
          adminRes,
          managementRes,
          ultraRes,
          proRes,
          plusRes,
          freeRes,
          catResult,
          docResult,
          qResult,
          stdResult,
        ] = await Promise.all([
          supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }),
          supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).eq("role", "admin"),
          supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).eq("role", "management"),
          supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).eq("role", "ultra"),
          supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).eq("role", "pro"),
          supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).eq("role", "plus"),
          supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).eq("role", "free"),
          supabaseAdmin.from("categories").select("*", { count: "exact", head: true }),
          supabaseAdmin.from("documents").select("*", { count: "exact", head: true }),
          supabaseAdmin.from("questions").select("*", { count: "exact", head: true }),
          supabaseAdmin.from("student_infor").select("*", { count: "exact", head: true }),
        ]);

        if (totalUsersRes.error) {
          console.warn("Could not fetch profiles count for stats:", totalUsersRes.error.message);
        }
        if (catResult.error) {
          console.warn("Could not fetch category counts for stats:", catResult.error.message);
        }
        if (docResult.error) {
          console.warn("Could not fetch document counts for stats:", docResult.error.message);
        }
        if (qResult.error) {
          console.warn("Could not fetch question counts for stats:", qResult.error.message);
        }
        if (stdResult.error) {
          console.warn("Could not fetch student counts for stats:", stdResult.error.message);
        }

        return {
          totalUsers: totalUsersRes.count || 0,
          roles: {
            free: freeRes.count || 0,
            plus: plusRes.count || 0,
            pro: proRes.count || 0,
            ultra: ultraRes.count || 0,
            management: managementRes.count || 0,
            admin: adminRes.count || 0,
          },
          totalCategories: catResult.error ? 0 : catResult.count || 0,
          totalDocuments: docResult.error ? 0 : docResult.count || 0,
          totalQuestions: qResult.error ? 0 : qResult.count || 0,
          totalStudents: stdResult.error ? 0 : stdResult.count || 0,
          activeUsers: Math.floor(Math.random() * 10) + 5,
        };
      },
      30_000 // cache 30 giây
    );

    return c.json({ stats });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// =============================================================
// 2. QUẢN LÝ TÀI KHOẢN (PROFILES CRUD)
// =============================================================

// Lấy danh sách toàn bộ profile
adminRouter.get("/users", async (c) => {
  const { data: users, error } = await supabaseAdmin
    .from("profiles")
    .select(`
      *,
      premium_user (
        category_id,
        document_id
      )
    `)
    .order("updated_at", { ascending: false });

  if (error) {
    console.warn("Could not fetch users list:", error.message);
    return c.json({ users: [] });
  }
  return c.json({ users });
});

// Tạo mới tài khoản (admin tạo hộ)
adminRouter.post("/users", async (c) => {
  try {
    const { email, password, full_name, role, phone } = await c.req.json();
    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    // Tạo user auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, phone },
    });

    if (authError) throw authError;
    if (!authUser.user) throw new Error("Could not create user auth");

    // Cập nhật role & thông tin profile (trigger tạo profile free, ta update lại)
    const { data: profile, error: profError } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name,
        phone: phone || null,
        role: role || "free",
        excel_percentage: null, // Sử dụng cấu hình động mặc định của role
        is_excel_enabled: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", authUser.user.id)
      .select()
      .single();

    if (profError) throw profError;
    return c.json({ success: true, user: profile }, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

// Update profile/role của một user (PUT)
adminRouter.put("/users/:userId", async (c) => {
  const userId = c.req.param("userId");
  try {
    const { role, full_name, phone, avatar_url } = await c.req.json();
    if (role && !["admin", "management", "ultra", "pro", "plus", "free"].includes(role)) {
      return c.json({ error: "Invalid role value" }, 400);
    }

    const updates: any = {};
    if (role !== undefined) {
      updates.role = role;
      updates.excel_percentage = null; // Reset để nhận giá trị mặc định động của role mới
      updates.is_excel_enabled = true;
    }
    if (full_name !== undefined) updates.full_name = full_name;
    if (phone !== undefined) updates.phone = phone;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    updates.updated_at = new Date().toISOString();

    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select()
      .single();

    if (error) throw error;
    return c.json({ success: true, profile });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

// Update profile/role của một user (PATCH)
adminRouter.patch("/users/:userId", async (c) => {
  const userId = c.req.param("userId");
  try {
    const body = await c.req.json();
    if (body.role && !["admin", "management", "ultra", "pro", "plus", "free"].includes(body.role)) {
      return c.json({ error: "Invalid role value" }, 400);
    }

    const updates: any = {
      ...body,
      updated_at: new Date().toISOString(),
    };
    if (body.role !== undefined) {
      updates.excel_percentage = null; // Reset để nhận giá trị mặc định động của role mới
      updates.is_excel_enabled = true;
    }

    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select()
      .single();

    if (error) throw error;
    return c.json({ success: true, profile });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

// Xóa user
adminRouter.delete("/users/:userId", async (c) => {
  const userId = c.req.param("userId");
  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw error;
    return c.json({ success: true, message: "User deleted successfully" });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

// Cổ điển: Endpoint cập nhật riêng quyền (PUT /users/:userId/role)
adminRouter.put("/users/:userId/role", async (c) => {
  const userId = c.req.param("userId");
  const { role } = await c.req.json();

  if (!["admin", "management", "ultra", "pro", "plus", "free"].includes(role)) {
    return c.json({ error: "Invalid role value" }, 400);
  }

  const updates: any = { 
    role, 
    excel_percentage: null, // Reset để nhận giá trị mặc định động của role mới
    is_excel_enabled: true, 
    updated_at: new Date().toISOString() 
  };

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 400);
  return c.json({ success: true, profile });
});

// Lấy danh sách phân quyền (danh mục/tài liệu) của user từ premium_user
adminRouter.get("/users/:userId/premium-access", async (c) => {
  const userId = c.req.param("userId");
  const { data, error } = await supabaseAdmin
    .from("premium_user")
    .select("category_id, document_id")
    .eq("profile_id", userId);
  
  if (error) return c.json({ error: error.message }, 400);

  const categoryIds = data?.map((d) => d.category_id).filter(Boolean) || [];
  const documentIds = data?.map((d) => d.document_id).filter(Boolean) || [];

  return c.json({ categoryIds, documentIds });
});

// Cập nhật phân quyền (danh mục/tài liệu) của user vào premium_user
adminRouter.put("/users/:userId/premium-access", async (c) => {
  const userId = c.req.param("userId");
  const { categoryIds, documentIds } = await c.req.json();
  console.log("PUT premium-access:", { userId, categoryIds, documentIds });

  if (categoryIds && !Array.isArray(categoryIds)) {
    console.error("Invalid categoryIds format:", categoryIds);
    return c.json({ error: "categoryIds must be an array" }, 400);
  }
  if (documentIds && !Array.isArray(documentIds)) {
    console.error("Invalid documentIds format:", documentIds);
    return c.json({ error: "documentIds must be an array" }, 400);
  }

  // Xóa toàn bộ phân quyền cũ của user này
  console.log("Deleting old premium_user records for user:", userId);
  const { error: deleteError } = await supabaseAdmin
    .from("premium_user")
    .delete()
    .eq("profile_id", userId);

  if (deleteError) {
    console.error("Delete old premium_user records error:", deleteError);
    return c.json({ error: deleteError.message }, 400);
  }

  const records: any[] = [];

  // 1. Phân quyền theo category (dành cho pro)
  if (categoryIds && categoryIds.length > 0) {
    categoryIds.forEach((catId: string) => {
      records.push({
        profile_id: userId,
        category_id: catId,
        document_id: null,
      });
    });
  }

  // 2. Phân quyền theo document (dành cho plus), kèm theo category_id của document đó
  if (documentIds && documentIds.length > 0) {
    console.log("Fetching documents category IDs for documentIds:", documentIds);
    const { data: docs, error: docError } = await supabaseAdmin
      .from("documents")
      .select("id, category_id")
      .in("id", documentIds);

    if (docError) {
      console.error("Fetch documents category error:", docError);
      return c.json({ error: docError.message }, 400);
    }

    docs?.forEach((doc) => {
      records.push({
        profile_id: userId,
        category_id: doc.category_id,
        document_id: doc.id,
      });
    });
  }

  console.log("Inserting new premium_user records:", records);
  if (records.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from("premium_user")
      .insert(records);
    if (insertError) {
      console.error("Insert premium_user records error:", insertError);
      return c.json({ error: insertError.message }, 400);
    }
  }

  console.log("Successfully updated premium-access for user:", userId);
  return c.json({ success: true });
});

// =============================================================
// 3. QUẢN LÝ DANH MỤC (CATEGORIES CRUD)
// =============================================================

adminRouter.get("/categories", async (c) => {
  try {
    const categories = await cacheGetOrSet(
      "admin:categories",
      async () => {
        const { data, error } = await supabaseAdmin
          .from("categories")
          .select("*")
          .order("stt", { ascending: true });
        if (error) throw error;
        return data || [];
      },
      5 * 60 * 1000 // Cache 5 minutes
    );
    return c.json({ categories });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

adminRouter.post("/categories", async (c) => {
  try {
    const body = await c.req.json();
    const { title, slug, logo, stt, active, premium } = body;
    const { data: category, error } = await supabaseAdmin
      .from("categories")
      .insert({
        title,
        slug,
        logo,
        stt: stt || 0,
        active: active !== undefined ? active : true,
        premium: premium !== undefined ? premium : false,
      })
      .select()
      .single();

    if (error) throw error;

    // Invalidate caches
    await cacheInvalidate("admin:categories");
    await cacheInvalidatePrefix("docs");

    return c.json({ category }, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

adminRouter.put("/categories/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    const { title, slug, logo, stt, active, premium } = body;
    const updates: Record<string, any> = { title, slug, logo, stt, updated_at: new Date().toISOString() };
    if (active !== undefined) updates.active = active;
    if (premium !== undefined) updates.premium = premium;
    const { data: category, error } = await supabaseAdmin
      .from("categories")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // Invalidate caches
    await cacheInvalidate("admin:categories");
    await cacheInvalidatePrefix("docs");

    return c.json({ category });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

adminRouter.patch("/categories/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    const updates = {
      ...body,
      updated_at: new Date().toISOString(),
    };
    const { data: category, error } = await supabaseAdmin
      .from("categories")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // Invalidate caches
    await cacheInvalidate("admin:categories");
    await cacheInvalidatePrefix("docs");

    return c.json({ category });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

adminRouter.delete("/categories/:id", async (c) => {
  const id = c.req.param("id");
  const { error } = await supabaseAdmin.from("categories").delete().eq("id", id);
  if (error) return c.json({ error: error.message }, 400);

  // Invalidate caches
  await cacheInvalidate("admin:categories");
  await cacheInvalidatePrefix("docs");

  return c.json({ success: true, message: "Category deleted" });
});


// =============================================================
// 3b. QUẢN LÝ TÀI LIỆU (DOCUMENTS CRUD) — Admin toàn quyền
// =============================================================

// Admin lấy TẤT CẢ tài liệu (kể cả inactive / premium)
adminRouter.get("/documents", async (c) => {
  try {
    const { data: documents, error } = await supabaseAdmin
      .from("documents")
      .select("*, category:categories(title, logo, stt)")
      .order("created_at", { ascending: true });

    if (error) throw error;
    return c.json({ documents: documents || [] });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Admin cập nhật tài liệu (bao gồm active / premium)
adminRouter.put("/documents/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    const { title, description, category_id, slug, active, premium } = body;
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (category_id !== undefined) updates.category_id = category_id || null;
    if (slug !== undefined) updates.slug = slug;
    if (active !== undefined) updates.active = active;
    if (premium !== undefined) updates.premium = premium;

    const { data: document, error } = await supabaseAdmin
      .from("documents")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    cacheInvalidatePrefix("docs");
    return c.json({ document });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

// Admin patch tài liệu (quick toggle active / premium)
adminRouter.patch("/documents/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    const updates = { ...body, updated_at: new Date().toISOString() };

    const { data: document, error } = await supabaseAdmin
      .from("documents")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    cacheInvalidatePrefix("docs");
    return c.json({ document });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

// =============================================================
// 4. QUẢN LÝ THÔNG TIN SINH VIÊN (STUDENT_INFOR CRUD)
// =============================================================

adminRouter.get("/students", async (c) => {
  try {
    const search = c.req.query("search") || "";
    const page = parseInt(c.req.query("page") || "1", 10);
    const limit = parseInt(c.req.query("limit") || "50", 10);
    const course = c.req.query("course") || "";
    const subject = c.req.query("subject") || "";
    const majorCode = c.req.query("majorCode") || "";
    const offset = (page - 1) * limit;

    const cacheKey = `students:list:${search}:${page}:${limit}:${course}:${subject}:${majorCode}`;

    const responseData = await cacheGetOrSet(
      cacheKey,
      async () => {
        let query = supabaseAdmin
          .from("student_infor")
          .select("*", { count: "exact" });

        if (search.trim()) {
          query = query.or(`studentId.ilike.%${search}%,fullName.ilike.%${search}%,username.ilike.%${search}%,subject.ilike.%${search}%`);
        }

        if (course.trim()) {
          query = query.eq("course", course.trim());
        }
        if (subject.trim()) {
          query = query.ilike("subject", `%${subject.trim()}%`);
        }
        if (majorCode.trim()) {
          query = query.eq("majorCode", majorCode.trim());
        }

        const { data: students, count, error } = await query
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) throw error;
        return { students: students || [], total: count || 0 };
      },
      30_000 // Cache 30 giây
    );

    return c.json({ students: responseData.students, total: responseData.total, page, limit });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

adminRouter.post("/students/bulk-delete", async (c) => {
  try {
    const { ids } = await c.req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return c.json({ error: "Invalid or empty ids array" }, 400);
    }
    const { error } = await supabaseAdmin
      .from("student_infor")
      .delete()
      .in("id", ids);

    if (error) throw error;
    await cacheInvalidatePrefix("students:");
    return c.json({ success: true, message: `Deleted ${ids.length} students` });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

adminRouter.post("/students/bulk-update", async (c) => {
  try {
    const { ids, updates } = await c.req.json();
    if (!Array.isArray(ids) || ids.length === 0 || !updates) {
      return c.json({ error: "Invalid or empty ids array or updates object" }, 400);
    }
    const { data, error } = await supabaseAdmin
      .from("student_infor")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .in("id", ids)
      .select();

    if (error) throw error;
    await cacheInvalidatePrefix("students:");
    return c.json({ success: true, count: data?.length || 0 });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

adminRouter.post("/students/update-by-match", async (c) => {
  try {
    const { criteria, updates, options } = await c.req.json();
    if (!criteria || Object.keys(criteria).length === 0 || !updates) {
      return c.json({ error: "Invalid criteria or updates" }, 400);
    }

    const { subject, examSession, examTime, examRoom, examDate, majorCode, examType } = criteria;

    let query = supabaseAdmin.from("student_infor").select("*");

    if (examDate) {
      query = query.eq("examDate", examDate);
    }
    if (subject) {
      query = query.eq("subject", subject);
    }
    if (examSession) {
      query = query.eq("examSession", examSession);
    }
    if (examTime) {
      query = query.eq("examTime", examTime);
    }
    if (examRoom) {
      query = query.eq("examRoom", examRoom);
    }
    if (examType) {
      query = query.eq("examType", examType);
    }
    if (majorCode) {
      const codes = String(majorCode).split(",").map(code => code.trim());
      if (codes.length === 1) {
        query = query.eq("majorCode", codes[0]);
      } else {
        query = query.in("majorCode", codes);
      }
    }

    const { data: matches, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    if (!matches || matches.length === 0) {
      return c.json({ success: true, count: 0 });
    }

    let payload: any = {};
    if (options && options.isExamSessionSync) {
      if (updates.examTime !== undefined) {
        payload.examTime = updates.examTime;
      }
    } else {
      payload = { ...updates };
    }

    if (Object.keys(payload).length === 0) {
      return c.json({ success: true, count: 0 });
    }

    const force = options && options.force === true;
    const keys = Object.keys(payload);
    const hasExamLink = keys.includes("examLink");

    if (!hasExamLink || force) {
      const { data: updatedData, error: updateError } = await supabaseAdmin
        .from("student_infor")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .in("id", matches.map(s => s.id))
        .select();

      if (updateError) throw updateError;
      await cacheInvalidatePrefix("students:");
      return c.json({ success: true, count: updatedData?.length || 0 });
    } else {
      const toUpdateIds = matches
        .filter(s => !s.examLink || String(s.examLink).trim() === "")
        .map(s => s.id);

      if (toUpdateIds.length === 0) {
        return c.json({ success: true, count: 0 });
      }

      const { data: updatedData, error: updateError } = await supabaseAdmin
        .from("student_infor")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .in("id", toUpdateIds)
        .select();

      if (updateError) throw updateError;
      await cacheInvalidatePrefix("students:");
      return c.json({ success: true, count: updatedData?.length || 0 });
    }
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

adminRouter.post("/students", async (c) => {
  try {
    const body = await c.req.json();
    const { data, error } = await supabaseAdmin
      .from("student_infor")
      .insert(body)
      .select()
      .single();

    if (error) throw error;
    await cacheInvalidatePrefix("students:");
    return c.json({ student: data }, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

// Import sinh viên hàng loạt (bulk import/upsert) — must be before /:id
adminRouter.post("/students/import", async (c) => {
  try {
    const { list } = await c.req.json();
    if (!Array.isArray(list)) {
      return c.json({ error: "Input 'list' must be an array of students" }, 400);
    }

    // Thực hiện insert/upsert hàng loạt
    const { data, error } = await supabaseAdmin
      .from("student_infor")
      .insert(list)
      .select();

    if (error) throw error;
    await cacheInvalidatePrefix("students:");
    return c.json({ success: true, count: data?.length || 0 });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

adminRouter.put("/students/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    const { data, error } = await supabaseAdmin
      .from("student_infor")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    await cacheInvalidatePrefix("students:");
    return c.json({ student: data });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

adminRouter.patch("/students/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    const { data, error } = await supabaseAdmin
      .from("student_infor")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    await cacheInvalidatePrefix("students:");
    return c.json({ student: data });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

adminRouter.delete("/students/:id", async (c) => {
  const id = c.req.param("id");
  const { error } = await supabaseAdmin.from("student_infor").delete().eq("id", id);
  if (error) return c.json({ error: error.message }, 400);
  await cacheInvalidatePrefix("students:");
  return c.json({ success: true, message: "Student record deleted" });
});

// =============================================================
// X. CẤU HÌNH TỶ LỆ CÂU HỎI (QUESTION RATIOS)
// =============================================================

adminRouter.get("/question-ratios", async (c) => {
  try {
    const { data: ratios, error } = await supabaseAdmin
      .from("question_ratios")
      .select("*")
      .order("role", { ascending: true });

    if (error) throw error;
    return c.json({ ratios: ratios || [] });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

adminRouter.post("/question-ratios", async (c) => {
  try {
    const { ratios } = await c.req.json(); // Array of { role: string, ratio_percent: number, excel_ratio_unpaid?: number, excel_ratio_paid?: number }
    if (!Array.isArray(ratios)) {
      return c.json({ error: "Input 'ratios' must be an array" }, 400);
    }

    // Thực hiện upsert từng tỷ lệ
    for (const item of ratios) {
      if (typeof item.role !== "string" || typeof item.ratio_percent !== "number") {
        return c.json({ error: "Invalid role or ratio_percent format" }, 400);
      }
      if (item.ratio_percent < 0 || item.ratio_percent > 100) {
        return c.json({ error: "ratio_percent must be between 0 and 100" }, 400);
      }
      if (item.excel_ratio_unpaid !== undefined) {
        if (typeof item.excel_ratio_unpaid !== "number" || item.excel_ratio_unpaid < 0 || item.excel_ratio_unpaid > 100) {
          return c.json({ error: "excel_ratio_unpaid must be between 0 and 100" }, 400);
        }
      }
      if (item.excel_ratio_paid !== undefined) {
        if (typeof item.excel_ratio_paid !== "number" || item.excel_ratio_paid < 0 || item.excel_ratio_paid > 100) {
          return c.json({ error: "excel_ratio_paid must be between 0 and 100" }, 400);
        }
      }

      const { error } = await supabaseAdmin
        .from("question_ratios")
        .upsert({
          role: item.role,
          ratio_percent: item.ratio_percent,
          excel_ratio_unpaid: item.excel_ratio_unpaid !== undefined ? item.excel_ratio_unpaid : (item.role === "plus" ? 50 : (item.role === "free" ? 0 : 100)),
          excel_ratio_paid: item.excel_ratio_paid !== undefined ? item.excel_ratio_paid : (item.role === "free" ? 0 : 100),
          updated_at: new Date().toISOString()
        }, { onConflict: "role" });

      if (error) throw error;
    }

    // Xoá cache để update ngay lập tức
    await cacheInvalidate("question:ratios");

    return c.json({ success: true, message: "Question ratios updated successfully" });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// =============================================================
// Y. QUẢN LÝ PHÒNG THI (ROOM_INFOR CRUD - DERIVED FROM STUDENT_INFOR)
// =============================================================

adminRouter.get("/room-infor", async (c) => {
  try {
    const { data: students, error } = await supabaseAdmin
      .from("student_infor")
      .select("examDate, subject, examSession, examTime, examRoom, examType, examLink, majorCode");

    if (error) throw error;

    const roomsMap = new Map();
    (students || []).forEach((s) => {
      if (!s.examRoom) return;
      const key = `${s.examDate || ""}|${s.subject || ""}|${s.examSession || ""}|${s.examTime || ""}|${s.examRoom || ""}|${s.examType || ""}`;
      if (!roomsMap.has(key)) {
        roomsMap.set(key, {
          id: key,
          examDate: s.examDate,
          subject: s.subject,
          examSession: s.examSession,
          examTime: s.examTime,
          examRoom: s.examRoom,
          examLink: s.examLink,
          examType: s.examType,
          majorCode: s.majorCode
        });
      }
    });

    const rooms = Array.from(roomsMap.values());
    return c.json({ rooms });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

adminRouter.post("/room-infor", async (c) => {
  try {
    const body = await c.req.json();
    const { examDate, subject, examSession, examRoom, examLink, examType, examTime, majorCode } = body;
    
    // Find matching students and update their info
    let query = supabaseAdmin.from("student_infor").select("id");
    if (examDate) query = query.eq("examDate", examDate);
    if (subject) query = query.eq("subject", subject);
    if (examSession) query = query.eq("examSession", examSession);
    if (examRoom) query = query.eq("examRoom", examRoom);
    if (examType) query = query.eq("examType", examType);
    
    const { data: matches, error: fetchError } = await query;
    if (fetchError) throw fetchError;
    
    if (matches && matches.length > 0) {
      const ids = matches.map(m => m.id);
      const { error: updateError } = await supabaseAdmin
        .from("student_infor")
        .update({
          examLink,
          examTime,
          majorCode,
          updated_at: new Date().toISOString()
        })
        .in("id", ids);
      if (updateError) throw updateError;
    }
    
    return c.json({ room: body }, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

adminRouter.put("/room-infor/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    const parts = id.split("|");
    const [oldDate, oldSubject, oldSession, oldTime, oldRoom, oldType] = parts;
    
    let query = supabaseAdmin.from("student_infor").select("id");
    if (oldDate) query = query.eq("examDate", oldDate);
    if (oldSubject) query = query.eq("subject", oldSubject);
    if (oldSession) query = query.eq("examSession", oldSession);
    if (oldRoom) query = query.eq("examRoom", oldRoom);
    if (oldType) query = query.eq("examType", oldType);
    
    const { data: matches, error: fetchError } = await query;
    if (fetchError) throw fetchError;
    
    if (matches && matches.length > 0) {
      const ids = matches.map(m => m.id);
      const { error: updateError } = await supabaseAdmin
        .from("student_infor")
        .update({
          examDate: body.examDate || null,
          subject: body.subject,
          examSession: body.examSession,
          examTime: body.examTime,
          examRoom: body.examRoom,
          examLink: body.examLink,
          examType: body.examType,
          majorCode: body.majorCode,
          updated_at: new Date().toISOString()
        })
        .in("id", ids);
      if (updateError) throw updateError;
    }
    
    return c.json({ room: body });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

adminRouter.delete("/room-infor/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const parts = id.split("|");
    const [oldDate, oldSubject, oldSession, oldTime, oldRoom, oldType] = parts;
    
    let query = supabaseAdmin.from("student_infor").delete();
    if (oldDate) query = query.eq("examDate", oldDate);
    if (oldSubject) query = query.eq("subject", oldSubject);
    if (oldSession) query = query.eq("examSession", oldSession);
    if (oldRoom) query = query.eq("examRoom", oldRoom);
    if (oldType) query = query.eq("examType", oldType);
    
    const { error } = await query;
    if (error) throw error;
    return c.json({ success: true, message: "Room records and matching students deleted" });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

// =============================================================
// Z. QUẢN LÝ CA THI (EXAM_SESSIONS CRUD)
// =============================================================

adminRouter.get("/exam-sessions", async (c) => {
  try {
    const { data: sessions, error } = await supabaseAdmin
      .from("exam_sessions")
      .select("*")
      .order("examDate", { ascending: true })
      .order("startTime", { ascending: true });

    if (error) {
      console.warn("Could not fetch exam sessions list:", error.message);
      return c.json({ sessions: [] });
    }
    return c.json({ sessions: sessions || [] });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

adminRouter.post("/exam-sessions", async (c) => {
  try {
    const body = await c.req.json();
    const { data, error } = await supabaseAdmin
      .from("exam_sessions")
      .insert(body)
      .select()
      .single();

    if (error) throw error;
    return c.json({ session: data }, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

adminRouter.put("/exam-sessions/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    const { data, error } = await supabaseAdmin
      .from("exam_sessions")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return c.json({ session: data });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

adminRouter.delete("/exam-sessions/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const { error } = await supabaseAdmin.from("exam_sessions").delete().eq("id", id);
    if (error) throw error;
    return c.json({ success: true, message: "Exam session deleted" });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

// =============================================================
// Z2. QUẢN LÝ GIÁ MÔN HỌC (SUBJECT_PRICES CRUD)
// =============================================================

adminRouter.get("/subject-prices", async (c) => {
  try {
    const { data: prices, error } = await supabaseAdmin
      .from("subject_prices")
      .select("*")
      .order("subject", { ascending: true });

    if (error) throw error;
    return c.json({ prices: prices || [] });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

adminRouter.post("/subject-prices", async (c) => {
  try {
    const body = await c.req.json();
    const { subject, price } = body;
    if (!subject) {
      return c.json({ error: "Subject is required" }, 400);
    }
    const { data, error } = await supabaseAdmin
      .from("subject_prices")
      .insert({ subject, price: price !== undefined ? price : 100000 })
      .select()
      .single();

    if (error) throw error;
    return c.json({ price: data }, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

adminRouter.put("/subject-prices/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    const { subject, price } = body;
    const updates: any = { updated_at: new Date().toISOString() };
    if (subject !== undefined) updates.subject = subject;
    if (price !== undefined) updates.price = price;

    const { data, error } = await supabaseAdmin
      .from("subject_prices")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return c.json({ price: data });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

adminRouter.delete("/subject-prices/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const { error } = await supabaseAdmin.from("subject_prices").delete().eq("id", id);
    if (error) throw error;
    return c.json({ success: true, message: "Subject price deleted" });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

export default adminRouter;
