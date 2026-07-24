"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { THEME_CONFIG } from "@/shared/constants/config";

const COLOR_CLASSES = [
  "theme-blue", "theme-lime", "theme-red",
  "theme-orange", "theme-yellow", "theme-mint", "theme-charcoal", "theme-purple",
];

const COLOR_MAP = {
  blue: { brand500: "#3b82f6", brand600: "#2563eb" },
  lime: { brand500: "#84cc16", brand600: "#65a30d" },
  red: { brand500: "#f43f5e", brand600: "#e11d48" },
  orange: { brand500: "#fb923c", brand600: "#f97316" },
  yellow: { brand500: "#eab308", brand600: "#ca8a04" },
  mint: { brand500: "#10b981", brand600: "#059669" },
  charcoal: { brand500: "#64748b", brand600: "#475569" },
  purple: { brand500: "#a855f7", brand600: "#9333ea" },
};

function applyTheme(theme, color = "blue") {
  if (typeof window === "undefined") return;

  const root = document.documentElement;
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  const effectiveTheme = theme === "system" ? systemTheme : theme;

  if (effectiveTheme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  COLOR_CLASSES.forEach((cls) => root.classList.remove(cls));
  root.classList.add(`theme-${color}`);

  const palette = COLOR_MAP[color] || COLOR_MAP.blue;
  root.style.setProperty("--color-brand-500", palette.brand500);
  root.style.setProperty("--color-brand-600", palette.brand600);
  root.style.setProperty("--color-primary", palette.brand500);
}

/** Gửi settings lên parent khi 9router đang chạy trong iframe */
function notifyParent(theme, primaryColor) {
  if (typeof window === "undefined") return;
  if (window.self === window.top) return; // không phải iframe, bỏ qua
  window.parent.postMessage(
    { type: "SYNC_UI_SETTINGS", themeMode: theme, primaryColor },
    "*" // cross-origin: parent có thể ở port khác
  );
}

const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: THEME_CONFIG.defaultTheme,
      primaryColor: "blue",

      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme, get().primaryColor);
        notifyParent(theme, get().primaryColor);
      },

      setPrimaryColor: (color) => {
        set({ primaryColor: color });
        applyTheme(get().theme, color);
        notifyParent(get().theme, color);
      },

      toggleTheme: () => {
        const currentTheme = get().theme;
        const newTheme = currentTheme === "dark" ? "light" : "dark";
        set({ theme: newTheme });
        applyTheme(newTheme, get().primaryColor);
        notifyParent(newTheme, get().primaryColor);
      },

      initTheme: () => {
        const { theme, primaryColor } = get();
        applyTheme(theme, primaryColor || "blue");
      },
    }),
    {
      name: THEME_CONFIG.storageKey,
    }
  )
);


export default useThemeStore;
