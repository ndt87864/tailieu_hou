import React from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.js";

const Header: React.FC = () => {
  const { user, role, logout } = useAuth();

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <a href="/" className="text-xl font-bold text-indigo-600">
          📚 Tài liệu HOU
        </a>
        <nav className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <span className="text-gray-500">
                {user.email} ({role})
              </span>
              <button
                onClick={logout}
                className="bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded"
              >
                Đăng xuất
              </button>
            </>
          ) : (
            <a
              href="/login"
              className="bg-indigo-600 text-white px-4 py-1.5 rounded hover:bg-indigo-700"
            >
              Đăng nhập
            </a>
          )}
        </nav>
      </div>
    </header>
  );
};

const Layout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>
      <footer className="bg-gray-100 text-center text-xs text-gray-400 py-4">
        &copy; 2026 Tài liệu HOU
      </footer>
    </div>
  );
};

export default Layout;
