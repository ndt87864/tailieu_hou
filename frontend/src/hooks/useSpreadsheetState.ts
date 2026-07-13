// frontend/src/hooks/useSpreadsheetState.ts
import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { 
  getCellRange as getCellRangeUtil, 
  parseCellAddress, 
  colLetterToNumber, 
  numberToColLetter 
} from "../utils/formulaEvaluator.js";

export type CellData = {
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

export interface Sheet {
  name: string;
  cells: Record<string, CellData>;
  rowCount?: number;
  colCount?: number;
  rowHeights?: Record<number, number>;
  colWidths?: Record<string, number>;
  isProtected?: boolean;
  isHidden?: boolean;
  isVip?: boolean;
}

export const useSpreadsheetState = (initialTitle: string, initialContent: any, onSave: (title: string, content: any) => Promise<void>) => {
  const [title, setTitle] = useState(initialTitle);
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<{ start: string; end: string } | null>(null);
  const [formulaValue, setFormulaValue] = useState("");
  const [isStarred, setIsStarred] = useState(!!initialContent?.isStarred);
  const [zoomLevel, setZoomLevel] = useState("100%");
  const [addRowsNum, setAddRowsNum] = useState(500);

  const [sheets, setSheets] = useState<Sheet[]>(() => {
    if (initialContent?.sheets && Array.isArray(initialContent.sheets)) {
      return initialContent.sheets.map((s: any) => ({
        name: s.name || "Sheet1",
        cells: s.cells || {},
        rowCount: s.rowCount || 500,
        colCount: s.colCount || 26,
        rowHeights: s.rowHeights || {},
        colWidths: s.colWidths || {},
        isProtected: s.isProtected || false,
        isHidden: s.isHidden || false,
        isVip: s.isVip || false
      }));
    }
    return [{ name: "Sheet1", cells: initialContent?.cells || {}, rowCount: 500, colCount: 26, rowHeights: {}, colWidths: {}, isProtected: false, isHidden: false, isVip: false }];
  });

  const [history, setHistory] = useState<Array<{ timestamp: string; sheets: Sheet[] }>>([]);

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
    return getCellRangeUtil(`${selectedRange.start}:${selectedRange.end}`);
  };

  const updateSheetsAndSaveHistory = (
    newSheets: Sheet[] | ((prev: Sheet[]) => Sheet[]),
    skipHistory: boolean = false
  ) => {
    setSheets((currentSheets) => {
      const resolved = typeof newSheets === "function" ? newSheets(currentSheets) : newSheets;
      
      if (!skipHistory) {
        setHistory((prevHistory) => {
          const snapshot = currentSheets.map((s) => ({
            name: s.name,
            cells: { ...s.cells },
            rowCount: s.rowCount,
            colCount: s.colCount,
            rowHeights: s.rowHeights ? { ...s.rowHeights } : {},
            colWidths: s.colWidths ? { ...s.colWidths } : {},
            isProtected: s.isProtected,
            isHidden: s.isHidden,
            isVip: s.isVip,
          }));
          const newEntry = {
            timestamp: new Date().toLocaleTimeString("vi-VN"),
            sheets: snapshot
          };
          return [...prevHistory.slice(-49), newEntry];
        });
      }
      
      return resolved;
    });
  };

  const handleUndo = () => {
    if (history.length === 0) {
      toast.info("Không có hành động nào để hoàn tác!");
      return;
    }

    setHistory((prevHistory) => {
      const copy = [...prevHistory];
      const previousState = copy.pop();
      if (previousState) {
        updateSheetsAndSaveHistory(previousState.sheets, true);
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

  const applyStyleToSelection = (styleProps: Partial<CellData>) => {
    const addresses = getSelectedAddresses();
    if (addresses.length === 0) return;

    updateSheetsAndSaveHistory((prev) => {
      const newSheets = [...prev];
      const targetSheet = { ...newSheets[activeSheetIdx] };
      
      addresses.forEach((addr) => {
        const currentCell = targetSheet.cells[addr] || { value: "", formula: "" };
        targetSheet.cells[addr] = {
          ...currentCell,
          ...styleProps,
        };
      });
      
      newSheets[activeSheetIdx] = targetSheet;
      return newSheets;
    });
  };

  const handleToolbarStyleChange = (key: "bold" | "italic" | "underline" | "strikethrough") => {
    if (!selectedCell) return;
    const currentCell = cells[selectedCell] || { value: "", formula: "" };
    applyStyleToSelection({ [key]: !currentCell[key] });
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

  const handleAddSheet = () => {
    let updatedSheetsList: Sheet[] = [];
    updateSheetsAndSaveHistory((prev) => {
      const updated = [
        ...prev,
        { name: `Sheet${prev.length + 1}`, cells: {}, rowCount: 500, colCount: 26 }
      ];
      updatedSheetsList = updated;
      setTimeout(() => {
        setActiveSheetIdx(updated.length - 1);
      }, 0);
      return updated;
    });
    setSelectedCell(null);
    setSelectedRange(null);
    return updatedSheetsList;
  };

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

  const insertRow = (atRow: number, position: "above" | "below") => {
    const targetRow = position === "above" ? atRow : atRow + 1;
    updateSheetsAndSaveHistory((prev) => {
      const newSheets = [...prev];
      const targetSheet = { ...newSheets[activeSheetIdx] };
      const currentCells = targetSheet.cells;
      const newCells: Record<string, CellData> = {};

      Object.keys(currentCells).forEach((addr) => {
        const parsed = parseCellAddress(addr);
        if (parsed) {
          if (parsed.row >= targetRow) {
            const nextAddr = `${parsed.col}${parsed.row + 1}`;
            newCells[nextAddr] = currentCells[addr];
          } else {
            newCells[addr] = currentCells[addr];
          }
        }
      });
      targetSheet.cells = newCells;
      targetSheet.rowCount = (targetSheet.rowCount || 500) + 1;
      newSheets[activeSheetIdx] = targetSheet;
      return newSheets;
    });
    toast.success(`Đã chèn hàng mới tại dòng ${targetRow}!`);
  };

  const insertColumn = (atColLetter: string, position: "left" | "right") => {
    const atColIdx = colLetterToNumber(atColLetter);
    const targetColIdx = position === "left" ? atColIdx : atColIdx + 1;
    updateSheetsAndSaveHistory((prev) => {
      const newSheets = [...prev];
      const targetSheet = { ...newSheets[activeSheetIdx] };
      const currentCells = targetSheet.cells;
      const newCells: Record<string, CellData> = {};

      Object.keys(currentCells).forEach((addr) => {
        const parsed = parseCellAddress(addr);
        if (parsed) {
          const colIdx = colLetterToNumber(parsed.col);
          if (colIdx >= targetColIdx) {
            const nextColLetter = numberToColLetter(colIdx + 1);
            const nextAddr = `${nextColLetter}${parsed.row}`;
            newCells[nextAddr] = currentCells[addr];
          } else {
            newCells[addr] = currentCells[addr];
          }
        }
      });
      targetSheet.cells = newCells;
      targetSheet.colCount = (targetSheet.colCount || 26) + 1;
      newSheets[activeSheetIdx] = targetSheet;
      return newSheets;
    });
    toast.success(`Đã chèn cột mới!`);
  };

  const deleteRow = (atRow: number) => {
    updateSheetsAndSaveHistory((prev) => {
      const newSheets = [...prev];
      const targetSheet = { ...newSheets[activeSheetIdx] };
      const currentCells = targetSheet.cells;
      const newCells: Record<string, CellData> = {};

      Object.keys(currentCells).forEach((addr) => {
        const parsed = parseCellAddress(addr);
        if (parsed) {
          if (parsed.row > atRow) {
            const nextAddr = `${parsed.col}${parsed.row - 1}`;
            newCells[nextAddr] = currentCells[addr];
          } else if (parsed.row < atRow) {
            newCells[addr] = currentCells[addr];
          }
        }
      });
      targetSheet.cells = newCells;
      targetSheet.rowCount = Math.max(1, (targetSheet.rowCount || 500) - 1);
      newSheets[activeSheetIdx] = targetSheet;
      return newSheets;
    });
    toast.success(`Đã xóa hàng ${atRow}!`);
  };

  const clearRow = (atRow: number) => {
    updateSheetsAndSaveHistory((prev) => {
      const newSheets = [...prev];
      const targetSheet = { ...newSheets[activeSheetIdx] };
      const updatedCells = { ...targetSheet.cells };
      
      Object.keys(updatedCells).forEach((addr) => {
        const parsed = parseCellAddress(addr);
        if (parsed && parsed.row === atRow) {
          delete updatedCells[addr];
        }
      });
      
      targetSheet.cells = updatedCells;
      newSheets[activeSheetIdx] = targetSheet;
      return newSheets;
    });
    toast.success(`Đã xóa nội dung hàng ${atRow}!`);
  };

  const deleteColumn = (atColLetter: string) => {
    const atColIdx = colLetterToNumber(atColLetter);
    updateSheetsAndSaveHistory((prev) => {
      const newSheets = [...prev];
      const targetSheet = { ...newSheets[activeSheetIdx] };
      const currentCells = targetSheet.cells;
      const newCells: Record<string, CellData> = {};

      Object.keys(currentCells).forEach((addr) => {
        const parsed = parseCellAddress(addr);
        if (parsed) {
          const colIdx = colLetterToNumber(parsed.col);
          if (colIdx > atColIdx) {
            const nextColLetter = numberToColLetter(colIdx - 1);
            const nextAddr = `${nextColLetter}${parsed.row}`;
            newCells[nextAddr] = currentCells[addr];
          } else if (colIdx < atColIdx) {
            newCells[addr] = currentCells[addr];
          }
        }
      });
      targetSheet.cells = newCells;
      targetSheet.colCount = Math.max(1, (targetSheet.colCount || 26) - 1);
      newSheets[activeSheetIdx] = targetSheet;
      return newSheets;
    });
    toast.success(`Đã xóa cột ${atColLetter}!`);
  };

  const clearColumn = (atColLetter: string) => {
    updateSheetsAndSaveHistory((prev) => {
      const newSheets = [...prev];
      const targetSheet = { ...newSheets[activeSheetIdx] };
      const updatedCells = { ...targetSheet.cells };
      
      Object.keys(updatedCells).forEach((addr) => {
        const parsed = parseCellAddress(addr);
        if (parsed && parsed.col === atColLetter) {
          delete updatedCells[addr];
        }
      });
      
      targetSheet.cells = updatedCells;
      newSheets[activeSheetIdx] = targetSheet;
      return newSheets;
    });
    toast.success(`Đã xóa nội dung cột ${atColLetter}!`);
  };

  const handleUpdateRowHeight = (rowNum: number, height: number) => {
    updateSheetsAndSaveHistory((prev) => {
      const newSheets = [...prev];
      const targetSheet = { ...newSheets[activeSheetIdx] };
      targetSheet.rowHeights = {
        ...(targetSheet.rowHeights || {}),
        [rowNum]: height,
      };
      newSheets[activeSheetIdx] = targetSheet;
      return newSheets;
    });
  };

  const handleUpdateColWidth = (colLetter: string, width: number) => {
    updateSheetsAndSaveHistory((prev) => {
      const newSheets = [...prev];
      const targetSheet = { ...newSheets[activeSheetIdx] };
      targetSheet.colWidths = {
        ...(targetSheet.colWidths || {}),
        [colLetter]: width,
      };
      newSheets[activeSheetIdx] = targetSheet;
      return newSheets;
    });
  };

  const formatSelection = (type: "currency" | "percent" | "decimal-inc" | "decimal-dec") => {
    const addresses = getSelectedAddresses();
    if (addresses.length === 0) return;
    updateSheetsAndSaveHistory((prev) => {
      const newSheets = [...prev];
      const targetSheet = { ...newSheets[activeSheetIdx] };
      addresses.forEach((addr) => {
        const cell = targetSheet.cells[addr] || { value: "", formula: "" };
        let val = cell.value || "";
        if (!cell.formula) {
          const clean = val.replace(/[^0-9.-]/g, "");
          const num = parseFloat(clean);
          if (!isNaN(num)) {
            if (type === "currency") {
              val = `$${num.toLocaleString()}`;
            } else if (type === "percent") {
              val = `${num}%`;
            } else if (type === "decimal-inc") {
              val = num.toFixed(2);
            } else if (type === "decimal-dec") {
              val = Math.round(num).toString();
            }
          } else {
            if (type === "currency") val = `$${val}`;
            else if (type === "percent") val = `${val}%`;
          }
        }
        targetSheet.cells[addr] = { ...cell, value: val };
      });
      newSheets[activeSheetIdx] = targetSheet;
      return newSheets;
    });
    toast.success("Đã thay đổi định dạng ô tính!");
  };

  const insertFormula = (funcName: string) => {
    if (!selectedCell) {
      toast.warn("Vui lòng chọn một ô trước khi chèn công thức!");
      return;
    }
    let rangeStr = "A1:A5";
    if (selectedRange) {
      rangeStr = `${selectedRange.start}:${selectedRange.end}`;
    }
    const formulaStr = `=${funcName}(${rangeStr})`;
    handleUpdateCell(selectedCell, {
      value: "",
      formula: formulaStr
    });
    setFormulaValue(formulaStr);
    toast.success(`Đã chèn công thức ${funcName}!`);
  };

  const handleSave = async (customSheets?: Sheet[], customStarred?: boolean) => {
    try {
      await onSave(title, {
        sheets: customSheets || sheets,
        isStarred: customStarred !== undefined ? customStarred : isStarred
      });
    } catch (err: any) {
      console.error(err);
    }
  };

  return {
    title,
    setTitle,
    sheets,
    setSheets,
    activeSheetIdx,
    setActiveSheetIdx,
    selectedCell,
    setSelectedCell,
    selectedRange,
    setSelectedRange,
    formulaValue,
    setFormulaValue,
    isStarred,
    setIsStarred,
    zoomLevel,
    setZoomLevel,
    addRowsNum,
    setAddRowsNum,
    cells,
    rowCount,
    colCount,
    history,
    updateSheetsAndSaveHistory,
    handleUndo,
    handleUpdateCell,
    handlePasteCells,
    applyStyleToSelection,
    handleToolbarStyleChange,
    handleAlignChange,
    handleColorChange,
    handleFontChange,
    handleFormulaInputChange,
    handleAddSheet,
    handleAddRows,
    insertRow,
    insertColumn,
    deleteRow,
    clearRow,
    deleteColumn,
    clearColumn,
    handleUpdateRowHeight,
    handleUpdateColWidth,
    formatSelection,
    insertFormula,
    getSelectedAddresses,
    handleSave
  };
};
