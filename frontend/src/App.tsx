import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAuth } from "./context/AuthContext.js";
import Layout from "./components/layout/Layout.js";
import HomePage from "./pages/Home/HomePage.js";
import LoginPage from "./pages/Login/LoginPage.js";
import DocumentPage from "./pages/Document/DocumentPage.js";
import CategoryPage from "./pages/Document/CategoryPage.js";
import AdminPage from "./pages/Admin/AdminPage.js";
import SheetEditorPage from "./pages/Admin/SheetEditorPage.js";
import ExamSchedulePage from "./pages/ExamSchedule/ExamSchedulePage.js";
import PricingPage from "./pages/Pricing/PricingPage.js";
import LoadingSpinner from "./components/common/LoadingSpinner.js";

import { toast } from "react-toastify";

const ProtectedRoute: React.FC<{ children: React.ReactNode; roles?: string[] }> = ({
  children,
  roles,
}) => {
  const { user, role, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(role)) {
    return (
      <div className="p-8 text-center text-red-600">
        Bạn không có quyền truy cập trang này.
      </div>
    );
  }
  return <>{children}</>;
};

const AuthRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (user) {
    // Chỉ hiển thị toast một lần khi có hành động truy cập vào trang login/register khi đã đăng nhập
    toast.info("Bạn chưa thoát tài khoản, vui lòng thoát tài khoản trước khi đăng nhập");
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <>
      <ToastContainer position="bottom-right" autoClose={3000} />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<AuthRoute><LoginPage /></AuthRoute>} />
          <Route path="/register" element={<AuthRoute><LoginPage /></AuthRoute>} />
          <Route path="/lich-thi" element={<ExamSchedulePage />} />
          <Route path="/categories/:id" element={<CategoryPage />} />
          <Route path="/documents/:id" element={<DocumentPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute roles={["admin", "management"]}>
                <AdminPage />
              </ProtectedRoute>
            }
          />
        </Route>
        <Route
          path="/admin/sheets/:id"
          element={
            <ProtectedRoute roles={["admin", "management"]}>
              <SheetEditorPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
};

export default App;
