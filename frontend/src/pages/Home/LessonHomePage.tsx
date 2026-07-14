import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.js";
import { useUI } from "../../context/UIContext.js";
import { cachedGet } from "../../utils/apiCache.js";
import { SkeletonCard } from "../../components/common/LoadingSpinner.js";
import { Search, GraduationCap, BookOpenCheck, Crown, Filter, X, FileText, ChevronRight, Book, PenTool, File, Calendar } from "lucide-react";
import * as Icons from "lucide-react";
import apiClient from "../../services/client.js";

interface Document {
  id: string;
  title: string;
  description: string;
  category_id: string;
  created_at: string;
  premium?: boolean;
  crawler_courses?: any;
  category?: {
    title: string;
    logo?: string | null;
  } | null;
}

interface GroupedCategory {
  id: string;
  title: string;
  logo?: string | null;
  documents: Document[];
  total_count: number;
}

const LessonHomePage: React.FC = () => {
  const { loading: authLoading, role, profile } = useAuth();
  const { navigateWithPrefetch } = useUI();
  const [groupedCategories, setGroupedCategories] = useState<GroupedCategory[]>([]);
  const [searchResults, setSearchResults] = useState<Document[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Expanded states per category card
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [expandedDocs, setExpandedDocs] = useState<Record<string, Document[]>>({});
  const [loadingCategory, setLoadingCategory] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (authLoading) return;
    cachedGet<{ categories: any[] }>("/api/v1/documents/categories?lms=true")
      .then((res) => {
        setGroupedCategories(res.data.categories || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Không thể tải danh sách bài học.");
        setLoading(false);
      });
  }, [authLoading]);

  const handleSearch = () => {
    if (!search.trim()) {
      setSearchResults([]);
      setActiveSearchQuery("");
      return;
    }
    setSearchLoading(true);
    apiClient.get<{ documents: Document[] }>(`/api/v1/documents?q=${encodeURIComponent(search)}&lms=true`)
      .then((res) => {
        setSearchResults(res.data.documents || []);
        setActiveSearchQuery(search);
      })
      .catch((err) => {
        console.error("Lỗi khi tìm kiếm bài học:", err);
      })
      .finally(() => {
        setSearchLoading(false);
      });
  };

  const handleExpand = async (catId: string) => {
    if (expandedCategories[catId]) {
      setExpandedCategories(prev => ({ ...prev, [catId]: false }));
      return;
    }

    setExpandedCategories(prev => ({ ...prev, [catId]: true }));

    if (!expandedDocs[catId]) {
      setLoadingCategory(prev => ({ ...prev, [catId]: true }));
      try {
        const res = await apiClient.get(`/api/v1/documents/lms?category_id=${catId}`);
        setExpandedDocs(prev => ({ ...prev, [catId]: res.data.documents || [] }));
      } catch (err) {
        console.error("Failed to load documents for category:", err);
      } finally {
        setLoadingCategory(prev => ({ ...prev, [catId]: false }));
      }
    }
  };

  const getCategoryInfo = (_catId: string, customTitle?: string | null, logoName?: string | null) => {
    const title = customTitle || "Chuyên mục";
    let icon = (className: string) => <File className={className} />;

    if (logoName) {
      const IconComponent = (Icons as any)[logoName];
      if (IconComponent) {
        icon = (className: string) => <IconComponent className={className} />;
      }
    } else {
      const normalized = title.toLowerCase();
      if (normalized.includes("thi") || normalized.includes("khảo sát") || normalized.includes("đề")) {
        icon = (className: string) => <GraduationCap className={className} />;
      } else if (normalized.includes("thuyết") || normalized.includes("sách") || normalized.includes("tài liệu") || normalized.includes("bài giảng") || normalized.includes("giáo trình") || normalized.includes("đại cương")) {
        icon = (className: string) => <Book className={className} />;
      } else if (normalized.includes("tập") || normalized.includes("hành")) {
        icon = (className: string) => <PenTool className={className} />;
      }
    }

    return { label: title, icon };
  };

  // Unique categories list
  const uniqueCategoryMap = useMemo(() => {
    return groupedCategories.reduce((acc, cat) => {
      acc[cat.id] = { title: cat.title, logo: cat.logo };
      return acc;
    }, {} as Record<string, { title: string; logo?: string | null }>);
  }, [groupedCategories]);

  const categories = useMemo(() => {
    return Object.keys(uniqueCategoryMap);
  }, [uniqueCategoryMap]);

  const isSearchActive = !!activeSearchQuery;

  // Filter docs for search
  const filteredSearchDocs = useMemo(() => {
    return searchResults.filter((doc) => {
      return !selectedCategory || (doc.category_id || "other") === selectedCategory;
    });
  }, [searchResults, selectedCategory]);

  const searchGrouped = useMemo(() => {
    return filteredSearchDocs.reduce((acc, doc) => {
      const cat = doc.category_id || "other";
      if (!acc[cat]) {
        const catTitle = doc.category?.title || (cat === "other" ? "Khác" : "Chuyên mục");
        acc[cat] = {
          id: cat,
          title: catTitle,
          logo: doc.category?.logo || null,
          documents: [],
          total_count: 0
        };
      }
      acc[cat].documents.push(doc);
      acc[cat].total_count++;
      return acc;
    }, {} as Record<string, { id: string; title: string; logo?: string | null; documents: Document[]; total_count: number }>);
  }, [filteredSearchDocs]);

  const matchedCategories = useMemo(() => {
    if (!search.trim()) return [];
    return groupedCategories.filter((cat) =>
      cat.title.toLowerCase().includes(search.toLowerCase())
    );
  }, [groupedCategories, search]);

  const searchGroupedCategories = useMemo(() => {
    return Object.values(searchGrouped);
  }, [searchGrouped]);

  const normalGroupedCategories = useMemo(() => {
    return groupedCategories.filter(
      cat => !selectedCategory || cat.id === selectedCategory
    );
  }, [groupedCategories, selectedCategory]);

  const activeCategories = isSearchActive ? searchGroupedCategories : normalGroupedCategories;

  return (
    <div className="lesson-home-container">
      {/* Banner */}
      <section className="relative overflow-hidden rounded-3xl mb-8 home-hero-container">
        <div className="absolute inset-0 opacity-30 home-hero-mesh" />
        <div className="relative px-6 py-10 sm:px-10 sm:py-14 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full text-white/80 text-xs font-medium mb-5 home-hero-search-card">
            <BookOpenCheck className="w-3.5 h-3.5" />
            Không gian học tập & bài giảng HOU
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight max-w-2xl leading-tight">
            Bài Học & Tài Liệu HOU
          </h1>
          <p className="mt-4 text-base sm:text-lg text-white/70 max-w-xl">
            Học tập theo lộ trình chuẩn. Xem bài giảng, video học liệu và ôn tập bộ câu hỏi eHOU trích xuất tự động.
          </p>
          <div className="mt-8 flex items-center w-full max-w-lg relative">
            <button 
              onClick={handleSearch}
              className="absolute left-4 top-1/2 -translate-y-1/2 border-none bg-transparent text-white/40 hover:text-white/80 cursor-pointer transition-colors p-0 flex items-center justify-center z-10"
            >
              <Search className="w-4 h-4" />
            </button>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                const val = e.target.value;
                setSearch(val);
                if (!val.trim()) {
                  setSearchResults([]);
                  setActiveSearchQuery("");
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
              placeholder="Tìm kiếm môn học hoặc bài giảng HOU..."
              className="w-full pl-10 pr-10 py-3 rounded-xl text-white placeholder:text-white/40 text-sm focus:outline-none transition-all duration-250 home-hero-stat-card"
            />
            {search && (
              <button 
                onClick={() => {
                  setSearch("");
                  setSearchResults([]);
                  setActiveSearchQuery("");
                }} 
                className="absolute right-3 top-1/2 -translate-y-1/2 border-none bg-transparent text-white/40 hover:text-white/80 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── Document Grid (Chỉ hiển thị kết quả khi tìm kiếm) ── */}
      {isSearchActive && (
        <div className="mt-6 pb-10 animate-fade-in">
          {/* ── Error State ── */}
          {error && (
            <div className="p-6 text-center home-error-container mb-8">
              <p className="text-red-600 text-sm font-medium">{error}</p>
            </div>
          )}

          {/* ── Loading Spinner ── */}
          {loading && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          )}

          {/* ── Empty State ── */}
          {!loading && !error && activeCategories.length === 0 && matchedCategories.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 flex items-center justify-center mb-4 home-empty-icon-wrapper shadow-sm">
                <FileText className="w-8 h-8 home-empty-icon text-[var(--muted)]" />
              </div>
              <h3 className="text-sm font-bold mb-1 home-empty-title">
                Không tìm thấy kết quả phù hợp
              </h3>
              <p className="text-xs text-center home-empty-text">
                Hãy thử sử dụng từ khóa khác hoặc kiểm tra lỗi chính tả.
              </p>
            </div>
          )}

          {/* ── Matched Chuyên ngành/Chuyên mục List ── */}
          {!loading && !error && matchedCategories.length > 0 && (
            <div className="mb-10 animate-fade-in">
              <h3 className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider mb-4">
                Chuyên ngành đào tạo ({matchedCategories.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {matchedCategories.map((cat) => {
                  const catInfo = getCategoryInfo(cat.id, cat.title, cat.logo);
                  return (
                    <Link
                      key={cat.id}
                      to={`/categories/${cat.id}`}
                      className="flex flex-col items-center justify-center p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--bg-2)] hover:border-[var(--brand-600)] transition-all text-center group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-[var(--surface)] flex items-center justify-center mb-2 group-hover:bg-[var(--brand-50)] transition-colors border border-[var(--border)]">
                        {catInfo.icon("w-5 h-5 text-[var(--brand-600)]")}
                      </div>
                      <span className="text-xs font-bold text-[var(--fg)] group-hover:text-[var(--brand-600)] transition-colors line-clamp-1">
                        {catInfo.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Search Results List ── */}
          {!loading && !error && activeCategories.length > 0 && (
            <div>
              <div className="flex items-baseline justify-between mb-5">
                <p className="text-xs home-text-meta font-medium">
                  Tìm thấy <span className="font-bold home-text-fg2">{filteredSearchDocs.length}</span> bài học phù hợp
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeCategories.map((cat) => {
                  const docs = cat.documents;

                  return (
                    <div key={cat.id} className="home-category-card animate-fade-up lesson-card">
                      <div className="flex items-center gap-3 mb-4 pb-3 home-card-header border-b border-[var(--border)]">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-xs leading-snug home-card-title truncate">
                            {cat.title}
                          </h3>
                        </div>
                      </div>

                      <div className="home-doc-list">
                        {docs.map((doc) => (
                          <a
                            key={doc.id}
                            href={`/documents/${doc.id}`}
                            onClick={(e) => {
                              e.preventDefault();
                              navigateWithPrefetch(doc.id);
                            }}
                            className="group/item flex items-center justify-between p-2.5 rounded-xl hover:bg-[var(--bg-2)] transition-colors duration-200"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <FileText className="w-4 h-4 text-[var(--muted)] group-hover/item:text-[var(--brand-600)] shrink-0 transition-colors" />
                              <span className="text-xs text-[var(--fg-2)] group-hover/item:text-[var(--brand-600)] font-medium truncate transition-colors">
                                {doc.title}
                              </span>
                              {doc.premium && (
                                <span title="Tài liệu Premium"><Crown className="w-3 h-3 text-amber-400 shrink-0" /></span>
                              )}
                            </div>
                            <ChevronRight className="w-4 h-4 text-[var(--meta)] opacity-0 group-hover/item:opacity-100 group-hover/item:translate-x-0.5 transition-all shrink-0 duration-200" />
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Lenovo Vantage Style Dashboard (Chỉ hiển thị khi không tìm kiếm) ── */}
      {!isSearchActive && (
        <section className="mb-10 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Cột trái (Chiếm 2/3 chiều rộng trên desktop) */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Card 1: Thông tin Sinh viên (Giống Card thông tin Laptop Lenovo) */}
              <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:shadow-md transition-shadow relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-[var(--fg)] flex items-center gap-2">
                    {role === "admin" 
                      ? "Thông tin quản trị viên" 
                      : role === "management" 
                        ? "Thông tin quản lý" 
                        : "Thông tin học viên"}
                  </h3>
                  <button
                    onClick={() => window.dispatchEvent(new Event("open-profile"))}
                    className="p-1.5 rounded-lg bg-[var(--bg-2)] hover:bg-[var(--bg-3)] cursor-pointer text-[var(--fg)] border-none flex items-center justify-center transition-colors"
                    title="Chỉnh sửa thông tin"
                  >
                    <Icons.Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  {/* Ảnh minh họa hoặc Avatar */}
                  <div className="w-24 h-24 rounded-2xl bg-[var(--bg-2)] flex items-center justify-center border border-[var(--border)] shrink-0 overflow-hidden">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <Icons.GraduationCap className="w-12 h-12 text-[var(--brand-600)]" />
                    )}
                  </div>
                  
                  {/* Chi tiết tài khoản */}
                  <div className="flex-1 w-full space-y-2">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      <span className="text-[var(--muted)] font-medium">Họ & Tên:</span>
                      <span className="font-bold text-[var(--fg)] truncate">{useAuth().user?.name || useAuth().profile?.full_name || "Học viên HOU"}</span>
                      
                      <span className="text-[var(--muted)] font-medium">Email:</span>
                      <span className="font-bold text-[var(--fg)] truncate">{useAuth().user?.email || "Chưa liên kết"}</span>
                      
                      <span className="text-[var(--muted)] font-medium">Quyền hạn:</span>
                      <span className="font-bold text-[var(--brand-600)]">
                        {useAuth().role === "admin" ? "Quản trị viên" : useAuth().role === "management" ? "Quản lý" : "Học viên Premium"}
                      </span>
                      
                      <span className="text-[var(--muted)] font-medium">Học chế:</span>
                      <span className="font-bold text-green-600 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        Trực tuyến (eHOU)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Danh mục môn học (Giống Support Services) */}
              <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:shadow-md transition-shadow relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-[var(--fg)]">
                    Chuyên mục đào tạo bài học
                  </h3>
                  {groupedCategories[0] && (
                    <div className="flex items-center gap-1.5">
                      <Link 
                        to={`/categories/${groupedCategories[0].id}`}
                        className="p-1 rounded bg-[var(--bg-2)] hover:bg-[var(--bg-3)] cursor-pointer text-[var(--fg)] border-none flex items-center justify-center"
                      >
                        <Icons.ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  )}
                </div>

                {/* Bento grid con */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {groupedCategories.map((cat) => {
                    const catInfo = getCategoryInfo(cat.id, cat.title, cat.logo);
                    return (
                      <Link
                        key={cat.id}
                        to={`/categories/${cat.id}`}
                        className="flex flex-col items-center justify-center p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-2)] hover:bg-[var(--surface)] hover:border-[var(--brand-600)] transition-all text-center group"
                      >
                        <div className="w-10 h-10 rounded-lg bg-[var(--surface)] flex items-center justify-center mb-2 group-hover:bg-[var(--brand-50)] transition-colors border border-[var(--border)]">
                          {catInfo.icon("w-5 h-5 text-[var(--brand-600)]")}
                        </div>
                        <span className="text-xs font-bold text-[var(--fg)] group-hover:text-[var(--brand-600)] transition-colors line-clamp-1">
                          {catInfo.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Cột phải (Chiếm 1/3 chiều rộng trên desktop) */}
            <div className="space-y-6">
              
              {/* Card 3: Tiến độ học tập & Lịch thi (Giống Battery Widget nhưng chứa thông tin thật) */}
              <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:shadow-md transition-shadow text-center flex flex-col items-center relative overflow-hidden">
                <h3 className="text-sm font-bold text-[var(--fg)] mb-4 self-start">
                  Lịch thi eHOU
                </h3>
                
                {/* Lịch thi Icon Container */}
                <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100 mb-4 shrink-0">
                  <Calendar className="w-10 h-10 text-[var(--brand-600)]" />
                </div>
                
                <p className="text-xs font-semibold text-[var(--fg)] mb-2">Tra cứu lịch thi trực tuyến</p>
                <p className="text-[10px] text-[var(--muted)] mb-5 max-w-[200px]">Xem phòng thi, ca thi và danh sách môn đăng ký thi cá nhân.</p>
                
                <Link 
                  to="/lich-thi"
                  className="w-full py-2.5 px-4 rounded-xl bg-[var(--brand-600)] hover:bg-[var(--brand-700)] !text-white hover:!text-white text-xs font-bold transition-colors text-center flex items-center justify-center gap-2"
                >
                  <Calendar className="w-4 h-4 shrink-0" />
                  Tra cứu lịch thi ngay
                </Link>
              </div>

              {/* Card 4: Trạng thái Premium & Liên hệ (Giống Warranty Widget) */}
              <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:shadow-md transition-shadow relative overflow-hidden">
                <h3 className="text-sm font-bold text-[var(--fg)] mb-4">
                  Đăng ký tài khoản
                </h3>
                
                <div className="flex items-start gap-4 mb-4">
                  {/* Shield icon */}
                  <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center border border-amber-200 shrink-0">
                    <Icons.Shield className="w-6 h-6 text-amber-500" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-amber-600">Premium Active</div>
                    <div className="text-[10px] text-[var(--muted)] mt-1">Học liệu bài giảng chuẩn eHOU cập nhật tự động.</div>
                  </div>
                </div>

                {/* Nút liên hệ và nâng cấp */}
                <div className="w-full">
                  <Link
                    to="/pricing"
                    className="py-2 px-3 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-2)] text-[10px] font-bold text-[var(--fg)] text-center transition-colors block w-full"
                  >
                    Gói dịch vụ
                  </Link>
                </div>
              </div>

            </div>

          </div>
        </section>
      )}
    </div>
  );
};

export default LessonHomePage;
