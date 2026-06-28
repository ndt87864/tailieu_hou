import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.js";
import { BookOpen, User, Shield, LogOut, ChevronDown, Menu, X, Settings } from "lucide-react";
import UISettingsModal from "./UISettingsModal.js";
import EditProfileModal from "./EditProfileModal.js";
import { useUI } from "../../context/UIContext.js";

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenProfile: () => void;
}

const Header: React.FC<HeaderProps> = ({ onOpenSettings, onOpenProfile }) => {
  const { user, role, profile, logout } = useAuth();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setDropdownOpen(false);
  }, [location]);

  const isActive = (path: string) => location.pathname === path;

  const navLinks = user
    ? [
        { to: "/", label: "Trang chủ" },
        { to: "/lich-thi", label: "Lịch thi" },
        ...(role === "admin" ? [{ to: "/admin", label: "Quản trị" }] : []),
      ]
    : [
        { to: "/", label: "Trang chủ" },
        { to: "/lich-thi", label: "Lịch thi" },
      ];

  const roleBadge: Record<string, { label: string; style: React.CSSProperties }> = {
    admin:      { label: "Admin",  style: { background: "#fee2e2", color: "#b91c1c", borderColor: "#fca5a5" } },
    management: { label: "QL",    style: { background: "#fef3c7", color: "#b45309", borderColor: "#fcd34d" } },
    ultra:      { label: "Ultra", style: { background: "#f3e8ff", color: "#7c3aed", borderColor: "#c4b5fd" } },
    pro:        { label: "Pro",   style: { background: "#d1fae5", color: "#065f46", borderColor: "#6ee7b7" } },
    plus:       { label: "Plus",  style: { background: "#dbeafe", color: "#1d4ed8", borderColor: "#93c5fd" } },
    free:       { label: "Free",  style: { background: "var(--bg-2)", color: "var(--muted)", borderColor: "var(--border)" } },
  };
  const badge = roleBadge[role] ?? { label: role.toUpperCase(), style: { background: "var(--bg-2)", color: "var(--muted)", borderColor: "var(--border)" } };

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "color-mix(in srgb, var(--surface) 85%, transparent)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid var(--border)",
        transition: "background 0.25s ease, border-color 0.25s ease",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            to="/"
            style={{ color: "var(--fg)", textDecoration: "none" }}
            className="flex items-center gap-2.5 font-bold text-lg shrink-0 hover:opacity-80 transition-opacity"
          >
            <div
              style={{ background: "linear-gradient(135deg, var(--brand-700), var(--brand-500))" }}
              className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm"
            >
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="hidden sm:inline">Tài liệu HOU</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                style={
                  isActive(link.to)
                    ? { background: "color-mix(in srgb, var(--brand-600) 10%, transparent)", color: "var(--brand-600)" }
                    : { color: "var(--muted)" }
                }
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:opacity-100 ${
                  isActive(link.to) ? "" : "hover:bg-[var(--bg-2)] hover:text-[var(--fg)]"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen((p) => !p)}
                  style={{ color: "var(--fg)" }}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-all duration-200 hover:bg-[var(--bg-2)]"
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
                      className="layout-user-badge"
                      style={badge.style}
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
                    <div style={{ borderBottom: "1px solid var(--border-soft)" }} className="px-4 py-2.5">
                      <p style={{ color: "var(--fg)", fontSize: "0.75rem", fontWeight: 500 }} className="truncate">
                        {profile?.full_name || user.email}
                      </p>
                      {profile?.full_name && (
                        <p className="truncate layout-profile-email">
                          {user.email}
                        </p>
                      )}
                      {profile?.phone && (
                        <p className="truncate layout-profile-phone">
                          📞 {profile.phone}
                        </p>
                      )}
                      <span className="layout-user-badge mt-1" style={badge.style}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => { setDropdownOpen(false); onOpenProfile(); }}
                        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm hover:bg-[var(--bg-2)] transition-colors text-left layout-text-fg2"
                      >
                        <User className="w-4 h-4 layout-icon-meta" />
                        Chỉnh sửa hồ sơ
                      </button>
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
                        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm hover:bg-[var(--bg-2)] transition-colors text-left layout-text-fg2"
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
                <button
                  onClick={onOpenSettings}
                  className="p-2 rounded-xl hover:bg-[var(--bg-2)] transition-colors layout-icon-muted"
                  aria-label="Tùy chỉnh giao diện"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <Link to="/login" className="btn-brand text-sm !py-2 !px-4 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Đăng nhập
                </Link>
              </div>
            )}

            {/* Mobile toggle */}
            <button
              onClick={() => setMobileOpen((p) => !p)}
              className="md:hidden p-2 rounded-lg hover:bg-[var(--bg-2)] transition-colors layout-icon-muted"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <nav className="md:hidden py-3 pb-4 animate-slide-up layout-mobile-nav">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                style={
                  isActive(link.to)
                    ? { background: "color-mix(in srgb, var(--brand-600) 10%, transparent)", color: "var(--brand-600)" }
                    : { color: "var(--muted)" }
                }
                className="block px-4 py-2.5 rounded-xl text-sm font-medium transition-colors mb-1"
              >
                {link.label}
              </Link>
            ))}
            <button
              onClick={() => { setMobileOpen(false); onOpenProfile(); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-[var(--bg-2)] rounded-xl transition-colors text-left layout-text-fg2"
            >
              <User className="w-4 h-4 layout-icon-meta" />
              Chỉnh sửa hồ sơ
            </button>
            <button
              onClick={() => { setMobileOpen(false); onOpenSettings(); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-[var(--bg-2)] rounded-xl transition-colors layout-text-fg2"
            >
              <Settings className="w-4 h-4 layout-icon-meta" />
              Giao diện hệ thống
            </button>
            {user && (
              <button
                onClick={logout}
                className="w-full mt-2 flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Đăng xuất
              </button>
            )}
          </nav>
        )}
      </div>
    </header>
  );
};

