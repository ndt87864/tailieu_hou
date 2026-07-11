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
  Crown, Filter
} from "lucide-react";
import { LessonFilterModal } from "../../components/document/LessonFilterModal.jsx";
import { LessonMaterials } from "../../components/document/LessonMaterials.js";
import { LessonQuizTab } from "../../components/document/LessonQuizTab.js";

interface CrawlerCourse {
  id: string;
  document_id: string;
  moodle_course_id: string | null;
  title: string;
  url: string | null;
  created_at: string;
}

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
  const [courses, setCourses] = useState<CrawlerCourse[]>([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [resources, setResources] = useState<CrawlerResource[]>([]);
  const [questions, setQuestions] = useState<CrawlerQuestion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [limitApplied, setLimitApplied] = useState<boolean>(false);
  
  // Trạng thái điều hướng tuần
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>([]);
  const [allWeeks, setAllWeeks] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"materials" | "quiz">("materials");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  
  // Trạng thái làm bài trắc nghiệm LMS trực tuyến - đã chuyển sang chế độ hiển thị đáp án trực tiếp

  const [questionCount, setQuestionCount] = useState<number>(0);

  useEffect(() => {
    if (!id || authLoading) return;
    setLoading(true);
    setPageLoading(true);
    setError(null);

    cachedGet(`/api/v1/documents/${id}/lessons/metadata`)
      .then(async (res) => {
        const fetchedDoc = res.data.document;
        const fetchedCourses = res.data.courses || [];
        const fetchedWeeks = res.data.weeks || [];

        let initialCourseIds: string[] = [];
        let initialWeeks: string[] = [];
        if (fetchedCourses.length > 0) {
          initialCourseIds = [fetchedCourses[0].id];
        }
        if (fetchedWeeks.length > 0) {
          initialWeeks = [fetchedWeeks[0]];
        }

        if (fetchedCourses.length > 0 && fetchedWeeks.length > 0) {
          try {
            const courseParams = initialCourseIds.join(",");
            const weekParams = initialWeeks.join(",");
            const resRes = await cachedGet(`/api/v1/documents/${id}/lessons/resources?course_ids=${courseParams}&weeks=${encodeURIComponent(weekParams)}`);
            
            let fetchedQuestions = [];
            let isLimitApplied = false;
            let qRes: any = null;
            if (activeTab === "quiz") {
              setQuestionsLoading(true);
              qRes = await cachedGet(`/api/v1/documents/${id}/lessons/questions?course_ids=${courseParams}&weeks=${encodeURIComponent(weekParams)}`);
              fetchedQuestions = qRes.data.questions || [];
              isLimitApplied = qRes.data.limitApplied || false;
              setQuestionsLoading(false);
            }

            setDoc(fetchedDoc);
            setCourses(fetchedCourses);
            setAllWeeks(fetchedWeeks);
            setSelectedCourseIds(initialCourseIds);
            setSelectedWeeks(initialWeeks);
            setResources(resRes.data?.resources || []);
            setQuestions(fetchedQuestions);
            setLimitApplied(isLimitApplied);
            const totalQCount = activeTab === "quiz" 
              ? (qRes?.data?.totalFilteredCount !== undefined ? qRes.data.totalFilteredCount : fetchedQuestions.length)
              : (resRes.data?.questionCount || 0);
            setQuestionCount(totalQCount);
            lastLoadedId.current = id;
          } catch (err) {
            console.error(err);
            toast.error("Lỗi tải tài liệu học tập.");
          }
        } else {
          setDoc(fetchedDoc);
          setCourses([]);
          setAllWeeks([]);
          setSelectedCourseIds([]);
          setSelectedWeeks([]);
          setResources([]);
          setQuestions([]);
          setQuestionCount(0);
          lastLoadedId.current = id;
        }

        setLoading(false);
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
        setPageLoading(false);
      });
  }, [id, authLoading, setPageLoading]);

  const [questionsLoading, setQuestionsLoading] = useState<boolean>(false);

  // Tải resources theo filter (lớp học và tuần)
  useEffect(() => {
    if (!id || authLoading || courses.length === 0 || allWeeks.length === 0) return;
    if (id !== lastLoadedId.current) return;
    if (selectedCourseIds.length === 0 || selectedWeeks.length === 0) {
      setResources([]);
      return;
    }

    const isAllCoursesSelected = selectedCourseIds.length === courses.length;
    const isAllWeeksSelected = selectedWeeks.length === allWeeks.length;

    setLoading(true);
    setPageLoading(true);
    
    let promiseResources;

    if (isAllCoursesSelected && isAllWeeksSelected) {
      promiseResources = apiClient.get(`/api/v1/documents/${id}/lessons/resources`)
        .then(res => res.data || { resources: [], questionCount: 0 });
    } else {
      const courseParams = selectedCourseIds.join(",");
      const weekParams = selectedWeeks.join(",");
      
      promiseResources = apiClient.get(`/api/v1/documents/${id}/lessons/resources?course_ids=${courseParams}&weeks=${encodeURIComponent(weekParams)}`)
        .then(res => res.data || { resources: [], questionCount: 0 });
    }

    promiseResources
      .then((data) => {
        setResources(data.resources || []);
        if (activeTab !== "quiz") {
          setQuestionCount(data.questionCount || 0);
        }
        setLoading(false);
        setPageLoading(false);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Lỗi tải tài liệu học tập.");
        setLoading(false);
        setPageLoading(false);
      });
  }, [id, authLoading, selectedCourseIds, selectedWeeks, courses.length, allWeeks.length, setPageLoading]);

  // Tải questions theo filter (lớp học và tuần) chỉ khi chuyển sang tab quiz
  useEffect(() => {
    if (!id || authLoading || courses.length === 0 || allWeeks.length === 0) return;
    if (id !== lastLoadedId.current) return;
    if (activeTab !== "quiz") return;
    if (selectedCourseIds.length === 0 || selectedWeeks.length === 0) {
      setQuestions([]);
      return;
    }

    const isAllCoursesSelected = selectedCourseIds.length === courses.length;
    const isAllWeeksSelected = selectedWeeks.length === allWeeks.length;

    setQuestionsLoading(true);
    setPageLoading(true);
    
    let promiseQuestions;

    if (isAllCoursesSelected && isAllWeeksSelected) {
      promiseQuestions = apiClient.get(`/api/v1/documents/${id}/lessons/questions`)
        .then(res => res.data || { questions: [] });
    } else {
      const courseParams = selectedCourseIds.join(",");
      const weekParams = selectedWeeks.join(",");
      
      promiseQuestions = apiClient.get(`/api/v1/documents/${id}/lessons/questions?course_ids=${courseParams}&weeks=${encodeURIComponent(weekParams)}`)
        .then(res => res.data || { questions: [] });
    }
    promiseQuestions
      .then((data) => {
        setQuestions(data.questions || []);
        setLimitApplied(data.limitApplied || false);
        setQuestionCount(data.totalFilteredCount !== undefined ? data.totalFilteredCount : (data.questions?.length || 0));
        setQuestionsLoading(false);
        setPageLoading(false);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Lỗi tải câu hỏi học tập.");
        setQuestionsLoading(false);
        setPageLoading(false);
      });
  }, [id, authLoading, selectedCourseIds, selectedWeeks, courses.length, allWeeks.length, activeTab, setPageLoading]);

  // Lọc tài nguyên và câu hỏi theo danh sách lớp học được chọn
  const activeResources = useMemo(() => {
    if (selectedCourseIds.length === 0) return [];
    return resources.filter(r => selectedCourseIds.includes(r.course_id));
  }, [resources, selectedCourseIds]);

  const activeQuestions = useMemo(() => {
    if (selectedCourseIds.length === 0) return [];
    return questions.filter(q => selectedCourseIds.includes(q.course_id));
  }, [questions, selectedCourseIds]);

  // Danh sách các tuần học duy nhất
  const weeks = allWeeks;

  // Tự động chọn tuần đầu tiên khi chuyển môn học hoặc khi tuần hiện tại không hợp lệ
  useEffect(() => {
    if (weeks.length > 0) {
      const validWeeks = selectedWeeks.filter(w => weeks.includes(w));
      if (validWeeks.length === 0) {
        setSelectedWeeks([weeks[0]]);
      } else if (validWeeks.length !== selectedWeeks.length) {
        setSelectedWeeks(validWeeks);
      }
    } else {
      setSelectedWeeks([]);
    }
  }, [weeks]);

  // Lọc tài nguyên & câu hỏi của các tuần được chọn
  const currentResources = useMemo(() => {
    if (selectedWeeks.length === 0) return [];
    return activeResources.filter(r => selectedWeeks.includes(r.week_name));
  }, [activeResources, selectedWeeks]);

  const currentQuestions = useMemo(() => {
    if (selectedWeeks.length === 0) return [];
    return activeQuestions.filter(q => selectedWeeks.includes(q.week_name));
  }, [activeQuestions, selectedWeeks]);

  // Bộ lọc câu hỏi theo thanh tìm kiếm
  const filteredQuestions = useMemo(() => {
    if (!searchQuery) return currentQuestions;
    const query = searchQuery.toLowerCase().trim();
    return currentQuestions.filter(q => 
      q.question.toLowerCase().includes(query) || 
      q.answer.toLowerCase().includes(query) ||
      q.choices?.some(c => c.toLowerCase().includes(query))
    );
  }, [currentQuestions, searchQuery]);

  // Tiêu đề hiển thị cho các tuần được chọn
  const weekTitle = useMemo(() => {
    if (selectedWeeks.length === 0) return "Chưa chọn tuần học";
    if (selectedWeeks.length === 1) return selectedWeeks[0];
    const sorted = [...selectedWeeks].sort((a, b) => 
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
    return `Các tuần: ${sorted.map(w => w.split(" - ")[0]).join(", ")}`;
  }, [selectedWeeks]);

  // Nhãn hiển thị tuần lọc ở nút bấm
  const filterLabelWeeks = useMemo(() => {
    if (selectedWeeks.length === 0) return "Chưa chọn tuần";
    if (selectedWeeks.length === weeks.length) return "Tất cả tuần";
    if (selectedWeeks.length === 1) return selectedWeeks[0].split(" - ")[0];
    const sorted = [...selectedWeeks].sort((a, b) => 
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
    return `Tuần: ${sorted.map(w => w.split(" - ")[0].replace("Tuần ", "")).join(",")}`;
  }, [selectedWeeks, weeks]);

  // Nhãn hiển thị lớp lọc ở nút bấm
  const filterLabelCourses = useMemo(() => {
    if (selectedCourseIds.length === 0) return "Chưa chọn lớp";
    if (selectedCourseIds.length === courses.length) return "Tất cả lớp";
    if (selectedCourseIds.length === 1) {
      const title = courses.find(c => c.id === selectedCourseIds[0])?.title || "";
      const parts = title.split(" - ");
      return parts.length > 1 ? parts[1] : title;
    }
    return `Lớp (${selectedCourseIds.length})`;
  }, [selectedCourseIds, courses]);

  // Gom nhóm tài nguyên theo tuần
  const groupedResources = useMemo(() => {
    const groups: { [weekName: string]: { files: CrawlerResource[], videos: CrawlerResource[] } } = {};
    
    const sortedWeeks = [...selectedWeeks].sort((a, b) => 
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );

    sortedWeeks.forEach(w => {
      groups[w] = { files: [], videos: [] };
    });

    currentResources.forEach(r => {
      if (groups[r.week_name]) {
        if (r.type === "file") {
          groups[r.week_name].files.push(r);
        } else if (r.type === "youtube") {
          groups[r.week_name].videos.push(r);
        }
      }
    });

    return sortedWeeks
      .map(w => ({
        weekName: w,
        files: groups[w].files,
        videos: groups[w].videos
      }))
      .filter(g => g.files.length > 0 || g.videos.length > 0);
  }, [currentResources, selectedWeeks]);

  // Trích xuất ID youtube để nhúng iframe
  const getEmbedUrl = (url: string) => {
    try {
      let videoId = "";
      if (url.includes("youtu.be/")) {
        videoId = url.split("youtu.be/")[1]?.split(/[?#]/)[0];
      } else if (url.includes("youtube.com/watch")) {
        const urlParams = new URLSearchParams(new URL(url).search);
        videoId = urlParams.get("v") || "";
      } else if (url.includes("youtube.com/embed/")) {
        videoId = url.split("youtube.com/embed/")[1]?.split(/[?#]/)[0];
      }
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    } catch {
      return null;
    }
  };

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

      const weekLabel = selectedWeeks.length === weeks.length ? "Tat_ca_tuan" : selectedWeeks.map(w => w.split(" - ")[0].replace(" ", "")).join("_");
      XLSX.utils.book_append_sheet(workbook, worksheet, weekLabel.substring(0, 30));
      
      let safeTitle = (doc?.title || "Mon_hoc").replace(/[\\\/\?\*\[\]:<>|"]/g, "_");
      const percentageSuffix = excelPercentage < 100 ? `_${excelPercentage}percent` : "";
      let fileName = `${safeTitle} - ${weekLabel}${percentageSuffix}.xlsx`;
      fileName = fileName.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");

      XLSX.writeFile(workbook, fileName);
      toast.success(`Xuất file Excel câu hỏi LMS thành công!`);
    } catch (err) {
      console.error("Lỗi xuất excel (Bộ lọc):", err);
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

  return (
    <div className="flex-1 min-w-0 w-full flex flex-col doc-main-bg">
      <Header 
        title={doc.title}
        subtitle={weekTitle || doc.category?.title || "Bài học  "}
        hideLogo={true}
        onMobileMenuClick={() => window.dispatchEvent(new Event("open-doc-sidebar"))}
        onOpenSettings={() => window.dispatchEvent(new Event("open-settings"))}
        onOpenProfile={() => window.dispatchEvent(new Event("open-profile"))}
      />

      <div className="lesson-detail-container flex justify-center">
        {weeks.length === 0 ? (
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
            {/* Tab switcher + Bộ lọc */}
            <div className="lesson-page-header-actions lesson-page-header-actions--top">
              <div className="lesson-tab-switcher">
                <button
                  onClick={() => setActiveTab("materials")}
                  className={`lesson-tab-btn ${activeTab === "materials" ? "lesson-tab-btn-active" : ""}`}
                >
                  <FileText className="w-3.5 h-3.5 shrink-0" /> Bài học &amp; Tài liệu
                </button>
                <button
                  onClick={() => setActiveTab("quiz")}
                  className={`lesson-tab-btn ${activeTab === "quiz" ? "lesson-tab-btn-active" : ""}`}
                >
                  <HelpCircle className="w-3.5 h-3.5 shrink-0" /> Câu hỏi {questionsLoading ? "..." : `(${questionCount})`}
                </button>
              </div>

              <button
                onClick={() => setIsFilterOpen(true)}
                className="lesson-filter-trigger-btn"
              >
                <Filter className="w-4 h-4 text-[var(--brand-600)]" />
                <span>Bộ lọc học tập</span>
                <span className="lesson-filter-trigger-sep" />
                <span className="lesson-filter-trigger-val">{filterLabelWeeks}</span>
                {courses.length > 1 && (
                  <>
                    <span className="lesson-filter-trigger-pipe">|</span>
                    <span className="lesson-filter-trigger-courses">{filterLabelCourses}</span>
                  </>
                )}
              </button>
            </div>


            {/* Tab 1: Bài học & Tài liệu */}
            {activeTab === "materials" && (
              <div className="lesson-tab-content">
                <LessonMaterials
                  groupedResources={groupedResources}
                  getEmbedUrl={getEmbedUrl}
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

      <LessonFilterModal
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        courses={courses}
        selectedCourseIds={selectedCourseIds}
        weeks={weeks}
        selectedWeeks={selectedWeeks}
        onApply={(courseIds, weeks) => {
          setSelectedCourseIds(courseIds);
          setSelectedWeeks(weeks);
        }}
      />
    </div>
  );
};

export default LessonDocumentPage;
