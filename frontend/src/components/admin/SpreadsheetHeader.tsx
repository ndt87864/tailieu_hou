// frontend/src/components/admin/SpreadsheetHeader.tsx
import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { 
  FileSpreadsheet, Star, Save, Clock,
  ChevronDown, User, Home, Calendar, Phone, Shield, Settings, LogOut
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.js";
import UISettingsModal from "../layout/UISettingsModal.js";
import EditProfileModal from "../layout/EditProfileModal.js";
import { SpreadsheetMenubar } from "./SpreadsheetMenubar.js";

interface SpreadsheetHeaderProps {
  title: string;
  setTitle: (t: string) => void;
  isStarred: boolean;
  setIsStarred: (s: boolean) => void;
  isSaving: boolean;
  isAdvancedMode: boolean;
  setIsAdvancedMode: (v: boolean) => void;
  onBack: () => void;
  onSave: () => void;
  onImportExcelClick: () => void;
  handleExportJSON: () => void;
  handleExportCSV: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onPasteSpecial: (option: "value" | "format") => void;
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
  sheets: any[];
  onUnhideSheet: (idx: number) => void;

  // View settings
  showFormulaBar: boolean;
  setShowFormulaBar: (v: boolean) => void;
  showGridlines: boolean;
  setShowGridlines: (v: boolean) => void;
  showFormulas: boolean;
  setShowFormulas: (v: boolean) => void;

  // Freeze rows and cols
  freezeRows: number;
  setFreezeRows: (r: number) => void;
  freezeCols: number;
  setFreezeCols: (c: number) => void;

  onSortSheet: (dir: "asc" | "desc") => void;
  onTrimWhitespace: () => void;
  onRemoveEmptyRows: () => void;
  selectedCell: string | null;
  onDeleteRow: (row: number) => void;
  onDeleteCol: (colLetter: string) => void;
  onClearValues: () => void;
  onFormatSelection: (type: "currency" | "percent" | "decimal-inc" | "decimal-dec" | "time" | "date") => void;
  onAlignChange: (align: "left" | "center" | "right") => void;
  onRemoveDuplicates: () => void;
  onClearFormatting: () => void;
  commonFormulas: any[];
  addCommonFormula: (name: string, formula: string, description?: string) => Promise<boolean>;
  updateCommonFormula: (id: string, name: string, formula: string, description?: string) => Promise<boolean>;
  deleteCommonFormula: (id: string) => Promise<boolean>;
  applyCommonFormula: (formula: string) => void;
  activeUsers?: Array<{ userId: string; name: string; avatar: string | null; email: string | null; role?: string; color: string }>;
}

export const SpreadsheetHeader: React.FC<SpreadsheetHeaderProps> = ({
  title,
  setTitle,
  isStarred,
  setIsStarred,
  isSaving,
  isAdvancedMode,
  setIsAdvancedMode,
  onBack,
  onSave,
  onImportExcelClick,
  onUndo,
  onRedo,
  onCut,
  onCopy,
  onPaste,
  onPasteSpecial,
  onToggleFindReplace,
  onInsertRow,
  onInsertCol,
  onInsertFormula,
  onApplyStyle,
  onOpenHelp,

  onNewSpreadsheet,
  onOpenSpreadsheet,
  onMakeCopy,
  onDownload,
  onRename,
  onMoveToTrash,
  onVersionHistory,
  onShowDetails,
  sheets,
  onUnhideSheet,

  showFormulaBar,
  setShowFormulaBar,
  showGridlines,
  setShowGridlines,
  showFormulas,
  setShowFormulas,
  freezeRows,
  setFreezeRows,
  freezeCols,
  setFreezeCols,
  onSortSheet,
  onTrimWhitespace,
  onRemoveEmptyRows,
  selectedCell,
  onDeleteRow,
  onDeleteCol,
  onClearValues,
  onFormatSelection,
  onAlignChange,
  onRemoveDuplicates,
  onClearFormatting,
  commonFormulas,
  addCommonFormula,
  updateCommonFormula,
  deleteCommonFormula,
  applyCommonFormula,
  activeUsers = [],
}) => {
  const { user, profile, role, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const menubarRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (menubarRef.current && !menubarRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
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
              style={{ width: `${Math.max(80, title.length * 9.5)}px`, maxWidth: "350px" }}
            />
            <button 
              className={`btn-star ${isStarred ? "starred" : ""}`} 
              onClick={() => setIsStarred(!isStarred)}
              title={isStarred ? "Bỏ gắn dấu sao" : "Gắn dấu sao"}
              style={{ marginLeft: "-2px" }}
            >
              <Star className={`w-4 h-4 ${isStarred ? "fill-[#f59e0b] text-[#f59e0b]" : "text-gray-400"}`} />
            </button>
          </div>
        </div>
        
        <div className="sheet-google-right-section" ref={userMenuRef}>
          {/* Active Users Realtime Presence Avatars */}
          {activeUsers && activeUsers.length > 0 && (
            <div className="sheet-presence-avatars-group" title={`${activeUsers.length} người đang xem trang tính này`}>
              {activeUsers.slice(0, 4).map((u) => {
                const isMe = u.userId === user?.id;
                return (
                  <div
                    key={u.userId}
                    className="sheet-presence-avatar-item"
                    style={{ borderColor: u.color }}
                    title={`${u.name}${isMe ? " (Bạn)" : ""} - Đang ở trong trang tính`}
                  >
                    {u.avatar ? (
                      <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" />
                    ) : (
                      <span style={{ backgroundColor: u.color }} className="presence-initials">
                        {u.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="sheet-presence-online-dot" />
                  </div>
                );
              })}
              {activeUsers.length > 4 && (
                <div className="sheet-presence-avatar-item more-count" title={`+${activeUsers.length - 4} người khác`}>
                  +{activeUsers.length - 4}
                </div>
              )}
            </div>
          )}

          {onVersionHistory && (
            <button
              onClick={onVersionHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--bg-3)] hover:bg-[var(--bg-2)] text-[var(--fg-2)] border border-[var(--border)] text-xs font-semibold shadow-sm transition-all mr-2"
              title="Xem nhật ký phiên bản và khôi phục (Google Sheets)"
            >
              <Clock className="w-3.5 h-3.5 text-emerald-500" />
              <span className="hidden sm:inline">Lịch sử</span>
            </button>
          )}

          <button
            onClick={() => setIsAdvancedMode(!isAdvancedMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition-all mr-2 ${isAdvancedMode ? 'bg-indigo-500 hover:bg-indigo-600 text-white' : 'bg-[var(--bg-3)] hover:bg-[var(--bg-2)] text-[var(--fg-2)] border border-[var(--border)]'}`}
            title="Chuyển đổi chế độ nâng cao (Fortune Sheet)"
          >
            {isAdvancedMode ? "Tắt Nâng cao" : "Bật Nâng cao"}
          </button>
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
      <SpreadsheetMenubar
        activeMenu={activeMenu}
        setActiveMenu={setActiveMenu}
        menubarRef={menubarRef}
        onNewSpreadsheet={onNewSpreadsheet}
        onOpenSpreadsheet={onOpenSpreadsheet}
        onImportExcelClick={onImportExcelClick}
        onMakeCopy={onMakeCopy}
        onDownload={onDownload}
        onRename={onRename}
        onMoveToTrash={onMoveToTrash}
        onVersionHistory={onVersionHistory}
        onShowDetails={onShowDetails}
        onUndo={onUndo}
        onRedo={onRedo}
        onCut={onCut}
        onCopy={onCopy}
        onPaste={onPaste}
        onPasteSpecial={onPasteSpecial}
        onToggleFindReplace={onToggleFindReplace}
        sheets={sheets}
        onUnhideSheet={onUnhideSheet}
        showFormulaBar={showFormulaBar}
        setShowFormulaBar={setShowFormulaBar}
        showGridlines={showGridlines}
        setShowGridlines={setShowGridlines}
        showFormulas={showFormulas}
        setShowFormulas={setShowFormulas}
        freezeRows={freezeRows}
        setFreezeRows={setFreezeRows}
        freezeCols={freezeCols}
        setFreezeCols={setFreezeCols}
        onInsertRow={onInsertRow}
        onInsertCol={onInsertCol}
        onInsertFormula={onInsertFormula}
        onApplyStyle={onApplyStyle}
        onSortSheet={onSortSheet}
        onTrimWhitespace={onTrimWhitespace}
        onRemoveEmptyRows={onRemoveEmptyRows}
        onOpenHelp={onOpenHelp}
        selectedCell={selectedCell}
        onDeleteRow={onDeleteRow}
        onDeleteCol={onDeleteCol}
        onClearValues={onClearValues}
        onFormatSelection={onFormatSelection}
        onAlignChange={onAlignChange}
        onRemoveDuplicates={onRemoveDuplicates}
        onClearFormatting={onClearFormatting}
        commonFormulas={commonFormulas}
        addCommonFormula={addCommonFormula}
        updateCommonFormula={updateCommonFormula}
        deleteCommonFormula={deleteCommonFormula}
        applyCommonFormula={applyCommonFormula}
        isAdvancedMode={isAdvancedMode}
      />

      {/* Modals for settings and profile */}
      <UISettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <EditProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
};
