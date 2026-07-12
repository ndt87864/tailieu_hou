import React, { useState, useEffect } from "react";
import { Loader2, Image, Trash2, Maximize2, Link2, Edit3, Plus } from "lucide-react";

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
    url_choices: string;
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
      url_choices: string;
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
  // Tách text list lựa chọn ra làm 4 ô input riêng để trực quan
  const [choicesList, setChoicesList] = useState<string[]>(["", "", "", ""]);

  // Đồng bộ từ formData vào choicesList khi mở modal
  useEffect(() => {
    if (show) {
      const parsed = formData.choicesText
        ? formData.choicesText.split("\n").map(c => c.trim())
        : ["", "", "", ""];
      // Bảo đảm tối thiểu có 4 phần tử
      while (parsed.length < 4) {
        parsed.push("");
      }
      setChoicesList(parsed);
    }
  }, [show, formData.choicesText]);

  // Cập nhật choicesList và lưu lại vào formData.choicesText
  const handleChoiceChange = (index: number, val: string) => {
    const updated = [...choicesList];
    updated[index] = val;
    setChoicesList(updated);
    setFormData((prev) => ({
      ...prev,
      choicesText: updated.join("\n")
    }));
  };

  const handleSelectCorrectAnswer = (val: string) => {
    setFormData((prev) => ({
      ...prev,
      answer: val
    }));
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="card w-full max-w-xl p-6 relative max-h-[90vh] overflow-y-auto animate-scale-in">
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
              className="select-themed w-full px-3 py-2 text-sm rounded-xl outline-none cursor-pointer font-medium"
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

          {/* ================= HÌNH ẢNH CÂU HỎI HÀNG NGANG ================= */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="form-label text-xs font-semibold">
                Hình ảnh câu hỏi
              </label>
              <button
                type="button"
                onClick={() => {
                  const url = prompt("Nhập hoặc dán URL hình ảnh câu hỏi mới:");
                  if (url) {
                    const arr = formData.url_question ? formData.url_question.split(",") : [];
                    arr.push(url.trim());
                    setFormData(prev => ({ ...prev, url_question: arr.filter(Boolean).join(",") }));
                  }
                }}
                className="px-2.5 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-medium rounded-lg transition flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm ảnh
              </button>
            </div>
            
            <div className="flex flex-wrap gap-3 p-3 bg-[var(--bg-1)]/20 border border-[var(--border-soft)] rounded-xl min-h-[70px] items-center">
              {(!formData.url_question ? [] : formData.url_question.split(",")).map((url, uidx) => {
                const cleanUrl = url.trim();
                if (!cleanUrl) return null;
                return (
                  <div key={uidx} tabIndex={0} className="relative w-20 h-20 border rounded-lg bg-white overflow-hidden group focus:outline-none flex items-center justify-center shadow-sm">
                    <img src={cleanUrl} alt={`Ảnh câu hỏi ${uidx + 1}`} className="w-full h-full object-contain p-1" />
                    
                    {/* Hover & Focus Overlay chứa 4 icon hành động (Hỗ trợ mobile khi tap vào container) */}
                    <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 group-focus:opacity-100 focus-within:opacity-100 transition-opacity flex flex-wrap items-center justify-center gap-1.5 p-1">
                      <button
                        type="button"
                        onClick={() => window.open(cleanUrl, "_blank")}
                        className="p-1 bg-white/20 hover:bg-white/40 text-white rounded transition"
                        title="Phóng to"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(cleanUrl);
                          alert("Đã sao chép URL vào bộ nhớ tạm!");
                        }}
                        className="p-1 bg-white/20 hover:bg-white/40 text-white rounded transition"
                        title="Sao chép URL"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const newUrl = prompt("Nhập URL mới để thay thế ảnh này:", cleanUrl);
                          if (newUrl !== null) {
                            const arr = formData.url_question.split(",");
                            arr[uidx] = newUrl.trim();
                            setFormData(prev => ({ ...prev, url_question: arr.filter(Boolean).join(",") }));
                          }
                        }}
                        className="p-1 bg-white/20 hover:bg-white/40 text-white rounded transition"
                        title="Thay ảnh"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const arr = formData.url_question.split(",");
                          const filtered = arr.filter((_, i) => i !== uidx);
                          setFormData(prev => ({ ...prev, url_question: filtered.join(",") }));
                        }}
                        className="p-1 bg-red-600/80 hover:bg-red-600 text-white rounded transition"
                        title="Xóa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {(!formData.url_question || formData.url_question.split(",").filter(Boolean).length === 0) && (
                <span className="text-xs text-muted w-full text-center py-2">Chưa có hình ảnh nào cho câu hỏi này</span>
              )}
            </div>
          </div>

          {/* Thiết kế các lựa chọn tách biệt, kèm Radio chọn đáp án đúng */}
          <div>
            <label className="form-label block text-xs font-semibold mb-2">
              Các lựa chọn &amp; Đáp án đúng (Tích chọn hình tròn cho đáp án đúng)
            </label>
            <div className="space-y-4">
              {choicesList.map((choice, idx) => {
                const label = String.fromCharCode(65 + idx); // A, B, C, D...
                const isCorrect = formData.answer === choice && choice !== "";
                
                // Trích xuất danh sách url_choices (mỗi dòng cách nhau bởi \n)
                const urlChoicesList = formData.url_choices
                  ? formData.url_choices.split("\n")
                  : ["", "", "", ""];
                while (urlChoicesList.length < 4) {
                  urlChoicesList.push("");
                }
                const choiceUrlField = urlChoicesList[idx] || "";

                const handleChoiceUrlFieldChange = (newVal: string) => {
                  const updatedUrls = [...urlChoicesList];
                  updatedUrls[idx] = newVal;
                  setFormData((prev) => ({
                    ...prev,
                    url_choices: updatedUrls.join("\n")
                  }));
                };

                return (
                  <div key={idx} className="border border-[var(--border-soft)] p-3 rounded-xl bg-[var(--bg-1)]/40 space-y-3">
                    <div className="flex items-center gap-2.5">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="correct-answer-radio"
                          checked={isCorrect}
                          onChange={() => handleSelectCorrectAnswer(choice)}
                          disabled={!choice}
                          className="w-4 h-4 text-brand-600 focus:ring-brand-500 border-gray-300"
                          title="Chọn làm đáp án đúng"
                        />
                        <span className="text-xs font-bold text-[var(--fg-2)] w-4">{label}</span>
                      </label>
                      <input
                        type="text"
                        placeholder={`Nhập nội dung lựa chọn ${label}...`}
                        value={choice}
                        onChange={(e) => handleChoiceChange(idx, e.target.value)}
                        className="input-themed flex-1 px-3 py-1.5 text-sm rounded-xl outline-none focus:border-brand-500"
                        required={idx < 2} // Bắt buộc nhập ít nhất 2 lựa chọn đầu
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const url = prompt(`Nhập hoặc dán URL hình ảnh mới cho lựa chọn ${label}:`);
                          if (url) {
                            const arr = choiceUrlField ? choiceUrlField.split(",") : [];
                            arr.push(url.trim());
                            handleChoiceUrlFieldChange(arr.filter(Boolean).join(","));
                          }
                        }}
                        className="p-1.5 hover:bg-brand-50 text-brand-600 rounded-lg transition"
                        title="Thêm ảnh"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {/* ================= HÌNH ẢNH LỰA CHỌN HÀNG NGANG ================= */}
                    <div className="pl-6 flex flex-wrap gap-2.5 items-center">
                      {(!choiceUrlField ? [] : choiceUrlField.split(",")).map((cUrl, cidx) => {
                        const cleanCUrl = cUrl.trim();
                        if (!cleanCUrl) return null;
                        return (
                          <div key={cidx} tabIndex={0} className="relative w-14 h-14 border rounded-lg bg-white overflow-hidden group focus:outline-none flex items-center justify-center shadow-sm">
                            <img src={cleanCUrl} alt={`Ảnh lựa chọn ${label} ${cidx + 1}`} className="w-full h-full object-contain p-0.5" />
                            
                            {/* Hover & Focus Overlay cho ảnh lựa chọn */}
                            <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 group-focus:opacity-100 focus-within:opacity-100 transition-opacity flex flex-wrap items-center justify-center gap-1 p-0.5">
                              <button
                                type="button"
                                onClick={() => window.open(cleanCUrl, "_blank")}
                                className="p-0.5 bg-white/20 hover:bg-white/40 text-white rounded transition"
                                title="Phóng to"
                              >
                                <Maximize2 className="w-2.5 h-2.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(cleanCUrl);
                                  alert("Đã sao chép URL vào bộ nhớ tạm!");
                                }}
                                className="p-0.5 bg-white/20 hover:bg-white/40 text-white rounded transition"
                                title="Sao chép URL"
                              >
                                <Link2 className="w-2.5 h-2.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const newCUrl = prompt(`Nhập URL mới cho ảnh #${cidx + 1} của lựa chọn ${label}:`, cleanCUrl);
                                  if (newCUrl !== null) {
                                    const arr = choiceUrlField.split(",");
                                    arr[cidx] = newCUrl.trim();
                                    handleChoiceUrlFieldChange(arr.filter(Boolean).join(","));
                                  }
                                }}
                                className="p-0.5 bg-white/20 hover:bg-white/40 text-white rounded transition"
                                title="Thay ảnh"
                              >
                                <Edit3 className="w-2.5 h-2.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const arr = choiceUrlField.split(",");
                                  const filtered = arr.filter((_, i) => i !== cidx);
                                  handleChoiceUrlFieldChange(filtered.join(","));
                                }}
                                className="p-0.5 bg-red-600/80 hover:bg-red-600 text-white rounded transition"
                                title="Xóa"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="form-label block text-xs font-semibold mb-1">
              Đáp án đúng (Sẽ tự động điền khi tích chọn hình tròn phía trên)
            </label>
            <input
              type="text"
              required
              readOnly
              placeholder="Tích chọn một lựa chọn ở trên để làm đáp án..."
              value={formData.answer}
              className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none focus:border-brand-500 bg-[var(--bg-2)]/60 cursor-not-allowed"
            />
          </div>

          {/* ================= HÌNH ẢNH ĐÁP ÁN HÀNG NGANG ================= */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="form-label text-xs font-semibold">
                Hình ảnh đáp án
              </label>
              <button
                type="button"
                onClick={() => {
                  const url = prompt("Nhập hoặc dán URL hình ảnh đáp án mới:");
                  if (url) {
                    const arr = formData.url_answer ? formData.url_answer.split(",") : [];
                    arr.push(url.trim());
                    setFormData(prev => ({ ...prev, url_answer: arr.filter(Boolean).join(",") }));
                  }
                }}
                className="px-2.5 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-medium rounded-lg transition flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm ảnh
              </button>
            </div>
            
            <div className="flex flex-wrap gap-3 p-3 bg-[var(--bg-1)]/20 border border-[var(--border-soft)] rounded-xl min-h-[70px] items-center">
              {(!formData.url_answer ? [] : formData.url_answer.split(",")).map((url, uidx) => {
                const cleanUrl = url.trim();
                if (!cleanUrl) return null;
                return (
                  <div key={uidx} tabIndex={0} className="relative w-20 h-20 border rounded-lg bg-white overflow-hidden group focus:outline-none flex items-center justify-center shadow-sm">
                    <img src={cleanUrl} alt={`Ảnh đáp án ${uidx + 1}`} className="w-full h-full object-contain p-1" />
                    
                    {/* Hover & Focus Overlay chứa 4 icon hành động (Hỗ trợ mobile khi tap vào container) */}
                    <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 group-focus:opacity-100 focus-within:opacity-100 transition-opacity flex flex-wrap items-center justify-center gap-1.5 p-1">
                      <button
                        type="button"
                        onClick={() => window.open(cleanUrl, "_blank")}
                        className="p-1 bg-white/20 hover:bg-white/40 text-white rounded transition"
                        title="Phóng to"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(cleanUrl);
                          alert("Đã sao chép URL vào bộ nhớ tạm!");
                        }}
                        className="p-1 bg-white/20 hover:bg-white/40 text-white rounded transition"
                        title="Sao chép URL"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const newUrl = prompt("Nhập URL mới để thay thế ảnh này:", cleanUrl);
                          if (newUrl !== null) {
                            const arr = formData.url_answer.split(",");
                            arr[uidx] = newUrl.trim();
                            setFormData(prev => ({ ...prev, url_answer: arr.filter(Boolean).join(",") }));
                          }
                        }}
                        className="p-1 bg-white/20 hover:bg-white/40 text-white rounded transition"
                        title="Thay ảnh"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const arr = formData.url_answer.split(",");
                          const filtered = arr.filter((_, i) => i !== uidx);
                          setFormData(prev => ({ ...prev, url_answer: filtered.join(",") }));
                        }}
                        className="p-1 bg-red-600/80 hover:bg-red-600 text-white rounded transition"
                        title="Xóa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {(!formData.url_answer || formData.url_answer.split(",").filter(Boolean).length === 0) && (
                <span className="text-xs text-muted w-full text-center py-2">Chưa có hình ảnh nào cho đáp án này</span>
              )}
            </div>
          </div>

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
