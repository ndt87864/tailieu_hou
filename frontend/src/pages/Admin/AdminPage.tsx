import React, { useState } from "react";
import {
  BarChart2,
  Users,
  FolderOpen,
  FileText,
  HelpCircle,
  GraduationCap,
  Home,
  Clock,
  DollarSign,
  Calendar,
  Lock,
  Compass,
  Mail,
  PieChart,
  UserCheck,
  Shield,
} from "lucide-react";

// Import actual subpages
import DashboardTab from "./subpages/DashboardTab.js";
import UsersTab from "./subpages/UsersTab.js";
import CategoriesTab from "./subpages/CategoriesTab.js";
import DocumentsTab from "./subpages/DocumentsTab.js";
import QuestionsTab from "./subpages/QuestionsTab.js";
import StudentInforTab from "./subpages/StudentInforTab.js";

// Import mock subpages
import {
  RoomsTab,
  SessionsTab,
  PricingTab,
  RemindersTab,
  PremiumTab,
  FooterTab,
  ContactsTab,
  QuestionRatioTab,
  ProxyTab,
} from "./subpages/MockTabs.js";

import "../../css/admin.css";

type TabId =
  | "stats"
  | "users"
  | "categories"
  | "documents"
  | "questions"
  | "students"
  | "rooms"
  | "sessions"
  | "pricing"
  | "calendar"
  | "premium"
  | "footer"
  | "contacts"
  | "ratio"
  | "proxy";

interface MenuItem {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const AdminPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>("stats");

  const menuItems: MenuItem[] = [
    { id: "stats", label: "Thống kê", icon: <BarChart2 className="w-4 h-4" /> },
    { id: "users", label: "Quản lý tài khoản", icon: <Users className="w-4 h-4" /> },
    { id: "categories", label: "Quản lý danh mục", icon: <FolderOpen className="w-4 h-4" /> },
    { id: "documents", label: "Quản lý tài liệu", icon: <FileText className="w-4 h-4" /> },
    { id: "questions", label: "Quản lý bộ câu hỏi", icon: <HelpCircle className="w-4 h-4" /> },
    { id: "students", label: "Quản lý thông tin sinh viên", icon: <GraduationCap className="w-4 h-4" /> },
    { id: "rooms", label: "Quản lý phòng thi", icon: <Home className="w-4 h-4" /> },
    { id: "sessions", label: "Quản lý ca thi", icon: <Clock className="w-4 h-4" /> },
    { id: "pricing", label: "Quản lý giá môn học", icon: <DollarSign className="w-4 h-4" /> },
    { id: "calendar", label: "Quản lý lịch", icon: <Calendar className="w-4 h-4" /> },
    { id: "premium", label: "Quản lý tài khoản cao cấp", icon: <Lock className="w-4 h-4" /> },
    { id: "footer", label: "Quản lý footer", icon: <Compass className="w-4 h-4" /> },
    { id: "contacts", label: "Quản lý nội dung liên hệ", icon: <Mail className="w-4 h-4" /> },
    { id: "ratio", label: "Tỷ lệ câu hỏi", icon: <PieChart className="w-4 h-4" /> },
    { id: "proxy", label: "Quản lý đăng ký môn", icon: <UserCheck className="w-4 h-4" /> },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "stats":
        return <DashboardTab />;
      case "users":
        return <UsersTab />;
      case "categories":
        return <CategoriesTab />;
      case "documents":
        return <DocumentsTab />;
      case "questions":
        return <QuestionsTab />;
      case "students":
        return <StudentInforTab />;
      case "rooms":
        return <RoomsTab />;
      case "sessions":
        return <SessionsTab />;
      case "pricing":
        return <PricingTab />;
      case "calendar":
        return <RemindersTab />;
      case "premium":
        return <PremiumTab />;
      case "footer":
        return <FooterTab />;
      case "contacts":
        return <ContactsTab />;
      case "ratio":
        return <QuestionRatioTab />;
      case "proxy":
        return <ProxyTab />;
      default:
        return <DashboardTab />;
    }
  };

  return (
    <div className="admin-layout shadow-sm border border-[var(--border)]">
      {/* Green Left Sidebar */}
      <aside className="admin-sidebar hidden md:flex">
        {/* Sidebar Header */}
        <div className="admin-sidebar-header">
          <Shield className="w-5 h-5 text-white" />
          <span className="font-bold text-sm tracking-wide">QUẢN TRỊ HOU</span>
        </div>

        {/* Navigation Items */}
        <nav className="admin-sidebar-nav space-y-0.5">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`admin-nav-btn hover:bg-white/10 hover:text-white ${isActive ? "active" : ""}`}
              >
                <span className="shrink-0">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="admin-main-container">
        {/* Topbar for mobile navigation or route preview */}
        <header className="admin-header w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="admin-breadcrumb-muted">Tài liệu HOU</span>
            <span className="admin-breadcrumb-separator">/</span>
            <span className="admin-breadcrumb-active">
              {menuItems.find((m) => m.id === activeTab)?.label}
            </span>
          </div>

          {/* Mobile Select dropdown for menu */}
          <div className="md:hidden">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as TabId)}
              className="admin-mobile-select text-xs px-2.5 py-1.5 rounded-lg outline-none"
            >
              {menuItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </header>

        {/* Tab Content container */}
        <main className="admin-main-content">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default AdminPage;
