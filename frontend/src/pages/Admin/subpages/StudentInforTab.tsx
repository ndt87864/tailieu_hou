import React, { useEffect, useState } from "react";
import apiClient from "../../../services/client.js";
import LoadingSpinner from "../../../components/common/LoadingSpinner.js";
import { toast } from "react-toastify";
import { Search, Plus, Trash2, Edit2, Upload, RefreshCw } from "lucide-react";

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
      
      const res = await apiClient.post("/api/v1/admin/students/import", { list: parsed });
      toast.success(`Nhập thành công ${res.data.count} sinh viên!`);
      setShowImportModal(false);
      setImportText("");
      fetchStudents();
    } catch (err: any) {
      toast.error(err.message || "Định dạng JSON không hợp lệ.");
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
          <Search className="absolute left-3 top-2.5 w-4 h-4" style={{ color: "var(--meta)" }} />
          <input
            type="text"
            placeholder="Tìm kiếm mã SV, tên, ca thi..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--fg)" }}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowImportModal(true)}
            style={{ background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--fg)" }}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl hover:opacity-90 transition-colors shadow-sm"
          >
            <Upload className="w-4 h-4" />
            Nhập JSON
          </button>
          <button
            onClick={() => setShowModal(true)}
            style={{ background: "var(--brand-600)", color: "#fff" }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl hover:bg-brand-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Thêm sinh viên
          </button>
          <button
            onClick={fetchStudents}
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--fg-2)" }}
            className="p-2 rounded-xl hover:bg-[var(--bg-2)] transition-colors shadow-sm"
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
                  <th style={{ textAlign: "right" }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "var(--meta)" }}>
                      Không tìm thấy lịch thi nào.
                    </td>
                  </tr>
                ) : (
                  students.map((std) => (
                    <tr key={std.id}>
                      <td>
                        <div className="font-semibold" style={{ color: "var(--fg)" }}>{std.fullName}</div>
                        <div style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                          MSV: {std.studentId} | Lớp: {std.course}
                        </div>
                      </td>
                      <td style={{ color: "var(--fg-2)", fontSize: "0.825rem" }}>{std.subject}</td>
                      <td style={{ color: "var(--fg-2)", fontSize: "0.825rem" }}>
                        {std.examDate ? new Date(std.examDate).toLocaleDateString("vi-VN") : "—"}{" "}
                        <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>({std.examTime})</span>
                      </td>
                      <td style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                        Phòng: {std.examRoom} | Ca: {std.examSession}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => handleEditClick(std)}
                            className="p-1.5 hover:bg-[var(--bg-2)] rounded-lg transition-colors"
                            style={{ color: "var(--fg-2)" }}
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
            <div className="p-4 flex items-center justify-between border-t" style={{ borderColor: "var(--border)" }}>
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                Hiển thị {students.length} trên {total} bản ghi
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--fg)" }}
                  className="px-3 py-1.5 text-xs rounded-xl disabled:opacity-50"
                >
                  Trước
                </button>
                <button
                  disabled={page * 15 >= total}
                  onClick={() => setPage(page + 1)}
                  style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--fg)" }}
                  className="px-3 py-1.5 text-xs rounded-xl disabled:opacity-50"
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
            <h3 className="text-base font-bold mb-4" style={{ color: "var(--fg)" }}>
              {editingStudent ? "Cập nhật lịch thi" : "Thêm lịch thi mới"}
            </h3>
            <form onSubmit={handleCreateOrUpdate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>Mã sinh viên</label>
                  <input
                    type="text"
                    required
                    value={formData.studentId}
                    onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                    style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--fg)" }}
                    className="w-full px-3 py-2 text-sm rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>Tên đăng nhập</label>
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--fg)" }}
                    className="w-full px-3 py-2 text-sm rounded-xl outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>Họ và tên</label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--fg)" }}
                  className="w-full px-3 py-2 text-sm rounded-xl outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>Mã ngành</label>
                  <input
                    type="text"
                    value={formData.majorCode}
                    onChange={(e) => setFormData({ ...formData, majorCode: e.target.value })}
                    style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--fg)" }}
                    className="w-full px-3 py-2 text-sm rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>Lớp/Khóa</label>
                  <input
                    type="text"
                    value={formData.course}
                    onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                    style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--fg)" }}
                    className="w-full px-3 py-2 text-sm rounded-xl outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>Môn thi</label>
                <input
                  type="text"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--fg)" }}
                  className="w-full px-3 py-2 text-sm rounded-xl outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>Ngày thi</label>
                  <input
                    type="date"
                    value={formData.examDate}
                    onChange={(e) => setFormData({ ...formData, examDate: e.target.value })}
                    style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--fg)" }}
                    className="w-full px-3 py-2 text-sm rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>Giờ thi</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: 13:30"
                    value={formData.examTime}
                    onChange={(e) => setFormData({ ...formData, examTime: e.target.value })}
                    style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--fg)" }}
                    className="w-full px-3 py-2 text-sm rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>Ca thi</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Ca 3"
                    value={formData.examSession}
                    onChange={(e) => setFormData({ ...formData, examSession: e.target.value })}
                    style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--fg)" }}
                    className="w-full px-3 py-2 text-sm rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>Phòng thi</label>
                  <input
                    type="text"
                    value={formData.examRoom}
                    onChange={(e) => setFormData({ ...formData, examRoom: e.target.value })}
                    style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--fg)" }}
                    className="w-full px-3 py-2 text-sm rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>Hình thức thi</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Trực tuyến"
                    value={formData.examType}
                    onChange={(e) => setFormData({ ...formData, examType: e.target.value })}
                    style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--fg)" }}
                    className="w-full px-3 py-2 text-sm rounded-xl outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>Link phòng thi (URL)</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={formData.examLink}
                  onChange={(e) => setFormData({ ...formData, examLink: e.target.value })}
                  style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--fg)" }}
                  className="w-full px-3 py-2 text-sm rounded-xl outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  style={{ background: "var(--bg-2)", color: "var(--fg-2)" }}
                  className="px-4 py-2 text-sm font-medium rounded-xl hover:opacity-90"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  style={{ background: "var(--brand-600)", color: "#fff" }}
                  className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-brand-700"
                >
                  Lưu lại
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
            <h3 className="text-base font-bold mb-2" style={{ color: "var(--fg)" }}>Nhập dữ liệu sinh viên từ mảng JSON</h3>
            <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
              Dán mảng dữ liệu JSON có cấu trúc gồm các trường: studentId, fullName, username, course, subject, examRoom, examSession, examTime...
            </p>
            <textarea
              placeholder='[{"studentId": "2301", "fullName": "Nguyễn Văn A", ...}]'
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--fg)", height: "200px" }}
              className="w-full px-3 py-2 text-sm rounded-xl outline-none focus:border-brand-500 font-mono text-xs mb-4 resize-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setImportText("");
                }}
                style={{ background: "var(--bg-2)", color: "var(--fg-2)" }}
                className="px-4 py-2 text-sm font-medium rounded-xl hover:opacity-90"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleImport}
                style={{ background: "var(--brand-600)", color: "#fff" }}
                className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-brand-700"
              >
                Nhập danh sách
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentInforTab;
