"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import PropTypes from "prop-types";
import ProviderIcon from "@/shared/components/ProviderIcon";
import { useHeaderSearchStore } from "@/store/headerSearchStore";
import { OAUTH_PROVIDERS, APIKEY_PROVIDERS } from "@/shared/constants/config";
import { MEDIA_PROVIDER_KINDS, AI_PROVIDERS } from "@/shared/constants/providers";
import { translate } from "@/i18n/runtime";
import EditProfileModal from "@/shared/components/modals/EditProfileModal";
import UISettingsModal from "@/shared/components/modals/UISettingsModal";

const getPageInfo = (pathname, searchParams) => {
  if (!pathname) return { title: "9Router AI", breadcrumbs: ["Hệ thống", "9Router AI"] };

  const mediaDetailMatch = pathname.match(/\/media-providers\/([^/]+)\/([^/]+)$/);
  if (mediaDetailMatch) {
    const kindId = mediaDetailMatch[1];
    const providerId = mediaDetailMatch[2];
    const kindConfig = MEDIA_PROVIDER_KINDS.find((k) => k.id === kindId);
    const provider = AI_PROVIDERS[providerId];
    return {
      title: provider?.name || providerId,
      breadcrumbs: ["Hệ thống", "9Router AI", kindConfig?.label || kindId, provider?.name || providerId],
    };
  }

  const mediaKindMatch = pathname.match(/\/media-providers\/([^/]+)$/);
  if (mediaKindMatch) {
    const kindId = mediaKindMatch[1];
    const kindConfig = MEDIA_PROVIDER_KINDS.find((k) => k.id === kindId);
    return {
      title: kindConfig?.label || kindId,
      breadcrumbs: ["Hệ thống", "9Router AI", kindConfig?.label || kindId],
    };
  }

  const providerMatch = pathname.match(/\/providers\/([^/]+)$/);
  if (providerMatch) {
    const providerId = providerMatch[1];
    const providerInfo = OAUTH_PROVIDERS[providerId] || APIKEY_PROVIDERS[providerId];
    return {
      title: providerInfo?.name || "Nhà cung cấp",
      breadcrumbs: ["Hệ thống", "9Router AI", "Nhà cung cấp", providerInfo?.name || providerId],
    };
  }

  if (pathname.includes("/providers"))
    return {
      title: "Nhà cung cấp",
      breadcrumbs: ["Hệ thống", "9Router AI", "Nhà cung cấp"],
    };
  if (pathname.includes("/combos"))
    return {
      title: "Combos Model",
      breadcrumbs: ["Hệ thống", "9Router AI", "Combos"],
    };
  if (pathname.includes("/usage"))
    return {
      title: "Thống kê sử dụng",
      breadcrumbs: ["Hệ thống", "9Router AI", "Thống kê"],
    };
  if (pathname.includes("/quota"))
    return {
      title: "Hạn mức Quota",
      breadcrumbs: ["Hệ thống", "9Router AI", "Quota Tracker"],
    };

  return {
    title: "9Router AI",
    breadcrumbs: ["Hệ thống", "9Router AI"],
  };
};

