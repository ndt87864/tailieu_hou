import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { cachedGet } from "../../utils/apiCache.js";
import { SkeletonCard } from "../../components/common/LoadingSpinner.js";
import * as Icons from "lucide-react";
import "../../css/home.css";

const { BookOpen, Search, FileText, ChevronRight, Filter, X } = Icons;

interface Document {
  id: string;
  title: string;
  description: string;
  category_id: string;
  created_at: string;
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
  const [groupedCategories, setGroupedCategories] = useState<GroupedCategory[]>([]);
  const [allDocuments, setAllDocuments] = useState<Document[]>([]);
  const [allDocumentsLoaded, setAllDocumentsLoaded] = useState(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Track expanded state of category cards
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  // Cache fully loaded documents per category
  const [expandedDocs, setExpandedDocs] = useState<Record<string, Document[]>>({});
  const [loadingCategory, setLoadingCategory] = useState<Record<string, boolean>>({});

  useEffect(() => {
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
  }, []);

  // Fetch all documents on-demand when user is searching
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

  // Load full list for a specific category when expanded
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
      if (catId === "exam") {
        icon = (className: string) => <Icons.GraduationCap className={className} />;
      } else if (catId === "theory") {
        icon = (className: string) => <Icons.Book className={className} />;
      } else if (catId === "practice") {
        icon = (className: string) => <Icons.PenTool className={className} />;
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
    }

    return { label: title, icon };
  };

  // Derive categories list from loaded groupedCategories
  const uniqueCategoryMap = groupedCategories.reduce((acc, cat) => {
    acc[cat.id] = { title: cat.title, logo: cat.logo };
    return acc;
  }, {} as Record<string, { title: string; logo?: string | null }>);

  const categories = Object.keys(uniqueCategoryMap);

  // Compute displayed list depending on search status
  const isSearchActive = !!search;

  // Filter for search mode
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

  // Filtered categories for normal mode
  const normalGroupedCategories = groupedCategories.filter(
    cat => !selectedCategory || cat.id === selectedCategory
  );

  const activeCategories = isSearchActive ? searchGroupedCategories : normalGroupedCategories;

