import React, { useEffect, useState } from "react";
import apiClient from "../../../services/client.js";
import LoadingSpinner from "../../../components/common/LoadingSpinner.js";
import { toast } from "react-toastify";
import { Search, Plus, Trash2, Edit2, RefreshCw, Loader2 } from "lucide-react";

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
}

const QuestionsTab: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [search, setSearch] = useState("");
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    question: "",
    answer: "",
    choicesText: "", // Choices separated by new line
    order_index: 1,
    url_question: "",
    url_answer: ""
  });
  const [submitting, setSubmitting] = useState(false);

  // Fetch all documents on load
  useEffect(() => {
    setLoadingDocs(true);
    apiClient
      .get("/api/v1/documents")
      .then((res) => {
        const docs = res.data.documents || [];
        setDocuments(docs);
        if (docs.length > 0) {
          setSelectedDocId(docs[0].id);
        }
        setLoadingDocs(false);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Không thể tải danh sách tài liệu.");
        setLoadingDocs(false);
      });
  }, []);

  // Fetch questions when document changes
  const fetchQuestions = (docId: string) => {
    if (!docId) return;
    setLoadingQuestions(true);
    apiClient
      .get(`/api/v1/questions/document/${docId}`)
      .then((res) => {
        setQuestions(res.data.questions || []);
        setLoadingQuestions(false);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Không thể tải câu hỏi.");
        setLoadingQuestions(false);
      });
  };

  useEffect(() => {
    fetchQuestions(selectedDocId);
  }, [selectedDocId]);

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const choices = formData.choicesText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "");

    const payload = {
      document_id: selectedDocId,
      question: formData.question,
      answer: formData.answer,
      choices,
      order_index: formData.order_index,
      url_question: formData.url_question || null,
      url_answer: formData.url_answer || null,
    };

    try {
      if (editingQuestion) {
        await apiClient.put(`/api/v1/questions/${editingQuestion.id}`, payload);
        toast.success("Cập nhật câu hỏi thành công!");
      } else {
        await apiClient.post("/api/v1/questions", payload);
        toast.success("Tạo câu hỏi mới thành công!");
      }
      fetchQuestions(selectedDocId);
      closeForm();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Lưu câu hỏi thất bại.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (q: Question) => {
    setEditingQuestion(q);
    setFormData({
      question: q.question,
      answer: q.answer || "",
      choicesText: Array.isArray(q.choices) ? q.choices.join("\n") : "",
      order_index: q.order_index,
      url_question: q.url_question || "",
      url_answer: q.url_answer || ""
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa câu hỏi này không?")) return;
    try {
      await apiClient.delete(`/api/v1/questions/${id}`);
      toast.success("Xóa câu hỏi thành công!");
      setQuestions((prev) => prev.filter((q) => q.id !== id));
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Xóa thất bại.");
    }
  };

  const closeForm = () => {
    setEditingQuestion(null);
    setFormData({ question: "", answer: "", choicesText: "", order_index: 1, url_question: "", url_answer: "" });
    setShowModal(false);
  };

  const filtered = questions.filter(
    (q) =>
      q.question.toLowerCase().includes(search.toLowerCase()) ||
      (q.answer || "").toLowerCase().includes(search.toLowerCase())
  );

  if (loadingDocs) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {/* Selection & Search Bar */}
      <div className="flex flex-col md:flex-row items-center gap-3">
        {/* Document Selection */}
        <div className="w-full md:w-80">
          <select
            value={selectedDocId}
            onChange={(e) => setSelectedDocId(e.target.value)}
            className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none cursor-pointer font-medium"
          >
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="relative w-full md:flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 input-search-icon" />
          <input
            type="text"
            placeholder="Tìm kiếm nội dung câu hỏi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-themed w-full pl-9 pr-4 py-2 text-sm rounded-xl outline-none focus:border-brand-500"
          />
        </div>

        {/* Add button */}
        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl hover:bg-brand-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Thêm câu hỏi
          </button>
          <button
            onClick={() => fetchQuestions(selectedDocId)}
            className="btn-secondary p-2 rounded-xl hover:bg-[var(--bg-2)] transition-colors shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* List content */}
      {loadingQuestions ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="card p-8 text-center text-sm card-empty-state">
              Không tìm thấy câu hỏi nào cho tài liệu này.
            </div>
          ) : (
            filtered.map((q) => (
              <div key={q.id} className="card p-5 space-y-3 relative group">
                {/* Order Index and Question content */}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="q-label">
                      Câu hỏi #{q.order_index}
                    </span>
                    <h4 className="q-title font-semibold text-sm">
                      {q.question}
                    </h4>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => handleEditClick(q)}
                      className="btn-icon-edit p-1.5 hover:bg-[var(--bg-2)] rounded-lg transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(q.id)}
                      className="p-1.5 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Choices list */}
                {Array.isArray(q.choices) && q.choices.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs py-1">
                    {q.choices.map((choice, i) => (
                      <div
                        key={i}
                        className={`px-3 py-2 rounded-lg border flex items-center gap-2 choice-item ${choice === q.answer ? 'choice-correct' : 'choice-neutral'}`}
                      >
                        <span
                          className={`choice-badge font-bold flex items-center justify-center w-5 h-5 rounded-full ${choice === q.answer ? 'choice-badge-correct' : 'choice-badge-neutral'}`}
                        >
                          {String.fromCharCode(65 + i)}
                        </span>
                        <span className={choice === q.answer ? 'choice-text-correct' : 'choice-text-neutral'}>{choice}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Answer if not in choices */}
                {(!Array.isArray(q.choices) || q.choices.length === 0) && q.answer && (
                  <div className="text-xs p-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-600">
                    <strong>Đáp án:</strong> {q.answer}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="card w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto animate-scale-in">
            <h3 className="modal-heading text-base font-bold mb-4">
              {editingQuestion ? "Cập nhật câu hỏi" : "Tạo câu hỏi mới"}
            </h3>
            <form onSubmit={handleCreateOrUpdate} className="space-y-4">
              <div>
                <label className="form-label block text-xs font-semibold mb-1">Nội dung câu hỏi</label>
                <textarea
                  required
                  placeholder="Nhập câu hỏi..."
                  value={formData.question}
                  onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                  className="textarea-description w-full px-3 py-2 text-sm rounded-xl outline-none focus:border-brand-500 resize-none"
                />
              </div>

              <div>
                <label className="form-label block text-xs font-semibold mb-1">Các lựa chọn (Mỗi dòng một lựa chọn)</label>
                <textarea
                  placeholder="Lựa chọn A&#10;Lựa chọn B&#10;Lựa chọn C&#10;Lựa chọn D"
                  value={formData.choicesText}
                  onChange={(e) => setFormData({ ...formData, choicesText: e.target.value })}
                  className="textarea-choices w-full px-3 py-2 text-sm rounded-xl outline-none focus:border-brand-500 font-mono"
                />
              </div>

              <div>
                <label className="form-label block text-xs font-semibold mb-1">Đáp án đúng (Phải trùng khớp hoàn toàn một lựa chọn ở trên)</label>
                <input
                  type="text"
                  required
                  placeholder="Nhập lựa chọn đúng..."
                  value={formData.answer}
                  onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                  className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label block text-xs font-semibold mb-1">Thứ tự hiển thị (STT)</label>
                  <input
                    type="number"
                    required
                    value={formData.order_index}
                    onChange={(e) => setFormData({ ...formData, order_index: parseInt(e.target.value, 10) || 1 })}
                    className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="form-label block text-xs font-semibold mb-1">Hình ảnh câu hỏi (URL tùy chọn)</label>
                  <input
                    type="text"
                    placeholder="Link ảnh nếu có"
                    value={formData.url_question}
                    onChange={(e) => setFormData({ ...formData, url_question: e.target.value })}
                    className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none focus:border-brand-500"
                  />
                </div>
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
    </div>
  );
};

export default QuestionsTab;
