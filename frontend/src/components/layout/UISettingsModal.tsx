import React from "react";
import { X, Sun, Moon, Laptop, Check } from "lucide-react";
import { useUI, type ThemeMode, type PrimaryColor } from "../../context/UIContext.js";

interface UISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const UISettingsModal: React.FC<UISettingsModalProps> = ({ isOpen, onClose }) => {
  const { themeMode, primaryColor, setThemeMode, setPrimaryColor } = useUI();

  if (!isOpen) return null;

  const themes: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { value: "light", label: "Sáng", icon: <Sun className="w-4 h-4" /> },
    { value: "dark", label: "Tối", icon: <Moon className="w-4 h-4" /> },
    { value: "system", label: "Hệ thống", icon: <Laptop className="w-4 h-4" /> },
  ];

  const colors: { value: PrimaryColor; label: string; bgClass: string }[] = [
    { value: "indigo", label: "Indigo", bgClass: "bg-indigo-600" },
    { value: "blue", label: "Xanh dương", bgClass: "bg-blue-600" },
    { value: "emerald", label: "Xanh lục", bgClass: "bg-emerald-600" },
    { value: "rose", label: "Hồng", bgClass: "bg-rose-600" },
    { value: "amber", label: "Hổ phách", bgClass: "bg-amber-500" },
    { value: "purple", label: "Tím", bgClass: "bg-purple-600" },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl p-6 overflow-hidden animate-scale-in text-slate-950 dark:text-slate-50">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Tùy chỉnh giao diện</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Cá nhân hóa trải nghiệm của bạn</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Theme mode selection */}
        <div className="mb-6">
          <label className="text-sm font-semibold mb-3 block">Chế độ hiển thị</label>
          <div className="grid grid-cols-3 gap-2">
            {themes.map((t) => {
              const active = themeMode === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => setThemeMode(t.value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border text-sm font-medium transition-all duration-200 ${
                    active 
                      ? "border-brand-500 bg-brand-50/50 dark:bg-brand-950/20 text-brand-600 dark:text-brand-400 ring-2 ring-brand-500/20" 
                      : "border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {t.icon}
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Primary Color selection */}
        <div className="mb-4">
          <label className="text-sm font-semibold mb-3 block">Màu chủ đạo</label>
          <div className="grid grid-cols-3 gap-2">
            {colors.map((c) => {
              const active = primaryColor === c.value;
              return (
                <button
                  key={c.value}
                  onClick={() => setPrimaryColor(c.value)}
                  className={`flex items-center gap-2.5 p-3 rounded-2xl border text-left text-xs font-medium transition-all duration-200 ${
                    active 
                      ? "border-brand-500 bg-brand-50/50 dark:bg-brand-950/20 text-brand-600 dark:text-brand-400 ring-2 ring-brand-500/20" 
                      : "border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full ${c.bgClass} flex items-center justify-center shrink-0`}>
                    {active && <Check className="w-2.5 h-2.5 text-white" />}
                  </span>
                  <span className="truncate">{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UISettingsModal;
