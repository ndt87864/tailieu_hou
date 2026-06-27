import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext.js";
import apiClient from "../services/client.js";

export type ThemeMode = "light" | "dark" | "system";
export type PrimaryColor = "indigo" | "blue" | "emerald" | "rose" | "amber" | "purple";

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
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");
  const [primaryColor, setPrimaryColorState] = useState<PrimaryColor>("indigo");
  const [loadingSettings, setLoadingSettings] = useState<boolean>(true);

  // 1. Load initial settings
  useEffect(() => {
    const loadSettings = async () => {
      setLoadingSettings(true);
      if (user) {
        try {
          const res = await apiClient.get("/api/v1/auth/ui-settings");
          if (res.data) {
            setThemeModeState(res.data.theme_mode || "system");
            setPrimaryColorState(res.data.primary_color || "indigo");
          }
        } catch (err) {
          console.error("Lỗi khi tải cài đặt giao diện từ server:", err);
          // Fallback to localStorage
          loadFromLocalStorage();
        }
      } else {
        loadFromLocalStorage();
      }
      setLoadingSettings(false);
    };

    loadSettings();
  }, [user]);

  const loadFromLocalStorage = () => {
    const savedTheme = localStorage.getItem("ui-theme-mode") as ThemeMode;
    const savedColor = localStorage.getItem("ui-primary-color") as PrimaryColor;
    if (savedTheme) setThemeModeState(savedTheme);
    if (savedColor) setPrimaryColorState(savedColor);
  };

  // 2. Apply theme classes dynamically to documentElement
  useEffect(() => {
    const root = document.documentElement;

    // A. Apply Primary Color Theme class
    const colorClasses = ["theme-indigo", "theme-blue", "theme-emerald", "theme-rose", "theme-amber", "theme-purple"];
    root.classList.remove(...colorClasses);
    root.classList.add(`theme-${primaryColor}`);

    // B. Apply Light/Dark class
    const updateDarkMode = () => {
      const isDark =
        themeMode === "dark" ||
        (themeMode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

      if (isDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };

    updateDarkMode();

    // If system, watch for system preference changes
    if (themeMode === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const listener = () => updateDarkMode();
      mediaQuery.addEventListener("change", listener);
      return () => mediaQuery.removeEventListener("change", listener);
    }
  }, [themeMode, primaryColor]);

  // 3. Set and Persist Theme Mode
  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem("ui-theme-mode", mode);

    if (user) {
      try {
        await apiClient.put("/api/v1/auth/ui-settings", {
          theme_mode: mode,
          primary_color: primaryColor,
        });
      } catch (err) {
        console.error("Lỗi khi lưu cài đặt giao diện lên server:", err);
      }
    }
  };

  // 4. Set and Persist Primary Color
  const setPrimaryColor = async (color: PrimaryColor) => {
    setPrimaryColorState(color);
    localStorage.setItem("ui-primary-color", color);

    if (user) {
      try {
        await apiClient.put("/api/v1/auth/ui-settings", {
          theme_mode: themeMode,
          primary_color: color,
        });
      } catch (err) {
        console.error("Lỗi khi lưu cài đặt giao diện lên server:", err);
      }
    }
  };

  return (
    <UIContext.Provider
      value={{
        themeMode,
        primaryColor,
        setThemeMode,
        setPrimaryColor,
        loadingSettings,
      }}
    >
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) throw new Error("useUI must be used within a UIProvider");
  return context;
};
