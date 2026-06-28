import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
  Menu,
  X
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
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const getTabFromPath = (): TabId => {
    const pathParts = location.pathname.split("/").filter(Boolean);
    if (pathParts.length > 1) {
      const subpath = pathParts[1];
      const validTabIds: TabId[] = [
        "stats",
        "users",
        "categories",
        "documents",
        "questions",
        "students",
        "rooms",
        "sessions",
        "pricing",
        "calendar",
        "premium",
        "footer",
        "contacts",
        "ratio",
        "proxy",
      ];
      if (validTabIds.includes(subpath as TabId)) {
        return subpath as TabId;
      }
    }
    return "stats";
  };

  const activeTab = getTabFromPath();

  const handleTabChange = (tabId: TabId) => {
    if (tabId === "stats") {
      navigate("/admin");
    } else {
      navigate(`/admin/${tabId}`);
    }
  };

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
    <div className="admin-layout shadow-sm border border-[var(--border)] relative">
      {/* 1. Mobile Drawer Overlay */}
      {mobileOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 z-[60] md:hidden backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div 
            className="admin-sidebar-bg fixed inset-y-0 left-0 w-64 z-[70] md:hidden shadow-2xl overflow-y-auto flex flex-col animate-slide-right"
          >
            <div className="p-4 flex items-center justify-between border-b border-white/10">
              <span className="font-bold flex items-center gap-2 text-white text-sm">
                <Shield className="w-5 h-5 text-white" /> QUẢN TRỊ HOU
              </span>
              <button onClick={() => setMobileOpen(false)} className="p-1 rounded text-white/80 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <nav className="p-3 space-y-1">
              {menuItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      handleTabChange(item.id);
                      setMobileOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-xs font-semibold transition-colors text-left ${
                      isActive ? "bg-white/20 text-white" : "text-white/80 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </>
      )}

      {/* 2. Tablet Sidebar - Icons only */}
      <aside 
        className="admin-sidebar-bg hidden md:flex lg:hidden w-16 shrink-0 flex-col items-center py-4 border-r border-[var(--border)]"
      >
        <div className="mb-6 text-white">
          <Shield className="w-5 h-5" />
        </div>
        <nav className="w-full flex flex-col items-center gap-2 px-2">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                title={item.label}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                  isActive ? "bg-white/20 text-white" : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.icon}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* 3. Desktop Sidebar - Full */}
      <aside 
        className="admin-sidebar-bg hidden lg:flex w-[260px] shrink-0 flex-col border-r border-[var(--border)]"
      >
        <div className="p-4 flex items-center gap-2.5 border-b border-white/10 mb-2">
          <Shield className="w-5 h-5 text-white" />
          <span className="font-bold text-sm tracking-wide text-white">QUẢN TRỊ HOU</span>
        </div>
        <nav className="flex-1 p-3 overflow-y-auto space-y-1">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-xs font-semibold transition-colors text-left ${
                  isActive ? "bg-white/20 text-white" : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.icon}
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
            <button
              onClick={() => setMobileOpen(true)}
              className="admin-menu-btn-mobile md:hidden p-1.5 rounded-lg hover:bg-[var(--bg-2)] transition-colors mr-1"
            >
              <Menu className="w-5 h-5" />
            </button>
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
              onChange={(e) => handleTabChange(e.target.value as TabId)}
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
