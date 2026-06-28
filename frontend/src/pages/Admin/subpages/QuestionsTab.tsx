import React, { useEffect, useState } from "react";
import apiClient from "../../../services/client.js";
import LoadingSpinner from "../../../components/common/LoadingSpinner.js";
import { toast } from "react-toastify";
import {
  Search,
  Plus,
  Trash2,
  RefreshCw,
  CheckSquare,
  Filter,
} from "lucide-react";
import FilterQuestionModal from "./FilterQuestionModal.js";
import QuestionFormModal from "./QuestionFormModal.js";
import { useConfirm } from "../../../context/ConfirmContext.js";
import QuestionCard from "./QuestionCard.js";

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

interface Category {
  id: string;
  title: string;
}

const QuestionsTab: React.FC = () => {
  const confirm = useConfirm();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [search, setSearch] = useState("");
  
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  
  const [formData, setFormData] = useState({
    document_id: "",
    question: "",
    answer: "",
    choicesText: "",
    order_index: 1,
    url_question: "",
    url_answer: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // Fetch all categories and documents on load
  useEffect(() => {
    setLoadingDocs(true);
    Promise.all([
      apiClient.get("/api/v1/admin/categories"),
      apiClient.get("/api/v1/documents"),
    ])
      .then(([catsRes, docsRes]) => {
        const cats = catsRes.data.categories || [];
        const docs = docsRes.data.documents || [];
        setCategories(cats);
        setDocuments(docs);

        if (cats.length > 0) {
          setSelectedCategoryId(cats[0].id);
          const filteredDocs = docs.filter(
            (d: Document) => d.category_id === cats[0].id
          );
          if (filteredDocs.length > 0) {
            setSelectedDocId(filteredDocs[0].id);
            setSelectedDocIds([filteredDocs[0].id]);
          }
        } else if (docs.length > 0) {
          setSelectedDocId(docs[0].id);
          setSelectedDocIds([docs[0].id]);
        }
        setLoadingDocs(false);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Không thể tải danh sách danh mục hoặc tài liệu.");
        setLoadingDocs(false);
      });
  }, []);

  // Update selected doc when category changes (Single Selection mode)
  useEffect(() => {
    if (!selectedCategoryId) return;
    const filteredDocs = documents.filter(
      (d) => d.category_id === selectedCategoryId
    );
    if (filteredDocs.length > 0) {
      const exists = filteredDocs.some((d) => d.id === selectedDocId);
      if (!exists) {
        setSelectedDocId(filteredDocs[0].id);
        setSelectedDocIds([filteredDocs[0].id]);
      }
    } else {
      setSelectedDocId("");
      setSelectedDocIds([]);
    }
  }, [selectedCategoryId, documents]);

  // Fetch questions when selection changes
  const fetchQuestions = (docIds: string[]) => {
    if (docIds.length === 0) {
      setQuestions([]);
      return;
    }
    setLoadingQuestions(true);
    setSelectedQuestionIds([]);
    apiClient
      .get(`/api/v1/questions/by-documents?ids=${docIds.join(",")}`)
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
    fetchQuestions(selectedDocIds);
  }, [selectedDocIds]);

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const choices = formData.choicesText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "");

    const targetDocId = formData.document_id || selectedDocId;
    const payload = {
      document_id: targetDocId,
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
      fetchQuestions(selectedDocIds);
      closeForm();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Lưu câu hỏi thất bại.");
    } finally {
      setSubmitting(false);
    }
  };

  const openAddClick = () => {
    setEditingQuestion(null);
    setFormData({
      document_id: selectedDocId || (selectedDocIds.length > 0 ? selectedDocIds[0] : ""),
      question: "",
      answer: "",
      choicesText: "",
      order_index: questions.length + 1,
      url_question: "",
      url_answer: "",
    });
    setShowModal(true);
  };

  const handleEditClick = (q: Question) => {
    setEditingQuestion(q);
    setFormData({
      document_id: q.document_id,
      question: q.question,
      answer: q.answer || "",
      choicesText: Array.isArray(q.choices) ? q.choices.join("\n") : "",
      order_index: q.order_index,
      url_question: q.url_question || "",
      url_answer: q.url_answer || "",
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    const isConfirmed = await confirm("Bạn có chắc chắn muốn xóa câu hỏi này không?");
    if (!isConfirmed) return;
    try {
      await apiClient.delete(`/api/v1/questions/${id}`);
      toast.success("Xóa câu hỏi thành công!");
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      setSelectedQuestionIds((prev) => prev.filter((item) => item !== id));
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Xóa thất bại.");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedQuestionIds.length === 0) return;
    const isConfirmed = await confirm(`Bạn có chắc chắn muốn xóa ${selectedQuestionIds.length} câu hỏi đã chọn?`);
    if (!isConfirmed) return;

    setIsDeletingBulk(true);
    try {
      await apiClient.post("/api/v1/questions/bulk-delete", {
        ids: selectedQuestionIds,
      });
      toast.success(
        `Đã xóa thành công ${selectedQuestionIds.length} câu hỏi!`
      );
      setQuestions((prev) =>
        prev.filter((q) => !selectedQuestionIds.includes(q.id))
      );
      setSelectedQuestionIds([]);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Xóa hàng loạt thất bại.");
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const closeForm = () => {
    setEditingQuestion(null);
    setFormData({
      document_id: "",
      question: "",
      answer: "",
      choicesText: "",
      order_index: 1,
      url_question: "",
      url_answer: "",
    });
    setShowModal(false);
  };

  const handleApplyFilter = (docIds: string[]) => {
    setSelectedDocIds(docIds);
    if (docIds.length > 0) {
      setSelectedDocId(docIds[0]);
      const firstDoc = documents.find((d) => d.id === docIds[0]);
      if (firstDoc?.category_id) {
        setSelectedCategoryId(firstDoc.category_id);
      }
    }
    setShowFilterModal(false);
  };

  const filtered = questions.filter((q) => {
    const docTitle = documents.find((d) => d.id === q.document_id)?.title || "";
    const term = search.toLowerCase();
    return (
      q.question.toLowerCase().includes(term) ||
      (q.answer || "").toLowerCase().includes(term) ||
      docTitle.toLowerCase().includes(term)
    );
  });

  const toggleSelectQuestion = (id: string) => {
    setSelectedQuestionIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    const currentFilteredIds = filtered.map((q) => q.id);
    const allSelected = currentFilteredIds.every((id) =>
      selectedQuestionIds.includes(id)
    );
    if (allSelected) {
      setSelectedQuestionIds((prev) =>
        prev.filter((id) => !currentFilteredIds.includes(id))
      );
    } else {
      setSelectedQuestionIds((prev) =>
        Array.from(new Set([...prev, ...currentFilteredIds]))
      );
    }
  };

  const isAllSelected =
    filtered.length > 0 &&
    filtered.every((q) => selectedQuestionIds.includes(q.id));

  const filteredDocs = documents.filter(
    (d) => d.category_id === selectedCategoryId
  );

  if (loadingDocs) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {/* Selection & Search Bar */}
      <div className="flex flex-col lg:flex-row items-center gap-3">
        {/* Category Selection */}
        <div className="w-full lg:w-48">
          <select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none cursor-pointer font-medium"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        {/* Document Selection */}
        <div className="w-full lg:w-64">
          <select
            value={selectedDocId}
            onChange={(e) => {
              setSelectedDocId(e.target.value);
              setSelectedDocIds(e.target.value ? [e.target.value] : []);
            }}
            className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none cursor-pointer font-medium"
          >
            <option value="">-- Chọn tài liệu --</option>
            {filteredDocs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        </div>

        {/* Filter Modal Trigger */}
        <div className="w-full lg:w-auto shrink-0">
          <button
            type="button"
            onClick={() => setShowFilterModal(true)}
            className="btn-secondary flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl hover:opacity-95 transition-colors shadow-sm w-full"
          >
            <Filter className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Lọc nhiều</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full lg:flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 input-search-icon" />
          <input
            type="text"
            placeholder="Tìm theo câu hỏi, câu trả lời, hoặc tài liệu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-themed w-full pl-9 pr-4 py-2 text-sm rounded-xl outline-none focus:border-brand-500"
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 w-full lg:w-auto shrink-0">
          {selectedQuestionIds.length > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={isDeletingBulk}
              className="btn-danger flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Xóa ({selectedQuestionIds.length})
            </button>
          )}
          <button
            onClick={handleToggleSelectAll}
            className="btn-secondary flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl hover:opacity-90 transition-colors shadow-sm"
          >
            <CheckSquare className="w-4 h-4" />
            {isAllSelected ? "Bỏ chọn" : "Chọn hết"}
          </button>
          <button
            disabled={selectedDocIds.length === 0}
            onClick={openAddClick}
            className="btn-primary flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Thêm câu hỏi
          </button>
          <button
            onClick={() => fetchQuestions(selectedDocIds)}
            className="btn-secondary p-2 rounded-xl hover:bg-[var(--bg-2)] transition-colors shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Multi-document Selection Status */}
      {selectedDocIds.length > 1 && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-xs text-emerald-700 dark:text-emerald-300 flex flex-wrap gap-2 items-center">
          <span className="font-semibold">Đang lọc ({selectedDocIds.length}) tài liệu:</span>
          {selectedDocIds.map((id) => {
            const doc = documents.find((d) => d.id === id);
            return (
              <span
                key={id}
                className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 font-medium"
              >
                {doc?.title || "Không rõ"}
              </span>
            );
          })}
        </div>
      )}

      {/* List content */}
      {loadingQuestions ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="card p-8 text-center text-sm card-empty-state">
              Không tìm thấy câu hỏi nào cho tài liệu đã chọn.
            </div>
          ) : (
            filtered.map((q) => (
              <QuestionCard
                key={q.id}
                q={q}
                documents={documents}
                selectedDocIds={selectedDocIds}
                selectedQuestionIds={selectedQuestionIds}
                toggleSelectQuestion={toggleSelectQuestion}
                handleEditClick={handleEditClick}
                handleDelete={handleDelete}
              />
            ))
          )}
        </div>
      )}

      {/* Advanced Filter Modal */}
      <FilterQuestionModal
        show={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        categories={categories}
        documents={documents}
        selectedDocIds={selectedDocIds}
        onApply={handleApplyFilter}
      />

      {/* Add / Edit Form Modal */}
      <QuestionFormModal
        show={showModal}
        editingQuestion={editingQuestion}
        formData={formData}
        setFormData={setFormData}
        documents={documents}
        submitting={submitting}
        onClose={closeForm}
        onSubmit={handleCreateOrUpdate}
      />
    </div>
  );
};

export default QuestionsTab;
