import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { FileSpreadsheet, Star, Save, ChevronDown, User, Home, Calendar, Phone, Shield, Settings, LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import UISettingsModal from "../layout/UISettingsModal";
import EditProfileModal from "../layout/EditProfileModal";

interface SpreadsheetHeaderProps {
  title: string;
  setTitle: (t: string) => void;
  isStarred: boolean;
  setIsStarred: (s: boolean) => void;
  isSaving: boolean;
  onBack: () => void;
  onSave: () => void;
}

export const SpreadsheetHeader: React.FC<SpreadsheetHeaderProps> = ({
  title,
  setTitle,
  isStarred,
  setIsStarred,
  isSaving,
  onBack,
  onSave,
}) => {
  const { user, profile, role, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const roleBadge: Record<string, { label: string; className: string }> = {
    admin:      { label: "Admin",  className: "layout-user-badge-admin" },
    management: { label: "QL",    className: "layout-user-badge-management" },
    ultra:      { label: "Ultra", className: "layout-user-badge-ultra" },
    pro:        { label: "Pro",   className: "layout-user-badge-pro" },
    plus:       { label: "Plus",  className: "layout-user-badge-plus" },
    free:       { label: "Free",  className: "layout-user-badge-free" },
  };
  const badge = roleBadge[role] ?? { label: role?.toUpperCase() || "FREE", className: "layout-user-badge-free" };

  return (
    <div className="print:hidden h-14 border-b border-[var(--border)] bg-[var(--bg)] flex items-center justify-between px-4">
      {/* Row 1: Logo, Title, Star, and User Profile Actions */}
      <div className="flex items-center gap-4">
        <div className="cursor-pointer" onClick={onBack} title="Quay lại trang quản lý">
          <FileSpreadsheet className="w-8 h-8 text-[#10b981]" />
        </div>
        <div className="flex items-center gap-1">
          <input
            type="text"
            className="bg-transparent border border-transparent hover:border-gray-300 focus:border-blue-500 rounded px-2 py-1 text-lg font-medium text-[var(--fg)] outline-none min-w-[150px]"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Trang tính chưa có tên"
            style={{ width: `${Math.max(80, title.length * 10.5)}px`, maxWidth: "350px" }}
          />
          <button 
            className={`p-1 rounded hover:bg-[var(--bg-2)] ${isStarred ? "text-amber-500" : "text-gray-400"}`} 
            onClick={() => setIsStarred(!isStarred)}
            title={isStarred ? "Bỏ gắn dấu sao" : "Gắn dấu sao"}
          >
            <Star className={`w-5 h-5 ${isStarred ? "fill-amber-500" : ""}`} />
          </button>
        </div>
      </div>
      
      <div className="flex items-center gap-4" ref={userMenuRef}>
        <button 
          onClick={onSave} 
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 rounded bg-emerald-500 hover:bg-emerald-600 text-white font-medium shadow-sm transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isSaving ? "Đang lưu..." : "Lưu lại"}
        </button>

        {user ? (
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen((p) => !p)}
              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[var(--bg-2)] transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-sm font-bold shadow overflow-hidden">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  user.email?.charAt(0).toUpperCase() ?? "U"
                )}
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${userMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl bg-[var(--bg)] shadow-lg border border-[var(--border)] py-2 z-50">
                <div className="px-4 py-2 border-b border-[var(--border)] mb-1">
                  <p className="font-semibold text-[var(--fg)] truncate">{profile?.full_name || user.email}</p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${badge.className}`}>
                    {badge.label}
                  </span>
                </div>
                
                <div className="flex flex-col">
                  <button onClick={() => { setUserMenuOpen(false); setProfileOpen(true); }} className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--fg-2)] hover:bg-[var(--bg-2)] w-full text-left">
                    <User className="w-4 h-4" /> Trang cá nhân
                  </button>
                  <Link to="/" className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--fg-2)] hover:bg-[var(--bg-2)] w-full text-left"><Home className="w-4 h-4" /> Trang chủ</Link>
                  <button onClick={() => { setUserMenuOpen(false); setSettingsOpen(true); }} className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--fg-2)] hover:bg-[var(--bg-2)] w-full text-left">
                    <Settings className="w-4 h-4" /> Giao diện hệ thống
                  </button>
                  <button onClick={() => { setUserMenuOpen(false); logout(); }} className="flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 w-full text-left mt-1 border-t border-[var(--border)] pt-2">
                    <LogOut className="w-4 h-4" /> Đăng xuất
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <UISettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <EditProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
};
