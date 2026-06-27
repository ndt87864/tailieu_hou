import { supabaseAdmin } from "../config/db.js";
export const searchExamSchedule = async (query) => {
    const q = query.trim();
    if (!q)
        return [];
    const TABLE = "student_infor";
    const isId = /^[A-Za-z0-9_\-]{3,50}$/.test(q);
    if (isId) {
        const { data, error } = await supabaseAdmin
            .from(TABLE)
            .select("*")
            .or(`studentId.eq.${q},username.eq.${q}`)
            .order("examDate", { ascending: true })
            .order("examRoom", { ascending: true })
            .limit(200);
        if (error)
            throw error;
        if (data && data.length > 0) {
            return data.map((d) => ({
                ...d,
                __matchedBy: d.studentId === q ? "studentId" : "username",
            }));
        }
    }
    // Fallback: ilike on fullName
    const { data, error } = await supabaseAdmin
        .from(TABLE)
        .select("*")
        .ilike("fullName", `%${q}%`)
        .order("examDate", { ascending: true })
        .limit(200);
    if (error)
        throw error;
    return (data ?? []).map((d) => ({
        ...d,
        __matchedBy: null,
    }));
};
