// frontend/src/components/admin/TabContextMenu.tsx
import React from "react";
import { toast } from "react-toastify";
import apiClient from "../../services/client.js";
import { Sheet } from "../../hooks/useSpreadsheetState.js";

interface TabContextMenuProps {
  tabContextMenu: { idx: number; x: number; y: number } | null;
  onClose: () => void;
  sheets: Sheet[];
  visibleSheetsCount: number;
  updateSheetsAndSaveHistory: (newSheets: Sheet[] | ((prev: Sheet[]) => Sheet[]), skipHistory?: boolean) => void;
  setActiveSheetIdx: (idx: number) => void;
  setDeleteSheetModal: (val: { idx: number; name: string } | null) => void;
  setRenameSheetModal: (val: { idx: number; name: string } | null) => void;
  handleSave: (customSheets?: Sheet[]) => void;
}

export const TabContextMenu: React.FC<TabContextMenuProps> = ({
  tabContextMenu,
  onClose,
  sheets,
  visibleSheetsCount,
  updateSheetsAndSaveHistory,
  setActiveSheetIdx,
  setDeleteSheetModal,
  setRenameSheetModal,
  handleSave,
}) => {
  if (!tabContextMenu) return null;
  const targetIdx = tabContextMenu.idx;
  const sheet = sheets[targetIdx];
  if (!sheet) return null;

  return (
    <>
      <div
        className="sheets-context-menu-backdrop fixed inset-0 z-[99998]"
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />
      <div
        className="sheets-tab-context-menu fixed z-[99999] bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.15)] py-1 min-w-[160px] text-[var(--fg)]"
        style={{
          top: `${tabContextMenu.y - 180}px`,
          left: `${tabContextMenu.x}px`,
        }}
      >
        <button
          onClick={() => {
            if (sheet.isProtected) {
              toast.error("Không thể xóa trang tính đang được bảo vệ!");
              onClose();
              return;
            }
            if (sheets.length <= 1) {
              toast.warn("Workbook phải có ít nhất 1 trang tính!");
              onClose();
              return;
            }
            setDeleteSheetModal({ idx: targetIdx, name: sheet.name });
            onClose();
          }}
          className={`sheets-tab-menu-item flex w-full px-3 py-2 border-none bg-none text-[13px] text-left ${
            sheet.isProtected 
              ? "text-gray-400 cursor-not-allowed opacity-50" 
              : "text-red-500 hover:bg-[var(--bg-3)] cursor-pointer"
          }`}
        >
          Xóa
        </button>
        <button
          className="sheets-tab-menu-item flex w-full px-3 py-2 border-none bg-none text-[13px] text-left text-inherit cursor-pointer hover:bg-[var(--bg-3)]"
          onClick={() => {
            updateSheetsAndSaveHistory((prev) => [
              ...prev,
              {
                ...sheet,
                name: `${sheet.name} (Bản sao)`,
                cells: { ...sheet.cells },
                rowHeights: sheet.rowHeights ? { ...sheet.rowHeights } : {},
                colWidths: sheet.colWidths ? { ...sheet.colWidths } : {},
              },
            ]);
            onClose();
            toast.success("Đã nhân bản trang tính!");
          }}
        >
          Nhân bản
        </button>
        <button
          className="sheets-tab-menu-item flex w-full px-3 py-2 border-none bg-none text-[13px] text-left text-inherit cursor-pointer hover:bg-[var(--bg-3)]"
          onClick={() => {
            setRenameSheetModal({ idx: targetIdx, name: sheet.name });
            onClose();
          }}
        >
          Đổi tên
        </button>
        <div className="sheets-tab-menu-submenu-wrapper relative">
          <button
            className="sheets-tab-menu-item flex justify-between items-center w-full px-3 py-2 border-none bg-none text-[13px] text-left text-inherit cursor-pointer hover:bg-[var(--bg-3)]"
            onClick={(e) => { e.stopPropagation(); }}
          >
            <span>Thay đổi màu</span>
            <span className="text-[9px]">▶</span>
          </button>
          <div
            className="sheets-tab-color-picker absolute left-full top-0 bg-[var(--surface)] border border-[var(--border)] rounded-md p-2 grid grid-cols-4 gap-1 shadow-[0_4px_12px_rgba(0,0,0,0.1)]"
          >
            {["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", ""].map((c) => (
              <button
                key={c}
                onClick={() => {
                  updateSheetsAndSaveHistory((prev) => {
                    const copy = [...prev];
                    (copy[targetIdx] as any).color = c;
                    return copy;
                  });
                  onClose();
                }}
                className="w-4 h-4 rounded-full border border-gray-300 cursor-pointer"
                style={{
                  backgroundColor: c || "#ccc",
                }}
                title={c ? c : "Không màu"}
              />
            ))}
          </div>
        </div>
        <button
          className="sheets-tab-menu-item flex w-full px-3 py-2 border-none bg-none text-[13px] text-left text-inherit cursor-pointer hover:bg-[var(--bg-3)]"
          onClick={() => {
            const isCurrentProtected = !!sheet.isProtected;
            updateSheetsAndSaveHistory((prev) => {
              const copy = [...prev];
              copy[targetIdx] = { ...copy[targetIdx], isProtected: !isCurrentProtected };
              return copy;
            });
            toast.success(isCurrentProtected ? "Đã hủy bảo vệ trang tính thành công!" : "Đã bảo vệ trang tính thành công!");
            onClose();
            setTimeout(() => handleSave(), 100);
          }}
        >
          {sheet.isProtected ? "Hủy bảo vệ trang tính" : "Bảo vệ trang tính"}
        </button>
        {visibleSheetsCount > 1 && (
          <button
            className="sheets-tab-menu-item flex w-full px-3 py-2 border-none bg-none text-[13px] text-left text-inherit cursor-pointer hover:bg-[var(--bg-3)]"
            onClick={() => {
              updateSheetsAndSaveHistory((prev) => {
                const copy = [...prev];
                copy[targetIdx] = { ...copy[targetIdx], isHidden: true };
                return copy;
              });
              const nextVisibleIdx = sheets.findIndex((s, i) => i !== targetIdx && !s.isHidden);
              if (nextVisibleIdx !== -1) {
                setActiveSheetIdx(nextVisibleIdx);
              }
              toast.success("Trang tính đã được ẩn thành công!");
              onClose();
              setTimeout(() => handleSave(), 100);
            }}
          >
            Ẩn trang tính
          </button>
        )}
        <button
          className="sheets-tab-menu-item flex w-full px-3 py-2 border-none bg-none text-[13px] text-left text-inherit cursor-pointer hover:bg-[var(--bg-3)]"
          onClick={() => {
            const isCurrentVip = !!sheet.isVip;
            let updatedSheets: Sheet[] = [];
            updateSheetsAndSaveHistory((prev) => {
              updatedSheets = prev.map((s, i) => {
                if (i === targetIdx) return { ...s, isVip: !isCurrentVip };
                return s;
              });
              return updatedSheets;
            });

            const performVipToggle = async () => {
              try {
                if (!isCurrentVip) {
                  const vipData = {
                    name: sheet.name,
                    cells: sheet.cells || {},
                    rowCount: sheet.rowCount || 500,
                    colCount: sheet.colCount || 26,
                    rowHeights: sheet.rowHeights || {},
                    colWidths: sheet.colWidths || {},
                    isProtected: false,
                    isHidden: false,
                    isVip: true,
                  };
                  await apiClient.post("/api/v1/spreadsheets/vip-templates", {
                    name: sheet.name,
                    content: vipData
                  });
                  toast.success(`Đã gán "${sheet.name}" làm Sheet VIP mẫu trong Database!`);
                } else {
                  await apiClient.delete(`/api/v1/spreadsheets/vip-templates/name/${encodeURIComponent(sheet.name)}`);
                  toast.info(`Đã hủy gán Sheet VIP cho "${sheet.name}".`);
                }
              } catch (err: any) {
                toast.error("Lỗi cập nhật mẫu VIP: " + err.message);
              }
            };

            performVipToggle();
            onClose();
            setTimeout(() => handleSave(updatedSheets), 100);
          }}
        >
          {sheet.isVip ? "⭐ Hủy gán Sheet VIP" : "⭐ Gán làm Sheet VIP"}
        </button>
        <div className="h-[1px] bg-[var(--border)] my-1" />
        <button
          disabled={targetIdx === sheets.length - 1}
          onClick={() => {
            if (targetIdx < sheets.length - 1) {
              updateSheetsAndSaveHistory((prev) => {
                const copy = [...prev];
                const temp = copy[targetIdx];
                copy[targetIdx] = copy[targetIdx + 1];
                copy[targetIdx + 1] = temp;
                return copy;
              });
              setActiveSheetIdx(targetIdx + 1);
            }
            onClose();
          }}
          className={`sheets-tab-menu-item flex w-full px-3 py-2 border-none bg-none text-[13px] text-left text-inherit ${
            targetIdx === sheets.length - 1
              ? "cursor-not-allowed opacity-40"
              : "cursor-pointer hover:bg-[var(--bg-3)]"
          }`}
        >
          Di chuyển sang phải
        </button>
        <button
          disabled={targetIdx === 0}
          onClick={() => {
            if (targetIdx > 0) {
              updateSheetsAndSaveHistory((prev) => {
                const copy = [...prev];
                const temp = copy[targetIdx];
                copy[targetIdx] = copy[targetIdx - 1];
                copy[targetIdx - 1] = temp;
                return copy;
              });
              setActiveSheetIdx(targetIdx - 1);
            }
            onClose();
          }}
          className={`sheets-tab-menu-item flex w-full px-3 py-2 border-none bg-none text-[13px] text-left text-inherit ${
            targetIdx === 0
              ? "cursor-not-allowed opacity-40"
              : "cursor-pointer hover:bg-[var(--bg-3)]"
          }`}
        >
          Di chuyển sang trái
        </button>
      </div>
    </>
  );
};
