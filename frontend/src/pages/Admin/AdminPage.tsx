import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
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
  X,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet
} from "lucide-react";

// Import actual subpages
import DashboardTab from "../../components/admin/DashboardTab.js";
import UsersTab from "../../components/admin/UsersTab.js";
import CategoriesTab from "../../components/admin/CategoriesTab.js";
import DocumentsTab from "../../components/admin/DocumentsTab.js";
import QuestionsTab from "../../components/admin/QuestionsTab.js";
import StudentInforTab from "../../components/admin/StudentInforTab.js";
import RoomsTab from "../../components/admin/RoomsTab.js";
import SheetsTab from "../../components/admin/SheetsTab.js";

import { SessionsTab } from "../../components/admin/SessionsTab.js";
import {
  PricingTab,
  RemindersTab,
  FooterTab,
} from "../../components/admin/MockTabs.js";

import { ContactsTab } from "../../components/admin/ContactsTab.js";
import { QuestionRatioTab } from "../../components/admin/QuestionRatioTab.js";
import { ProxyTab } from "../../components/admin/ProxyTab.js";
import { SubjectPricesTab } from "../../components/admin/SubjectPricesTab.js";
import { CrawlDataTab } from "../../components/admin/CrawlDataTab.js";
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
  | "proxy"
  | "subject_prices"
  | "crawler_courses"
  | "crawler_questions"
  | "crawler_resources"
  | "sheets";

interface MenuItem {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  desc?: string;
}

