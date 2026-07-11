import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext.js";
import apiClient from "../services/client.js";
import { cachedGet } from "../utils/apiCache.js";

export type ThemeMode = "light" | "dark" | "system";
export type PrimaryColor = "green" | "blue" | "red" | "purple" | "yellow" | "brown" | "black";
export type ViewMode = "responsive" | "desktop" | "tablet" | "mobile";

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
  viewMode: ViewMode;
  lessonMode: boolean;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setPrimaryColor: (color: PrimaryColor) => Promise<void>;
  setViewMode: (mode: ViewMode) => void;
  setLessonMode: (mode: boolean) => void;
  loadingSettings: boolean;
  pageLoading: boolean;
  setPageLoading: (loading: boolean) => void;
  navigateWithPrefetch: (docId: string, customLessonMode?: boolean) => Promise<void>;
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

  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    if (window.self !== window.top) {
      return "responsive";
    }
    return (localStorage.getItem("ui-view-mode") as ViewMode) || "responsive";
  });

  const [lessonMode, setLessonModeState] = useState<boolean>(() => {
    return localStorage.getItem("ui-lesson-mode") === "true";
  });

  const [loadingSettings, setLoadingSettings] = useState<boolean>(true);
  const [pageLoading, setPageLoading] = useState<boolean>(false);

  // Sync settings when receiving messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!event.data) return;

      if (event.data.type === "SYNC_VIEW_MODE") {
        setViewModeState(event.data.mode);
      } else if (event.data.type === "SYNC_UI_SETTINGS") {
        const { themeMode: newTheme, primaryColor: newColor } = event.data;
        if (newTheme) setThemeModeState(newTheme);
        if (newColor) setPrimaryColorState(newColor);
        applyToDom(newTheme || themeMode, newColor || primaryColor);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [themeMode, primaryColor]);

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
          const cachedTheme = localStorage.getItem("ui-theme-mode");
          const cachedColor = localStorage.getItem("ui-primary-color");
          const settingsSynced = localStorage.getItem("ui-settings-synced");

          if (settingsSynced === user.id && cachedTheme && cachedColor) {
            setThemeModeState(cachedTheme as ThemeMode);
            setPrimaryColorState(cachedColor as PrimaryColor);
            applyToDom(cachedTheme as ThemeMode, cachedColor as PrimaryColor);
            if (!cancelled) setLoadingSettings(false);
            return;
          }

          const res = await apiClient.get("/api/v1/auth/ui-settings");
          if (!cancelled && res.data) {
            const serverTheme = (res.data.theme_mode as ThemeMode) || "system";
            const serverColor = (res.data.primary_color as PrimaryColor) || "green";
            setThemeModeState(serverTheme);
            setPrimaryColorState(serverColor);
            localStorage.setItem("ui-theme-mode", serverTheme);
            localStorage.setItem("ui-primary-color", serverColor);
            localStorage.setItem("ui-settings-synced", user.id);
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

    if (window.self !== window.top) {
      window.parent.postMessage({ type: "SYNC_UI_SETTINGS", themeMode: mode, primaryColor }, window.location.origin);
    }

    if (user) {
      localStorage.setItem("ui-settings-synced", user.id);
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

    if (window.self !== window.top) {
      window.parent.postMessage({ type: "SYNC_UI_SETTINGS", themeMode, primaryColor: color }, window.location.origin);
    }

    if (user) {
      localStorage.setItem("ui-settings-synced", user.id);
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

  // Setter: thay đổi view mode (desktop, tablet, mobile)
  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    localStorage.setItem("ui-view-mode", mode);

    if (window.self !== window.top) {
      window.parent.postMessage({ type: "SYNC_VIEW_MODE", mode }, window.location.origin);
    }
  }, []);

  const setLessonMode = useCallback((mode: boolean) => {
    setLessonModeState(mode);
    localStorage.setItem("ui-lesson-mode", String(mode));
  }, []);

  const navigate = useNavigate();

  const navigateWithPrefetch = useCallback(async (docId: string, customLessonMode?: boolean) => {
    const isLms = customLessonMode !== undefined ? customLessonMode : lessonMode;
    setPageLoading(true);
    // Yield the thread to let React render and browser paint the progress bar immediately
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      if (isLms) {
        // Prefetch metadata
        const metaRes = await cachedGet<{ document: any; courses: any[]; weeks: any[] }>(`/api/v1/documents/${docId}/lessons/metadata`);
        const courses = metaRes.data.courses || [];
        const weeks = metaRes.data.weeks || [];
        if (courses.length > 0 && weeks.length > 0) {
          const courseParams = [courses[0].id].join(",");
          const weekParams = [weeks[0]].join(",");
          // Prefetch resources
          await cachedGet(`/api/v1/documents/${docId}/lessons/resources?course_ids=${courseParams}&weeks=${encodeURIComponent(weekParams)}`);
        }
      } else {
        // Prefetch document and questions
        await Promise.all([
          cachedGet(`/api/v1/documents/${docId}`),
          cachedGet(`/api/v1/questions/document/${docId}/limited`),
        ]);
      }
      navigate(`/documents/${docId}`);
    } catch (err) {
      console.error("Prefetch error:", err);
      // Fallback navigation
      navigate(`/documents/${docId}`);
    } finally {
      setPageLoading(false);
    }
  }, [navigate, lessonMode]);

  return (
    <UIContext.Provider
      value={{
        themeMode,
        primaryColor,
        viewMode,
        lessonMode,
        setThemeMode,
        setPrimaryColor,
        setViewMode,
        setLessonMode,
        loadingSettings,
        pageLoading,
        setPageLoading,
        navigateWithPrefetch,
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