export default function Header({ onMenuClick, showMenuButton = true }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [userProfile, setUserProfile] = useState({
    name: "Trung Nguyễn Đình",
    email: "tapnham502@gmail.com",
    role: "Admin",
    avatar: "",
    phone: "",
  });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const dropdownRef = useRef(null);

  const pageInfo = useMemo(
    () => getPageInfo(pathname, searchParams),
    [pathname, searchParams]
  );
  const { breadcrumbs = [] } = pageInfo;

  const loadProfileFromStorage = useCallback(() => {
    try {
      const cachedStr = localStorage.getItem("user-profile");
      const cachedRole = localStorage.getItem("user-role");
      if (cachedStr) {
        const p = JSON.parse(cachedStr);
        const avatarUrl = p.avatar_url || p.avatar || p.picture || p.user_metadata?.avatar_url || p.user_metadata?.picture || "";
        const fullName = p.full_name || p.displayName || p.name || p.user_metadata?.full_name || "Trung Nguyễn Đình";
        const email = p.email || "tapnham502@gmail.com";
        const phone = p.phone || "";
        const r = cachedRole ? (cachedRole.charAt(0).toUpperCase() + cachedRole.slice(1)) : "Admin";

        setUserProfile({
          name: fullName,
          email: email,
          role: r,
          avatar: avatarUrl,
          phone: phone,
        });
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadProfileFromStorage();
    window.addEventListener("storage", loadProfileFromStorage);

    // Lắng nghe postMessage từ cửa sổ cha (Tailieu HOU React App)
    const handleMessage = (event) => {
      if (!event.data) return;
      if (event.data.type === "PUSH_USER_PROFILE" && event.data.profile) {
        const p = event.data.profile;
        setUserProfile({
          name: p.full_name || p.displayName || "Trung Nguyễn Đình",
          email: p.email || "tapnham502@gmail.com",
          role: event.data.role ? (event.data.role.charAt(0).toUpperCase() + event.data.role.slice(1)) : "Admin",
          avatar: p.avatar_url || p.avatar || "",
          phone: p.phone || "",
        });
      }
    };
    window.addEventListener("message", handleMessage);

    fetch("http://localhost:3001/api/v1/auth/profile", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.profile) return;
        const p = data.profile;
        const u = data.user;
        const avatarUrl = p.avatar_url || p.avatar || u?.user_metadata?.avatar_url || u?.user_metadata?.picture || "";
        setUserProfile({
          name: p.full_name || p.displayName || u?.user_metadata?.full_name || u?.user_metadata?.name || "Trung Nguyễn Đình",
          email: p.email || u?.email || "tapnham502@gmail.com",
          role: data.role ? (data.role.charAt(0).toUpperCase() + data.role.slice(1)) : "Admin",
          avatar: avatarUrl,
          phone: p.phone || "",
        });
      })
      .catch(() => {});

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", loadProfileFromStorage);
      window.removeEventListener("message", handleMessage);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [loadProfileFromStorage]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    localStorage.removeItem("user-profile");
    localStorage.removeItem("user-role");
    window.location.href = "http://localhost:3000/login";
  };

  return (
    <>
      <header className="shrink-0 flex items-center justify-between gap-3 px-4 lg:px-6 h-16 border-b border-border bg-surface text-text-main z-30">
        {/* Left: Mobile Menu & Breadcrumbs matching HOU Admin Header 100% */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {showMenuButton && (
            <button
              onClick={onMenuClick}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors lg:hidden shrink-0"
              aria-label="Toggle menu"
            >
              <span className="material-symbols-outlined text-[20px]">menu</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 min-w-0 truncate text-xs">
            {breadcrumbs.map((crumb, idx) => (
              <div key={`${crumb}-${idx}`} className="flex items-center gap-1.5 truncate">
                {idx > 0 && (
                  <span className="text-text-muted/60 text-[11px] shrink-0">/</span>
                )}
                <span
                  className={
                    idx === breadcrumbs.length - 1
                      ? "font-semibold text-text-main truncate"
                      : "text-text-muted font-medium truncate"
                  }
                >
                  {crumb}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Quick Search + User Profile Dropdown matching HOU Admin Header 100% */}
        <div className="flex items-center gap-3 shrink-0">
          <HeaderSearch />

          {/* User Profile Button with Avatar Photo Support */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-all duration-200 hover:bg-surface-2 text-text-main"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-600 text-white text-xs font-bold shadow-sm shrink-0 overflow-hidden">
                {userProfile.avatar ? (
                  <img src={userProfile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  userProfile.name.charAt(0).toUpperCase()
                )}
              </div>

              <div className="hidden sm:flex flex-col items-start min-w-0 text-left">
                <span className="truncate max-w-[120px] text-xs font-semibold text-text-main">
                  {userProfile.name}
                </span>
                <span className="bg-[#fee2e2] text-[#b91c1c] border border-[#fca5a5] text-[10px] font-bold px-2 py-[1px] rounded-full inline-block mt-0.5">
                  {userProfile.role}
                </span>
              </div>

              <span className={`material-symbols-outlined text-[16px] text-text-muted transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}>
                keyboard_arrow_down
              </span>
            </button>

            {/* User Profile Dropdown Modal with Avatar Photo Support */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-60 rounded-2xl py-1.5 bg-surface border border-border shadow-2xl z-50 animate-scale-in origin-top-right">
                <div className="px-4 py-3 border-b border-border/60">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center bg-blue-600 text-white text-xs font-bold shadow-sm shrink-0 overflow-hidden">
                      {userProfile.avatar ? (
                        <img src={userProfile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        userProfile.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-xs text-text-main truncate">{userProfile.name}</p>
                      <p className="text-[10px] text-text-muted truncate mt-0.5">{userProfile.email}</p>
                    </div>
                  </div>
                  <span className="bg-[#fee2e2] text-[#b91c1c] border border-[#fca5a5] text-[10px] font-bold px-2 py-[1px] rounded-full inline-block">
                    {userProfile.role}
                  </span>
                </div>

                <div className="py-1 text-xs text-text-main">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      setProfileModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-surface-2 transition-colors text-left"
                  >
                    <span className="material-symbols-outlined text-[16px] text-text-muted">person</span>
                    <span>Trang cá nhân</span>
                  </button>
                  <a
                    href="http://localhost:3000/"
                    className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-surface-2 transition-colors text-left"
                  >
                    <span className="material-symbols-outlined text-[16px] text-text-muted">home</span>
                    <span>Trang chủ</span>
                  </a>
                  <a
                    href="http://localhost:3000/lich-thi"
                    className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-surface-2 transition-colors text-left"
                  >
                    <span className="material-symbols-outlined text-[16px] text-text-muted">calendar_today</span>
                    <span>Lịch thi</span>
                  </a>
                  <a
                    href="http://localhost:3000/pricing"
                    className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-surface-2 transition-colors text-left"
                  >
                    <span className="material-symbols-outlined text-[16px] text-text-muted">call</span>
                    <span>Liên hệ</span>
                  </a>
                  <a
                    href="http://localhost:3000/admin"
                    className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-surface-2 transition-colors text-left"
                  >
                    <span className="material-symbols-outlined text-[16px] text-text-muted">shield</span>
                    <span>Quản trị hệ thống</span>
                  </a>
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      setSettingsModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-surface-2 transition-colors text-left text-text-main"
                  >
                    <span className="material-symbols-outlined text-[16px] text-text-muted">settings</span>
                    <span>Giao diện hệ thống</span>
                  </button>
                  <div className="border-t border-border/60 my-1" />
                  <button
                    onClick={handleLogout}
                    className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 text-red-500 hover:bg-red-500/10 transition-colors font-medium"
                  >
                    <span className="material-symbols-outlined text-[16px]">logout</span>
                    <span>Đăng xuất</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        userProfile={userProfile}
        onProfileUpdated={loadProfileFromStorage}
      />

      {/* UI Settings Modal */}
      <UISettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />
    </>
  );
}

function HeaderSearch() {
  const visible = useHeaderSearchStore((s) => s.visible);
  const query = useHeaderSearchStore((s) => s.query);
  const setQuery = useHeaderSearchStore((s) => s.setQuery);

  if (!visible) return null;

  return (
    <div className="relative w-36 xs:w-44 sm:w-60 md:w-64">
      <div className="relative">
        <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-[15px] pointer-events-none">
          search
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm trang..."
          className="w-full pl-8 pr-7 py-1.5 bg-surface-2 border border-border rounded-full text-xs text-text-main placeholder-text-muted focus:outline-none focus:border-brand-500 transition-all"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main p-0 cursor-pointer flex items-center justify-center"
            aria-label="Clear search"
          >
            <span className="material-symbols-outlined text-[14px]">close</span>
          </button>
        )}
      </div>
    </div>
  );
}

Header.propTypes = {
  onMenuClick: PropTypes.func,
  showMenuButton: PropTypes.bool,
};
