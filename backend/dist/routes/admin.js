import { Hono } from "hono";
import { supabaseAdmin } from "../config/db.js";
import { requireRole } from "../middlewares/role.js";
const adminRouter = new Hono();
// Chỉ Admin mới được truy cập các endpoint này
adminRouter.use("*", requireRole("admin"));
// =============================================================
// 1. THỐNG KÊ (DASHBOARD STATS)
// =============================================================
adminRouter.get("/stats", async (c) => {
    try {
        // 1. Count users by role
        const { data: users, error: uError } = await supabaseAdmin
            .from("profiles")
            .select("role");
        if (uError)
            throw uError;
        let totalUsers = users?.length || 0;
        let freeCount = 0;
        let plusCount = 0;
        let proCount = 0;
        let ultraCount = 0;
        let managementCount = 0;
        let adminCount = 0;
        users?.forEach((u) => {
            if (u.role === "admin")
                adminCount++;
            else if (u.role === "management")
                managementCount++;
            else if (u.role === "ultra")
                ultraCount++;
            else if (u.role === "pro")
                proCount++;
            else if (u.role === "plus")
                plusCount++;
            else
                freeCount++;
        });
        // 2. Count categories
        const { count: catCount, error: catError } = await supabaseAdmin
            .from("categories")
            .select("*", { count: "exact", head: true });
        if (catError)
            throw catError;
        // 3. Count documents
        const { count: docCount, error: docError } = await supabaseAdmin
            .from("documents")
            .select("*", { count: "exact", head: true });
        if (docError)
            throw docError;
        // 4. Count questions
        const { count: qCount, error: qError } = await supabaseAdmin
            .from("questions")
            .select("*", { count: "exact", head: true });
        if (qError)
            throw qError;
        // 5. Count students
        const { count: stdCount, error: stdError } = await supabaseAdmin
            .from("student_infor")
            .select("*", { count: "exact", head: true });
        if (stdError)
            throw stdError;
        return c.json({
            stats: {
                totalUsers,
                roles: {
                    free: freeCount,
                    plus: plusCount,
                    pro: proCount,
                    ultra: ultraCount,
                    management: managementCount,
                    admin: adminCount,
                },
                totalCategories: catCount || 0,
                totalDocuments: docCount || 0,
                totalQuestions: qCount || 0,
                totalStudents: stdCount || 0,
                activeUsers: Math.floor(Math.random() * 10) + 5, // Mock active users count
            },
        });
    }
    catch (error) {
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
    if (error)
        return c.json({ error: error.message }, 500);
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
        if (authError)
            throw authError;
        if (!authUser.user)
            throw new Error("Could not create user auth");
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
        if (profError)
            throw profError;
        return c.json({ success: true, user: profile }, 201);
    }
    catch (error) {
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
        const updates = {};
        if (role !== undefined)
            updates.role = role;
        if (full_name !== undefined)
            updates.full_name = full_name;
        if (phone !== undefined)
            updates.phone = phone;
        if (avatar_url !== undefined)
            updates.avatar_url = avatar_url;
        updates.updated_at = new Date().toISOString();
        const { data: profile, error } = await supabaseAdmin
            .from("profiles")
            .update(updates)
            .eq("id", userId)
            .select()
            .single();
        if (error)
            throw error;
        return c.json({ success: true, profile });
    }
    catch (error) {
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
        if (error)
            throw error;
        return c.json({ success: true, profile });
    }
    catch (error) {
        return c.json({ error: error.message }, 400);
    }
});
// Xóa user
adminRouter.delete("/users/:userId", async (c) => {
    const userId = c.req.param("userId");
    try {
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (error)
            throw error;
        return c.json({ success: true, message: "User deleted successfully" });
    }
    catch (error) {
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
    if (error)
        return c.json({ error: error.message }, 400);
    return c.json({ success: true, profile });
});
// =============================================================
// 3. QUẢN LÝ DANH MỤC (CATEGORIES CRUD)
// =============================================================
adminRouter.get("/categories", async (c) => {
    const { data: categories, error } = await supabaseAdmin
        .from("categories")
        .select("*")
        .order("stt", { ascending: true });
    if (error)
        return c.json({ error: error.message }, 500);
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
        if (error)
            throw error;
        return c.json({ category }, 201);
    }
    catch (error) {
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
        if (error)
            throw error;
        return c.json({ category });
    }
    catch (error) {
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
        if (error)
            throw error;
        return c.json({ category });
    }
    catch (error) {
        return c.json({ error: error.message }, 400);
    }
});
adminRouter.delete("/categories/:id", async (c) => {
    const id = c.req.param("id");
    const { error } = await supabaseAdmin.from("categories").delete().eq("id", id);
    if (error)
        return c.json({ error: error.message }, 400);
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
        if (error)
            throw error;
        return c.json({ students: students || [], total: count || 0, page, limit });
    }
    catch (error) {
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
        if (error)
            throw error;
        return c.json({ student: data }, 201);
    }
    catch (error) {
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
        if (error)
            throw error;
        return c.json({ student: data });
    }
    catch (error) {
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
        if (error)
            throw error;
        return c.json({ student: data });
    }
    catch (error) {
        return c.json({ error: error.message }, 400);
    }
});
adminRouter.delete("/students/:id", async (c) => {
    const id = c.req.param("id");
    const { error } = await supabaseAdmin.from("student_infor").delete().eq("id", id);
    if (error)
        return c.json({ error: error.message }, 400);
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
        if (error)
            throw error;
        return c.json({ success: true, count: data?.length || 0 });
    }
    catch (error) {
        return c.json({ error: error.message }, 400);
    }
});
export default adminRouter;
