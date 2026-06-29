import React, { useEffect, useState } from "react";
import { Plus, Trash2, Edit2, Clock, X, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import apiClient from "../../../services/client.js";
import { useConfirm } from "../../../context/ConfirmContext.js";

interface ExamSession {
  id: string;
  title: string;
  examDate: string;
  startTime: string;
  endTime: string;
  examType: string;
  note: string;
  isActive?: boolean;
}

const defaultForm = {
  title: "",
  examDate: "",
  startTime: "",
  endTime: "",
  examType: "Onsite",
  note: "",
  isActive: true,
};

export const SessionsTab: React.FC = () => {
  const confirm = useConfirm();
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSession, setEditingSession] = useState<ExamSession | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState(defaultForm);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/api/v1/admin/exam-sessions");
      setSessions(res.data.sessions || []);
    } catch (err: any) {
      console.error(err);
      toast.error("Không thể tải danh sách ca thi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const openCreateModal = () => {
    setEditingSession(null);
    setFormData(defaultForm);
    setShowModal(true);
  };

  const openEditModal = (s: ExamSession) => {
    setEditingSession(s);
    setFormData({
      title: s.title || "",
      examDate: s.examDate || "",
      startTime: s.startTime || "",
      endTime: s.endTime || "",
      examType: s.examType || "Onsite",
      note: s.note || "",
      isActive: typeof s.isActive === "boolean" ? s.isActive : true,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    const isConfirmed = await confirm("Bạn có chắc chắn muốn xóa ca thi này?");
    if (!isConfirmed) return;
    try {
      await apiClient.delete(`/api/v1/admin/exam-sessions/${id}`);
      toast.success("Xóa ca thi thành công!");
      fetchSessions();
    } catch (err: any) {
      console.error(err);
      toast.error("Lỗi khi xóa ca thi.");
    }
  };

  // Helper to format examTime
  const formatExamTime = (start: string, end: string) => {
    const toHM = (t: string) => {
      if (!t) return "";
      const match = t.match(/^(\d{1,2}):(\d{2})/);
      if (match) {
        return `${match[1]}h${match[2]}`;
      }
      return t;
    };
    return `${toHM(start)} - ${toHM(end)}`;
  };

  // Sync examTime to student_infor
  const syncExamTimeForStudents = async (session: ExamSession) => {
    try {
      const newExamTime = formatExamTime(session.startTime, session.endTime);
      const res = await apiClient.post("/api/v1/admin/students/update-by-match", {
        criteria: {
          examDate: session.examDate,
          examSession: session.title,
          examType: session.examType,
        },
        updates: { examTime: newExamTime },
        options: { isExamSessionSync: true }
      });
      if (res.data.count > 0) {
        toast.info(`Đã đồng bộ thời gian thi cho ${res.data.count} sinh viên.`);
      }
    } catch (err) {
      console.error("Lỗi đồng bộ thông tin sinh viên:", err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.examDate) {
      toast.error("Vui lòng điền đầy đủ Tên ca thi và Ngày thi.");
      return;
    }

    setSubmitting(true);
    try {
      let savedSession: ExamSession;
      if (editingSession) {
        const res = await apiClient.put(`/api/v1/admin/exam-sessions/${editingSession.id}`, formData);
        savedSession = res.data.session;
        toast.success("Cập nhật ca thi thành công!");
      } else {
        const res = await apiClient.post("/api/v1/admin/exam-sessions", formData);
        savedSession = res.data.session;
        toast.success("Thêm ca thi mới thành công!");
      }
      setShowModal(false);
      fetchSessions();

      // Sync examTime to students
      await syncExamTimeForStudents(savedSession);
    } catch (err: any) {
      console.error(err);
      toast.error("Lỗi khi lưu thông tin ca thi.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="modal-heading text-base font-bold flex items-center gap-2">
          <Clock className="w-5 h-5 text-emerald-500" /> Quản lý ca thi
        </h3>
        <button
          onClick={openCreateModal}
          className="btn-brand text-xs flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Thêm ca thi
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
        </div>
      ) : (
        <>
          {/* Table view - Desktop View */}
          <div className="admin-table-card-wrapper hidden md:block">
            <div className="overflow-x-auto">
              <table className="table-themed">
                <thead>
                  <tr>
                    <th>Tên ca thi</th>
                    <th>Ngày thi</th>
                    <th>Bắt đầu</th>
                    <th>Kết thúc</th>
                    <th>Hình thức</th>
                    <th>Trạng thái</th>
                    <th className="text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-muted">
                        Chưa có ca thi nào.
                      </td>
                    </tr>
                  ) : (
                    sessions.map((s) => (
                      <tr key={s.id}>
                        <td className="font-semibold">{s.title}</td>
                        <td>{s.examDate}</td>
                        <td>{s.startTime}</td>
                        <td>{s.endTime}</td>
                        <td>{s.examType || "Onsite"}</td>
                        <td>
                          {s.isActive !== false ? (
                            <span className="badge-verified">Đang hoạt động</span>
                          ) : (
                            <span className="badge-unverified">Đã tắt</span>
                          )}
                        </td>
                        <td className="text-right space-x-2">
                          <button
                            onClick={() => openEditModal(s)}
                            className="btn-action hover:text-blue-500 inline-flex items-center p-1 rounded hover:bg-blue-500/10"
                            title="Sửa"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(s.id)}
                            className="btn-action hover:text-red-500 inline-flex items-center p-1 rounded hover:bg-red-500/10"
                            title="Xóa"
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
          </div>

          {/* Cards view - Mobile View */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {sessions.length === 0 ? (
              <div className="card p-6 text-center text-sm text-[var(--fg-2)]">
                Chưa có ca thi nào.
              </div>
            ) : (
              sessions.map((s) => (
                <div key={s.id} className="admin-mobile-card">
                  <div className="admin-mobile-card-header">
                    <div className="font-semibold text-sm">{s.title}</div>
                    {s.isActive !== false ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
                        Hoạt động
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-600">
                        Đã tắt
                      </span>
                    )}
                  </div>

                  <div className="admin-mobile-card-body">
                    <div className="admin-mobile-card-row">
                      <span className="admin-mobile-card-label">Ngày thi:</span>
                      <span className="admin-mobile-card-value">{s.examDate}</span>
                    </div>
                    <div className="admin-mobile-card-row">
                      <span className="admin-mobile-card-label">Thời gian:</span>
                      <span className="admin-mobile-card-value font-semibold">
                        {s.startTime} - {s.endTime}
                      </span>
                    </div>
                    <div className="admin-mobile-card-row">
                      <span className="admin-mobile-card-label">Hình thức:</span>
                      <span className="admin-mobile-card-value">{s.examType || "Onsite"}</span>
                    </div>
                    {s.note && (
                      <div className="admin-mobile-card-row pt-1 border-t border-[var(--border)] border-dashed">
                        <span className="admin-mobile-card-label">Ghi chú:</span>
                        <span className="admin-mobile-card-value text-xs text-[var(--fg-2)] italic max-w-[70%] truncate">
                          {s.note}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="admin-mobile-card-footer">
                    <button
                      onClick={() => openEditModal(s)}
                      className="px-3 py-1.5 bg-[var(--surface-2)] text-[var(--fg)] border border-[var(--border)] rounded-lg text-xs font-medium hover:bg-[var(--bg-2)] transition-colors flex items-center gap-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Chỉnh sửa
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="px-3 py-1.5 bg-red-500/10 text-red-500 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-colors flex items-center gap-1 ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Xóa
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)] shrink-0">
              <h3 className="modal-heading text-base font-bold">
                {editingSession ? "Chỉnh sửa ca thi" : "Thêm ca thi mới"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg hover:bg-red-500/10 text-muted hover:text-red-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="form-label block text-xs font-semibold mb-1 text-[var(--fg)]">
                  Tên ca thi <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none"
                  placeholder="VD: Ca 1"
                  required
                />
              </div>

              <div>
                <label className="form-label block text-xs font-semibold mb-1 text-[var(--fg)]">
                  Ngày thi <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.examDate}
                  onChange={(e) => setFormData({ ...formData, examDate: e.target.value })}
                  className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none cursor-pointer"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label block text-xs font-semibold mb-1 text-[var(--fg)]">
                    Giờ bắt đầu <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none"
                    placeholder="VD: 07:30"
                    required
                  />
                </div>
                <div>
                  <label className="form-label block text-xs font-semibold mb-1 text-[var(--fg)]">
                    Giờ kết thúc <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none"
                    placeholder="VD: 09:30"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label block text-xs font-semibold mb-1 text-[var(--fg)]">
                    Hình thức thi
                  </label>
                  <input
                    type="text"
                    value={formData.examType}
                    onChange={(e) => setFormData({ ...formData, examType: e.target.value })}
                    className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none"
                    placeholder="VD: Onsite"
                  />
                </div>
                <div className="flex items-center pt-5">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="mr-2 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    id="isActive"
                  />
                  <label htmlFor="isActive" className="text-xs font-semibold text-[var(--fg)] cursor-pointer">
                    Đang kích hoạt
                  </label>
                </div>
              </div>

              <div>
                <label className="form-label block text-xs font-semibold mb-1 text-[var(--fg)]">
                  Ghi chú
                </label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none min-h-[80px]"
                  placeholder="Nhập ghi chú ca thi..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-semibold rounded-xl border border-[var(--border)] hover:bg-[var(--bg-2)] text-[var(--fg-2)]"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-semibold rounded-xl bg-brand-600 text-white hover:opacity-90 flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingSession ? "Lưu thay đổi" : "Thêm mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
