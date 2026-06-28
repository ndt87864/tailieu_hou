import React, { useEffect, useState } from "react";
import apiClient from "../../../services/client.js";
import LoadingSpinner from "../../../components/common/LoadingSpinner.js";
import {
  Users,
  BookOpen,
  FileText,
  HelpCircle,
  GraduationCap,
  RefreshCw,
  TrendingUp,
  Crown,
  Star,
  Zap,
  UserCheck,
  Activity,
  BarChart3,
  FolderOpen,
  ChevronRight,
} from "lucide-react";
import "../../../css/dashboard.css";

interface Stats {
  totalUsers: number;
  roles: {
    free: number;
    plus: number;
    pro: number;
    ultra: number;
    management: number;
    admin: number;
  };
  totalCategories: number;
  totalDocuments: number;
  totalQuestions: number;
  totalStudents: number;
  activeUsers: number;
}

type RoleKey = "free" | "plus" | "pro" | "ultra" | "management" | "admin";

const ROLE_CONFIG: { key: RoleKey; label: string; color: string; icon: React.ElementType }[] = [
  { key: "free",       label: "Miễn phí", color: "#6b7280", icon: Users },
  { key: "plus",       label: "Plus",     color: "#3b82f6", icon: Star },
  { key: "pro",        label: "Pro",      color: "#8b5cf6", icon: Zap },
  { key: "ultra",      label: "Ultra",    color: "#f59e0b", icon: Crown },
  { key: "management", label: "Quản lý", color: "#10b981", icon: UserCheck },
  { key: "admin",      label: "Admin",    color: "#ef4444", icon: Activity },
];

