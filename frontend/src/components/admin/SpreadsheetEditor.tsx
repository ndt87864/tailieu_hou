// frontend/src/components/admin/SpreadsheetEditor.tsx
import React, { useState, useEffect } from "react";
import { X, Plus, FileSpreadsheet, Clock, ArrowRight, Lock } from "lucide-react";
import { SpreadsheetGrid } from "./SpreadsheetGrid.js";
import { getCellRange, parseCellAddress, colLetterToNumber, numberToColLetter, serializeCellsToHtml, parseHtmlToCells } from "../../utils/formulaEvaluator.js";
import { toast } from "react-toastify";
import { SpreadsheetHeader } from "./SpreadsheetHeader.js";
import { SpreadsheetToolbar } from "./SpreadsheetToolbar.js";
import apiClient from "../../services/client.js";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { useConfirm } from "../../context/ConfirmContext.js";

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

interface Sheet {
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
  const navigate = useNavigate();
  const confirm = useConfirm();

  // Excel Import States
  const [showImportModal, setShowImportModal] = useState(false);
  const [importedSheets, setImportedSheets] = useState<Sheet[]>([]);
  const [importOption, setImportOption] = useState<"new_doc" | "new_sheet" | "replace_current">("new_sheet");

  // Khởi tạo sheets list từ database content, mặc định ban đầu là 500 hàng
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

  // Stack lịch sử lưu các trạng thái trước đó để phục vụ hoàn tác (Undo) và Nhật ký phiên bản
  const [history, setHistory] = useState<Array<{ timestamp: string; sheets: Sheet[] }>>([]);
  const [isStarred, setIsStarred] = useState(!!initialContent?.isStarred);
  const [zoomLevel, setZoomLevel] = useState("100%");
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Modal file management states
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [otherSheetsList, setOtherSheetsList] = useState<any[]>([]);
  const [loadingOtherSheets, setLoadingOtherSheets] = useState(false);

  const [showVersionHistoryModal, setShowVersionHistoryModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

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
  const [tabContextMenu, setTabContextMenu] = useState<{ idx: number; x: number; y: number } | null>(null);
  
  // Custom modals states
  const [renameSheetModal, setRenameSheetModal] = useState<{ idx: number; name: string } | null>(null);
  const [deleteSheetModal, setDeleteSheetModal] = useState<{ idx: number; name: string } | null>(null);
  const [newDocModal, setNewDocModal] = useState<{ show: boolean; title: string; defaultName: string; action: (name: string) => void }>({ show: false, title: "Tạo trang tính mới", defaultName: "Trang tính chưa có tên", action: () => {} });

  const isSpreadsheetClean = () => {
    if (sheets.length > 1) return false;
    const firstSheet = sheets[0];
    if (!firstSheet) return true;
    const hasData = Object.keys(firstSheet.cells).some((key) => {
      const cell = firstSheet.cells[key];
      return cell && (cell.value || cell.formula);
    });
    return !hasData;
  };

  const parseExcelToSheets = (arrayBuffer: ArrayBuffer): Sheet[] => {
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const parsedSheets: Sheet[] = [];
    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: "" });
      const parsedCells: Record<string, CellData> = {};
      let maxRow = 500;
      let maxCol = 26;
      
      rows.forEach((row: any[], rIdx: number) => {
        row.forEach((val: any, cIdx: number) => {
          if (val !== undefined && val !== null && val !== "") {
            const colLetter = numberToColLetter(cIdx);
            const address = `${colLetter}${rIdx + 1}`;
            parsedCells[address] = {
              value: String(val),
              formula: ""
            };
          }
        });
      });
      
      if (rows.length > maxRow) maxRow = rows.length + 50;
      const colCounts = rows.map((r) => r.length);
      const longestRow = colCounts.length > 0 ? Math.max(...colCounts) : 0;
      if (longestRow > maxCol) maxCol = longestRow + 5;

