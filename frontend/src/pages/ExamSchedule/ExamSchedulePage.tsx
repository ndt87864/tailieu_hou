import React, { useState, useCallback } from "react";
import { Search, Calendar, Clock, MapPin, BookOpen, User, Download, AlertCircle, CheckCircle, XCircle, HelpCircle, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import apiClient from "../../services/client.js";
import { toast } from "react-toastify";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ExamRow {
  id: string | number;
  studentId: string;
  fullName: string;
  username: string;
  majorCode: string | string[];
  course: string;
  subject: string;
  examDate: string | null;
  examSession: string;
  examTime: string;
  examRoom: string;
  examForm: string;
  status: string;
  examLink: string;
}

interface StudentSummary {
  fullName: string;
  studentId: string;
  username: string;
  major: string | string[];
  course: string;
  totalExams: number;
  matchedBy: "studentId" | "username" | null;
}

// ─── Status helpers ───────────────────────────────────────────────────────────
type StatusKey = "eligible" | "ineligible" | "retake" | "unknown";

function parseStatus(raw: string): { key: StatusKey; label: string } {
  const s = (raw ?? "").toString().trim();
  const lower = s.toLowerCase();
  if (lower === "eligible" || s === "Đủ điều kiện")
    return { key: "eligible", label: "Đủ điều kiện" };
  if (lower === "ineligible" || s === "Không đủ điều kiện" || s === "Thiếu điều kiện" || s === "Cấm thi")
    return { key: "ineligible", label: s === "Thiếu điều kiện" || s === "Cấm thi" ? s : "Không đủ điều kiện" };
  if (s === "Thi lại" || s === "Thi cải thiện")
    return { key: "retake", label: s };
  return { key: "unknown", label: s || "Không xác định" };
}

const STATUS_CONFIG: Record<StatusKey, { icon: React.ReactNode; bgStyle: React.CSSProperties; textStyle: React.CSSProperties }> = {
  eligible: {
    icon: <CheckCircle className="w-3.5 h-3.5" />,
    bgStyle: { background: "rgba(17,141,5,0.1)", border: "1px solid rgba(17,141,5,0.3)" },
    textStyle: { color: "#118d05" },
  },
  ineligible: {
    icon: <XCircle className="w-3.5 h-3.5" />,
    bgStyle: { background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)" },
    textStyle: { color: "#dc2626" },
  },
  retake: {
    icon: <AlertCircle className="w-3.5 h-3.5" />,
    bgStyle: { background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" },
    textStyle: { color: "#d97706" },
  },
  unknown: {
    icon: <HelpCircle className="w-3.5 h-3.5" />,
    bgStyle: { background: "rgba(100,116,139,0.1)", border: "1px solid rgba(100,116,139,0.3)" },
    textStyle: { color: "#64748b" },
  },
};

// ─── API search ──────────────────────────────────────────────────────────────
async function searchStudent(query: string): Promise<ExamRow[]> {
  const { data } = await apiClient.get<{ results: ExamRow[] }>(
    `/api/v1/exam/search?q=${encodeURIComponent(query)}`
  );
  return data.results;
}

// ─── Stat Badge ──────────────────────────────────────────────────────────────
const StatBadge: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div
    className="flex flex-col items-center justify-center p-3 rounded-xl"
    style={{ background: "var(--bg-2)", border: "1px solid var(--border-soft)" }}
  >
    <span style={{ color: "var(--brand-600)", fontSize: "1.5rem", fontWeight: 800, lineHeight: 1 }}>{value}</span>
    <span style={{ color: "var(--muted)", fontSize: "0.7rem", marginTop: 4 }}>{label}</span>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────
const ExamSchedulePage: React.FC = () => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ExamRow[]>([]);
  const [student, setStudent] = useState<StudentSummary | null>(null);
  const [searched, setSearched] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | number | null>(null);

  const handleSearch = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q) {
      toast.info("Vui lòng nhập mã sinh viên hoặc tên");
      return;
    }

    setLoading(true);
    setRows([]);
    setStudent(null);

    try {
      const data = await searchStudent(q);
      if (data.length === 0) {
        setSearched(true);
        toast.warn("Không tìm thấy thông tin lịch thi cho mã này.");
      } else {
        const first: any = data[0];
        setStudent({
          fullName: first.fullName,
          studentId: first.studentId,
          username: first.username,
          major: first.majorCode,
          course: first.course,
          totalExams: data.length,
          matchedBy: first.__matchedBy ?? null,
        });
        setRows(data);
        setSearched(true);
      }
    } catch (err) {
      console.error(err);
      toast.error("Không kết nối được đến máy chủ. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  const countByStatus = (key: StatusKey) =>
    rows.filter((r) => parseStatus(r.status).key === key).length;

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("vi-VN") : "–";

  const majorStr = (m: string | string[] | null | undefined) =>
    Array.isArray(m) ? m.join(", ") : m || "–";

  return (
    <div style={{ minHeight: "60vh" }}>
      {/* ── Hero Search ── */}
      <div
        className="rounded-2xl p-8 mb-6 text-center"
        style={{
          background: "linear-gradient(135deg, color-mix(in srgb, var(--brand-600) 8%, transparent), color-mix(in srgb, var(--brand-400) 4%, transparent))",
          border: "1px solid color-mix(in srgb, var(--brand-600) 20%, transparent)",
        }}
      >
        {/* Icon */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"
          style={{ background: "linear-gradient(135deg, var(--brand-700), var(--brand-500))" }}
        >
          <Calendar className="w-8 h-8 text-white" />
        </div>

        <h1 style={{ color: "var(--fg)", fontSize: "2rem", fontWeight: 800, marginBottom: 8 }}>
          Tra Cứu Lịch Thi
        </h1>
        <p style={{ color: "var(--muted)", marginBottom: 28, maxWidth: 480, margin: "0 auto 28px" }}>
          Tra cứu lịch thi sinh viên nhanh chóng theo mã sinh viên hoặc tài khoản học.
        </p>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="max-w-xl mx-auto flex gap-3">
          <div className="relative flex-1">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
              style={{ color: "var(--muted)" }}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nhập mã sinh viên hoặc tài khoản học..."
              className="input w-full pl-12 pr-4 py-4 text-base font-medium"
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-brand px-6 py-4 flex items-center gap-2 font-bold text-base shrink-0"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            <span className="hidden sm:inline">Tra Cứu</span>
          </button>
        </form>
      </div>

      {/* ── Not found ── */}
      {searched && rows.length === 0 && !loading && (
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <AlertCircle className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--muted)" }} />
          <p style={{ color: "var(--fg)", fontWeight: 600, fontSize: "1.1rem" }}>
            Không tìm thấy kết quả
          </p>
          <p style={{ color: "var(--muted)", marginTop: 6, fontSize: "0.875rem" }}>
            Vui lòng kiểm tra lại mã sinh viên hoặc tài khoản học.
          </p>
        </div>
      )}

      {/* ── Results ── */}
      {student && rows.length > 0 && (
        <div className="space-y-5">
          {/* Student Info Card */}
          <div
            className="rounded-2xl p-6"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="flex flex-col md:flex-row md:items-center gap-5">
              {/* Avatar + Info */}
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold shrink-0 shadow"
                  style={{ background: "linear-gradient(135deg, var(--brand-700), var(--brand-500))" }}
                >
                  {student.fullName?.charAt(0)?.toUpperCase() ?? "?"}
                </div>
                <div className="min-w-0">
                  <h2 style={{ color: "var(--fg)", fontSize: "1.25rem", fontWeight: 700 }} className="truncate">
                    {student.fullName}
                  </h2>
                  <div className="flex flex-wrap gap-3 mt-1">
                    <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                      <strong style={{ color: "var(--fg-2)" }}>Mã SV:</strong> {student.studentId || "–"}
                    </span>
                    <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                      <strong style={{ color: "var(--fg-2)" }}>Tài khoản:</strong> {student.username || "–"}
                    </span>
                    <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                      <strong style={{ color: "var(--fg-2)" }}>Mã ngành:</strong> {majorStr(student.major)}
                    </span>
                    {student.course && (
                      <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                        <strong style={{ color: "var(--fg-2)" }}>Khóa:</strong> {student.course}
                      </span>
                    )}
                  </div>
                  {student.matchedBy && (
                    <p style={{ color: "var(--meta)", fontSize: "0.7rem", marginTop: 4 }}>
                      Khớp theo: {student.matchedBy === "studentId" ? "Mã sinh viên" : "Tài khoản học"}
                    </p>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="flex gap-3 shrink-0">
                <StatBadge label="Môn cần thi" value={String(student.totalExams).padStart(2, "0")} />
                <StatBadge label="Đủ điều kiện" value={countByStatus("eligible")} />
                <StatBadge label="Thi lại/CThiện" value={countByStatus("retake")} />
              </div>
            </div>
          </div>

          {/* Desktop Table */}
          <div
            className="rounded-2xl overflow-hidden hidden md:block"
            style={{ border: "1px solid var(--border)" }}
          >
            <div
              style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)", padding: "14px 20px" }}
              className="flex items-center justify-between"
            >
              <h3 style={{ color: "var(--fg)", fontWeight: 700, fontSize: "0.95rem" }}>
                📋 Danh sách môn thi
              </h3>
              <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>{rows.length} môn</span>
            </div>
            <div style={{ background: "var(--surface)", overflowX: "auto" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-soft)" }}>
                    {["#", "Môn Thi", "Mã ngành", "Ngày Thi", "Ca Thi", "Hình thức", "Giờ Thi", "Phòng", "Điều kiện"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-center whitespace-nowrap"
                        style={{ color: "var(--meta)", fontWeight: 600, fontSize: "0.75rem", letterSpacing: "0.05em" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const { key, label } = parseStatus(row.status);
                    const cfg = STATUS_CONFIG[key];
                    return (
                      <tr
                        key={row.id ?? idx}
                        style={{ borderBottom: "1px solid var(--border-soft)" }}
                        className="hover:bg-[var(--bg-2)] transition-colors"
                      >
                        <td className="px-4 py-4 text-center" style={{ color: "var(--meta)", fontWeight: 600 }}>
                          {idx + 1}
                        </td>
                        <td className="px-4 py-4 font-semibold text-center" style={{ color: "var(--fg)" }}>
                          {row.subject}
                        </td>
                        <td className="px-4 py-4 text-center" style={{ color: "var(--fg-2)" }}>
                          {majorStr(row.majorCode)}
                        </td>
                        <td className="px-4 py-4 text-center whitespace-nowrap" style={{ color: "var(--fg-2)" }}>
                          {formatDate(row.examDate)}
                        </td>
                        <td className="px-4 py-4 text-center" style={{ color: "var(--fg-2)" }}>
                          {row.examSession || "–"}
                        </td>
                        <td className="px-4 py-4 text-center" style={{ color: "var(--fg-2)" }}>
                          {row.examForm || "–"}
                        </td>
                        <td className="px-4 py-4 text-center whitespace-nowrap" style={{ color: "var(--fg-2)" }}>
                          {row.examTime || "–"}
                        </td>
                        <td className="px-4 py-4 text-center font-semibold" style={{ color: "var(--fg)" }}>
                          {row.examRoom || "–"}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
                            style={{ ...cfg.bgStyle, ...cfg.textStyle }}
                          >
                            {cfg.icon}
                            {label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {rows.map((row, idx) => {
              const { key, label } = parseStatus(row.status);
              const cfg = STATUS_CONFIG[key];
              const isOpen = expandedRow === (row.id ?? idx);
              return (
                <div
                  key={row.id ?? idx}
                  className="rounded-2xl overflow-hidden"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <button
                    className="w-full flex items-center justify-between p-4 text-left"
                    onClick={() => setExpandedRow(isOpen ? null : (row.id ?? idx))}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 text-white"
                        style={{ background: "var(--brand-600)" }}
                      >
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p style={{ color: "var(--fg)", fontWeight: 700 }} className="truncate">{row.subject}</p>
                        <p style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                          {formatDate(row.examDate)} {row.examTime ? `| ${row.examTime}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ ...cfg.bgStyle, ...cfg.textStyle }}
                      >
                        {cfg.icon}
                        {label}
                      </span>
                      {isOpen ? <ChevronUp className="w-4 h-4" style={{ color: "var(--muted)" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "var(--muted)" }} />}
                    </div>
                  </button>

                  {isOpen && (
                    <div style={{ borderTop: "1px solid var(--border-soft)", padding: "12px 16px" }} className="grid grid-cols-2 gap-3">
                      {[
                        { icon: <MapPin className="w-3.5 h-3.5" />, label: "Phòng", value: row.examRoom || "–" },
                        { icon: <Clock className="w-3.5 h-3.5" />, label: "Ca thi", value: row.examSession || "–" },
                        { icon: <BookOpen className="w-3.5 h-3.5" />, label: "Hình thức", value: row.examForm || "–" },
                        { icon: <User className="w-3.5 h-3.5" />, label: "Mã ngành", value: majorStr(row.majorCode) },
                      ].map((item) => (
                        <div key={item.label}>
                          <div className="flex items-center gap-1 mb-0.5" style={{ color: "var(--meta)", fontSize: "0.7rem" }}>
                            {item.icon} {item.label}
                          </div>
                          <p style={{ color: "var(--fg-2)", fontSize: "0.85rem", fontWeight: 600 }}>{item.value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Export Note */}
          <div
            className="rounded-xl p-4 flex items-center gap-3"
            style={{ background: "var(--bg-2)", border: "1px solid var(--border-soft)" }}
          >
            <Download className="w-4 h-4 shrink-0" style={{ color: "var(--brand-600)" }} />
            <p style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
              Dữ liệu lịch thi được cập nhật từ hệ thống. Hãy kiểm tra lại trên cổng thông tin chính thức trước ngày thi.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamSchedulePage;
