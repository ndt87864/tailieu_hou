import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import apiClient from "../../services/client.js";
import { cachedGet } from "../../utils/apiCache.js";
import LoadingSpinner from "../../components/common/LoadingSpinner.js";
import { useAuth } from "../../context/AuthContext.js";
import * as Icons from "lucide-react";
import "../../css/document.css";

const { Lock, ChevronDown, ChevronRight, Menu, Search, BookOpen, X } = Icons;

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
  category?: {
    title: string;
    logo?: string | null;
    stt?: number | null;
  } | null;
}

interface SidebarCategory {
  id: string;
  title: string;
  logo?: string | null;
  stt?: number | null;
  documents: Document[];
}

const DocumentPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { role } = useAuth();
  const [doc, setDoc] = useState<Document | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [limitApplied, setLimitApplied] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Sidebar States
  const [sidebarCategories, setSidebarCategories] = useState<SidebarCategory[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeTabletPopover, setActiveTabletPopover] = useState<string | null>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!id) return;
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
  }, [id]);

  // Load and Group documents for the sidebar
  // Dùng cachedGet: navigate giữa các document không re-fetch, instant từ cache
  useEffect(() => {
    cachedGet<{ documents: Document[] }>("/api/v1/documents")
      .then((res) => {
        const docs: Document[] = res.data.documents || [];
        const groups: Record<string, SidebarCategory> = {};

        docs.forEach((d) => {
          const catId = d.category_id || "other";
          const catTitle = d.category?.title || "Khác";
          const catLogo = d.category?.logo || null;
          const catStt = d.category?.stt ?? 9999;
          if (!groups[catId]) {
            groups[catId] = {
              id: catId,
              title: catTitle,
              logo: catLogo,
              stt: catStt,
              documents: []
            };
          }
          groups[catId].documents.push(d);
        });

        const groupedArray = Object.values(groups).sort((a, b) => {
          if (a.id === "other") return 1;
          if (b.id === "other") return -1;
          return (a.stt ?? 0) - (b.stt ?? 0);
        });
        setSidebarCategories(groupedArray);

        // Auto-expand category of current active document
        if (id) {
          const currentDoc = docs.find((d) => d.id === id);
          if (currentDoc) {
            const activeCatId = currentDoc.category_id || "other";
            setExpandedCategories((prev) => ({ ...prev, [activeCatId]: true }));
          }
        }
      })
      .catch((err) => {
        console.error("Lỗi khi tải danh mục sidebar:", err);
      });
  }, [id]);

  // Click outside to close tablet popover
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveTabletPopover(null);
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error || !doc)
    return (
      <div className="doc-error-message">
        {error || "Tài liệu không tồn tại."}
      </div>
    );

  // Filter questions based on search query
  const filteredQuestions = questions.filter(
    (q) =>
      q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalCount = questions.length;
  const filteredCount = filteredQuestions.length;

  // Determine if user has premium/unlimited access
  const isPremiumUser = ["admin", "ultra"].includes(role) || (["pro", "plus"].includes(role) && !limitApplied);

  const visibleQuestions = filteredQuestions.filter(
    (q) => !(q.isPremiumLocked && !isPremiumUser)
  );

  const getCategoryInfo = (catId: string, customTitle?: string | null, logoName?: string | null) => {
    const title = customTitle || (catId === "other" ? "Khác" : "Chuyên mục");
    let icon = (className: string) => <Icons.BookOpen className={className} />;

    if (logoName) {
      const IconComponent = (Icons as any)[logoName];
      if (IconComponent) {
        icon = (className: string) => <IconComponent className={className} />;
      }
    } else {
      const normalized = title.toLowerCase();
      if (normalized.includes("thi") || normalized.includes("khảo sát") || normalized.includes("đề")) {
        icon = (className: string) => <Icons.GraduationCap className={className} />;
      } else if (normalized.includes("thuyết") || normalized.includes("sách") || normalized.includes("tài liệu") || normalized.includes("bài giảng") || normalized.includes("giáo trình")) {
        icon = (className: string) => <Icons.Book className={className} />;
      } else if (normalized.includes("tập") || normalized.includes("hành")) {
        icon = (className: string) => <Icons.PenTool className={className} />;
      }
    }

    return {
      label: title,
      icon
    };
  };

  return (
    <div 
      className="flex flex-col md:flex-row gap-0 min-h-[calc(100vh/0.9-4rem)] w-full doc-bg-muted"
    >
      {/* Mobile Toggle Bar */}
      <div 
        className="p-4 md:hidden flex items-center justify-between border-b w-full shrink-0 doc-brand-header"
      >
        <span className="font-bold flex items-center gap-2 text-white">
          <BookOpen className="w-5 h-5 text-white" /> Danh mục tài liệu
        </span>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-1 rounded transition-colors doc-text-white"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* 1. Mobile Drawer (Overlay) */}
      {mobileOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 z-[60] md:hidden backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div 
            className="fixed inset-y-0 left-0 w-72 z-[70] md:hidden shadow-2xl overflow-y-auto flex flex-col animate-slide-right doc-brand-header"
          >
            <div className="p-4 flex items-center justify-between border-b doc-border-brand">
              <span className="font-bold flex items-center gap-2 text-white">
                <BookOpen className="w-5 h-5 text-white" /> Tài liệu HOU
              </span>
              <button onClick={() => setMobileOpen(false)} className="p-1 rounded text-white/80 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 space-y-4 pb-24">
              {sidebarCategories.map((cat) => {
                const isExpanded = !!expandedCategories[cat.id];
                return (
                  <div key={cat.id} className="space-y-1">
                    <button
                      onClick={() => setExpandedCategories((prev) => ({ ...prev, [cat.id]: !prev[cat.id] }))}
                      className="w-full flex items-center justify-between p-2 rounded-lg transition-colors text-left text-white/90 hover:bg-[rgba(255,255,255,0.08)]"
                    >
                      <span className="font-semibold text-sm truncate flex items-center gap-2">
                        {getCategoryInfo(cat.id, cat.title, cat.logo).icon("w-4 h-4 text-white/80 shrink-0")}
                        {cat.title}
                      </span>
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-white/70" /> : <ChevronRight className="w-4 h-4 text-white/70" />}
                    </button>
                    {isExpanded && (
                      <div className="pl-3 border-l ml-2 space-y-1 py-1 doc-border-light">
                        {cat.documents.map((d) => {
                          const isActive = d.id === id;
                          return (
                            <Link
                              key={d.id}
                              to={`/documents/${d.id}`}
                              onClick={() => setMobileOpen(false)}
                              className={`block p-2 rounded-md text-xs transition-all ${
                                isActive ? "text-white font-bold doc-sidebar-item-active" : "text-white/70 hover:text-white hover:bg-[rgba(255,255,255,0.08)]"
                              }`}
                            >
                              {d.title}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* 2. Tablet Sidebar (Icons-only) */}
      <div 
        className="hidden md:flex lg:hidden w-20 shrink-0 flex-col items-center py-6 border-r md:sticky md:top-16 md:h-[calc(100vh/0.9-4rem)] z-20 doc-brand-header"
      >
        <div className="mb-8 text-white">
          <BookOpen className="w-6 h-6" />
        </div>
        <div className="flex-1 w-full space-y-4 px-2 flex flex-col items-center">
          {sidebarCategories.map((cat) => {
            const catInfo = getCategoryInfo(cat.id, cat.title, cat.logo);
            const isPopoverOpen = activeTabletPopover === cat.id;
            return (
              <div 
                key={cat.id} 
                className="relative"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTabletPopover(isPopoverOpen ? null : cat.id);
                }}
              >
                <button 
                  title={cat.title}
                  className={`w-12 h-12 rounded-xl flex items-center justify-center text-white/90 hover:bg-[rgba(255,255,255,0.08)] transition-colors ${
                    isPopoverOpen ? "bg-[rgba(255,255,255,0.12)] text-white" : ""
                  }`}
                >
                  {catInfo.icon("w-5 h-5")}
                </button>

                {/* Flyout list */}
                {isPopoverOpen && (
                  <div 
                    className="absolute left-14 top-0 w-64 rounded-xl shadow-xl p-3 border animate-scale-in z-[100] doc-brand-dark-btn"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="font-bold text-xs border-b pb-1.5 mb-2 border-white/10 text-white/90 truncate">
                      {cat.title}
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-1 scrollbar-thin">
                      {cat.documents.map((d) => {
                        const isActive = d.id === id;
                        return (
                          <Link
                            key={d.id}
                            to={`/documents/${d.id}`}
                            onClick={() => setActiveTabletPopover(null)}
                            className={`block p-2 rounded-md text-xs transition-all ${
                              isActive ? "text-white font-bold doc-popover-item-active" : "text-white/70 hover:text-white hover:bg-[rgba(255,255,255,0.08)]"
                            }`}
                          >
                            {d.title}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Desktop Sidebar (Full layout) */}
      <div 
        className="hidden lg:flex w-72 shrink-0 flex-col border-r lg:sticky lg:top-16 lg:h-[calc(100vh/0.9-4rem)] lg:overflow-y-auto z-10 animate-fade-in doc-brand-header"
      >
        <div className="p-4 pb-24 space-y-4">
          <div 
            className="flex items-center gap-2.5 font-bold text-lg mb-6 pb-2 border-b text-white doc-border-brand"
          >
            <BookOpen className="w-5 h-5 text-white" />
            <span>Tài liệu HOU</span>
          </div>

          <div className="space-y-2">
            {sidebarCategories.map((cat) => {
              const isExpanded = !!expandedCategories[cat.id];
              return (
                <div key={cat.id} className="space-y-1">
                  <button
                    onClick={() => setExpandedCategories((prev) => ({ ...prev, [cat.id]: !prev[cat.id] }))}
                    className="w-full flex items-center justify-between p-2 rounded-lg transition-colors text-left text-white/90 hover:bg-[rgba(255,255,255,0.08)]"
                  >
                    <span className="font-semibold text-sm truncate flex items-center gap-2">
                      {getCategoryInfo(cat.id, cat.title, cat.logo).icon("w-4 h-4 text-white/80 shrink-0")}
                      {cat.title}
                    </span>
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-white/70" /> : <ChevronRight className="w-4 h-4 text-white/70" />}
                  </button>
                  {isExpanded && (
                    <div className="pl-3 border-l ml-2 space-y-1 py-1 doc-border-light">
                      {cat.documents.map((d) => {
                        const isActive = d.id === id;
                        return (
                          <Link
                            key={d.id}
                            to={`/documents/${d.id}`}
                            className={`block p-2 rounded-md text-xs transition-all ${
                              isActive ? "text-white font-bold border-l-2 doc-sidebar-item-active" : "text-white/70 hover:text-white hover:bg-[rgba(255,255,255,0.08)]"
                            }`}
                          >
                            {d.title}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 min-w-0 w-full flex flex-col gap-6 doc-main-bg">
        {/* Title Header */}
        <div 
          className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 doc-border-themed"
        >
          <div>
            <h1 className="text-xl font-bold doc-text-fg">
              {doc.category?.title ? `${doc.category.title} - ` : ""}{doc.title}
            </h1>
            <p className="text-xs mt-1 doc-text-muted">{doc.description}</p>
          </div>
          <div className="text-xs doc-text-meta">
            Quyền: <span className="font-semibold doc-text-fg2">{role.toUpperCase()}</span>
          </div>
        </div>

        {/* Info & Search Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="text-xs doc-text-muted">
            Hiển thị từ <span className="font-semibold doc-text-fg2">{filteredCount > 0 ? 1 : 0}</span> đến{" "}
            <span className="font-semibold doc-text-fg2">{filteredCount}</span> trong tổng số{" "}
            <span className="font-semibold doc-text-fg2">{totalCount}</span> câu hỏi
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
        {!isPremiumUser && (
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
                  <Link to="/admin" className="font-bold underline text-amber-600 hover:text-amber-700">
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
                    const isLocked = q.isPremiumLocked && !isPremiumUser;
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
                                  to="/admin"
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
              const isLocked = q.isPremiumLocked && !isPremiumUser;
              return (
                <div 
                  key={q.id || idx}
                  className="card p-4 space-y-3 doc-question-card"
                >
                  <div className="flex items-center justify-between border-b pb-2 doc-border-brand">
                    <span className="font-bold text-xs doc-question-num">Câu {idx + 1}</span>
                    {isLocked && (
                      <span className="text-amber-600 font-bold text-[10px] flex items-center gap-0.5">
                        <Lock className="w-3 h-3" /> Premium
                      </span>
                    )}
                  </div>
                  
                  <div className="text-sm font-medium doc-text-fg">{q.question}</div>
                  
                  {/* Choices list */}
                  <div className="space-y-1.5 pl-2 border-l doc-border-themed">
                    {(q.choices || []).map((opt, oIdx) => (
                      <div key={oIdx} className="text-xs doc-text-muted">
                        <span className="font-semibold mr-1">{String.fromCharCode(65 + oIdx)}.</span>
                        {opt}
                      </div>
                    ))}
                  </div>

                  {q.url_question && (
                    <div 
                      className="border rounded-lg p-1 max-w-full doc-option-card"
                    >
                      <img src={q.url_question} alt={`Ảnh câu hỏi ${idx + 1}`} className="max-h-40 w-full object-contain" />
                    </div>
                  )}

                  <div className="pt-2 border-t doc-border-brand">
                    {isLocked ? (
                      ["pro", "plus"].includes(role) ? (
                        <div className="text-center text-xs text-amber-600 font-semibold py-1.5 bg-amber-500/10 rounded-lg">
                          Vui lòng đăng ký bộ câu hỏi này
                        </div>
                      ) : (
                        <Link
                          to="/admin"
                          className="block text-center text-xs bg-amber-500 hover:bg-amber-600 text-white font-semibold py-1.5 rounded-lg transition"
                        >
                          Nâng cấp Premium để xem đáp án
                        </Link>
                      )
                    ) : (
                      <div className="space-y-2">
                        <div className="text-[10px] uppercase font-semibold doc-text-muted">Đáp án đúng:</div>
                        <div 
                          className="font-semibold rounded-lg px-2.5 py-1.5 inline-block text-xs border doc-answer-badge"
                        >
                          {q.answer}
                        </div>
                        {q.url_answer && (
                          <div 
                            className="border rounded-lg p-1 max-w-full doc-option-card"
                          >
                            <img src={q.url_answer} alt={`Ảnh đáp án ${idx + 1}`} className="max-h-40 w-full object-contain" />
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
        {!isPremiumUser && totalCount > visibleQuestions.length && (
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
                  <Link to="/admin" className="font-bold underline text-amber-600 hover:text-amber-700">
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
