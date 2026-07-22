"use client";

import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/utils/cn";
import { APP_CONFIG } from "@/shared/constants/config";
import { MEDIA_PROVIDER_KINDS } from "@/shared/constants/providers";
import Button from "./Button";
import useSettingsStore from "@/store/settingsStore";

const VISIBLE_MEDIA_KINDS = ["embedding", "image", "video", "tts", "stt"];
const COMBINED_WEB_ITEM = { id: "web", label: "Web Fetch & Search", icon: "travel_explore", href: "/dashboard/media-providers/web" };

const connectionItems = [
  { href: "/dashboard/endpoint", label: "Endpoint", icon: "api" },
  { href: "/dashboard/providers", label: "Providers", icon: "dns" },
  // { href: "/dashboard/basic-chat", label: "Basic Chat", icon: "chat" }, // Hidden
  { href: "/dashboard/combos", label: "Combos", icon: "layers" },
];

const monitoringItems = [
  { href: "/dashboard/usage", label: "Usage", icon: "bar_chart" },
  { href: "/dashboard/quota", label: "Quota Tracker", icon: "data_usage" },
];

const reportItems = [
  { href: "/dashboard/ai-agent", label: "AI Agent báo cáo", icon: "assistant" },
  { href: "/dashboard/report-assistant", label: "Trợ lý báo cáo", icon: "description" },
];

const debugItems = [
  { href: "/dashboard/doc-scanner", label: "Document Scanner", icon: "document_scanner" },
  { href: "/dashboard/assistant", label: "AI Assistant", icon: "smart_toy" },
  // { href: "/dashboard/console-log", label: "Console Log", icon: "terminal" },
  { href: "/dashboard/translator", label: "Translator", icon: "translate" },
];

const systemItems = [
  { href: "/dashboard/proxy-pools", label: "Proxy Pools", icon: "lan" },
  { href: "/dashboard/skills", label: "Skills", icon: "extension" },
];