      parsedSheets.push({
        name: sheetName,
        cells: parsedCells,
        rowCount: maxRow,
        colCount: maxCol,
        rowHeights: {},
        colWidths: {}
      });
    });
    
    return parsedSheets.length > 0 ? parsedSheets : [{ name: "Sheet1", cells: {}, rowCount: 500, colCount: 26 }];
  };

  const handleExcelOpenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const arrayBuffer = evt.target?.result as ArrayBuffer;
        const parsed = parseExcelToSheets(arrayBuffer);
        const clean = isSpreadsheetClean();
        if (clean) {
          updateSheetsAndSaveHistory(parsed);
          setActiveSheetIdx(0);
          setSelectedCell(null);
          setSelectedRange(null);
          toast.success("Đã mở tệp Excel thành công!");
          setTimeout(() => handleSave(parsed), 200);
        } else {
          const confirmReplace = await confirm({
            title: "Ghi đè dữ liệu trang tính?",
            message: "Trang tính hiện tại đã có dữ liệu. Bạn có muốn thay thế toàn bộ dữ liệu hiện tại bằng nội dung của tệp Excel này không?",
            confirmText: "Ghi đè dữ liệu",
            cancelText: "Hủy bỏ",
            type: "warning"
          });
          if (confirmReplace) {
            updateSheetsAndSaveHistory(parsed);
            setActiveSheetIdx(0);
            setSelectedCell(null);
            setSelectedRange(null);
            toast.success("Đã thay thế toàn bộ dữ liệu bằng tệp Excel!");
            setTimeout(() => handleSave(parsed), 200);
          }
        }
      } catch (err) {
        console.error(err);
        toast.error("Lỗi khi đọc tệp Excel!");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleExcelImportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const arrayBuffer = evt.target?.result as ArrayBuffer;
        const parsed = parseExcelToSheets(arrayBuffer);
        setImportedSheets(parsed);
        setShowImportModal(true);
      } catch (err) {
        console.error(err);
        toast.error("Lỗi khi đọc tệp Excel!");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleImportExcelClick = () => {
    document.getElementById("excel-import-file-input")?.click();
  };

  const handleExecuteImport = async () => {
    if (importedSheets.length === 0) return;
    try {
      if (importOption === "new_doc") {
        setNewDocModal({
          show: true,
          title: "Tạo trang tính mới từ Excel",
          defaultName: "Bảng tính mới từ Excel",
          action: async (trimmed) => {
            try {
              const res = await apiClient.post("/api/v1/spreadsheets", {
                title: trimmed,
                content: { sheets: importedSheets }
              });
              toast.success("Đã tạo bảng tính mới từ dữ liệu Excel!");
              setShowImportModal(false);
              navigate(`/admin/sheets/${res.data.data.id}`);
            } catch (err: any) {
              toast.error("Lỗi: " + (err.response?.data?.error || err.message));
            }
          }
        });
        return;
      } else if (importOption === "new_sheet") {
        let updatedList: Sheet[] = [];
        updateSheetsAndSaveHistory((prev) => {
          const updated = [...prev, ...importedSheets];
          updatedList = updated;
          return updated;
        });
        setActiveSheetIdx(sheets.length);
        toast.success("Đã thêm trang tính mới từ dữ liệu Excel!");
        setShowImportModal(false);
        setTimeout(() => handleSave(updatedList), 200);
      } else if (importOption === "replace_current") {
        let updatedList: Sheet[] = [];
        updateSheetsAndSaveHistory((prev) => {
          const copy = [...prev];
          const firstImported = importedSheets[0];
          copy[activeSheetIdx] = {
            ...copy[activeSheetIdx],
            cells: firstImported.cells,
            rowCount: Math.max(copy[activeSheetIdx].rowCount || 500, firstImported.rowCount || 500),
            colCount: Math.max(copy[activeSheetIdx].colCount || 26, firstImported.colCount || 26)
          };
          updatedList = copy;
          return copy;
        });
        toast.success("Đã thay thế dữ liệu trang tính hiện tại bằng Excel!");
        setShowImportModal(false);
        setTimeout(() => handleSave(updatedList), 200);
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Lỗi khi nhập dữ liệu: " + (err.response?.data?.error || err.message));
    }
  };


  const currentSheet = sheets[activeSheetIdx] || { name: "Sheet1", cells: {}, rowCount: 500, colCount: 26 };
  const cells = currentSheet.cells;
  const rowCount = currentSheet.rowCount || 500;
  const colCount = currentSheet.colCount || 26;
  const visibleSheetsCount = sheets.filter((s) => !s.isHidden).length;

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

  // Helper cập nhật sheets đồng thời lưu snapshot vào lịch sử để Ctrl+Z và Lịch sử phiên bản hoạt động
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
            isProtected: s.isProtected,
            isHidden: s.isHidden,
          }));
          const newEntry = {
            timestamp: new Date().toLocaleTimeString("vi-VN"),
            sheets: snapshot
          };
          return [...prevHistory.slice(-49), newEntry]; // Giới hạn tối đa 50 bước hoàn tác
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

  const handleSave = async (customSheets?: Sheet[], customStarred?: boolean) => {
    setIsSaving(true);
    try {
      await onSave(title, {
        sheets: customSheets || sheets,
        isStarred: customStarred !== undefined ? customStarred : isStarred
      });
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStar = (newStarred: boolean) => {
    setIsStarred(newStarred);
    toast.success(newStarred ? "Đã gắn dấu sao trang tính!" : "Đã bỏ gắn dấu sao trang tính!");
    handleSave(undefined, newStarred);
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
    let updatedSheetsList: Sheet[] = [];
    updateSheetsAndSaveHistory((prev) => {
      const updated = [
        ...prev,
        { name: `Sheet${prev.length + 1}`, cells: {}, rowCount: 500, colCount: 26 }
      ];
      updatedSheetsList = updated;
      // Tự động chuyển tab sang sheet vừa tạo
      setTimeout(() => {
        setActiveSheetIdx(updated.length - 1);
      }, 0);
      return updated;
    });
    setSelectedCell(null);
    setSelectedRange(null);
    // Tự động gọi lưu thay đổi vào cơ sở dữ liệu với dữ liệu mới nhất vừa tạo
    setTimeout(() => {
      handleSave(updatedSheetsList);
    }, 100);
  };

  const handleRenameSheet = (idx: number) => {
    setRenameSheetModal({ idx, name: sheets[idx].name });
  };

  const handleDeleteSheet = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sheets[idx].isProtected) {
      toast.error("Không thể xóa trang tính đang được bảo vệ!");
      return;
    }
    if (sheets.length <= 1) {
      toast.warn("Workbook phải có ít nhất 1 trang tính!");
      return;
    }
    setDeleteSheetModal({ idx, name: sheets[idx].name });
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



  const handleExportCSV = () => {
    handleDownload("csv");
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

  const handleCopy = () => {
    const addresses = getSelectedAddresses();
    if (addresses.length === 0) return;

    const textDataRows: string[][] = [];
    const start = parseCellAddress(selectedRange?.start || selectedCell || "A1");
    const end = parseCellAddress(selectedRange?.end || selectedCell || "A1");
    if (start && end) {
      const startColIdx = colLetterToNumber(start.col);
      const endColIdx = colLetterToNumber(end.col);
      const minCol = Math.min(startColIdx, endColIdx);
      const maxCol = Math.max(startColIdx, endColIdx);
      const minRow = Math.min(start.row, end.row);
      const maxRow = Math.max(start.row, end.row);

      for (let r = minRow; r <= maxRow; r++) {
        const rowVal: string[] = [];
        for (let c = minCol; c <= maxCol; c++) {
          const addr = `${numberToColLetter(c)}${r}`;
          if (cells[addr]) {
            rowVal.push(cells[addr].formula || cells[addr].value || "");
          } else {
            rowVal.push("");
          }
        }
        textDataRows.push(rowVal);
      }
    }

    const tabSeparatedText = textDataRows.map(row => row.join("\t")).join("\n");
    let htmlText = "";
    if (start && end) {
      const startColIdx = colLetterToNumber(start.col);
      const endColIdx = colLetterToNumber(end.col);
      const minCol = Math.min(startColIdx, endColIdx);
      const maxCol = Math.max(startColIdx, endColIdx);
      const minRow = Math.min(start.row, end.row);
      const maxRow = Math.max(start.row, end.row);
      htmlText = serializeCellsToHtml(cells, minRow, maxRow, minCol, maxCol);
    }

    if (htmlText) {
      const htmlBlob = new Blob([htmlText], { type: "text/html" });
      const textBlob = new Blob([tabSeparatedText], { type: "text/plain" });
      navigator.clipboard.write([
        new ClipboardItem({
          "text/html": htmlBlob,
          "text/plain": textBlob,
        })
      ])
      .then(() => toast.success("Đã sao chép nội dung và định dạng ô tính!"))
      .catch(() => {
        navigator.clipboard.writeText(tabSeparatedText)
          .then(() => toast.success("Đã sao chép nội dung ô tính!"));
      });
    } else {
      navigator.clipboard.writeText(tabSeparatedText)
        .then(() => toast.success("Đã sao chép nội dung ô tính!"));
    }
  };

  const handlePaste = async () => {
    if (!selectedCell) return;
    try {
      const clipboardItems = await navigator.clipboard.read();
      let htmlText = "";
      let plainText = "";

      for (const item of clipboardItems) {
        if (item.types.includes("text/html")) {
          const blob = await item.getType("text/html");
          htmlText = await blob.text();
        }
        if (item.types.includes("text/plain")) {
          const blob = await item.getType("text/plain");
          plainText = await blob.text();
        }
      }

      const targetCellParsed = parseCellAddress(selectedCell);
      if (!targetCellParsed) return;

      const targetColIdx = colLetterToNumber(targetCellParsed.col);
      const startRow = targetCellParsed.row;
      const pasted: Record<string, CellData> = {};

      if (htmlText) {
        const parsed = parseHtmlToCells(htmlText);
        if (parsed && parsed.rows.length > 0) {
          parsed.rows.forEach((row, rOffset) => {
            row.forEach((cellData, cOffset) => {
              const colIdx = targetColIdx + cOffset;
              const rowNum = startRow + rOffset;

              if (colIdx >= 0 && colIdx < colCount && rowNum >= 1 && rowNum <= rowCount) {
                const addr = `${numberToColLetter(colIdx)}${rowNum}`;
                pasted[addr] = cellData;
              }
            });
          });
        }
      }

      if (Object.keys(pasted).length === 0 && plainText) {
        const rows = plainText.split(/\r?\n/);
        rows.forEach((row, rOffset) => {
          if (rOffset === rows.length - 1 && row.trim() === "") return;

          const cols = row.split("\t");
          cols.forEach((val, cOffset) => {
            const colIdx = targetColIdx + cOffset;
            const rowNum = startRow + rOffset;

            if (colIdx >= 0 && colIdx < colCount && rowNum >= 1 && rowNum <= rowCount) {
              const addr = `${numberToColLetter(colIdx)}${rowNum}`;
              const isFormula = val.startsWith("=");
              pasted[addr] = {
                value: isFormula ? "" : val,
                formula: isFormula ? val : "",
              };
            }
          });
        });
      }

      if (Object.keys(pasted).length > 0) {
        handlePasteCells(pasted);
        toast.success("Đã dán nội dung và định dạng ô tính!");
      }
    } catch (err) {
      toast.error("Không thể dán dữ liệu!");
    }
  };

  const handleNewSpreadsheet = () => {
    setNewDocModal({
      show: true,
      title: "Tạo trang tính mới",
      defaultName: "Trang tính chưa có tên",
      action: async (trimmed) => {
        try {
          let initialSheets: Sheet[] = [{ name: "Sheet1", cells: {}, rowCount: 500, colCount: 26 }];
          const vipTemplateStr = localStorage.getItem("hou_vip_sheet_template");
          if (vipTemplateStr) {
            try {
              const parsedVip = JSON.parse(vipTemplateStr);
              if (parsedVip && parsedVip.name) {
                initialSheets = [parsedVip];
              }
            } catch (e) {
              console.error("Lỗi đọc VIP sheet template:", e);
            }
          }

          const res = await apiClient.post("/api/v1/spreadsheets", {
            title: trimmed,
            content: { sheets: initialSheets }
          });
          toast.success("Đã tạo bảng tính mới thành công!");
          navigate(`/admin/sheets/${res.data.data.id}`);
        } catch (err: any) {
          toast.error("Lỗi: " + (err.response?.data?.error || err.message));
        }
      }
    });
  };

  const handleOpenSpreadsheet = () => {
    document.getElementById("excel-open-file-input")?.click();
  };

  const handleMakeCopy = async () => {
    try {
      const res = await apiClient.post("/api/v1/spreadsheets", {
        title: `${title} - Bản sao`,
        content: { sheets }
      });
      toast.success("Tạo bản sao thành công!");
      window.location.href = `/admin/sheets/${res.data.data.id}`;
    } catch (err: any) {
      toast.error("Không thể nhân bản: " + (err.response?.data?.error || err.message));
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Đã sao chép liên kết trang tính vào bộ nhớ tạm!");
  };

  const handleEmail = () => {
    window.location.href = `mailto:?subject=${encodeURIComponent("Bảng tính: " + title)}&body=${encodeURIComponent("Truy cập bảng tính tại đây: " + window.location.href)}`;
  };

  const handleDownload = (type: "csv" | "tsv" | "xlsx" | "pdf") => {
    const isCsvOrTsv = type === "csv" || type === "tsv";
    const separator = type === "tsv" ? "\t" : ",";

    let maxRow = 1;
    let maxColIdx = 0;
    const addresses = Object.keys(cells);
    addresses.forEach((addr) => {
      const parsed = parseCellAddress(addr);
      if (parsed) {
        if (parsed.row > maxRow) maxRow = parsed.row;
        const colIdx = colLetterToNumber(parsed.col);
        if (colIdx > maxColIdx) maxColIdx = colIdx;
      }
    });

    let contentStr = "";
    for (let r = 1; r <= maxRow; r++) {
      const rowData = [];
      for (let c = 0; c <= maxColIdx; c++) {
        const colLetter = numberToColLetter(c);
        const cell = cells[`${colLetter}${r}`];
        const val = cell ? cell.value || cell.formula || "" : "";
        const escaped = ("" + val).replace(/"/g, '""');
        rowData.push(`"${escaped}"`);
      }
      contentStr += rowData.join(separator) + "\n";
    }

    const fileExt = isCsvOrTsv ? type : (type === "xlsx" ? "csv" : "pdf");
    if (!isCsvOrTsv) {
      toast.info(`Tính năng tải ${type.toUpperCase()} đang đồng bộ, hệ thống sẽ tải file CSV thay thế.`);
    }

    const mimeType = type === "tsv" ? "text/tab-separated-values;charset=utf-8;" : "text/csv;charset=utf-8;";
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), contentStr], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${title || "sheet"}.${fileExt}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRenameFocus = () => {
    const input = document.getElementById("sheet-title-input-el");
    if (input) {
      input.focus();
      (input as HTMLInputElement).select();
    }
  };

  const handleMoveToTrash = async () => {
    if (confirm(`Bạn có chắc chắn muốn xóa trang tính "${title}" và di chuyển vào thùng rác?`)) {
      try {
        await apiClient.delete(`/api/v1/spreadsheets/${sheetId}`);
        toast.success("Xóa trang tính thành công!");
        onBack();
      } catch (err: any) {
        toast.error("Lỗi khi xóa trang tính!");
      }
    }
  };

  const getCommonStyleForSelection = (): CellData | null => {
    const addresses = getSelectedAddresses();
    if (addresses.length === 0) return null;
    
    const firstAddr = addresses[0];
    const firstCell = cells[firstAddr] || { value: "", formula: "" };
    
    const common: CellData = {
      value: firstCell.value || "",
      formula: firstCell.formula || "",
      bold: firstCell.bold,
      italic: firstCell.italic,
      underline: firstCell.underline,
      strikethrough: firstCell.strikethrough,
      color: firstCell.color,
      bg: firstCell.bg,
      align: firstCell.align,
      fontFamily: firstCell.fontFamily || "Times New Roman",
      fontSize: firstCell.fontSize || "13px",
    };
    
    for (let i = 1; i < addresses.length; i++) {
      const cell = cells[addresses[i]] || { value: "", formula: "" };
      
      if (cell.bold !== common.bold) delete common.bold;
      if (cell.italic !== common.italic) delete common.italic;
      if (cell.underline !== common.underline) delete common.underline;
      if (cell.strikethrough !== common.strikethrough) delete common.strikethrough;
      if (cell.color !== common.color) delete common.color;
      if (cell.bg !== common.bg) delete common.bg;
      if (cell.align !== common.align) delete common.align;
      
      const cellFontFamily = cell.fontFamily || "Times New Roman";
      if (cellFontFamily !== common.fontFamily) delete common.fontFamily;
      
      const cellFontSize = cell.fontSize || "13px";
      if (cellFontSize !== common.fontSize) delete common.fontSize;
    }
    
    return common;
  };

  const activeCell = getCommonStyleForSelection();

  const handleUnhideSheet = (idx: number) => {
    updateSheetsAndSaveHistory((prev) => {
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        isHidden: false
      };
      return copy;
    });
    setActiveSheetIdx(idx);
    toast.success(`Đã hiển thị lại trang tính: ${sheets[idx].name}`);
    setTimeout(() => {
      handleSave();
    }, 100);
  };

  return (
    <div className="sheet-editor-container">
      {/* Google Sheets Header */}
      <SpreadsheetHeader
        title={title}
        setTitle={setTitle}
        isStarred={isStarred}
        setIsStarred={handleToggleStar}
        isSaving={isSaving}
        onBack={onBack}
        onSave={handleSave}
        onImportExcelClick={handleImportExcelClick}
        handleExportJSON={handleExportJSON}
        handleExportCSV={handleExportCSV}
        onUndo={handleUndo}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onToggleFindReplace={() => setShowFindReplace(!showFindReplace)}
        onInsertRow={(pos) => {
          if (selectedCell) {
            const addr = parseCellAddress(selectedCell);
            if (addr) insertRow(addr.row, pos);
          } else {
            insertRow(rowCount, pos);
          }
        }}
        onInsertCol={(pos) => {
          if (selectedCell) {
            const addr = parseCellAddress(selectedCell);
            if (addr) insertColumn(addr.col, pos);
          } else {
            insertColumn(numberToColLetter(colCount - 1), pos);
          }
        }}
        onInsertFormula={insertFormula}
        onApplyStyle={handleToolbarStyleChange}
        onOpenHelp={() => setShowHelpModal(true)}
        
        // Google Sheets File Menu Handlers
        onNewSpreadsheet={handleNewSpreadsheet}
        onOpenSpreadsheet={handleOpenSpreadsheet}
        onMakeCopy={handleMakeCopy}
        onShare={handleShare}
        onEmail={handleEmail}
        onDownload={handleDownload}
        onRename={handleRenameFocus}
        onMoveToTrash={handleMoveToTrash}
        onVersionHistory={() => setShowVersionHistoryModal(true)}
        onShowDetails={() => setShowDetailsModal(true)}
        sheets={sheets}
        onUnhideSheet={handleUnhideSheet}
      />

      {/* Google Sheets Toolbar */}
      <SpreadsheetToolbar
        activeCell={activeCell}
        zoomLevel={zoomLevel}
        setZoomLevel={setZoomLevel}
        showFindReplace={showFindReplace}
        setShowFindReplace={setShowFindReplace}
        handleUndo={handleUndo}
        handleFontChange={handleFontChange}
        handleToolbarStyleChange={handleToolbarStyleChange}
        handleAlignChange={handleAlignChange}
        handleColorChange={handleColorChange}
        onFormatSelection={formatSelection}
        onInsertFormula={insertFormula}
      />

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

      {/* Grid Wrapper for scaling */}
      <div 
        style={{ 
          zoom: zoomLevel === "100%" ? undefined : parseFloat(zoomLevel) / 100, 
          overflow: "auto", 
          flex: 1 
        }}
      >
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
          onInsertRow={insertRow}
          onInsertCol={insertColumn}
          onDeleteRow={deleteRow}
          onDeleteCol={deleteColumn}
          onClearRow={clearRow}
          onClearCol={clearColumn}
          rowHeights={sheets[activeSheetIdx]?.rowHeights}
          colWidths={sheets[activeSheetIdx]?.colWidths}
          onUpdateRowHeight={handleUpdateRowHeight}
          onUpdateColWidth={handleUpdateColWidth}
        />
      </div>

      {/* Add Rows Panel */}
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
      <div className="sheet-bottom-bar" onContextMenu={(e) => e.preventDefault()}>
        {sheets.map((sheet, idx) => (
          !sheet.isHidden && (
            <div 
              key={idx} 
              className={`sheet-tab ${activeSheetIdx === idx ? "active" : ""}`}
              style={{ borderLeftColor: (sheet as any).color ? (sheet as any).color : undefined, borderLeftWidth: (sheet as any).color ? "4px" : undefined }}
              onClick={() => {
                setActiveSheetIdx(idx);
                setSelectedCell(null);
                setSelectedRange(null);
              }}
              onDoubleClick={() => handleRenameSheet(idx)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setTabContextMenu({
                  idx,
                  x: e.clientX,
                  y: e.clientY
                });
              }}
            >
              <span className="flex items-center gap-1">
                {sheet.name}
                {sheet.isVip && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30 ml-1" title="Sheet VIP (Mặc định khi tạo trang tính mới)">
                    ⭐ VIP
                  </span>
                )}
              </span>
              {sheet.isProtected ? (
                <button 
                  className="btn-tab-close" 
                  onClick={(e) => {
                    e.stopPropagation();
                    toast.error("Không thể xóa trang tính đang được bảo vệ!");
                  }}
                  title="Trang tính được bảo vệ"
                  style={{ cursor: "default" }}
                >
                  <Lock className="w-3 h-3 text-amber-500" />
                </button>
              ) : (
                visibleSheetsCount > 1 && (
                  <button 
                    className="btn-tab-close" 
                    onClick={(e) => handleDeleteSheet(idx, e)}
                    title="Xóa Sheet"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )
              )}
            </div>
          )
        ))}
        <button onClick={handleAddSheet} className="btn-add-tab">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tab Context Menu */}
      {tabContextMenu && (
        <>
          <div 
            className="sheets-context-menu-backdrop" 
            onClick={() => setTabContextMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setTabContextMenu(null); }}
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
              color: "var(--fg)"
            }}
          >
            <button 
              className="sheets-tab-menu-item" 
              onClick={() => {
                if (sheets[tabContextMenu.idx].isProtected) {
                  toast.error("Không thể xóa trang tính đang được bảo vệ!");
                  setTabContextMenu(null);
                  return;
                }
                if (sheets.length <= 1) {
                  toast.warn("Workbook phải có ít nhất 1 trang tính!");
                  setTabContextMenu(null);
                  return;
                }
                setDeleteSheetModal({ idx: tabContextMenu.idx, name: sheets[tabContextMenu.idx].name });
                setTabContextMenu(null);
              }}
              style={{ 
                display: "flex", 
                width: "100%", 
                padding: "8px 12px", 
                border: "none", 
                background: "none", 
                fontSize: "13px", 
                cursor: sheets[tabContextMenu.idx].isProtected ? "not-allowed" : "pointer", 
                color: sheets[tabContextMenu.idx].isProtected ? "gray" : "red", 
                opacity: sheets[tabContextMenu.idx].isProtected ? 0.5 : 1,
                textAlign: "left" 
              }}
            >
              Xóa
            </button>
            <button 
              className="sheets-tab-menu-item" 
              onClick={() => {
                const sheetToDup = sheets[tabContextMenu.idx];
                updateSheetsAndSaveHistory((prev) => [
                  ...prev,
                  { 
                    ...sheetToDup, 
                    name: `${sheetToDup.name} (Bản sao)`,
                    cells: { ...sheetToDup.cells },
                    rowHeights: { ...sheetToDup.rowHeights },
                    colWidths: { ...sheetToDup.colWidths }
                  }
                ]);
                setTabContextMenu(null);
                toast.success("Đã nhân bản trang tính!");
              }}
              style={{ display: "flex", width: "100%", padding: "8px 12px", border: "none", background: "none", fontSize: "13px", cursor: "pointer", color: "inherit", textAlign: "left" }}
            >
              Nhân bản
            </button>
            <button 
              className="sheets-tab-menu-item" 
              onClick={() => {
                handleRenameSheet(tabContextMenu.idx);
                setTabContextMenu(null);
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
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                }}
              >
                {["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", ""].map((c) => (
                  <button 
                    key={c}
                    onClick={() => {
                      updateSheetsAndSaveHistory((prev) => {
                        const copy = [...prev];
                        (copy[tabContextMenu.idx] as any).color = c;
                        return copy;
                      });
                      setTabContextMenu(null);
                    }}
                    style={{
                      width: "16px",
                      height: "16px",
                      borderRadius: "50%",
                      backgroundColor: c || "#ccc",
                      border: "1px solid #ddd",
                      cursor: "pointer"
                    }}
                    title={c ? c : "Không màu"}
                  />
                ))}
              </div>
            </div>
            <button 
              className="sheets-tab-menu-item" 
              onClick={() => {
                const targetIdx = tabContextMenu.idx;
                const isCurrentProtected = !!sheets[targetIdx].isProtected;
                updateSheetsAndSaveHistory((prev) => {
                  const copy = [...prev];
                  copy[targetIdx] = {
                    ...copy[targetIdx],
                    isProtected: !isCurrentProtected
                  };
                  return copy;
                });
                toast.success(
                  isCurrentProtected 
                    ? "Đã hủy bảo vệ trang tính thành công!" 
                    : "Đã bảo vệ trang tính thành công!"
                );
                setTabContextMenu(null);
                // Auto save changes
                setTimeout(() => {
                  handleSave();
                }, 100);
              }}
              style={{ display: "flex", width: "100%", padding: "8px 12px", border: "none", background: "none", fontSize: "13px", cursor: "pointer", color: "inherit", textAlign: "left" }}
            >
              {sheets[tabContextMenu.idx].isProtected ? "Hủy bảo vệ trang tính" : "Bảo vệ trang tính"}
            </button>
            {visibleSheetsCount > 1 && (
              <button 
                className="sheets-tab-menu-item" 
                onClick={() => {
                  const targetIdx = tabContextMenu.idx;
                  updateSheetsAndSaveHistory((prev) => {
                    const copy = [...prev];
                    copy[targetIdx] = {
                      ...copy[targetIdx],
                      isHidden: true
                    };
                    return copy;
                  });
                  // Tìm trang tính khác đang hiển thị để chuyển sang làm active tab
                  const nextVisibleIdx = sheets.findIndex((s, i) => i !== targetIdx && !s.isHidden);
                  if (nextVisibleIdx !== -1) {
                    setActiveSheetIdx(nextVisibleIdx);
                  }
                  toast.success("Trang tính đã được ẩn thành công!");
                  setTabContextMenu(null);
                  setTimeout(() => {
                    handleSave();
                  }, 100);
                }}
                style={{ display: "flex", width: "100%", padding: "8px 12px", border: "none", background: "none", fontSize: "13px", cursor: "pointer", color: "inherit", textAlign: "left" }}
              >
                Ẩn trang tính
              </button>
            )}
            <button 
              className="sheets-tab-menu-item" 
              onClick={() => {
                const targetIdx = tabContextMenu.idx;
                const targetSheet = sheets[targetIdx];
                const isCurrentVip = !!targetSheet.isVip;

                updateSheetsAndSaveHistory((prev) => {
                  const copy = prev.map((s, i) => {
                    if (i === targetIdx) {
                      return { ...s, isVip: !isCurrentVip };
                    }
                    return !isCurrentVip ? { ...s, isVip: false } : s;
                  });
                  return copy;
                });

                if (!isCurrentVip) {
                  const vipData = {
                    name: targetSheet.name,
                    cells: JSON.parse(JSON.stringify(targetSheet.cells || {})),
                    rowCount: targetSheet.rowCount || 500,
                    colCount: targetSheet.colCount || 26,
                    rowHeights: JSON.parse(JSON.stringify(targetSheet.rowHeights || {})),
                    colWidths: JSON.parse(JSON.stringify(targetSheet.colWidths || {})),
                    isProtected: false,
                    isHidden: false,
                    isVip: true,
                  };
                  localStorage.setItem("hou_vip_sheet_template", JSON.stringify(vipData));
                  toast.success(`Đã gán "${targetSheet.name}" làm Sheet VIP mẫu cho trang tính mới!`);
                } else {
                  localStorage.removeItem("hou_vip_sheet_template");
                  toast.info(`Đã hủy gán Sheet VIP cho "${targetSheet.name}".`);
                }

                setTabContextMenu(null);
                setTimeout(() => {
                  handleSave();
                }, 100);
              }}
              style={{ display: "flex", width: "100%", padding: "8px 12px", border: "none", background: "none", fontSize: "13px", cursor: "pointer", color: "inherit", textAlign: "left" }}
            >
              {sheets[tabContextMenu.idx].isVip ? "⭐ Hủy gán Sheet VIP" : "⭐ Gán làm Sheet VIP"}
            </button>
            <div style={{ height: "1px", backgroundColor: "var(--border)", margin: "4px 0" }} />
            <button 
              className="sheets-tab-menu-item" 
              disabled={tabContextMenu.idx === sheets.length - 1}
              onClick={() => {
                if (tabContextMenu.idx < sheets.length - 1) {
                  updateSheetsAndSaveHistory((prev) => {
                    const copy = [...prev];
                    const temp = copy[tabContextMenu.idx];
                    copy[tabContextMenu.idx] = copy[tabContextMenu.idx + 1];
                    copy[tabContextMenu.idx + 1] = temp;
                    return copy;
                  });
                  setActiveSheetIdx(tabContextMenu.idx + 1);
                }
                setTabContextMenu(null);
              }}
              style={{ display: "flex", width: "100%", padding: "8px 12px", border: "none", background: "none", fontSize: "13px", cursor: tabContextMenu.idx === sheets.length - 1 ? "not-allowed" : "pointer", color: "inherit", opacity: tabContextMenu.idx === sheets.length - 1 ? 0.4 : 1, textAlign: "left" }}
            >
              Di chuyển sang phải
            </button>
            <button 
              className="sheets-tab-menu-item" 
              disabled={tabContextMenu.idx === 0}
              onClick={() => {
                if (tabContextMenu.idx > 0) {
                  updateSheetsAndSaveHistory((prev) => {
                    const copy = [...prev];
                    const temp = copy[tabContextMenu.idx];
                    copy[tabContextMenu.idx] = copy[tabContextMenu.idx - 1];
                    copy[tabContextMenu.idx - 1] = temp;
                    return copy;
                  });
                  setActiveSheetIdx(tabContextMenu.idx - 1);
                }
                setTabContextMenu(null);
              }}
              style={{ display: "flex", width: "100%", padding: "8px 12px", border: "none", background: "none", fontSize: "13px", cursor: tabContextMenu.idx === 0 ? "not-allowed" : "pointer", color: "inherit", opacity: tabContextMenu.idx === 0 ? 0.4 : 1, textAlign: "left" }}
            >
              Di chuyển sang trái
            </button>
          </div>
        </>
      )}

      {/* Keyboard Shortcuts Help Modal */}
      {showHelpModal && (
        <div className="sheets-modal-overlay">
          <div className="sheets-modal-card" style={{ maxWidth: "500px" }}>
            <h3>Trợ giúp & Phím tắt Bảng tính</h3>
            <div className="sheets-modal-body" style={{ fontSize: "13px", gap: "10px", maxHeight: "300px", overflowY: "auto" }}>
              <p><strong>Thao tác ô tính:</strong></p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Nhấp đúp chuột vào ô để sửa dữ liệu hoặc nhập công thức bắt đầu bằng dấu <code>=</code> (Ví dụ: <code>=SUM(A1:A5)</code>).</li>
                <li>Kéo chuột trái từ ô này sang ô khác để chọn vùng dữ liệu (Range Selection).</li>
                <li>Ấn phím <strong>Enter</strong> để lưu chỉnh sửa và di chuyển xuống ô dưới.</li>
                <li>Ấn phím <strong>Escape</strong> để hủy bỏ chỉnh sửa hiện tại.</li>
              </ul>
              <p className="mt-2"><strong>Phím tắt hữu ích:</strong></p>
              <ul className="list-disc pl-5 space-y-1">
                <li><code>Ctrl + Z</code>: Hoàn tác hành động gần nhất.</li>
                <li><code>Ctrl + C</code>: Sao chép nội dung vùng chọn.</li>
                <li><code>Ctrl + V</code>: Dán nội dung từ clipboard.</li>
                <li><code>Ctrl + A</code>: Chọn toàn bộ bảng tính.</li>
                <li><code>Ctrl + H</code>: Tìm kiếm & Thay thế.</li>
              </ul>
            </div>
            <div className="sheets-modal-actions">
              <button onClick={() => setShowHelpModal(false)} className="btn-modal-confirm">Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Mở bảng tính khác (Open Spreadsheet) */}
      {showOpenModal && (
        <div className="sheets-modal-overlay" onClick={() => setShowOpenModal(false)}>
          <div className="sheets-modal-card" style={{ maxWidth: "500px" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-[var(--border)] pb-3 mb-2">
              <h3>Mở trang tính</h3>
              <button onClick={() => setShowOpenModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="sheets-modal-body" style={{ maxHeight: "320px", overflowY: "auto" }}>
              {loadingOtherSheets ? (
                <div className="text-center py-8">Đang tải danh sách...</div>
              ) : otherSheetsList.length === 0 ? (
                <div className="text-center py-8 text-gray-500">Chưa có trang tính nào khác trên hệ thống.</div>
              ) : (
                <div className="space-y-2">
                  {otherSheetsList.map((item) => (
                    <a
                      key={item.id}
                      href={`/admin/sheets/${item.id}`}
                      className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-2)] hover:bg-[var(--bg-3)] transition-colors cursor-pointer text-[var(--fg)] text-sm"
                    >
                      <div className="flex items-center gap-2.5">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                        <span className="font-medium truncate max-w-[280px]">{item.title}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-gray-400">
                        <span>Mở</span>
                        <ArrowRight className="w-3 h-3" />
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Nhật ký thay đổi (In-session Version History) */}
      {showVersionHistoryModal && (
        <div className="sheets-modal-overlay" onClick={() => setShowVersionHistoryModal(false)}>
          <div className="sheets-modal-card" style={{ maxWidth: "500px" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-[var(--border)] pb-3 mb-2">
              <h3>Nhật ký phiên bản</h3>
              <button onClick={() => setShowVersionHistoryModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="sheets-modal-body" style={{ maxHeight: "320px", overflowY: "auto" }}>
              {history.length === 0 ? (
                <div className="text-center py-8 text-gray-500 flex flex-col items-center gap-2">
                  <Clock className="w-8 h-8 text-gray-400" />
                  <p>Chưa có thay đổi nào trong phiên làm việc này.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((entry, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-2)] hover:bg-[var(--bg-3)] transition-colors text-sm"
                    >
                      <div className="flex items-center gap-2.5">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">Phiên bản sửa đổi lúc {entry.timestamp}</span>
                      </div>
                      <button
                        onClick={() => {
                          updateSheetsAndSaveHistory(entry.sheets);
                          setShowVersionHistoryModal(false);
                          toast.success(`Đã hồi phục bảng tính về phiên bản lúc ${entry.timestamp}!`);
                        }}
                        className="btn-modal-confirm py-1 px-2.5 text-xs"
                      >
                        Khôi phục
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Chi tiết trang tính (Details) */}
      {showDetailsModal && (
        <div className="sheets-modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="sheets-modal-card" style={{ maxWidth: "400px" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-[var(--border)] pb-3 mb-2">
              <h3>Chi tiết tài liệu</h3>
              <button onClick={() => setShowDetailsModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="sheets-modal-body" style={{ fontSize: "13px", gap: "12px" }}>
              <div>
                <span className="text-gray-400 block text-[11px] uppercase tracking-wider">Tên tài liệu</span>
                <span className="font-semibold text-sm">{title}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-400 block text-[11px] uppercase tracking-wider">Số trang tính (Sheet)</span>
                  <span className="font-medium">{sheets.length}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[11px] uppercase tracking-wider">Tổng số ô dữ liệu</span>
                  <span className="font-medium">{Object.keys(cells).length}</span>
                </div>
              </div>
            </div>
            <div className="sheets-modal-actions">
              <button onClick={() => setShowDetailsModal(false)} className="btn-modal-confirm">Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Đổi tên Sheet */}
      {renameSheetModal && (
        <div className="sheets-modal-overlay" onClick={() => setRenameSheetModal(null)}>
          <div className="sheets-modal-card" style={{ maxWidth: "400px" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-[var(--border)] pb-3 mb-2">
              <h3>Đổi tên trang tính</h3>
              <button onClick={() => setRenameSheetModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="sheets-modal-body">
              <label htmlFor="rename-sheet-input-el">Tên trang tính mới</label>
              <input
                id="rename-sheet-input-el"
                type="text"
                value={renameSheetModal.name}
                onChange={(e) => setRenameSheetModal({ ...renameSheetModal, name: e.target.value })}
                placeholder="Nhập tên trang tính..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && renameSheetModal.name.trim()) {
                    updateSheetsAndSaveHistory((prev) => {
                      const copy = [...prev];
                      copy[renameSheetModal.idx] = { ...copy[renameSheetModal.idx], name: renameSheetModal.name.trim() };
                      return copy;
                    });
                    setRenameSheetModal(null);
                    toast.success("Đã đổi tên trang tính!");
                  }
                }}
              />
            </div>
            <div className="sheets-modal-actions">
              <button onClick={() => setRenameSheetModal(null)} className="btn-modal-cancel">Hủy</button>
              <button
                disabled={!renameSheetModal.name.trim()}
                onClick={() => {
                  let updated: Sheet[] = [];
                  updateSheetsAndSaveHistory((prev) => {
                    const copy = [...prev];
                    copy[renameSheetModal.idx] = { ...copy[renameSheetModal.idx], name: renameSheetModal.name.trim() };
                    updated = copy;
                    return copy;
                  });
                  setRenameSheetModal(null);
                  toast.success("Đã đổi tên trang tính!");
                  setTimeout(() => handleSave(updated), 100);
                }}
                className="btn-modal-confirm"
              >
                Cập nhật
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Xác nhận xóa Sheet */}
      {deleteSheetModal && (
        <div className="sheets-modal-overlay" onClick={() => setDeleteSheetModal(null)}>
          <div className="sheets-modal-card" style={{ maxWidth: "400px" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-[var(--border)] pb-3 mb-2">
              <h3>Xóa trang tính?</h3>
              <button onClick={() => setDeleteSheetModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="sheets-modal-body py-2">
              <p className="text-sm text-[var(--fg-muted)]">
                Bạn có chắc chắn muốn xóa trang tính <strong>"{deleteSheetModal.name}"</strong> không? 
                Hành động này không thể hoàn tác trực tiếp.
              </p>
            </div>
            <div className="sheets-modal-actions">
              <button onClick={() => setDeleteSheetModal(null)} className="btn-modal-cancel">Hủy bỏ</button>
              <button
                onClick={() => {
                  let updated: Sheet[] = [];
                  updateSheetsAndSaveHistory((prev) => {
                    const filtered = prev.filter((_, i) => i !== deleteSheetModal.idx);
                    updated = filtered;
                    return filtered;
                  });
                  setActiveSheetIdx((prev) => Math.max(0, prev - 1));
                  setSelectedCell(null);
                  setSelectedRange(null);
                  setDeleteSheetModal(null);
                  toast.success("Đã xóa trang tính!");
                  setTimeout(() => handleSave(updated), 100);
                }}
                className="btn-modal-confirm bg-red-500 hover:bg-red-600 text-white"
              >
                Đồng ý xóa
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal: Nhập dữ liệu Excel (Import Options) */}
      {showImportModal && (
        <div className="sheets-modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="sheets-modal-card" style={{ maxWidth: "450px" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-[var(--border)] pb-3 mb-4">
              <h3 className="text-lg font-bold">Nhập dữ liệu từ Excel</h3>
              <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="sheets-modal-body py-2 space-y-4" style={{ fontSize: "14px" }}>
              <p className="text-sm text-[var(--fg-muted)] mb-3">
                Chọn vị trí bạn muốn nhập dữ liệu từ tệp tin Excel này:
              </p>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer p-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-2)] hover:bg-[var(--bg-3)]">
                  <input 
                    type="radio" 
                    name="importOption" 
                    value="new_doc" 
                    checked={importOption === "new_doc"} 
                    onChange={() => setImportOption("new_doc")} 
                    className="w-4 h-4 text-emerald-500 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="font-semibold block text-left">Tạo trang tính mới</span>
                    <span className="text-xs text-gray-400 text-left block">Tạo một tài liệu bảng tính hoàn toàn mới trên hệ thống</span>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer p-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-2)] hover:bg-[var(--bg-3)]">
                  <input 
                    type="radio" 
                    name="importOption" 
                    value="new_sheet" 
                    checked={importOption === "new_sheet"} 
                    onChange={() => setImportOption("new_sheet")} 
                    className="w-4 h-4 text-emerald-500 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="font-semibold block text-left">Chèn trang sheet mới</span>
                    <span className="text-xs text-gray-400 text-left block">Tạo thêm tab sheet mới vào tài liệu hiện tại</span>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer p-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-2)] hover:bg-[var(--bg-3)]">
                  <input 
                    type="radio" 
                    name="importOption" 
                    value="replace_current" 
                    checked={importOption === "replace_current"} 
                    onChange={() => setImportOption("replace_current")} 
                    className="w-4 h-4 text-emerald-500 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="font-semibold block text-left">Thay thế trang sheet hiện tại</span>
                    <span className="text-xs text-gray-400 text-left block">Ghi đè hoàn toàn dữ liệu của tab hiện tại bằng dữ liệu mới</span>
                  </div>
                </label>
              </div>
            </div>
            <div className="sheets-modal-actions mt-6">
              <button onClick={() => setShowImportModal(false)} className="btn-modal-cancel">Hủy bỏ</button>
              <button
                onClick={handleExecuteImport}
                className="btn-modal-confirm bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                Nhập dữ liệu
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal: Nhập tên trang tính mới */}
      {newDocModal.show && (
        <div className="sheets-modal-overlay" onClick={() => setNewDocModal({ ...newDocModal, show: false })}>
          <div className="sheets-modal-card" style={{ maxWidth: "420px" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-[var(--border)] pb-3 mb-2">
              <h3 className="text-base font-bold">{newDocModal.title}</h3>
              <button onClick={() => setNewDocModal({ ...newDocModal, show: false })} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="sheets-modal-body py-2">
              <label htmlFor="new-doc-name-input">Tên trang tính</label>
              <input
                id="new-doc-name-input"
                type="text"
                value={newDocModal.defaultName}
                onChange={(e) => setNewDocModal({ ...newDocModal, defaultName: e.target.value })}
                placeholder="Nhập tên trang tính..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newDocModal.defaultName.trim()) {
                    newDocModal.action(newDocModal.defaultName.trim());
                    setNewDocModal({ ...newDocModal, show: false });
                  }
                }}
              />
            </div>
            <div className="sheets-modal-actions mt-4">
              <button onClick={() => setNewDocModal({ ...newDocModal, show: false })} className="btn-modal-cancel">Hủy</button>
              <button
                disabled={!newDocModal.defaultName.trim()}
                onClick={() => {
                  newDocModal.action(newDocModal.defaultName.trim());
                  setNewDocModal({ ...newDocModal, show: false });
                }}
                className="btn-modal-confirm bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file inputs for Excel import and open */}
      <input 
        type="file" 
        id="excel-open-file-input" 
        accept=".xlsx,.xls,.csv" 
        style={{ display: "none" }} 
        onChange={handleExcelOpenChange} 
      />
      <input 
        type="file" 
        id="excel-import-file-input" 
        accept=".xlsx,.xls,.csv" 
        style={{ display: "none" }} 
        onChange={handleExcelImportChange} 
      />
    </div>
  );
};


export default SpreadsheetEditor;