const Footer: React.FC = () => (
  <footer className="layout-footer">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shadow-sm layout-footer-logo">
            <BookOpen className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="layout-footer-title">Tài liệu HOU</span>
          <span className="hidden sm:inline ml-2 layout-footer-copyright">
            &copy; {new Date().getFullYear()} — Nền tảng ôn thi trực tuyến
          </span>
        </div>
        <div className="flex items-center gap-6 text-xs layout-footer-links">
          <a href="#" className="hover:text-[var(--fg)] transition-colors layout-footer-link">Điều khoản</a>
          <a href="#" className="hover:text-[var(--fg)] transition-colors layout-footer-link">Hỗ trợ</a>
          <a href="#" className="hover:text-[var(--fg)] transition-colors layout-footer-link">Liên hệ</a>
        </div>
      </div>
      <p className="text-center sm:hidden mt-3 layout-footer-copyright">
        &copy; {new Date().getFullYear()} — Nền tảng ôn thi trực tuyến
      </p>
    </div>
  </footer>
);

const Layout: React.FC = () => {
  const { viewMode } = useUI();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const location = useLocation();

  const isDocPage = location.pathname.startsWith("/documents/");
  const isAdminPage = location.pathname.startsWith("/admin");
  const isFullWidthPage = isDocPage || isAdminPage;

  // View mode simulation styling
  const getSimulatedStyle = (): React.CSSProperties => {
    switch (viewMode) {
      case "desktop":
        return {
          width: "1280px",
          maxWidth: "100%",
          margin: "0 auto",
          borderLeft: "1px solid var(--border)",
          borderRight: "1px solid var(--border)",
          boxShadow: "0 0 40px rgba(0, 0, 0, 0.1)",
        };
      case "tablet":
        return {
          width: "768px",
          maxWidth: "100%",
          margin: "20px auto",
          borderRadius: "24px",
          border: "8px solid #1a1a1a",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
          height: "1024px",
          maxHeight: "90dvh",
          display: "flex",
          flexDirection: "column",
        };
      case "mobile":
        return {
          width: "375px",
          maxWidth: "100%",
          margin: "20px auto",
          borderRadius: "36px",
          border: "10px solid #1a1a1a",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
          height: "812px",
          maxHeight: "85dvh",
          display: "flex",
          flexDirection: "column",
        };
      default:
        return {};
    }
  };

  const simulatedStyle = getSimulatedStyle();
  const isSimulated = viewMode !== "responsive";

  const content = (
    <div 
      className="layout-content-wrapper"
      style={{ 
        minHeight: isSimulated ? undefined : "100vh", 
        height: isSimulated && viewMode !== "desktop" ? "100%" : undefined,
        ...simulatedStyle
      }}
    >
      <Header onOpenSettings={() => setSettingsOpen(true)} onOpenProfile={() => setProfileOpen(true)} />
      <main className="layout-main-static" style={{ overflowY: isSimulated && viewMode !== "desktop" ? "auto" : undefined }}>
        {isFullWidthPage ? (
          <Outlet />
        ) : (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full">
            <Outlet />
          </div>
        )}
      </main>
      <Footer />
      <UISettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <EditProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );

  if (isSimulated) {
    return (
      <div 
        className="layout-simulated-container"
        style={{ 
          padding: viewMode === "desktop" ? 0 : "20px 10px", 
        }}
      >
        {content}
      </div>
    );
  }

  return content;
};

export default Layout;