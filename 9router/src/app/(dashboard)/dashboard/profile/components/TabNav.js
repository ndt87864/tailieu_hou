"use client";

import { cn } from "@/shared/utils/cn";

export const SETTINGS_TABS = [
  { id: "appearance", label: "Giao diện", icon: "palette" },
  { id: "data", label: "Dữ liệu & Sao lưu", icon: "database" },
  { id: "security", label: "Bảo mật & SSO", icon: "shield" },
  { id: "routing", label: "Định tuyến AI", icon: "route" },
  { id: "network", label: "Mạng & Giám sát", icon: "wifi" },
];

export default function TabNav({ activeTab, onChangeTab }) {
  return (
    <div className="flex overflow-x-auto no-scrollbar gap-1 sm:gap-2 p-1.5 rounded-xl bg-black/5 dark:bg-white/5 border border-border/50 mb-6">
      {SETTINGS_TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChangeTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg font-medium text-xs sm:text-sm transition-all whitespace-nowrap flex-1 justify-center",
              isActive
                ? "bg-white dark:bg-white/10 text-primary shadow-sm font-semibold"
                : "text-text-muted hover:text-text-main hover:bg-black/5 dark:hover:bg-white/5"
            )}
          >
            <span className={cn("material-symbols-outlined text-[18px] sm:text-[20px]", isActive && "fill-1")}>
              {tab.icon}
            </span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
