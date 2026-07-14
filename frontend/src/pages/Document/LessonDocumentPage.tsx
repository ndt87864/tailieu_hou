import React, { useEffect, useState, useMemo, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useUI } from "../../context/UIContext.js";
import apiClient from "../../services/client.js";
import { cachedGet } from "../../utils/apiCache.js";
import LoadingSpinner from "../../components/common/LoadingSpinner.js";
import { useAuth } from "../../context/AuthContext.js";
import { Header } from "../../components/layout/Layout.js";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import { cleanForExport } from "../../utils/questionHelper.js";
import { 
  BookOpen, FileText, HelpCircle,
  Crown, Search, X, Download
} from "lucide-react";
import { LessonMaterials } from "../../components/document/LessonMaterials.js";
import { LessonQuizTab } from "../../components/document/LessonQuizTab.js";

interface CrawlerResource {
  id: string;
  course_id: string;
  type: "file" | "youtube" | "announcement";
  title: string;
  content_url: string | null;
  raw_content: string | null;
  week_name: string;
  created_at: string;
}

interface CrawlerQuestion {
  id: string;
  course_id: string;
  week_name: string;
  question: string;
  choices: string[];
  answer: string;
  url_question?: string | null;
  url_answer?: string | null;
  url_choices?: string | null;
  image_urls?: string[];
  isPremiumLocked?: boolean;
}

interface Document {
  id: string;
  title: string;
  description: string;
  category_id?: string | null;
  active?: boolean;
  premium?: boolean;
  category?: {
    title: string;
  } | null;
}

const LessonDocumentPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { loading: authLoading, user, profile } = useAuth();
  const { setPageLoading } = useUI();
  const lastLoadedId = useRef<string | null>(null);
  
  const isExcelEnabled = profile?.is_excel_enabled !== false;
  const defaultExcelPct = 50;
  const excelPercentage = profile?.excel_percentage !== undefined && profile.excel_percentage !== null 
    ? profile.excel_percentage 
    : defaultExcelPct;
  const canDownloadExcel = isExcelEnabled && excelPercentage > 0;

  const [doc, setDoc] = useState<Document | null>(null);
  const [resources, setResources] = useState<CrawlerResource[]>([]);
  const [questions, setQuestions] = useState<CrawlerQuestion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [limitApplied, setLimitApplied] = useState<boolean>(false);
  
  const [activeTab, setActiveTab] = useState<"materials" | "quiz">("materials");
  const handleTabChange = (tab: "materials" | "quiz") => {
    if (tab === activeTab) return;
    setPageLoading(true);
    setTimeout(() => {
      setActiveTab(tab);
      setTimeout(() => {
        setPageLoading(false);
      }, 150);
    }, 50);
  };
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [questionCount, setQuestionCount] = useState<number>(0);
  const [questionsLoading, setQuestionsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!id || authLoading) return;
    setLoading(true);
    setQuestionsLoading(true);
    setPageLoading(true);
    setError(null);

    Promise.all([
      cachedGet(`/api/v1/documents/${id}/lessons/metadata`),
      apiClient.get(`/api/v1/documents/${id}/lessons/resources`),
      apiClient.get(`/api/v1/documents/${id}/lessons/questions`)
    ])
      .then(([metaRes, resRes, qRes]: [any, any, any]) => {
        const fetchedDoc = metaRes.data.document;
        const fetchedResources = resRes.data.resources || [];
        const fetchedQuestions = qRes.data.questions || [];
        const isLimitApplied = qRes.data.limitApplied || false;

        setDoc(fetchedDoc);
        setResources(fetchedResources);
        setQuestions(fetchedQuestions);
        setLimitApplied(isLimitApplied);

        const totalQCount = qRes.data.totalFilteredCount !== undefined ? qRes.data.totalFilteredCount : fetchedQuestions.length;
        setQuestionCount(totalQCount);
        
        lastLoadedId.current = id;
        setLoading(false);
        setQuestionsLoading(false);
        setPageLoading(false);
      })
      .catch((err) => {
        console.error(err);
        if (err.response?.status === 403) {
          setError("Tài liệu Premium. Vui lòng nâng cấp tài khoản để truy cập.");
        } else {
          setError("Lỗi tải thông tin bài học. Vui lòng thử lại.");
        }
        setLoading(false);
        setQuestionsLoading(false);
        setPageLoading(false);
      });
  }, [id, authLoading, setPageLoading]);

  const currentResources = resources;
  const currentQuestions = questions;

  // Bộ lọc câu hỏi theo thanh tìm kiếm
  const filteredQuestions = useMemo(() => {
    let list = currentQuestions;
    
    // LỌC: Bỏ qua câu hỏi thuộc tuần thử nghiệm
    list = list.filter(q => !(q.week_name || "").toLowerCase().includes("thử nghiệm"));
    
    if (!searchQuery) return list;
    const query = searchQuery.toLowerCase().trim();
    return list.filter(q => 
      q.question.toLowerCase().includes(query) || 
      q.answer.toLowerCase().includes(query) ||
      q.choices?.some(c => c.toLowerCase().includes(query))
    );
  }, [currentQuestions, searchQuery]);

  // Gom nhóm tài nguyên theo tuần tự động từ resources
  const groupedResources = useMemo(() => {
    const groups: { [weekName: string]: CrawlerResource[] } = {};
    
    currentResources.forEach(r => {
      const wName = r.week_name || "Khác";
      
      // LỌC: Bỏ qua tuần thử nghiệm hoặc file thử nghiệm
      if (wName.toLowerCase().includes("thử nghiệm") || r.title.toLowerCase().includes("thử nghiệm")) {
        return;
      }
      
      if (!groups[wName]) {
        groups[wName] = [];
      }
      if (r.type === "file") {
        groups[wName].push(r);
      }
    });

    const sortedWeeks = Object.keys(groups).sort((a, b) => 
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );

    return sortedWeeks
      .map(w => ({
        weekName: w,
        files: groups[w],
      }))
      .filter(g => g.files.length > 0);
  }, [resources]);

  // Export excel TOÀN BỘ câu hỏi LMS
  const exportAllToExcel = () => {
    try {
      if (!user) {
        toast.error("Vui lòng đăng nhập để thực hiện tải xuống.");
        return;
      }
      if (!canDownloadExcel) {
        toast.error(profile?.is_excel_enabled === false ? "Quyền tải Excel của bạn đã bị tắt." : "Tài khoản của bạn không có quyền tải bộ câu hỏi này.");
        return;
      }

      if (currentQuestions.length === 0) {
        toast.info("Không có câu hỏi nào để xuất.");
        return;
      }

      let dataToExport = currentQuestions;
      if (excelPercentage < 100) {
        const limitedCount = Math.floor(currentQuestions.length * (excelPercentage / 100));
        dataToExport = currentQuestions.slice(0, limitedCount);
      }

      const excelData = dataToExport.map((q, idx) => ({
        "STT": idx + 1,
        "Tuần": q.week_name || "",
        "Câu hỏi": q.isPremiumLocked ? "Nội dung câu hỏi này đã bị khóa. Vui lòng nâng cấp tài khoản để xem tiếp." : cleanForExport(q.question), // Strip HTML
        "Lựa chọn A": q.isPremiumLocked ? "Khóa" : cleanForExport(q.choices?.[0] || ""),
        "Lựa chọn B": q.isPremiumLocked ? "Khóa" : cleanForExport(q.choices?.[1] || ""),
        "Lựa chọn C": q.isPremiumLocked ? "Khóa" : cleanForExport(q.choices?.[2] || ""),
        "Lựa chọn D": q.isPremiumLocked ? "Khóa" : cleanForExport(q.choices?.[3] || ""),
        "Đáp án": q.isPremiumLocked ? "" : cleanForExport(q.answer),
      }));

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      
      const maxLenQuestion = Math.max(...excelData.map(d => d["Câu hỏi"].length), 10);
      worksheet["!cols"] = [
        { wch: 6 },
        { wch: 15 },
        { wch: Math.min(maxLenQuestion, 50) },
        { wch: 25 },
        { wch: 25 },
        { wch: 25 },
        { wch: 25 },
        { wch: 20 },
      ];

      const weekLabel = "Tat_ca_tuan";
      XLSX.utils.book_append_sheet(workbook, worksheet, weekLabel);
      
      let safeTitle = (doc?.title || "Mon_hoc").replace(/[\\\/\?\*\[\]:<>|"]/g, "_");
      const percentageSuffix = excelPercentage < 100 ? `_${excelPercentage}percent` : "";
      let fileName = `${safeTitle} - ${weekLabel}${percentageSuffix}.xlsx`;
      fileName = fileName.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");

      XLSX.writeFile(workbook, fileName);
      toast.success(`Xuất file Excel câu hỏi LMS thành công!`);
    } catch (err) {
      console.error("Lỗi xuất excel:", err);
      toast.error("Có lỗi xảy ra khi xuất file Excel.");
    }
  };

  if (loading && !doc) return <LoadingSpinner />;
  if (error || !doc) {
    return (
      <div className="flex-1 min-w-0 w-full flex flex-col doc-main-bg">
        <Header 
          title="Bài học & Học liệu"
          hideLogo={true}
          showSubjectSearch={true}
          onMobileMenuClick={() => window.dispatchEvent(new Event("open-doc-sidebar"))}
          onOpenSettings={() => window.dispatchEvent(new Event("open-settings"))}
          onOpenProfile={() => window.dispatchEvent(new Event("open-profile"))}
        />
        <div className="flex flex-col items-center justify-center p-8 flex-1">
          <div className="max-w-md text-center space-y-4">
            <Crown className="w-12 h-12 mx-auto text-amber-500" />
            <h3 className="text-lg font-bold text-[var(--fg)]">{error || "Không có dữ liệu bài học."}</h3>
            <p className="text-sm text-[var(--muted)]">
              Môn học này có thể là tài liệu Premium hoặc dữ liệu LMS chưa được cập nhật hệ thống.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link to="/" className="text-xs text-[var(--brand-600)] hover:underline">← Về trang chủ</Link>
              {doc?.premium && (
                <Link to="/pricing" className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold">
                  Nâng cấp Premium
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hasNoData = resources.length === 0 && questions.length === 0;

  return (
    <div className="flex-1 min-w-0 w-full flex flex-col doc-main-bg">
      <Header 
        title={doc.title}
        subtitle={doc.category?.title || "Bài học"}
        hideLogo={true}
        showSubjectSearch={true}
        onMobileMenuClick={() => window.dispatchEvent(new Event("open-doc-sidebar"))}
        onOpenSettings={() => window.dispatchEvent(new Event("open-settings"))}
        onOpenProfile={() => window.dispatchEvent(new Event("open-profile"))}
      />

      <div className="lesson-detail-container flex justify-center">
        {hasNoData ? (
          <div className="lesson-empty-state max-w-4xl w-full">
            <BookOpen className="lesson-empty-icon" />
            <h3 className="lesson-empty-title">Chưa có bài học LMS</h3>
            <p className="lesson-empty-desc">Hệ thống chưa crawl dữ liệu bài học hoặc bài giảng của môn học này.</p>
            <Link to={`/documents/${doc.id}`} className="lesson-btn-primary">
              <HelpCircle className="w-4 h-4" /> Làm câu hỏi ôn tập
            </Link>
          </div>
        ) : (
          <div className="lesson-layout-wrapper max-w-5xl w-full mx-auto">
            {/* Tab switcher */}
            <div className="lesson-page-header-actions lesson-page-header-actions--top flex items-center justify-between gap-4">
              <div className="lesson-tab-switcher shrink-0">
                <div className="relative group">
                  <button
                    onClick={() => handleTabChange("materials")}
                    className={`lesson-tab-btn ${activeTab === "materials" ? "lesson-tab-btn-active" : ""}`}
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                  </button>
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-800 text-white text-[10px] px-2 py-1 rounded shadow-md whitespace-nowrap z-50">
                    Bài học &amp; Tài liệu
                  </span>
                </div>
                <div className="relative group">
                  <button
                    onClick={() => handleTabChange("quiz")}
                    className={`lesson-tab-btn ${activeTab === "quiz" ? "lesson-tab-btn-active" : ""}`}
                  >
                    <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                  </button>
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-800 text-white text-[10px] px-2 py-1 rounded shadow-md whitespace-nowrap z-50">
                    Câu hỏi {questionsLoading ? "..." : `(${questionCount})`}
                  </span>
                </div>
              </div>

              {activeTab === "quiz" && !questionsLoading && (
                <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
                  <div className="lesson-quiz-search-wrap flex-1 max-w-[200px] sm:max-w-xs relative flex items-center">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--muted)]" />
                    <input
                      type="text"
                      placeholder="Tìm câu hỏi, đáp án..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-7 py-1.5 rounded-lg border text-xs bg-[var(--surface)] border-[var(--border)] text-[var(--fg)] focus:outline-none"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--fg)]">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  {currentQuestions.length > 0 && (
                    <button
                      onClick={exportAllToExcel}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg-2)] text-[var(--accent)] hover:bg-[var(--bg-3)] border border-[var(--border)] transition-all cursor-pointer whitespace-nowrap"
                      title="Tải Excel toàn bộ câu hỏi của môn học"
                    >
                      <Download className="w-3.5 h-3.5 text-[var(--accent)]" />
                      <span className="hidden sm:inline">Tải Excel</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Tab 1: Bài học & Tài liệu */}
            {activeTab === "materials" && (
              <div className="lesson-tab-content">
                <LessonMaterials
                  groupedResources={groupedResources}
                />
              </div>
            )}

            {/* Tab 2: Câu hỏi LMS */}
            {activeTab === "quiz" && (
              <div className="lesson-tab-content">
                {questionsLoading ? (
                  <LoadingSpinner />
                ) : (
                  <LessonQuizTab
                    currentQuestions={currentQuestions}
                    filteredQuestions={filteredQuestions}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    exportAllToExcel={exportAllToExcel}
                    limitApplied={limitApplied}
                    totalCountBeforeLimit={questionCount}
                  />
                )}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
};

export default LessonDocumentPage;
