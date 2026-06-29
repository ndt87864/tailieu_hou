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
import RoomsTab from "./subpages/RoomsTab.js";

import {
  SessionsTab,
  PricingTab,
  RemindersTab,
  FooterTab,
} from "./subpages/MockTabs.js";

// Import component ContactsTab mới
import { ContactsTab } from "./subpages/ContactsTab.js";
import { QuestionRatioTab } from "./subpages/QuestionRatioTab.js";
import { ProxyTab } from "./subpages/ProxyTab.js";
import { Header, Footer } from "../../components/layout/Layout.js";
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
  | "footer"
  | "contacts"
  | "ratio"
  | "proxy";

interface MenuItem {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
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

  const menuGroups: MenuGroup[] = [
    {
      label: "Tổng quan",
      items: [
        { id: "stats", label: "Thống kê", icon: <BarChart2 className="w-4 h-4" /> },
      ],
    },
    {
      label: "Người dùng",
      items: [
        { id: "users",    label: "Tài khoản",    icon: <Users className="w-4 h-4" /> },
      ],
    },
    {
      label: "Nội dung",
      items: [
        { id: "categories", label: "Danh mục", icon: <FolderOpen className="w-4 h-4" /> },
        { id: "documents",  label: "Tài liệu",  icon: <FileText className="w-4 h-4" /> },
        { id: "questions",  label: "Câu hỏi",   icon: <HelpCircle className="w-4 h-4" /> },
        { id: "ratio",      label: "Tỷ lệ câu hỏi", icon: <PieChart className="w-4 h-4" /> },
      ],
    },
    {
      label: "Thi cử",
      items: [
        { id: "students", label: "Sinh viên",    icon: <GraduationCap className="w-4 h-4" /> },
        { id: "rooms",    label: "Phòng thi",    icon: <Home className="w-4 h-4" /> },
        { id: "sessions", label: "Ca thi",       icon: <Clock className="w-4 h-4" /> },
      ],
    },
    {
      label: "Đăng kí môn",
       items: [
        { id: "proxy",    label: "Đăng ký môn",  icon: <UserCheck className="w-4 h-4" /> },
        { id: "pricing",  label: "Giá môn học",  icon: <DollarSign className="w-4 h-4" /> },
      ],
    },
    {
      label: "Hệ thống",
      items: [
        { id: "calendar", label: "Lịch",         icon: <Calendar className="w-4 h-4" /> },
        { id: "footer",   label: "Footer",       icon: <Compass className="w-4 h-4" /> },
        { id: "contacts", label: "Liên hệ",      icon: <Mail className="w-4 h-4" /> },
      ],
    },
  ];

  // Flat list for compatibility
  const menuItems: MenuItem[] = menuGroups.flatMap((g) => g.items);

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
            <nav className="px-2.5 py-3 space-y-0">
              {menuGroups.map((group, gi) => (
                <div key={group.label} className={gi > 0 ? "mt-3" : ""}>
                  <p className="admin-nav-group-label">{group.label}</p>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            handleTabChange(item.id);
                            setMobileOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                            isActive ? "bg-white/20 text-white font-semibold" : "text-white/70 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <span className={isActive ? "text-white" : "text-white/60"}>{item.icon}</span>
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </>
      )}

      {/* 2. Tablet Sidebar - Icons only */}
      <aside 
        className="admin-sidebar-bg hidden md:flex lg:hidden w-16 shrink-0 flex-col items-center py-4 border-r border-[var(--border)] md:sticky md:top-0 md:h-[calc(100vh/0.9)] z-20"
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

      {/* 3. Desktop Sidebar - Full, Grouped */}
      <aside 
        className="admin-sidebar-bg hidden lg:flex w-[260px] shrink-0 flex-col border-r border-[var(--border)] lg:sticky lg:top-0 lg:h-[calc(100vh/0.9)] z-10"
      >
        <div className="p-4 flex items-center gap-2.5 border-b border-white/10">
          <Shield className="w-5 h-5 text-white" />
          <span className="font-bold text-sm tracking-wide text-white">QUẢN TRỊ HOU</span>
        </div>
        <nav className="flex-1 px-2.5 py-3 overflow-y-auto">
          {menuGroups.map((group, gi) => (
            <div key={group.label} className={gi > 0 ? "mt-3" : ""}>
              <p className="admin-nav-group-label">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleTabChange(item.id)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all text-left ${
                        isActive
                          ? "bg-white/20 text-white font-semibold shadow-sm"
                          : "text-white/70 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <span className={isActive ? "text-white" : "text-white/60"}>{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                      {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/80" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="admin-main-container">
        <Header 
          onOpenSettings={() => window.dispatchEvent(new Event("open-settings"))}
          onOpenProfile={() => window.dispatchEvent(new Event("open-profile"))}
          leftElement={
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setMobileOpen(true)}
                className="admin-menu-btn-mobile md:hidden p-1.5 rounded-lg hover:bg-[var(--bg-2)] transition-colors mr-1 shrink-0"
              >
                <Menu className="w-5 h-5 text-[var(--fg)]" />
              </button>
              <span className="admin-breadcrumb-muted shrink-0">Quản trị</span>
              <span className="admin-breadcrumb-separator shrink-0">/</span>
              <span className="admin-breadcrumb-active truncate">
                {menuItems.find((m) => m.id === activeTab)?.label}
              </span>
            </div>
          }
          rightElement={
            <div className="md:hidden shrink-0">
              <select
                value={activeTab}
                onChange={(e) => handleTabChange(e.target.value as TabId)}
                className="admin-mobile-select text-xs px-2.5 py-1.5 rounded-lg outline-none border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)]"
              >
                {menuItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          }
        />

        {/* Tab Content container */}
        <main className="admin-main-content">
          {renderContent()}
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default AdminPage;