function DonutChart({ data }: { data: { value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  const cx = 50, cy = 50, r = 38, sw = 12;
  const circ = 2 * Math.PI * r;
  let off = 0;
  const segs = data.map((d) => {
    const dash = (d.value / total) * circ;
    const seg = { ...d, dash, off };
    off += dash;
    return seg;
  });
  return (
    <svg viewBox="0 0 100 100" className="db-donut-svg">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-2)" strokeWidth={sw} />
      {segs.map((s, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none"
          stroke={s.color} strokeWidth={sw}
          strokeDasharray={`${s.dash} ${circ - s.dash}`}
          strokeDashoffset={-s.off + circ * 0.25}
          strokeLinecap="butt"
        />
      ))}
      <text x={cx} y={cy - 4} textAnchor="middle" className="db-donut-center-value">{total}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" className="db-donut-center-label">users</text>
    </svg>
  );
}

const DashboardTab: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = () => {
    setLoading(true);
    apiClient
      .get("/api/v1/admin/stats")
      .then((res) => { setStats(res.data.stats || null); setLoading(false); })
      .catch((err) => { console.error(err); setLoading(false); });
  };

  useEffect(() => { fetchStats(); }, []);

  if (loading || !stats) return <LoadingSpinner />;

  const totalPaid = stats.roles.plus + stats.roles.pro + stats.roles.ultra;
  const paidPct = stats.totalUsers > 0 ? Math.round((totalPaid / stats.totalUsers) * 100) : 0;
  const activePct = stats.totalUsers > 0 ? Math.round((stats.activeUsers / stats.totalUsers) * 100) : 0;

  const kpis = [
    { label: "Tổng người dùng",   value: stats.totalUsers,    sub: null,                  cls: "blue",   Icon: Users },
    { label: "Người dùng trả phí", value: totalPaid,          sub: `${paidPct}% tổng số`, cls: "purple", Icon: Crown },
    { label: "Đang hoạt động",    value: stats.activeUsers,   sub: `${activePct}% tổng số`, cls: "green", Icon: Activity },
    { label: "Lượt đăng ký môn",  value: stats.totalStudents, sub: null,                  cls: "amber",  Icon: GraduationCap },
  ] as const;

  const contentItems = [
    { label: "Danh mục", value: stats.totalCategories, Icon: BookOpen, cls: "indigo" },
    { label: "Tài liệu",  value: stats.totalDocuments,  Icon: FileText,   cls: "amber" },
    { label: "Câu hỏi",  value: stats.totalQuestions,  Icon: HelpCircle, cls: "rose" },
  ] as const;

  const quickLinks = [
    { label: "Quản lý tài liệu",    href: "/admin/documents",  color: "#f59e0b" },
    { label: "Quản lý bộ câu hỏi", href: "/admin/questions",  color: "#ef4444" },
    { label: "Quản lý tài khoản",  href: "/admin/users",      color: "#3b82f6" },
    { label: "Quản lý danh mục",   href: "/admin/categories", color: "#8b5cf6" },
    { label: "Thông tin sinh viên", href: "/admin/students",   color: "#10b981" },
  ];

  const donutData = ROLE_CONFIG.map((rc) => ({ value: stats.roles[rc.key] ?? 0, color: rc.color }));

  return (
    <div className="db-root">
      {/* Header */}
      <div className="db-header">
        <div>
          <h2 className="db-title">Tổng quan hệ thống</h2>
          <p className="db-subtitle">Số liệu thời gian thực · Tài liệu HOU</p>
        </div>
        <button onClick={fetchStats} className="db-refresh-btn">
          <RefreshCw className="w-3.5 h-3.5" />
          Làm mới
        </button>
      </div>

      {/* KPI Row */}
      <div className="db-kpi-grid">
        {kpis.map((k) => (
          <div key={k.label} className={`db-kpi-card db-kpi-${k.cls}`}>
            <div className={`db-kpi-icon-wrap db-kpi-icon-${k.cls}`}>
              <k.Icon className="w-5 h-5" />
            </div>
            <div className="db-kpi-body">
              <span className="db-kpi-label">{k.label}</span>
              <strong className="db-kpi-value">{k.value.toLocaleString()}</strong>
              {k.sub && <span className="db-kpi-sub">{k.sub}</span>}
            </div>
            {k.cls === "blue" && (
              <div className="db-kpi-trend">
                <TrendingUp className="w-3 h-3" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Analytics Row */}
      <div className="db-analytics-grid">
        {/* Donut + Role breakdown */}
        <div className="card db-chart-card">
          <div className="db-section-head">
            <BarChart3 className="w-4 h-4 db-section-icon" />
            <span className="db-section-title">Phân bổ vai trò</span>
          </div>
          <div className="db-donut-area">
            <DonutChart data={donutData} />
          </div>
          <div className="db-role-list">
            {ROLE_CONFIG.map((rc) => {
              const count = stats.roles[rc.key] ?? 0;
              const pct = stats.totalUsers > 0 ? Math.round((count / stats.totalUsers) * 100) : 0;
              return (
                <div key={rc.key} className="db-role-row">
                  <div className="db-role-dot" style={{ background: rc.color }} />
                  <span className="db-role-label">{rc.label}</span>
                  <div className="db-role-bar-wrap">
                    <div className="db-role-bar" style={{ width: `${pct}%`, background: rc.color }} />
                  </div>
                  <span className="db-role-count">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column */}
        <div className="db-content-col">
          {/* Content stats */}
          <div className="card db-content-card">
            <div className="db-section-head">
              <FolderOpen className="w-4 h-4 db-section-icon" />
              <span className="db-section-title">Tài nguyên ôn thi</span>
            </div>
            <div className="db-content-grid">
              {contentItems.map((ci) => (
                <div key={ci.label} className={`db-content-item db-content-${ci.cls}`}>
                  <div className="db-content-icon"><ci.Icon className="w-5 h-5" /></div>
                  <div>
                    <p className="db-content-label">{ci.label}</p>
                    <h4 className="db-content-val">{ci.value}</h4>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick access */}
          <div className="card db-quick-card">
            <div className="db-section-head">
              <Zap className="w-4 h-4 db-section-icon" />
              <span className="db-section-title">Truy cập nhanh</span>
            </div>
            <div className="db-quick-list">
              {quickLinks.map((lnk) => (
                <a key={lnk.href} href={lnk.href} className="db-quick-link">
                  <span className="db-quick-dot" style={{ background: lnk.color }} />
                  <span className="db-quick-label">{lnk.label}</span>
                  <ChevronRight className="w-3.5 h-3.5 db-quick-arrow" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardTab;
