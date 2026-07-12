// frontend/src/components/admin/SpreadsheetToolbar.tsx
import React from "react";
import { 
  Search, Undo, Redo, Printer, Paintbrush, DollarSign, Percent, 
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, 
  AlignRight, PaintBucket, Link2, BarChart2, Filter, Sigma, ChevronDown 
} from "lucide-react";

const fonts = [
  "Times New Roman",
  "Arial",
  "Calibri",
  "Tahoma",
  "Verdana",
  "Courier New",
  "Georgia",
  "Roboto",
  "Inter",
  "Montserrat"
];

const fontSizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];

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
  const [showFontDropdown, setShowFontDropdown] = React.useState(false);
  const [showSizeDropdown, setShowSizeDropdown] = React.useState(false);

  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".custom-dropdown-container")) {
        setShowFontDropdown(false);
        setShowSizeDropdown(false);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => {
      document.removeEventListener("click", handleOutsideClick);
    };
  }, []);
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

      {/* Font Family custom Dropdown */}
      <div className="relative custom-dropdown-container">
        <button 
          onClick={() => {
            setShowFontDropdown(!showFontDropdown);
            setShowSizeDropdown(false);
          }} 
          className="tool-select-custom"
          title="Phông chữ"
        >
          <span className="truncate max-w-[90px]">{activeCell?.fontFamily || "Times New Roman"}</span>
          <ChevronDown className="w-3.5 h-3.5 ml-1 text-gray-500" />
        </button>
        {showFontDropdown && (
          <div className="custom-dropdown-list font-dropdown">
            {fonts.map((f) => (
              <button 
                key={f} 
                className={`custom-dropdown-item ${activeCell?.fontFamily === f ? "active" : ""}`}
                style={{ fontFamily: f }}
                onClick={() => {
                  handleFontChange("fontFamily", f);
                  setShowFontDropdown(false);
                }}
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Font Size controls & custom size dropdown */}
      <div className="toolbar-font-size-control custom-dropdown-container">
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
        
        <div className="relative flex items-center">
          <input 
            type="number" 
            className="input-size-value cursor-pointer"
            style={{ width: "32px", border: "none", background: "transparent", textAlign: "center", fontSize: "12px", outline: "none", color: "var(--fg)" }}
            value={parseInt(activeCell?.fontSize || "13px", 10)}
            onChange={(e) => {
              const val = Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 13));
              handleFontChange("fontSize", `${val}px`);
            }}
            onClick={() => {
              setShowSizeDropdown(!showSizeDropdown);
              setShowFontDropdown(false);
            }}
            title="Cỡ chữ (Nhập hoặc chọn)"
          />
          <ChevronDown 
            className="w-3 h-3 text-gray-500 cursor-pointer -ml-1 mr-1"
            onClick={() => {
              setShowSizeDropdown(!showSizeDropdown);
              setShowFontDropdown(false);
            }}
          />
          {showSizeDropdown && (
            <div className="custom-dropdown-list size-dropdown">
              {fontSizes.map((s) => (
                <button 
                  key={s} 
                  className={`custom-dropdown-item ${(parseInt(activeCell?.fontSize || "13px", 10) === s) ? "active" : ""}`}
                  onClick={() => {
                    handleFontChange("fontSize", `${s}px`);
                    setShowSizeDropdown(false);
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

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
