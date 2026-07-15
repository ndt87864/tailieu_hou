import React from "react";
import { Scissors, Copy, Clipboard, Plus, Trash2, X, Sparkles, Filter, History, Link, Table, ChevronRight } from "lucide-react";
import { numberToColLetter } from "../../utils/formulaEvaluator.js";

interface GridContextMenuProps {
  contextMenu: { x: number; y: number; type: "row" | "col" | "cell"; index: number; colIndex?: number; address?: string } | null;
  onClose: () => void;
  handleCut: () => void;
  handleCopy: () => void;
  handlePaste: () => void;
  onInsertRow: (atRow: number, position: "above" | "below") => void;
  onDeleteRow: (atRow: number) => void;
  onClearRow: (atRow: number) => void;
  rowHeights?: Record<number, number>;
  onUpdateRowHeight: (rowNum: number, height: number) => void;
  onInsertCol: (atColLetter: string, position: "left" | "right") => void;
  onDeleteCol: (atColLetter: string) => void;
  onClearCol: (atColLetter: string) => void;
  colWidths?: Record<string, number>;
  onUpdateColWidth: (colLetter: string, width: number) => void;
  // Bổ sung các callback cho ô
  onClearCell?: (address: string) => void;
  onTriggerGemini?: (address: string) => void;
  onShowCellHistory?: (address: string) => void;
  onInsertLink?: (address: string) => void;
  handlePasteSpecial?: (option: "value" | "format") => void;
  onShiftCells?: (direction: "down" | "right") => void;
  onDeleteCellsAndShift?: (direction: "up" | "left") => void;
  onConvertToTable?: () => void;
  onCreateFilter?: () => void;
  onFilterByCellValue?: () => void;
}

