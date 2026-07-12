// frontend/src/components/admin/SpreadsheetToolbar.tsx
import React from "react";
import { 
  Search, Undo, Redo, Printer, Paintbrush, DollarSign, Percent, 
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, 
  AlignRight, PaintBucket, Link2, BarChart2, Filter, Sigma 
} from "lucide-react";

type CellData = {
  value: string;
  formula: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color?: string;
  bg?: string;
  align?: "left" | "center" | "right";
  fontFamily?: string;
  fontSize?: string;
};

interface SpreadsheetToolbarProps {
  activeCell: CellData | null;
  zoomLevel: string;
  setZoomLevel: (z: string) => void;
  showFindReplace: boolean;
  setShowFindReplace: (s: boolean) => void;
  handleUndo: () => void;
  handleFontChange: (key: "fontFamily" | "fontSize", value: string) => void;
  handleToolbarStyleChange: (style: "bold" | "italic" | "underline" | "strikethrough") => void;
  handleAlignChange: (align: "left" | "center" | "right") => void;
  handleColorChange: (key: "color" | "bg", value: string) => void;
  onFormatSelection: (formatType: "currency" | "percent" | "decimal-inc" | "decimal-dec") => void;
  onInsertFormula: (func: string) => void;
}

export const SpreadsheetToolbar: React.FC<SpreadsheetToolbarProps> = ({
  activeCell,
  zoomLevel,
  setZoomLevel,
  showFindReplace,
  setShowFindReplace,
  handleUndo,
  handleFontChange,
  handleToolbarStyleChange,
  handleAlignChange,
  handleColorChange,
  onFormatSelection,
  onInsertFormula,
}) => {
  return (
    <div className="sheet-google-toolbar">
      <button onClick={() => setShowFindReplace(!showFindReplace)} className={`btn-tool ${showFindReplace ? "active" : ""}`} title="Tìm kiếm (Ctrl+H)">
        <Search className="w-4 h-4" />
      </button>
      
      <div className="toolbar-divider"></div>

      <button onClick={handleUndo} className="btn-tool" title="Hoàn tác (Ctrl+Z)">
        <Undo className="w-4 h-4" />
      </button>
      <button className="btn-tool" title="Làm lại (Ctrl+Y)" disabled>
        <Redo className="w-4 h-4" />
      </button>
      <button onClick={() => window.print()} className="btn-tool" title="In">
        <Printer className="w-4 h-4" />
      </button>
      <button className="btn-tool" title="Sao chép định dạng">
        <Paintbrush className="w-4 h-4" />
      </button>
      
      <select 
        className="tool-select" 
        value={zoomLevel} 
        onChange={(e) => setZoomLevel(e.target.value)}
        title="Thu phóng màn hình"
      >
        <option value="50%">50%</option>
        <option value="75%">75%</option>
        <option value="100%">100%</option>
        <option value="125%">125%</option>
        <option value="150%">150%</option>
      </select>

      <div className="toolbar-divider"></div>

      <button onClick={() => onFormatSelection("currency")} className="btn-tool" title="Định dạng tiền tệ ($)">
        <DollarSign className="w-4 h-4" />
      </button>
      <button onClick={() => onFormatSelection("percent")} className="btn-tool" title="Định dạng phần trăm (%)">
        <Percent className="w-4 h-4" />
      </button>
      <button onClick={() => onFormatSelection("decimal-dec")} className="btn-tool" title="Giảm số chữ số thập phân">
        <span className="text-[10px] font-bold">.00→.0</span>
      </button>
      <button onClick={() => onFormatSelection("decimal-inc")} className="btn-tool" title="Tăng số chữ số thập phân">
        <span className="text-[10px] font-bold">.0→.00</span>
      </button>

      <div className="toolbar-divider"></div>

      {/* Font Family */}
      <select 
        className="tool-select"
        value={activeCell?.fontFamily || "Inter"}
        onChange={(e) => handleFontChange("fontFamily", e.target.value)}
        title="Phông chữ"
      >
        <option value="Inter">Inter</option>
        <option value="Montserrat">Montserrat</option>
        <option value="Arial">Arial</option>
        <option value="Courier New">Courier New</option>
        <option value="Georgia">Georgia</option>
        <option value="Times New Roman">Times New Roman</option>
      </select>

      {/* Font Size controls */}
      <div className="toolbar-font-size-control">
        <button 
          onClick={() => {
            const cur = parseInt(activeCell?.fontSize || "13px", 10);
            handleFontChange("fontSize", `${Math.max(8, cur - 1)}px`);
          }}
          className="btn-size-step"
          title="Giảm cỡ chữ"
        >
          -
        </button>
        <input 
          type="text" 
          className="input-size-value"
          value={parseInt(activeCell?.fontSize || "13px", 10)}
          readOnly
        />
        <button 
          onClick={() => {
            const cur = parseInt(activeCell?.fontSize || "13px", 10);
            handleFontChange("fontSize", `${Math.min(72, cur + 1)}px`);
          }}
          className="btn-size-step"
          title="Tăng cỡ chữ"
        >
          +
        </button>
      </div>

      <div className="toolbar-divider"></div>

      <button
        onClick={() => handleToolbarStyleChange("bold")}
        className={`btn-tool ${activeCell?.bold ? "active" : ""}`}
        title="In đậm"
      >
        <Bold className="w-4 h-4" />
      </button>
      <button
        onClick={() => handleToolbarStyleChange("italic")}
        className={`btn-tool ${activeCell?.italic ? "active" : ""}`}
        title="In nghiêng"
      >
        <Italic className="w-4 h-4" />
      </button>
      <button
        onClick={() => handleToolbarStyleChange("underline")}
        className={`btn-tool ${activeCell?.underline ? "active" : ""}`}
        title="Gạch chân"
      >
        <Underline className="w-4 h-4" />
      </button>
      <button
        onClick={() => handleToolbarStyleChange("strikethrough")}
        className={`btn-tool ${activeCell?.strikethrough ? "active" : ""}`}
        title="Gạch ngang chữ"
      >
        <Strikethrough className="w-4 h-4" />
      </button>

      <div className="tool-color-picker" title="Màu chữ">
        <span className="text-[11px] font-semibold mr-1">A</span>
        <input
          type="color"
          className="tool-color-input"
          value={activeCell?.color || "#000000"}
          onChange={(e) => handleColorChange("color", e.target.value)}
        />
      </div>

      <div className="tool-color-picker" title="Màu nền">
        <PaintBucket className="w-4 h-4 mr-1 text-gray-500" />
        <input
          type="color"
          className="tool-color-input"
          value={activeCell?.bg || "#ffffff"}
          onChange={(e) => handleColorChange("bg", e.target.value)}
        />
      </div>

      <div className="toolbar-divider"></div>

      <button
        onClick={() => handleAlignChange("left")}
        className={`btn-tool ${activeCell?.align === "left" ? "active" : ""}`}
        title="Căn trái"
      >
        <AlignLeft className="w-4 h-4" />
      </button>
      <button
        onClick={() => handleAlignChange("center")}
        className={`btn-tool ${activeCell?.align === "center" ? "active" : ""}`}
        title="Căn giữa"
      >
        <AlignCenter className="w-4 h-4" />
      </button>
      <button
        onClick={() => handleAlignChange("right")}
        className={`btn-tool ${activeCell?.align === "right" ? "active" : ""}`}
        title="Căn phải"
      >
        <AlignRight className="w-4 h-4" />
      </button>

      <div className="toolbar-divider"></div>

      <button className="btn-tool" title="Chèn liên kết">
        <Link2 className="w-4 h-4" />
      </button>
      <button className="btn-tool" title="Chèn biểu đồ">
        <BarChart2 className="w-4 h-4" />
      </button>
      <button className="btn-tool" title="Tạo bộ lọc">
        <Filter className="w-4 h-4" />
      </button>
      
      <div className="relative group">
        <button className="btn-tool" title="Hàm số (Sigma)">
          <Sigma className="w-4 h-4" />
        </button>
        <div className="absolute right-0 top-full hidden group-hover:flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-md shadow-md py-1 z-[100] min-width-[120px]">
          <button onClick={() => onInsertFormula("SUM")} className="dropdown-action-btn py-1 px-3 text-xs hover:bg-[var(--bg-3)] w-full text-left">SUM</button>
          <button onClick={() => onInsertFormula("AVERAGE")} className="dropdown-action-btn py-1 px-3 text-xs hover:bg-[var(--bg-3)] w-full text-left">AVERAGE</button>
          <button onClick={() => onInsertFormula("MIN")} className="dropdown-action-btn py-1 px-3 text-xs hover:bg-[var(--bg-3)] w-full text-left">MIN</button>
          <button onClick={() => onInsertFormula("MAX")} className="dropdown-action-btn py-1 px-3 text-xs hover:bg-[var(--bg-3)] w-full text-left">MAX</button>
          <button onClick={() => onInsertFormula("COUNT")} className="dropdown-action-btn py-1 px-3 text-xs hover:bg-[var(--bg-3)] w-full text-left">COUNT</button>
        </div>
      </div>
    </div>
  );
};
