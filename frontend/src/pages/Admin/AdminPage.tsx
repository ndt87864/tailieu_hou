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
    <div
      style={{
        display: "flex",
        height: "calc(100vh - 64px)",
        margin: "-2rem -1.25rem",
        background: "var(--bg)",
        overflow: "hidden",
      }}
      className="rounded-2xl shadow-sm border border-[var(--border)]"
    >
      {/* Green Left Sidebar */}
      <aside
        style={{
          width: "260px",
          background: "#008037",
          color: "#ffffff",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          minHeight: 0,
          overflow: "hidden",
        }}
        className="hidden md:flex"
      >
        {/* Sidebar Header */}
        <div
          style={{
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
          }}
        >
          <Shield className="w-5 h-5 text-white" />
          <span className="font-bold text-sm tracking-wide">QUẢN TRỊ HOU</span>
        </div>

        {/* Navigation Items */}
        <nav style={{ flex: 1, padding: "0.75rem", overflowY: "auto" }} className="space-y-0.5">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.625rem 0.875rem",
                  borderRadius: "0.5rem",
                  fontSize: "0.825rem",
                  fontWeight: isActive ? 600 : 500,
                  background: isActive ? "rgba(255, 255, 255, 0.15)" : "transparent",
                  color: isActive ? "#ffffff" : "rgba(255, 255, 255, 0.8)",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                }}
                className="hover:bg-white/10 hover:text-white"
              >
                <span className="shrink-0">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, overflow: "hidden" }}>
        {/* Topbar for mobile navigation or route preview */}
        <header
          style={{
            padding: "1rem 1.5rem",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface)",
            display: "flex",
            alignItems: "center",
            justifyContent: "between",
          }}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <span style={{ color: "var(--muted)", fontSize: "0.825rem" }}>Tài liệu HOU</span>
            <span style={{ color: "var(--border)" }}>/</span>
            <span style={{ color: "var(--fg)", fontSize: "0.825rem", fontWeight: 600 }}>
              {menuItems.find((m) => m.id === activeTab)?.label}
            </span>
          </div>

          {/* Mobile Select dropdown for menu */}
          <div className="md:hidden">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as TabId)}
              style={{
                background: "var(--surface)",
                color: "var(--fg)",
                border: "1px solid var(--border)",
              }}
              className="text-xs px-2.5 py-1.5 rounded-lg outline-none"
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
        <main style={{ flex: 1, padding: "1.5rem", background: "var(--bg)", overflowY: "auto" }}>
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default AdminPage;
