import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import apiClient from "../../services/client.js";
import LoadingSpinner from "../../components/common/LoadingSpinner.js";
import { useAuth } from "../../context/AuthContext.js";
import * as Icons from "lucide-react";
import { Header } from "../../components/layout/Layout.js";
import * as XLSX from "xlsx";
import { toast } from "react-toastify";
import "../../css/document.css";

const { Lock, Search, Crown } = Icons;

interface Question {
  id: string;
  question: string;
  choices: string[];
  answer: string;
  url_question: string | null;
  url_answer: string | null;
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
  const { id } = useParams<{ id: string }>();
  const { role, profile, user, loading: authLoading } = useAuth();
  const [doc, setDoc] = useState<Document | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [limitApplied, setLimitApplied] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!id || authLoading) return;
    setLoading(true);
    Promise.all([
      apiClient.get(`/api/v1/documents/${id}`),
      apiClient.get(`/api/v1/questions/document/${id}`),
    ])
      .then(([docRes, questRes]) => {
        setDoc(docRes.data.document);
        setQuestions(questRes.data.questions || []);
        setLimitApplied(!!questRes.data.limitApplied);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Lỗi tải thông tin tài liệu. Vui lòng thử lại.");
        setLoading(false);
      });
  }, [id, authLoading]);

  // Filter questions based on search query
  const filteredQuestions = questions.filter(
    (q) =>
      q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalCount = questions.length;
  const filteredCount = filteredQuestions.length;

  // Determine if user has premium/unlimited access
  const isPremiumUser = ["admin", "management", "ultra", "pro", "plus"].includes(role);
  const hasFullAccess = ["admin", "ultra"].includes(role) || (["pro", "plus", "management"].includes(role) && !limitApplied);

  const visibleQuestions = filteredQuestions.filter(
    (q) => !(q.isPremiumLocked && !hasFullAccess)
  );

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
        toast.info(`Tài khoản được tải ${excelPercentage}% câu hỏi (${limitedCount}/${visibleQuestions.length} câu).`);
      }

      const excelData = dataToExport.map((q, index) => ({
        "STT": index + 1,
        "Câu hỏi": q.question,
        "Lựa chọn A": q.choices?.[0] || "",
        "Lựa chọn B": q.choices?.[1] || "",
        "Lựa chọn C": q.choices?.[2] || "",
        "Lựa chọn D": q.choices?.[3] || "",
        "Đáp án": q.answer,
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
      const fileName = `${doc?.category?.title || "Category"} - ${documentTitle}${percentageSuffix}.xlsx`;

      XLSX.writeFile(workbook, fileName);
      toast.success("Tải xuống file Excel thành công!");
    } catch (error) {
      console.error("Excel export error:", error);
      toast.error("Có lỗi xảy ra khi tạo file Excel.");
    }
  };

  if (loading) return <LoadingSpinner />;
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
              <Icons.BookOpen className="w-5 h-5 text-[var(--brand-600)]" />
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
            <Link to="/" className="text-xs text-[var(--brand-600)] hover:underline">← Quay lại</Link>
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
              <Icons.BookOpen className="w-5 h-5 text-[var(--brand-600)]" />
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--brand-600)] hover:bg-[var(--brand-700)] text-white font-semibold text-[11px] transition-colors shadow-sm cursor-pointer"
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
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border text-xs focus:outline-none focus:ring-1 focus:ring-[var(--brand-500)] doc-card-themed"
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
                  Bạn đang xem bản giới hạn (20% câu hỏi). Vui lòng{" "}
                  <Link to="/pricing" className="font-bold underline text-amber-600 hover:text-amber-700">
                    nâng cấp Premium
                  </Link>{" "}
                  để truy cập đầy đủ tất cả câu hỏi học tập.
                </>
              )}
            </p>
          </div>
        )}

        {/* Questions Table (Desktop & Tablet) */}
        <div 
          className="hidden md:block rounded-xl shadow-sm border overflow-x-auto doc-card-themed"
        >
          <div className="min-w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr 
                  className="border-b text-xs font-semibold uppercase doc-surface-muted"
                >
                  <th className="py-3 px-4 w-16 text-center">STT</th>
                  <th className="py-3 px-4">Câu hỏi</th>
                  <th className="py-3 px-4 w-1/3">Câu trả lời</th>
                </tr>
              </thead>
              <tbody 
                className="divide-y text-sm doc-border-soft-text-fg2"
              >
                {visibleQuestions.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-xs doc-text-meta">
                      Không tìm thấy câu hỏi phù hợp.
                    </td>
                  </tr>
                ) : (
                  visibleQuestions.map((q, idx) => {
                    const isLocked = q.isPremiumLocked && !hasFullAccess;
                    return (
                      <tr 
                        key={q.id || idx} 
                        className="transition-colors hover:bg-[var(--bg-2)] doc-border-soft"
                      >
                        <td className="py-4 px-4 text-center font-medium text-xs align-top doc-text-meta">
                          {idx + 1}
                        </td>
                        <td className="py-4 px-4 align-top space-y-2">
                          <div className="font-medium doc-text-fg">{q.question}</div>
                          
                          {/* Options choices list */}
                          <div 
                            className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 pl-2 border-l doc-border-themed"
                          >
                            {(q.choices || []).map((opt, oIdx) => (
                              <div key={oIdx} className="text-xs doc-text-muted">
                                <span className="font-semibold mr-1">{String.fromCharCode(65 + oIdx)}.</span>
                                {opt}
                              </div>
                            ))}
                          </div>

                          {q.url_question && (
                            <div 
                              className="mt-2 border rounded-lg p-1 max-w-sm inline-block doc-option-card"
                            >
                              <img src={q.url_question} alt={`Ảnh câu hỏi ${idx + 1}`} className="max-h-40 object-contain" />
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4 align-top">
                          {isLocked ? (
                            <div 
                              className="flex flex-col gap-1.5 border rounded-lg p-2.5 max-w-xs doc-locked-card"
                            >
                              <span className="text-amber-600 font-bold text-xs flex items-center gap-1">
                                <Lock className="w-3.5 h-3.5" /> Bị khóa
                              </span>
                              {["pro", "plus"].includes(role) ? (
                                <span className="text-[10px] text-amber-600 font-semibold">
                                  Vui lòng đăng ký
                                </span>
                              ) : (
                                <Link
                                  to="/pricing"
                                  className="text-[10px] bg-amber-500 hover:bg-amber-600 text-white font-semibold px-2 py-1 rounded text-center transition"
                                >
                                  Nâng cấp Premium
                                </Link>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <div 
                                className="font-semibold rounded-lg px-2.5 py-1.5 inline-block text-xs border doc-answer-badge"
                              >
                                {q.answer}
                              </div>
                              {q.url_answer && (
                                <div 
                                  className="border rounded-lg p-1 max-w-xs mt-1.5 doc-option-card"
                                >
                                  <img src={q.url_answer} alt={`Ảnh đáp án ${idx + 1}`} className="max-h-40 object-contain" />
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Questions Cards (Mobile view < 768px) */}
        <div className="block md:hidden space-y-4">
          {visibleQuestions.length === 0 ? (
            <div className="card p-8 text-center text-xs doc-empty-card">
              Không tìm thấy câu hỏi phù hợp.
            </div>
          ) : (
            visibleQuestions.map((q, idx) => {
              const isLocked = q.isPremiumLocked && !hasFullAccess;
              return (
                <div 
                  key={q.id || idx}
                  className="p-4 rounded-2xl border shadow-sm flex flex-col gap-3.5 bg-[var(--surface)] border-[var(--border-soft)] transition-all"
                >
                  <div className="flex items-center justify-between border-b border-dashed pb-2.5 border-[var(--border-soft)]">
                    <span className="font-bold text-xs text-[var(--brand-600)] uppercase tracking-wider">Câu {idx + 1}</span>
                    {isLocked && (
                      <span className="text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full font-bold text-[10px] flex items-center gap-1 border border-amber-500/20">
                        <Lock className="w-3 h-3" /> Premium
                      </span>
                    )}
                  </div>
                  
                  <div className="text-sm font-semibold text-[var(--fg)] leading-relaxed">{q.question}</div>
                  
                  {/* Choices list */}
                  {q.choices && q.choices.length > 0 && (
                    <div className="space-y-2">
                      {q.choices.map((opt, oIdx) => (
                        <div 
                          key={oIdx} 
                          className="flex items-start gap-2.5 p-2.5 rounded-xl text-xs bg-[var(--bg-2)] border border-[var(--border-soft)] text-[var(--fg-2)] transition-colors hover:bg-[var(--bg-3)]"
                        >
                          <span className="font-bold text-[var(--brand-600)] shrink-0">{String.fromCharCode(65 + oIdx)}.</span>
                          <span className="leading-relaxed">{opt}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {q.url_question && (
                    <div 
                      className="border rounded-xl p-1 max-w-full bg-[var(--bg-2)] border-[var(--border-soft)] overflow-hidden"
                    >
                      <img src={q.url_question} alt={`Ảnh câu hỏi ${idx + 1}`} className="max-h-48 w-full object-contain" />
                    </div>
                  )}

                  <div className="pt-1.5">
                    {isLocked ? (
                      ["pro", "plus"].includes(role) ? (
                        <div className="text-center text-xs text-amber-600 bg-amber-500/10 border border-amber-500/20 font-semibold py-2.5 rounded-xl">
                          Vui lòng đăng ký bộ câu hỏi này
                        </div>
                      ) : (
                        <Link
                          to="/pricing"
                          className="block text-center text-xs bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-xl transition-all shadow-sm hover:shadow-md"
                        >
                          Nâng cấp Premium để xem đáp án
                        </Link>
                      )
                    ) : (
                      <div className="space-y-3">
                        <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                          <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">Đáp án đúng</div>
                          <div className="text-sm font-semibold leading-relaxed">{q.answer}</div>
                        </div>
                        {q.url_answer && (
                          <div 
                            className="border rounded-xl p-1 max-w-full bg-[var(--bg-2)] border-[var(--border-soft)] overflow-hidden"
                          >
                            <img src={q.url_answer} alt={`Ảnh đáp án ${idx + 1}`} className="max-h-48 w-full object-contain" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Lock Notice if not premium */}
        {!hasFullAccess && totalCount > visibleQuestions.length && (
          <div className="mt-6 border border-dashed border-amber-300 dark:border-amber-700 bg-amber-500/5 rounded-xl p-6 text-center space-y-3">
            <div className="text-sm font-semibold text-amber-700 dark:text-amber-300 flex items-center justify-center gap-1.5">
              <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Có {totalCount - visibleQuestions.length} câu hỏi khác đang bị ẩn trong bộ tài liệu này</span>
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
