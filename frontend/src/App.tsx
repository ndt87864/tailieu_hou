import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAuth } from "./context/AuthContext.js";
import Layout from "./components/layout/Layout.js";
import HomePage from "./pages/Home/HomePage.js";
import LoginPage from "./pages/Login/LoginPage.js";
import DocumentPage from "./pages/Document/DocumentPage.js";
import AdminPage from "./pages/Admin/AdminPage.js";
import ExamSchedulePage from "./pages/ExamSchedule/ExamSchedulePage.js";
import PricingPage from "./pages/Pricing/PricingPage.js";
import LoadingSpinner from "./components/common/LoadingSpinner.js";

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

const App: React.FC = () => {
  return (
    <>
      <ToastContainer position="bottom-right" autoClose={3000} />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<LoginPage />} />
          <Route path="/lich-thi" element={<ExamSchedulePage />} />
          <Route path="/documents/:id" element={<DocumentPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute roles={["admin"]}>
                <AdminPage />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </>
  );
};

export default App;
