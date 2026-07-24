import React, { useState, useRef, useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.js";
import { GraduationCap, User, Shield, LogOut, ChevronDown, Menu, X, Settings, Phone, Home, Calendar, Search } from "lucide-react";
import UISettingsModal from "./UISettingsModal.js";
import EditProfileModal from "./EditProfileModal.js";
import { useUI } from "../../context/UIContext.js";
import DocumentSidebar from "./DocumentSidebar.js";
import apiClient from "../../services/client.js";

export interface HeaderProps {
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
  hideNavLinks?: boolean;
  hideLogo?: boolean;
  onMobileMenuClick?: () => void;
  hideMobileMenuToggle?: boolean;
  showSubjectSearch?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettings,
  onOpenProfile,
  title,
  subtitle,
  leftElement,
  rightElement,
  hideNavLinks = false,
  hideLogo = false,
  onMobileMenuClick,
  hideMobileMenuToggle = false,
  showSubjectSearch = false,
}) => {
  const { user, role, profile, logout } = useAuth();
  const { lessonMode } = useUI();
  const location = useLocation();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // States for Quick Subject Search
  const [subjects, setSubjects] = useState<{ id: string; title: string; categoryTitle?: string }[]>([]);
  const [subjectQuery, setSubjectQuery] = useState("");
  const [showSubjectSuggestions, setShowSubjectSuggestions] = useState(false);
  const [subjectSearchLoading, setSubjectSearchLoading] = useState(false);
  const subjectSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (subjectSearchRef.current && !subjectSearchRef.current.contains(e.target as Node)) {
        setShowSubjectSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleHeaderSearch = () => {
    if (!subjectQuery.trim()) {
      setSubjects([]);
      return;
    }
    setSubjectSearchLoading(true);
    const apiPath = `/api/v1/documents?q=${encodeURIComponent(subjectQuery)}${lessonMode ? "&lms=true" : ""}`;
    apiClient.get<{ documents: any[] }>(apiPath)
      .then((res) => {
        const docs = res.data.documents || [];
        const list = docs.map((doc: any) => ({
          id: doc.id,
          title: doc.title,
          categoryTitle: doc.category?.title || ""
        })).slice(0, 8);
        setSubjects(list);
        setSubjectSearchLoading(false);
      })
      .catch((err) => {
        console.error("Lỗi tìm kiếm nhanh môn học ở Header:", err);
        setSubjectSearchLoading(false);
      });
  };

  useEffect(() => {
    setMobileOpen(false);
    setDropdownOpen(false);
  }, [location]);

  const isActive = (path: string) => location.pathname === path;

  const navLinks: { to: string; label: string }[] = [];

  const roleBadge: Record<string, { label: string; className: string }> = {
    admin:      { label: "Admin",  className: "layout-user-badge-admin" },
    management: { label: "QL",    className: "layout-user-badge-management" },
    ultra:      { label: "Ultra", className: "layout-user-badge-ultra" },
    pro:        { label: "Pro",   className: "layout-user-badge-pro" },
    plus:       { label: "Plus",  className: "layout-user-badge-plus" },
    free:       { label: "Free",  className: "layout-user-badge-free" },
  };
  const badge = roleBadge[role] ?? { label: role.toUpperCase(), className: "layout-user-badge-free" };

  return (
    <header className="layout-header">
      <div className="w-full px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo or custom left element */}
          {leftElement ? (
            leftElement
          ) : hideLogo ? (
            null
          ) : (
            <Link
              to="/"
              className="flex items-center gap-2.5 font-bold text-lg shrink-0 hover:opacity-80 transition-opacity layout-logo-link"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm layout-logo-icon-wrapper">
                <GraduationCap className="w-4 h-4 text-white" />
              </div>
              <span className="hidden sm:inline">Tài liệu HOU</span>
            </Link>
          )}

          {/* Title or Desktop Nav */}
          {title ? (
            <div className="flex flex-col min-w-0 max-w-[40%] md:max-w-none text-left flex-1 ml-4">
              <h1 className="text-xs md:text-sm font-bold text-[var(--fg)] truncate">{title}</h1>
              {subtitle && <p className="text-[9px] md:text-[10px] text-[var(--muted)] truncate">{subtitle}</p>}
            </div>
          ) : (
            !hideNavLinks && (
              <nav className="hidden md:flex items-center gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:opacity-100 ${
                      isActive(link.to)
                        ? "layout-nav-link-active"
                        : "layout-nav-link-inactive hover:bg-[var(--bg-2)] hover:text-[var(--fg)]"
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            )
          )}

          {/* Quick Subject Search on Header */}
          {showSubjectSearch && (
            <div className="relative mx-4 flex-1 max-w-[180px] sm:max-w-[260px] md:max-w-[300px]" ref={subjectSearchRef}>
              <div className="relative">
                <button 
                  onClick={handleHeaderSearch}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 border-none bg-transparent text-[var(--muted)] hover:text-[var(--fg)] cursor-pointer transition-colors p-0 flex items-center justify-center z-10"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
                <input
                  type="text"
                  placeholder="Tìm môn học..."
                  value={subjectQuery}
                  onChange={(e) => {
                    setSubjectQuery(e.target.value);
                    if (!e.target.value) setSubjects([]);
                    setShowSubjectSuggestions(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleHeaderSearch();
                    }
                  }}
                  onFocus={() => setShowSubjectSuggestions(true)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border text-xs bg-[var(--surface)] border-[var(--border)] text-[var(--fg)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
              </div>
              {showSubjectSuggestions && subjects.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg z-50 py-1">
                  {subjects.map(s => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSubjectQuery("");
                        setShowSubjectSuggestions(false);
                        navigate(`/documents/${s.id}`);
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-2)] transition-colors block border-b border-[var(--border-soft)] last:border-0"
                    >
                      <div className="font-semibold text-[var(--fg)] truncate">{s.title}</div>
                      <div className="text-[10px] text-[var(--muted)] truncate">{s.categoryTitle}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Right side */}
          <div className="flex items-center gap-3">
            {rightElement}
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen((p) => !p)}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-all duration-200 hover:bg-[var(--bg-2)] layout-text-fg2"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0 overflow-hidden layout-avatar-bg"
                  >
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      user.email?.charAt(0).toUpperCase() ?? "U"
                    )}
                  </div>
                  <div className="hidden sm:flex flex-col items-start min-w-0">
                    <span className="truncate max-w-[120px] layout-user-name">
                      {profile?.full_name || user.email}
                    </span>
                    <span
                      className={`layout-user-badge ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""} layout-icon-meta`} />
                </button>

                {dropdownOpen && (
                  <div
                    className="absolute right-0 mt-2 w-56 rounded-2xl py-1.5 animate-scale-in origin-top-right z-50 layout-dropdown"
                  >
                    <div className="px-4 py-2.5 layout-dropdown-header">
                      <p className="truncate layout-dropdown-username">
                        {profile?.full_name || user.email}
                      </p>
                      {profile?.full_name && (
                        <p className="truncate layout-profile-email">
                          {user.email}
                        </p>
                      )}
                      {profile?.phone && (
                        <p className="truncate layout-profile-phone flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 layout-icon-meta" />
                          <span>{profile.phone}</span>
                        </p>
                      )}
                      <span className={`layout-user-badge mt-1 ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => { setDropdownOpen(false); onOpenProfile(); }}
                        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-[var(--fg-2)] hover:bg-[var(--bg-2)] transition-colors text-left"
                      >
                        <User className="w-4 h-4 layout-icon-meta" />
                        Trang cá nhân
                      </button>
                      {location.pathname !== "/" && (
                        <>
                          <Link
                            to="/"
                            onClick={() => setDropdownOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-[var(--bg-2)] transition-colors layout-text-fg2 text-left"
                          >
                            <Home className="w-4 h-4 layout-icon-meta" />
                            Trang chủ
                          </Link>
                          <Link
                            to="/lich-thi"
                            onClick={() => setDropdownOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-[var(--bg-2)] transition-colors layout-text-fg2 text-left"
                          >
                            <Calendar className="w-4 h-4 layout-icon-meta" />
                            Lịch thi
                          </Link>
                          <Link
                            to="/pricing"
                            onClick={() => setDropdownOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-[var(--bg-2)] transition-colors layout-text-fg2 text-left"
                          >
                            <Phone className="w-4 h-4 layout-icon-meta" />
                            Liên hệ
                          </Link>
                        </>
                      )}
                      {role === "admin" && (
                        <Link
                          to="/admin"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-[var(--bg-2)] transition-colors layout-text-fg2"
                        >
                          <Shield className="w-4 h-4 layout-icon-meta" />
                          Quản trị hệ thống
                        </Link>
                      )}
                      <button
                        onClick={() => { setDropdownOpen(false); onOpenSettings(); }}
                        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-[var(--fg-2)] hover:bg-[var(--bg-2)] transition-colors text-left"
                      >
                        <Settings className="w-4 h-4 layout-icon-meta" />
                        Giao diện hệ thống
                      </button>
                      <button
                        onClick={() => { setDropdownOpen(false); logout(); }}
                        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        Đăng xuất
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="hidden md:block relative" ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen((p) => !p)}
                    className="p-2 rounded-xl hover:bg-[var(--bg-2)] transition-colors layout-icon-muted"
                    aria-label="Menu"
                  >
                    <Menu className="w-5 h-5" />
                  </button>

                  {dropdownOpen && (
                    <div
                      className="absolute right-0 mt-2 w-56 rounded-2xl py-1.5 animate-scale-in origin-top-right z-50 layout-dropdown"
                    >
                      <div className="py-1">
                        {location.pathname !== "/" && (
                          <>
                            <Link
                              to="/"
                              onClick={() => setDropdownOpen(false)}
                              className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-[var(--bg-2)] transition-colors layout-text-fg2 text-left"
                            >
                              <Home className="w-4 h-4 layout-icon-meta" />
                              Trang chủ
                            </Link>
                            <Link
                              to="/lich-thi"
                              onClick={() => setDropdownOpen(false)}
                              className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-[var(--bg-2)] transition-colors layout-text-fg2 text-left"
                            >
                              <Calendar className="w-4 h-4 layout-icon-meta" />
                              Lịch thi
                            </Link>
                            <Link
                              to="/pricing"
                              onClick={() => setDropdownOpen(false)}
                              className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-[var(--bg-2)] transition-colors layout-text-fg2 text-left"
                            >
                              <Phone className="w-4 h-4 layout-icon-meta" />
                              Liên hệ
                            </Link>
                          </>
                        )}
                        <button
                          onClick={() => { setDropdownOpen(false); onOpenSettings(); }}
                          className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-[var(--fg-2)] hover:bg-[var(--bg-2)] transition-colors text-left"
                        >
                          <Settings className="w-4 h-4 layout-icon-meta" />
                          Giao diện hệ thống
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {location.pathname === "/" || location.pathname.startsWith("/documents/") ? (
                  <Link to="/login" className="btn-premium-login text-sm flex items-center gap-2">
                    <User className="w-4 h-4 premium-icon-user" />
                    <span>Đăng nhập</span>
                  </Link>
                ) : (
                  <Link to="/login" className="btn-brand text-sm !py-2 !px-4 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Đăng nhập
                  </Link>
                )}
              </div>
            )}

            {/* Mobile toggle */}
            {!hideMobileMenuToggle && (!user || !!onMobileMenuClick) && (
              <button
                onClick={onMobileMenuClick || (() => setMobileOpen((p) => !p))}
                className="md:hidden p-2 rounded-lg hover:bg-[var(--bg-2)] transition-colors layout-icon-muted"
                aria-label="Toggle menu"
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <nav className="md:hidden py-3 pb-4 animate-slide-up layout-mobile-nav">
            <Link
              to="/"
              onClick={() => setMobileOpen(false)}
              className={`block px-4 py-2.5 rounded-xl text-sm font-medium transition-colors mb-1 ${
                isActive("/") ? "layout-nav-link-active" : "layout-nav-link-inactive hover:bg-[var(--bg-2)]"
              }`}
            >
              Trang chủ
            </Link>
            <Link
              to="/lich-thi"
              onClick={() => setMobileOpen(false)}
              className={`block px-4 py-2.5 rounded-xl text-sm font-medium transition-colors mb-1 ${
                isActive("/lich-thi") ? "layout-nav-link-active" : "layout-nav-link-inactive hover:bg-[var(--bg-2)]"
              }`}
            >
              Lịch thi
            </Link>
            <Link
              to="/pricing"
              onClick={() => setMobileOpen(false)}
              className={`block px-4 py-2.5 rounded-xl text-sm font-medium transition-colors mb-1 ${
                isActive("/pricing") ? "layout-nav-link-active" : "layout-nav-link-inactive hover:bg-[var(--bg-2)]"
              }`}
            >
              Liên hệ
            </Link>
            <button
              onClick={() => { setMobileOpen(false); onOpenSettings(); }}
              className="flex items-center gap-2.5 w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-colors mb-1 text-[var(--fg-2)] hover:bg-[var(--bg-2)] text-left"
            >
              <Settings className="w-4 h-4 layout-icon-meta" />
              Giao diện hệ thống
            </button>
          </nav>
        )}
      </div>
    </header>
  );
};

export const Footer: React.FC = () => (
  <footer className="layout-footer">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shadow-sm layout-footer-logo">
            <GraduationCap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="layout-footer-title">Tài liệu HOU</span>
          <span className="hidden sm:inline ml-2 layout-footer-copyright">
            &copy; {new Date().getFullYear()} — Nền tảng ôn thi trực tuyến
          </span>
        </div>
        <div className="flex items-center gap-6 text-xs layout-footer-links">
          <a href="#" className="hover:text-[var(--fg)] transition-colors layout-footer-link">Điều khoản</a>
                      <a href="#" className="hover:text-[var(--fg)] transition-colors layout-footer-link">Hỗ trợ</a>
          <Link to="/pricing" className="hover:text-[var(--fg)] transition-colors layout-footer-link">Liên hệ</Link>
        </div>
      </div>
      <p className="text-center sm:hidden mt-3 layout-footer-copyright">
        &copy; {new Date().getFullYear()} — Nền tảng ôn thi trực tuyến
      </p>
    </div>
  </footer>
);

const Layout: React.FC = () => {
  const { pageLoading } = useUI();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const location = useLocation();

  const isDocPage = location.pathname.startsWith("/documents/");
  const isCategoryPage = location.pathname.startsWith("/categories/");
  const isAdminPage = location.pathname.startsWith("/admin");
  const isPricingPage = location.pathname === "/pricing";
  const isFullWidthPage = isDocPage || isCategoryPage || isAdminPage || isPricingPage || location.pathname === "/lich-thi";

  useEffect(() => {
    const handleOpenSettings = () => setSettingsOpen(true);
    const handleOpenProfile = () => setProfileOpen(true);

    window.addEventListener("open-settings", handleOpenSettings);
    window.addEventListener("open-profile", handleOpenProfile);

    let resizeTimer: number;
    const handleResize = () => {
      document.body.classList.add("is-resizing");
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        document.body.classList.remove("is-resizing");
      }, 150);
    };
    window.addEventListener("resize", handleResize, { passive: true });

    return () => {
      window.removeEventListener("open-settings", handleOpenSettings);
      window.removeEventListener("open-profile", handleOpenProfile);
      window.removeEventListener("resize", handleResize);
      clearTimeout(resizeTimer);
    };
  }, []);

  const hasDocumentSidebar = isDocPage || isPricingPage || isCategoryPage;

  const content = hasDocumentSidebar ? (
    <div className="layout-content-wrapper flex flex-row min-h-screen w-full">
      <DocumentSidebar currentDocId={isDocPage ? location.pathname.split("/")[2] : undefined} isContactPage={isPricingPage} />
      <div className="flex-1 flex flex-col min-w-0 min-h-screen bg-[var(--bg)]">
        <main className="flex-1 flex flex-col">
          <Outlet />
        </main>
        {!isAdminPage && <Footer />}
      </div>
      <UISettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <EditProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  ) : (
    <div className="layout-content-wrapper">
      {!isDocPage && !isCategoryPage && !isAdminPage && !isPricingPage && (
        <Header 
          onOpenSettings={() => setSettingsOpen(true)} 
          onOpenProfile={() => setProfileOpen(true)} 
          hideMobileMenuToggle={false} 
        />
      )}
      <main className="layout-main-static">
        {isFullWidthPage ? (
          <Outlet />
        ) : (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full">
            <Outlet />
          </div>
        )}
      </main>
      {!isAdminPage && <Footer />}
      <UISettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <EditProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );

  return (
    <>
      {pageLoading && (
        <div className="loading-progress-bar-global">
          <div className="loading-progress-bar-indicator" />
        </div>
      )}
      {content}
    </>
  );
};

export default Layout;