export default function Sidebar({ onClose }) {
  const pathname = usePathname();
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [enableTranslator, setEnableTranslator] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const { fetchSettings } = useSettingsStore();

  useEffect(() => {
    fetchSettings()
      .then(data => { if (data?.enableTranslator) setEnableTranslator(true); })
      .catch(() => { });
  }, [fetchSettings]);

  useEffect(() => {
    if (pathname?.startsWith("/dashboard/media-providers")) {
      setMediaOpen(true);
    }
  }, [pathname]);

  const isActive = (href) => {
    if (href === "/dashboard/endpoint") {
      return pathname === "/dashboard" || pathname.startsWith("/dashboard/endpoint");
    }
    return pathname.startsWith(href);
  };

  const isMobile = !!onClose;
  const isExpanded = isMobile || isHovered;

  return (
    <>
      <aside
        onMouseEnter={() => !isMobile && setIsHovered(true)}
        onMouseLeave={() => !isMobile && setIsHovered(false)}
        className={cn(
          "flex flex-col border-r border-border-subtle bg-vibrancy backdrop-blur-xl transition-all duration-300 min-h-full overflow-hidden select-none",
          isMobile
            ? "w-72"
            : cn(
              "fixed top-0 bottom-0 left-0 z-40",
              isHovered ? "w-72 shadow-[0_0_30px_rgba(0,0,0,0.3)]" : "w-16"
            )
        )}
      >

        {/* Logo */}
        <div className={cn("px-6 py-4 transition-all duration-300 shrink-0", !isExpanded && "flex justify-center px-0 py-5")}>
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex items-center justify-center size-9 rounded-[10px] bg-gradient-to-br from-brand-500 to-brand-700 shadow-[var(--shadow-warm)] shrink-0">
              <span className="material-symbols-outlined text-white text-[20px]">school</span>
            </div>
            {isExpanded && (
              <h1 className="text-lg font-semibold tracking-tight text-text-main truncate animate-fade-in">
                {APP_CONFIG.name}
              </h1>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-2 space-y-0.5 overflow-y-auto custom-scrollbar">
          {/* Connections section */}
          <div className="space-y-0.5">
            {isExpanded && (
              <p className="px-4 text-xs font-semibold text-text-muted/60 uppercase tracking-wider mb-2">
                Connections
              </p>
            )}
            {connectionItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center rounded-lg transition-all group",
                  isExpanded ? "gap-3 px-3 py-1" : "justify-center p-2 mx-1",
                  isActive(item.href)
                    ? "bg-primary/10 text-primary"
                    : "text-text-muted hover:bg-surface-2 hover:text-text-main"
                )}
                title={!isExpanded ? item.label : undefined}
              >
                <span
                  className={cn(
                    "material-symbols-outlined text-[18px] shrink-0",
                    isActive(item.href) ? "fill-1" : "group-hover:text-primary transition-colors"
                  )}
                >
                  {item.icon}
                </span>
                {isExpanded && (
                  <span className="text-[13px] font-medium truncate">{item.label}</span>
                )}
              </Link>
            ))}
          </div>

          {/* Monitoring section */}
          <div className={cn("space-y-0.5", isExpanded && "pt-3 mt-2")}>
            {isExpanded && (
              <p className="px-4 text-xs font-semibold text-text-muted/60 uppercase tracking-wider mb-2">
                Monitoring
              </p>
            )}
            {monitoringItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center rounded-lg transition-all group",
                  isExpanded ? "gap-3 px-3 py-1" : "justify-center p-2 mx-1",
                  isActive(item.href)
                    ? "bg-primary/10 text-primary"
                    : "text-text-muted hover:bg-surface-2 hover:text-text-main"
                )}
                title={!isExpanded ? item.label : undefined}
              >
                <span
                  className={cn(
                    "material-symbols-outlined text-[18px] shrink-0",
                    isActive(item.href) ? "fill-1" : "group-hover:text-primary transition-colors"
                  )}
                >
                  {item.icon}
                </span>
                {isExpanded && (
                  <span className="text-[13px] font-medium truncate">{item.label}</span>
                )}
              </Link>
            ))}
          </div>

          {/* AI Tools section */}
          <div className={cn("space-y-0.5", isExpanded && "pt-3 mt-2")}>
            {isExpanded && (
              <p className="px-4 text-xs font-semibold text-text-muted/60 uppercase tracking-wider mb-2">
                AI Tools
              </p>
            )}
            {debugItems.map((item) => {
              const show = item.href !== "/dashboard/translator" || enableTranslator;
              return show ? (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center rounded-lg transition-all group",
                    isExpanded ? "gap-3 px-3 py-1" : "justify-center p-2 mx-1",
                    isActive(item.href)
                      ? "bg-primary/10 text-primary"
                      : "text-text-muted hover:bg-surface-2 hover:text-text-main"
                  )}
                  title={!isExpanded ? item.label : undefined}
                >
                  <span
                    className={cn(
                      "material-symbols-outlined text-[18px] shrink-0",
                      isActive(item.href) ? "fill-1" : "group-hover:text-primary transition-colors"
                    )}
                  >
                    {item.icon}
                  </span>
                  {isExpanded && (
                    <span className="text-[13px] font-medium truncate">{item.label}</span>
                  )}
                </Link>
              ) : null;
            })}
          </div>

          {/* Reports section */}
          <div className={cn("space-y-0.5", isExpanded && "pt-3 mt-2")}>
            {isExpanded && (
              <p className="px-4 text-xs font-semibold text-text-muted/60 uppercase tracking-wider mb-2">
                Reports
              </p>
            )}
            {reportItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center rounded-lg transition-all group",
                  isExpanded ? "gap-3 px-3 py-1" : "justify-center p-2 mx-1",
                  isActive(item.href)
                    ? "bg-primary/10 text-primary"
                    : "text-text-muted hover:bg-surface-2 hover:text-text-main"
                )}
                title={!isExpanded ? item.label : undefined}
              >
                <span
                  className={cn(
                    "material-symbols-outlined text-[18px] shrink-0",
                    isActive(item.href) ? "fill-1" : "group-hover:text-primary transition-colors"
                  )}
                >
                  {item.icon}
                </span>
                {isExpanded && (
                  <span className="text-[13px] font-medium truncate">{item.label}</span>
                )}
              </Link>
            ))}
          </div>

          {/* System section */}
          <div className={cn("space-y-0.5", isExpanded && "pt-3 mt-2")}>
            {isExpanded && (
              <p className="px-4 text-xs font-semibold text-text-muted/60 uppercase tracking-wider mb-2">
                System
              </p>
            )}

            {/* Media Providers accordion */}
            <button
              onClick={() => isExpanded && setMediaOpen((v) => !v)}
              className={cn(
                "w-full flex items-center rounded-lg transition-all group text-left",
                isExpanded ? "gap-3 px-3 py-1.5" : "justify-center p-2 mx-1",
                pathname.startsWith("/dashboard/media-providers")
                  ? "bg-primary/10 text-primary"
                  : "text-text-muted hover:bg-surface-2 hover:text-text-main"
              )}
              title={!isExpanded ? "Media Providers" : undefined}
            >
              <span className="material-symbols-outlined text-[18px] shrink-0">perm_media</span>
              {isExpanded && (
                <>
                  <span className="text-[13px] font-medium flex-1 truncate">Media Providers</span>
                  <span className="material-symbols-outlined text-[14px] transition-transform shrink-0" style={{ transform: mediaOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                    expand_more
                  </span>
                </>
              )}
            </button>
            {isExpanded && mediaOpen && (
              <div className="pl-4 space-y-0.5">
                {MEDIA_PROVIDER_KINDS.filter((k) => VISIBLE_MEDIA_KINDS.includes(k.id)).map((kind) => (
                  <Link
                    key={kind.id}
                    href={`/dashboard/media-providers/${kind.id}`}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 px-4 py-1 rounded-lg transition-all group",
                      pathname.startsWith(`/dashboard/media-providers/${kind.id}`)
                        ? "bg-primary/10 text-primary"
                        : "text-text-muted hover:bg-surface-2 hover:text-text-main"
                    )}
                  >
                    <span className="material-symbols-outlined text-[16px] shrink-0">{kind.icon}</span>
                    <span className="text-[13px] font-medium truncate">{kind.label}</span>
                  </Link>
                ))}
                <Link
                  key={COMBINED_WEB_ITEM.id}
                  href={COMBINED_WEB_ITEM.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 px-4 py-1 rounded-lg transition-all group",
                    pathname.startsWith(COMBINED_WEB_ITEM.href)
                      ? "bg-primary/10 text-primary"
                      : "text-text-muted hover:bg-surface-2 hover:text-text-main"
                  )}
                >
                  <span className="material-symbols-outlined text-[16px] shrink-0">{COMBINED_WEB_ITEM.icon}</span>
                  <span className="text-[13px] font-medium truncate">{COMBINED_WEB_ITEM.label}</span>
                </Link>
              </div>
            )}

            {systemItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center rounded-lg transition-all group",
                  isExpanded ? "gap-3 px-3 py-1" : "justify-center p-2 mx-1",
                  isActive(item.href)
                    ? "bg-primary/10 text-primary"
                    : "text-text-muted hover:bg-surface-2 hover:text-text-main"
                )}
                title={!isExpanded ? item.label : undefined}
              >
                <span
                  className={cn(
                    "material-symbols-outlined text-[18px] shrink-0",
                    isActive(item.href) ? "fill-1" : "group-hover:text-primary transition-colors"
                  )}
                >
                  {item.icon}
                </span>
                {isExpanded && (
                  <span className="text-[13px] font-medium truncate">{item.label}</span>
                )}
              </Link>
            ))}

            {/* Settings */}
            <Link
              href="/dashboard/profile"
              onClick={onClose}
              className={cn(
                "flex items-center rounded-lg transition-all group",
                isExpanded ? "gap-3 px-3 py-1" : "justify-center p-2 mx-1",
                isActive("/dashboard/profile")
                  ? "bg-primary/10 text-primary"
                  : "text-text-muted hover:bg-surface-2 hover:text-text-main"
              )}
              title={!isExpanded ? "Settings" : undefined}
            >
              <span
                className={cn(
                  "material-symbols-outlined text-[18px] shrink-0",
                  isActive("/dashboard/profile") ? "fill-1" : "group-hover:text-primary transition-colors"
                )}
              >
                settings
              </span>
              {isExpanded && (
                <span className="text-[13px] font-medium truncate">Settings</span>
              )}
            </Link>
          </div>
        </nav>
      </aside>

      {/* Disconnected Overlay */}
      {isDisconnected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
          <div className="text-center p-8">
            <div className="flex items-center justify-center size-16 rounded-full bg-red-500/20 text-red-500 mx-auto mb-4">
              <span className="material-symbols-outlined text-[32px]">power_off</span>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Server Disconnected</h2>
            <p className="text-text-muted mb-6">The proxy server has been stopped.</p>
            <Button variant="secondary" onClick={() => globalThis.location.reload()}>
              Reload Page
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

Sidebar.propTypes = {
  onClose: PropTypes.func,
};
