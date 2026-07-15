import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import apiClient from "../../services/client.js";
import { cachedGet } from "../../utils/apiCache.js";
import { SkeletonCard } from "../../components/common/LoadingSpinner.js";
import { useAuth } from "../../context/AuthContext.js";
import { useUI } from "../../context/UIContext.js";
import LessonHomePage from "./LessonHomePage.js";
import * as Icons from "lucide-react";
import "../../css/home.css";
import "../../css/lesson.css";

const { BookOpen, Search, FileText, ChevronRight, Filter, X, Crown, GraduationCap, Award, Compass, Calendar } = Icons;

interface Document {
  id: string;
  title: string;
  description: string;
  category_id: string;
  created_at: string;
  premium?: boolean;
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

const HomePage: React.FC = () => {
  const { lessonMode, navigateWithPrefetch } = useUI();
  const { loading: authLoading, role, profile } = useAuth();

  if (lessonMode) {
    return <LessonHomePage />;
  }
  const [groupedCategories, setGroupedCategories] = useState<GroupedCategory[]>([]);
  const [searchResults, setSearchResults] = useState<Document[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [expandedDocs, setExpandedDocs] = useState<Record<string, Document[]>>({});
  const [loadingCategory, setLoadingCategory] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (authLoading) return;
    cachedGet<{ categories: any[] }>("/api/v1/documents/categories")
      .then((res) => {
        setGroupedCategories(res.data.categories || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Không thể tải danh sách tài liệu.");
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
    apiClient.get<{ documents: Document[] }>(`/api/v1/documents?q=${encodeURIComponent(search)}`)
      .then((res) => {
        setSearchResults(res.data.documents || []);
        setActiveSearchQuery(search);
      })
      .catch((err) => {
        console.error("Lỗi khi tìm kiếm tài liệu:", err);
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
        const res = await apiClient.get(`/api/v1/documents?category_id=${catId}`);
        setExpandedDocs(prev => ({ ...prev, [catId]: res.data.documents || [] }));
      } catch (err) {
        console.error("Failed to load documents for category:", err);
      } finally {
        setLoadingCategory(prev => ({ ...prev, [catId]: false }));
      }
    }
  };

  const getCategoryThemeClass = (catId: string, title?: string | null): string => {
    const normalized = (title || "").toLowerCase();
    if (catId === "exam" || normalized.includes("thi") || normalized.includes("khảo sát") || normalized.includes("đề")) {
      return "exam";
    }
    if (catId === "theory" || normalized.includes("thuyết") || normalized.includes("sách") || normalized.includes("tài liệu") || normalized.includes("bài giảng") || normalized.includes("giáo trình")) {
      return "theory";
    }
    if (catId === "practice" || normalized.includes("tập") || normalized.includes("hành")) {
      return "practice";
    }
    return "other";
  };

  const getCategoryInfo = (catId: string, customTitle?: string | null, logoName?: string | null) => {
    const title = customTitle || (
      catId === "exam" ? "Đề thi" :
      catId === "theory" ? "Lý thuyết" :
      catId === "practice" ? "Bài tập" :
      catId === "other" ? "Khác" : "Chuyên mục"
    );

    let icon = (className: string) => <Icons.File className={className} />;

    if (logoName) {
      const IconComponent = (Icons as any)[logoName];
      if (IconComponent) {
        icon = (className: string) => <IconComponent className={className} />;
      }
    } else {
      const theme = getCategoryThemeClass(catId, title);
      if (theme === "exam") {
        icon = (className: string) => <Icons.GraduationCap className={className} />;
      } else if (theme === "theory") {
        icon = (className: string) => <Icons.Book className={className} />;
      } else if (theme === "practice") {
        icon = (className: string) => <Icons.PenTool className={className} />;
      }
    }

    return { label: title, icon };
  };

  const uniqueCategoryMap = groupedCategories.reduce((acc, cat) => {
    acc[cat.id] = { title: cat.title, logo: cat.logo };
    return acc;
  }, {} as Record<string, { title: string; logo?: string | null }>);

  const categories = Object.keys(uniqueCategoryMap);
  const isSearchActive = !!activeSearchQuery;

  const filteredSearchDocs = searchResults.filter((doc) => {
    return !selectedCategory || (doc.category_id || "other") === selectedCategory;
  });

  const searchGrouped = filteredSearchDocs.reduce((acc, doc) => {
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

  const matchedCategories = useMemo(() => {
    if (!search.trim()) return [];
    return groupedCategories.filter((cat) =>
      cat.title.toLowerCase().includes(search.toLowerCase())
    );
  }, [groupedCategories, search]);

  const searchGroupedCategories = Object.values(searchGrouped);
  const normalGroupedCategories = groupedCategories.filter(
    cat => !selectedCategory || cat.id === selectedCategory
  );

  const activeCategories = isSearchActive ? searchGroupedCategories : normalGroupedCategories;
  const totalDocsCount = groupedCategories.reduce((acc, cat) => acc + cat.total_count, 0);

  return (
    <div className="pb-12">
      {/* ── Hero Banner ── */}
      <section className="relative overflow-hidden rounded-3xl mb-10 home-hero-container">
        <div className="absolute inset-0 opacity-20 home-hero-mesh" />
        <div className="relative px-6 py-12 sm:px-12 sm:py-16 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-white/90 text-xs font-semibold mb-6 home-hero-search-card">
            <GraduationCap className="w-4 h-4 text-white" />
            Tài liệu ôn thi HOU
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight text-balance max-w-3xl leading-tight">
            Kho Tài Liệu Học Tập eHOU
          </h1>
          <p className="mt-4 text-sm sm:text-base md:text-lg text-white/80 max-w-2xl text-balance font-medium">
            Học tập thông minh hơn với ngân hàng đề thi chất lượng, tóm tắt lý thuyết trực quan và hệ thống bài tập thực hành phong phú.
          </p>

          {/* Search Box */}
          <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 w-full max-w-lg">
            <div className="relative flex-1 w-full">
              <button 
                onClick={handleSearch}
                className="absolute left-4 top-1/2 -translate-y-1/2 border-none bg-transparent text-white/50 hover:text-white/90 cursor-pointer transition-colors p-0 flex items-center justify-center z-10"
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
                placeholder="Nhập tên tài liệu, môn học hoặc từ khóa cần tìm..."
                className="w-full pl-11 pr-10 py-3.5 rounded-xl text-white placeholder:text-white/50 text-sm focus:outline-none transition-all duration-250 home-hero-search-card"
              />
              {search && (
                <button 
                  onClick={() => {
                    setSearch("");
                    setSearchResults([]);
                    setActiveSearchQuery("");
                  }} 
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/90 transition-colors border-none bg-transparent cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Stats Bar */}
          <div className="mt-10 flex flex-wrap justify-center items-center gap-4 sm:gap-8">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl home-hero-stat-card">
              <BookOpen className="w-5 h-5 text-white" />
              <span className="text-white text-xs sm:text-sm font-semibold">{groupedCategories.length} Chuyên mục</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl home-hero-stat-card">
              <Award className="w-5 h-5 text-amber-300" />
              <span className="text-white text-xs sm:text-sm font-semibold">{totalDocsCount} Tài liệu hữu ích</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl home-hero-stat-card">
              <Compass className="w-5 h-5 text-purple-400" />
              <span className="text-white text-xs sm:text-sm font-semibold">Tự học hiệu quả</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Document Grid (Hiển thị ngay dưới thanh tìm kiếm/Banner khi đang thực hiện tìm kiếm) ── */}
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
                      <div className="w-10 h-10 rounded-lg bg-[var(--bg-2)] flex items-center justify-center mb-2 group-hover:bg-[var(--brand-50)] transition-colors border border-[var(--border)]">
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
                  Tìm thấy <span className="font-bold home-text-fg2">{filteredSearchDocs.length}</span> tài liệu phù hợp
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeCategories.map((cat) => {
                  const docs = cat.documents;
                  const themeClass = getCategoryThemeClass(cat.id, cat.title);

                  return (
                    <div key={cat.id} className="home-category-card animate-fade-up">
                      <div className={`home-card-header-bg ${themeClass}`} />
                      <div className="home-card-header-wrapper">
                        <div className="home-card-icon-container">
                          <div className="min-w-0 flex-1">
                            <h3 className="home-card-title truncate text-xs font-bold">
                              {cat.title}
                            </h3>
                          </div>
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
                            className={`home-doc-item ${themeClass}`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <FileText className="w-4 h-4 text-[var(--muted)] shrink-0" />
                              <span className="home-doc-title truncate text-xs">
                                {doc.title}
                              </span>
                              {doc.premium && (
                                <span title="Tài liệu Premium"><Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" /></span>
                              )}
                            </div>
                            <ChevronRight className="w-4 h-4 text-[var(--meta)] shrink-0 transition-transform" />
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
                      <span className="font-bold text-[var(--fg)] truncate">{(useAuth().user as any)?.name || useAuth().profile?.full_name || "Học viên HOU"}</span>
                      
                      <span className="text-[var(--muted)] font-medium">Email:</span>
                      <span className="font-bold text-[var(--fg)] truncate">{useAuth().user?.email || "Chưa liên kết"}</span>
                      
                      <span className="text-[var(--muted)] font-medium">Quyền hạn:</span>
                      <span className="font-bold text-[var(--brand-600)]">
                        {!useAuth().user || useAuth().role === "guest"
                          ? "Khách vãng lai"
                          : useAuth().role === "admin"
                          ? "Quản trị viên"
                          : useAuth().role === "management"
                          ? "Quản lý"
                          : useAuth().role === "free"
                          ? "Học viên free"
                          : useAuth().role === "plus"
                          ? "Học viên Plus"
                          : useAuth().role === "pro"
                          ? "Học viên Pro"
                          : "Học viên Ultra"}
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
                    Chuyên mục đào tạo
                  </h3>
                  {groupedCategories[0] && (
                    <div className="flex items-center gap-1.5">
                      <Link 
                        to={`/categories/${groupedCategories[0].id}`}
                        className="p-1 rounded bg-[var(--bg-2)] hover:bg-[var(--bg-3)] cursor-pointer text-[var(--fg)] border-none flex items-center justify-center"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
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
                    <div className="text-[10px] text-[var(--muted)] mt-1">Đầy đủ quyền lợi học tập & tải tài liệu eHOU không giới hạn.</div>
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

export default HomePage;