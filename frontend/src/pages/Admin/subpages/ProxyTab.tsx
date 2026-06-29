import React, { useState, useEffect, useRef, useMemo } from "react";
import { Search, RefreshCw, Download, Eye, X, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import { useConfirm } from "../../../context/ConfirmContext.js";
import { supabase } from "../../../context/AuthContext.js";
import * as XLSX from "xlsx";

interface Registration {
  id: string;
  student_id: string;
  selected_ids: string;
  full_name: string;
  username: string;
  bill_url: string;
  quantity: number;
  total_amount: number;
  status: string;
  updated_at: string;
  course?: string;
}

export const ProxyTab: React.FC = () => {
  const confirm = useConfirm();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReg, setSelectedReg] = useState<Registration | null>(null);
  const [subjectNames, setSubjectNames] = useState<Record<string, { name: string; link?: string }>>({});
  const [modalLoading, setModalLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState(false);
  const courseDropdownRef = useRef<HTMLDivElement>(null);

  const uniqueCourses = useMemo(() => {
    const courses = registrations
      .map((r) => r.course)
      .filter((c): c is string => !!c && c.trim() !== "");
    return Array.from(new Set(courses)).sort();
  }, [registrations]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        courseDropdownRef.current &&
        !courseDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCourseDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchRegistrations = async () => {
    try {
      setLoading(true);
      const { data: regData, error: regError } = await supabase
        .from("proxy_registrations")
        .select("*")
        .order("updated_at", { ascending: false });

      if (regError) throw regError;

      const studentIds = Array.from(
        new Set((regData || []).map((r) => r.student_id).filter(Boolean))
      );

      if (studentIds.length > 0) {
        const { data: studentData, error: studentError } = await supabase
          .from("student_infor")
          .select("studentId, course")
          .in("studentId", studentIds);

        if (!studentError && studentData) {
          const courseMap: Record<string, string> = {};
          studentData.forEach((s) => {
            if (s.studentId && s.course) {
              courseMap[s.studentId] = s.course;
            }
          });

          const enrichedData = (regData || []).map((r) => ({
            ...r,
            course: courseMap[r.student_id] || "Không rõ",
          }));
          setRegistrations(enrichedData);
        } else {
          setRegistrations(regData || []);
        }
      } else {
        setRegistrations(regData || []);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      toast.error("Không thể tải danh sách đăng ký.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistrations();
  }, []);

  const handleApprove = async (id: string) => {
    const isConfirmed = await confirm({
      title: "Xác nhận duyệt",
      message: "Bạn có chắc chắn muốn duyệt yêu cầu đăng ký này?",
      confirmText: "Duyệt",
      cancelText: "Hủy",
      type: "info",
    });
    if (!isConfirmed) return;

    try {
      const { error } = await supabase
        .from("proxy_registrations")
        .update({ status: "approved" })
        .eq("id", id);

      if (error) throw error;
      toast.success("Đã duyệt đăng ký thành công!");
      fetchRegistrations();
    } catch (err) {
      console.error("Approve error:", err);
      toast.error("Lỗi khi duyệt đăng ký.");
    }
  };

  const handleShowDetails = async (reg: Registration) => {
    setSelectedReg(reg);
    setModalLoading(true);
    try {
      if (!reg.selected_ids) {
        setSubjectNames({});
        return;
      }
      const ids = reg.selected_ids.split(",").filter((id) => id.trim() !== "");
      if (ids.length === 0) {
        setSubjectNames({});
        return;
      }
      const { data, error } = await supabase
        .from("student_infor")
        .select("id, subject, examLink")
        .in("id", ids);

      if (!error && data) {
        const dataMap: Record<string, { name: string; link?: string }> = {};
        data.forEach((item) => {
          dataMap[item.id] = {
            name: item.subject,
            link: item.examLink || undefined,
          };
        });
        setSubjectNames(dataMap);
      }
    } catch (err) {
      console.error("Details error:", err);
    } finally {
      setModalLoading(false);
    }
  };

  const handleExportExcel = () => {
    try {
      if (filteredRegistrations.length === 0) {
        toast.warn("Không có dữ liệu để xuất.");
        return;
      }

      const exportData = filteredRegistrations.map((reg, index) => ({
        "STT": index + 1,
        "Mã sinh viên": reg.student_id || "",
        "Tên sinh viên": reg.full_name || "",
        "Khóa": reg.course || "N/A",
        "Số môn": reg.quantity || 0,
        "Tổng tiền": Number(reg.total_amount) || 0,
        "Thời gian": formatDateTime(reg.updated_at),
        "Trạng thái": reg.status === "approved" ? "Đã duyệt" : "Chờ duyệt",
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Danh sach dang ky");

      const wscols = [
        { wch: 5 },  // STT
        { wch: 15 }, // MSSV
        { wch: 25 }, // Tên
        { wch: 10 }, // Khóa
        { wch: 10 }, // Số môn
        { wch: 15 }, // Tổng tiền
        { wch: 25 }, // Thời gian
        { wch: 15 }, // Trạng thái
      ];
      ws["!cols"] = wscols;

      XLSX.writeFile(wb, `Danh_sach_dang_ky_mon_hoc_${new Date().getTime()}.xlsx`);
      toast.success("Đã xuất file Excel thành công!");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Lỗi khi xuất file Excel.");
    }
  };

  const getBillList = (urlStr: string) => {
    if (!urlStr) return [];
    return urlStr.split(",").filter((url) => url.trim() !== "");
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    const hh = String(date.getHours()).padStart(2, "0");
    const ii = String(date.getMinutes()).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    return `${hh}:${ii} ${dd}/${mm}/${yyyy}`;
  };

  const filteredRegistrations = registrations.filter((reg) => {
    const matchesSearch =
      reg.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reg.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reg.student_id?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || reg.status === statusFilter;
    const matchesCourse = courseFilter === "all" || reg.course === courseFilter;

    return matchesSearch && matchesStatus && matchesCourse;
  });

  const totalSum = filteredRegistrations.reduce(
    (sum, reg) => sum + (Number(reg.total_amount) || 0),
    0
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="modal-heading text-base font-bold">Quản lý Đăng ký môn học</h3>
        <div className="flex w-full sm:w-auto gap-2">
          <button
            onClick={handleExportExcel}
            className="btn-brand text-xs flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Xuất Excel
          </button>
          <button
            onClick={fetchRegistrations}
            className="btn-brand text-xs flex items-center gap-1.5 px-3 py-2 bg-[var(--surface-2)] text-[var(--fg)] border border-[var(--border)] rounded-xl hover:bg-[var(--bg-2)] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-500" /> Làm mới
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Tìm tên sinh viên hoặc MSSV..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-themed w-full px-3 py-2 pl-9 text-sm rounded-xl outline-none"
          />
          <Search className="w-4 h-4 text-muted absolute left-3 top-3" />
        </div>

        <div className="flex gap-2 flex-wrap">
          {/* Status buttons */}
          {["all", "pending", "approved"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                statusFilter === status
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-[var(--surface-2)] text-[var(--fg-2)] border-[var(--border)] hover:bg-[var(--bg-2)]"
              }`}
            >
              {status === "all" ? "TẤT CẢ" : status === "approved" ? "ĐÃ DUYỆT" : "CHỜ DUYỆT"}
            </button>
          ))}

          {/* Course select */}
          <div className="relative" ref={courseDropdownRef}>
            <button
              onClick={() => setIsCourseDropdownOpen(!isCourseDropdownOpen)}
              className="px-3 py-2 rounded-xl text-xs font-semibold border bg-[var(--surface-2)] text-[var(--fg-2)] border-[var(--border)] hover:bg-[var(--bg-2)] flex items-center gap-1 transition-colors"
            >
              <span>{courseFilter === "all" ? "TẤT CẢ KHÓA" : courseFilter}</span>
              <X
                className="w-3 h-3 hover:text-red-500 cursor-pointer ml-1"
                onClick={(e) => {
                  e.stopPropagation();
                  setCourseFilter("all");
                }}
              />
            </button>
            {isCourseDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl shadow-2xl border bg-[var(--surface-3)] border-[var(--border)] z-50 overflow-hidden py-1 max-h-48 overflow-y-auto">
                <button
                  onClick={() => {
                    setCourseFilter("all");
                    setIsCourseDropdownOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-2)] text-[var(--fg)]"
                >
                  Tất cả khóa
                </button>
                {uniqueCourses.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setCourseFilter(c);
                      setIsCourseDropdownOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-2)] text-[var(--fg)]"
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="card p-4 flex justify-between items-center bg-blue-500/5 border border-blue-500/10 rounded-2xl">
        <div className="text-xs font-bold text-blue-500">
          Tổng số bill: {filteredRegistrations.length} | Tổng tiền: {totalSum.toLocaleString()}đ
        </div>
      </div>

      {/* Table - Desktop View */}
      <div className="card overflow-hidden hidden md:block">
        <table className="table-themed w-full text-left border-collapse">
          <thead>
            <tr>
              <th className="p-3 text-xs font-bold opacity-75">STT</th>
              <th className="p-3 text-xs font-bold opacity-75">Sinh viên</th>
              <th className="p-3 text-xs font-bold opacity-75">Khóa</th>
              <th className="p-3 text-xs font-bold opacity-75">Số môn</th>
              <th className="p-3 text-xs font-bold opacity-75">Tổng tiền</th>
              <th className="p-3 text-xs font-bold opacity-75">Thời gian</th>
              <th className="p-3 text-xs font-bold opacity-75">Trạng thái</th>
              <th className="p-3 text-xs font-bold opacity-75 text-center">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {filteredRegistrations.map((reg, idx) => (
              <tr key={reg.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-2)] transition-colors">
                <td className="p-3 text-xs font-medium text-muted">{idx + 1}</td>
                <td className="p-3">
                  <div className="text-xs font-bold">{reg.full_name}</div>
                  <div className="text-[10px] text-muted">{reg.student_id}</div>
                </td>
                <td className="p-3 text-xs font-semibold">{reg.course || "N/A"}</td>
                <td className="p-3 text-xs font-semibold text-orange-500">{reg.quantity} Môn</td>
                <td className="p-3 text-xs font-bold">{reg.total_amount.toLocaleString()}đ</td>
                <td className="p-3 text-[10px] text-muted">{formatDateTime(reg.updated_at)}</td>
                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      reg.status === "approved"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-amber-500/10 text-amber-600"
                    }`}
                  >
                    {reg.status === "approved" ? "ĐÃ DUYỆT" : "CHỜ DUYỆT"}
                  </span>
                </td>
                <td className="p-3 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    {reg.status !== "approved" && (
                      <button
                        onClick={() => handleApprove(reg.id)}
                        className="p-1 px-2.5 bg-emerald-500 text-white rounded text-[10px] font-bold hover:bg-emerald-600 transition-colors"
                      >
                        Duyệt
                      </button>
                    )}
                    <button
                      onClick={() => handleShowDetails(reg)}
                      className="p-1 px-2.5 bg-blue-500 text-white rounded text-[10px] font-bold hover:bg-blue-600 transition-colors flex items-center gap-0.5"
                    >
                      <Eye className="w-3 h-3" /> Chi tiết
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredRegistrations.length === 0 && (
              <tr>
                <td colSpan={8} className="p-10 text-center text-xs text-muted">
                  Không có yêu cầu đăng ký môn học hộ nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List View */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {filteredRegistrations.length === 0 ? (
          <div className="card p-6 text-center text-sm text-[var(--fg-2)]">
            Không có yêu cầu đăng ký môn học hộ nào.
          </div>
        ) : (
          filteredRegistrations.map((reg) => (
            <div key={reg.id} className="admin-mobile-card">
              <div className="admin-mobile-card-header">
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{reg.full_name}</div>
                  <div className="text-[10px] text-[var(--muted)]">
                    MSSV: {reg.student_id} • Khóa: {reg.course || "N/A"}
                  </div>
                </div>
                <span
                  className={`ml-auto px-2 py-0.5 rounded text-[10px] font-bold ${
                    reg.status === "approved"
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-amber-500/10 text-amber-600"
                  }`}
                >
                  {reg.status === "approved" ? "ĐÃ DUYỆT" : "CHỜ DUYỆT"}
                </span>
              </div>

              <div className="admin-mobile-card-body">
                <div className="admin-mobile-card-row">
                  <span className="admin-mobile-card-label">Số lượng môn:</span>
                  <span className="admin-mobile-card-value text-orange-500 font-semibold">{reg.quantity} Môn</span>
                </div>
                <div className="admin-mobile-card-row">
                  <span className="admin-mobile-card-label">Tổng tiền:</span>
                  <span className="admin-mobile-card-value text-brand-600 font-bold">{reg.total_amount.toLocaleString()}đ</span>
                </div>
                <div className="admin-mobile-card-row">
                  <span className="admin-mobile-card-label">Thời gian:</span>
                  <span className="admin-mobile-card-value text-[10px]">{formatDateTime(reg.updated_at)}</span>
                </div>
              </div>

              <div className="admin-mobile-card-footer">
                {reg.status !== "approved" && (
                  <button
                    onClick={() => handleApprove(reg.id)}
                    className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-semibold hover:bg-emerald-600 transition-colors"
                  >
                    Duyệt
                  </button>
                )}
                <button
                  onClick={() => handleShowDetails(reg)}
                  className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-semibold hover:bg-blue-600 transition-colors flex items-center gap-1 ml-auto"
                >
                  <Eye className="w-3.5 h-3.5" /> Chi tiết
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Details Modal */}
      {selectedReg && (
        <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)] shrink-0">
              <h3 className="modal-heading text-base font-bold">Chi tiết Đăng ký môn</h3>
              <button
                onClick={() => setSelectedReg(null)}
                className="p-1 rounded-lg hover:bg-red-500/10 text-muted hover:text-red-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column: Subjects */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted">Môn học đã chọn</h4>
                <div className="space-y-2">
                  {selectedReg.selected_ids
                    .split(",")
                    .filter(Boolean)
                    .map((id) => (
                      <div key={id} className="p-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl">
                        <div className="text-xs font-bold text-[var(--fg)]">
                          {subjectNames[id]?.name || (modalLoading ? "Đang tải..." : `Môn học ID: ${id}`)}
                        </div>
                        {subjectNames[id]?.link && (
                          <a
                            href={subjectNames[id].link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-blue-500 hover:underline mt-1 block"
                          >
                            Đường link ca thi
                          </a>
                        )}
                      </div>
                    ))}
                </div>
              </div>

              {/* Right Column: Bills */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted">Hóa đơn thanh toán</h4>
                <div className="grid grid-cols-2 gap-2">
                  {getBillList(selectedReg.bill_url).map((url, idx) => (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-[var(--border)] group bg-black/10">
                      <img src={url} alt={`Bill ${idx + 1}`} className="w-full h-full object-cover" />
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-opacity"
                      >
                        Xem ảnh gốc
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
