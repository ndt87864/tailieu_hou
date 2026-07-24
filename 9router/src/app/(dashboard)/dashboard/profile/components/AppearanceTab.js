"use client";

import { Card, Button } from "@/shared/components";
import { useTheme } from "@/shared/hooks/useTheme";
import { cn } from "@/shared/utils/cn";
import { APP_CONFIG } from "@/shared/constants/config";

export default function AppearanceTab({ handleLogout }) {
  const { theme, setTheme, primaryColor, setPrimaryColor } = useTheme();

  const themes = [
    { value: "light", label: "Giao diện Sáng", desc: "Tối ưu làm việc ban ngày", icon: "light_mode" },
    { value: "dark", label: "Giao diện Tối", desc: "Dịu mắt khi làm việc ban đêm", icon: "dark_mode" },
    { value: "system", label: "Tự động (Hệ thống)", desc: "Theo chế độ của thiết bị", icon: "contrast" },
  ];

  const colors = [
    { value: "blue", label: "Xanh dương", desc: "Cobalt cổ điển", hex: "#2563eb" },
    { value: "lime", label: "Xanh lá", desc: "Neon tươi trẻ", hex: "#39ff14" },
    { value: "red", label: "Đỏ tươi", desc: "Rực rỡ & nổi bật", hex: "#e11d48" },
    { value: "orange", label: "Cam tươi", desc: "Năng động & ấm áp", hex: "#f97316" },
    { value: "yellow", label: "Vàng nắng", desc: "Rạng rỡ & hiện đại", hex: "#eab308" },
    { value: "mint", label: "Bạc hà", desc: "Thanh lịch & dịu nhẹ", hex: "#10b981" },
    { value: "charcoal", label: "Đen xám", desc: "Tối giản & tinh tế", hex: "#475569" },
    { value: "purple", label: "Tím mộng", desc: "Sang trọng & sáng tạo", hex: "#9333ea" },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Settings Card */}
      <Card>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="size-10 sm:size-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl sm:text-2xl">palette</span>
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-text-main">Giao diện & Chủ đề</h2>
            <p className="text-xs sm:text-sm text-text-muted">Cá nhân hóa phong cách hiển thị theo sở thích của bạn</p>
          </div>
        </div>

        {/* Chế độ hiển thị */}
        <div className="mb-6">
          <label className="block text-xs sm:text-sm font-semibold text-text-main mb-2.5">
            Chế độ hiển thị
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {themes.map((t) => {
              const active = theme === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTheme(t.value)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 border text-center",
                    active
                      ? "bg-primary/10 border-primary text-primary font-semibold shadow-sm"
                      : "bg-black/5 dark:bg-white/5 border-border hover:bg-black/10 dark:hover:bg-white/10 text-text-muted hover:text-text-main"
                  )}
                >
                  <span className="material-symbols-outlined text-[22px]">
                    {t.icon}
                  </span>
                  <span className="font-semibold">{t.label}</span>
                  <span className="text-[11px] opacity-75">{t.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tông màu chủ đạo */}
        <div>
          <label className="block text-xs sm:text-sm font-semibold text-text-main mb-2.5">
            Tông màu chủ đạo
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {colors.map((c) => {
              const active = primaryColor === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setPrimaryColor(c.value)}
                  title={c.label}
                  className={cn(
                    "flex items-center gap-2.5 p-3 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 border text-left",
                    active
                      ? "bg-primary/10 border-primary text-text-main font-semibold shadow-sm"
                      : "bg-black/5 dark:bg-white/5 border-border hover:bg-black/10 dark:hover:bg-white/10 text-text-muted hover:text-text-main"
                  )}
                >
                  <span
                    className="size-5 rounded-full flex items-center justify-center shrink-0 border border-white/20 shadow-sm text-white"
                    style={{ backgroundColor: c.hex }}
                  >
                    {active && <span className="material-symbols-outlined text-[14px]">check</span>}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-xs">{c.label}</p>
                    <p className="truncate text-[10px] text-text-muted">{c.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Ghi chú */}
        <p className="text-xs text-text-muted mt-5 pt-4 border-t border-border/50 text-center">
          Mọi tùy chỉnh được tự động lưu trên trình duyệt này.
        </p>
      </Card>

      {/* Account actions */}
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10 text-red-500 shrink-0">
              <span className="material-symbols-outlined text-[20px]">account_circle</span>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold">Tài khoản & Phiên đăng nhập</h3>
              <p className="text-xs text-text-muted">Đăng xuất khỏi hệ thống quản trị bảng điều khiển</p>
            </div>
          </div>
          <div className="pt-2">
            <Button
              variant="outline"
              fullWidth
              icon="logout"
              onClick={handleLogout}
              className="text-red-500 hover:bg-red-500/10 border-red-500/20 font-semibold"
            >
              Đăng xuất tài khoản
            </Button>
          </div>
        </div>
      </Card>

      {/* App Info */}
      <div className="text-center text-xs sm:text-sm text-text-muted py-2">
        <p className="font-medium">{APP_CONFIG.name} v{APP_CONFIG.version}</p>
        <p className="mt-1 text-xs">Chế độ vận hành cục bộ (Local Mode) - Dữ liệu bảo mật tuyệt đối trên máy của bạn</p>
      </div>
    </div>
  );
}
