import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { cachedGet } from "../../utils/apiCache.js";
import * as Icons from "lucide-react";

const { BookOpen, ChevronDown, ChevronRight, Menu, X, Heart } = Icons;

interface Document {
  id: string;
  title: string;
  description: string;
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
  isContactPage = false,
}) => {
  const [sidebarCategories, setSidebarCategories] = useState<SidebarCategory[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeTabletPopover, setActiveTabletPopover] = useState<string | null>(null);

  useEffect(() => {
    cachedGet<{ documents: Document[] }>("/api/v1/documents")
      .then((res) => {
        const docs: Document[] = res.data.documents || [];
        const groups: Record<string, SidebarCategory> = {};

        docs.forEach((d) => {
          const catId = d.category_id || "other";
          const catTitle = d.category?.title || "Khác";
          const catLogo = d.category?.logo || null;
          const catStt = d.category?.stt ?? 9999;
          if (!groups[catId]) {
            groups[catId] = {
              id: catId,
              title: catTitle,
              logo: catLogo,
              stt: catStt,
              documents: []
            };
          }
          groups[catId].documents.push(d);
        });

        const groupedArray = Object.values(groups).sort((a, b) => {
          if (a.id === "other") return 1;
          if (b.id === "other") return -1;
          return (a.stt ?? 0) - (b.stt ?? 0);
        });
        setSidebarCategories(groupedArray);

        // Auto-expand category of current active document
        if (currentDocId) {
          const currentDoc = docs.find((d) => d.id === currentDocId);
          if (currentDoc) {
            const activeCatId = currentDoc.category_id || "other";
            setExpandedCategories((prev) => ({ ...prev, [activeCatId]: true }));
          }
        }
      })
      .catch((err) => {
        console.error("Lỗi khi tải danh mục sidebar:", err);
      });
  }, [currentDocId]);

  // Click outside to close tablet popover
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveTabletPopover(null);
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("change", handleOutsideClick);
  }, []);

  // Listen to custom event to open the sidebar on mobile/tablet
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

    return {
      label: title,
      icon
    };
  };

  return (
    <>
      {/* Redundant Mobile Toggle Bar removed to avoid double headers */}

      {/* 1. Mobile Drawer (Overlay) */}
      {mobileOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 z-[60] md:hidden backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div 
            className="fixed inset-y-0 left-0 w-72 z-[70] md:hidden shadow-2xl overflow-y-auto flex flex-col animate-slide-right doc-brand-header"
          >
            <div className="p-4 flex items-center justify-between border-b doc-border-brand">
              <span className="font-bold flex items-center gap-2 text-white">
                <BookOpen className="w-5 h-5 text-white" /> Tài liệu HOU
              </span>
              <button onClick={() => setMobileOpen(false)} className="p-1 rounded text-white/80 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 space-y-4 pb-24">
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
                              {d.title}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="pt-4 border-t border-white/10 mt-4">
                <Link
                  to="/pricing"
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 px-2 py-2 rounded-lg text-sm font-medium transition-all ${
                    isContactPage 
                      ? "text-white font-bold doc-sidebar-item-active" 
                      : "text-white/80 hover:text-white hover:bg-[rgba(255,255,255,0.08)]"
                  }`}
                >
                  <Heart className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Liên hệ</span>
                </Link>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 2. Tablet Sidebar (Icons-only) */}
      <div 
        className="hidden md:flex lg:hidden w-20 shrink-0 flex-col items-center py-6 border-r md:sticky md:top-0 md:h-[calc(100vh/0.9)] z-20 doc-brand-header"
      >
        <div className="mb-8 text-white">
          <BookOpen className="w-6 h-6" />
        </div>
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
                            {d.title}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div className="pt-4 border-t border-white/10 w-full flex justify-center mt-4">
            <Link
              to="/pricing"
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                isContactPage 
                  ? "bg-[rgba(255,255,255,0.12)] text-rose-300" 
                  : "text-rose-400 hover:bg-[rgba(255,255,255,0.08)] hover:text-rose-300"
              }`}
              title="Liên hệ"
            >
              <Heart className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>

      {/* 3. Desktop Sidebar (Full layout) */}
      <div 
        className="hidden lg:flex w-72 shrink-0 flex-col border-r lg:sticky lg:top-0 lg:h-[calc(100vh/0.9)] lg:overflow-y-auto z-10 animate-fade-in doc-brand-header"
      >
        <div className="p-4 pb-24 space-y-4">
          <div 
            className="flex items-center gap-2.5 font-bold text-lg mb-6 pb-2 border-b text-white doc-border-brand"
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
                            {d.title}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            <div className="pt-4 border-t border-white/10 mt-4">
              <Link
                to="/pricing"
                className={`flex items-center gap-2 px-2 py-2 rounded-lg text-sm font-medium transition-all ${
                  isContactPage 
                    ? "text-white font-bold doc-sidebar-item-active" 
                    : "text-white/80 hover:text-white hover:bg-[rgba(255,255,255,0.08)]"
                }`}
              >
                <Heart className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Liên hệ</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default DocumentSidebar;
