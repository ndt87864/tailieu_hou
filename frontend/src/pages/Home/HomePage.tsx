import React, { useEffect, useState } from "react";
import apiClient from "../../services/client.js";
import { cachedGet } from "../../utils/apiCache.js";
import { SkeletonCard } from "../../components/common/LoadingSpinner.js";
import { useAuth } from "../../context/AuthContext.js";
import { useUI } from "../../context/UIContext.js";
import LessonHomePage from "./LessonHomePage.js";
import * as Icons from "lucide-react";
import "../../css/home.css";
import "../../css/lesson.css";

const { BookOpen, Search, FileText, ChevronRight, Filter, X, Crown, GraduationCap, Award, Compass } = Icons;

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
  const { loading: authLoading } = useAuth();

  if (lessonMode) {
    return <LessonHomePage />;
  }
  const [groupedCategories, setGroupedCategories] = useState<GroupedCategory[]>([]);
  const [allDocuments, setAllDocuments] = useState<Document[]>([]);
  const [allDocumentsLoaded, setAllDocumentsLoaded] = useState(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [expandedDocs, setExpandedDocs] = useState<Record<string, Document[]>>({});
  const [loadingCategory, setLoadingCategory] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (authLoading) return;
    cachedGet<{ categories: GroupedCategory[] }>("/api/v1/documents/grouped")
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

  useEffect(() => {
    if (search && !allDocumentsLoaded) {
      cachedGet<{ documents: Document[] }>("/api/v1/documents")
        .then(res => {
          setAllDocuments(res.data.documents || []);
          setAllDocumentsLoaded(true);
        })
        .catch(err => console.error("Failed to load all documents for search:", err));
    }
  }, [search, allDocumentsLoaded]);

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
  const isSearchActive = !!search;

  const filteredSearchDocs = allDocuments.filter((doc) => {
    const matchSearch =
      doc.title.toLowerCase().includes(search.toLowerCase()) ||
      doc.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = !selectedCategory || (doc.category_id || "other") === selectedCategory;
    return matchSearch && matchCat;
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
            <BookOpen className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            Học viện Tri thức & Ôn thi HOU
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight text-balance max-w-3xl leading-tight">
            Kho Tài Liệu Học Tập Chuẩn Hóa
          </h1>
          <p className="mt-4 text-sm sm:text-base md:text-lg text-white/80 max-w-2xl text-balance font-medium">
            Học tập thông minh hơn với ngân hàng đề thi chất lượng, tóm tắt lý thuyết trực quan và hệ thống bài tập thực hành phong phú.
          </p>

          {/* Search Box */}
          <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 w-full max-w-lg">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nhập tên tài liệu, môn học hoặc từ khóa cần tìm..."
                className="w-full pl-11 pr-10 py-3.5 rounded-xl text-white placeholder:text-white/50 text-sm focus:outline-none transition-all duration-250 home-hero-search-card"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/90 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Stats Bar */}
          <div className="mt-10 flex flex-wrap justify-center items-center gap-4 sm:gap-8">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl home-hero-stat-card">
              <GraduationCap className="w-5 h-5 text-teal-300" />
              <span className="text-white text-xs sm:text-sm font-semibold">{groupedCategories.length} Chuyên mục</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl home-hero-stat-card">
              <Award className="w-5 h-5 text-amber-300" />
              <span className="text-white text-xs sm:text-sm font-semibold">{totalDocsCount} Tài liệu hữu ích</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl home-hero-stat-card">
              <Compass className="w-5 h-5 text-purple-300" />
              <span className="text-white text-xs sm:text-sm font-semibold">Tự học hiệu quả</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Category Filter ── */}
      {categories.length > 1 && (
        <div className="flex items-center gap-2.5 mb-8 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`shrink-0 px-4 py-2.5 rounded-full text-xs font-bold transition-all duration-200 ${
              !selectedCategory ? "home-filter-btn-active" : "home-filter-btn-inactive"
            }`}
          >
            <Filter className="w-3.5 h-3.5 inline mr-1.5" />
            Tất cả danh mục
          </button>
          {categories.map((cat) => {
            const titleObj = uniqueCategoryMap[cat] || { title: "Chuyên mục", logo: null };
            const info = getCategoryInfo(cat, titleObj.title, titleObj.logo);
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(active ? null : cat)}
                className={`shrink-0 px-4 py-2.5 rounded-full text-xs font-bold transition-all duration-200 inline-flex items-center gap-1.5 ${
                  active ? "home-filter-btn-active" : "home-filter-btn-inactive"
                }`}
              >
                {info.icon(`w-4 h-4 ${active ? 'text-[var(--brand-700)]' : 'text-[var(--brand-600)]'}`)}
                {info.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Error State ── */}
      {error && (
        <div className="p-6 text-center animate-fade-in home-error-container mb-8">
          <p className="text-red-600 text-sm font-medium">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-3 text-xs text-red-500 hover:text-red-700 underline font-semibold">
            Thử tải lại trang
          </button>
        </div>
      )}

      {/* ── Loading Spinner ── */}
      {loading && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && !error && activeCategories.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
          <div className="w-20 h-20 flex items-center justify-center mb-5 home-empty-icon-wrapper shadow-sm">
            <FileText className="w-9 h-9 home-empty-icon text-[var(--muted)]" />
          </div>
          <h3 className="text-lg font-bold mb-1.5 home-empty-title">
            {!isSearchActive ? "Chưa có tài liệu nào" : "Không tìm thấy kết quả phù hợp"}
          </h3>
          <p className="text-sm max-w-md text-center home-empty-text">
            {!isSearchActive ? "Hệ thống đang tích cực cập nhật thêm tài liệu mới. Vui lòng quay lại sau." : "Hãy thử thay đổi bộ lọc, sử dụng từ khóa ngắn hơn hoặc kiểm tra lỗi chính tả."}
          </p>
          {search && (
            <button
              onClick={() => { setSearch(""); setSelectedCategory(null); }}
              className="mt-6 text-sm hover:opacity-80 font-bold transition-opacity home-text-brand"
            >
              Làm mới tìm kiếm
            </button>
          )}
        </div>
      )}

      {/* ── Document Grid ── */}
      {!loading && !error && activeCategories.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between mb-5">
            <p className="text-sm home-text-meta font-medium">
              Đang hiển thị <span className="font-bold home-text-fg2">{activeCategories.length}</span> chuyên mục học tập
              {search && <span className="home-text-meta"> cho kết quả tìm kiếm "<span className="home-bold home-text-fg2">{search}</span>"</span>}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeCategories.map((cat) => {
              const isExpanded = !!expandedCategories[cat.id];
              const isCatLoading = !!loadingCategory[cat.id];
              const docs = (isExpanded && expandedDocs[cat.id]) ? expandedDocs[cat.id] : cat.documents;
              
              const catInfo = getCategoryInfo(cat.id, cat.title, cat.logo);
              const showExpandButton = !isSearchActive && cat.total_count > 10;
              const themeClass = getCategoryThemeClass(cat.id, cat.title);

              return (
                <div key={cat.id} className="home-category-card animate-fade-up">
                  {/* Visual Theme Stripe */}
                  <div className={`home-card-header-bg ${themeClass}`} />

                  {/* Category Header */}
                  <div className="home-card-header-wrapper">
                    <div className="home-card-icon-container">
                      <div className={`home-card-icon-wrapper ${themeClass}`}>
                        {catInfo.icon("w-5 h-5")}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="home-card-title truncate">
                          {catInfo.label}
                        </h3>
                        <p className="home-card-meta">
                          {cat.total_count || docs.length} tài liệu học tập
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Document Items List */}
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
                          <span className="home-doc-title truncate">
                            {doc.title}
                          </span>
                          {doc.premium && (
                            <span title="Tài liệu Premium"><Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" /></span>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-[var(--meta)] shrink-0 transition-transform" />
                      </a>
                    ))}
                    {isCatLoading && (
                      <div className="text-center py-3 text-xs text-[var(--meta)] font-medium">
                        Đang tải danh sách tài liệu...
                      </div>
                    )}
                  </div>

                  {/* Expand / Collapse Button */}
                  {showExpandButton && (
                    <button
                      onClick={() => handleExpand(cat.id)}
                      disabled={isCatLoading}
                      className={`home-expand-btn ${isExpanded ? "home-expand-btn-expanded" : "home-expand-btn-collapsed"}`}
                    >
                      {isExpanded ? "Thu gọn danh mục" : `Xem tất cả ${cat.total_count} tài liệu`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;