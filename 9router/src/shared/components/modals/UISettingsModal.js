"use client";

import PropTypes from "prop-types";
import useThemeStore from "@/store/themeStore";

export default function UISettingsModal({ isOpen, onClose }) {
  const { theme, setTheme, primaryColor, setPrimaryColor } = useThemeStore();

  if (!isOpen) return null;

  const themes = [
    { value: "light", label: "Sáng", icon: "light_mode" },
    { value: "dark", label: "Tối", icon: "dark_mode" },
    { value: "system", label: "Hệ thống", icon: "desktop_windows" },
  ];

  const colors = [
    { value: "blue", label: "Xanh dương", hex: "#2563eb" },
    { value: "lime", label: "Neon green", hex: "#39ff14" },
    { value: "red", label: "Đỏ tươi", hex: "#e11d48" },
    { value: "orange", label: "Cam tươi", hex: "#f97316" },
    { value: "yellow", label: "Vàng", hex: "#eab308" },
    { value: "mint", label: "Bạc hà", hex: "#10b981" },
    { value: "charcoal", label: "Đen xám", hex: "#475569" },
    { value: "purple", label: "Tím", hex: "#9333ea" },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-sm rounded-2xl p-6 bg-surface border border-border shadow-2xl text-text-main animate-scale-in z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-5 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-brand-600 text-[22px]">settings</span>
            <div>
              <h2 className="font-bold text-sm md:text-base text-text-main">Tùy chỉnh giao diện</h2>
              <p className="text-[11px] text-text-muted">Cá nhân hóa trải nghiệm của bạn</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-2 text-text-muted hover:text-text-main transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Chế độ hiển thị */}
        <div className="mb-5">
          <label className="block text-[11px] font-bold text-text-muted mb-2">
            Chế độ hiển thị
          </label>
          <div className="grid grid-cols-3 gap-2">
            {themes.map((t) => {
              const active = theme === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTheme(t.value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl text-xs font-medium border transition-all duration-200 ${
                    active
                      ? "bg-brand-600/10 text-brand-600 border-brand-600 shadow-sm font-bold"
                      : "bg-surface-2 text-text-muted border-border hover:bg-surface-3 hover:text-text-main"
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Màu chủ đạo */}
        <div className="mb-5">
          <label className="block text-[11px] font-bold text-text-muted mb-2">
            Màu giao diện chủ đạo
          </label>
          <div className="grid grid-cols-4 gap-2.5">
            {colors.map((c) => {
              const active = primaryColor === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setPrimaryColor(c.value)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-[10px] font-medium transition-all ${
                    active
                      ? "border-brand-600 bg-surface-2 shadow-sm font-bold"
                      : "border-border hover:border-border-strong bg-surface-2/50"
                  }`}
                >
                  <div
                    className="w-5 h-5 rounded-full border border-black/10 shadow-inner flex items-center justify-center"
                    style={{ backgroundColor: c.hex }}
                  >
                    {active && (
                      <span className="material-symbols-outlined text-white text-[12px] font-bold">
                        check
                      </span>
                    )}
                  </div>
                  <span className="text-text-muted truncate max-w-full">{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Close Button */}
        <div className="flex justify-end pt-3 border-t border-border/60">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-md transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

UISettingsModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};
