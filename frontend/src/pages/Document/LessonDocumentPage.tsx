import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import apiClient from "../../services/client.js";
import LoadingSpinner from "../../components/common/LoadingSpinner.js";
import { useAuth } from "../../context/AuthContext.js";
import { Header } from "../../components/layout/Layout.js";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import { 
  BookOpen, FileText, Play, Download, HelpCircle,
  CheckCircle2, Crown, Youtube, Search, X
} from "lucide-react";
import { renderTextWithImages } from "../../utils/questionHelper.js";

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
  
  // Trạng thái điều hướng tuần
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"materials" | "quiz">("materials");
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  // Trạng thái làm bài trắc nghiệm LMS trực tuyến - đã chuyển sang chế độ hiển thị đáp án trực tiếp

  useEffect(() => {
    if (!id || authLoading) return;
    setLoading(true);
    
    // Reset states when changing document/subject
    setSelectedWeek(null);
    setResources([]);
    setQuestions([]);
    setActiveTab("materials");
    setSearchQuery("");

    apiClient.get(`/api/v1/documents/${id}/lessons`)
      .then((res) => {
        setDoc(res.data.document);
        setResources(res.data.resources || []);
        setQuestions(res.data.questions || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        if (err.response?.status === 403) {
          setError("Tài liệu Premium. Vui lòng nâng cấp tài khoản để truy cập.");
        } else {
          setError("Lỗi tải thông tin bài học. Vui lòng thử lại.");
        }
        setLoading(false);
      });
  }, [id, authLoading]);

  // Trích xuất danh sách các tuần học duy nhất
  const weeks = useMemo(() => {
    const wSet = new Set<string>();
    resources.forEach(r => { if (r.week_name) wSet.add(r.week_name); });
    questions.forEach(q => { if (q.week_name) wSet.add(q.week_name); });
    
    return Array.from(wSet).sort((a, b) => 
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [resources, questions]);

  // Tự động chọn tuần đầu tiên khi chuyển môn học hoặc khi tuần hiện tại không hợp lệ
  useEffect(() => {
    if (weeks.length > 0) {
      if (!selectedWeek || !weeks.includes(selectedWeek)) {
        setSelectedWeek(weeks[0]);
      }
    } else {
      setSelectedWeek(null);
    }
  }, [weeks, selectedWeek]);

  // Lọc tài nguyên & câu hỏi của tuần hiện tại
  const currentResources = useMemo(() => {
    if (!selectedWeek) return [];
    return resources.filter(r => r.week_name === selectedWeek);
  }, [resources, selectedWeek]);

  const currentQuestions = useMemo(() => {
    if (!selectedWeek) return [];
    return questions.filter(q => q.week_name === selectedWeek);
  }, [questions, selectedWeek]);

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

  // Files bài giảng
  const fileResources = useMemo(() => {
    return currentResources.filter(r => r.type === "file");
  }, [currentResources]);

  // Videos bài giảng
  const videoResources = useMemo(() => {
    return currentResources.filter(r => r.type === "youtube");
  }, [currentResources]);

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

  // So sánh câu trả lời của người dùng với đáp án đúng
  const checkAnswer = (q: CrawlerQuestion, choice: string) => {
    const cleanChoice = choice.trim().toLowerCase();
    const cleanAnswer = q.answer.trim().toLowerCase();
    
    // Khớp tuyệt đối hoặc chứa đáp án
    if (cleanChoice === cleanAnswer) return true;
    if (cleanAnswer.startsWith(cleanChoice)) return true;
    if (cleanChoice.startsWith(cleanAnswer)) return true;

    // Trường hợp đáp án lưu dạng "Đáp án đúng là: [Nội dung]"
    const cleanAnswerWithoutPrefix = cleanAnswer.replace(/^(đáp án đúng là:|the correct answer is:)\s*/i, "").trim();
    if (cleanChoice === cleanAnswerWithoutPrefix) return true;

    return false;
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

      if (questions.length === 0) {
        toast.info("Không có câu hỏi nào để xuất.");
        return;
      }

      let dataToExport = questions;
      if (excelPercentage < 100) {
        const limitedCount = Math.floor(questions.length * (excelPercentage / 100));
        dataToExport = questions.slice(0, limitedCount);
        toast.info(`Tài khoản được tải ${excelPercentage}% câu hỏi (${limitedCount}/${questions.length} câu).`);
      }

      const excelData = dataToExport.map((q, idx) => ({
        "STT": idx + 1,
        "Tuần": q.week_name || "",
        "Câu hỏi": (q.question || "").replace(/<[^>]*>/g, ""), // Strip HTML
        "Lựa chọn A": q.choices?.[0] || "",
        "Lựa chọn B": q.choices?.[1] || "",
        "Lựa chọn C": q.choices?.[2] || "",
        "Lựa chọn D": q.choices?.[3] || "",
        "Đáp án": q.answer || "",
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

      XLSX.utils.book_append_sheet(workbook, worksheet, "Tat_ca_cau_hoi");
      
      const safeTitle = (doc?.title || "Mon_hoc").replace(/[\\\/\?\*\[\]:<>|"]/g, "_");
      const percentageSuffix = excelPercentage < 100 ? `_${excelPercentage}percent` : "";
      XLSX.writeFile(workbook, `${safeTitle} - Tat_ca_LMS${percentageSuffix}.xlsx`);
      toast.success(`Xuất file Excel toàn bộ câu hỏi LMS thành công!`);
    } catch (err) {
      console.error("Lỗi xuất excel (Toàn bộ):", err);
      toast.error("Có lỗi xảy ra khi xuất file Excel.");
    }
  };

  // Export excel bộ câu hỏi LMS của tuần đó
  const exportWeekToExcel = () => {
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
        toast.info(`Tài khoản được tải ${excelPercentage}% câu hỏi (${limitedCount}/${currentQuestions.length} câu).`);
      }

      const excelData = dataToExport.map((q, idx) => ({
        "STT": idx + 1,
        "Câu hỏi": (q.question || "").replace(/<[^>]*>/g, ""), // Strip HTML
        "Lựa chọn A": q.choices?.[0] || "",
        "Lựa chọn B": q.choices?.[1] || "",
        "Lựa chọn C": q.choices?.[2] || "",
        "Lựa chọn D": q.choices?.[3] || "",
        "Đáp án": q.answer || "",
      }));

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      
      const maxLenQuestion = Math.max(...excelData.map(d => d["Câu hỏi"].length), 10);
      worksheet["!cols"] = [
        { wch: 6 },
        { wch: Math.min(maxLenQuestion, 50) },
        { wch: 25 },
        { wch: 25 },
        { wch: 25 },
        { wch: 25 },
        { wch: 20 },
      ];

      let safeSheetName = (selectedWeek || "Quiz").replace(/[\\\/\?\*\[\]:]/g, "_").substring(0, 30);
      XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);
      
      const safeTitle = (doc?.title || "Mon_hoc").replace(/[\\\/\?\*\[\]:<>|"]/g, "_");
      const percentageSuffix = excelPercentage < 100 ? `_${excelPercentage}percent` : "";
      XLSX.writeFile(workbook, `${safeTitle} - ${safeSheetName}${percentageSuffix}.xlsx`);
      toast.success(`Xuất file Excel câu hỏi ${selectedWeek} thành công!`);
    } catch (err) {
      console.error("Lỗi xuất excel (Tuần này):", err);
      toast.error("Có lỗi xảy ra khi xuất file Excel.");
    }
  };

  if (loading) return <LoadingSpinner />;
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
              Môn học này có thể là tài liệu Premium hoặc dữ liệu LMS chưa được crawl về hệ thống.
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
        subtitle={doc.category?.title || "Bài học LMS"}
        hideLogo={true}
        onMobileMenuClick={() => window.dispatchEvent(new Event("open-doc-sidebar"))}
        onOpenSettings={() => window.dispatchEvent(new Event("open-settings"))}
        onOpenProfile={() => window.dispatchEvent(new Event("open-profile"))}
      />

      <div className="lesson-detail-container">
        {weeks.length === 0 ? (
          <div className="lesson-empty-state">
            <BookOpen className="lesson-empty-icon" />
            <h3 className="lesson-empty-title">Chưa có bài học LMS</h3>
            <p className="lesson-empty-desc">Hệ thống chưa crawl dữ liệu bài học hoặc bài giảng của môn học này.</p>
            <Link to={`/documents/${doc.id}`} className="lesson-btn-primary">
              <HelpCircle className="w-4 h-4" /> Làm câu hỏi ôn tập
            </Link>
          </div>
        ) : (
          <div className="lesson-layout-wrapper">
            {/* Thanh trên cùng: Chips + Nút tải Excel */}
            <div className="flex flex-col md:flex-row md:items-stretch gap-3 w-full">
              {/* Chips điều hướng tuần — cuộn ngang */}
              <div className="lesson-week-chips-bar flex-1 min-w-0">
                {weeks.map((w) => (
                  <button
                    key={w}
                    onClick={() => {
                      setSelectedWeek(w);
                      setSearchQuery("");
                    }}
                    className={`lesson-week-chip${selectedWeek === w ? " lesson-week-chip-active" : ""}`}
                  >
                    {w.split(" - ")[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* Nội dung tuần đang chọn */}
            <div>
              <div className="lesson-week-card">
                <div className="lesson-week-header">
                  <h3 className="lesson-week-title">{selectedWeek}</h3>
                  <div className="lesson-tab-switcher">
                    <button
                      onClick={() => setActiveTab("materials")}
                      className={`lesson-tab-btn ${activeTab === "materials" ? "lesson-tab-btn-active" : ""}`}
                    >
                      <FileText className="w-3.5 h-3.5 shrink-0" /> Bài học & Tài liệu
                    </button>
                    <button
                      onClick={() => setActiveTab("quiz")}
                      className={`lesson-tab-btn ${activeTab === "quiz" ? "lesson-tab-btn-active" : ""}`}
                    >
                      <HelpCircle className="w-3.5 h-3.5 shrink-0" /> Trắc nghiệm ({currentQuestions.length})
                    </button>
                  </div>
                </div>

                {/* Tab 1: Bài học & Tài liệu */}
                {activeTab === "materials" && (
                  <div className="lesson-tab-content">
                    {/* 1. File bài giảng */}
                    <div className="lesson-material-section">
                      <h4 className="lesson-section-label">
                        <FileText className="w-3.5 h-3.5 text-[var(--brand-600)]" /> Slide & Tài liệu bài giảng
                      </h4>
                      {fileResources.length > 0 ? (
                        <div className="lesson-material-list">
                          {fileResources.map((res) => (
                            <div key={res.id} className="lesson-material-item">
                              <div className="lesson-material-left">
                                <BookOpen className="w-4 h-4 lesson-material-icon" />
                                <span className="lesson-material-name" title={res.title}>{res.title}</span>
                              </div>
                              {res.content_url && (
                                <a
                                  href={res.content_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="lesson-material-link"
                                >
                                  <Download className="w-3.5 h-3.5" /> Xem/Tải
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[var(--muted)]">Không có file slide bài giảng cho tuần này.</p>
                      )}
                    </div>

                    {/* 2. Video bài giảng */}
                    <div className="lesson-material-section">
                      <h4 className="lesson-section-label">
                        <Youtube className="w-3.5 h-3.5 text-red-500" /> Video bài học
                      </h4>
                      {videoResources.length > 0 ? (
                        <div className="lesson-video-grid">
                          {videoResources.map((res) => {
                            const embedUrl = res.content_url ? getEmbedUrl(res.content_url) : null;
                            return (
                              <div key={res.id} className="lesson-video-card">
                                {embedUrl ? (
                                  <div className="lesson-video-iframe-wrapper">
                                    <iframe
                                      src={embedUrl}
                                      title={res.title}
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                      allowFullScreen
                                    ></iframe>
                                  </div>
                                ) : (
                                  <div className="h-28 bg-[var(--bg-3)] flex items-center justify-center">
                                    <Play className="w-8 h-8 text-[var(--muted)]" />
                                  </div>
                                )}
                                <a 
                                  href={res.content_url || "#"} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="lesson-video-title"
                                >
                                  {res.title}
                                </a>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-[var(--muted)]">Không có video bài học cho tuần này.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Tab 2: Trắc nghiệm LMS */}
                {activeTab === "quiz" && (
                  <div className="lesson-tab-content">
                    {/* Toolbar: search + export */}
                    <div className="lesson-quiz-toolbar">
                      <div className="lesson-quiz-search-wrap">
                        <Search className="lesson-quiz-search-icon w-3.5 h-3.5" />
                        <input
                          type="text"
                          placeholder="Tìm kiếm câu hỏi, lựa chọn, đáp án..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="lesson-quiz-search"
                        />
                        {searchQuery && (
                          <button onClick={() => setSearchQuery("")} className="lesson-quiz-clear-btn">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      {currentQuestions.length > 0 && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={exportWeekToExcel}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-[var(--bg-2)] hover:bg-[var(--bg-3)] border border-[var(--border)] text-[var(--fg)] transition-all"
                            title="Tải Excel câu hỏi tuần này"
                          >
                            <Download className="w-3.5 h-3.5" /> Tuần Này
                          </button>
                          <button
                            onClick={exportAllToExcel}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-all"
                            title="Tải Excel toàn bộ câu hỏi của môn học"
                          >
                            <Download className="w-3.5 h-3.5" /> Toàn Bộ LMS
                          </button>
                        </div>
                      )}
                    </div>

                    {searchQuery && (
                      <p className="text-xs text-[var(--muted)] mb-2">
                        Tìm thấy <strong className="text-[var(--fg)]">{filteredQuestions.length}</strong> câu khớp với "{searchQuery}"
                      </p>
                    )}

                    {filteredQuestions.length > 0 ? (
                      <div className="lesson-quiz-scroll">
                        {filteredQuestions.map((q, qIndex) => (
                          <div key={q.id} className="lesson-quiz-question-box">
                            <div className="lesson-quiz-q-number">Câu {qIndex + 1}</div>
                            <h5 className="lesson-quiz-question-title">
                              {renderTextWithImages(q.question, q.url_question)}
                            </h5>

                            <div className="lesson-quiz-choices">
                              {q.choices?.map((choice, cIndex) => {
                                const isCorrect = checkAnswer(q, choice);
                                return (
                                  <div
                                    key={cIndex}
                                    className={`lesson-quiz-choice-item${isCorrect ? " lesson-quiz-choice-correct" : ""}`}
                                  >
                                    <span className="font-bold shrink-0 w-5 text-[var(--muted)]">
                                      {String.fromCharCode(65 + cIndex)}.
                                    </span>
                                    <span>{renderTextWithImages(choice, q.url_choices)}</span>
                                  </div>
                                );
                              })}
                            </div>

                            <div className="lesson-quiz-answer-badge">
                              <CheckCircle2 className="w-3 h-3 shrink-0" />
                              <span>Đáp án: {renderTextWithImages(q.answer, q.url_answer)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--muted)] py-6 text-center">
                        {searchQuery ? "Không tìm thấy câu hỏi nào phù hợp." : "Không có câu hỏi LMS nào cho tuần này."}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LessonDocumentPage;
