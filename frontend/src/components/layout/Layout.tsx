import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.js";
import { BookOpen, User, Shield, LogOut, ChevronDown, Menu, X } from "lucide-react";

const Header: React.FC = () => {
  const { user, role, logout } = useAuth();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
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
        ...(role === "admin" ? [{ to: "/admin", label: "Quản trị" }] : []),
      ]
    : [{ to: "/", label: "Trang chủ" }];

  const roleBadge: Record<string, { label: string; color: string }> = {
    admin: { label: "Admin", color: "bg-red-50 text-red-700 border-red-200" },
    management: { label: "QL", color: "bg-amber-50 text-amber-700 border-amber-200" },
    ultra: { label: "Ultra", color: "bg-purple-50 text-purple-700 border-purple-200" },
    pro: { label: "Pro", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    plus: { label: "Plus", color: "bg-blue-50 text-blue-700 border-blue-200" },
    free: { label: "Free", color: "bg-gray-50 text-gray-600 border-gray-200" },
  };

  const badge = roleBadge[role] ?? { label: role.toUpperCase(), color: "bg-gray-50 text-gray-600 border-gray-200" };

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2.5 font-bold text-lg text-gray-900 hover:text-brand-600 transition-colors duration-200 shrink-0"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center shadow-sm">
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
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive(link.to)
                    ? "bg-brand-50 text-brand-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
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
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-gray-50 transition-all duration-200 group"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-brand flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0">
                    {user.email?.charAt(0).toUpperCase() ?? "U"}
                  </div>
                  <div className="hidden sm:flex flex-col items-start min-w-0">
                    <span className="text-xs font-medium text-gray-900 truncate max-w-[120px]">
                      {user.email}
                    </span>
                    <span className={`text-[10px] font-semibold px-1.5 py-px rounded-full border ${badge.color}`}>
                      {badge.label}
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${
                      dropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Dropdown */}
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-gray-100 shadow-dropdown py-1.5 animate-scale-in origin-top-right z-50">
                    <div className="px-4 py-2.5 border-b border-gray-50">
                      <p className="text-xs font-medium text-gray-900 truncate">{user.email}</p>
                      <span className={`inline-block mt-1 text-[10px] font-semibold px-1.5 py-px rounded-full border ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="py-1">
                      {role === "admin" && (
                        <Link
                          to="/admin"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          <Shield className="w-4 h-4 text-gray-400" />
                          Quản trị hệ thống
                        </Link>
                      )}
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          logout();
                        }}
                        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Đăng xuất
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className="btn-brand text-sm !py-2 !px-4 flex items-center gap-2"
              >
                <User className="w-4 h-4" />
                Đăng nhập
              </Link>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileOpen((p) => !p)}
              className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <nav className="md:hidden border-t border-gray-100 py-3 pb-4 animate-slide-up">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`block px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive(link.to)
                    ? "bg-brand-50 text-brand-700"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {link.label}
              </Link>
            ))}
            {user && (
              <button
                onClick={logout}
                className="w-full mt-2 flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors"
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

const Footer: React.FC = () => {
  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-brand flex items-center justify-center shadow-sm">
              <BookOpen className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-900">Tài liệu HOU</span>
            <span className="hidden sm:inline text-xs text-gray-400 ml-2">
              &copy; {new Date().getFullYear()} — Nền tảng ôn thi trực tuyến
            </span>
          </div>
          <div className="flex items-center gap-6 text-xs text-gray-500">
            <a href="#" className="hover:text-gray-900 transition-colors">Điều khoản</a>
            <a href="#" className="hover:text-gray-900 transition-colors">Hỗ trợ</a>
            <a href="#" className="hover:text-gray-900 transition-colors">Liên hệ</a>
          </div>
        </div>
        <p className="text-center sm:hidden text-xs text-gray-400 mt-3">
          &copy; {new Date().getFullYear()} — Nền tảng ôn thi trực tuyến
        </p>
      </div>
    </footer>
  );
};

const Layout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      <main className="flex-1 w-full">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default Layout;