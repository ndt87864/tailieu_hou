import React, { useEffect, useState } from "react";
import apiClient from "../../../services/client.js";
import LoadingSpinner from "../../../components/common/LoadingSpinner.js";
import { toast } from "react-toastify";
import { Search, Plus, Trash2, Edit2, Upload, RefreshCw, Loader2 } from "lucide-react";

interface Student {
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
  examType: string;
  examLink: string;
  status: string;
}

const StudentInforTab: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [total, setTotal] = useState(0);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [formData, setFormData] = useState({
    studentId: "",
    fullName: "",
    username: "",
    majorCode: "",
    course: "",
    subject: "",
    examDate: "",
    examSession: "",
    examTime: "",
    examRoom: "",
    examType: "",
    examLink: "",
    status: "verified",
  });
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);

  const fetchStudents = () => {
    setLoading(true);
    apiClient
      .get("/api/v1/admin/students", { params: { search, page, limit: 15 } })
      .then((res) => {
        setStudents(res.data.students || []);
        setTotal(res.data.total || 0);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Không thể tải danh sách sinh viên.");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchStudents();
  }, [page, search]);

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      ...formData,
      examDate: formData.examDate || null,
    };

    try {
      if (editingStudent) {
        await apiClient.put(`/api/v1/admin/students/${editingStudent.id}`, payload);
        toast.success("Cập nhật thông tin thành công!");
      } else {
        await apiClient.post("/api/v1/admin/students", payload);
        toast.success("Thêm sinh viên thành công!");
      }
      fetchStudents();
      closeForm();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Lưu thất bại.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (std: Student) => {
    setEditingStudent(std);
    setFormData({
      studentId: std.studentId || "",
      fullName: std.fullName || "",
      username: std.username || "",
      majorCode: std.majorCode || "",
      course: std.course || "",
      subject: std.subject || "",
      examDate: std.examDate || "",
      examSession: std.examSession || "",
      examTime: std.examTime || "",
      examRoom: std.examRoom || "",
      examType: std.examType || "",
      examLink: std.examLink || "",
      status: std.status || "verified",
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa bản ghi này?")) return;
    try {
      await apiClient.delete(`/api/v1/admin/students/${id}`);
      toast.success("Xóa thành công!");
      setStudents((prev) => prev.filter((s) => s.id !== id));
      setTotal((prev) => prev - 1);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Xóa thất bại.");
    }
  };

  const handleImport = async () => {
    try {
      const parsed = JSON.parse(importText);
      if (!Array.isArray(parsed)) {
        toast.error("Dữ liệu JSON nhập vào phải là một mảng danh sách!");
        return;
      }
      setImporting(true);
      const res = await apiClient.post("/api/v1/admin/students/import", { list: parsed });
      toast.success(`Nhập thành công ${res.data.count} sinh viên!`);
      setShowImportModal(false);
      setImportText("");
      fetchStudents();
    } catch (err: any) {
      toast.error(err.message || "Định dạng JSON không hợp lệ.");
    } finally {
      setImporting(false);
    }
  };

  const closeForm = () => {
    setEditingStudent(null);
    setFormData({
      studentId: "",
      fullName: "",
      username: "",
      majorCode: "",
      course: "",
      subject: "",
      examDate: "",
      examSession: "",
      examTime: "",
      examRoom: "",
      examType: "",
      examLink: "",
      status: "verified",
    });
    setShowModal(false);
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 w-4 h-4 input-search-icon" />
          <input
            type="text"
            placeholder="Tìm kiếm mã SV, tên, ca thi..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="input-themed w-full pl-9 pr-4 py-2 text-sm rounded-xl outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowImportModal(true)}
            className="btn-secondary flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl hover:opacity-90 transition-colors shadow-sm"
          >
            <Upload className="w-4 h-4" />
            Nhập JSON
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl hover:bg-brand-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Thêm sinh viên
          </button>
          <button
            onClick={fetchStudents}
            className="btn-secondary p-2 rounded-xl hover:bg-[var(--bg-2)] transition-colors shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Table view */}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-themed">
              <thead>
                <tr>
                  <th>Sinh viên</th>
                  <th>Môn thi</th>
                  <th>Thời gian thi</th>
                  <th>Phòng / Ca</th>
                  <th className="th-right">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="td-empty">
                      Không tìm thấy lịch thi nào.
                    </td>
                  </tr>
                ) : (
                  students.map((std) => (
                    <tr key={std.id}>
                      <td>
                        <div className="user-name font-semibold">{std.fullName}</div>
                        <div className="cat-meta">
                          MSV: {std.studentId} | Khóa: {std.course}
                          </div>
                      </td>
                      <td className="td-sm-text">{std.subject}
                        <div className="cat-meta">
                          {std.majorCode && <>Ngành: <span className="user-email-text">{std.majorCode}</span></>}
                        </div></td>
                      <td className="td-sm-text">
                        {std.examDate ? new Date(std.examDate).toLocaleDateString("vi-VN") : "—"}{" "}
                        <span className="cat-meta">({std.examTime})</span>
                        
                      </td>
                      <td className="cat-meta">
                        <div>Phòng: {std.examRoom} | Ca: {std.examSession}</div>
                        {std.examLink && (
                          <a
                            href={std.examLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="exam-link"
                            title={std.examLink}
                          >
                            {std.examLink}
                          </a>
                        )}
                      </td>
                      <td className="td-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => handleEditClick(std)}
                            className="btn-icon-edit p-1.5 hover:bg-[var(--bg-2)] rounded-lg transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(std.id)}
                            className="p-1.5 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > 15 && (
            <div className="p-4 flex items-center justify-between border-t pagination-bar">
              <span className="text-xs pagination-info">
                Hiển thị {students.length} trên {total} bản ghi
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => {
                    const newPage = page - 1;
                    setPage(newPage);
                    setPageInput(String(newPage));
                  }}
                  className="input-themed px-3 py-1.5 text-xs rounded-xl disabled:opacity-50"
                >
                  Trước
                </button>
                <span className="text-xs pagination-info">Trang</span>
                <input
                  type="number"
                  min={1}
                  max={Math.ceil(total / 15)}
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = parseInt(pageInput);
                      const maxPage = Math.ceil(total / 15);
                      if (!isNaN(val) && val >= 1 && val <= maxPage) {
                        setPage(val);
                      } else {
                        setPageInput(String(page));
                      }
                    }
                  }}
                  onBlur={() => setPageInput(String(page))}
                  className="input-themed pagination-input py-1.5 text-xs rounded-xl outline-none"
                />
                <span className="text-xs pagination-info">/ {Math.ceil(total / 15)}</span>
                <button
                  disabled={page * 15 >= total}
                  onClick={() => {
                    const newPage = page + 1;
                    setPage(newPage);
                    setPageInput(String(newPage));
                  }}
                  className="input-themed px-3 py-1.5 text-xs rounded-xl disabled:opacity-50"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Form Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="card w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto animate-scale-in">
            <h3 className="modal-heading text-base font-bold mb-4">
              {editingStudent ? "Cập nhật lịch thi" : "Thêm lịch thi mới"}
            </h3>
            <form onSubmit={handleCreateOrUpdate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label block text-xs font-semibold mb-1">Mã sinh viên</label>
                  <input
                    type="text"
                    required
                    value={formData.studentId}
                    onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                    className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="form-label block text-xs font-semibold mb-1">Tên đăng nhập</label>
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="form-label block text-xs font-semibold mb-1">Họ và tên</label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label block text-xs font-semibold mb-1">Mã ngành</label>
                  <input
                    type="text"
                    value={formData.majorCode}
                    onChange={(e) => setFormData({ ...formData, majorCode: e.target.value })}
                    className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="form-label block text-xs font-semibold mb-1">Khóa</label>
                  <input
                    type="text"
                    value={formData.course}
                    onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                    className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="form-label block text-xs font-semibold mb-1">Môn thi</label>
                <input
                  type="text"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="form-label block text-xs font-semibold mb-1">Ngày thi</label>
                  <input
                    type="date"
                    value={formData.examDate}
                    onChange={(e) => setFormData({ ...formData, examDate: e.target.value })}
                    className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="form-label block text-xs font-semibold mb-1">Giờ thi</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: 13:30"
                    value={formData.examTime}
                    onChange={(e) => setFormData({ ...formData, examTime: e.target.value })}
                    className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="form-label block text-xs font-semibold mb-1">Ca thi</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Ca 3"
                    value={formData.examSession}
                    onChange={(e) => setFormData({ ...formData, examSession: e.target.value })}
                    className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label block text-xs font-semibold mb-1">Phòng thi</label>
                  <input
                    type="text"
                    value={formData.examRoom}
                    onChange={(e) => setFormData({ ...formData, examRoom: e.target.value })}
                    className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="form-label block text-xs font-semibold mb-1">Hình thức thi</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Trực tuyến"
                    value={formData.examType}
                    onChange={(e) => setFormData({ ...formData, examType: e.target.value })}
                    className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="form-label block text-xs font-semibold mb-1">Link phòng thi (URL)</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={formData.examLink}
                  onChange={(e) => setFormData({ ...formData, examLink: e.target.value })}
                  className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="btn-cancel px-4 py-2 text-sm font-medium rounded-xl hover:opacity-90"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary px-4 py-2 text-sm font-medium rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang lưu...
                    </>
                  ) : (
                    "Lưu lại"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import JSON Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="card w-full max-w-lg p-6 relative animate-scale-in">
            <h3 className="modal-heading text-base font-bold mb-2">Nhập dữ liệu sinh viên từ mảng JSON</h3>
            <p className="form-label text-xs mb-4">
              Dán mảng dữ liệu JSON có cấu trúc gồm các trường: studentId, fullName, username, course, subject, examRoom, examSession, examTime...
            </p>
            <textarea
              placeholder='[{"studentId": "2301", "fullName": "Nguyễn Văn A", ...}]'
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              className="textarea-json w-full px-3 py-2 text-sm rounded-xl outline-none focus:border-brand-500 font-mono text-xs mb-4 resize-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setImportText("");
                }}
                className="btn-cancel px-4 py-2 text-sm font-medium rounded-xl hover:opacity-90"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={importing}
                className="btn-primary px-4 py-2 text-sm font-medium rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang nhập...
                  </>
                ) : (
                  "Nhập danh sách"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentInforTab;