interface MenuGroup {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  items: MenuItem[];
}

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const stored = localStorage.getItem("admin-sidebar-collapsed");
    if (stored !== null) return stored === "true";
    return window.innerWidth < 1024;
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("admin-sidebar-collapsed", String(next));
      return next;
    });
  };

  const menuGroups: MenuGroup[] = [
    {
      id: "tong-quan",
      label: "Tổng quan",
      icon: <BarChart2 className="w-4 h-4" />,
      description: "Phân tích số liệu thống kê, biểu đồ hoạt động và trạng thái hệ thống.",
      items: [
        { id: "stats", label: "Thống kê", icon: <BarChart2 className="w-4 h-4" />, desc: "Theo dõi số liệu truy cập, đăng ký và tăng trưởng" },
      ],
    },
    {
      id: "nguoi-dung",
      label: "Người dùng",
      icon: <Users className="w-4 h-4" />,
      description: "Quản trị danh sách người dùng, cấp quyền, cấu hình và bảng giá các gói cước thành viên.",
      items: [
        { id: "users",    label: "Tài khoản",    icon: <Users className="w-4 h-4" />, desc: "Quản lý danh sách thành viên và phân quyền hệ thống" },
        { id: "pricing",  label: "Gói người dùng",  icon: <DollarSign className="w-4 h-4" />, desc: "Cấu hình giá và quyền lợi của các gói VIP/Premium" },
      ],
    },
    {
      id: "noi-dung",
      label: "Nội dung",
      icon: <FolderOpen className="w-4 h-4" />,
      description: "Quản lý danh mục chuyên môn, ngân hàng câu hỏi ôn thi và cơ sở dữ liệu tài liệu.",
      items: [
        { id: "categories", label: "Danh mục", icon: <FolderOpen className="w-4 h-4" />, desc: "Quản lý các chuyên mục môn học" },
        { id: "documents",  label: "Tài liệu",  icon: <FileText className="w-4 h-4" />, desc: "Quản lý các bộ tài liệu trắc nghiệm ôn tập" },
        { id: "questions",  label: "Câu hỏi",   icon: <HelpCircle className="w-4 h-4" />, desc: "Ngân hàng câu hỏi chi tiết" },
        { id: "ratio",      label: "Tỷ lệ câu hỏi", icon: <PieChart className="w-4 h-4" />, desc: "Thiết lập cấu trúc tỷ lệ hiển thị câu hỏi" },
      ],
    },
    {
      id: "crawl",
      label: "Crawl dữ liệu",
      icon: <Compass className="w-4 h-4" />,
      description: "Quản trị hệ thống quét dữ liệu tự động từ các nguồn học liệu trực tuyến LMS HOU.",
      items: [
        { id: "crawler_courses", label: "Khoá học", icon: <FolderOpen className="w-4 h-4" />, desc: "Quản lý các khóa học đã quét dữ liệu" },
        { id: "crawler_resources", label: "Tài nguyên", icon: <FileText className="w-4 h-4" />, desc: "Học liệu và tài liệu đính kèm từ LMS" },
        { id: "crawler_questions", label: "Câu hỏi", icon: <HelpCircle className="w-4 h-4" />, desc: "Ngân hàng đề thi quét tự động" },
      ],
    },
    {
      id: "thi-cu",
      label: "Thi cử",
      icon: <GraduationCap className="w-4 h-4" />,
      description: "Hệ thống quản lý lịch thi, danh sách sinh viên và cấu hình phòng thi trực tuyến.",
      items: [
        { id: "students", label: "Sinh viên",    icon: <GraduationCap className="w-4 h-4" />, desc: "Thông tin tài khoản sinh viên" },
        { id: "rooms",    label: "Phòng thi",    icon: <Home className="w-4 h-4" />, desc: "Cấu hình danh sách các phòng thi" },
        { id: "sessions", label: "Ca thi",       icon: <Clock className="w-4 h-4" />, desc: "Quản lý thời gian và lịch trình các ca thi" },
      ],
    },
    {
      id: "dang-ky-mon",
      label: "Đăng kí môn",
      icon: <UserCheck className="w-4 h-4" />,
      description: "Dịch vụ đăng ký môn hộ và quản lý chi phí cho sinh viên.",
      items: [
        { id: "proxy",    label: "Sinh viên đăng ký môn",  icon: <UserCheck className="w-4 h-4" />, desc: "Danh sách hồ sơ đăng ký môn hộ" },
        { id: "subject_prices", label: "Giá môn học", icon: <DollarSign className="w-4 h-4" />, desc: "Bảng phí đăng ký dịch vụ theo từng môn học" },
      ],
    },
    {
      id: "he-thong",
      label: "Hệ thống",
      icon: <Calendar className="w-4 h-4" />,
      description: "Cấu hình chung hệ thống, quản lý thông tin liên hệ phản hồi và đồng bộ trang tính.",
      items: [
        { id: "calendar", label: "Lịch",         icon: <Calendar className="w-4 h-4" />, desc: "Lịch nhắc nhở và sự kiện hệ thống" },
        { id: "footer",   label: "Footer",       icon: <Compass className="w-4 h-4" />, desc: "Thông tin chân trang và chính sách" },
        { id: "contacts", label: "Liên hệ",      icon: <Mail className="w-4 h-4" />, desc: "Hộp thư tiếp nhận góp ý, phản hồi của người dùng" },
        { id: "sheets",   label: "Trang tính",    icon: <FileSpreadsheet className="w-4 h-4" />, desc: "Đồng bộ trang tính Google Sheets" },
      ],
    },
  ];

  const getTabOrGroupFromPath = (): { type: "group" | "tab"; id: string } => {
    const pathParts = location.pathname.split("/").filter(Boolean);
    if (pathParts.length > 1) {
      if (pathParts[1] === "group" && pathParts[2]) {
        return { type: "group", id: pathParts[2] };
      }
      return { type: "tab", id: pathParts[1] };
    }
    return { type: "group", id: "tong-quan" };
  };

  const activeRoute = getTabOrGroupFromPath();

  const handleGroupClick = (groupId: string) => {
    navigate(`/admin/group/${groupId}`);
    setMobileOpen(false);
  };

  const isGroupActive = (group: MenuGroup) => {
    if (activeRoute.type === "group") {
      return activeRoute.id === group.id;
    }
    return group.items.some((item) => item.id === activeRoute.id);
  };

  const renderContent = () => {
    if (activeRoute.type === "group") {
      const currentGroup = menuGroups.find((g) => g.id === activeRoute.id) || menuGroups[0];
      return (
        <div className="admin-group-dashboard p-6 space-y-6">
          <div className="border-b border-[var(--border-soft)] pb-4">
            <h2 className="text-xl font-bold text-[var(--fg)] mb-1">{currentGroup.label}</h2>
            <p className="text-xs text-[var(--muted)]">{currentGroup.description}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentGroup.items.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(`/admin/${item.id}`)}
                className="flex flex-col items-start p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--brand-600)] hover:shadow-md transition-all duration-300 group text-left cursor-pointer"
              >
                <div className="w-10 h-10 rounded-lg bg-[var(--bg-2)] flex items-center justify-center mb-4 group-hover:bg-[var(--brand-50)] transition-colors">
                  <span className="text-[var(--brand-600)]">{item.icon}</span>
                </div>
                <h3 className="font-semibold text-sm text-[var(--fg)] group-hover:text-[var(--brand-600)] transition-colors">
                  {item.label}
                </h3>
                <p className="text-xs text-[var(--muted)] mt-2 line-clamp-2">
                  {item.desc || `Quản lý phân hệ ${item.label}`}
                </p>
                <div className="mt-4 text-xs font-semibold text-[var(--brand-600)] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  Truy cập ngay <ChevronRight className="w-3 h-3" />
                </div>
              </button>
            ))}
          </div>
        </div>
      );
    }

    switch (activeRoute.id) {
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
      case "subject_prices":
        return <SubjectPricesTab />;
      case "crawler_courses":
        return <CrawlDataTab view="courses" />;
      case "crawler_questions":
        return <CrawlDataTab view="questions" />;
      case "crawler_resources":
        return <CrawlDataTab view="resources" />;
      case "sheets":
        return <SheetsTab />;
      default:
        return <DashboardTab />;
    }
  };

  const getBreadcrumbLabel = () => {
    if (activeRoute.type === "group") {
      return menuGroups.find((g) => g.id === activeRoute.id)?.label;
    }
    const flatItems = menuGroups.flatMap((g) => g.items);
    return flatItems.find((item) => item.id === activeRoute.id)?.label;
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
            <div className="p-4 flex items-center justify-between border-b border-white/10 shrink-0">
              <Link to="/" className="font-bold flex items-center gap-2 text-white text-sm hover:opacity-80 transition-opacity">
                <Shield className="w-5 h-5 text-white" /> QUẢN TRỊ HOU
              </Link>
              <button onClick={() => setMobileOpen(false)} className="p-1 rounded text-white/80 hover:text-white shrink-0">
                <X className="w-6 h-6" />
              </button>
            </div>
            <nav className="px-2.5 py-3 space-y-2">
              {menuGroups.map((group) => {
                const active = isGroupActive(group);
                return (
                  <button
                    key={group.id}
                    onClick={() => handleGroupClick(group.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors text-left ${
                      active ? "bg-white/20 text-white font-bold" : "text-white/70 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span className={active ? "text-white" : "text-white/60"}>{group.icon}</span>
                    <span>{group.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </>
      )}

      {/* 2. Tablet / Collapsed Sidebar (Icons only) */}
      <aside 
        className={`admin-sidebar-bg ${isCollapsed ? "hidden md:flex" : "hidden"} w-16 shrink-0 flex-col items-center py-4 border-r border-[var(--border)] md:sticky md:top-0 md:h-[calc(100vh/0.9)] z-20`}
      >
        <div className="mb-4 text-white">
          <Shield className="w-5 h-5" />
        </div>
        <button
          onClick={toggleCollapse}
          className="mb-6 p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          title="Mở rộng sidebar"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <nav className="w-full flex flex-col items-center gap-2 px-2">
          {menuGroups.map((group) => {
            const active = isGroupActive(group);
            return (
              <button
                key={group.id}
                onClick={() => handleGroupClick(group.id)}
                title={group.label}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                  active ? "bg-white/20 text-white" : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                {group.icon}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* 3. Desktop / Expanded Sidebar (Full) */}
      <aside 
        className={`admin-sidebar-bg ${isCollapsed ? "hidden" : "hidden md:flex"} w-[260px] shrink-0 flex-col border-r md:sticky md:top-0 md:h-[calc(100vh/0.9)] z-10 animate-fade-in`}
      >
        <div className="p-4 flex items-center justify-between border-b border-white/10">
          <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <Shield className="w-5 h-5 text-white" />
            <span className="font-bold text-sm tracking-wide text-white">QUẢN TRỊ HOU</span>
          </Link>
          <button
            onClick={toggleCollapse}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title="Thu nhỏ sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
        <nav className="flex-1 px-2.5 py-3 overflow-y-auto space-y-1">
          {menuGroups.map((group) => {
            const active = isGroupActive(group);
            return (
              <button
                key={group.id}
                onClick={() => handleGroupClick(group.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left ${
                  active
                    ? "bg-white/20 text-white font-bold shadow-sm"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className={active ? "text-white" : "text-white/60"}>{group.icon}</span>
                <span className="truncate">{group.label}</span>
                {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/80" />}
              </button>
            );
          })}
          <div className="pt-4 border-t border-white/10 mt-4">
            <Link
              to="/lich-thi"
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all"
            >
              <Calendar className="w-4 h-4 text-white" />
              <span>Lịch thi</span>
            </Link>
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="admin-main-container">
        <Header 
          onOpenSettings={() => window.dispatchEvent(new Event("open-settings"))}
          onOpenProfile={() => window.dispatchEvent(new Event("open-profile"))}
          hideMobileMenuToggle={true}
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
                {getBreadcrumbLabel()}
              </span>
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
