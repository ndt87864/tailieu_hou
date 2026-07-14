import React, { useEffect, useState, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import apiClient from "../../services/client.js";
import * as Icons from "lucide-react";
import { useUI } from "../../context/UIContext.js";

const { GraduationCap, ChevronRight, ChevronLeft, X, Search } = Icons;

interface Document {
  id: string;
  title: string;
  category_id?: string | null;
}

interface SidebarCategory {
  id: string;
  title: string;
  logo?: string | null;
  stt?: number | null;
  documents: Document[];
}

interface DocumentSidebarProps {
  currentDocId?: string;
  isContactPage?: boolean;
}

export const DocumentSidebar: React.FC<DocumentSidebarProps> = ({
  currentDocId,
  isContactPage = false,
}) => {
  const { lessonMode } = useUI();
  const location = useLocation();
  const [sidebarCategories, setSidebarCategories] = useState<SidebarCategory[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored !== null) return stored === "true";
    return window.innerWidth < 1024;
  });
  const [isHovered, setIsHovered] = useState(false);
  const [tempDisableHover, setTempDisableHover] = useState(false);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      if (next) {
        setTempDisableHover(true);
      }
      return next;
    });
    setIsHovered(false);
  };

  useEffect(() => {
    const apiPath = lessonMode 
      ? "/api/v1/documents/categories?lms=true" 
      : "/api/v1/documents/categories";

    apiClient.get<{ categories: SidebarCategory[] }>(apiPath)
      .then((res) => {
        const cats: SidebarCategory[] = res.data.categories || [];
        setSidebarCategories(cats);
      })
      .catch((err) => {
        console.error("Lỗi khi tải danh mục sidebar:", err);
      });
  }, [lessonMode]);

  useEffect(() => {
    const handleOpenSidebar = () => setMobileOpen(true);
    window.addEventListener("open-doc-sidebar", handleOpenSidebar);
    return () => window.removeEventListener("open-doc-sidebar", handleOpenSidebar);
  }, []);

  const [currentCategoryId, setCurrentCategoryId] = useState<string | null>(null);

  useEffect(() => {
    const matchCat = location.pathname.match(/\/categories\/([^/]+)/);
    if (matchCat) {
      setCurrentCategoryId(matchCat[1]);
    } else if (currentDocId) {
      apiClient.get<{ document: any }>(`/api/v1/documents/${currentDocId}`)
        .then((res) => {
          if (res.data.document) {
            setCurrentCategoryId(res.data.document.category_id);
          }
        })
        .catch((err) => {
          console.error("Lỗi lấy thông tin tài liệu cho sidebar:", err);
        });
    } else {
      setCurrentCategoryId(null);
    }
  }, [location.pathname, currentDocId]);

  const activeCategoryId = currentCategoryId;

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
      } else if (normalized.includes("thuyết") || normalized.includes("sách") || normalized.includes("tài liệu")) {
        icon = (className: string) => <Icons.Book className={className} />;
      }
    }
    return { label: title, icon };
  };

  return (
    <>
      {/* Mobile Sidebar Drawer */}
      {mobileOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 z-[60] md:hidden backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div 
            className="fixed inset-y-0 left-0 w-72 z-[70] md:hidden shadow-2xl flex flex-col animate-slide-right doc-brand-header"
          >
            <div className="p-4 flex items-center justify-between border-b doc-border-brand shrink-0">
              <Link to="/" className="font-bold flex items-center gap-2 text-white hover:opacity-80 transition-opacity">
                <GraduationCap className="w-5 h-5 text-white" /> Tài liệu HOU
              </Link>
              <button onClick={() => setMobileOpen(false)} className="p-1 rounded text-white/80 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-24">
              {sidebarCategories.map((cat) => {
                const isActive = activeCategoryId === cat.id;
                const catInfo = getCategoryInfo(cat.id, cat.title, cat.logo);
                return (
                  <Link
                    key={cat.id}
                    to={`/categories/${cat.id}`}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center justify-between p-3 rounded-xl transition-colors text-left ${
                      isActive 
                        ? "text-white font-bold bg-[rgba(255,255,255,0.15)] doc-sidebar-item-active" 
                        : "text-white/70 hover:text-white hover:bg-[rgba(255,255,255,0.08)]"
                    }`}
                  >
                    <span className="font-semibold text-sm truncate flex items-center gap-3">
                      {catInfo.icon("w-5 h-5 shrink-0")}
                      {cat.title}
                    </span>
                    <ChevronRight className="w-4 h-4 text-white/50" />
                  </Link>
                );
              })}

              <Link
                to="/pricing"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 p-3 rounded-xl text-sm transition-colors mt-2 ${
                  isContactPage
                    ? "text-white font-bold bg-[rgba(255,255,255,0.15)] doc-sidebar-item-active"
                    : "text-white/70 hover:bg-[rgba(255,255,255,0.08)]"
                }`}
              >
                <Icons.Phone className="w-5 h-5 shrink-0" />
                <span className="font-semibold">Liên hệ</span>
              </Link>
            </div>
          </div>
        </>
      )}

      {/* Desktop Layout Spacer (ngăn dịch chuyển layout khi hover sidebar) */}
      <div 
        className={`hidden md:block shrink-0 transition-all duration-300 ${isCollapsed ? "w-16" : "w-64"}`} 
      />

      {/* Unified Desktop Sidebar with Hover Expand (Lenovo Vantage Style) */}
      <div 
        onMouseEnter={() => {
          if (!tempDisableHover && window.matchMedia("(hover: hover)").matches) {
            setIsHovered(true);
          }
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          setTempDisableHover(false);
        }}
        className={`hidden md:flex flex-col border-r border-white/10 fixed top-0 bottom-0 left-0 z-[60] transition-all duration-300 doc-brand-header ${
          isCollapsed 
            ? isHovered 
              ? "w-64 shadow-2xl" 
              : "w-16" 
            : "w-64"
        }`}
      >
        {/* Header của Sidebar */}
        <div className="p-4 pb-0 shrink-0">
          <div className="flex items-center justify-between border-b border-white/10 mb-4 pb-2 h-10 overflow-hidden">
            <Link 
              to="/"
              className={`flex items-center gap-2.5 font-bold text-base text-white hover:opacity-80 transition-opacity ${
                !isCollapsed || isHovered ? "opacity-100" : "opacity-0 w-0 pointer-events-none"
              }`}
            >
              <GraduationCap className="w-5 h-5 text-white" />
              <span className="truncate">Tài liệu HOU</span>
            </Link>
            
            {/* Nút Toggle cứng (Cố định ở bên phải khi mở rộng, hoặc nằm giữa khi thu gọn) */}
            <button
              onClick={toggleCollapse}
              className={`p-1.5 rounded-lg text-white/75 hover:text-white hover:bg-[rgba(255,255,255,0.08)] transition-all ${
                isCollapsed && !isHovered ? "mx-auto" : ""
              }`}
              title={isCollapsed ? "Mở rộng sidebar" : "Thu nhỏ sidebar"}
            >
              {isCollapsed ? (
                isHovered ? <ChevronLeft className="w-4 h-4" /> : <Icons.Menu className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Danh sách Chuyên mục */}
        <div className={`flex-1 overflow-y-auto px-2 space-y-2 py-2 scrollbar-thin ${isCollapsed && !isHovered ? "flex flex-col items-center" : ""}`}>
          {sidebarCategories.map((cat) => {
            const isActive = activeCategoryId === cat.id;
            const catInfo = getCategoryInfo(cat.id, cat.title, cat.logo);
            
            if (isCollapsed && !isHovered) {
              return (
                <Link 
                  key={cat.id} 
                  to={`/categories/${cat.id}`}
                  title={cat.title}
                  className={`w-11 h-11 rounded-xl flex items-center justify-center text-white/90 hover:bg-[rgba(255,255,255,0.08)] transition-colors ${
                    isActive ? "bg-[rgba(255,255,255,0.15)] text-white shadow-sm" : ""
                  }`}
                >
                  {catInfo.icon("w-5 h-5")}
                </Link>
              );
            }

            return (
              <Link
                key={cat.id}
                to={`/categories/${cat.id}`}
                className={`flex items-center justify-between p-3 rounded-xl transition-all w-full text-left ${
                  isActive 
                    ? "text-white font-bold bg-[rgba(255,255,255,0.15)] border-l-2 border-white doc-sidebar-item-active" 
                    : "text-white/70 hover:text-white hover:bg-[rgba(255,255,255,0.08)]"
                }`}
              >
                <span className="font-semibold text-xs truncate flex items-center gap-2.5">
                  {catInfo.icon("w-4.5 h-4.5 shrink-0")}
                  {cat.title}
                </span>
                <ChevronRight className="w-3.5 h-3.5 opacity-50 shrink-0" />
              </Link>
            );
          })}
        </div>

        {/* Nút Liên hệ ở dưới cùng */}
        <div className="p-2 border-t border-white/10 shrink-0">
          {isCollapsed && !isHovered ? (
            <Link
              to="/pricing"
              title="Liên hệ"
              className={`w-12 h-12 rounded-xl flex items-center justify-center text-white/90 hover:bg-[rgba(255,255,255,0.08)] transition-colors mx-auto ${
                isContactPage ? "bg-[rgba(255,255,255,0.15)] text-white" : ""
              }`}
            >
              <Icons.Phone className="w-5 h-5" />
            </Link>
          ) : (
            <Link
              to="/pricing"
              className={`flex items-center gap-2.5 p-3 rounded-xl text-xs transition-colors w-full text-left ${
                isContactPage
                  ? "text-white font-bold bg-[rgba(255,255,255,0.15)] border-l-2 border-white doc-sidebar-item-active"
                  : "text-white/70 hover:bg-[rgba(255,255,255,0.08)]"
              }`}
            >
              <Icons.Phone className="w-4.5 h-4.5 shrink-0" />
              <span className="font-semibold">Liên hệ</span>
            </Link>
          )}
        </div>
      </div>
    </>
  );
};

export default DocumentSidebar;
