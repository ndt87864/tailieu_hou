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

  const [urlsToDelete, setUrlsToDelete] = useState<string[]>([]);
  const [newQuestionFiles, setNewQuestionFiles] = useState<File[]>([]);
  const [newChoicesFiles, setNewChoicesFiles] = useState<File[]>([]);
  const [newAnswerFiles, setNewAnswerFiles] = useState<File[]>([]);

  useEffect(() => {
    if (data) {
      setFormData({ ...data });
    }
  }, [data]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleRemoveOldUrl = (field: "url_question" | "url_choices" | "url_answer", url: string) => {
    setUrlsToDelete((prev) => [...prev, url]);
    const currentUrls = (formData[field] || "").split(",").map((u: string) => u.trim()).filter(Boolean);
    const updatedUrls = currentUrls.filter((u: string) => u !== url);
    setFormData((prev: any) => ({ ...prev, [field]: updatedUrls.join(",") }));
  };

  const handleFileChange = (field: "url_question" | "url_choices" | "url_answer", e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArr = Array.from(e.target.files);
      if (field === "url_question") {
        setNewQuestionFiles((prev) => [...prev, ...filesArr]);
      } else if (field === "url_choices") {
        setNewChoicesFiles((prev) => [...prev, ...filesArr]);
      } else if (field === "url_answer") {
        setNewAnswerFiles((prev) => [...prev, ...filesArr]);
      }
    }
  };

  const handleRemoveNewFile = (field: "url_question" | "url_choices" | "url_answer", index: number) => {
    if (field === "url_question") {
      setNewQuestionFiles((prev) => prev.filter((_, i) => i !== index));
    } else if (field === "url_choices") {
      setNewChoicesFiles((prev) => prev.filter((_, i) => i !== index));
    } else if (field === "url_answer") {
      setNewAnswerFiles((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const uploadSingleFile = async (file: File, folder: string): Promise<string> => {
    const fData = new FormData();
    fData.append("file", file);
    fData.append("folder", folder);
    const { data: res } = await apiClient.post("/api/v1/admin/crawler/upload", fData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    if (res.success && res.url) {
      return res.url;
    }
    throw new Error("Upload file thất bại");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Tải lên các file mới chọn và nhận URL
      const uploadedQuestionUrls: string[] = [];
      for (const file of newQuestionFiles) {
        const url = await uploadSingleFile(file, "question_url");
        uploadedQuestionUrls.push(url);
      }

      const uploadedChoicesUrls: string[] = [];
      for (const file of newChoicesFiles) {
        const url = await uploadSingleFile(file, "choices_url");
        uploadedChoicesUrls.push(url);
      }

      const uploadedAnswerUrls: string[] = [];
      for (const file of newAnswerFiles) {
        const url = await uploadSingleFile(file, "answer_url");
        uploadedAnswerUrls.push(url);
      }

      // 2. Cập nhật payload với các URL mới và loại bỏ các ảnh cũ đã xóa
      const finalQuestionUrls = [
        ...(formData.url_question || "").split(",").map((u: string) => u.trim()).filter(Boolean),
        ...uploadedQuestionUrls
      ].join(",");

      const finalChoicesUrls = [
        ...(formData.url_choices || "").split(",").map((u: string) => u.trim()).filter(Boolean),
        ...uploadedChoicesUrls
      ].join(",");

      const finalAnswerUrls = [
        ...(formData.url_answer || "").split(",").map((u: string) => u.trim()).filter(Boolean),
        ...uploadedAnswerUrls
      ].join(",");

      const payload = { 
        ...formData,
        url_question: finalQuestionUrls || null,
        url_choices: finalChoicesUrls || null,
        url_answer: finalAnswerUrls || null
      };
      
      // Bỏ các object liên kết khi update
      delete payload.course;
      delete payload.document;
      
      // 3. Cập nhật DB qua backend API
      const { data: res } = await apiClient.put(`/api/v1/admin/crawler/${view}/${data.id}`, payload);
      
      if (res.success) {
        // 4. Nếu lưu DB thành công, tiến hành xóa thực tế các file cũ khỏi Supabase Storage
        if (urlsToDelete.length > 0) {
          try {
            await apiClient.post("/api/v1/admin/crawler/delete-files", { urls: urlsToDelete });
          } catch (delErr) {
            console.error("⚠️ Không xóa được file cũ khỏi bucket:", delErr);
          }
        }
        
        toast.success("Cập nhật thành công!");
        onSuccess(payload);
        onClose();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || "Cập nhật thất bại");
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
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Ảnh câu hỏi</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {/* Ảnh cũ chưa bị xóa tạm */}
                    {(formData.url_question || "").split(",").map((url: string) => url.trim()).filter(Boolean).map((url: string, idx: number) => (
                      <div key={`old-q-${idx}`} className="relative border rounded-lg p-1 max-w-[120px] bg-[var(--bg-2)] border-[var(--border-soft)]">
                        <img src={url} alt={`Ảnh câu hỏi ${idx + 1}`} className="h-16 object-contain" />
                        <button
                          type="button"
                          onClick={() => handleRemoveOldUrl("url_question", url)}
                          className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 shadow-sm transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {/* Ảnh mới chuẩn bị tải lên */}
                    {newQuestionFiles.map((file, idx) => {
                      const objectUrl = URL.createObjectURL(file);
                      return (
                        <div key={`new-q-${idx}`} className="relative border rounded-lg p-1 max-w-[120px] bg-[var(--bg-2)] border-[var(--border-soft)]">
                          <img src={objectUrl} alt={`Ảnh câu hỏi mới ${idx + 1}`} className="h-16 object-contain" />
                          <button
                            type="button"
                            onClick={() => handleRemoveNewFile("url_question", idx)}
                            className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 shadow-sm transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => handleFileChange("url_question", e)}
                    className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Các lựa chọn</label>
                  {["A", "B", "C", "D"].map((label, index) => {
                    const choicesArr = Array.isArray(formData.choices) ? formData.choices : ["", "", "", ""];
                    const val = choicesArr[index] || "";
                    return (
                      <div key={label} className="flex items-center gap-2">
                        <span className="w-6 text-xs font-bold text-slate-500 text-center">{label}.</span>
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => {
                            const newChoices = [...choicesArr];
                            newChoices[index] = e.target.value;
                            setFormData((prev: any) => ({ ...prev, choices: newChoices }));
                          }}
                          placeholder={`Nhập nội dung lựa chọn ${label}`}
                          className="input-themed flex-1 p-2.5 rounded-xl outline-none focus:border-brand-500 text-xs"
                        />
                      </div>
                    );
                  })}
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Ảnh các lựa chọn</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {(formData.url_choices || "").split(",").map((url: string) => url.trim()).filter(Boolean).map((url: string, idx: number) => (
                      <div key={`old-c-${idx}`} className="relative border rounded-lg p-1 max-w-[120px] bg-[var(--bg-2)] border-[var(--border-soft)]">
                        <img src={url} alt={`Ảnh lựa chọn ${idx + 1}`} className="h-16 object-contain" />
                        <button
                          type="button"
                          onClick={() => handleRemoveOldUrl("url_choices", url)}
                          className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 shadow-sm transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {newChoicesFiles.map((file, idx) => {
                      const objectUrl = URL.createObjectURL(file);
                      return (
                        <div key={`new-c-${idx}`} className="relative border rounded-lg p-1 max-w-[120px] bg-[var(--bg-2)] border-[var(--border-soft)]">
                          <img src={objectUrl} alt={`Ảnh lựa chọn mới ${idx + 1}`} className="h-16 object-contain" />
                          <button
                            type="button"
                            onClick={() => handleRemoveNewFile("url_choices", idx)}
                            className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 shadow-sm transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => handleFileChange("url_choices", e)}
                    className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer"
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
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Ảnh đáp án</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {(formData.url_answer || "").split(",").map((url: string) => url.trim()).filter(Boolean).map((url: string, idx: number) => (
                      <div key={`old-a-${idx}`} className="relative border rounded-lg p-1 max-w-[120px] bg-[var(--bg-2)] border-[var(--border-soft)]">
                        <img src={url} alt={`Ảnh đáp án ${idx + 1}`} className="h-16 object-contain" />
                        <button
                          type="button"
                          onClick={() => handleRemoveOldUrl("url_answer", url)}
                          className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 shadow-sm transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {newAnswerFiles.map((file, idx) => {
                      const objectUrl = URL.createObjectURL(file);
                      return (
                        <div key={`new-a-${idx}`} className="relative border rounded-lg p-1 max-w-[120px] bg-[var(--bg-2)] border-[var(--border-soft)]">
                          <img src={objectUrl} alt={`Ảnh đáp án mới ${idx + 1}`} className="h-16 object-contain" />
                          <button
                            type="button"
                            onClick={() => handleRemoveNewFile("url_answer", idx)}
                            className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 shadow-sm transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => handleFileChange("url_answer", e)}
                    className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer"
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
