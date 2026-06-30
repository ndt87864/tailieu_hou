import React from "react";
import { Loader2 } from "lucide-react";

interface Question {
  id: string;
  document_id: string;
  question: string;
  answer: string;
  choices: string[];
  url_question?: string | null;
  url_answer?: string | null;
  order_index: number;
}

interface Document {
  id: string;
  title: string;
  category_id?: string | null;
}

interface QuestionFormModalProps {
  show: boolean;
  editingQuestion: Question | null;
  formData: {
    document_id: string;
    question: string;
    answer: string;
    choicesText: string;
    order_index: number;
    url_question: string;
    url_answer: string;
  };
  setFormData: React.Dispatch<
    React.SetStateAction<{
      document_id: string;
      question: string;
      answer: string;
      choicesText: string;
      order_index: number;
      url_question: string;
      url_answer: string;
    }>
  >;
  documents: Document[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

const QuestionFormModal: React.FC<QuestionFormModalProps> = ({
  show,
  editingQuestion,
  formData,
  setFormData,
  documents,
  submitting,
  onClose,
  onSubmit,
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="card w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto animate-scale-in">
        <h3 className="modal-heading text-base font-bold mb-4">
          {editingQuestion ? "Cập nhật câu hỏi" : "Tạo câu hỏi mới"}
        </h3>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="form-label block text-xs font-semibold mb-1">
              Tài liệu
            </label>
            <select
              value={formData.document_id}
              onChange={(e) =>
                setFormData({ ...formData, document_id: e.target.value })
              }
              className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none cursor-pointer font-medium"
              required
            >
              <option value="" disabled>
                -- Chọn tài liệu --
              </option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label block text-xs font-semibold mb-1">
              Nội dung câu hỏi
            </label>
            <textarea
              required
              placeholder="Nhập câu hỏi..."
              value={formData.question}
              onChange={(e) =>
                setFormData({ ...formData, question: e.target.value })
              }
              className="textarea-description w-full px-3 py-2 text-sm rounded-xl outline-none focus:border-brand-500 resize-none"
            />
          </div>

          <div>
            <label className="form-label block text-xs font-semibold mb-1">
              Các lựa chọn (Mỗi dòng một lựa chọn)
            </label>
            <textarea
              placeholder="Lựa chọn A&#10;Lựa chọn B&#10;Lựa chọn C&#10;Lựa chọn D"
              value={formData.choicesText}
              onChange={(e) =>
                setFormData({ ...formData, choicesText: e.target.value })
              }
              className="textarea-choices w-full px-3 py-2 text-sm rounded-xl outline-none focus:border-brand-500 font-mono"
            />
          </div>

          <div>
            <label className="form-label block text-xs font-semibold mb-1">
              Đáp án đúng (Phải trùng khớp hoàn toàn một lựa chọn ở trên)
            </label>
            <input
              type="text"
              required
              placeholder="Nhập lựa chọn đúng..."
              value={formData.answer}
              onChange={(e) =>
                setFormData({ ...formData, answer: e.target.value })
              }
              className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none focus:border-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label block text-xs font-semibold mb-1">
                Thứ tự hiển thị (STT)
              </label>
              <input
                type="number"
                required
                value={formData.order_index}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    order_index: parseInt(e.target.value, 10) || 1,
                  })
                }
                className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="form-label block text-xs font-semibold mb-1">
                Hình ảnh câu hỏi (URL tùy chọn)
              </label>
              <input
                type="text"
                placeholder="Link ảnh nếu có"
                value={formData.url_question}
                onChange={(e) =>
                  setFormData({ ...formData, url_question: e.target.value })
                }
                className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="form-label block text-xs font-semibold mb-1">
              Hình ảnh đáp án (URL tùy chọn)
            </label>
            <input
              type="text"
              placeholder="Link ảnh đáp án nếu có"
              value={formData.url_answer}
              onChange={(e) =>
                setFormData({ ...formData, url_answer: e.target.value })
              }
              className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none focus:border-brand-500"
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

export default QuestionFormModal;
