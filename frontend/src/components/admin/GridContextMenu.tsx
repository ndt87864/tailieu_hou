// frontend/src/components/admin/GridContextMenu.tsx
import React from "react";
import { Scissors, Copy, Clipboard, Plus, Trash2, X } from "lucide-react";
import { numberToColLetter } from "../../utils/formulaEvaluator.js";

interface GridContextMenuProps {
  contextMenu: { x: number; y: number; type: "row" | "col"; index: number } | null;
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
          Dán
        </span>
        <span className="sheets-context-menu-item-shortcut">Ctrl+V</span>
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
      ) : (
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
      )}
    </div>
  );
};
