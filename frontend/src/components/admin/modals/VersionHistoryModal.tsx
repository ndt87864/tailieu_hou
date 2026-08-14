// frontend/src/components/admin/modals/VersionHistoryModal.tsx
import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { X, Clock, User, RotateCcw, Check, Eye, ChevronRight, FileSpreadsheet, Loader2 } from "lucide-react";
import apiClient from "../../../services/client.js";
import { Sheet } from "../../../hooks/useSpreadsheetState.js";

export interface VersionEntry {
  id: string;
  timestamp: string;
  title: string;
  sheets: Sheet[];
  isStarred?: boolean;
  user?: {
    id: string | null;
    name: string;
    avatar: string | null;
    email: string | null;
  };
}

interface VersionHistoryModalProps {
  show: boolean;
  onClose: () => void;
  sheetId: string;
  currentSheets: Sheet[];
  onRestore: (sheets: Sheet[], timestamp: string, versionTitle?: string) => void;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  show,
  onClose,
  sheetId,
  currentSheets,
  onRestore,
}) => {
  const [loading, setLoading] = useState(false);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>("current");
  const [activePreviewTab, setActivePreviewTab] = useState<number>(0);

  useEffect(() => {
    if (!show || !sheetId) return;

    const fetchVersions = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get(`/api/v1/spreadsheets/${sheetId}/versions`);
        const serverVersions: VersionEntry[] = res.data.data || [];
        setVersions(serverVersions);
        setSelectedVersionId("current");
        setActivePreviewTab(0);
      } catch (err: any) {
        toast.error("Không thể tải lịch sử phiên bản: " + (err.response?.data?.error || err.message));
      } finally {
        setLoading(false);
      }
    };

    fetchVersions();
  }, [show, sheetId]);

  if (!show) return null;

  // Lấy dữ liệu sheets của phiên bản đang chọn để preview
  const selectedVersion = versions.find((v) => v.id === selectedVersionId);
  const previewSheets = selectedVersionId === "current" ? currentSheets : selectedVersion?.sheets || [];
  const activeSheet = previewSheets[activePreviewTab] || previewSheets[0] || { name: "Sheet1", cells: {}, rowCount: 20, colCount: 10 };

  const handleApplyRestore = () => {
    if (selectedVersionId === "current") {
      toast.info("Bạn đang ở phiên bản hiện tại!");
      return;
    }
    if (!selectedVersion) return;

    const formattedTime = new Date(selectedVersion.timestamp).toLocaleString("vi-VN");
    onRestore(selectedVersion.sheets, formattedTime, selectedVersion.title);
    onClose();
  };

  // Trích xuất các ô có dữ liệu để preview dạng bảng mini
  const cellKeys = Object.keys(activeSheet.cells || {});
  const filledCellsCount = cellKeys.filter(k => activeSheet.cells[k]?.value || activeSheet.cells[k]?.formula).length;

  return (
    <div className="sheets-modal-overlay" onClick={onClose}>
      <div className="sheets-version-history-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sheets-version-history-header">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-emerald-500" />
            <div>
              <h3 className="text-base font-bold text-[var(--fg)]">Lịch sử phiên bản</h3>
              <p className="text-xs text-[var(--fg-muted)]">
                Xem lại các bản chỉnh sửa và khôi phục về bản trước đó
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {selectedVersionId !== "current" && (
              <button
                onClick={handleApplyRestore}
                className="btn-version-restore-action"
                title="Áp dụng phiên bản này vào trang tính hiện tại"
              >
                <RotateCcw className="w-4 h-4" />
                Khôi phục phiên bản này
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Body (Split Preview & History List) */}
        <div className="sheets-version-history-body">
          {/* Cột Trái: Preview Trang tính */}
          <div className="sheets-version-preview-pane">
            <div className="sheets-preview-meta-bar">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[var(--bg-3)] text-[var(--fg)]">
                  {selectedVersionId === "current" ? "Phiên bản hiện tại (Đang mở)" : `Bản lưu lúc ${new Date(selectedVersion?.timestamp || "").toLocaleString("vi-VN")}`}
                </span>
                <span className="text-xs text-gray-400">
                  • {previewSheets.length} trang tính • {filledCellsCount} ô có dữ liệu
                </span>
              </div>

              {/* Tab selector */}
              <div className="flex items-center gap-1 overflow-x-auto max-w-[300px]">
                {previewSheets.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActivePreviewTab(idx)}
                    className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                      activePreviewTab === idx
                        ? "bg-emerald-600 text-white font-medium shadow-sm"
                        : "bg-[var(--bg-2)] text-[var(--fg-2)] hover:bg-[var(--bg-3)]"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Bảng xem trước rút gọn (Preview Grid Matrix) */}
            <div className="sheets-preview-table-wrapper">
              <table className="sheets-preview-table">
                <thead>
                  <tr>
                    <th className="w-10 text-center">#</th>
                    {["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"].map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 15 }).map((_, rIdx) => {
                    const rowNum = rIdx + 1;
                    return (
                      <tr key={rowNum}>
                        <td className="row-header-num">{rowNum}</td>
                        {["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"].map((col) => {
                          const addr = `${col}${rowNum}`;
                          const cell = activeSheet.cells?.[addr];
                          const displayVal = cell?.value || (cell?.formula ? cell.formula : "");
                          return (
                            <td
                              key={addr}
                              className={`preview-cell ${displayVal ? "has-data" : ""}`}
                              title={addr}
                            >
                              {displayVal}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cột Phải: Danh sách mốc lịch sử */}
          <div className="sheets-version-sidebar">
            <div className="p-3 border-b border-[var(--border)] bg-[var(--bg-2)]">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                Lịch sử lưu ({versions.length + 1})
              </span>
            </div>

            <div className="sheets-version-list-scroll">
              {loading ? (
                <div className="flex flex-col items-center justify-center p-8 text-gray-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                  <span className="text-xs">Đang tải các phiên bản...</span>
                </div>
              ) : (
                <div className="space-y-1.5 p-3">
                  {/* Bản hiện tại */}
                  <div
                    onClick={() => setSelectedVersionId("current")}
                    className={`version-item-card ${selectedVersionId === "current" ? "active" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                        <span className="font-bold text-sm text-[var(--fg)]">Bản hiện tại</span>
                      </div>
                      {selectedVersionId === "current" && (
                        <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3" /> Đang xem
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--fg-muted)] mt-1 pl-4.5">
                      Dữ liệu trang tính bạn đang thao tác
                    </p>
                  </div>

                  {/* Danh sách phiên bản lưu trong database */}
                  {versions.length === 0 ? (
                    <div className="text-center py-6 text-xs text-gray-400 px-4">
                      Chưa có phiên bản lưu trước đó. Mỗi lần bạn chỉnh sửa và bấm <strong>"Lưu lại"</strong>, hệ thống sẽ tự động tạo một mốc lịch sử mới tại đây.
                    </div>
                  ) : (
                    versions.map((ver, idx) => {
                      const isSelected = selectedVersionId === ver.id;
                      const formattedDate = new Date(ver.timestamp).toLocaleDateString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      });
                      const formattedTime = new Date(ver.timestamp).toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });

                      const userName = ver.user?.name || ver.user?.email || "Người dùng";
                      const userAvatar = ver.user?.avatar;

                      return (
                        <div
                          key={ver.id || idx}
                          onClick={() => setSelectedVersionId(ver.id)}
                          className={`version-item-card ${isSelected ? "active" : ""}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <span className="font-semibold text-xs text-[var(--fg)] truncate">
                                {formattedDate} {formattedTime}
                              </span>
                            </div>
                            {isSelected && (
                              <ChevronRight className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-2 pl-5">
                            <div className="w-5 h-5 rounded-full overflow-hidden bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                              {userAvatar ? (
                                <img src={userAvatar} alt="Avatar" className="w-full h-full object-cover" />
                              ) : (
                                userName.charAt(0).toUpperCase()
                              )}
                            </div>
                            <span className="text-xs text-[var(--fg-2)] truncate font-medium">
                              {userName}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VersionHistoryModal;
