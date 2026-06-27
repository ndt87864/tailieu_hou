import React, { useEffect, useState } from "react";
import apiClient from "../../../services/client.js";
import LoadingSpinner from "../../../components/common/LoadingSpinner.js";
import { Users, BookOpen, FileText, HelpCircle, GraduationCap, RefreshCw, BarChart2 } from "lucide-react";

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

const DashboardTab: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = () => {
    setLoading(true);
    apiClient
      .get("/api/v1/admin/stats")
      .then((res) => {
        setStats(res.data.stats || null);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading || !stats) return <LoadingSpinner />;

  // Calculate percentages for SVG chart/progress bars
  const totalPaid = stats.roles.plus + stats.roles.pro + stats.roles.ultra;
  const paidPercent = stats.totalUsers > 0 ? Math.round((totalPaid / stats.totalUsers) * 100) : 0;
  const freePercent = 100 - paidPercent;

  return (
    <div className="space-y-6">
      {/* Tab Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: "var(--fg)" }}>Thống kê người dùng</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Số liệu thống kê thời gian thực của hệ thống</p>
        </div>
        <button
          onClick={fetchStats}
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--fg-2)", fontSize: "0.75rem", fontWeight: 500, borderRadius: "0.5rem", padding: "0.4rem 0.8rem" }}
          className="flex items-center gap-1.5 hover:bg-[var(--bg-2)] transition-colors shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Làm mới
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Users */}
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p style={{ color: "var(--muted)", fontSize: "0.75rem" }}>Tổng người dùng</p>
            <h3 style={{ color: "var(--fg)" }} className="text-lg font-bold mt-0.5">{stats.totalUsers}</h3>
          </div>
        </div>

        {/* Free Users */}
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p style={{ color: "var(--muted)", fontSize: "0.75rem" }}>Người dùng miễn phí</p>
            <h3 style={{ color: "var(--fg)" }} className="text-lg font-bold mt-0.5">{stats.roles.free}</h3>
          </div>
        </div>

        {/* Pro Users */}
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p style={{ color: "var(--muted)", fontSize: "0.75rem" }}>Người dùng trả phí</p>
            <h3 style={{ color: "var(--fg)" }} className="text-lg font-bold mt-0.5">{totalPaid}</h3>
          </div>
        </div>

        {/* Active Users */}
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
            <BarChart2 className="w-5 h-5" />
          </div>
          <div>
            <p style={{ color: "var(--muted)", fontSize: "0.75rem" }}>Đang hoạt động</p>
            <h3 style={{ color: "var(--fg)" }} className="text-lg font-bold mt-0.5">{stats.activeUsers}</h3>
          </div>
        </div>

        {/* Student Records */}
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <p style={{ color: "var(--muted)", fontSize: "0.75rem" }}>Lượt đăng ký môn</p>
            <h3 style={{ color: "var(--fg)" }} className="text-lg font-bold mt-0.5">{stats.totalStudents}</h3>
          </div>
        </div>
      </div>

      {/* Analytics chart and details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Pie Chart Representation */}
        <div className="card p-5 flex flex-col items-center justify-center md:col-span-1">
          <h4 style={{ color: "var(--fg)", fontWeight: 600, fontSize: "0.875rem", width: "100%", textAlign: "left", marginBottom: "1rem" }}>Phân bổ loại người dùng</h4>
          
          <div className="relative w-36 h-36 flex items-center justify-center">
            {/* SVG Pie Chart */}
            <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
              <circle cx="18" cy="18" r="15.915" fill="none" stroke="color-mix(in srgb, var(--brand-600) 15%, transparent)" strokeWidth="4" />
              <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--brand-600)" strokeWidth="4.2"
                strokeDasharray={`${paidPercent} ${freePercent}`}
                strokeDashoffset="0"
                style={{ transition: "stroke-dasharray 0.5s ease" }}
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-2xl font-bold" style={{ color: "var(--fg)" }}>{paidPercent}%</span>
              <span style={{ color: "var(--muted)", fontSize: "0.625rem" }}>Trả phí</span>
            </div>
          </div>

          <div className="flex gap-4 mt-6 text-xs justify-center w-full">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[var(--brand-600)]"></div>
              <span style={{ color: "var(--muted)" }}>Trả phí: {totalPaid}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "color-mix(in srgb, var(--brand-600) 15%, transparent)" }}></div>
              <span style={{ color: "var(--muted)" }}>Miễn phí: {stats.roles.free}</span>
            </div>
          </div>
        </div>

        {/* Content Statistics Cards */}
        <div className="card p-5 md:col-span-2 space-y-4">
          <h4 style={{ color: "var(--fg)", fontWeight: 600, fontSize: "0.875rem" }}>Tài nguyên ôn thi</h4>
          
          <div className="grid grid-cols-3 gap-4 h-full py-2">
            <div className="p-4 rounded-2xl bg-[var(--bg-2)] flex flex-col justify-between">
              <BookOpen className="w-5 h-5 text-indigo-500 mb-2" />
              <div>
                <p style={{ color: "var(--muted)", fontSize: "0.75rem" }}>Danh mục</p>
                <h4 style={{ color: "var(--fg)", fontSize: "1.25rem", fontWeight: 700 }}>{stats.totalCategories}</h4>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--bg-2)] flex flex-col justify-between">
              <FileText className="w-5 h-5 text-amber-500 mb-2" />
              <div>
                <p style={{ color: "var(--muted)", fontSize: "0.75rem" }}>Tài liệu</p>
                <h4 style={{ color: "var(--fg)", fontSize: "1.25rem", fontWeight: 700 }}>{stats.totalDocuments}</h4>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--bg-2)] flex flex-col justify-between">
              <HelpCircle className="w-5 h-5 text-rose-500 mb-2" />
              <div>
                <p style={{ color: "var(--muted)", fontSize: "0.75rem" }}>Câu hỏi</p>
                <h4 style={{ color: "var(--fg)", fontSize: "1.25rem", fontWeight: 700 }}>{stats.totalQuestions}</h4>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardTab;
