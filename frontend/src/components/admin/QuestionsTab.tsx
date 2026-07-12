import React, { useEffect, useState } from "react";
import apiClient from "../../services/client.js";
import LoadingSpinner from "../../components/common/LoadingSpinner.js";
import { toast } from "react-toastify";
import {
  Search,
  Plus,
  Trash2,
  RefreshCw,
  Filter,
  FileText,
  FileSpreadsheet,
} from "lucide-react";
import FilterQuestionModal from "./FilterQuestionModal.js";
import QuestionFormModal from "./QuestionFormModal.js";
import { useConfirm } from "../../context/ConfirmContext.js";
import QuestionCard from "./QuestionCard.js";
import { useAdminCategories } from "../../hooks/useAdminCategories.js";
import { exportQuestionsToWord } from "../../utils/wordExport.js";
import { cleanForExport } from "../../utils/questionHelper.js";
import * as XLSX from "xlsx";


interface Question {
  id: string;
  document_id: string;
  question: string;
  answer: string;
  choices: string[];
  url_question?: string | null;
  url_answer?: string | null;
  url_choices?: string | null; // Bổ sung trường url_choices
  order_index: number;
}

interface Document {
  id: string;
  title: string;
  category_id?: string | null;
}

const QuestionsTab: React.FC = () => {
  const confirm = useConfirm();
  const { categories } = useAdminCategories();
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
    url_choices: "", // Thêm trường url_choices vào formData
  });
  const [submitting, setSubmitting] = useState(false);

  // Fetch documents on load (categories come from shared hook)
  useEffect(() => {
    setLoadingDocs(true);
    apiClient
      .get("/api/v1/documents")
      .then((docsRes) => {
        const docs = docsRes.data.documents || [];
        setDocuments(docs);
        setLoadingDocs(false);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Không thể tải danh sách tài liệu.");
        setLoadingDocs(false);
      });
  }, []);

  // Set initial selected category when categories load
  useEffect(() => {
    if (categories.length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

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
    // Gom các URL của từng lựa chọn (mỗi dòng là một lựa chọn chứa nhiều link cách nhau bởi dấu phẩy) thành một chuỗi duy nhất ngăn cách bằng dấu phẩy
    const formattedUrlChoices = formData.url_choices
      ? formData.url_choices
          .split("\n")
          .map(line => line.trim())
          .filter(Boolean)
          .map(line => line.split(",").map(url => url.trim()).filter(Boolean).join(","))
          .filter(Boolean)
          .join(",")
      : null;

    const payload = {
      document_id: targetDocId,
      question: formData.question,
      answer: formData.answer,
      choices,
      order_index: formData.order_index,
      url_question: formData.url_question || null,
      url_answer: formData.url_answer || null,
      url_choices: formattedUrlChoices,
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
      url_choices: "",
    });
    setShowModal(true);
  };

  const handleEditClick = (q: Question) => {
    setEditingQuestion(q);
    
    // Tự động phân chia danh sách url_choices (cách nhau bởi dấu phẩy) vào 4 lựa chọn A, B, C, D bằng cách khớp tên file ảnh
    const choices = Array.isArray(q.choices) ? q.choices : [];
    const allUrls = q.url_choices
      ? q.url_choices.split(",").map(u => u.trim()).filter(Boolean)
      : [];
      
    // Khởi tạo mảng chứa danh sách URL cho từng lựa chọn (A, B, C, D)
    const groupedUrls: string[][] = [[], [], [], []];
    
    choices.forEach((choiceText, idx) => {
      if (idx >= 4) return;
      // Tìm các link ảnh LMS trong lựa chọn này
      const urlRegex = /(?:https?:\/\/[^\s"']+\/pluginfile\.php\/[^\s"']+\.(?:png|jpe?g|gif|svg|webp|bmp)|@@PLUGINFILE@@\/[^\s"']+\.(?:png|jpe?g|gif|svg|webp|bmp)|[A-Za-z0-9_\-]+\.(?:png|jpe?g|gif|svg|webp|bmp))/gi;
      const matches = choiceText.match(urlRegex) || [];
      
      matches.forEach(match => {
        // Trích xuất tên file
        let filename = "";
        const parts = match.split(/[/\\]/);
        filename = parts[parts.length - 1].split("?")[0].toLowerCase();
        
        if (filename) {
          // Tìm link tương ứng trong allUrls chứa filename này
          allUrls.forEach(url => {
            try {
              const decoded = decodeURIComponent(url).toLowerCase();
              if (decoded.includes(filename) || decoded.endsWith(filename)) {
                if (!groupedUrls[idx].includes(url)) {
                  groupedUrls[idx].push(url);
                }
              }
            } catch (e) {
              if (url.toLowerCase().includes(filename)) {
                if (!groupedUrls[idx].includes(url)) {
                  groupedUrls[idx].push(url);
                }
              }
            }
          });
        }
      });
    });

    // Nếu không khớp được ảnh nào hoặc còn sót, phân bổ đều theo thứ tự của các lựa chọn có link ảnh
    const matchedCount = groupedUrls.flat().length;
    if (matchedCount === 0 && allUrls.length > 0) {
      // Phân chia thô theo thứ tự: chia đều số link cho các lựa chọn có xuất hiện ảnh
      let currentUrlIdx = 0;
      choices.forEach((choiceText, idx) => {
        if (idx >= 4) return;
        const hasLmsImage = /pluginfile\.php|@@PLUGINFILE@@|\.(png|jpg|jpeg|gif)/gi.test(choiceText);
        if (hasLmsImage && currentUrlIdx < allUrls.length) {
          // Giả định mỗi lựa chọn lấy số lượng link tương ứng
          groupedUrls[idx].push(allUrls[currentUrlIdx]);
          currentUrlIdx++;
        }
      });
    }

    // Biến đổi thành chuỗi phân tách bằng dấu xuống dòng \n (mỗi dòng đại diện cho một lựa chọn, các URL con cách nhau bằng dấu phẩy)
    const formattedUrlChoices = groupedUrls.map(urls => urls.join(",")).join("\n");

    setFormData({
      document_id: q.document_id,
      question: q.question,
      answer: q.answer || "",
      choicesText: choices.join("\n"),
      order_index: q.order_index,
      url_question: q.url_question || "",
      url_answer: q.url_answer || "",
      url_choices: formattedUrlChoices,
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
      url_choices: "",
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

  const filtered = questions
    .filter((q) => {
      const docTitle = documents.find((d) => d.id === q.document_id)?.title || "";
      const term = search.toLowerCase();
      return (
        q.question.toLowerCase().includes(term) ||
        (q.answer || "").toLowerCase().includes(term) ||
        docTitle.toLowerCase().includes(term)
      );
    })
    .sort((a, b) => a.order_index - b.order_index);

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

  const handleDownload = (type: "word" | "excel") => {
    if (filtered.length === 0) {
      toast.warning("Không có câu hỏi nào để tải xuống.");
      return;
    }

    if (type === "excel") {
      try {
        const headers = ["STT", "Câu hỏi", "Lựa chọn A", "Lựa chọn B", "Lựa chọn C", "Lựa chọn D", "Đáp án đúng", "Tài liệu"];
        const rows = filtered.map((q, idx) => {
          const docTitle = documents.find((d) => d.id === q.document_id)?.title || "";
          const choices = q.choices || [];
          return [
            idx + 1,
            cleanForExport(q.question),
            cleanForExport(choices[0] || ""),
            cleanForExport(choices[1] || ""),
            cleanForExport(choices[2] || ""),
            cleanForExport(choices[3] || ""),
            cleanForExport(q.answer),
            docTitle
          ];
        });

        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Danh sách câu hỏi");

        // Set column widths
        const wscols = [
          { wch: 8 },   // STT
          { wch: 40 },  // Câu hỏi
          { wch: 25 },  // Lựa chọn A
          { wch: 25 },  // Lựa chọn B
          { wch: 25 },  // Lựa chọn C
          { wch: 25 },  // Lựa chọn D
          { wch: 25 },  // Đáp án đúng
          { wch: 30 },  // Tài liệu
        ];
        ws["!cols"] = wscols;

        let fileName = `Danh_sach_cau_hoi_${new Date().getTime()}.xlsx`;
        fileName = fileName.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");

        XLSX.writeFile(wb, fileName);
        toast.success("Xuất file Excel thành công!");
      } catch (err) {
        console.error("Export Excel error:", err);
        toast.error("Lỗi khi xuất file Excel.");
      }
    } else if (type === "word") {
      let docTitle = "Danh sách câu hỏi";
      if (selectedDocId) {
        const docObj = documents.find((d) => d.id === selectedDocId);
        if (docObj) {
          docTitle = docObj.title;
        }
      }
      
      toast.info("Đang khởi tạo và tải ảnh cho file Word, vui lòng đợi...");
      exportQuestionsToWord(filtered, docTitle)
        .then(() => {
          toast.success("Xuất file Word thành công!");
        })
        .catch((err) => {
          console.error(err);
          toast.error("Có lỗi xảy ra khi tạo file Word.");
        });
    }
  };

  if (loadingDocs) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {/* Selection & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Filter Modal Trigger + Search combined */}
        <div className="flex items-center gap-2 w-full sm:flex-1">
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setShowFilterModal(true)}
              title="Lọc tài liệu"
              className="btn-secondary flex items-center justify-center p-2.5 rounded-xl hover:opacity-95 transition-colors shadow-sm"
            >
              <Filter className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </button>
          </div>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 w-4 h-4 input-search-icon" />
            <input
              type="text"
              placeholder="Tìm theo câu hỏi, câu trả lời, hoặc tài liệu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-themed w-full pl-9 pr-4 py-2.5 text-sm rounded-xl outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end sm:justify-start">
          {/* Download Word */}
          <button
            onClick={() => handleDownload("word")}
            title="Tải Word"
            className="btn-secondary p-2.5 rounded-xl hover:bg-[var(--bg-2)] transition-colors shadow-sm"
          >
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </button>

          {/* Download Excel */}
          <button
            onClick={() => handleDownload("excel")}
            title="Tải Excel"
            className="btn-secondary p-2.5 rounded-xl hover:bg-[var(--bg-2)] transition-colors shadow-sm"
          >
            <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </button>

          {/* Refresh */}
          <button
            onClick={() => fetchQuestions(selectedDocIds)}
            title="Tải lại danh sách"
            className="btn-secondary p-2.5 rounded-xl hover:bg-[var(--bg-2)] transition-colors shadow-sm"
          >
            <RefreshCw className="w-5 h-5" />
          </button>

          {/* Bulk delete */}
          {selectedQuestionIds.length > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={isDeletingBulk}
              title={`Xóa ${selectedQuestionIds.length} câu hỏi đã chọn`}
              className="btn-danger flex items-center justify-center p-2.5 rounded-xl text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}

          {/* Add Question */}
          <button
            disabled={selectedDocIds.length === 0}
            onClick={openAddClick}
            title="Thêm câu hỏi mới"
            className="btn-primary flex items-center justify-center p-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Multi-document Selection Status */}
      {selectedDocIds.length > 0 && (
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
            <>
              {/* Select All Checkbox Container */}
              <div className="flex items-center gap-3 px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--bg-1)] shadow-sm">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={handleToggleSelectAll}
                  className="w-4 h-4 rounded cursor-pointer shrink-0 accent-emerald-600"
                  id="select-all-checkbox"
                />
                <label htmlFor="select-all-checkbox" className="text-xs font-semibold text-slate-500 cursor-pointer select-none">
                  {isAllSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"} ({selectedQuestionIds.length}/{filtered.length} câu hỏi)
                </label>
              </div>

              {filtered.map((q, idx) => (
                <QuestionCard
                  key={q.id}
                  q={q}
                  displayIndex={idx + 1}
                  documents={documents}
                  selectedDocIds={selectedDocIds}
                  selectedQuestionIds={selectedQuestionIds}
                  toggleSelectQuestion={toggleSelectQuestion}
                  handleEditClick={handleEditClick}
                  handleDelete={handleDelete}
                />
              ))}
            </>
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
