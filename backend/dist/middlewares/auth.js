import { supabaseClient, supabaseAdmin } from "../config/db.js";
export const authMiddleware = async (c, next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        c.set("user", null);
        c.set("role", "guest");
        return await next();
    }
    const token = authHeader.split(" ")[1];
    const { data: { user }, error } = await supabaseClient.auth.getUser(token);
    if (error || !user) {
        c.set("user", null);
        c.set("role", "guest");
        return await next();
    }
    // Lấy role từ bảng profiles bằng service_role
    const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
    c.set("user", user);
    c.set("role", profile?.role || "free");
    await next();
};
