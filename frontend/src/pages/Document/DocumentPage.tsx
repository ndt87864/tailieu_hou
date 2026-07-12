import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { cachedGet } from "../../utils/apiCache.js";
import LoadingSpinner from "../../components/common/LoadingSpinner.js";
import { useAuth } from "../../context/AuthContext.js";
import { useUI } from "../../context/UIContext.js";
import LessonDocumentPage from "./LessonDocumentPage.js";
import * as Icons from "lucide-react";
import { Header } from "../../components/layout/Layout.js";
import * as XLSX from "xlsx";
import { toast } from "react-toastify";
import { cleanForExport } from "../../utils/questionHelper.js";
import { DocumentQuizList } from "../../components/document/DocumentQuizList.js";
import "../../css/document.css";
import "../../css/lesson.css";

const { Lock, Search, Crown } = Icons;

interface Question {
  id: string;
  question: string;
  choices: string[];
  answer: string;
  url_question: string | null;
  url_answer: string | null;
  url_choices: string | null;
  order_index: number;
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
    logo?: string | null;
    stt?: number | null;
  } | null;
}

const DocumentPage: React.FC = () => {
  const { lessonMode, setPageLoading } = useUI();
  const { id } = useParams<{ id: string }>();
  const { role, profile, user, loading: authLoading } = useAuth();

  if (lessonMode) {
    return <LessonDocumentPage />;
  }
  const [doc, setDoc] = useState<Document | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [limitApplied, setLimitApplied] = useState<boolean>(false);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [lockedCount, setLockedCount] = useState<number>(0);
  const [ratioPercent, setRatioPercent] = useState<number>(100);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!id || authLoading) return;
    setLoading(true);
    setPageLoading(true);
    Promise.all([
      cachedGet(`/api/v1/documents/${id}`),
      cachedGet(`/api/v1/questions/document/${id}/limited`),
    ])
      .then(([docRes, questRes]: [any, any]) => {
        setDoc(docRes.data.document);
        setQuestions(questRes.data.questions || []);
        setLimitApplied(!!questRes.data.limitApplied);
        setTotalCount(questRes.data.totalCount || 0);
        setLockedCount(questRes.data.lockedCount || 0);
        setRatioPercent(questRes.data.ratioPercent || 100);
        setLoading(false);
        setPageLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Lỗi tải thông tin tài liệu. Vui lòng thử lại.");
        setLoading(false);
        setPageLoading(false);
      });
  }, [id, authLoading, setPageLoading]);

  // Filter questions based on search query
  const filteredQuestions = questions.filter(
    (q) =>
      q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCount = filteredQuestions.length;

  // Determine if user has premium/unlimited access
  const isPremiumUser = ["admin", "management", "ultra", "pro", "plus"].includes(role);
  const hasFullAccess = ["admin", "ultra"].includes(role) || (["pro", "plus", "management"].includes(role) && !limitApplied);

  const visibleQuestions = filteredQuestions;

  // Excel download logic
  const isExcelEnabled = profile?.is_excel_enabled !== false;
  
  // Lấy tỷ lệ mặc định dựa trên việc tài liệu đã được mua (limitApplied === false) hay chưa
  const defaultExcelPct = !limitApplied
    ? (profile?.default_excel_paid !== undefined ? profile.default_excel_paid : (role === "free" ? 0 : 100))
    : (profile?.default_excel_unpaid !== undefined ? profile.default_excel_unpaid : (role === "plus" ? 50 : (role === "free" ? 0 : 100)));
    
  const excelPercentage = profile?.excel_percentage !== undefined && profile.excel_percentage !== null 
    ? profile.excel_percentage 
    : defaultExcelPct;

  const canDownloadExcel = isExcelEnabled && excelPercentage > 0;

  const exportToExcel = () => {
    try {
      if (!user) {
        toast.error("Vui lòng đăng nhập để thực hiện tải xuống.");
        return;
      }
      if (!canDownloadExcel) {
        toast.error(profile?.is_excel_enabled === false ? "Quyền tải Excel của bạn đã bị tắt." : "Tài khoản của bạn không có quyền tải bộ câu hỏi này.");
        return;
      }

      let dataToExport = visibleQuestions;
      
      if (excelPercentage < 100) {
        const limitedCount = Math.floor(visibleQuestions.length * (excelPercentage / 100));
        dataToExport = visibleQuestions.slice(0, limitedCount);
      }

      const excelData = dataToExport.map((q, index) => ({
        "STT": index + 1,
        "Câu hỏi": cleanForExport(q.question),
        "Lựa chọn A": cleanForExport(q.choices?.[0] || ""),
        "Lựa chọn B": cleanForExport(q.choices?.[1] || ""),
        "Lựa chọn C": cleanForExport(q.choices?.[2] || ""),
        "Lựa chọn D": cleanForExport(q.choices?.[3] || ""),
        "Đáp án": cleanForExport(q.answer),
      }));

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      
      // Auto-fit column widths
      const maxLenQuestion = Math.max(...excelData.map(d => d["Câu hỏi"].length), 10);
      worksheet["!cols"] = [
        { wch: 6 },
        { wch: Math.min(maxLenQuestion, 50) },
        { wch: 25 },
        { wch: 25 },
        { wch: 25 },
        { wch: 25 },
        { wch: 15 },
      ];

      const documentTitle = doc?.title || "Document";
      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        documentTitle.substring(0, 30)
      );

      const percentageSuffix = excelPercentage < 100 ? `_${excelPercentage}percent` : "";
      let fileName = `${doc?.category?.title || "Category"} - ${documentTitle}${percentageSuffix}.xlsx`;
      
      // Sanitize file name to avoid invalid characters
      fileName = fileName.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");

      XLSX.writeFile(workbook, fileName);
      toast.success("Tải xuống file Excel thành công!");
    } catch (error) {
      console.error("Excel export error:", error);
      toast.error("Có lỗi xảy ra khi tạo file Excel.");
    }
  };

  if (loading && !doc) return <LoadingSpinner />;
  if (error || !doc)
    return (
      <div className="doc-error-message">
        {error || "Tài liệu không tồn tại."}
      </div>
    );

  // Gate: Document là premium nhưng user chưa có quyền premium
  if (doc.premium && !isPremiumUser) {
    return (
      <div className="flex-1 min-w-0 w-full flex flex-col doc-main-bg">
        <Header
          title={doc.title}
          subtitle={doc.category?.title || ""}
          hideLogo={true}
          leftElement={
            <Link
              to="/"
              className="md:hidden p-2 -ml-2 rounded-lg hover:bg-[var(--bg-2)] transition-colors text-[var(--muted)] flex items-center justify-center"
              aria-label="Về trang chủ"
            >
              <Icons.BookOpen className="w-5 h-5 text-[var(--accent)]" />
            </Link>
          }
          onMobileMenuClick={() => window.dispatchEvent(new Event("open-doc-sidebar"))}
          onOpenSettings={() => window.dispatchEvent(new Event("open-settings"))}
          onOpenProfile={() => window.dispatchEvent(new Event("open-profile"))}
        />
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="max-w-sm w-full text-center space-y-5">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 flex items-center justify-center">
              <Crown className="w-8 h-8 text-amber-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold doc-text-fg mb-1">Tài liệu Premium</h2>
              <p className="text-sm doc-text-muted">
                Bộ tài liệu này chỉ dành cho tài khoản đã nâng cấp Premium. Nâng cấp để truy cập toàn bộ bộ câu hỏi học tập chất lượng cao.
              </p>
            </div>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm transition-colors"
            >
              <Crown className="w-4 h-4" />
              Nâng cấp Premium
            </Link>
            <div>
              <Link to="/" className="text-xs doc-text-muted hover:underline">
                ← Quay lại trang chủ
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Gate: Tài liệu đã bị ẩn (inactive)
  if (doc.active === false) {
    return (
      <div className="flex-1 min-w-0 w-full flex flex-col doc-main-bg">
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="text-center space-y-3">
            <p className="text-sm doc-text-muted">Tài liệu này hiện không có sẵn.</p>
            <Link to="/" className="text-xs text-[var(--accent)] hover:underline">← Quay lại</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 w-full flex flex-col doc-main-bg">
        <Header 
          title={doc.title}
          subtitle={doc.category?.title || ""}
          hideLogo={true}
          leftElement={
            <Link
              to="/"
              className="md:hidden p-2 -ml-2 rounded-lg hover:bg-[var(--bg-2)] transition-colors text-[var(--muted)] flex items-center justify-center"
              aria-label="Về trang chủ"
            >
              <Icons.BookOpen className="w-5 h-5 text-[var(--accent)]" />
            </Link>
          }
          onMobileMenuClick={() => window.dispatchEvent(new Event("open-doc-sidebar"))}
          onOpenSettings={() => window.dispatchEvent(new Event("open-settings"))}
          onOpenProfile={() => window.dispatchEvent(new Event("open-profile"))}
        />
        
        <div className="p-6 flex flex-col gap-6">

        {/* Info & Search Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-xs doc-text-muted">
              Hiển thị từ <span className="font-semibold doc-text-fg2">{filteredCount > 0 ? 1 : 0}</span> đến{" "}
              <span className="font-semibold doc-text-fg2">{filteredCount}</span> trong tổng số{" "}
              <span className="font-semibold doc-text-fg2">{totalCount}</span> câu hỏi
            </div>
            {canDownloadExcel && (
              <button
                onClick={exportToExcel}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold text-[11px] transition-colors shadow-sm cursor-pointer"
                title={`Tải xuống Excel (${excelPercentage}%)`}
              >
                <Icons.Download className="w-3.5 h-3.5" />
                Tải Excel {excelPercentage < 100 && `(${excelPercentage}%)`}
              </button>
            )}
          </div>

          {/* Search box */}
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 doc-text-meta" />
            <input
              type="text"
              placeholder="Tìm kiếm câu hỏi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border text-xs focus:outline-none focus:ring-1 focus:ring-[var(--accent)] doc-card-themed"
            />
          </div>
        </div>

        {/* Warning Alert Banner (If not premium/logged in) */}
        {!hasFullAccess && (
          <div 
            className="border rounded-xl p-4 flex items-center gap-3 text-xs doc-warn-banner"
          >
            <span className="w-5 h-5 bg-amber-500 text-white rounded-full flex items-center justify-center shrink-0 font-bold">!</span>
            <p>
              {["pro", "plus"].includes(role) ? (
                <span className="font-bold text-amber-800 dark:text-amber-200">
                  Vui lòng đăng ký bộ câu hỏi này để mở khóa toàn bộ câu hỏi.
                </span>
              ) : (
                <>
                  Bạn đang xem bản giới hạn ({ratioPercent}% câu hỏi). Vui lòng{" "}
                  <Link to="/pricing" className="font-bold underline text-amber-600 hover:text-amber-700">
                    nâng cấp Premium
                  </Link>{" "}
                  để truy cập đầy đủ tất cả câu hỏi học tập.
                </>
              )}
            </p>
          </div>
        )}

        <DocumentQuizList
          visibleQuestions={visibleQuestions}
          hasFullAccess={hasFullAccess}
          role={role}
        />

        {/* Bottom Lock Notice if not premium */}
        {!hasFullAccess && lockedCount > 0 && (
          <div className="mt-6 border border-dashed border-amber-300 dark:border-amber-700 bg-amber-500/5 rounded-xl p-6 text-center space-y-3">
            <div className="text-sm font-semibold text-amber-700 dark:text-amber-300 flex items-center justify-center gap-1.5">
              <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Có {lockedCount} câu hỏi khác đang bị ẩn trong bộ tài liệu này</span>
            </div>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              {["pro", "plus"].includes(role) ? (
                "Vui lòng đăng ký bộ câu hỏi này để mở khóa toàn bộ câu hỏi học tập."
              ) : (
                <>
                  Vui lòng{" "}
                  <Link to="/pricing" className="font-bold underline text-amber-600 hover:text-amber-700">
                    nâng cấp Premium
                  </Link>{" "}
                  để xem và luyện tập đầy đủ tất cả câu hỏi.
                </>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentPage;
