import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import apiClient from "../../services/client.js";
import LoadingSpinner from "../../components/common/LoadingSpinner.js";
import { useAuth } from "../../context/AuthContext.js";
import { Lock, ChevronDown, ChevronRight, Menu, Search, BookOpen } from "lucide-react";

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
  } | null;
}

interface SidebarCategory {
  id: string;
  title: string;
  documents: Document[];
}

const DocumentPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { role } = useAuth();
  const [doc, setDoc] = useState<Document | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Sidebar States
  const [sidebarCategories, setSidebarCategories] = useState<SidebarCategory[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [mobileOpen, setMobileOpen] = useState(false);

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
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Lỗi tải thông tin tài liệu. Vui lòng thử lại.");
        setLoading(false);
      });
  }, [id]);

  // Load and Group documents for the sidebar
  useEffect(() => {
    apiClient.get("/api/v1/documents")
      .then((res) => {
        const docs: Document[] = res.data.documents || [];
        const groups: Record<string, SidebarCategory> = {};

        docs.forEach((d) => {
          const catId = d.category_id || "other";
          const catTitle = d.category?.title || "Khác";
          if (!groups[catId]) {
            groups[catId] = {
              id: catId,
              title: catTitle,
              documents: []
            };
          }
          groups[catId].documents.push(d);
        });

        const groupedArray = Object.values(groups);
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

  if (loading) return <LoadingSpinner />;
  if (error || !doc)
    return (
      <div style={{ color: "#ef4444", textAlign: "center", padding: "2rem" }}>
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
  const isPremiumUser = ["admin", "ultra", "pro", "plus"].includes(role);

  return (
    <div 
      className="flex flex-col md:flex-row gap-0 min-h-[calc(100vh/0.9-4rem)]"
      style={{ background: "var(--bg-2)", color: "var(--fg)" }}
    >
      {/* Sidebar - Solid Green */}
      <div 
        className="w-full md:w-64 lg:w-72 shrink-0 flex flex-col border-r md:sticky md:top-16 md:h-[calc(100vh/0.9-4rem)] md:overflow-y-auto z-10"
        style={{ background: "var(--brand-700)", borderColor: "var(--brand-800)", color: "#fff" }}
      >
        {/* Mobile/Tablet Header / Toggle */}
        <div 
          className="p-4 md:hidden flex items-center justify-between border-b"
          style={{ borderColor: "var(--brand-800)" }}
        >
          <span className="font-bold flex items-center gap-2 text-white">
            <BookOpen className="w-5 h-5 text-white" /> Danh mục tài liệu
          </span>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-1 rounded transition-colors"
            style={{ color: "#fff" }}
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>

        {/* Sidebar Navigation */}
        <div className={`w-full md:block ${mobileOpen ? "block" : "hidden"} flex-1 p-4 pb-24 space-y-4`}>
          <div 
            className="hidden md:flex items-center gap-2.5 font-bold text-lg mb-6 pb-2 border-b text-white"
            style={{ borderColor: "var(--brand-800)" }}
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
                    <span className="font-semibold text-sm truncate">
                      {cat.title}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-white/70 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-white/70 shrink-0" />
                    )}
                  </button>
                  {isExpanded && (
                    <div 
                      className="pl-3 border-l ml-2 space-y-1 py-1"
                      style={{ borderColor: "rgba(255,255,255,0.15)" }}
                    >
                      {cat.documents.map((d) => {
                        const isActive = d.id === id;
                        return (
                          <Link
                             key={d.id}
                            to={`/documents/${d.id}`}
                            onClick={() => setMobileOpen(false)}
                            className={`block p-2 rounded-md text-xs transition-all ${
                              isActive
                                ? "text-white font-bold border-l-2"
                                : "text-white/70 hover:text-white hover:bg-[rgba(255,255,255,0.08)]"
                            }`}
                            style={isActive ? { 
                              background: "var(--brand-800)",
                              borderLeftColor: "var(--brand-300)"
                            } : {}}
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
      <div className="flex-1 p-6 min-w-0 w-full flex flex-col gap-6" style={{ background: "var(--bg)" }}>
        {/* Title Header */}
        <div 
          className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4"
          style={{ borderColor: "var(--border)" }}
        >
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--fg)" }}>
              {doc.category?.title ? `${doc.category.title} - ` : ""}{doc.title}
            </h1>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{doc.description}</p>
          </div>
          <div className="text-xs" style={{ color: "var(--meta)" }}>
            Quyền: <span className="font-semibold" style={{ color: "var(--fg-2)" }}>{role.toUpperCase()}</span>
          </div>
        </div>

        {/* Info & Search Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="text-xs" style={{ color: "var(--muted)" }}>
            Hiển thị từ <span className="font-semibold" style={{ color: "var(--fg-2)" }}>{filteredCount > 0 ? 1 : 0}</span> đến{" "}
            <span className="font-semibold" style={{ color: "var(--fg-2)" }}>{filteredCount}</span> trong tổng số{" "}
            <span className="font-semibold" style={{ color: "var(--fg-2)" }}>{totalCount}</span> câu hỏi
          </div>

          {/* Search box */}
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--meta)" }} />
            <input
              type="text"
              placeholder="Tìm kiếm câu hỏi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border text-xs focus:outline-none focus:ring-1 focus:ring-[var(--brand-500)]"
              style={{ 
                borderColor: "var(--border)", 
                background: "var(--surface)", 
                color: "var(--fg)" 
              }}
            />
          </div>
        </div>

        {/* Warning Alert Banner (If not premium/logged in) */}
        {!isPremiumUser && (
          <div 
            className="border rounded-xl p-4 flex items-center gap-3 text-xs"
            style={{ 
              background: "color-mix(in srgb, var(--warn) 8%, var(--surface))", 
              borderColor: "color-mix(in srgb, var(--warn) 20%, var(--border))",
              color: "var(--fg)"
            }}
          >
            <span className="w-5 h-5 bg-amber-500 text-white rounded-full flex items-center justify-center shrink-0 font-bold">!</span>
            <p>
              Bạn đang xem bản giới hạn (50% câu hỏi). Vui lòng{" "}
              <Link to="/admin" className="font-bold underline text-amber-600 hover:text-amber-700">
                nâng cấp Premium
              </Link>{" "}
              để truy cập đầy đủ tất cả câu hỏi học tập.
            </p>
          </div>
        )}

        {/* Questions Table (Desktop & Tablet) */}
        <div 
          className="hidden md:block rounded-xl shadow-sm border overflow-x-auto"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="min-w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr 
                  className="border-b text-xs font-semibold uppercase"
                  style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--muted)" }}
                >
                  <th className="py-3 px-4 w-16 text-center">STT</th>
                  <th className="py-3 px-4">Câu hỏi</th>
                  <th className="py-3 px-4 w-1/3">Câu trả lời</th>
                </tr>
              </thead>
              <tbody 
                className="divide-y text-sm"
                style={{ borderColor: "var(--border-soft)", color: "var(--fg-2)" }}
              >
                {filteredQuestions.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-xs" style={{ color: "var(--meta)" }}>
                      Không tìm thấy câu hỏi phù hợp.
                    </td>
                  </tr>
                ) : (
                  filteredQuestions.map((q, idx) => {
                    const isLocked = q.isPremiumLocked && !isPremiumUser;
                    return (
                      <tr 
                        key={q.id || idx} 
                        className="transition-colors hover:bg-[var(--bg-2)]"
                        style={{ borderBottom: "1px solid var(--border-soft)" }}
                      >
                        <td className="py-4 px-4 text-center font-medium text-xs align-top" style={{ color: "var(--meta)" }}>
                          {idx + 1}
                        </td>
                        <td className="py-4 px-4 align-top space-y-2">
                          <div className="font-medium" style={{ color: "var(--fg)" }}>{q.question}</div>
                          
                          {/* Options choices list */}
                          <div 
                            className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 pl-2 border-l"
                            style={{ borderColor: "var(--border)" }}
                          >
                            {(q.choices || []).map((opt, oIdx) => (
                              <div key={oIdx} className="text-xs" style={{ color: "var(--muted)" }}>
                                <span className="font-semibold mr-1">{String.fromCharCode(65 + oIdx)}.</span>
                                {opt}
                              </div>
                            ))}
                          </div>

                          {q.url_question && (
                            <div 
                              className="mt-2 border rounded-lg p-1 max-w-sm inline-block"
                              style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
                            >
                              <img src={q.url_question} alt={`Ảnh câu hỏi ${idx + 1}`} className="max-h-40 object-contain" />
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4 align-top">
                          {isLocked ? (
                            <div 
                              className="flex flex-col gap-1.5 border rounded-lg p-2.5 max-w-xs"
                              style={{ 
                                background: "color-mix(in srgb, var(--warn) 6%, var(--surface))", 
                                borderColor: "color-mix(in srgb, var(--warn) 15%, var(--border))"
                              }}
                            >
                              <span className="text-amber-600 font-bold text-xs flex items-center gap-1">
                                <Lock className="w-3.5 h-3.5" /> Bị khóa
                              </span>
                              <Link
                                to="/admin"
                                className="text-[10px] bg-amber-500 hover:bg-amber-600 text-white font-semibold px-2 py-1 rounded text-center transition"
                              >
                                Nâng cấp Premium
                              </Link>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <div 
                                className="font-semibold rounded-lg px-2.5 py-1.5 inline-block text-xs border"
                                style={{ 
                                  background: "color-mix(in srgb, var(--brand-600) 8%, var(--surface))", 
                                  color: "var(--brand-700)",
                                  borderColor: "color-mix(in srgb, var(--brand-600) 20%, var(--border))"
                                }}
                              >
                                {q.answer}
                              </div>
                              {q.url_answer && (
                                <div 
                                  className="border rounded-lg p-1 max-w-xs mt-1.5"
                                  style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
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
          {filteredQuestions.length === 0 ? (
            <div className="card p-8 text-center text-xs" style={{ color: "var(--meta)", background: "var(--surface)" }}>
              Không tìm thấy câu hỏi phù hợp.
            </div>
          ) : (
            filteredQuestions.map((q, idx) => {
              const isLocked = q.isPremiumLocked && !isPremiumUser;
              return (
                <div 
                  key={q.id || idx}
                  className="card p-4 space-y-3"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px" }}
                >
                  <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: "var(--border-soft)" }}>
                    <span className="font-bold text-xs" style={{ color: "var(--brand-600)" }}>Câu {idx + 1}</span>
                    {isLocked && (
                      <span className="text-amber-600 font-bold text-[10px] flex items-center gap-0.5">
                        <Lock className="w-3 h-3" /> Premium
                      </span>
                    )}
                  </div>
                  
                  <div className="text-sm font-medium" style={{ color: "var(--fg)" }}>{q.question}</div>
                  
                  {/* Choices list */}
                  <div className="space-y-1.5 pl-2 border-l" style={{ borderColor: "var(--border)" }}>
                    {(q.choices || []).map((opt, oIdx) => (
                      <div key={oIdx} className="text-xs" style={{ color: "var(--muted)" }}>
                        <span className="font-semibold mr-1">{String.fromCharCode(65 + oIdx)}.</span>
                        {opt}
                      </div>
                    ))}
                  </div>

                  {q.url_question && (
                    <div 
                      className="border rounded-lg p-1 max-w-full"
                      style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
                    >
                      <img src={q.url_question} alt={`Ảnh câu hỏi ${idx + 1}`} className="max-h-40 w-full object-contain" />
                    </div>
                  )}

                  <div className="pt-2 border-t" style={{ borderColor: "var(--border-soft)" }}>
                    {isLocked ? (
                      <Link
                        to="/admin"
                        className="block text-center text-xs bg-amber-500 hover:bg-amber-600 text-white font-semibold py-1.5 rounded-lg transition"
                      >
                        Nâng cấp Premium để xem đáp án
                      </Link>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-[10px] uppercase font-semibold" style={{ color: "var(--muted)" }}>Đáp án đúng:</div>
                        <div 
                          className="font-semibold rounded-lg px-2.5 py-1.5 inline-block text-xs border"
                          style={{ 
                            background: "color-mix(in srgb, var(--brand-600) 8%, var(--surface))", 
                            color: "var(--brand-700)",
                            borderColor: "color-mix(in srgb, var(--brand-600) 20%, var(--border))"
                          }}
                        >
                          {q.answer}
                        </div>
                        {q.url_answer && (
                          <div 
                            className="border rounded-lg p-1 max-w-full"
                            style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
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
      </div>
    </div>
  );
};

export default DocumentPage;
