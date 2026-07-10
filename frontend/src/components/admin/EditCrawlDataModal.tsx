import React, { useState, useEffect } from "react";
import { X, Save } from "lucide-react";
import apiClient from "../../services/client.js";
import { toast } from "react-toastify";

interface EditCrawlDataModalProps {
  view: "courses" | "resources" | "questions";
  data: any;
  onClose: () => void;
  onSuccess: (updatedData: any) => void;
}

export const EditCrawlDataModal: React.FC<EditCrawlDataModalProps> = ({
  view,
  data,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<any>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (data) {
      setFormData({ ...data });
    }
  }, [data]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...formData };
      // Bỏ các object liên kết khi update
      delete payload.course;
      delete payload.document;
      
      const { data: res } = await apiClient.put(`/api/v1/admin/crawler/${view}/${data.id}`, payload);
      if (res.success) {
        toast.success("Cập nhật thành công!");
        onSuccess(formData);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Cập nhật thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            Chỉnh sửa {view === "courses" ? "khóa học" : view === "resources" ? "tài nguyên" : "câu hỏi"}
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <form id="edit-form" onSubmit={handleSubmit} className="space-y-4">
            {view === "courses" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Mã Moodle</label>
                  <input
                    type="text"
                    name="moodle_course_id"
                    value={formData.moodle_course_id || ""}
                    onChange={handleChange}
                    className="input-themed w-full p-2.5 rounded-xl outline-none focus:border-brand-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Tiêu đề</label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title || ""}
                    onChange={handleChange}
                    className="input-themed w-full p-2.5 rounded-xl outline-none focus:border-brand-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">URL</label>
                  <input
                    type="text"
                    name="url"
                    value={formData.url || ""}
                    onChange={handleChange}
                    className="input-themed w-full p-2.5 rounded-xl outline-none focus:border-brand-500"
                  />
                </div>
              </>
            )}

            {view === "resources" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Tuần</label>
                  <input
                    type="text"
                    name="week_name"
                    value={formData.week_name || ""}
                    onChange={handleChange}
                    className="input-themed w-full p-2.5 rounded-xl outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Loại</label>
                  <select
                    name="type"
                    value={formData.type || ""}
                    onChange={handleChange}
                    className="input-themed w-full p-2.5 rounded-xl outline-none focus:border-brand-500"
                    required
                  >
                    <option value="scorm">Scorm</option>
                    <option value="video">Video</option>
                    <option value="youtube">Youtube</option>
                    <option value="url">URL</option>
                    <option value="pdf">PDF</option>
                    <option value="other">Khác</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Tiêu đề</label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title || ""}
                    onChange={handleChange}
                    className="input-themed w-full p-2.5 rounded-xl outline-none focus:border-brand-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Content URL</label>
                  <input
                    type="text"
                    name="content_url"
                    value={formData.content_url || ""}
                    onChange={handleChange}
                    className="input-themed w-full p-2.5 rounded-xl outline-none focus:border-brand-500"
                  />
                </div>
              </>
            )}

            {view === "questions" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Tuần</label>
                  <input
                    type="text"
                    name="week_name"
                    value={formData.week_name || ""}
                    onChange={handleChange}
                    className="input-themed w-full p-2.5 rounded-xl outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Câu hỏi (HTML)</label>
                  <textarea
                    name="question"
                    value={formData.question || ""}
                    onChange={handleChange}
                    rows={4}
                    className="input-themed w-full p-2.5 rounded-xl outline-none focus:border-brand-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">URL Câu hỏi (ảnh)</label>
                  <input
                    type="text"
                    name="url_question"
                    value={formData.url_question || ""}
                    onChange={handleChange}
                    className="input-themed w-full p-2.5 rounded-xl outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Đáp án (HTML)</label>
                  <textarea
                    name="answer"
                    value={formData.answer || ""}
                    onChange={handleChange}
                    rows={4}
                    className="input-themed w-full p-2.5 rounded-xl outline-none focus:border-brand-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">URL Đáp án (ảnh)</label>
                  <input
                    type="text"
                    name="url_answer"
                    value={formData.url_answer || ""}
                    onChange={handleChange}
                    className="input-themed w-full p-2.5 rounded-xl outline-none focus:border-brand-500"
                  />
                </div>
              </>
            )}
          </form>
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            Hủy
          </button>
          <button
            form="edit-form"
            type="submit"
            disabled={loading}
            className="btn-primary px-6 py-2 rounded-xl flex items-center gap-2"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
            Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  );
};
