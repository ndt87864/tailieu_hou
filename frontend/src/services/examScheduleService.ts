import { supabase } from "../context/AuthContext.js";
import apiClient from "./client.js";

const TABLE_NAME = "student_infor";

// ─── Normalization Helpers ───────────────────────────────────────────────────
export const replaceUnicodeDashes = (s: string) =>
  s.replace(/[\u2012\u2013\u2014\u2212\u2010\u2011]/g, "-");

export const normalizeWhitespace = (s: string) => s.replace(/\s+/g, " ").trim();

export const normalizeExamTime = (val: any): string => {
  if (val === undefined || val === null) return "";
  try {
    let s = String(val || "");
    s = s.normalize("NFKC");
    s = replaceUnicodeDashes(s);
    s = s.replace(/\s*:\s*/g, "h");
    s = s.replace(/\s*-\s*/g, "-");
    s = s.replace(/\s+/g, "");
    s = s.replace(/\b0+(\d)h/gi, "$1h");
    s = s.toLowerCase();
    return s;
  } catch (e) {
    return String(val || "").trim();
  }
};

export const normalizeString = (val: any): string => {
  if (val === undefined || val === null) return "";
  try {
    let s = String(val || "");
    s = s.normalize("NFKC");
    s = s.replace(/[\u2012\u2013\u2014\u2212\u2010\u2011]/g, "-");
    s = normalizeWhitespace(s);
    return s.toLowerCase();
  } catch (e) {
    return String(val || "").trim().toLowerCase();
  }
};

export const parseDateToYMD = (val: any): string => {
  try {
    if (!val) return "";
    if (typeof val === "string") {
      const s = val.trim();
      const dm = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
      if (dm) {
        let day = dm[1].padStart(2, "0");
        let month = dm[2].padStart(2, "0");
        let year = dm[3];
        if (year.length === 2) year = "20" + year;
        return `${year}-${month}-${day}`;
      }
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        return s.slice(0, 10);
      }
      const maybe = new Date(s);
      if (!isNaN(maybe.getTime())) {
        const year = maybe.getFullYear();
        const month = String(maybe.getMonth() + 1).padStart(2, "0");
        const day = String(maybe.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      }
      return s;
    }
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    return String(val).trim();
  } catch (e) {
    return String(val || "").trim();
  }
};

