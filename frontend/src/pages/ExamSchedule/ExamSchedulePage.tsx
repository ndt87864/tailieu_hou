import React, { useState, useCallback } from "react";
import { Search, Calendar, Clock, MapPin, BookOpen, User, Download, AlertCircle, CheckCircle, XCircle, HelpCircle, ChevronDown, ChevronUp, Loader2, ClipboardList } from "lucide-react";
import apiClient from "../../services/client.js";
import { toast } from "react-toastify";
import "../../css/examschedule.css";


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
    className="flex flex-col items-center justify-center p-3 rounded-xl exam-stat-card"
  >
    <span className="exam-stat-value">{value}</span>
    <span className="exam-stat-label">{label}</span>
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
    <div className="exam-outer-container">
      {/* ── Hero Search ── */}
      <div className="exam-hero-container">
        {/* Icon */}
        <div className="exam-hero-icon-container">
          <Calendar className="w-8 h-8 text-white" />
        </div>

        <h1 className="exam-hero-title">
          Tra Cứu Lịch Thi
        </h1>
        <p className="exam-hero-subtitle">
          Tra cứu lịch thi sinh viên nhanh chóng theo mã sinh viên hoặc tài khoản học.
        </p>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="exam-search-form">
          <div className="relative flex-1">
            <Search className="exam-search-icon" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nhập mã sinh viên hoặc tài khoản học..."
              className="exam-search-input"
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="exam-search-btn"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            <span className="hidden sm:inline">Tra Cứu</span>
          </button>
        </form>
      </div>

      {/* ── Not found ── */}
      {searched && rows.length === 0 && !loading && (
        <div className="exam-not-found-container">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 exam-icon-muted" />
          <p className="exam-not-found-title">
            Không tìm thấy kết quả
          </p>
          <p className="exam-not-found-desc">
            Vui lòng kiểm tra lại mã sinh viên hoặc tài khoản học.
          </p>
        </div>
      )}

      {/* ── Results ── */}
      {student && rows.length > 0 && (
        <div className="space-y-5">
          {/* Student Info Card */}
          <div className="exam-student-card">
            <div className="flex flex-col md:flex-row md:items-center gap-5">
              {/* Avatar + Info */}
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="exam-student-avatar">
                  {student.fullName?.charAt(0)?.toUpperCase() ?? "?"}
                </div>
                <div className="min-w-0">
                  <h2 className="exam-student-name">
                    {student.fullName}
                  </h2>
                  <div className="flex flex-wrap gap-3 mt-1">
                    <span className="exam-student-meta">
                      <strong className="exam-student-meta-label">Mã SV:</strong> {student.studentId || "–"}
                    </span>
                    <span className="exam-student-meta">
                      <strong className="exam-student-meta-label">Tài khoản:</strong> {student.username || "–"}
                    </span>
                    <span className="exam-student-meta">
                      <strong className="exam-student-meta-label">Mã ngành:</strong> {majorStr(student.major)}
                    </span>
                    {student.course && (
                      <span className="exam-student-meta">
                        <strong className="exam-student-meta-label">Khóa:</strong> {student.course}
                      </span>
                    )}
                  </div>
                  {student.matchedBy && (
                    <p className="exam-matched-by">
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
          <div className="exam-desktop-table-container">
            <div className="exam-table-header">
              <h3 className="exam-table-header-title">
                <ClipboardList className="w-4 h-4 text-[var(--brand-600)]" />
                Danh sách môn thi
              </h3>
              <span className="exam-table-header-count">{rows.length} môn</span>
            </div>
            <div className="exam-table-body-container">
              <table className="w-full text-sm">
                <thead>
                  <tr className="exam-table-header-row">
                    {["#", "Môn Thi", "Mã ngành", "Ngày Thi", "Ca Thi", "Hình thức", "Giờ Thi", "Phòng", "Điều kiện"].map((h) => (
                      <th key={h} className="exam-table-th">
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
                      <tr key={row.id ?? idx} className="exam-table-row">
                        <td className="exam-table-td text-center font-semibold text-[var(--meta)]">
                          {idx + 1}
                        </td>
                        <td className="exam-table-td font-semibold text-center text-[var(--fg)]">
                          {row.subject}
                        </td>
                        <td className="exam-table-td text-center text-[var(--fg-2)]">
                          {majorStr(row.majorCode)}
                        </td>
                        <td className="exam-table-td text-center text-[var(--fg-2)] whitespace-nowrap">
                          {formatDate(row.examDate)}
                        </td>
                        <td className="exam-table-td text-center text-[var(--fg-2)]">
                          {row.examSession || "–"}
                        </td>
                        <td className="exam-table-td text-center text-[var(--fg-2)]">
                          {row.examForm || "–"}
                        </td>
                        <td className="exam-table-td text-center text-[var(--fg-2)] whitespace-nowrap">
                          {row.examTime || "–"}
                        </td>
                        <td className="exam-table-td text-center font-semibold text-[var(--fg)]">
                          {row.examRoom || "–"}
                        </td>
                        <td className="exam-table-td text-center">
                          <span
                            className="exam-status-badge"
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
                <div key={row.id ?? idx} className="exam-mobile-card">
                  <button
                    className="exam-mobile-card-btn"
                    onClick={() => setExpandedRow(isOpen ? null : (row.id ?? idx))}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="exam-mobile-index">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="exam-mobile-subject">{row.subject}</p>
                        <p className="exam-mobile-datetime">
                          {formatDate(row.examDate)} {row.examTime ? `| ${row.examTime}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className="exam-status-badge"
                        style={{ ...cfg.bgStyle, ...cfg.textStyle }}
                      >
                        {cfg.icon}
                        {label}
                      </span>
                      {isOpen ? <ChevronUp className="w-4 h-4 exam-icon-muted" /> : <ChevronDown className="w-4 h-4 exam-icon-muted" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="exam-mobile-expanded-content">
                      {[
                        { icon: <MapPin className="w-3.5 h-3.5" />, label: "Phòng", value: row.examRoom || "–" },
                        { icon: <Clock className="w-3.5 h-3.5" />, label: "Ca thi", value: row.examSession || "–" },
                        { icon: <BookOpen className="w-3.5 h-3.5" />, label: "Hình thức", value: row.examForm || "–" },
                        { icon: <User className="w-3.5 h-3.5" />, label: "Mã ngành", value: majorStr(row.majorCode) },
                      ].map((item) => (
                        <div key={item.label}>
                          <div className="exam-mobile-detail-label">
                            {item.icon} {item.label}
                          </div>
                          <p className="exam-mobile-detail-value">{item.value}</p>
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
            className="rounded-xl p-4 flex items-center gap-3 exam-download-bar"
          >
            <Download className="w-4 h-4 shrink-0 exam-download-icon" />
            <p className="exam-download-text">
              Dữ liệu lịch thi được cập nhật từ hệ thống. Hãy kiểm tra lại trên cổng thông tin chính thức trước ngày thi.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamSchedulePage;
