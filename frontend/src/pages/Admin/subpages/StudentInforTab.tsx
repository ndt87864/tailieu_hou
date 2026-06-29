import React, { useEffect, useState, useMemo } from "react";
import { Search, Plus, Trash2, Edit2, Upload, Download, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import apiClient from "../../../services/client.js";
import { useConfirm } from "../../../context/ConfirmContext.js";
import StudentFormModal from "./StudentFormModal.js";
import StudentImportModal from "./StudentImportModal.js";
import {
  ensureXLSX,
  mapHeaderToKey,
  parseExcelDateToYMD,
  parseDateToYMD,
  formatDate,
  parseCSV,
} from "../../../utils/studentInforHelpers.js";

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
  created_at?: string;
}

const emptyForm = {
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
  status: "Đủ điều kiện",
};

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
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

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
          majorCode: majorCodeFilter,
        },
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
      status: std.status || "Đủ điều kiện",
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

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const isCSV = file.name.toLowerCase().endsWith(".csv");
      let rows: any[] = [];
      let date1904 = false;

      if (isCSV) {
        const text = await file.text();
        rows = parseCSV(text);
      } else {
        const XLSX = await ensureXLSX();
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: false });
        date1904 = Boolean(
          workbook &&
          workbook.Workbook &&
          workbook.Workbook.WBProps &&
          workbook.Workbook.WBProps.date1904
        );
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      }

      if (rows.length === 0) {
        toast.error("File Excel không chứa dữ liệu.");
        return;
      }

      const headerMap: any = {};
      const firstRow = rows[0];
      Object.keys(firstRow).forEach((h) => {
        const key = mapHeaderToKey(h);
        if (key) headerMap[h] = key;
      });

      const parsedStudents = rows.map((row) => {
        const item: any = {};
        Object.entries(row).forEach(([k, v]) => {
          const key = headerMap[k];
          if (key) {
            if (key === "dob" || key === "examDate") {
              item[key] = parseExcelDateToYMD(v, { date1904 }) || null;
            } else {
              item[key] = String(v).trim();
            }
          }
        });
        return item;
      }).filter(item => item.studentId && item.fullName);

      if (parsedStudents.length === 0) {
        toast.error("Không tìm thấy dòng dữ liệu sinh viên hợp lệ.");
        return;
      }

      const res = await apiClient.post("/api/v1/admin/students/import", { list: parsedStudents });
      toast.success(`Đồng bộ thành công ${res.data.count} sinh viên từ file Excel.`);
      fetchStudents();
    } catch (err: any) {
      console.error(err);
      toast.error("Đọc file Excel thất bại: " + (err.message || String(err)));
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const XLSX = await ensureXLSX();
      const res = await apiClient.get("/api/v1/admin/students", {
        params: {
          search,
          page: 1,
          limit: 10000,
          course: courseFilter,
          subject: subjectFilter,
          majorCode: majorCodeFilter,
        },
      });
      const exportList = res.data.students || [];
      if (exportList.length === 0) {
        toast.warn("Không có dữ liệu để xuất.");
        return;
      }

      const header = ["Mã SV", "Họ tên", "Tài khoản", "Khóa", "Mã ngành", "Môn thi", "Ngày thi", "Ca thi", "Thời gian", "Phòng thi", "Hình thức", "Link phòng", "Trạng thái"];
      const data = exportList.map((r: Student) => [
        r.studentId || "",
        r.fullName || "",
        r.username || "",
        r.course || "",
        r.majorCode || "",
        r.subject || "",
        r.examDate ? parseDateToYMD(r.examDate) : "",
        r.examSession || "",
        r.examTime || "",
        r.examRoom || "",
        r.examType || "",
        r.examLink || "",
        r.status || "",
      ]);

      const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "SinhVien");
      XLSX.writeFile(wb, `DanhSachSinhVien_${Date.now()}.xlsx`);
      toast.success("Xuất file Excel thành công!");
    } catch (err: any) {
      console.error(err);
      toast.error("Xuất Excel thất bại.");
    } finally {
      setExporting(false);
    }
  };

  const closeForm = () => {
    setEditingStudent(null);
    setFormData(emptyForm);
    setShowModal(false);
  };

  const allSelectedOnPage = students.length > 0 && students.every((s) => selectedStudentIds.includes(s.id));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 w-4 h-4 input-search-icon" />
            <input
              type="text"
              placeholder="Tìm kiếm mã SV, tên, môn thi..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="input-themed w-full pl-9 pr-4 py-2 text-sm rounded-xl outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex gap-2 w-full sm:w-auto shrink-0 flex-wrap justify-end">
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
              onClick={handleExportExcel}
              disabled={exporting}
              className="btn-secondary flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl hover:opacity-90 transition-colors shadow-sm"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Xuất Excel
            </button>
            <label className="btn-secondary flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl hover:opacity-90 transition-colors shadow-sm cursor-pointer">
              <Upload className="w-4 h-4" />
              Nhập Excel
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleExcelImport}
                className="hidden"
                disabled={importing}
              />
            </label>
            <button
              onClick={() => setShowImportModal(true)}
              className="btn-secondary flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl hover:opacity-90 transition-colors shadow-sm"
            >
              Nhập JSON
            </button>
            <button
              onClick={openCreateModal => {
                setEditingStudent(null);
                setFormData(emptyForm);
                setShowModal(true);
              }}
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

      {loading ? (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
        </div>
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
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                  </th>
                  <th>Sinh viên</th>
                  <th>Môn thi</th>
                  <th>Thời gian thi</th>
                  <th>Phòng / Ca</th>
                  <th className="text-right">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted">
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
                          className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                        />
                      </td>
                      <td>
                        <div className="font-semibold">{std.fullName}</div>
                        <div className="text-xs text-muted">
                          MSV: {std.studentId} | Khóa: {std.course}
                        </div>
                      </td>
                      <td>
                        <div>{std.subject}</div>
                        {std.majorCode && (
                          <div className="text-xs text-muted">Ngành: {std.majorCode}</div>
                        )}
                      </td>
                      <td>
                        <div>{std.examDate ? formatDate(std.examDate) : "—"}</div>
                        <div className="text-xs text-muted">{std.examTime}</div>
                      </td>
                      <td>
                        <div>Phòng: {std.examRoom} | Ca: {std.examSession}</div>
                        {std.examLink && (
                          <a
                            href={std.examLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-emerald-500 hover:underline block max-w-[200px] truncate"
                          >
                            {std.examLink}
                          </a>
                        )}
                      </td>
                      <td className="text-right space-x-2">
                        <button
                          onClick={() => handleEditClick(std)}
                          className="btn-action hover:text-blue-500 inline-flex items-center p-1 rounded hover:bg-blue-500/10"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(std.id)}
                          className="btn-action hover:text-red-500 inline-flex items-center p-1 rounded hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {total > 15 && (
            <div className="p-4 flex items-center justify-between border-t border-[var(--border)]">
              <span className="text-xs text-[var(--fg-2)]">
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
                  className="px-3 py-1.5 text-xs rounded-xl border border-[var(--border)] hover:bg-[var(--bg-2)] disabled:opacity-50"
                >
                  Trước
                </button>
                <span className="text-xs text-[var(--fg-2)]">Trang</span>
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
                  className="input-themed w-12 text-center py-1 text-xs rounded-xl outline-none"
                />
                <span className="text-xs text-[var(--fg-2)]">/ {Math.ceil(total / 15)}</span>
                <button
                  disabled={page * 15 >= total}
                  onClick={() => {
                    const newPage = page + 1;
                    setPage(newPage);
                    setPageInput(String(newPage));
                  }}
                  className="px-3 py-1.5 text-xs rounded-xl border border-[var(--border)] hover:bg-[var(--bg-2)] disabled:opacity-50"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <StudentFormModal
        show={showModal}
        editingStudent={editingStudent}
        formData={formData}
        setFormData={setFormData}
        submitting={submitting}
        onClose={closeForm}
        onSubmit={handleCreateOrUpdate}
      />

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
