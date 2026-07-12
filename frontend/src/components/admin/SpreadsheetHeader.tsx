// frontend/src/components/admin/SpreadsheetHeader.tsx
import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { 
  FileSpreadsheet, Star, Upload, FileJson, Download, Save,
  ChevronDown, User, Home, Calendar, Phone, Shield, Settings, LogOut, ChevronRight
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.js";
import UISettingsModal from "../layout/UISettingsModal.js";
import EditProfileModal from "../layout/EditProfileModal.js";

interface SpreadsheetHeaderProps {
  title: string;
  setTitle: (t: string) => void;
  isStarred: boolean;
  setIsStarred: (s: boolean) => void;
  isSaving: boolean;
  onBack: () => void;
  onSave: () => void;
  handleImportJSON: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleExportJSON: () => void;
  handleExportCSV: () => void;
  onUndo: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onToggleFindReplace: () => void;
  onInsertRow: (position: "above" | "below") => void;
  onInsertCol: (position: "left" | "right") => void;
  onInsertFormula: (func: string) => void;
  onApplyStyle: (style: "bold" | "italic" | "underline" | "strikethrough") => void;
  onOpenHelp: () => void;
  
  // New File Menu Handlers
  onNewSpreadsheet: () => void;
  onOpenSpreadsheet: () => void;
  onMakeCopy: () => void;
  onShare: () => void;
  onEmail: () => void;
  onDownload: (type: "csv" | "tsv" | "xlsx" | "pdf") => void;
  onRename: () => void;
  onMoveToTrash: () => void;
  onVersionHistory: () => void;
  onShowDetails: () => void;
}

export const SpreadsheetHeader: React.FC<SpreadsheetHeaderProps> = ({
  title,
  setTitle,
  isStarred,
  setIsStarred,
  isSaving,
  onBack,
  onSave,
  handleImportJSON,
  handleExportJSON,
  handleExportCSV,
  onUndo,
  onCopy,
  onPaste,
  onToggleFindReplace,
  onInsertRow,
  onInsertCol,
  onInsertFormula,
  onApplyStyle,
  onOpenHelp,

  onNewSpreadsheet,
  onOpenSpreadsheet,
  onMakeCopy,
  onShare,
  onEmail,
  onDownload,
  onRename,
  onMoveToTrash,
  onVersionHistory,
  onShowDetails,
}) => {
  const { user, profile, role, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

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
    <div className="sheet-google-header">
      {/* Row 1: Logo, Title, Star, and User Profile Actions */}
      <div className="sheet-google-header-top">
        <div className="sheet-google-left-section">
          <div className="sheet-google-logo" onClick={onBack} title="Quay lại trang quản lý">
            <FileSpreadsheet className="w-8 h-8 text-[#10b981]" />
          </div>
          <div className="sheet-google-title-wrapper">
            <input
              ref={titleInputRef}
              type="text"
              id="sheet-title-input-el"
              className="sheet-google-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Trang tính chưa có tên"
            />
            <button 
              className={`btn-star ${isStarred ? "starred" : ""}`} 
              onClick={() => setIsStarred(!isStarred)}
              title={isStarred ? "Bỏ gắn dấu sao" : "Gắn dấu sao"}
            >
              <Star className={`w-4 h-4 ${isStarred ? "fill-[#f59e0b] text-[#f59e0b]" : "text-gray-400"}`} />
            </button>
          </div>
        </div>
        
        <div className="sheet-google-right-section" ref={userMenuRef}>
          <button 
            onClick={onSave} 
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#10b981] hover:bg-[#059669] text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50 mr-2"
            title="Lưu bảng tính vào cơ sở dữ liệu"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? "Đang lưu..." : "Lưu lại"}
          </button>
          {user ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen((p) => !p)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-all duration-200 hover:bg-[var(--bg-2)] layout-text-fg2"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0 overflow-hidden layout-avatar-bg"
                >
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    user.email?.charAt(0).toUpperCase() ?? "U"
                  )}
                </div>
                <div className="hidden sm:flex flex-col items-start min-w-0">
                  <span className="truncate max-w-[120px] layout-user-name">
                    {profile?.full_name || user.email}
                  </span>
                  <span
                    className={`layout-user-badge ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${userMenuOpen ? "rotate-180" : ""} layout-icon-meta`} />
              </button>

              {userMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 rounded-2xl py-1.5 animate-scale-in origin-top-right z-50 layout-dropdown shadow-lg border border-[var(--border)]"
                >
                  <div className="px-4 py-2.5 layout-dropdown-header">
                    <p className="truncate layout-dropdown-username">
                      {profile?.full_name || user.email}
                    </p>
                    {profile?.full_name && (
                      <p className="truncate layout-profile-email">
                        {user.email}
                      </p>
                    )}
                    {profile?.phone && (
                      <p className="truncate layout-profile-phone flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 layout-icon-meta" />
                        <span>{profile.phone}</span>
                      </p>
                    )}
                    <span className={`layout-user-badge mt-1 ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => { setUserMenuOpen(false); setProfileOpen(true); }}
                      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-[var(--fg-2)] hover:bg-[var(--bg-2)] transition-colors text-left"
                    >
                      <User className="w-4 h-4 layout-icon-meta" />
                      Trang cá nhân
                    </button>
                    <Link
                      to="/"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-[var(--bg-2)] transition-colors layout-text-fg2 text-left"
                    >
                      <Home className="w-4 h-4 layout-icon-meta" />
                      Trang chủ
                    </Link>
                    <Link
                      to="/lich-thi"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-[var(--bg-2)] transition-colors layout-text-fg2 text-left"
                    >
                      <Calendar className="w-4 h-4 layout-icon-meta" />
                      Lịch thi
                    </Link>
                    <Link
                      to="/pricing"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-[var(--bg-2)] transition-colors layout-text-fg2 text-left"
                    >
                      <Phone className="w-4 h-4 layout-icon-meta" />
                      Liên hệ
                    </Link>
                    {role === "admin" && (
                      <Link
                        to="/admin"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-[var(--bg-2)] transition-colors layout-text-fg2 text-left"
                      >
                        <Shield className="w-4 h-4 layout-icon-meta" />
                        Quản trị hệ thống
                      </Link>
                    )}
                    <button
                      onClick={() => { setUserMenuOpen(false); setSettingsOpen(true); }}
                      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-[var(--fg-2)] hover:bg-[var(--bg-2)] transition-colors text-left"
                    >
                      <Settings className="w-4 h-4 layout-icon-meta" />
                      Giao diện hệ thống
                    </button>
                    <button
                      onClick={() => { setUserMenuOpen(false); logout(); }}
                      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      Đăng xuất
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Row 2: Menubar */}
      <div className="sheet-google-menubar">
        <div className="menu-item-dropdown">
          Tệp
          <div className="menu-dropdown-content">
            {/* Mới (New) Submenu */}
            <div className="dropdown-action-btn relative group/sub flex justify-between items-center pr-2">
              <span>Mới</span>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              <div className="absolute left-full top-[-6px] hidden group-hover/sub:flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg py-1 z-[100] min-w-[160px]">
                <button onClick={onNewSpreadsheet} className="dropdown-action-btn w-full text-left">Bảng tính mới</button>
              </div>
            </div>

            <button onClick={onOpenSpreadsheet} className="dropdown-action-btn">
              Mở (Ctrl+O)
            </button>

            <label className="dropdown-action-btn cursor-pointer flex items-center gap-1">
              Nhập
              <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
            </label>

            <button onClick={onMakeCopy} className="dropdown-action-btn">
              Tạo bản sao
            </button>

            <div className="menu-dropdown-divider"></div>

            <button onClick={onShare} className="dropdown-action-btn">
              Chia sẻ
            </button>

            <button onClick={onEmail} className="dropdown-action-btn">
              Email
            </button>

            {/* Tải xuống Submenu */}
            <div className="dropdown-action-btn relative group/sub flex justify-between items-center pr-2">
              <span>Tải xuống</span>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              <div className="absolute left-full top-[-6px] hidden group-hover/sub:flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg py-1 z-[100] min-w-[200px]">
                <button onClick={() => onDownload("xlsx")} className="dropdown-action-btn w-full text-left">Microsoft Excel (.xlsx)</button>
                <button onClick={() => onDownload("pdf")} className="dropdown-action-btn w-full text-left">Tài liệu PDF (.pdf)</button>
                <button onClick={() => onDownload("csv")} className="dropdown-action-btn w-full text-left">Giá trị phân tách bằng dấu phẩy (.csv)</button>
                <button onClick={() => onDownload("tsv")} className="dropdown-action-btn w-full text-left">Giá trị phân tách bằng dấu tab (.tsv)</button>
              </div>
            </div>

            <div className="menu-dropdown-divider"></div>

            <button onClick={onRename} className="dropdown-action-btn">
              Đổi tên
            </button>

            <button onClick={onMoveToTrash} className="dropdown-action-btn text-red-500 hover:bg-red-500/10">
              Chuyển vào thùng rác
            </button>

            <div className="menu-dropdown-divider"></div>

            {/* Nhật ký phiên bản Submenu */}
            <div className="dropdown-action-btn relative group/sub flex justify-between items-center pr-2">
              <span>Nhật ký phiên bản</span>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              <div className="absolute left-full top-[-6px] hidden group-hover/sub:flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg py-1 z-[100] min-w-[180px]">
                <button onClick={onVersionHistory} className="dropdown-action-btn w-full text-left">Xem lịch sử thay đổi</button>
              </div>
            </div>

            <div className="menu-dropdown-divider"></div>

            <button onClick={onShowDetails} className="dropdown-action-btn">
              Chi tiết
            </button>

            <button onClick={() => setSettingsOpen(true)} className="dropdown-action-btn">
              Cài đặt
            </button>

            <div className="menu-dropdown-divider"></div>

            <button onClick={() => window.print()} className="dropdown-action-btn">
              In (Ctrl+P)
            </button>
          </div>
        </div>

        <div className="menu-item-dropdown">
          Chỉnh sửa
          <div className="menu-dropdown-content">
            <button onClick={onUndo} className="dropdown-action-btn">
              Hoàn tác (Ctrl+Z)
            </button>
            <button onClick={onCopy} className="dropdown-action-btn">
              Sao chép (Ctrl+C)
            </button>
            <button onClick={onPaste} className="dropdown-action-btn">
              Dán (Ctrl+V)
            </button>
            <button onClick={onToggleFindReplace} className="dropdown-action-btn">
              Tìm kiếm & Thay thế (Ctrl+H)
            </button>
          </div>
        </div>

        <div className="menu-item-dropdown">
          Chèn
          <div className="menu-dropdown-content">
            <button onClick={() => onInsertRow("above")} className="dropdown-action-btn">
              Hàng ở trên
            </button>
            <button onClick={() => onInsertRow("below")} className="dropdown-action-btn">
              Hàng ở dưới
            </button>
            <button onClick={() => onInsertCol("left")} className="dropdown-action-btn">
              Cột bên trái
            </button>
            <button onClick={() => onInsertCol("right")} className="dropdown-action-btn">
              Cột bên phải
            </button>
            <div className="toolbar-divider" style={{ margin: "4px 0", width: "100%", height: "1px" }}></div>
            <button onClick={() => onInsertFormula("SUM")} className="dropdown-action-btn">
              Hàm SUM
            </button>
            <button onClick={() => onInsertFormula("AVERAGE")} className="dropdown-action-btn">
              Hàm AVERAGE
            </button>
          </div>
        </div>

        <div className="menu-item-dropdown">
          Định dạng
          <div className="menu-dropdown-content">
            <button onClick={() => onApplyStyle("bold")} className="dropdown-action-btn font-bold">
              In đậm (B)
            </button>
            <button onClick={() => onApplyStyle("italic")} className="dropdown-action-btn italic">
              In nghiêng (I)
            </button>
            <button onClick={() => onApplyStyle("underline")} className="dropdown-action-btn underline">
              Gạch chân (U)
            </button>
            <button onClick={() => onApplyStyle("strikethrough")} className="dropdown-action-btn line-through">
              Gạch ngang (S)
            </button>
          </div>
        </div>

        <div className="menu-item-dropdown" onClick={onOpenHelp}>Trợ giúp</div>
      </div>

      {/* Modals for settings and profile */}
      <UISettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <EditProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
};
