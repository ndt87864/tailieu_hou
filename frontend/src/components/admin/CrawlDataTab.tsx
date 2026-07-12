import React, { useEffect, useState } from "react";
import apiClient from "../../services/client.js";
import { toast } from "react-toastify";
import { useConfirm } from "../../context/ConfirmContext.js";
import { useUI } from "../../context/UIContext.js";
import {
  Trash2,
  RefreshCw,
  Search,
  ExternalLink,
  Edit3,
  Filter
} from "lucide-react";
import { EditCrawlDataModal } from "./EditCrawlDataModal.js";
import FilterCrawlDataModal from "./FilterCrawlDataModal.js";
import CrawlerQuestionCard, { CrawlerQuestion } from "./CrawlerQuestionCard.js";

interface CrawlerCourse {
  id: string;
  document_id: string;
  moodle_course_id: string;
  title: string;
  url: string;
  document?: { title: string };
}

interface CrawlerResource {
  id: string;
  course_id: string;
  type: string;
  title: string;
  content_url?: string;
  week_name?: string;
  course?: { title: string, document_id: string };
}

interface CrawlDataTabProps {
  view: "courses" | "questions" | "resources";
}

export const CrawlDataTab: React.FC<CrawlDataTabProps> = ({ view }) => {
  const confirm = useConfirm();
  
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<CrawlerCourse[]>([]);
  const [resources, setResources] = useState<CrawlerResource[]>([]);
  const [questions, setQuestions] = useState<CrawlerQuestion[]>([]);
  
  const [search, setSearch] = useState("");
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editData, setEditData] = useState<any | null>(null);
  const [allCourses, setAllCourses] = useState<{id: string, title: string}[]>([]);
  const [sortBy, setSortBy] = useState<"default" | "az" | "za" | "oldest" | "newest">("default");
  const [filterType, setFilterType] = useState<"all" | "has_image" | "no_image" | "multiple_choice" | "fill_blank">("all");
  
  const [documents, setDocuments] = useState<{id: string, title: string, category_id?: string | null}[]>([]);

  const { setPageLoading } = useUI();

  const fetchData = (docIds?: string[]) => {
    setPageLoading(true);
    setLoading(true);
    setSelectedIds([]);
    if (view === "courses") {
      apiClient.get(`/api/v1/admin/crawler/courses`)
        .then(res => {
          setCourses(res.data.courses || []);
          setAllCourses((res.data.courses || []).map((c: any) => ({ id: c.id, title: c.title })));
          setLoading(false);
        })
        .catch(() => toast.error("Không thể tải danh sách khóa học"))
        .finally(() => {
          setLoading(false);
          setPageLoading(false);
        });
    } else if (view === "resources") {
      const params = docIds && docIds.length > 0 ? `?document_ids=${docIds.join(",")}` : "";
      apiClient.get(`/api/v1/admin/crawler/resources${params}`)
        .then(res => {
          setResources(res.data.resources || []);
          setLoading(false);
        })
        .catch(() => toast.error("Không thể tải danh sách tài nguyên"))
        .finally(() => {
          setLoading(false);
          setPageLoading(false);
        });
    } else if (view === "questions") {
      const params = docIds && docIds.length > 0 ? `?document_ids=${docIds.join(",")}` : "";
      apiClient.get(`/api/v1/admin/crawler/questions${params}`)
        .then(res => {
          setQuestions(res.data.questions || []);
          setLoading(false);
        })
        .catch(() => toast.error("Không thể tải danh sách câu hỏi"))
        .finally(() => {
          setLoading(false);
          setPageLoading(false);
        });
    }
  };

  const [categories, setCategories] = useState<{id: string, title: string}[]>([]);

  // 1. Tải danh sách documents và categories có dữ liệu crawler ban đầu
  useEffect(() => {
    if (view === "questions" || view === "resources") {
      apiClient.get("/api/v1/admin/crawler/filter-options")
        .then((res) => {
          const docs = res.data.documents || [];
          const cats = res.data.categories || [];
          setDocuments(docs);
          setCategories(cats);
          if (docs.length > 0) {
            // Mặc định chọn tài liệu đầu tiên có dữ liệu crawler
            setSelectedDocIds([docs[0].id]);
          }
        })
        .catch((err) => console.error(err));
    }
  }, [view]);

  useEffect(() => {
    const handleOutsideClick = () => {
      document.querySelectorAll(".custom-select-options").forEach(el => el.classList.add("hidden"));
    };
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  // 2. Lắng nghe thay đổi tab và filter để fetch dữ liệu
  useEffect(() => {
    setSelectedIds([]);
    
    if (view === "courses") {
      fetchData();
    } else if (view === "questions" || view === "resources") {
      if (selectedDocIds.length > 0) {
        fetchData(selectedDocIds);
      }
    }
  }, [view, selectedDocIds]);

  const handleDeleteResource = async (id: string) => {
    const ok = await confirm("Bạn có chắc muốn xoá tài nguyên crawl này?");
    if (!ok) return;
    try {
      await apiClient.delete(`/api/v1/admin/crawler/resources/${id}`);
      toast.success("Xoá tài nguyên thành công!");
      setResources((prev) => prev.filter((r) => r.id !== id));
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Xóa thất bại");
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    const ok = await confirm("Bạn có chắc muốn xoá câu hỏi crawl này?");
    if (!ok) return;
    try {
      await apiClient.delete(`/api/v1/admin/crawler/questions/${id}`);
      toast.success("Xoá câu hỏi thành công!");
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Xóa thất bại");
    }
  };

  const handleDeleteCourse = async (id: string) => {
    const ok = await confirm("CẢNH BÁO: Xoá Course này sẽ xoá TOÀN BỘ resources và questions crawl của môn này. Bạn có chắc chắn?");
    if (!ok) return;
    try {
      await apiClient.delete(`/api/v1/admin/crawler/courses/${id}`);
      toast.success("Xoá toàn bộ dữ liệu crawl của môn học thành công!");
      setCourses((prev) => prev.filter((c) => c.id !== id));
      setAllCourses((prev) => prev.filter((c) => c.id !== id));
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Xóa thất bại");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const isCourse = view === "courses";
    const warnMsg = isCourse 
      ? `CẢNH BÁO: Xoá ${selectedIds.length} Course này sẽ xoá TOÀN BỘ resources và questions crawl của chúng. Chắc chắn tiếp tục?`
      : `Bạn có chắc muốn xoá ${selectedIds.length} mục đã chọn?`;
    
    const ok = await confirm(warnMsg);
    if (!ok) return;

    try {
      await apiClient.post(`/api/v1/admin/crawler/${view}/bulk-delete`, { ids: selectedIds });
      toast.success(`Đã xoá ${selectedIds.length} mục!`);
      if (view === "courses") {
        setCourses(prev => prev.filter(c => !selectedIds.includes(c.id)));
        setAllCourses(prev => prev.filter(c => !selectedIds.includes(c.id)));
      } else if (view === "resources") {
        setResources(prev => prev.filter(r => !selectedIds.includes(r.id)));
      } else if (view === "questions") {
        setQuestions(prev => prev.filter(q => !selectedIds.includes(q.id)));
      }
      setSelectedIds([]);
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Xóa nhiều thất bại");
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleToggleSelectAll = (filteredIds: string[]) => {
    if (selectedIds.length === filteredIds.length && filteredIds.length > 0) {
      setSelectedIds([]); // Deselect all
    } else {
      setSelectedIds(filteredIds); // Select all filtered
    }
  };

  const handleEditSuccess = (updatedItem: any) => {
    if (view === "courses") {
      setCourses(prev => prev.map(c => c.id === updatedItem.id ? { ...c, ...updatedItem } : c));
      setAllCourses(prev => prev.map(c => c.id === updatedItem.id ? { ...c, ...updatedItem } : c));
    } else if (view === "resources") {
      setResources(prev => prev.map(r => r.id === updatedItem.id ? { ...r, ...updatedItem } : r));
    } else if (view === "questions") {
      setQuestions(prev => prev.map(q => q.id === updatedItem.id ? { ...q, ...updatedItem } : q));
    }
    setEditData(null);
  };

  // Chỉ filter theo search (client-side) — filter môn học đã được xử lý phía server
  const filteredCourses = courses.filter(c => 
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.moodle_course_id.toLowerCase().includes(search.toLowerCase()) ||
    (c.document?.title || "").toLowerCase().includes(search.toLowerCase())
  );

  const filteredResources = resources.filter(r =>
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    (r.course?.title || "").toLowerCase().includes(search.toLowerCase())
  );

  const filteredQuestions = questions
    .filter(q => {
      // 1. Lọc theo thanh tìm kiếm
      const matchSearch = (
        q.question.toLowerCase().includes(search.toLowerCase()) ||
        (q.course?.title || "").toLowerCase().includes(search.toLowerCase()) ||
        (q.week_name || "").toLowerCase().includes(search.toLowerCase())
      );

      if (!matchSearch) return false;

      // 2. Lọc theo filterType (Bộ lọc nội dung)
      const hasImage = !!(q.url_question || q.url_answer || q.url_choices);
      const isMultipleChoice = Array.isArray(q.choices) && q.choices.filter(Boolean).length >= 2;

      if (filterType === "has_image") {
        return hasImage;
      }
      if (filterType === "no_image") {
        return !hasImage;
      }
      if (filterType === "multiple_choice") {
        return isMultipleChoice;
      }
      if (filterType === "fill_blank") {
        return !isMultipleChoice;
      }

      return true;
    })
    .sort((a, b) => {
      // 3. Sắp xếp theo sortBy
      if (sortBy === "az") {
        return a.question.localeCompare(b.question, "vi");
      }
      if (sortBy === "za") {
        return b.question.localeCompare(a.question, "vi");
      }
      // Dữ liệu crawl thô thường không có created_at, ta sắp xếp theo ID hoặc giữ nguyên
      if (sortBy === "oldest") {
        return a.id.localeCompare(b.id);
      }
      if (sortBy === "newest") {
        return b.id.localeCompare(a.id);
      }
      // Mặc định
      return 0;
    });

  const currentFilteredIds = 
    view === "courses" ? filteredCourses.map(c => c.id) :
    view === "resources" ? filteredResources.map(r => r.id) :
    filteredQuestions.map(q => q.id);

  const isAllSelected = currentFilteredIds.length > 0 && selectedIds.length === currentFilteredIds.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Filter Modal Trigger + Search combined */}
        <div className="flex items-center gap-2 w-full sm:flex-1">
          {(view === "questions" || view === "resources") && (
            <div className="shrink-0">
              <button
                type="button"
                onClick={() => setShowFilterModal(true)}
                title="Lọc môn học"
                className="btn-secondary flex items-center justify-center p-2.5 rounded-xl hover:opacity-95 transition-colors shadow-sm"
              >
                <Filter className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </button>
            </div>
          )}
          
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-themed w-full pl-9 pr-4 py-2.5 text-sm rounded-xl outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end sm:justify-start">
          {selectedIds.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className="bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 p-2.5 rounded-xl font-medium flex items-center justify-center transition-colors border border-red-100 dark:border-red-500/20 shadow-sm"
              title={`Xóa ${selectedIds.length} mục đã chọn`}
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => fetchData(selectedDocIds)}
            title="Tải lại"
            className="btn-secondary p-2.5 rounded-xl hover:bg-[var(--bg-2)] transition-colors shadow-sm"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 2 bộ lọc nâng cao mới cho tab Crawler Questions */}
      {view === "questions" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Custom Dropdown Sắp xếp */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--fg-2)] whitespace-nowrap">Sắp xếp:</span>
            <div className="relative flex-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const target = e.currentTarget.nextElementSibling as HTMLElement;
                  if (target) {
                    const isHidden = target.classList.contains("hidden");
                    document.querySelectorAll(".custom-select-options").forEach(el => el.classList.add("hidden"));
                    if (isHidden) target.classList.remove("hidden");
                  }
                }}
                className="w-full select-themed px-3 py-2 text-xs rounded-xl outline-none focus:border-brand-500 text-left flex items-center justify-between border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)]"
              >
                <span>
                  {sortBy === "default" && "Thứ tự STT mặc định"}
                  {sortBy === "az" && "Theo chữ cái (A → Z)"}
                  {sortBy === "za" && "Theo chữ cái (Z → A)"}
                  {sortBy === "oldest" && "Thời gian tạo (Cũ → Mới)"}
                  {sortBy === "newest" && "Thời gian tạo (Mới → Cũ)"}
                </span>
              </button>
              <div className="custom-select-options hidden absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg overflow-hidden py-1">
                {[
                  { value: "default", label: "Thứ tự STT mặc định" },
                  { value: "az", label: "Theo chữ cái (A → Z)" },
                  { value: "za", label: "Theo chữ cái (Z → A)" },
                  { value: "oldest", label: "Thời gian tạo (Cũ → Mới)" },
                  { value: "newest", label: "Thời gian tạo (Mới → Cũ)" }
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={(e) => {
                      setSortBy(item.value as any);
                      e.currentTarget.parentElement?.classList.add("hidden");
                    }}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-[var(--bg-2)] ${sortBy === item.value ? "bg-brand-50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-400 font-semibold" : "text-[var(--fg)]"}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Custom Dropdown Loại câu hỏi */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--fg-2)] whitespace-nowrap">Loại câu hỏi:</span>
            <div className="relative flex-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const target = e.currentTarget.nextElementSibling as HTMLElement;
                  if (target) {
                    const isHidden = target.classList.contains("hidden");
                    document.querySelectorAll(".custom-select-options").forEach(el => el.classList.add("hidden"));
                    if (isHidden) target.classList.remove("hidden");
                  }
                }}
                className="w-full select-themed px-3 py-2 text-xs rounded-xl outline-none focus:border-brand-500 text-left flex items-center justify-between border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)]"
              >
                <span>
                  {filterType === "all" && "Tất cả câu hỏi"}
                  {filterType === "has_image" && "Câu hỏi có hình ảnh"}
                  {filterType === "no_image" && "Câu hỏi không có hình ảnh"}
                  {filterType === "multiple_choice" && "Câu hỏi trắc nghiệm (A, B, C, D)"}
                  {filterType === "fill_blank" && "Câu hỏi điền từ / Tự luận"}
                </span>
              </button>
              <div className="custom-select-options hidden absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg overflow-hidden py-1">
                {[
                  { value: "all", label: "Tất cả câu hỏi" },
                  { value: "has_image", label: "Câu hỏi có hình ảnh" },
                  { value: "no_image", label: "Câu hỏi không có hình ảnh" },
                  { value: "multiple_choice", label: "Câu hỏi trắc nghiệm (A, B, C, D)" },
                  { value: "fill_blank", label: "Câu hỏi điền từ / Tự luận" }
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={(e) => {
                      setFilterType(item.value as any);
                      e.currentTarget.parentElement?.classList.add("hidden");
                    }}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-[var(--bg-2)] ${filterType === item.value ? "bg-brand-50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-400 font-semibold" : "text-[var(--fg)]"}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Multi-document Selection Status */}
      {(view === "questions" || view === "resources") && selectedDocIds.length > 0 && (
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

      {/* Filter Modal */}
      <FilterCrawlDataModal
        show={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        categories={categories}
        documents={documents}
        selectedDocIds={selectedDocIds}
        onApply={(ids) => {
          setSelectedDocIds(ids);
          setShowFilterModal(false);
        }}
      />

      {loading ? null : (
        <>
          {/* Questions view: dùng container trong suốt, để card từng câu hỏi tự nổi */}
          {view === "questions" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={() => handleToggleSelectAll(currentFilteredIds)}
                    className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                  />
                  <span className="text-sm font-medium text-[var(--text-secondary)]">Chọn tất cả</span>
                </div>
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  Câu hỏi ({filteredQuestions.length})
                </span>
              </div>
              {filteredQuestions.length === 0 ? (
                <div className="card p-8 text-center text-slate-500">Không có dữ liệu</div>
              ) : (
                filteredQuestions.map((q, idx) => (
                  <CrawlerQuestionCard
                    key={q.id}
                    q={q}
                    displayIndex={idx + 1}
                    selectedQuestionIds={selectedIds}
                    toggleSelectQuestion={handleToggleSelect}
                    handleEditClick={setEditData}
                    handleDelete={handleDeleteQuestion}
                  />
                ))
              )}
            </div>
          ) : (
            <div className="card p-5 space-y-4">
              <h4 className="font-semibold text-[var(--text-primary)] border-b pb-2 border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <span>
                  {view === "courses" && `Khóa học (${filteredCourses.length})`}
                  {view === "resources" && `Tài nguyên (${filteredResources.length})`}
                </span>
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      <th className="px-4 py-3 rounded-tl-xl w-10">
                        <input 
                          type="checkbox" 
                          checked={isAllSelected}
                          onChange={() => handleToggleSelectAll(currentFilteredIds)}
                          className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                        />
                      </th>
                      {view === "courses" && (
                        <>
                          <th className="px-4 py-3 font-semibold">Mã Moodle</th>
                          <th className="px-4 py-3 font-semibold">Khóa học</th>
                          <th className="px-4 py-3 font-semibold">Tài liệu (Hệ thống)</th>
                          <th className="px-4 py-3 font-semibold text-right rounded-tr-xl">Thao tác</th>
                        </>
                      )}
                      {view === "resources" && (
                        <>
                          <th className="px-4 py-3 font-semibold">Khóa học</th>
                          <th className="px-4 py-3 font-semibold">Tuần</th>
                          <th className="px-4 py-3 font-semibold">Loại</th>
                          <th className="px-4 py-3 font-semibold">Tiêu đề</th>
                          <th className="px-4 py-3 font-semibold text-right rounded-tr-xl">Thao tác</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {view === "courses" && filteredCourses.length === 0 && <tr><td colSpan={5} className="px-4 py-3 text-center">Không có dữ liệu</td></tr>}
                    {view === "resources" && filteredResources.length === 0 && <tr><td colSpan={6} className="px-4 py-3 text-center">Không có dữ liệu</td></tr>}
                    
                    {view === "courses" && filteredCourses.map(c => (
                      <tr key={c.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3">
                          <input 
                            type="checkbox" 
                            checked={selectedIds.includes(c.id)}
                            onChange={() => handleToggleSelect(c.id)}
                            className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                          />
                        </td>
                        <td className="px-4 py-3 font-mono text-[var(--text-secondary)]">{c.moodle_course_id}</td>
                        <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                          {c.url ? (
                            <a href={c.url} target="_blank" rel="noreferrer" className="hover:text-blue-600 hover:underline flex items-center gap-1">
                              {c.title} <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : c.title}
                        </td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">{c.document?.title || "-"}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setEditData(c)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded" title="Sửa"><Edit3 className="w-4 h-4" /></button>
                            <button onClick={() => handleDeleteCourse(c.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Xoá"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    
                    {view === "resources" && filteredResources.map(r => (
                      <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3">
                          <input 
                            type="checkbox" 
                            checked={selectedIds.includes(r.id)}
                            onChange={() => handleToggleSelect(r.id)}
                            className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">{r.course?.title || "-"}</td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">{r.week_name || "-"}</td>
                        <td className="px-4 py-3 text-[var(--text-secondary)] capitalize"><span className={`px-2 py-1 rounded text-xs ${r.type === 'video' || r.type === 'youtube' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{r.type}</span></td>
                        <td className="px-4 py-3 font-medium text-[var(--text-primary)] max-w-xs truncate">
                          {r.content_url ? <a href={r.content_url} target="_blank" rel="noreferrer" className="hover:text-blue-600 hover:underline">{r.title}</a> : r.title}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setEditData(r)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded" title="Sửa"><Edit3 className="w-4 h-4" /></button>
                            <button onClick={() => handleDeleteResource(r.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Xoá"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {editData && (
        <EditCrawlDataModal
          view={view}
          data={editData}
          onClose={() => setEditData(null)}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  );
};