  return (
    <div>
      {/* ── Hero ── */}
      <section
        className="relative overflow-hidden rounded-3xl mb-8 home-hero-container"
      >
        <div className="absolute inset-0 opacity-30 home-hero-mesh"
        />
        <div className="relative px-6 py-10 sm:px-10 sm:py-14 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full text-white/80 text-xs font-medium mb-5 home-hero-search-card">
            <BookOpen className="w-3.5 h-3.5" />
            Nền tảng ôn thi trực tuyến
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight text-balance max-w-2xl leading-tight">
            Kho Tài Liệu Học Tập & Ôn Thi
          </h1>
          <p className="mt-4 text-base sm:text-lg text-white/70 max-w-xl text-balance">
            Truy cập bộ sưu tập đề thi, tài liệu ôn tập chất lượng cao dành cho sinh viên HOU. Học mọi lúc, mọi nơi.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 w-full max-w-lg">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm kiếm tài liệu..."
                className="w-full pl-10 pr-10 py-3 rounded-xl text-white placeholder:text-white/40 text-sm focus:outline-none transition-all duration-250 home-hero-stat-card"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Category Filter ── */}
      {categories.length > 1 && (
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-250 ${
              !selectedCategory ? "home-filter-btn-active" : "home-filter-btn-inactive"
            }`}
          >
            <Filter className="w-3 h-3 inline mr-1.5" />
            Tất cả
          </button>
          {categories.map((cat) => {
            const titleObj = uniqueCategoryMap[cat] || { title: "Chuyên mục", logo: null };
            const info = getCategoryInfo(cat, titleObj.title, titleObj.logo);
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(active ? null : cat)}
                className={`shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-250 inline-flex items-center gap-1.5 ${
                  active ? "home-filter-btn-active" : "home-filter-btn-inactive"
                }`}
              >
                {info.icon(`w-3.5 h-3.5 ${active ? 'text-white' : 'text-[var(--brand-600)]'}`)}
                {info.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="p-6 text-center animate-fade-in home-error-container">
          <p className="text-red-600 text-sm font-medium">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-3 text-xs text-red-500 hover:text-red-700 underline">
            Thử lại
          </button>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* ── Empty ── */}
      {!loading && !error && activeCategories.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
          <div className="w-16 h-16 flex items-center justify-center mb-4 home-empty-icon-wrapper">
            <FileText className="w-7 h-7 home-empty-icon" />
          </div>
          <h3 className="text-base font-semibold mb-1 home-empty-title">
            {!isSearchActive ? "Chưa có tài liệu nào" : "Không tìm thấy tài liệu"}
          </h3>
          <p className="text-sm max-w-xs text-center home-empty-text">
            {!isSearchActive ? "Hệ thống đang cập nhật tài liệu. Vui lòng quay lại sau." : "Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm."}
          </p>
          {search && (
            <button
              onClick={() => { setSearch(""); setSelectedCategory(null); }}
              className="mt-4 text-sm hover:opacity-80 font-medium transition-opacity home-text-brand"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      )}

      {/* ── Document Grid ── */}
      {!loading && !error && activeCategories.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between mb-4">
            <p className="text-sm home-text-meta">
              Hiển thị <span className="font-semibold home-text-fg2">{activeCategories.length}</span> chuyên mục
              {search && <span className="home-text-meta"> — kết quả tìm kiếm cho "<span className="home-text-fg2">{search}</span>"</span>}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeCategories.map((cat) => {
              const isExpanded = !!expandedCategories[cat.id];
              const isCatLoading = !!loadingCategory[cat.id];
              
              // If expanded, use cached full docs, otherwise use the preview/search documents
              const docs = (isExpanded && expandedDocs[cat.id]) ? expandedDocs[cat.id] : cat.documents;
              
              const catInfo = getCategoryInfo(cat.id, cat.title, cat.logo);
              const showExpandButton = !isSearchActive && cat.total_count > 10;

              return (
                <div
                  key={cat.id}
                  className="card flex flex-col animate-fade-up p-6 home-category-card"
                >
                  {/* Category Header */}
                  <div className="flex items-center gap-3 mb-4 pb-3 home-card-header">
                    <div
                      className="w-10 h-10 flex items-center justify-center shrink-0 home-card-icon-wrapper"
                    >
                      {catInfo.icon("w-5 h-5 text-[var(--brand-600)]")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-base leading-snug home-card-title">
                        {catInfo.label}
                      </h3>
                      <p className="text-xs home-card-meta">
                        {cat.total_count || docs.length} tài liệu
                      </p>
                    </div>
                  </div>

                  {/* Category Body (Documents) */}
                  <div className="flex-1 flex flex-col gap-1.5 mb-4">
                    {docs.map((doc) => (
                      <Link
                        key={doc.id}
                        to={`/documents/${doc.id}`}
                        className="group/item flex items-center justify-between p-2.5 rounded-xl hover:bg-[var(--bg-2)] transition-colors duration-200 home-border-transparent"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <FileText className="w-4 h-4 text-[var(--muted)] group-hover/item:text-[var(--brand-600)] shrink-0 transition-colors" />
                          <span className="text-sm text-[var(--fg-2)] group-hover/item:text-[var(--brand-600)] font-medium truncate transition-colors">
                            {doc.title}
                          </span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[var(--meta)] opacity-0 group-hover/item:opacity-100 group-hover/item:translate-x-0.5 transition-all shrink-0 duration-200" />
                      </Link>
                    ))}
                    {isCatLoading && (
                      <div className="text-center py-2 text-xs text-[var(--meta)]">Đang tải tài liệu...</div>
                    )}
                  </div>

                  {/* Expand/Collapse Button */}
                  {showExpandButton && (
                    <button
                      onClick={() => handleExpand(cat.id)}
                      disabled={isCatLoading}
                      className={`mt-auto w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-center border transition-all duration-200 home-expand-btn ${
                        isExpanded ? "home-expand-btn-expanded" : "home-expand-btn-collapsed"
                      }`}
                    >
                      {isExpanded ? "Thu gọn" : `Xem tất cả (${cat.total_count} tài liệu)`}
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