import React from "react";
import { X, Sun, Moon, Laptop, Check, Monitor, Tablet, Smartphone, Maximize } from "lucide-react";
import { useUI, type ThemeMode, type PrimaryColor, type ViewMode } from "../../context/UIContext.js";
import "../../css/modal.css";


interface UISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const UISettingsModal: React.FC<UISettingsModalProps> = ({ isOpen, onClose }) => {
  const { themeMode, primaryColor, viewMode, setThemeMode, setPrimaryColor, setViewMode } = useUI();

  if (!isOpen) return null;

  const themes: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { value: "light",  label: "Sáng",     icon: <Sun    className="w-4 h-4" /> },
    { value: "dark",   label: "Tối",      icon: <Moon   className="w-4 h-4" /> },
    { value: "system", label: "Hệ thống", icon: <Laptop className="w-4 h-4" /> },
  ];

  const viewModes: { value: ViewMode; label: string; icon: React.ReactNode }[] = [
    { value: "responsive", label: "Tự động", icon: <Maximize className="w-4 h-4" /> },
    { value: "desktop",    label: "Máy tính", icon: <Monitor className="w-4 h-4" /> },
    { value: "tablet",     label: "M.tính bảng", icon: <Tablet className="w-4 h-4" /> },
    { value: "mobile",     label: "Điện thoại", icon: <Smartphone className="w-4 h-4" /> },
  ];

  // Bảng màu giống hệt tailieu-ehou
  const colors: { value: PrimaryColor; label: string; hex: string }[] = [
    { value: "green",  label: "Xanh lá",    hex: "#118d05" },
    { value: "blue",   label: "Xanh dương", hex: "#0066cc" },
    { value: "red",    label: "Đỏ",         hex: "#cc0000" },
    { value: "purple", label: "Tím",        hex: "#6600cc" },
    { value: "yellow", label: "Vàng",       hex: "#ccbb00" },
    { value: "brown",  label: "Nâu",        hex: "#996633" },
    { value: "black",  label: "Đen",        hex: "#333333" },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-sm transition-opacity duration-300 modal-backdrop"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-sm rounded-2xl p-6 animate-scale-in modal-container"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="modal-title">
              Tùy chỉnh giao diện
            </h2>
            <p className="modal-subtitle">
              Cá nhân hóa trải nghiệm của bạn
            </p>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-[var(--bg-2)] transition-colors modal-close-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chế độ hiển thị */}
        <div className="mb-5">
          <label className="ui-settings-modal-label">
            Chế độ hiển thị
          </label>
          <div className="grid grid-cols-3 gap-2">
            {themes.map((t) => {
              const active = themeMode === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => setThemeMode(t.value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl text-xs font-medium transition-all duration-200 ${
                    active ? "ui-settings-btn-option-active" : "ui-settings-btn-option"
                  }`}
                >
                  {t.icon}
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chế độ hiển thị (Thiết bị) */}
        <div className="mb-5">
          <label className="ui-settings-modal-label">
            Mô phỏng thiết bị
          </label>
          <div className="grid grid-cols-4 gap-2">
            {viewModes.map((v) => {
              const active = viewMode === v.value;
              return (
                <button
                  key={v.value}
                  onClick={() => setViewMode(v.value)}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-xl text-[10px] font-medium transition-all duration-200 ${
                    active ? "ui-settings-btn-option-active" : "ui-settings-btn-option"
                  }`}
                >
                  {v.icon}
                  <span className="truncate w-full text-center">{v.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Màu chủ đạo */}
        <div>
          <label className="ui-settings-modal-label">
            Màu hệ thống
          </label>
          <div className="grid grid-cols-4 gap-2">
            {colors.map((c) => {
              const active = primaryColor === c.value;
              return (
                <button
                  key={c.value}
                  onClick={() => setPrimaryColor(c.value)}
                  title={c.label}
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl text-xs font-medium transition-all duration-200 ui-settings-color-btn ui-settings-color-btn-${c.value} ${
                    active ? "ui-settings-color-active active" : "ui-settings-btn-option"
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ui-settings-color-circle ui-settings-color-circle-${c.value} ${
                      active ? "active" : ""
                    }`}
                  >
                    {active && <Check className="w-3 h-3 text-white" />}
                  </span>
                  <span className="truncate text-[0.65rem]">{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Note */}
        <p className="ui-settings-note">
          Thiết lập được lưu tự động. Tài khoản khách lưu trên trình duyệt.
        </p>
      </div>
    </div>
  );
};

export default UISettingsModal;
