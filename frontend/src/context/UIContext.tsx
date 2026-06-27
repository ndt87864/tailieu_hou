import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "./AuthContext.js";
import apiClient from "../services/client.js";

export type ThemeMode = "light" | "dark" | "system";
export type PrimaryColor = "green" | "blue" | "red" | "purple" | "yellow" | "brown" | "black";

const COLOR_CLASSES = [
  "theme-green", "theme-blue", "theme-red",
  "theme-purple", "theme-yellow", "theme-brown", "theme-black",
] as const;

/** Áp dụng ngay vào DOM — không phụ thuộc vào React re-render */
function applyToDom(mode: ThemeMode, color: PrimaryColor) {
  const root = document.documentElement;

  // Màu chủ đạo
  root.classList.remove(...COLOR_CLASSES);
  root.classList.add(`theme-${color}`);

  // Chế độ sáng / tối
  const isDark =
    mode === "dark" ||
    (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  isDark ? root.classList.add("dark") : root.classList.remove("dark");
}

interface UIContextType {
  themeMode: ThemeMode;
  primaryColor: PrimaryColor;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setPrimaryColor: (color: PrimaryColor) => Promise<void>;
  loadingSettings: boolean;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  // Khởi tạo từ localStorage ngay khi render lần đầu (sync)
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem("ui-theme-mode") as ThemeMode) || "system";
  });

  const [primaryColor, setPrimaryColorState] = useState<PrimaryColor>(() => {
    return (localStorage.getItem("ui-primary-color") as PrimaryColor) || "green";
  });

  const [loadingSettings, setLoadingSettings] = useState<boolean>(true);

  // Đồng bộ DOM khi state thay đổi (bao gồm lần đầu mount)
  useEffect(() => {
    applyToDom(themeMode, primaryColor);

    if (themeMode === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const listener = () => applyToDom(themeMode, primaryColor);
      mq.addEventListener("change", listener);
      return () => mq.removeEventListener("change", listener);
    }
  }, [themeMode, primaryColor]);

  // Load settings từ server khi đã đăng nhập
  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      setLoadingSettings(true);

      if (user) {
        try {
          const res = await apiClient.get("/api/v1/auth/ui-settings");
          if (!cancelled && res.data) {
            const serverTheme = (res.data.theme_mode as ThemeMode) || "system";
            const serverColor = (res.data.primary_color as PrimaryColor) || "green";
            setThemeModeState(serverTheme);
            setPrimaryColorState(serverColor);
            localStorage.setItem("ui-theme-mode", serverTheme);
            localStorage.setItem("ui-primary-color", serverColor);
            applyToDom(serverTheme, serverColor);
          }
        } catch {
          // giữ nguyên giá trị từ localStorage
        }
      }
      // Với khách: đã khởi tạo từ localStorage qua state initializer ở trên

      if (!cancelled) setLoadingSettings(false);
    };

    loadSettings();
    return () => { cancelled = true; };
  }, [user]);

  // Setter: thay đổi chế độ sáng/tối
  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem("ui-theme-mode", mode);
    applyToDom(mode, primaryColor); // áp dụng NGAY LẬP TỨC

    if (user) {
      try {
        await apiClient.put("/api/v1/auth/ui-settings", {
          theme_mode: mode,
          primary_color: primaryColor,
        });
      } catch {
        // lỗi network, bỏ qua
      }
    }
  }, [user, primaryColor]);

  // Setter: thay đổi màu chủ đạo
  const setPrimaryColor = useCallback(async (color: PrimaryColor) => {
    setPrimaryColorState(color);
    localStorage.setItem("ui-primary-color", color);
    applyToDom(themeMode, color); // áp dụng NGAY LẬP TỨC

    if (user) {
      try {
        await apiClient.put("/api/v1/auth/ui-settings", {
          theme_mode: themeMode,
          primary_color: color,
        });
      } catch {
        // lỗi network, bỏ qua
      }
    }
  }, [user, themeMode]);

  return (
    <UIContext.Provider value={{ themeMode, primaryColor, setThemeMode, setPrimaryColor, loadingSettings }}>
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) throw new Error("useUI must be used within a UIProvider");
  return context;
};