// ─── Data Access Operations ──────────────────────────────────────────────────
export const getAllStudentInfor = async () => {
  let allData: any[] = [];
  let from = 0;
  const CHUNK_SIZE = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .order("examDate", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + CHUNK_SIZE - 1);

    if (error) throw error;

    if (data && data.length > 0) {
      allData = [...allData, ...data];
      from += CHUNK_SIZE;
      if (data.length < CHUNK_SIZE) {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }

  return allData;
};

export const searchStudentInfor = async (query: string) => {
  if (!query || query.trim() === "") return getAllStudentInfor();
  const raw = query.trim();
  const isLikelyId = /^[A-Za-z0-9_\-]{3,50}$/.test(raw);

  if (isLikelyId) {
    const { data: exactData, error: exactError } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .or(`studentId.eq.${raw},username.eq.${raw}`)
      .order("examDate", { ascending: true })
      .order("examRoom", { ascending: true })
      .order("id", { ascending: true });

    if (exactError) throw exactError;
    if (exactData && exactData.length > 0) {
      return exactData.map((r: any) => {
        const matchedBy =
          r.studentId && String(r.studentId) === raw
            ? "studentId"
            : r.username && String(r.username) === raw
            ? "username"
            : undefined;
        return { ...r, __matchedBy: matchedBy };
      });
    }
  }

  const q = `%${raw}%`;
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .or(`studentId.ilike.${q},fullName.ilike.${q},subject.ilike.${q},username.ilike.${q}`)
    .order("examDate", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw error;
  if (data && data.length > 0) {
    return data.map((r: any) => {
      const matchedBy =
        r.studentId && String(r.studentId) === raw
          ? "studentId"
          : r.username && String(r.username) === raw
          ? "username"
          : undefined;
      return { ...r, __matchedBy: matchedBy };
    });
  }

  return data || [];
};

export const getStudentsByMatch = async (criteria: any = {}) => {
  try {
    const { subject, examSession, examTime, examRoom, examDate, majorCode, examType } = criteria;
    const docs = await getAllStudentInfor();
    if (!docs || docs.length === 0) return [];

    const inputSubject = subject ? normalizeString(subject) : "";
    const inputSession = examSession ? normalizeString(examSession) : "";
    const inputTime = examTime ? normalizeExamTime(examTime) : "";
    const inputRoom = examRoom ? normalizeString(examRoom) : "";
    const inputMajorCode = majorCode ? String(majorCode).trim() : "";
    const inputExamType = examType ? normalizeString(examType) : "";

    let inputRoomLink = "";
    let inputRoomNumber = "";
    if (inputRoom.startsWith("http")) {
      inputRoomLink = inputRoom;
    } else if (inputRoom) {
      inputRoomNumber = inputRoom;
    }

    const inputExamDate = examDate ? parseDateToYMD(examDate) : "";

    return docs.filter((d: any) => {
      if (inputMajorCode) {
        const dbMajorCode = String(d.majorCode || "").trim();
        const inputCodes = inputMajorCode.split(",").map((c) => c.trim());
        if (!inputCodes.includes(dbMajorCode)) return false;
      }
      if (inputExamType) {
        const dbExamType = normalizeString(d.examType || "");
        if (dbExamType !== inputExamType) return false;
      }
      if (inputExamDate) {
        const dbDate = parseDateToYMD(d.examDate || "");
        if (dbDate !== inputExamDate) return false;
      }
      if (inputSubject) {
        const dbSubject = normalizeString(d.subject || "");
        if (dbSubject !== inputSubject) return false;
      }
      if (inputSession) {
        const dbSession = normalizeString(d.examSession || "");
        if (dbSession !== inputSession) return false;
      }
      if (inputTime) {
        const dbTime = normalizeExamTime(d.examTime || "");
        if (dbTime !== inputTime) return false;
      }
      if (inputRoomLink) {
        const dbRoom = normalizeString(d.examRoom || "");
        if (dbRoom !== inputRoomLink) return false;
      } else if (inputRoomNumber) {
        const dbRoom = normalizeString(d.examRoom || "");
        if (dbRoom.startsWith("http")) return false;
        if (dbRoom !== inputRoomNumber) return false;
      }
      return true;
    });
  } catch (err) {
    console.error("getStudentsByMatch error", err);
    return [];
  }
};

export const getStudentsBySessionsOptimized = async (sessions: any[]) => {
  if (!sessions || sessions.length === 0) return [];
  try {
    const CHUNK_SIZE = 10;
    const sessionChunks: any[][] = [];
    for (let i = 0; i < sessions.length; i += CHUNK_SIZE) {
      sessionChunks.push(sessions.slice(i, i + CHUNK_SIZE));
    }

    let allResults: any[] = [];
    for (const chunk of sessionChunks) {
      const filterParts = chunk.map((s) => {
        const parts = [
          `subject.eq."${s.subject}"`,
          `examDate.eq.${parseDateToYMD(s.examDate)}`,
          `examSession.eq."${s.examSession}"`,
          `examRoom.eq."${s.examRoom}"`,
        ];

        if (s.majorCode) {
          const codes = String(s.majorCode).split(",").map((c) => c.trim());
          if (codes.length === 1) {
            parts.push(`majorCode.eq."${codes[0]}"`);
          } else {
            parts.push(`majorCode.in.(${codes.join(",")})`);
          }
        }
        return `and(${parts.join(",")})`;
      });

      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select("*")
        .or(filterParts.join(","));

      if (error) throw error;
      if (data) allResults = [...allResults, ...data];
    }
    return allResults;
  } catch (error) {
    console.error("getStudentsBySessionsOptimized error:", error);
    return [];
  }
};

// ─── Subject Prices Operations ───────────────────────────────────────────────
export const getAllSubjectPrices = async () => {
  const { data, error } = await supabase
    .from("subject_prices")
    .select("*")
    .order("subject", { ascending: true });

  if (error) throw error;
  return data || [];
};

// ─── Registration Queue Operations ───────────────────────────────────────────
export const pushToRegistrationQueue = async (data: any, maxRetries = 3) => {
  const { studentId, selectedIds, fullName, username, billUrl, quantity, totalAmount } = data;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await apiClient.post("/api/v1/exam/register", {
        studentId,
        selectedIds,
        fullName,
        username,
        billUrl,
        quantity,
        totalAmount,
      });

      return { success: true, data: response.data.data };
    } catch (error: any) {
      if (attempt === maxRetries) {
        console.error("Error pushing to registration queue after retries:", error);
        return { success: false, error: error.response?.data?.error || error.message };
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
    }
  }
  return { success: false, error: "Unknown error occurred" };
};
