"use client";

import { useEffect } from "react";
import useThemeStore from "@/store/themeStore";

export function ThemeProvider({ children }) {
  const { initTheme, setTheme, setPrimaryColor } = useThemeStore();

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleMessage = (event) => {
      // Xác minh message đến từ parent (không phải từ window chính hoặc bên thứ 3)
      if (event.source !== window.parent) return;
      if (!event.data || event.data.type !== "PUSH_UI_SETTINGS") return;

      const { themeMode, primaryColor } = event.data;
      if (themeMode) setTheme(themeMode);
      if (primaryColor) setPrimaryColor(primaryColor);
    };

    window.addEventListener("message", handleMessage);

    // Sau khi listener sẵn sàng, yêu cầu parent gửi settings xuống (handshake)
    if (window.self !== window.top) {
      window.parent.postMessage({ type: "REQUEST_UI_SETTINGS" }, "*");
    }

    return () => window.removeEventListener("message", handleMessage);
  }, [setTheme, setPrimaryColor]);

  return <>{children}</>;
}
