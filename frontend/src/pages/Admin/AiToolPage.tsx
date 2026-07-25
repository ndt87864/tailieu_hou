import React, { useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Header } from "../../components/layout/Layout.js";
import { useUI } from "../../context/UIContext.js";
import { useAuth } from "../../context/AuthContext.js";

const IFRAME_ORIGINS = ["http://localhost:20128", window.location.origin];

const AiToolPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { themeMode, primaryColor } = useUI();
  const { profile, role } = useAuth();

  const url = searchParams.get("url") || "";
  const title = searchParams.get("title") || "AI Tool";

  const pushThemeToIframe = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: "PUSH_UI_SETTINGS", themeMode, primaryColor },
      "*"
    );
    if (profile) {
      iframeRef.current?.contentWindow?.postMessage(
        { type: "PUSH_USER_PROFILE", profile, role },
        "*"
      );
    }
  }, [themeMode, primaryColor, profile, role]);

  useEffect(() => {
    pushThemeToIframe();
  }, [pushThemeToIframe]);

  // Lắng nghe handshake REQUEST từ iframe
  useEffect(() => {
    const handleRequest = (event: MessageEvent) => {
      if (!IFRAME_ORIGINS.includes(event.origin)) return;
      if (!event.data || event.data.type !== "REQUEST_UI_SETTINGS") return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      (event.source as Window).postMessage(
        { type: "PUSH_UI_SETTINGS", themeMode, primaryColor },
        "*"
      );
    };
    window.addEventListener("message", handleRequest);
    return () => window.removeEventListener("message", handleRequest);
  }, [themeMode, primaryColor]);

  if (!url) {
    return (
      <div className="flex items-center justify-center h-screen text-[var(--muted)] text-sm">
        Không tìm thấy URL công cụ.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--bg)]">
      <Header
        onOpenSettings={() => window.dispatchEvent(new Event("open-settings"))}
        onOpenProfile={() => window.dispatchEvent(new Event("open-profile"))}
        leftElement={
          <span className="text-sm font-semibold text-[var(--fg)] truncate">
            {title}
          </span>
        }
      />
      <div className="flex-1 overflow-hidden">
        <iframe
          ref={iframeRef}
          src={url}
          title={title}
          className="w-full h-full border-0 block"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
          onLoad={pushThemeToIframe}
        />
      </div>
    </div>
  );
};

export default AiToolPage;