export const GridContextMenu: React.FC<GridContextMenuProps> = ({
  contextMenu,
  onClose,
  handleCut,
  handleCopy,
  handlePaste,
  onInsertRow,
  onDeleteRow,
  onClearRow,
  rowHeights,
  onUpdateRowHeight,
  onInsertCol,
  onDeleteCol,
  onClearCol,
  colWidths,
  onUpdateColWidth,
  onClearCell,
  onTriggerGemini,
  onShowCellHistory,
  onInsertLink,
  handlePasteSpecial,
  onShiftCells,
  onDeleteCellsAndShift,
  onConvertToTable,
  onCreateFilter,
  onFilterByCellValue,
}) => {
  if (!contextMenu) return null;

  return (
    <div 
      className="sheets-context-menu" 
      style={{ top: contextMenu.y, left: contextMenu.x }}
      onClick={(e) => e.stopPropagation()}
    >
      <button className="sheets-context-menu-item" onClick={() => { handleCut(); onClose(); }}>
        <span className="sheets-context-menu-item-left">
          <Scissors className="w-3.5 h-3.5 text-gray-400" />
          Cắt
        </span>
        <span className="sheets-context-menu-item-shortcut">Ctrl+X</span>
      </button>
      <button className="sheets-context-menu-item" onClick={() => { handleCopy(); onClose(); }}>
        <span className="sheets-context-menu-item-left">
          <Copy className="w-3.5 h-3.5 text-gray-400" />
          Sao chép
        </span>
        <span className="sheets-context-menu-item-shortcut">Ctrl+C</span>
      </button>
      <button className="sheets-context-menu-item" onClick={() => { handlePaste(); onClose(); }}>
        <span className="sheets-context-menu-item-left">
          <Clipboard className="w-3.5 h-3.5 text-gray-400" />
          Dán tất cả
        </span>
        <span className="sheets-context-menu-item-shortcut">Ctrl+V</span>
      </button>
      
      <button className="sheets-context-menu-item" onClick={() => { if (handlePasteSpecial) handlePasteSpecial("value"); onClose(); }}>
        <span className="sheets-context-menu-item-left">
          <Clipboard className="w-3.5 h-3.5 text-gray-400" />
          Dán chỉ giá trị
        </span>
      </button>

      <button className="sheets-context-menu-item" onClick={() => { if (handlePasteSpecial) handlePasteSpecial("format"); onClose(); }}>
        <span className="sheets-context-menu-item-left">
          <Clipboard className="w-3.5 h-3.5 text-gray-400" />
          Dán chỉ định dạng
        </span>
      </button>

      <div className="sheets-context-menu-divider" />

      {/* Nút Gemini AI */}
      <button 
        className="sheets-context-menu-item" 
        onClick={() => {
          if (onTriggerGemini && contextMenu.address) onTriggerGemini(contextMenu.address);
          onClose();
        }}
      >
        <span className="sheets-context-menu-item-left">
          <Sparkles className="w-3.5 h-3.5 text-blue-500" />
          Điền thông tin vào cột bằng Gemini
        </span>
        <span className="badge-new ml-auto text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold">Mới</span>
      </button>

      <div className="sheets-context-menu-divider" />

      {contextMenu.type === "row" ? (
        <>
          <button 
            className="sheets-context-menu-item" 
            onClick={() => {
              onInsertRow(contextMenu.index, "above");
              onClose();
            }}
          >
            <span className="sheets-context-menu-item-left">
              <Plus className="w-3.5 h-3.5 text-gray-400" />
              Chèn 1 hàng lên trên
            </span>
          </button>
          <button 
            className="sheets-context-menu-item" 
            onClick={() => {
              onInsertRow(contextMenu.index, "below");
              onClose();
            }}
          >
            <span className="sheets-context-menu-item-left">
              <Plus className="w-3.5 h-3.5 text-gray-400" />
              Chèn 1 hàng xuống dưới
            </span>
          </button>
          <button 
            className="sheets-context-menu-item text-red-500 hover:bg-red-50" 
            onClick={() => {
              onDeleteRow(contextMenu.index);
              onClose();
            }}
          >
            <span className="sheets-context-menu-item-left">
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              Xóa hàng
            </span>
          </button>
          <button 
            className="sheets-context-menu-item" 
            onClick={() => {
              onClearRow(contextMenu.index);
              onClose();
            }}
          >
            <span className="sheets-context-menu-item-left">
              <X className="w-3.5 h-3.5 text-gray-400" />
              Xóa nội dung hàng
            </span>
          </button>
          
          <div className="sheets-context-menu-divider" />
          
          <button 
            className="sheets-context-menu-item" 
            onClick={() => {
              const currentHeight = rowHeights?.[contextMenu.index] || 25;
              const val = prompt(`Nhập chiều cao cho hàng ${contextMenu.index} (px):`, currentHeight.toString());
              if (val) {
                const parsed = parseInt(val, 10);
                if (!isNaN(parsed) && parsed > 5) {
                  onUpdateRowHeight(contextMenu.index, parsed);
                }
              }
              onClose();
            }}
          >
            <span className="sheets-context-menu-item-left">
              <Plus className="w-3.5 h-3.5 text-gray-400" />
              Đổi kích thước hàng
            </span>
          </button>
        </>
      ) : contextMenu.type === "col" ? (
        <>
          <button 
            className="sheets-context-menu-item" 
            onClick={() => {
              onInsertCol(numberToColLetter(contextMenu.index), "left");
              onClose();
            }}
          >
            <span className="sheets-context-menu-item-left">
              <Plus className="w-3.5 h-3.5 text-gray-400" />
              Chèn 1 cột bên trái
            </span>
          </button>
          <button 
            className="sheets-context-menu-item" 
            onClick={() => {
              onInsertCol(numberToColLetter(contextMenu.index), "right");
              onClose();
            }}
          >
            <span className="sheets-context-menu-item-left">
              <Plus className="w-3.5 h-3.5 text-gray-400" />
              Chèn 1 cột bên phải
            </span>
          </button>
          <button 
            className="sheets-context-menu-item text-red-500 hover:bg-red-50" 
            onClick={() => {
              onDeleteCol(numberToColLetter(contextMenu.index));
              onClose();
            }}
          >
            <span className="sheets-context-menu-item-left">
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              Xóa cột
            </span>
          </button>
          <button 
            className="sheets-context-menu-item" 
            onClick={() => {
              onClearCol(numberToColLetter(contextMenu.index));
              onClose();
            }}
          >
            <span className="sheets-context-menu-item-left">
              <X className="w-3.5 h-3.5 text-gray-400" />
              Xóa nội dung cột
            </span>
          </button>

          <div className="sheets-context-menu-divider" />

          <button 
            className="sheets-context-menu-item" 
            onClick={() => {
              const colLetter = numberToColLetter(contextMenu.index);
              const currentWidth = colWidths?.[colLetter] || 100;
              const val = prompt(`Nhập chiều rộng cho cột ${colLetter} (px):`, currentWidth.toString());
              if (val) {
                const parsed = parseInt(val, 10);
                if (!isNaN(parsed) && parsed > 5) {
                  onUpdateColWidth(colLetter, parsed);
                }
              }
              onClose();
            }}
          >
            <span className="sheets-context-menu-item-left">
              <Plus className="w-3.5 h-3.5 text-gray-400" />
              Đổi kích thước cột
            </span>
          </button>
        </>
      ) : (
        /* type === "cell" */
        <>
          <button 
            className="sheets-context-menu-item" 
            onClick={() => {
              onInsertRow(contextMenu.index, "above");
              onClose();
            }}
          >
            <span className="sheets-context-menu-item-left">
              <Plus className="w-3.5 h-3.5 text-gray-400" />
              Chèn 1 hàng lên trên
            </span>
          </button>
          <button 
            className="sheets-context-menu-item" 
            onClick={() => {
              if (contextMenu.colIndex !== undefined) {
                onInsertCol(numberToColLetter(contextMenu.colIndex), "left");
              }
              onClose();
            }}
          >
            <span className="sheets-context-menu-item-left">
              <Plus className="w-3.5 h-3.5 text-gray-400" />
              Chèn 1 cột bên trái
            </span>
          </button>
          <button 
            className="sheets-context-menu-item" 
            onClick={() => {
              if (onShiftCells) onShiftCells("down");
              onClose();
            }}
          >
            <span className="sheets-context-menu-item-left">
              <Plus className="w-3.5 h-3.5 text-gray-400" />
              Chèn ô và dịch chuyển xuống
            </span>
          </button>
          <button 
            className="sheets-context-menu-item" 
            onClick={() => {
              if (onShiftCells) onShiftCells("right");
              onClose();
            }}
          >
            <span className="sheets-context-menu-item-left">
              <Plus className="w-3.5 h-3.5 text-gray-400" />
              Chèn ô và dịch chuyển sang phải
            </span>
          </button>

          <div className="sheets-context-menu-divider" />

          <button 
            className="sheets-context-menu-item" 
            onClick={() => {
              onDeleteRow(contextMenu.index);
              onClose();
            }}
          >
            <span className="sheets-context-menu-item-left">
              <Trash2 className="w-3.5 h-3.5 text-gray-400" />
              Xóa hàng
            </span>
          </button>
          <button 
            className="sheets-context-menu-item" 
            onClick={() => {
              if (contextMenu.colIndex !== undefined) {
                onDeleteCol(numberToColLetter(contextMenu.colIndex));
              }
              onClose();
            }}
          >
            <span className="sheets-context-menu-item-left">
              <Trash2 className="w-3.5 h-3.5 text-gray-400" />
              Xóa cột
            </span>
          </button>
          <button 
            className="sheets-context-menu-item" 
            onClick={() => {
              if (onDeleteCellsAndShift) onDeleteCellsAndShift("up");
              onClose();
            }}
          >
            <span className="sheets-context-menu-item-left">
              <Trash2 className="w-3.5 h-3.5 text-gray-400" />
              Xóa ô và dịch chuyển lên
            </span>
          </button>
          <button 
            className="sheets-context-menu-item" 
            onClick={() => {
              if (onDeleteCellsAndShift) onDeleteCellsAndShift("left");
              onClose();
            }}
          >
            <span className="sheets-context-menu-item-left">
              <Trash2 className="w-3.5 h-3.5 text-gray-400" />
              Xóa ô và dịch chuyển sang trái
            </span>
          </button>

          <div className="sheets-context-menu-divider" />

          <button 
            className="sheets-context-menu-item" 
            onClick={() => {
              if (onConvertToTable) onConvertToTable();
              onClose();
            }}
          >
            <span className="sheets-context-menu-item-left">
              <Table className="w-3.5 h-3.5 text-green-600" />
              Chuyển đổi thành bảng
            </span>
            <span className="badge-new ml-auto text-[10px] bg-green-600 text-white px-1.5 py-0.5 rounded font-bold">Mới</span>
          </button>
          <button 
            className="sheets-context-menu-item" 
            onClick={() => {
              if (onCreateFilter) onCreateFilter();
              onClose();
            }}
          >
            <span className="sheets-context-menu-item-left">
              <Filter className="w-3.5 h-3.5 text-gray-400" />
              Tạo bộ lọc
            </span>
          </button>
          <button 
            className="sheets-context-menu-item" 
            onClick={() => {
              if (onFilterByCellValue) onFilterByCellValue();
              onClose();
            }}
          >
            <span className="sheets-context-menu-item-left">
              <Filter className="w-3.5 h-3.5 text-gray-400" />
              Lọc theo giá trị của ô
            </span>
          </button>

          <div className="sheets-context-menu-divider" />

          <button 
            className="sheets-context-menu-item" 
            onClick={() => {
              if (onShowCellHistory && contextMenu.address) onShowCellHistory(contextMenu.address);
              onClose();
            }}
          >
            <span className="sheets-context-menu-item-left">
              <History className="w-3.5 h-3.5 text-gray-400" />
              Hiển thị lịch sử chỉnh sửa
            </span>
          </button>
          <button 
            className="sheets-context-menu-item" 
            onClick={() => {
              if (onInsertLink && contextMenu.address) onInsertLink(contextMenu.address);
              onClose();
            }}
          >
            <span className="sheets-context-menu-item-left">
              <Link className="w-3.5 h-3.5 text-gray-400" />
              Chèn đường liên kết
            </span>
          </button>
        </>
      )}
    </div>
  );
};
