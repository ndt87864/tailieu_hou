import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../../services/client.js";
import * as Icons from "lucide-react";

const { BookOpen, ChevronDown, ChevronRight, ChevronLeft, X, Crown } = Icons;

interface Document {
  id: string;
  title: string;
  description: string;
  premium?: boolean;
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

interface DocumentSidebarProps {
  currentDocId?: string;
  isContactPage?: boolean;
}

export const DocumentSidebar: React.FC<DocumentSidebarProps> = ({
  currentDocId,
  isContactPage: _isContactPage = false,
}) => {
  const [sidebarCategories, setSidebarCategories] = useState<SidebarCategory[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeTabletPopover, setActiveTabletPopover] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored !== null) return stored === "true";
    return window.innerWidth < 1024;
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  useEffect(() => {
    apiClient.get<{ categories: SidebarCategory[] }>("/api/v1/documents/grouped?full=true")
      .then((res) => {
        const cats: SidebarCategory[] = res.data.categories || [];
        setSidebarCategories(cats);
      })
      .catch((err) => {
        console.error("Lỗi khi tải danh mục sidebar:", err);
      });
  }, []);

  useEffect(() => {
    if (currentDocId && sidebarCategories.length > 0) {
      const activeCat = sidebarCategories.find((cat) =>
        cat.documents.some((d) => d.id === currentDocId)
      );
      if (activeCat) {
        setExpandedCategories((prev) => ({ ...prev, [activeCat.id]: true }));
      }
    }
  }, [currentDocId, sidebarCategories]);

  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveTabletPopover(null);
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  useEffect(() => {
    const handleOpenSidebar = () => setMobileOpen(true);
    window.addEventListener("open-doc-sidebar", handleOpenSidebar);
    return () => window.removeEventListener("open-doc-sidebar", handleOpenSidebar);
  }, []);

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

    return { label: title, icon };
  };

  return (
    <>
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
                <BookOpen className="w-5 h-5 text-white" /> Tài liệu HOU
              </Link>
              <button onClick={() => setMobileOpen(false)} className="p-1 rounded text-white/80 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
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
                          const isActive = d.id === currentDocId;
                          return (
                            <Link
                              key={d.id}
                              to={`/documents/${d.id}`}
                              onClick={() => setMobileOpen(false)}
                              className={`block p-2 rounded-md text-xs transition-all ${
                                isActive ? "text-white font-bold doc-sidebar-item-active" : "text-white/70 hover:text-white hover:bg-[rgba(255,255,255,0.08)]"
                              }`}
                            >
                              <span className="flex items-center gap-1.5">
                                {d.title}
                                {d.premium && <Crown className="w-2.5 h-2.5 text-amber-400 shrink-0" />}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              <Link
                to="/pricing"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2 p-2 rounded-lg text-sm transition-colors ${
                  _isContactPage
                    ? "text-white font-bold bg-[rgba(255,255,255,0.12)] doc-sidebar-item-active"
                    : "text-white/90 hover:bg-[rgba(255,255,255,0.08)]"
                }`}
              >
                <Icons.Phone className="w-4 h-4 text-white/80 shrink-0" />
                <span className="font-semibold">Liên hệ</span>
              </Link>
            </div>
          </div>
        </>
      )}

      <div 
        className={`${isCollapsed ? "hidden md:flex" : "hidden"} w-20 shrink-0 flex-col items-center py-6 border-r md:sticky md:top-0 md:h-[calc(100vh/0.9)] z-20 doc-brand-header`}
      >
        <Link to="/" className="mb-4 text-white hover:opacity-80 transition-opacity" title="Về trang chủ">
          <BookOpen className="w-6 h-6" />
        </Link>
        <button
          onClick={toggleCollapse}
          className="mb-8 p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-[rgba(255,255,255,0.08)] transition-colors"
          title="Mở rộng sidebar"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
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
                {isPopoverOpen && (
                  <div 
                    className="absolute left-full top-0 ml-2 w-64 rounded-xl shadow-xl p-3 z-30 animate-scale-in origin-left doc-brand-header border border-white/10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h4 className="font-bold text-sm text-white mb-2 pb-1 border-b border-white/10 truncate">
                      {cat.title}
                    </h4>
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      {cat.documents.map((d) => {
                        const isActive = d.id === currentDocId;
                        return (
                          <Link
                            key={d.id}
                            to={`/documents/${d.id}`}
                            onClick={() => setActiveTabletPopover(null)}
                            className={`block p-2 rounded-md text-xs transition-all ${
                              isActive ? "text-white font-bold doc-popover-item-active" : "text-white/70 hover:text-white hover:bg-[rgba(255,255,255,0.08)]"
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              {d.title}
                              {d.premium && <Crown className="w-2.5 h-2.5 text-amber-400 shrink-0" />}
                            </span>
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
        <Link
          to="/pricing"
          title="Liên hệ"
          className={`w-12 h-12 rounded-xl flex items-center justify-center text-white/90 hover:bg-[rgba(255,255,255,0.08)] transition-colors mt-2 ${
            _isContactPage ? "bg-[rgba(255,255,255,0.12)] text-white" : ""
          }`}
        >
          <Icons.Phone className="w-5 h-5" />
        </Link>
      </div>

      <div 
        className={`${isCollapsed ? "hidden" : "hidden md:flex"} w-72 shrink-0 flex-col border-r md:sticky md:top-0 md:h-[calc(100vh/0.9)] z-10 animate-fade-in doc-brand-header`}
      >
        <div className="p-4 pb-0 shrink-0">
          <div className="flex items-center justify-between border-b doc-border-brand mb-4 pb-2">
            <Link 
              to="/"
              className="flex items-center gap-2.5 font-bold text-lg text-white hover:opacity-80 transition-opacity"
            >
              <BookOpen className="w-5 h-5 text-white" />
              <span>Tài liệu HOU</span>
            </Link>
            <button
              onClick={toggleCollapse}
              className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-[rgba(255,255,255,0.08)] transition-colors"
              title="Thu nhỏ sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 pt-2 pb-24 space-y-4">
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
                        const isActive = d.id === currentDocId;
                        return (
                          <Link
                            key={d.id}
                            to={`/documents/${d.id}`}
                            className={`block p-2 rounded-md text-xs transition-all ${
                              isActive ? "text-white font-bold border-l-2 doc-sidebar-item-active" : "text-white/70 hover:text-white hover:bg-[rgba(255,255,255,0.08)]"
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              {d.title}
                              {d.premium && <Crown className="w-2.5 h-2.5 text-amber-400 shrink-0" />}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            <Link
              to="/pricing"
              className={`flex items-center gap-2 p-2 rounded-lg text-sm transition-colors mt-2 ${
                _isContactPage
                  ? "text-white font-bold bg-[rgba(255,255,255,0.12)] border-l-2 doc-sidebar-item-active"
                  : "text-white/90 hover:bg-[rgba(255,255,255,0.08)]"
              }`}
            >
              <Icons.Phone className="w-4 h-4 text-white/80 shrink-0" />
              <span className="font-semibold">Liên hệ</span>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default DocumentSidebar;
