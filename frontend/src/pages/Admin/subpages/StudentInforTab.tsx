import React, { useEffect, useState } from "react";
import apiClient from "../../../services/client.js";
import LoadingSpinner from "../../../components/common/LoadingSpinner.js";
import { toast } from "react-toastify";
import { Search, Plus, Trash2, Edit2, Upload, RefreshCw } from "lucide-react";
import { useConfirm } from "../../../context/ConfirmContext.js";
import StudentFormModal from "./StudentFormModal.js";
import StudentImportModal from "./StudentImportModal.js";

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
  const confirm = useConfirm();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [majorCodeFilter, setMajorCodeFilter] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [total, setTotal] = useState(0);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
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
      .get("/api/v1/admin/students", {
        params: {
          search,
          page,
          limit: 15,
          course: courseFilter,
          subject: subjectFilter,
          majorCode: majorCodeFilter
        }
      })
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
  }, [page, search, courseFilter, subjectFilter, majorCodeFilter]);

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
    const isConfirmed = await confirm("Bạn có chắc chắn muốn xóa bản ghi này?");
    if (!isConfirmed) return;
    try {
      await apiClient.delete(`/api/v1/admin/students/${id}`);
      toast.success("Xóa thành công!");
      setStudents((prev) => prev.filter((s) => s.id !== id));
      setSelectedStudentIds((prev) => prev.filter((item) => item !== id));
      setTotal((prev) => prev - 1);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Xóa thất bại.");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedStudentIds.length === 0) return;
    const isConfirmed = await confirm(`Bạn có chắc chắn muốn xóa ${selectedStudentIds.length} sinh viên đã chọn?`);
    if (!isConfirmed) return;

    setIsDeletingBulk(true);
    try {
      await apiClient.post("/api/v1/admin/students/bulk-delete", { ids: selectedStudentIds });
      toast.success(`Xóa thành công ${selectedStudentIds.length} sinh viên!`);
      setSelectedStudentIds([]);
      fetchStudents();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Xóa hàng loạt thất bại.");
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const handleToggleSelectStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    const currentPageIds = students.map((s) => s.id);
    const allSelected = currentPageIds.every((id) => selectedStudentIds.includes(id));
    if (allSelected) {
      setSelectedStudentIds((prev) => prev.filter((id) => !currentPageIds.includes(id)));
    } else {
      setSelectedStudentIds((prev) => Array.from(new Set([...prev, ...currentPageIds])));
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

  const allSelectedOnPage = students.length > 0 && students.every((s) => selectedStudentIds.includes(s.id));

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col gap-3">
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

          <div className="flex gap-2 w-full sm:w-auto shrink-0">
            {selectedStudentIds.length > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={isDeletingBulk}
                className="btn-danger flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Xóa ({selectedStudentIds.length})
              </button>
            )}
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

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <input
              type="text"
              placeholder="Lọc theo khóa (VD: K19)..."
              value={courseFilter}
              onChange={(e) => {
                setCourseFilter(e.target.value);
                setPage(1);
              }}
              className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none"
            />
          </div>
          <div>
            <input
              type="text"
              placeholder="Lọc theo môn thi..."
              value={subjectFilter}
              onChange={(e) => {
                setSubjectFilter(e.target.value);
                setPage(1);
              }}
              className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none"
            />
          </div>
          <div>
            <input
              type="text"
              placeholder="Lọc theo mã ngành..."
              value={majorCodeFilter}
              onChange={(e) => {
                setMajorCodeFilter(e.target.value);
                setPage(1);
              }}
              className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none"
            />
          </div>
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
                  <th className="w-10">
                    <input
                      type="checkbox"
                      checked={allSelectedOnPage}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 rounded cursor-pointer"
                    />
                  </th>
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
                    <td colSpan={6} className="td-empty">
                      Không tìm thấy lịch thi nào.
                    </td>
                  </tr>
                ) : (
                  students.map((std) => (
                    <tr key={std.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.includes(std.id)}
                          onChange={() => handleToggleSelectStudent(std.id)}
                          className="w-4 h-4 rounded cursor-pointer"
                        />
                      </td>
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
      <StudentFormModal
        show={showModal}
        editingStudent={editingStudent}
        formData={formData}
        setFormData={setFormData}
        submitting={submitting}
        onClose={closeForm}
        onSubmit={handleCreateOrUpdate}
      />

      {/* Import JSON Modal */}
      <StudentImportModal
        show={showImportModal}
        importText={importText}
        setImportText={setImportText}
        importing={importing}
        onClose={() => {
          setShowImportModal(false);
          setImportText("");
        }}
        onImport={handleImport}
      />
    </div>
  );
};

export default StudentInforTab;
