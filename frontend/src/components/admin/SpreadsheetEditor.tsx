// frontend/src/components/admin/SpreadsheetEditor.tsx
import React, { useState, useEffect } from "react";
import { 
  ArrowLeft, Save, Download, Upload, Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignRight, Search, FileJson, Plus, X 
} from "lucide-react";
import { SpreadsheetGrid } from "./SpreadsheetGrid.js";
import { getCellRange } from "../../utils/formulaEvaluator.js";
import { toast } from "react-toastify";

type CellData = {
  value: string;
  formula: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  bg?: string;
  align?: "left" | "center" | "right";
  fontFamily?: string;
  fontSize?: string;
};

interface Sheet {
  name: string;
  cells: Record<string, CellData>;
  rowCount?: number;
  colCount?: number;
}

interface SpreadsheetEditorProps {
  sheetId: string;
  initialTitle: string;
  initialContent: any;
  onBack: () => void;
  onSave: (title: string, content: any) => Promise<void>;
}

export const SpreadsheetEditor: React.FC<SpreadsheetEditorProps> = ({
  sheetId,
  initialTitle,
  initialContent,
  onBack,
  onSave,
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [isSaving, setIsSaving] = useState(false);

  // Khởi tạo sheets list từ database content, mặc định ban đầu là 500 hàng
  const [sheets, setSheets] = useState<Sheet[]>(() => {
    if (initialContent?.sheets && Array.isArray(initialContent.sheets)) {
      return initialContent.sheets.map((s: any) => ({
        name: s.name || "Sheet1",
        cells: s.cells || {},
        rowCount: s.rowCount || 500,
        colCount: s.colCount || 26
      }));
    }
    return [{ name: "Sheet1", cells: initialContent?.cells || {}, rowCount: 500, colCount: 26 }];
  });

  // Stack lịch sử lưu các trạng thái trước đó để phục vụ hoàn tác (Undo)
  const [history, setHistory] = useState<Sheet[][]>([]);

  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<{ start: string; end: string } | null>(null);
  const [formulaValue, setFormulaValue] = useState("");

  // Số lượng dòng thêm vào ở dưới cùng (mặc định 500)
  const [addRowsNum, setAddRowsNum] = useState(500);

  // Tìm kiếm và Thay thế
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");

  const currentSheet = sheets[activeSheetIdx] || { name: "Sheet1", cells: {}, rowCount: 500, colCount: 26 };
  const cells = currentSheet.cells;
  const rowCount = currentSheet.rowCount || 500;
  const colCount = currentSheet.colCount || 26;

  useEffect(() => {
    if (selectedCell) {
      const cell = cells[selectedCell];
      setFormulaValue(cell?.formula || cell?.value || "");
    } else {
      setFormulaValue("");
    }
  }, [selectedCell, activeSheetIdx, sheets]);

  const getSelectedAddresses = (): string[] => {
    if (!selectedRange) return selectedCell ? [selectedCell] : [];
    return getCellRange(`${selectedRange.start}:${selectedRange.end}`);
  };

  // Helper cập nhật sheets đồng thời lưu snapshot vào lịch sử để Ctrl+Z hoạt động
  const updateSheetsAndSaveHistory = (
    newSheets: Sheet[] | ((prev: Sheet[]) => Sheet[]),
    skipHistory: boolean = false
  ) => {
    setSheets((currentSheets) => {
      const resolved = typeof newSheets === "function" ? newSheets(currentSheets) : newSheets;
      
      if (!skipHistory) {
        setHistory((prevHistory) => {
          // Lưu bản sao sâu của tất cả sheet và ô dữ liệu
          const snapshot = currentSheets.map((s) => ({
            name: s.name,
            cells: { ...s.cells },
            rowCount: s.rowCount,
            colCount: s.colCount,
          }));
          return [...prevHistory.slice(-49), snapshot]; // Giới hạn tối đa 50 bước hoàn tác
        });
      }
      
      return resolved;
    });
  };

  // Hàm hoàn tác Undo
  const handleUndo = () => {
    if (history.length === 0) {
      toast.info("Không có hành động nào để hoàn tác!");
      return;
    }

    setHistory((prevHistory) => {
      const copy = [...prevHistory];
      const previousState = copy.pop();
      if (previousState) {
        // Cập nhật lại sheets và bỏ qua việc lưu chính nó vào lịch sử mới
        updateSheetsAndSaveHistory(previousState, true);
        toast.success("Đã hoàn tác!");
      }
      return copy;
    });
  };

  const handleUpdateCell = (address: string, updatedProps: Partial<CellData>) => {
    updateSheetsAndSaveHistory((prev) => {
      const newSheets = [...prev];
      const targetSheet = { ...newSheets[activeSheetIdx] };
      const currentCell = targetSheet.cells[address] || { value: "", formula: "" };
      
      targetSheet.cells = {
        ...targetSheet.cells,
        [address]: {
          ...currentCell,
          ...updatedProps,
        },
      };
      newSheets[activeSheetIdx] = targetSheet;
      return newSheets;
    });
  };

  const handlePasteCells = (pastedCells: Record<string, CellData>) => {
    updateSheetsAndSaveHistory((prev) => {
      const newSheets = [...prev];
      const targetSheet = { ...newSheets[activeSheetIdx] };
      targetSheet.cells = {
        ...targetSheet.cells,
        ...pastedCells,
      };
      newSheets[activeSheetIdx] = targetSheet;
      return newSheets;
    });
  };

  const applyStyleToSelection = (updatedProps: Partial<CellData>) => {
    const addresses = getSelectedAddresses();
    if (addresses.length === 0) return;

    updateSheetsAndSaveHistory((prev) => {
      const newSheets = [...prev];
      const targetSheet = { ...newSheets[activeSheetIdx] };
      const updatedCells = { ...targetSheet.cells };

      addresses.forEach((address) => {
        const currentCell = updatedCells[address] || { value: "", formula: "" };
        updatedCells[address] = {
          ...currentCell,
          ...updatedProps,
        };
      });

      targetSheet.cells = updatedCells;
      newSheets[activeSheetIdx] = targetSheet;
      return newSheets;
    });
  };

  const handleToolbarStyleChange = (styleKey: "bold" | "italic" | "underline") => {
    if (!selectedCell) return;
    const currentVal = cells[selectedCell]?.[styleKey];
    applyStyleToSelection({ [styleKey]: !currentVal });
  };

  const handleAlignChange = (align: "left" | "center" | "right") => {
    applyStyleToSelection({ align });
  };

  const handleColorChange = (key: "color" | "bg", value: string) => {
    applyStyleToSelection({ [key]: value });
  };

  const handleFontChange = (key: "fontFamily" | "fontSize", value: string) => {
    applyStyleToSelection({ [key]: value });
  };

  const handleFormulaInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormulaValue(val);
    if (selectedCell) {
      const isFormula = val.startsWith("=");
      handleUpdateCell(selectedCell, {
        value: isFormula ? "" : val,
        formula: isFormula ? val : "",
      });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(title, { sheets });
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFind = () => {
    if (!findText) return;
    const matchedAddress = Object.keys(cells).find((addr) => {
      const cell = cells[addr];
      const val = cell?.value || cell?.formula || "";
      return val.toLowerCase().includes(findText.toLowerCase());
    });

    if (matchedAddress) {
      setSelectedCell(matchedAddress);
      setSelectedRange({ start: matchedAddress, end: matchedAddress });
      const element = document.querySelector(`.sheet-cell.selected`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      }
    } else {
      alert("Không tìm thấy kết quả!");
    }
  };

  const handleReplace = () => {
    if (!selectedCell || !findText) return;
    const cell = cells[selectedCell];
    const val = cell?.value || cell?.formula || "";
    if (val.toLowerCase().includes(findText.toLowerCase())) {
      const newVal = val.replace(new RegExp(findText, "gi"), replaceText);
      const isFormula = newVal.startsWith("=");
      handleUpdateCell(selectedCell, {
        value: isFormula ? "" : newVal,
        formula: isFormula ? newVal : "",
      });
    }
  };

  const handleAddSheet = () => {
    updateSheetsAndSaveHistory((prev) => [
      ...prev,
      { name: `Sheet${prev.length + 1}`, cells: {}, rowCount: 500, colCount: 26 }
    ]);
    setActiveSheetIdx(sheets.length);
    setSelectedCell(null);
    setSelectedRange(null);
  };

  const handleRenameSheet = (idx: number) => {
    const oldName = sheets[idx].name;
    const newName = prompt("Nhập tên mới cho Sheet:", oldName);
    if (newName && newName.trim()) {
      updateSheetsAndSaveHistory((prev) => {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], name: newName.trim() };
        return copy;
      });
    }
  };

  const handleDeleteSheet = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sheets.length <= 1) {
      alert("Workbook phải có ít nhất 1 trang tính!");
      return;
    }
    if (confirm(`Bạn có chắc muốn xóa trang tính "${sheets[idx].name}"?`)) {
      updateSheetsAndSaveHistory((prev) => prev.filter((_, i) => i !== idx));
      setActiveSheetIdx((prev) => Math.max(0, prev - 1));
      setSelectedCell(null);
      setSelectedRange(null);
    }
  };

  // Thêm hàng khác ở dưới cùng
  const handleAddRows = () => {
    updateSheetsAndSaveHistory((prev) => {
      const newSheets = [...prev];
      const targetSheet = { ...newSheets[activeSheetIdx] };
      const currentRows = targetSheet.rowCount || 500;
      targetSheet.rowCount = currentRows + addRowsNum;
      newSheets[activeSheetIdx] = targetSheet;
      return newSheets;
    });
    toast.success(`Đã thêm thành công ${addRowsNum} hàng mới!`);
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ title, sheets }));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${title || "workbook"}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.removeChild(downloadAnchor);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.sheets && Array.isArray(parsed.sheets)) {
          const loadedSheets = parsed.sheets.map((s: any) => ({
            name: s.name || "Sheet1",
            cells: s.cells || {},
            rowCount: s.rowCount || 500,
            colCount: s.colCount || 26
          }));
          updateSheetsAndSaveHistory(loadedSheets);
          if (parsed.title) setTitle(parsed.title);
          setActiveSheetIdx(0);
          setSelectedCell(null);
          setSelectedRange(null);
          toast.success("Nhập dữ liệu thành công!");
        } else {
          alert("Định dạng tệp JSON không hợp lệ!");
        }
      } catch (err) {
        alert("Lỗi khi đọc file JSON!");
      }
    };
    reader.readAsText(file);
  };

  const handleExportCSV = () => {
    const addresses = Object.keys(cells);
    if (addresses.length === 0) {
      alert("Trang tính trống!");
      return;
    }

    let maxRow = 1;
    let maxColIdx = 0;

    const parseAddress = (addr: string) => {
      const match = addr.match(/^([A-Z]+)([0-9]+)$/);
      if (!match) return { col: "A", row: 1 };
      return { col: match[1], row: parseInt(match[2], 10) };
    };

    const colLetterToNum = (letter: string) => {
      let num = 0;
      for (let i = 0; i < letter.length; i++) {
        num = num * 26 + (letter.charCodeAt(i) - 64);
      }
      return num - 1;
    };

    addresses.forEach((addr) => {
      const parsed = parseAddress(addr);
      if (parsed.row > maxRow) maxRow = parsed.row;
      const colIdx = colLetterToNum(parsed.col);
      if (colIdx > maxColIdx) maxColIdx = colIdx;
    });

    const numToColLetter = (num: number): string => {
      let letter = "";
      let temp = num;
      while (temp >= 0) {
        letter = String.fromCharCode((temp % 26) + 65) + letter;
        temp = Math.floor(temp / 26) - 1;
      }
      return letter;
    };

    let csvContent = "";
    for (let r = 1; r <= maxRow; r++) {
      const rowData = [];
      for (let c = 0; c <= maxColIdx; c++) {
        const colLetter = numToColLetter(c);
        const cell = cells[`${colLetter}${r}`];
        const val = cell ? cell.value || cell.formula || "" : "";
        const escaped = ("" + val).replace(/"/g, '""');
        rowData.push(`"${escaped}"`);
      }
      csvContent += rowData.join(",") + "\n";
    }

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${title || "sheet"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeCell = selectedCell ? cells[selectedCell] : null;

  return (
    <div className="sheet-editor-container">
      {/* Header */}
      <div className="sheet-editor-header">
        <div className="sheet-editor-title-container">
          <button onClick={onBack} className="btn-editor-action back">
            <ArrowLeft className="w-4 h-4" /> Quay lại
          </button>
          <input
            type="text"
            className="sheet-editor-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nhập tiêu đề trang tính..."
          />
        </div>
        <div className="sheet-editor-actions">
          <label className="btn-editor-action back flex items-center gap-1 cursor-pointer">
            <Upload className="w-4 h-4" /> Nhập JSON
            <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
          </label>
          <button onClick={handleExportJSON} className="btn-editor-action back" title="Xuất JSON">
            <FileJson className="w-4 h-4" /> Xuất JSON
          </button>
          <button onClick={handleExportCSV} className="btn-editor-action back">
            <Download className="w-4 h-4" /> Xuất CSV
          </button>
          <button onClick={handleSave} disabled={isSaving} className="btn-editor-action save">
            <Save className="w-4 h-4" /> {isSaving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="sheet-toolbar">
        {/* Font Family */}
        <select 
          className="tool-select"
          value={activeCell?.fontFamily || "Inter"}
          onChange={(e) => handleFontChange("fontFamily", e.target.value)}
        >
          <option value="Inter">Inter</option>
          <option value="Montserrat">Montserrat</option>
          <option value="Arial">Arial</option>
          <option value="Courier New">Courier New</option>
          <option value="Georgia">Georgia</option>
          <option value="Times New Roman">Times New Roman</option>
        </select>

        {/* Font Size */}
        <select 
          className="tool-select"
          value={activeCell?.fontSize || "13px"}
          onChange={(e) => handleFontChange("fontSize", e.target.value)}
        >
          <option value="10px">10</option>
          <option value="12px">12</option>
          <option value="13px">13</option>
          <option value="14px">14</option>
          <option value="16px">16</option>
          <option value="18px">18</option>
          <option value="20px">20</option>
          <option value="24px">24</option>
        </select>

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

        <div className="tool-color-picker" title="Màu chữ">
          <span className="text-xs">Chữ:</span>
          <input
            type="color"
            className="tool-color-input"
            value={activeCell?.color || "#000000"}
            onChange={(e) => handleColorChange("color", e.target.value)}
          />
        </div>

        <div className="tool-color-picker" title="Màu nền">
          <span className="text-xs">Nền:</span>
          <input
            type="color"
            className="tool-color-input"
            value={activeCell?.bg || "#ffffff"}
            onChange={(e) => handleColorChange("bg", e.target.value)}
          />
        </div>

        <div className="toolbar-divider"></div>

        <button 
          onClick={() => setShowFindReplace(!showFindReplace)} 
          className={`btn-tool ${showFindReplace ? "active" : ""}`}
          title="Tìm kiếm và Thay thế"
        >
          <Search className="w-4 h-4" />
        </button>
      </div>

      {/* Floating Find & Replace Panel */}
      {showFindReplace && (
        <div className="find-replace-panel">
          <div className="find-replace-title">
            <span>Tìm kiếm và Thay thế</span>
            <button onClick={() => setShowFindReplace(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <input 
            type="text" 
            className="find-replace-input" 
            placeholder="Tìm kiếm..."
            value={findText}
            onChange={(e) => setFindText(e.target.value)}
          />
          <input 
            type="text" 
            className="find-replace-input" 
            placeholder="Thay thế bằng..."
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
          />
          <div className="find-replace-actions">
            <button onClick={handleFind} className="btn-find-action secondary">Tìm ô</button>
            <button onClick={handleReplace} className="btn-find-action primary">Thay thế</button>
          </div>
        </div>
      )}

      {/* Formula Bar */}
      <div className="sheet-formula-bar">
        <div className="formula-cell-address">{selectedCell || ""}</div>
        <div className="formula-icon-fx">fx</div>
        <input
          type="text"
          className="formula-input"
          value={formulaValue}
          onChange={handleFormulaInputChange}
          placeholder="Nhập giá trị hoặc công thức (ví dụ: =SUM(A1:A5))"
          disabled={!selectedCell}
        />
      </div>

      {/* Grid */}
      <SpreadsheetGrid
        cells={cells}
        selectedCell={selectedCell}
        onSelectCell={setSelectedCell}
        selectedRange={selectedRange}
        onSelectRange={setSelectedRange}
        onUpdateCell={handleUpdateCell}
        onPasteCells={handlePasteCells}
        rowCount={rowCount}
        colCount={colCount}
        onUndo={handleUndo}
      />

      {/* Add Rows Panel (Google Sheet Styled) */}
      <div className="add-rows-panel">
        <span>Thêm</span>
        <input 
          type="number" 
          className="add-rows-input" 
          value={addRowsNum} 
          onChange={(e) => setAddRowsNum(Math.max(1, parseInt(e.target.value, 10) || 1))}
        />
        <span>hàng khác ở dưới cùng</span>
        <button onClick={handleAddRows} className="btn-add-rows">Thêm</button>
      </div>

      {/* Sheet Tabs Bar (Bottom) */}
      <div className="sheet-bottom-bar">
        {sheets.map((sheet, idx) => (
          <div 
            key={idx} 
            className={`sheet-tab ${activeSheetIdx === idx ? "active" : ""}`}
            onClick={() => {
              setActiveSheetIdx(idx);
              setSelectedCell(null);
              setSelectedRange(null);
            }}
            onDoubleClick={() => handleRenameSheet(idx)}
          >
            <span>{sheet.name}</span>
            {sheets.length > 1 && (
              <button 
                className="btn-tab-close" 
                onClick={(e) => handleDeleteSheet(idx, e)}
                title="Xóa Sheet"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        <button onClick={handleAddSheet} className="btn-add-tab">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default SpreadsheetEditor;
