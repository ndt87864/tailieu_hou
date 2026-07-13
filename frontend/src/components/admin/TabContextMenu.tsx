// frontend/src/components/admin/TabContextMenu.tsx
import React from "react";
import { toast } from "react-toastify";
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
        className="sheets-context-menu-backdrop"
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
        style={{ position: "fixed", inset: 0, zIndex: 99998 }}
      />
      <div
        className="sheets-tab-context-menu"
        style={{
          position: "fixed",
          top: `${tabContextMenu.y - 180}px`,
          left: `${tabContextMenu.x}px`,
          zIndex: 99999,
          backgroundColor: "var(--surface, #fff)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          padding: "4px 0",
          minWidth: "160px",
          color: "var(--fg)",
        }}
      >
        <button
          className="sheets-tab-menu-item"
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
          style={{
            display: "flex",
            width: "100%",
            padding: "8px 12px",
            border: "none",
            background: "none",
            fontSize: "13px",
            cursor: sheet.isProtected ? "not-allowed" : "pointer",
            color: sheet.isProtected ? "gray" : "red",
            opacity: sheet.isProtected ? 0.5 : 1,
            textAlign: "left",
          }}
        >
          Xóa
        </button>
        <button
          className="sheets-tab-menu-item"
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
          style={{ display: "flex", width: "100%", padding: "8px 12px", border: "none", background: "none", fontSize: "13px", cursor: "pointer", color: "inherit", textAlign: "left" }}
        >
          Nhân bản
        </button>
        <button
          className="sheets-tab-menu-item"
          onClick={() => {
            setRenameSheetModal({ idx: targetIdx, name: sheet.name });
            onClose();
          }}
          style={{ display: "flex", width: "100%", padding: "8px 12px", border: "none", background: "none", fontSize: "13px", cursor: "pointer", color: "inherit", textAlign: "left" }}
        >
          Đổi tên
        </button>
        <div className="sheets-tab-menu-submenu-wrapper" style={{ position: "relative" }}>
          <button
            className="sheets-tab-menu-item flex justify-between items-center"
            onClick={(e) => { e.stopPropagation(); }}
            style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: "8px 12px", border: "none", background: "none", fontSize: "13px", cursor: "pointer", color: "inherit", textAlign: "left" }}
          >
            <span>Thay đổi màu</span>
            <span style={{ fontSize: "9px" }}>▶</span>
          </button>
          <div
            className="sheets-tab-color-picker"
            style={{
              position: "absolute",
              left: "100%",
              top: 0,
              backgroundColor: "var(--surface, #fff)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              padding: "8px",
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "4px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
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
                style={{
                  width: "16px",
                  height: "16px",
                  borderRadius: "50%",
                  backgroundColor: c || "#ccc",
                  border: "1px solid #ddd",
                  cursor: "pointer",
                }}
                title={c ? c : "Không màu"}
              />
            ))}
          </div>
        </div>
        <button
          className="sheets-tab-menu-item"
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
          style={{ display: "flex", width: "100%", padding: "8px 12px", border: "none", background: "none", fontSize: "13px", cursor: "pointer", color: "inherit", textAlign: "left" }}
        >
          {sheet.isProtected ? "Hủy bảo vệ trang tính" : "Bảo vệ trang tính"}
        </button>
        {visibleSheetsCount > 1 && (
          <button
            className="sheets-tab-menu-item"
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
            style={{ display: "flex", width: "100%", padding: "8px 12px", border: "none", background: "none", fontSize: "13px", cursor: "pointer", color: "inherit", textAlign: "left" }}
          >
            Ẩn trang tính
          </button>
        )}
        <button
          className="sheets-tab-menu-item"
          onClick={() => {
            const isCurrentVip = !!sheet.isVip;
            updateSheetsAndSaveHistory((prev) => {
              return prev.map((s, i) => {
                if (i === targetIdx) return { ...s, isVip: !isCurrentVip };
                return !isCurrentVip ? { ...s, isVip: false } : s;
              });
            });

            if (!isCurrentVip) {
              const vipData = {
                name: sheet.name,
                cells: JSON.parse(JSON.stringify(sheet.cells || {})),
                rowCount: sheet.rowCount || 500,
                colCount: sheet.colCount || 26,
                rowHeights: JSON.parse(JSON.stringify(sheet.rowHeights || {})),
                colWidths: JSON.parse(JSON.stringify(sheet.colWidths || {})),
                isProtected: false,
                isHidden: false,
                isVip: true,
              };
              localStorage.setItem("hou_vip_sheet_template", JSON.stringify(vipData));
              toast.success(`Đã gán "${sheet.name}" làm Sheet VIP mẫu cho trang tính mới!`);
            } else {
              localStorage.removeItem("hou_vip_sheet_template");
              toast.info(`Đã hủy gán Sheet VIP cho "${sheet.name}".`);
            }

            onClose();
            setTimeout(() => handleSave(), 100);
          }}
          style={{ display: "flex", width: "100%", padding: "8px 12px", border: "none", background: "none", fontSize: "13px", cursor: "pointer", color: "inherit", textAlign: "left" }}
        >
          {sheet.isVip ? "⭐ Hủy gán Sheet VIP" : "⭐ Gán làm Sheet VIP"}
        </button>
        <div style={{ height: "1px", backgroundColor: "var(--border)", margin: "4px 0" }} />
        <button
          className="sheets-tab-menu-item"
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
          style={{ display: "flex", width: "100%", padding: "8px 12px", border: "none", background: "none", fontSize: "13px", cursor: targetIdx === sheets.length - 1 ? "not-allowed" : "pointer", color: "inherit", opacity: targetIdx === sheets.length - 1 ? 0.4 : 1, textAlign: "left" }}
        >
          Di chuyển sang phải
        </button>
        <button
          className="sheets-tab-menu-item"
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
          style={{ display: "flex", width: "100%", padding: "8px 12px", border: "none", background: "none", fontSize: "13px", cursor: targetIdx === 0 ? "not-allowed" : "pointer", color: "inherit", opacity: targetIdx === 0 ? 0.4 : 1, textAlign: "left" }}
        >
          Di chuyển sang trái
        </button>
      </div>
    </>
  );
};
