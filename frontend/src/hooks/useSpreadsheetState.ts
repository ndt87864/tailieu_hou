// frontend/src/hooks/useSpreadsheetState.ts
import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { getCellRange as getCellRangeUtil, parseCellAddress, colLetterToNumber, numberToColLetter } from "../utils/formulaEvaluator.js";
import apiClient from "../services/client.js";
import {
  insertRowInSheets,
  insertColumnInSheets,
  deleteRowInSheets,
  deleteColumnInSheets,
  clearRowInSheets,
  clearColumnInSheets,
  updateRowHeightInSheets,
  updateColWidthInSheets,
  shiftCellsInSheets,
  deleteCellsAndShiftInSheets,
} from "../utils/spreadsheetRowColOperations.js";
import {
  sortActiveSheetInSheets,
  trimWhitespaceInSheets,
  removeEmptyRowsInSheets,
  formatSelectionInSheets,
  removeDuplicatesInSheets,
} from "../utils/spreadsheetMenuOperations.js";

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
  link?: string;
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
  hiddenRows?: Record<number, boolean>;
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

  // View settings
  const [showFormulaBar, setShowFormulaBar] = useState(true);
  const [showGridlines, setShowGridlines] = useState(true);
  const [showFormulas, setShowFormulas] = useState(false);

  // Freeze rows and cols
  const [freezeRows, setFreezeRows] = useState(0);
  const [freezeCols, setFreezeCols] = useState(0);

  // Clipboard local state
  const [localClipboard, setLocalClipboard] = useState<{ startCell: string; cells: Record<string, CellData> } | null>(null);

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
        isVip: s.isVip || false,
      }));
    }
    return [{ name: "Sheet1", cells: initialContent?.cells || {}, rowCount: 500, colCount: 26, rowHeights: {}, colWidths: {}, isProtected: false, isHidden: false, isVip: false }];
  });

  const [history, setHistory] = useState<Array<{ timestamp: string; sheets: Sheet[] }>>([]);
  const [redoList, setRedoList] = useState<Array<{ sheets: Sheet[] }>>([]);

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
        setRedoList([]); // Clear redo list on new action
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
          return [...prevHistory.slice(-49), { timestamp: new Date().toLocaleTimeString("vi-VN"), sheets: snapshot }];
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
    const previous = history[history.length - 1];
    if (previous) {
      setRedoList((r) => [...r, { sheets: sheets.map((s) => ({ ...s, cells: { ...s.cells } })) }]);
      updateSheetsAndSaveHistory(previous.sheets, true);
      setHistory((prev) => prev.slice(0, -1));
      toast.success("Đã hoàn tác!");
    }
  };

  const handleRedo = () => {
    if (redoList.length === 0) {
      toast.info("Không có hành động nào để làm lại!");
      return;
    }
    const nextState = redoList[redoList.length - 1];
    if (nextState) {
      setHistory((h) => [...h, { timestamp: new Date().toLocaleTimeString("vi-VN"), sheets: sheets.map((s) => ({ ...s, cells: { ...s.cells } })) }]);
      updateSheetsAndSaveHistory(nextState.sheets, true);
      setRedoList((prev) => prev.slice(0, -1));
      toast.success("Đã làm lại!");
    }
  };

  const handleUpdateCell = (address: string, updatedProps: Partial<CellData>) => {
    updateSheetsAndSaveHistory((prev) => {
      const newSheets = [...prev];
      const targetSheet = { ...newSheets[activeSheetIdx] };
      const currentCell = targetSheet.cells[address] || { value: "", formula: "" };
      targetSheet.cells = { ...targetSheet.cells, [address]: { ...currentCell, ...updatedProps } };
      newSheets[activeSheetIdx] = targetSheet;
      return newSheets;
    });
  };

  // Unify Cut/Copy/Paste
  const copySelection = () => {
    const addresses = getSelectedAddresses();
    if (addresses.length === 0) return;
    const copied: Record<string, CellData> = {};
    addresses.forEach((addr) => {
      if (cells[addr]) copied[addr] = { ...cells[addr] };
    });
    setLocalClipboard({ startCell: selectedRange ? selectedRange.start : (selectedCell || "A1"), cells: copied });
    toast.success("Đã sao chép vào bộ nhớ tạm cục bộ!");
  };

  const cutSelection = () => {
    const addresses = getSelectedAddresses();
    if (addresses.length === 0) return;
    const copied: Record<string, CellData> = {};
    addresses.forEach((addr) => {
      if (cells[addr]) copied[addr] = { ...cells[addr] };
    });
    setLocalClipboard({ startCell: selectedRange ? selectedRange.start : (selectedCell || "A1"), cells: copied });
    updateSheetsAndSaveHistory((prev) => {
      const newSheets = [...prev];
      const targetSheet = { ...newSheets[activeSheetIdx] };
      const updatedCells = { ...targetSheet.cells };
      addresses.forEach((addr) => { delete updatedCells[addr]; });
      targetSheet.cells = updatedCells;
      newSheets[activeSheetIdx] = targetSheet;
      return newSheets;
    });
    toast.success("Đã cắt vùng chọn!");
  };

  const pasteClipboard = (specialOption?: "all" | "value" | "format") => {
    if (!localClipboard || !selectedCell) {
      toast.info("Không có dữ liệu trong clipboard cục bộ!");
      return;
    }
    const startCellParsed = parseCellAddress(localClipboard.startCell);
    const targetCellParsed = parseCellAddress(selectedCell);
    if (!startCellParsed || !targetCellParsed) return;

    const colOffset = colLetterToNumber(targetCellParsed.col) - colLetterToNumber(startCellParsed.col);
    const rowOffset = targetCellParsed.row - startCellParsed.row;
    const opt = specialOption || "all";

    updateSheetsAndSaveHistory((prev) => {
      const newSheets = [...prev];
      const targetSheet = { ...newSheets[activeSheetIdx] };
      const newCells = { ...targetSheet.cells };

      Object.keys(localClipboard.cells).forEach((addr) => {
        const parsed = parseCellAddress(addr);
        if (parsed) {
          const newColIdx = colLetterToNumber(parsed.col) + colOffset;
          const newRow = parsed.row + rowOffset;
          if (newColIdx >= 0 && newColIdx < colCount && newRow >= 1 && newRow <= rowCount) {
            const destAddr = `${numberToColLetter(newColIdx)}${newRow}`;
            const sourceCell = localClipboard.cells[addr];
            const destCell = newCells[destAddr] || { value: "", formula: "" };

            if (opt === "value") {
              newCells[destAddr] = { ...destCell, value: sourceCell.value, formula: sourceCell.formula };
            } else if (opt === "format") {
              const { value, formula, ...onlyStyle } = sourceCell;
              newCells[destAddr] = { value: destCell.value, formula: destCell.formula, ...onlyStyle };
            } else {
              newCells[destAddr] = { ...sourceCell };
            }
          }
        }
      });

      targetSheet.cells = newCells;
      newSheets[activeSheetIdx] = targetSheet;
      return newSheets;
    });
    toast.success("Đã dán dữ liệu!");
  };

  // Sort Sheet by selected column
  const sortActiveSheet = (colLetter: string, direction: "asc" | "desc") => {
    updateSheetsAndSaveHistory((prev) => sortActiveSheetInSheets(prev, activeSheetIdx, colLetter, direction));
    toast.success(`Đã sắp xếp cột ${colLetter} (${direction === "asc" ? "A - Z" : "Z - A"})`);
  };

  // Data Cleanups
  const trimWhitespace = () => {
    updateSheetsAndSaveHistory((prev) => trimWhitespaceInSheets(prev, activeSheetIdx));
    toast.success("Đã dọn dẹp khoảng trắng thừa!");
  };

  const removeEmptyRows = () => {
    updateSheetsAndSaveHistory((prev) => removeEmptyRowsInSheets(prev, activeSheetIdx, rowCount, colCount));
    toast.success("Đã loại bỏ các hàng trống!");
  };

  const handlePasteCells = (pastedCells: Record<string, CellData>) => {
    updateSheetsAndSaveHistory((prev) => {
      const newSheets = [...prev];
      const targetSheet = { ...newSheets[activeSheetIdx] };
      targetSheet.cells = { ...targetSheet.cells, ...pastedCells };
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
        targetSheet.cells[addr] = { ...currentCell, ...styleProps };
      });
      newSheets[activeSheetIdx] = targetSheet;
      return newSheets;
    });
  };

  const handleToolbarStyleChange = (styleKey: "bold" | "italic" | "underline" | "strikethrough") => {
    const addresses = getSelectedAddresses();
    if (addresses.length === 0) return;
    const isCurrentlyStyled = addresses.every((addr) => cells[addr]?.[styleKey]);
    applyStyleToSelection({ [styleKey]: !isCurrentlyStyled });
  };

  const handleAlignChange = (align: "left" | "center" | "right") => applyStyleToSelection({ align });
  const handleColorChange = (type: "text" | "bg", color: string) => applyStyleToSelection(type === "text" ? { color } : { bg: color });
  const handleFontChange = (fontFamily: string) => applyStyleToSelection({ fontFamily });

  const handleFormulaInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedCell) return;
    const val = e.target.value;
    setFormulaValue(val);
    handleUpdateCell(selectedCell, val.startsWith("=") ? { value: "", formula: val } : { value: val, formula: "" });
  };
  const removeDuplicates = () => {
    updateSheetsAndSaveHistory((prev) => removeDuplicatesInSheets(prev, activeSheetIdx, rowCount, colCount));
    toast.success("Đã loại bỏ các hàng trùng lặp!");
  };

  const clearFormatting = () => {
    applyStyleToSelection({
      bold: false,
      italic: false,
      underline: false,
      strikethrough: false,
      color: "inherit",
      bg: "transparent"
    });
    toast.success("Đã xóa định dạng!");
  };

  const handleAddSheet = () => {
    let updated: Sheet[] = [];
    updateSheetsAndSaveHistory((prev) => {
      const newName = `Sheet${prev.length + 1}`;
      updated = [...prev, { name: newName, cells: {}, rowCount: 500, colCount: 26, rowHeights: {}, colWidths: {}, isProtected: false, isHidden: false }];
      return updated;
    });
    setActiveSheetIdx(sheets.length);
    toast.success("Đã thêm trang tính mới!");
    setTimeout(() => handleSave(updated), 200);
  };

  const handleAddRows = () => {
    let updated: Sheet[] = [];
    updateSheetsAndSaveHistory((prev) => {
      const newSheets = [...prev];
      const target = { ...newSheets[activeSheetIdx] };
      target.rowCount = (target.rowCount || 500) + addRowsNum;
      newSheets[activeSheetIdx] = target;
      updated = newSheets;
      return newSheets;
    });
    toast.success(`Đã thêm ${addRowsNum} hàng!`);
    setTimeout(() => handleSave(updated), 200);
  };

  // Hook wrapper row col operations
  const insertRow = (atRow: number, pos: "above" | "below") => updateSheetsAndSaveHistory((prev) => insertRowInSheets(prev, activeSheetIdx, atRow, pos));
  const insertColumn = (atColLetter: string, pos: "left" | "right") => updateSheetsAndSaveHistory((prev) => insertColumnInSheets(prev, activeSheetIdx, atColLetter, pos));
  const deleteRow = (atRow: number) => updateSheetsAndSaveHistory((prev) => deleteRowInSheets(prev, activeSheetIdx, atRow));
  const deleteColumn = (atColLetter: string) => updateSheetsAndSaveHistory((prev) => deleteColumnInSheets(prev, activeSheetIdx, atColLetter));
  const clearRow = (atRow: number) => updateSheetsAndSaveHistory((prev) => clearRowInSheets(prev, activeSheetIdx, atRow));
  const clearColumn = (atColLetter: string) => updateSheetsAndSaveHistory((prev) => clearColumnInSheets(prev, activeSheetIdx, atColLetter));
  const handleUpdateRowHeight = (row: number, h: number) => updateSheetsAndSaveHistory((prev) => updateRowHeightInSheets(prev, activeSheetIdx, row, h), true);
  const handleUpdateColWidth = (col: string, w: number) => updateSheetsAndSaveHistory((prev) => updateColWidthInSheets(prev, activeSheetIdx, col, w), true);

  const formatSelection = (type: "currency" | "percent" | "decimal-inc" | "decimal-dec" | "time" | "date") => {
    const addresses = getSelectedAddresses();
    if (addresses.length === 0) return;
    updateSheetsAndSaveHistory((prev) => formatSelectionInSheets(prev, activeSheetIdx, addresses, type));
  };

  const insertFormula = (funcName: string) => {
    if (!selectedCell) {
      toast.warn("Vui lòng chọn một ô trước khi chèn công thức!");
      return;
    }
    const rangeStr = selectedRange ? `${selectedRange.start}:${selectedRange.end}` : "A1:A5";
    const formulaStr = `=${funcName}(${rangeStr})`;
    handleUpdateCell(selectedCell, { value: "", formula: formulaStr });
    setFormulaValue(formulaStr);
    toast.success(`Đã chèn công thức ${funcName}!`);
  };

  const handleShiftCells = (direction: "down" | "right") => {
    if (!selectedCell) return;
    updateSheetsAndSaveHistory((prev) => shiftCellsInSheets(prev, activeSheetIdx, selectedCell, direction, rowCount, colCount));
    setTimeout(() => handleSave(), 100);
  };

  const handleDeleteCellsAndShift = (direction: "up" | "left") => {
    if (!selectedCell) return;
    updateSheetsAndSaveHistory((prev) => deleteCellsAndShiftInSheets(prev, activeSheetIdx, selectedCell, direction, rowCount, colCount));
    setTimeout(() => handleSave(), 100);
  };

  const handleConvertToTable = () => {
    let addresses = getSelectedAddresses();
    if (addresses.length === 0 && selectedCell) {
      addresses = [selectedCell];
    }
    if (addresses.length === 0) return;

    const rowMap: Record<number, string[]> = {};
    addresses.forEach((addr) => {
      const match = addr.match(/^([A-Z]+)([0-9]+)$/);
      if (match) {
        const row = parseInt(match[2], 10);
        if (!rowMap[row]) rowMap[row] = [];
        rowMap[row].push(addr);
      }
    });

    const sortedRows = Object.keys(rowMap).map(Number).sort((a, b) => a - b);
    if (sortedRows.length === 0) return;

    updateSheetsAndSaveHistory((prev) => {
      const newSheets = [...prev];
      const targetSheet = { ...newSheets[activeSheetIdx] };
      
      sortedRows.forEach((row, index) => {
        const addrsInRow = rowMap[row];
        const isHeader = index === 0;
        addrsInRow.forEach((addr) => {
          const currentCell = targetSheet.cells[addr] || { value: "", formula: "" };
          if (isHeader) {
            targetSheet.cells[addr] = {
              ...currentCell,
              bold: true,
              color: "#ffffff",
              bg: "#107c41",
              align: "center",
            };
          } else {
            const isOdd = index % 2 !== 0;
            targetSheet.cells[addr] = {
              ...currentCell,
              bg: isOdd ? "#f8f9fa" : "#ffffff",
            };
          }
        });
      });

      newSheets[activeSheetIdx] = targetSheet;
      return newSheets;
    });

    setTimeout(() => handleSave(), 100);
    toast.success("Đã định dạng vùng chọn thành định dạng Bảng!");
  };

  const handleCreateFilter = (colLetter: string, val: string) => {
    updateSheetsAndSaveHistory((prev) => {
      const newSheets = [...prev];
      const targetSheet = { ...newSheets[activeSheetIdx] };
      const hidden: Record<number, boolean> = {};
      
      if (val !== null && val.trim() !== "") {
        const query = val.trim().toLowerCase();
        const currentRowCount = targetSheet.rowCount || rowCount;
        for (let r = 1; r <= currentRowCount; r++) {
          const cellAddr = `${colLetter}${r}`;
          const cellVal = (targetSheet.cells[cellAddr]?.value || "").toLowerCase();
          if (!cellVal.includes(query)) {
            hidden[r] = true;
          }
        }
        toast.success(`Đã lọc cột ${colLetter} theo từ khóa: "${val}"`);
      } else {
        toast.success("Đã xóa bộ lọc.");
      }
      
      targetSheet.hiddenRows = hidden;
      newSheets[activeSheetIdx] = targetSheet;
      return newSheets;
    });
    setTimeout(() => handleSave(), 100);
  };

  const handleFilterByCellValue = () => {
    if (!selectedCell) return;
    const match = selectedCell.match(/^([A-Z]+)([0-9]+)$/);
    if (!match) return;
    const colLetter = match[1];
    const targetVal = (cells[selectedCell]?.value || "").trim();
    if (!targetVal) {
      toast.warn("Ô được chọn trống, không thể lọc theo giá trị!");
      return;
    }

    updateSheetsAndSaveHistory((prev) => {
      const newSheets = [...prev];
      const targetSheet = { ...newSheets[activeSheetIdx] };
      const hidden: Record<number, boolean> = {};
      const query = targetVal.toLowerCase();
      
      const currentRowCount = targetSheet.rowCount || rowCount;
      for (let r = 1; r <= currentRowCount; r++) {
        const cellAddr = `${colLetter}${r}`;
        const cellVal = (targetSheet.cells[cellAddr]?.value || "").toLowerCase();
        if (cellVal !== query) {
          hidden[r] = true;
        }
      }
      
      targetSheet.hiddenRows = hidden;
      newSheets[activeSheetIdx] = targetSheet;
      return newSheets;
    });
    setTimeout(() => handleSave(), 100);
    toast.success(`Đã lọc cột ${colLetter} bằng giá trị: "${targetVal}"`);
  };

  const handleSave = async (customSheets?: Sheet[], customStarred?: boolean) => {
    try {
      await onSave(title, {
        sheets: customSheets || sheets,
        isStarred: customStarred !== undefined ? customStarred : isStarred,
      });
    } catch (err: any) {
      console.error(err);
    }
  };

  const [commonFormulas, setCommonFormulas] = useState<Array<{ id: string; name: string; formula: string; description?: string }>>([]);

  const fetchCommonFormulas = async () => {
    try {
      const res = await apiClient.get("/api/v1/spreadsheets/formulas");
      if (res.data?.data) {
        setCommonFormulas(res.data.data);
      }
    } catch (err) {
      console.error("Error fetching common formulas:", err);
    }
  };

  const addCommonFormula = async (name: string, formula: string, description?: string) => {
    try {
      const res = await apiClient.post("/api/v1/spreadsheets/formulas", {
        name,
        formula,
        description,
      });
      if (res.data?.error) {
        toast.error("Lỗi khi thêm công thức: " + res.data.error);
        return false;
      }
      toast.success("Đã thêm công thức mẫu thành công!");
      fetchCommonFormulas();
      return true;
    } catch (err: any) {
      const errMsg = err.response?.data?.error || "Không thể kết nối đến máy chủ!";
      toast.error("Lỗi khi thêm công thức: " + errMsg);
      return false;
    }
  };

  const applyCommonFormula = (formulaString: string) => {
    const addresses = getSelectedAddresses();
    if (addresses.length === 0) {
      if (!selectedCell) {
        toast.warn("Vui lòng chọn một ô hoặc vùng dữ liệu trước khi áp dụng công thức!");
        return;
      }
      addresses.push(selectedCell);
    }

    updateSheetsAndSaveHistory((prev) => {
      const newSheets = [...prev];
      const targetSheet = { ...newSheets[activeSheetIdx] };

      addresses.forEach((addr) => {
        let resolvedFormula = formulaString;
        if (selectedRange && formulaString.includes("A1:A5")) {
          resolvedFormula = formulaString.replace("A1:A5", `${selectedRange.start}:${selectedRange.end}`);
        } else {
          // Hỗ trợ tự động chuyển đổi dòng tương đối theo dòng hiện tại
          const cellParsed = parseCellAddress(addr);
          if (cellParsed) {
            resolvedFormula = formulaString.replace(/([^$]|^)([A-Z]+)([1-9][0-9]*)/g, (match, prefix, colLetter, rowNumStr) => {
              return `${prefix}${colLetter}${cellParsed.row}`;
            });
          }
        }

        targetSheet.cells[addr] = {
          ...(targetSheet.cells[addr] || { value: "" }),
          value: "",
          formula: resolvedFormula,
        };
      });

      newSheets[activeSheetIdx] = targetSheet;
      return newSheets;
    });

    if (selectedCell) {
      let resolvedFormula = formulaString;
      if (selectedRange && formulaString.includes("A1:A5")) {
        resolvedFormula = formulaString.replace("A1:A5", `${selectedRange.start}:${selectedRange.end}`);
      }
      setFormulaValue(resolvedFormula);
    }

    toast.success(`Đã áp dụng công thức cho ${addresses.length} ô tính!`);
  };

  const updateCommonFormula = async (id: string, name: string, formula: string, description?: string) => {
    try {
      const res = await apiClient.put(`/api/v1/spreadsheets/formulas/${id}`, {
        name,
        formula,
        description,
      });
      if (res.data?.error) {
        toast.error("Lỗi khi cập nhật công thức: " + res.data.error);
        return false;
      }
      toast.success("Đã cập nhật công thức mẫu thành công!");
      fetchCommonFormulas();
      return true;
    } catch (err: any) {
      const errMsg = err.response?.data?.error || "Không thể kết nối đến máy chủ!";
      toast.error("Lỗi khi cập nhật công thức: " + errMsg);
      return false;
    }
  };

  const deleteCommonFormula = async (id: string) => {
    try {
      const res = await apiClient.delete(`/api/v1/spreadsheets/formulas/${id}`);
      if (res.data?.error) {
        toast.error("Lỗi khi xóa công thức: " + res.data.error);
        return false;
      }
      toast.success("Đã xóa công thức mẫu thành công!");
      fetchCommonFormulas();
      return true;
    } catch (err: any) {
      const errMsg = err.response?.data?.error || "Không thể kết nối đến máy chủ!";
      toast.error("Lỗi khi xóa công thức: " + errMsg);
      return false;
    }
  };

  useEffect(() => {
    fetchCommonFormulas();
  }, []);

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
    redoList,
    localClipboard,
    setLocalClipboard,
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
    updateSheetsAndSaveHistory,
    handleUndo,
    handleRedo,
    canUndo: history.length > 0,
    canRedo: redoList.length > 0,
    handleUpdateCell,
    copySelection,
    cutSelection,
    pasteClipboard,
    sortActiveSheet,
    trimWhitespace,
    removeEmptyRows,
    removeDuplicates,
    clearFormatting,
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
    handleSave,
    handleShiftCells,
    handleDeleteCellsAndShift,
    handleConvertToTable,
    handleCreateFilter,
    handleFilterByCellValue,
    commonFormulas,
    addCommonFormula,
    updateCommonFormula,
    deleteCommonFormula,
    applyCommonFormula,
    fetchCommonFormulas,
  };
};
