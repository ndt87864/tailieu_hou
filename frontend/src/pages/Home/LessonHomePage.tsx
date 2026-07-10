import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.js";
import { cachedGet } from "../../utils/apiCache.js";
import { SkeletonCard } from "../../components/common/LoadingSpinner.js";
import { Search, GraduationCap, ArrowRight, BookOpenCheck, Crown } from "lucide-react";

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
  const { loading: authLoading } = useAuth();
  const [groupedCategories, setGroupedCategories] = useState<GroupedCategory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (authLoading) return;
    cachedGet<{ categories: GroupedCategory[] }>("/api/v1/documents/grouped/lms")
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

  // Lọc các chuyên mục từ dữ liệu đã lọc sẵn ở server
  const filteredCategories = useMemo(() => {
    return groupedCategories;
  }, [groupedCategories]);

  // Lọc và phẳng danh sách tài liệu để tìm kiếm dễ dàng
  const allDocs = useMemo(() => {
    return filteredCategories.flatMap(c => c.documents);
  }, [filteredCategories]);

  const filteredDocs = useMemo(() => {
    return allDocs.filter(doc => 
      doc.title.toLowerCase().includes(search.toLowerCase()) ||
      doc.description.toLowerCase().includes(search.toLowerCase())
    );
  }, [allDocs, search]);

  return (
    <div className="lesson-home-container">
      {/* Banner */}
      <section className="relative overflow-hidden rounded-3xl mb-8 home-hero-container">
        <div className="absolute inset-0 opacity-30 home-hero-mesh" />
        <div className="relative px-6 py-10 sm:px-10 sm:py-14 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full text-white/80 text-xs font-medium mb-5 home-hero-search-card">
            <BookOpenCheck className="w-3.5 h-3.5 text-emerald-400" />
            Không gian học tập & bài giảng LMS
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight max-w-2xl leading-tight">
            Bài Học & Tài Liệu LMS
          </h1>
          <p className="mt-4 text-base sm:text-lg text-white/70 max-w-xl">
            Học tập theo lộ trình chuẩn. Xem bài giảng slide, video học liệu và ôn tập bộ câu hỏi LMS trích xuất tự động.
          </p>
          <div className="mt-8 flex items-center w-full max-w-lg relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm môn học hoặc bài giảng..."
              className="w-full pl-10 pr-10 py-3 rounded-xl text-white placeholder:text-white/40 text-sm focus:outline-none transition-all duration-250 home-hero-stat-card"
            />
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="lesson-title-section">
        <h2 className="lesson-title">Chương trình học tập</h2>
        <p className="lesson-subtitle">Lựa chọn môn học dưới đây để bắt đầu bài học của bạn</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : error ? (
        <div className="doc-error-message">{error}</div>
      ) : search ? (
        // Hiển thị kết quả tìm kiếm phẳng
        filteredDocs.length > 0 ? (
          <div className="lesson-grid">
            {filteredDocs.map((doc) => (
              <div key={doc.id} className="lesson-card">
                {doc.premium && (
                  <div className="absolute top-3 right-3 text-amber-500" title="Tài liệu Premium">
                    <Crown className="w-4 h-4 fill-amber-500" />
                  </div>
                )}
                <div className="lesson-card-header">
                  <div className="lesson-card-icon-wrapper">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--muted)]">
                    {doc.category?.title || "Môn học"}
                  </span>
                </div>
                <h3 className="lesson-card-title">{doc.title}</h3>
                <p className="lesson-card-desc">{doc.description || "Tài liệu học tập, slide bài giảng và bộ câu hỏi trắc nghiệm LMS trực tuyến."}</p>
                
                <div className="lesson-card-footer">
                  <span className="lesson-badge lesson-badge-lms">
                    <BookOpenCheck className="w-3.5 h-3.5" />
                    LMS Active
                  </span>
                  <Link to={`/documents/${doc.id}`} className="lesson-card-link">
                    Vào học <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-[var(--muted)]">
            Không tìm thấy môn học nào khớp với từ khóa "{search}".
          </div>
        )
      ) : (
        // Hiển thị theo từng Chuyên mục
        <div className="space-y-10">
          {filteredCategories.map((category) => (
            <div key={category.id} className="space-y-4">
              <div className="flex items-center gap-2 border-b border-dashed border-[var(--border)] pb-2">
                <div className="w-1.5 h-6 bg-[var(--brand-600)] rounded-full" />
                <h3 className="text-lg font-extrabold text-[var(--fg)]">{category.title}</h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--bg-2)] text-[var(--muted)]">
                  {category.documents.length} môn học
                </span>
              </div>

              <div className="lesson-grid">
                {category.documents.map((doc) => (
                  <div key={doc.id} className="lesson-card">
                    {doc.premium && (
                      <div className="absolute top-3 right-3 text-amber-500" title="Tài liệu Premium">
                        <Crown className="w-4 h-4 fill-amber-500" />
                      </div>
                    )}
                    <div className="lesson-card-header">
                      <div className="lesson-card-icon-wrapper">
                        <GraduationCap className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--muted)]">
                        {category.title}
                      </span>
                    </div>
                    <h3 className="lesson-card-title">{doc.title}</h3>
                    <p className="lesson-card-desc">{doc.description || "Tài liệu học tập, slide bài giảng và bộ câu hỏi trắc nghiệm LMS trực tuyến."}</p>
                    
                    <div className="lesson-card-footer">
                      <span className="lesson-badge lesson-badge-lms">
                        <BookOpenCheck className="w-3.5 h-3.5" />
                        LMS Active
                      </span>
                      <Link to={`/documents/${doc.id}`} className="lesson-card-link">
                        Vào học <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LessonHomePage;
