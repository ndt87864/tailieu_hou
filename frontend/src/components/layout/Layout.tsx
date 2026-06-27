import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.js";
import { BookOpen, User, Shield, LogOut, ChevronDown, Menu, X, Settings } from "lucide-react";
import UISettingsModal from "./UISettingsModal.js";
import EditProfileModal from "./EditProfileModal.js";

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
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0 overflow-hidden"
                    style={{ background: "linear-gradient(135deg, var(--brand-700), var(--brand-500))" }}
                  >
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      user.email?.charAt(0).toUpperCase() ?? "U"
                    )}
                  </div>
                  <div className="hidden sm:flex flex-col items-start min-w-0">
                    <span style={{ color: "var(--fg)", fontSize: "0.75rem", fontWeight: 500 }} className="truncate max-w-[120px]">
                      {profile?.full_name || user.email}
                    </span>
                    <span
                      style={{ ...badge.style, fontSize: "0.625rem", fontWeight: 700, padding: "1px 6px", borderRadius: 99, border: "1px solid", borderColor: badge.style.borderColor }}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} style={{ color: "var(--meta)" }} />
                </button>

                {dropdownOpen && (
                  <div
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-md)" }}
                    className="absolute right-0 mt-2 w-56 rounded-2xl py-1.5 animate-scale-in origin-top-right z-50"
                  >
                    <div style={{ borderBottom: "1px solid var(--border-soft)" }} className="px-4 py-2.5">
                      <p style={{ color: "var(--fg)", fontSize: "0.75rem", fontWeight: 500 }} className="truncate">
                        {profile?.full_name || user.email}
                      </p>
                      {profile?.full_name && (
                        <p style={{ color: "var(--muted)", fontSize: "0.65rem" }} className="truncate">
                          {user.email}
                        </p>
                      )}
                      {profile?.phone && (
                        <p style={{ color: "var(--muted)", fontSize: "0.65rem" }} className="truncate">
                          📞 {profile.phone}
                        </p>
                      )}
                      <span style={{ ...badge.style, fontSize: "0.625rem", fontWeight: 700, padding: "1px 6px", borderRadius: 99, border: "1px solid", borderColor: badge.style.borderColor, marginTop: 4, display: "inline-block" }}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => { setDropdownOpen(false); onOpenProfile(); }}
                        style={{ color: "var(--fg-2)" }}
                        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm hover:bg-[var(--bg-2)] transition-colors text-left"
                      >
                        <User className="w-4 h-4" style={{ color: "var(--meta)" }} />
                        Chỉnh sửa hồ sơ
                      </button>
                      {role === "admin" && (
                        <Link
                          to="/admin"
                          onClick={() => setDropdownOpen(false)}
                          style={{ color: "var(--fg-2)" }}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-[var(--bg-2)] transition-colors"
                        >
                          <Shield className="w-4 h-4" style={{ color: "var(--meta)" }} />
                          Quản trị hệ thống
                        </Link>
                      )}
                      <button
                        onClick={() => { setDropdownOpen(false); onOpenSettings(); }}
                        style={{ color: "var(--fg-2)" }}
                        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm hover:bg-[var(--bg-2)] transition-colors text-left"
                      >
                        <Settings className="w-4 h-4" style={{ color: "var(--meta)" }} />
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
                  style={{ color: "var(--muted)" }}
                  className="p-2 rounded-xl hover:bg-[var(--bg-2)] transition-colors"
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
              style={{ color: "var(--muted)" }}
              className="md:hidden p-2 rounded-lg hover:bg-[var(--bg-2)] transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <nav style={{ borderTop: "1px solid var(--border)" }} className="md:hidden py-3 pb-4 animate-slide-up">
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
              style={{ color: "var(--fg-2)" }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-[var(--bg-2)] rounded-xl transition-colors text-left"
            >
              <User className="w-4 h-4" style={{ color: "var(--meta)" }} />
              Chỉnh sửa hồ sơ
            </button>
            <button
              onClick={() => { setMobileOpen(false); onOpenSettings(); }}
              style={{ color: "var(--fg-2)" }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-[var(--bg-2)] rounded-xl transition-colors"
            >
              <Settings className="w-4 h-4" style={{ color: "var(--meta)" }} />
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
  <footer style={{ borderTop: "1px solid var(--border)", background: "var(--surface)", transition: "background 0.25s ease, border-color 0.25s ease" }}>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div style={{ background: "linear-gradient(135deg, var(--brand-700), var(--brand-500))" }} className="w-7 h-7 rounded-lg flex items-center justify-center shadow-sm">
            <BookOpen className="w-3.5 h-3.5 text-white" />
          </div>
          <span style={{ color: "var(--fg)", fontSize: "0.875rem", fontWeight: 600 }}>Tài liệu HOU</span>
          <span style={{ color: "var(--meta)", fontSize: "0.75rem" }} className="hidden sm:inline ml-2">
            &copy; {new Date().getFullYear()} — Nền tảng ôn thi trực tuyến
          </span>
        </div>
        <div className="flex items-center gap-6 text-xs" style={{ color: "var(--muted)" }}>
          <a href="#" style={{ color: "var(--muted)" }} className="hover:text-[var(--fg)] transition-colors">Điều khoản</a>
          <a href="#" style={{ color: "var(--muted)" }} className="hover:text-[var(--fg)] transition-colors">Hỗ trợ</a>
          <a href="#" style={{ color: "var(--muted)" }} className="hover:text-[var(--fg)] transition-colors">Liên hệ</a>
        </div>
      </div>
      <p style={{ color: "var(--meta)", fontSize: "0.75rem" }} className="text-center sm:hidden mt-3">
        &copy; {new Date().getFullYear()} — Nền tảng ôn thi trực tuyến
      </p>
    </div>
  </footer>
);

const Layout: React.FC = () => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const location = useLocation();

  const isDocPage = location.pathname.startsWith("/documents/");

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)", color: "var(--fg)", transition: "background 0.25s ease, color 0.25s ease" }}>
      <Header onOpenSettings={() => setSettingsOpen(true)} onOpenProfile={() => setProfileOpen(true)} />
      <main style={{ flex: 1, width: "100%", display: "flex", flexDirection: "column" }}>
        {isDocPage ? (
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
};

export default Layout;