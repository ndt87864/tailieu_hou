import { supabaseAdmin } from "../config/db.js";

export interface ExamRow {
  id: string;
  studentId: string;
  fullName: string;
  username: string;
  majorCode: string;
  course: string;
  subject: string;
  examDate: string | null;
  examSession: string;
  examTime: string;
  examRoom: string;
  examForm?: string;
  examType?: string;
  status: string;
  examLink: string;
  __matchedBy?: "studentId" | "username" | null;
}

export const searchExamSchedule = async (query: string): Promise<ExamRow[]> => {
  const q = query.trim();
  if (!q) return [];

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

    if (error) {
      console.warn("Could not search exam schedule by ID/username:", error.message);
      return [];
    }
    if (data && data.length > 0) {
      return data.map((d: any) => ({
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

  if (error) {
    console.warn("Could not search exam schedule by fullName:", error.message);
    return [];
  }
  return (data ?? []).map((d: any) => ({
    ...d,
    __matchedBy: null,
  }));
};

export const pushToRegistrationQueue = async (data: any) => {
  const { studentId, selectedIds, fullName, username, billUrl, quantity, totalAmount } = data;
  const idsString = Array.isArray(selectedIds) ? selectedIds.join(",") : selectedIds;

  const payload = {
    student_id: studentId,
    selected_ids: idsString,
    full_name: fullName,
    username: username,
    bill_url: billUrl,
    quantity: quantity,
    total_amount: totalAmount,
    status: "pending",
    retry_count: 0,
  };

  const { data: queueData, error } = await supabaseAdmin
    .from("registration_queue")
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return queueData;
};
