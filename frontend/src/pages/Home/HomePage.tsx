import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../../services/client.js";
import { SkeletonCard } from "../../components/common/LoadingSpinner.js";
import { BookOpen, Search, FileText, Clock, ChevronRight, Filter, X } from "lucide-react";

interface Document {
  id: string;
  title: string;
  description: string;
  category_id: string;
  created_at: string;
}

const CATEGORIES: Record<string, { label: string; icon: string }> = {
  exam: { label: "Đề thi", icon: "📝" },
  theory: { label: "Lý thuyết", icon: "📖" },
  practice: { label: "Bài tập", icon: "✏️" },
  other: { label: "Khác", icon: "📄" },
};

const HomePage: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get("/api/v1/documents")
      .then((res) => {
        setDocuments(res.data.documents || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Không thể tải danh sách tài liệu.");
        setLoading(false);
      });
  }, []);

  const categories = Array.from(new Set(documents.map((d) => d.category_id || "other")));

  const filtered = documents.filter((doc) => {
    const matchSearch =
      !search ||
      doc.title.toLowerCase().includes(search.toLowerCase()) ||
      doc.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = !selectedCategory || (doc.category_id || "other") === selectedCategory;
    return matchSearch && matchCat;
  });

  const timeAgo = (dateStr: string) => {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = now - then;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Vừa xong";
    if (mins < 60) return `${mins} phút trước`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} giờ trước`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days} ngày trước`;
    return new Date(dateStr).toLocaleDateString("vi-VN");
  };

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-hero mb-8">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-40" />
        <div className="relative px-6 py-10 sm:px-10 sm:py-14 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/10 border border-white/10 text-white/80 text-xs font-medium mb-5 backdrop-blur-sm">
            <BookOpen className="w-3.5 h-3.5" />
            Nền tảng ôn thi trực tuyến
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight text-balance max-w-2xl leading-tight">
            Kho Tài Liệu Học Tập & Ôn Thi
          </h1>
          <p className="mt-4 text-base sm:text-lg text-indigo-200 max-w-xl text-balance">
            Truy cập bộ sưu tập đề thi, tài liệu ôn tập chất lượng cao dành cho sinh viên HOU. Học mọi lúc, mọi nơi.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 w-full max-w-lg">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm kiếm tài liệu..."
                className="w-full pl-10 pr-10 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-white/40 text-sm focus:outline-none focus:bg-white/15 focus:border-white/20 transition-all duration-250 backdrop-blur-sm"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Category Filter */}
      {categories.length > 1 && (
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-250 ${
              !selectedCategory
                ? "bg-brand-600 text-white shadow-sm"
                : "bg-white border border-gray-200 text-gray-600 hover:border-brand-200 hover:text-brand-600"
            }`}
          >
            <Filter className="w-3 h-3 inline mr-1.5" />
            Tất cả
          </button>
          {categories.map((cat) => {
            const info = CATEGORIES[cat] ?? { label: cat, icon: "📄" };
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                className={`shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-250 ${
                  selectedCategory === cat
                    ? "bg-brand-600 text-white shadow-sm"
                    : "bg-white border border-gray-200 text-gray-600 hover:border-brand-200 hover:text-brand-600"
                }`}
              >
                <span className="mr-1">{info.icon}</span>
                {info.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center animate-fade-in">
          <p className="text-red-600 text-sm font-medium">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 text-xs text-red-500 hover:text-red-700 underline"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
          <div className="w-16 h-16 rounded-3xl bg-gray-100 flex items-center justify-center mb-4">
            <FileText className="w-7 h-7 text-gray-300" />
          </div>
          <h3 className="text-base font-semibold text-gray-600 mb-1">
            {documents.length === 0 ? "Chưa có tài liệu nào" : "Không tìm thấy tài liệu"}
          </h3>
          <p className="text-sm text-gray-400 max-w-xs text-center">
            {documents.length === 0
              ? "Hệ thống đang cập nhật tài liệu. Vui lòng quay lại sau."
              : "Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm."}
          </p>
          {search && (
            <button
              onClick={() => { setSearch(""); setSelectedCategory(null); }}
              className="mt-4 text-sm text-brand-600 hover:text-brand-700 font-medium"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      )}

      {/* Document Grid */}
      {!loading && !error && filtered.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between mb-4">
            <p className="text-sm text-gray-400">
              Hiển thị <span className="font-semibold text-gray-600">{filtered.length}</span> tài liệu
              {search && <span className="text-gray-400"> — kết quả cho "<span className="text-gray-600">{search}</span>"</span>}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((doc, i) => {
              const catInfo = CATEGORIES[doc.category_id] ?? CATEGORIES.other;
              return (
                <Link
                  key={doc.id}
                  to={`/documents/${doc.id}`}
                  className="group bg-white rounded-2xl border border-gray-100 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 p-5 flex flex-col transition-all duration-250 animate-fade-up"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0 text-lg">
                      {catInfo.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 group-hover:text-brand-600 transition-colors duration-200">
                        {doc.title}
                      </h3>
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 line-clamp-2 mb-4 flex-1 leading-relaxed">
                    {doc.description}
                  </p>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                    <div className="flex items-center gap-1.5 text-2xs text-gray-400">
                      <Clock className="w-3 h-3" />
                      <span>{timeAgo(doc.created_at)}</span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 group-hover:gap-1.5 transition-all duration-200">
                      Vào ôn thi
                      <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;