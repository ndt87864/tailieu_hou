import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useUI } from "../../context/UIContext.js";
import { useAuth } from "../../context/AuthContext.js";
import apiClient from "../../services/client.js";
import LoadingSpinner from "../../components/common/LoadingSpinner.js";
import { Header } from "../../components/layout/Layout.js";
import * as Icons from "lucide-react";
import "../../css/document.css";

interface Document {
  id: string;
  title: string;
  description: string;
  premium?: boolean;
  active?: boolean;
  courses_count?: number;
  resources_count?: number;
  questions_count?: number;
}

interface CategoryInfo {
  id: string;
  title: string;
  logo?: string | null;
  documents: Document[];
}

const CategoryPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { lessonMode, setPageLoading } = useUI();
  const { role } = useAuth();
  
  const [category, setCategory] = useState<CategoryInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setPageLoading(true);
    
    const apiPath = `/api/v1/documents/categories/${id}${lessonMode ? "?lms=true" : ""}`;

    apiClient.get<{ category: CategoryInfo }>(apiPath)
      .then((res) => {
        const cat = res.data.category;
        if (cat) {
          setCategory(cat);
        } else {
          setError("Không tìm thấy danh mục yêu cầu.");
        }
        setLoading(false);
        setPageLoading(false);
      })
      .catch((err) => {
        console.error("Lỗi tải danh mục:", err);
        setError("Có lỗi xảy ra khi tải dữ liệu.");
        setLoading(false);
        setPageLoading(false);
      });
  }, [id, lessonMode, setPageLoading]);

  const filteredDocs = useMemo(() => {
    if (!category) return [];
    let docs = category.documents || [];
    // Chỉ hiển thị các doc active
    docs = docs.filter(d => d.active !== false);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      docs = docs.filter(d => d.title.toLowerCase().includes(q) || d.description.toLowerCase().includes(q));
    }
    return docs;
  }, [category, searchQuery]);

  const getCategoryIcon = (logoName?: string | null, title?: string) => {
    let icon = <Icons.BookOpen className="w-8 h-8 text-[var(--brand-600)]" />;
    if (logoName) {
      const IconComponent = (Icons as any)[logoName];
      if (IconComponent) {
        icon = <IconComponent className="w-8 h-8 text-[var(--brand-600)]" />;
      }
    } else if (title) {
      const normalized = title.toLowerCase();
      if (normalized.includes("thi") || normalized.includes("khảo sát") || normalized.includes("đề")) {
        icon = <Icons.GraduationCap className="w-8 h-8 text-[var(--brand-600)]" />;
      } else if (normalized.includes("thuyết") || normalized.includes("sách") || normalized.includes("tài liệu")) {
        icon = <Icons.Book className="w-8 h-8 text-[var(--brand-600)]" />;
      }
    }
    return icon;
  };

  if (loading && !category) return <LoadingSpinner />;
  if (error || !category) {
    return (
      <div className="flex-1 min-w-0 w-full flex flex-col doc-main-bg">
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="text-center space-y-3">
            <p className="text-sm doc-text-muted">{error || "Danh mục không tồn tại."}</p>
            <Link to="/" className="text-xs text-[var(--accent)] hover:underline">← Về trang chủ</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 w-full flex flex-col doc-main-bg">
      <Header
        title={category.title}
        subtitle="Danh mục tài liệu"
        hideLogo={true}
        showSubjectSearch={true}
        onMobileMenuClick={() => window.dispatchEvent(new Event("open-doc-sidebar"))}
        onOpenSettings={() => window.dispatchEvent(new Event("open-settings"))}
        onOpenProfile={() => window.dispatchEvent(new Event("open-profile"))}
      />
      <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border-soft)]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[var(--bg-2)] flex items-center justify-center shadow-sm">
              {getCategoryIcon(category.logo, category.title)}
            </div>
            <div>
              <h1 className="text-xl font-bold doc-text-fg">{category.title}</h1>
              <p className="text-xs doc-text-muted">Tổng số {filteredDocs.length} tài liệu học tập</p>
            </div>
          </div>

          {/* Search within category */}
          <div className="relative w-full md:w-72">
            <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 doc-text-meta" />
            <input
              type="text"
              placeholder="Tìm kiếm môn học trong danh mục..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border text-xs focus:outline-none focus:ring-1 focus:ring-[var(--accent)] doc-card-themed"
            />
          </div>
        </div>

        {/* Documents Bento Grid */}
        {filteredDocs.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-[var(--border)] rounded-3xl bg-[var(--surface-2)]/50 backdrop-blur-sm space-y-4">
            <div className="w-16 h-16 rounded-full bg-[var(--bg-2)] flex items-center justify-center mx-auto shadow-inner">
              <Icons.FolderOpen className="w-8 h-8 text-[var(--muted)]" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold doc-text-fg">Danh mục đang trống</p>
              <p className="text-xs doc-text-muted">Chưa có tài liệu nào được xuất bản trong danh mục này.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDocs.map((doc, idx) => {
              return (
                <Link
                  key={doc.id}
                  to={`/documents/${doc.id}`}
                  className="flex flex-col p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--brand-600)] hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden doc-card-animated"
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  {/* Subtle Background Glow on Hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[var(--brand-600)]/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                  <div className="flex items-start justify-between gap-4 mb-4 relative z-10">
                    <div className="w-11 h-11 rounded-xl bg-[var(--bg-2)] flex items-center justify-center group-hover:bg-[var(--brand-600)] group-hover:text-white transition-all duration-300 shadow-sm shrink-0">
                      <Icons.FileText className="w-5.5 h-5.5 text-[var(--brand-600)] group-hover:text-white transition-colors duration-300" />
                    </div>
                    {doc.premium && (
                      <span className="flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-amber-600 border border-amber-500/20 shadow-sm backdrop-blur-sm">
                        <Icons.Crown className="w-3 h-3 text-amber-500 fill-amber-500" />
                        Premium
                      </span>
                    )}
                  </div>

                  <div className="flex-1 space-y-2 relative z-10">
                    <h3 className="font-bold text-sm md:text-base doc-text-fg group-hover:text-[var(--brand-600)] transition-colors duration-300 line-clamp-2 leading-snug">
                      {doc.title}
                    </h3>
                    <p className="text-xs doc-text-muted line-clamp-3 leading-relaxed">
                      {doc.description || "Chưa có mô tả chi tiết cho môn học này."}
                    </p>
                  </div>

                  {/* Metadata Indicators Section */}
                  {(lessonMode || (typeof doc.questions_count === "number" && doc.questions_count > 0)) && (
                    <div className="mt-5 pt-3.5 border-t border-[var(--border-soft)] flex flex-wrap items-center gap-2 relative z-10">
                      {lessonMode && typeof doc.resources_count === "number" && doc.resources_count > 0 && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-[var(--bg-2)] text-[var(--brand-700)] border border-[var(--border-soft)] shadow-sm">
                          <Icons.FileDown className="w-3.5 h-3.5 text-[var(--brand-600)]" />
                          <span>{doc.resources_count} bài giảng</span>
                        </div>
                      )}
                      {typeof doc.questions_count === "number" && doc.questions_count > 0 && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-[var(--bg-2)] text-[var(--brand-700)] border border-[var(--border-soft)] shadow-sm">
                          <Icons.HelpCircle className="w-3.5 h-3.5 text-[var(--brand-600)]" />
                          <span>{doc.questions_count} câu hỏi</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Elegant Call to Action footer */}
                  <div className="mt-5 pt-3 border-t border-[var(--border-soft)] flex items-center justify-between text-xs text-[var(--brand-600)] font-bold relative z-10">
                    <span className="group-hover:translate-x-0.5 transition-transform duration-300">Làm bài ngay</span>
                    <div className="w-6 h-6 rounded-full bg-[var(--bg-2)] group-hover:bg-[var(--brand-600)] flex items-center justify-center transition-colors duration-300">
                      <Icons.ArrowRight className="w-3.5 h-3.5 text-[var(--brand-600)] group-hover:text-white transform group-hover:translate-x-0.5 transition-all duration-300" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryPage;
