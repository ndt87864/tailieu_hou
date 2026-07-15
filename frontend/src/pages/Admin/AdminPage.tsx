import React, { useState, useEffect, useRef } from "react";
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
  FileSpreadsheet,
  Search
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
import { Header } from "../../components/layout/Layout.js";
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
  const [isHovered, setIsHovered] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true); // Mặc định luôn thu gọn giống user sidebar
  const [pageSearchQuery, setPageSearchQuery] = useState("");
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSearchSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
        if (pathParts[2] === "tong-quan") {
          return { type: "tab", id: "stats" };
        }
        return { type: "group", id: pathParts[2] };
      }
      return { type: "tab", id: pathParts[1] };
    }
    return { type: "tab", id: "stats" };
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
                className="flex flex-col items-start p-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--brand-600)] hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group text-left cursor-pointer relative overflow-hidden w-full"
              >
                {/* Subtle Hover Gradient Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--brand-600)]/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                <div className="w-11 h-11 rounded-2xl bg-[var(--bg-2)] flex items-center justify-center mb-5 group-hover:bg-[var(--brand-600)] group-hover:text-white transition-all duration-300 shadow-sm shrink-0">
                  <span className="text-[var(--brand-600)] group-hover:text-white transition-colors duration-300">{item.icon}</span>
                </div>
                <h3 className="font-bold text-sm md:text-base text-[var(--fg)] group-hover:text-[var(--brand-600)] transition-colors duration-300 leading-snug">
                  {item.label}
                </h3>
                <p className="text-xs text-[var(--muted)] mt-2.5 line-clamp-3 leading-relaxed flex-1 w-full">
                  {item.desc || `Quản lý phân hệ ${item.label}`}
                </p>
                <div className="mt-5 pt-3.5 border-t border-[var(--border-soft)] w-full text-xs font-bold text-[var(--brand-600)] flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0">
                  <span>Truy cập ngay</span> 
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
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

  const getBreadcrumbs = () => {
    const route = getTabOrGroupFromPath();
    if (route.type === "group") {
      const group = menuGroups.find((g) => g.id === route.id);
      return {
        parent: group ? group.label : "Quản trị",
        child: ""
      };
    } else {
      const group = menuGroups.find((g) => g.items.some((item) => item.id === route.id));
      const item = group?.items.find((item) => item.id === route.id);
      return {
        parent: group ? group.label : "Quản trị",
        child: item ? item.label : ""
      };
    }
  };

  // Get all searchable menu items
  const allSearchableItems = menuGroups.flatMap((group) => 
    group.items.map((item) => ({
      ...item,
      groupLabel: group.label,
      groupId: group.id
    }))
  );

  const filteredSearchItems = pageSearchQuery.trim()
    ? allSearchableItems.filter((item) => 
        item.label.toLowerCase().includes(pageSearchQuery.toLowerCase()) ||
        (item.desc && item.desc.toLowerCase().includes(pageSearchQuery.toLowerCase())) ||
        item.groupLabel.toLowerCase().includes(pageSearchQuery.toLowerCase())
      )
    : [];

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

      {/* Desktop Layout Spacer (ngăn dịch chuyển layout khi hover sidebar) */}
      <div 
        className={`hidden md:block shrink-0 admin-sidebar-transition ${isCollapsed ? "w-16" : "w-[260px]"}`} 
      />

      {/* Unified Desktop Sidebar with Hover Expand */}
      <aside 
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`hidden md:flex flex-col border-r border-white/10 fixed top-0 bottom-0 left-0 z-[60] admin-sidebar-bg admin-sidebar-transition ${
          isCollapsed 
            ? isHovered 
              ? "w-[260px] shadow-2xl" 
              : "w-16" 
            : "w-[260px]"
        }`}
      >
        <div className="p-4 flex items-center justify-between border-b border-white/10 shrink-0 h-14 overflow-hidden">
          <Link 
            to="/" 
            className={`flex items-center hover:opacity-80 transition-opacity ${
              isCollapsed && !isHovered ? "justify-center w-full" : ""
            }`}
          >
            <Shield className="w-5 h-5 text-white shrink-0" />
            <span className={`transition-all duration-300 font-bold text-sm tracking-wide text-white truncate ${
              isCollapsed && !isHovered ? "opacity-0 w-0 ml-0 pointer-events-none" : "opacity-100 ml-2.5"
            }`}>
              QUẢN TRỊ HOU
            </span>
          </Link>
        </div>
        <nav className="flex-1 px-2.5 py-3 overflow-y-auto space-y-1 scrollbar-thin w-full">
          {menuGroups.map((group) => {
            const active = isGroupActive(group);
            return (
              <button
                key={group.id}
                onClick={() => handleGroupClick(group.id)}
                title={isCollapsed && !isHovered ? group.label : undefined}
                className={`w-full flex items-center rounded-lg text-xs font-semibold transition-all text-left ${
                  isCollapsed && !isHovered ? "justify-center h-10 px-0" : "px-3 py-2"
                } ${
                  active
                    ? "bg-white/20 text-white font-bold shadow-sm"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className={`${active ? "text-white" : "text-white/60"} shrink-0`}>{group.icon}</span>
                <span className={`transition-all duration-300 truncate ${
                  isCollapsed && !isHovered ? "opacity-0 w-0 ml-0 pointer-events-none" : "opacity-100 ml-2.5"
                }`}>
                  {group.label}
                </span>
                {active && (!isCollapsed || isHovered) && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/80 shrink-0" />
                )}
              </button>
            );
          })}

        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="admin-main-container">
        <Header 
          onOpenSettings={() => window.dispatchEvent(new Event("open-settings"))}
          onOpenProfile={() => window.dispatchEvent(new Event("open-profile"))}
          hideMobileMenuToggle={true}
          leftElement={
            <div className="flex items-center gap-1 min-w-0 shrink-0">
              <button
                onClick={() => setMobileOpen(true)}
                className="admin-menu-btn-mobile md:hidden p-1.5 rounded-lg hover:bg-[var(--bg-2)] transition-colors shrink-0 animate-fade-in"
              >
                <Menu className="w-5 h-5 text-[var(--fg)]" />
              </button>
              {(() => {
                const crumbs = getBreadcrumbs();
                return (
                  <>
                    <span className="admin-breadcrumb-muted shrink-0 truncate max-w-[80px] sm:max-w-none">{crumbs.parent}</span>
                    {crumbs.child && (
                      <>
                        <span className="admin-breadcrumb-separator shrink-0">/</span>
                        <span className="admin-breadcrumb-active truncate max-w-[120px] sm:max-w-none">
                          {crumbs.child}
                        </span>
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          }
          rightElement={
            /* Quick Search admin pages next to user icon */
            <div className="relative w-36 xs:w-44 sm:w-60 md:w-64" ref={searchContainerRef}>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted)] pointer-events-none" />
                <input
                  type="text"
                  placeholder="Tìm trang..."
                  value={pageSearchQuery}
                  onChange={(e) => {
                    setPageSearchQuery(e.target.value);
                    setShowSearchSuggestions(true);
                  }}
                  onFocus={() => setShowSearchSuggestions(true)}
                  className="w-full pl-8 pr-7 py-1.5 bg-[var(--bg-2)] border border-[var(--border)] rounded-full text-xs text-[var(--fg)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--brand-500)] focus:ring-1 focus:ring-[var(--brand-500)] transition-all"
                />
                {pageSearchQuery && (
                  <button 
                    onClick={() => setPageSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 border-none bg-transparent text-[var(--muted)] hover:text-[var(--fg)] p-0 cursor-pointer flex items-center justify-center"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Search Suggestions Dropdown aligned to right */}
              {showSearchSuggestions && filteredSearchItems.length > 0 && (
                <div className="absolute top-full right-0 mt-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xl z-[90] max-h-60 overflow-y-auto p-1.5 space-y-0.5 animate-fade-in scrollbar-thin w-[200px] xs:w-[240px] sm:w-[320px] md:w-[360px]">
                  {filteredSearchItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        navigate(`/admin/${item.id}`);
                        setPageSearchQuery("");
                        setShowSearchSuggestions(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-[var(--bg-2)] flex items-start gap-2.5 transition-colors cursor-pointer group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-[var(--bg)] flex items-center justify-center text-[var(--brand-600)] group-hover:bg-[var(--brand-600)] group-hover:text-white transition-all shrink-0">
                        {item.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[var(--fg)] group-hover:text-[var(--brand-600)] transition-colors truncate">
                            {item.label}
                          </span>
                          <span className="text-[9px] text-[var(--muted)] bg-[var(--bg-2)] px-1.5 py-0.5 rounded-md font-medium shrink-0 ml-1">
                            {item.groupLabel}
                          </span>
                        </div>
                        {item.desc && (
                          <p className="text-[10px] text-[var(--muted)] truncate mt-0.5">
                            {item.desc}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          }
        />

        {/* Tab Content container */}
        <main className="admin-main-content">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default AdminPage;
