import React from "react";
import { Loader2 } from "lucide-react";

interface Student {
  id: string;
  studentId: string;
  fullName: string;
  username: string;
  majorCode?: string | null;
  course?: string | null;
  subject: string;
  examDate?: string | null;
  examTime?: string | null;
  examSession?: string | null;
  examRoom?: string | null;
  examType?: string | null;
  examLink?: string | null;
  status?: string | null;
}

interface StudentFormModalProps {
  show: boolean;
  editingStudent: Student | null;
  formData: {
    studentId: string;
    username: string;
    fullName: string;
    majorCode: string;
    course: string;
    subject: string;
    examDate: string;
    examTime: string;
    examSession: string;
    examRoom: string;
    examType: string;
    examLink: string;
    status: string;
  };
  setFormData: React.Dispatch<
    React.SetStateAction<{
      studentId: string;
      username: string;
      fullName: string;
      majorCode: string;
      course: string;
      subject: string;
      examDate: string;
      examTime: string;
      examSession: string;
      examRoom: string;
      examType: string;
      examLink: string;
      status: string;
    }>
  >;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

const StudentFormModal: React.FC<StudentFormModalProps> = ({
  show,
  editingStudent,
  formData,
  setFormData,
  submitting,
  onClose,
  onSubmit,
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="card w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto animate-scale-in">
        <h3 className="modal-heading text-base font-bold mb-4">
          {editingStudent ? "Cập nhật lịch thi" : "Thêm lịch thi mới"}
        </h3>
        <form onSubmit={onSubmit} className="space-y-4">
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
              onClick={onClose}
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
  );
};

export default StudentFormModal;
