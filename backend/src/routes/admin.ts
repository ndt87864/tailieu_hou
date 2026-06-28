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
        // Chạy song song: users + 4 count queries cùng 1 lúc
        const [
          usersResult,
          catResult,
          docResult,
          qResult,
          stdResult,
        ] = await Promise.all([
          supabaseAdmin.from("profiles").select("role"),
          supabaseAdmin.from("categories").select("*", { count: "exact", head: true }),
          supabaseAdmin.from("documents").select("*", { count: "exact", head: true }),
          supabaseAdmin.from("questions").select("*", { count: "exact", head: true }),
          supabaseAdmin.from("student_infor").select("*", { count: "exact", head: true }),
        ]);

        if (usersResult.error) throw usersResult.error;
        if (catResult.error) throw catResult.error;
        if (docResult.error) throw docResult.error;
        if (qResult.error) throw qResult.error;
        if (stdResult.error) throw stdResult.error;

        let totalUsers = usersResult.data?.length || 0;
        let freeCount = 0, plusCount = 0, proCount = 0;
        let ultraCount = 0, managementCount = 0, adminCount = 0;

        usersResult.data?.forEach((u) => {
          if (u.role === "admin") adminCount++;
          else if (u.role === "management") managementCount++;
          else if (u.role === "ultra") ultraCount++;
          else if (u.role === "pro") proCount++;
          else if (u.role === "plus") plusCount++;
          else freeCount++;
        });

        return {
          totalUsers,
          roles: { free: freeCount, plus: plusCount, pro: proCount, ultra: ultraCount, management: managementCount, admin: adminCount },
          totalCategories: catResult.count || 0,
          totalDocuments: docResult.count || 0,
          totalQuestions: qResult.count || 0,
          totalStudents: stdResult.count || 0,
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
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) return c.json({ error: error.message }, 500);
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
    if (role !== undefined) updates.role = role;
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

    const updates = {
      ...body,
      updated_at: new Date().toISOString(),
    };

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

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .update({ role, updated_at: new Date().toISOString() })
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
  const { data: categories, error } = await supabaseAdmin
    .from("categories")
    .select("*")
    .order("stt", { ascending: true });

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ categories });
});

adminRouter.post("/categories", async (c) => {
  try {
    const body = await c.req.json();
    const { title, slug, logo, stt } = body;
    const { data: category, error } = await supabaseAdmin
      .from("categories")
      .insert({ title, slug, logo, stt: stt || 0 })
      .select()
      .single();

    if (error) throw error;
    return c.json({ category }, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

adminRouter.put("/categories/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    const { title, slug, logo, stt } = body;
    const { data: category, error } = await supabaseAdmin
      .from("categories")
      .update({ title, slug, logo, stt, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
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
    return c.json({ category });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

adminRouter.delete("/categories/:id", async (c) => {
  const id = c.req.param("id");
  const { error } = await supabaseAdmin.from("categories").delete().eq("id", id);
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ success: true, message: "Category deleted" });
});


// =============================================================
// 4. QUẢN LÝ THÔNG TIN SINH VIÊN (STUDENT_INFOR CRUD)
// =============================================================

adminRouter.get("/students", async (c) => {
  try {
    const search = c.req.query("search") || "";
    const page = parseInt(c.req.query("page") || "1", 10);
    const limit = parseInt(c.req.query("limit") || "50", 10);
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("student_infor")
      .select("*", { count: "exact" });

    if (search.trim()) {
      query = query.or(`studentId.ilike.%${search}%,fullName.ilike.%${search}%,username.ilike.%${search}%,subject.ilike.%${search}%`);
    }

    const { data: students, count, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return c.json({ students: students || [], total: count || 0, page, limit });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
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
    return c.json({ student: data }, 201);
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
    return c.json({ student: data });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

adminRouter.delete("/students/:id", async (c) => {
  const id = c.req.param("id");
  const { error } = await supabaseAdmin.from("student_infor").delete().eq("id", id);
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ success: true, message: "Student record deleted" });
});

// Import sinh viên hàng loạt (bulk import/upsert)
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
    return c.json({ success: true, count: data?.length || 0 });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
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
    const { ratios } = await c.req.json(); // Array of { role: string, ratio_percent: number }
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

      const { error } = await supabaseAdmin
        .from("question_ratios")
        .upsert({
          role: item.role,
          ratio_percent: item.ratio_percent,
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

export default adminRouter;
