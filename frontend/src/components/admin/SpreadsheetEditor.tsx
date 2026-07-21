// frontend/src/components/admin/SpreadsheetEditor.tsx
import React, { useState } from "react";
import { X, Plus, Lock, ChevronDown, ChevronUp } from "lucide-react";
import { SpreadsheetGrid } from "./SpreadsheetGrid.js";
import { parseCellAddress, numberToColLetter, colLetterToNumber } from "../../utils/formulaEvaluator.js";
import { toast } from "react-toastify";
import { SpreadsheetHeader } from "./SpreadsheetHeader.js";
import { SpreadsheetToolbar } from "./SpreadsheetToolbar.js";
import apiClient from "../../services/client.js";
import { useNavigate } from "react-router-dom";
import { useConfirm } from "../../context/ConfirmContext.js";
import { useSpreadsheetState, Sheet, CellData } from "../../hooks/useSpreadsheetState.js";
import { exportToXlsx, exportToCsvOrTsv } from "../../utils/spreadsheetExport.js";
import { PrintSettingsModal } from "./modals/PrintSettingsModal.js";
import { ExcelImportModal } from "./modals/ExcelImportModal.js";
import { TabContextMenu } from "./TabContextMenu.js";
import {
  HelpShortcutsModal,
  OpenSpreadsheetModal,
  VersionHistoryModal,
  DocumentDetailsModal,
  RenameSheetModal,
  DeleteSheetModal,
  NewDocModal,
  SelectVipSheetsModal,
  LinkInsertModal,
  FilterModal,
} from "./modals/SpreadsheetModals.js";
import * as XLSX from "xlsx";

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
  const navigate = useNavigate();
  const confirmModal = useConfirm();
  const [isSaving, setIsSaving] = useState(false);

  const state = useSpreadsheetState(initialTitle, initialContent, async (title, content) => {
    setIsSaving(true);
    try { await onSave(title, content); } finally { setIsSaving(false); }
  });

  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showVersionHistoryModal, setShowVersionHistoryModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [renameSheetModal, setRenameSheetModal] = useState<{ idx: number; name: string } | null>(null);
  const [deleteSheetModal, setDeleteSheetModal] = useState<{ idx: number; name: string } | null>(null);
  const [newDocModal, setNewDocModal] = useState<{ show: boolean; title: string; defaultName: string; action: (name: string) => void }>({
    show: false, title: "Tạo trang tính mới", defaultName: "Trang tính chưa có tên", action: () => {},
  });

  const [importedSheets, setImportedSheets] = useState<Sheet[]>([]);
  const [importOption, setImportOption] = useState<"new_doc" | "new_sheet" | "replace_current">("new_sheet");
  const [otherSheetsList, setOtherSheetsList] = useState<any[]>([]);
  const [loadingOtherSheets, setLoadingOtherSheets] = useState(false);
  const [showVipSelectModal, setShowVipSelectModal] = useState(false);
  const [vipTemplates, setVipTemplates] = useState<any[]>([]);
  const [pendingDocName, setPendingDocName] = useState("");
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [findMode, setFindMode] = useState<"find" | "replace">("find");
  const [searchScope, setSearchScope] = useState<"sheet" | "workbook">("sheet");
  const [showHeader, setShowHeader] = useState(true);
  const [matchCase, setMatchCase] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ sheetIdx: number; address: string; value: string }>>([]);
  const [currentResultIdx, setCurrentResultIdx] = useState<number>(-1);
  const [tabContextMenu, setTabContextMenu] = useState<{ idx: number; x: number; y: number } | null>(null);
  const [showLinkModal, setShowLinkModal] = useState<{ address: string; defaultText: string } | null>(null);
  const [showFilterModal, setShowFilterModal] = useState<{ colLetter: string } | null>(null);

  const visibleSheetsCount = state.sheets.filter((s) => !s.isHidden).length;

  const handleExcelOpenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const parsed = parseExcelToSheets(evt.target?.result as ArrayBuffer);
        const clean = state.sheets.length === 1 && !Object.keys(state.sheets[0].cells).some(k => state.sheets[0].cells[k]?.value || state.sheets[0].cells[k]?.formula);
        if (clean || await confirmModal({ title: "Ghi đè dữ liệu?", message: "Thay thế toàn bộ dữ liệu hiện tại bằng tệp Excel?", confirmText: "Ghi đè", cancelText: "Hủy", type: "warning" })) {
          state.updateSheetsAndSaveHistory(parsed);
          state.setActiveSheetIdx(0);
          state.setSelectedCell(null);
          state.setSelectedRange(null);
          toast.success("Đã mở Excel thành công!");
          setTimeout(() => state.handleSave(parsed), 200);
        }
      } catch { toast.error("Lỗi đọc Excel!"); }
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
        const parsed = parseExcelToSheets(evt.target?.result as ArrayBuffer);
        setImportedSheets(parsed);
        setShowImportModal(true);
      } catch { toast.error("Lỗi khi đọc tệp Excel!"); }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleOpenSpreadsheetModal = async () => {
    setLoadingOtherSheets(true);
    setShowOpenModal(true);
    try {
      const res = await apiClient.get("/api/v1/spreadsheets");
      setOtherSheetsList(res.data.data.filter((item: any) => item.id !== sheetId));
    } catch { toast.error("Không thể tải danh sách!"); }
    finally { setLoadingOtherSheets(false); }
  };

  const performCreateNewSpreadsheet = async (title: string, selectedVipTemplates: any[]) => {
    try {
      const payload: any = { title };
      if (selectedVipTemplates.length > 0) {
        payload.vipTemplateNames = selectedVipTemplates.map((t: any) => t.name);
      } else {
        payload.content = { sheets: [{ name: "Sheet1", cells: {}, rowCount: 500, colCount: 26, isVip: false }] };
      }

      const res = await apiClient.post("/api/v1/spreadsheets", payload);
      toast.success(selectedVipTemplates.length > 0 ? "Tạo trang tính VIP thành công!" : "Tạo trang tính thành công!");
      setNewDocModal({ show: false, title: "Tạo trang tính mới", defaultName: "Trang tính chưa có tên", action: () => {} });
      setShowVipSelectModal(false);
      window.location.href = `/admin/sheets/${res.data.data.id}`;
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const parseExcelToSheets = (buf: ArrayBuffer): Sheet[] => {
    const wb = XLSX.read(buf, { type: "array" });
    return wb.SheetNames.map(name => {
      const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[name], { header: 1, defval: "" });
      const cells: Record<string, CellData> = {};
      rows.forEach((row, r) => row.forEach((val, c) => {
        if (val !== undefined && val !== null && val !== "") {
          cells[`${numberToColLetter(c)}${r + 1}`] = { value: String(val), formula: "" };
        }
      }));
      return { name, cells, rowCount: Math.max(500, rows.length + 50), colCount: Math.max(26, rows.length ? Math.max(...rows.map(r => r.length)) + 5 : 0) };
    });
  };

  const handleExecuteImport = async () => {
    if (importedSheets.length === 0) return;
    if (importOption === "new_doc") {
      setNewDocModal({
        show: true, title: "Tạo từ Excel", defaultName: "Bảng tính mới", action: async (name) => {
          try {
            const res = await apiClient.post("/api/v1/spreadsheets", { title: name, content: { sheets: importedSheets } });
            setShowImportModal(false);
            navigate(`/admin/sheets/${res.data.data.id}`);
          } catch (e: any) { toast.error("Lỗi: " + e.message); }
        }
      });
    } else if (importOption === "new_sheet") {
      let updated: Sheet[] = [];
      state.updateSheetsAndSaveHistory((prev) => { updated = [...prev, ...importedSheets]; return updated; });
      state.setActiveSheetIdx(state.sheets.length);
      setShowImportModal(false);
      setTimeout(() => state.handleSave(updated), 200);
    } else {
      let updated: Sheet[] = [];
      state.updateSheetsAndSaveHistory((prev) => {
        const copy = [...prev];
        copy[state.activeSheetIdx] = { ...copy[state.activeSheetIdx], cells: importedSheets[0].cells, rowCount: Math.max(copy[state.activeSheetIdx].rowCount || 500, importedSheets[0].rowCount || 500), colCount: Math.max(copy[state.activeSheetIdx].colCount || 26, importedSheets[0].colCount || 26) };
        updated = copy;
        return copy;
      });
      setShowImportModal(false);
      setTimeout(() => state.handleSave(updated), 200);
    }
  };

  // Scan cells to find matching text
  React.useEffect(() => {
    if (!findText) {
      setSearchResults([]);
      setCurrentResultIdx(-1);
      return;
    }

    const results: Array<{ sheetIdx: number; address: string; value: string }> = [];
    const textToFind = matchCase ? findText : findText.toLowerCase();

    const scanSheet = (sIdx: number) => {
      const targetSheet = state.sheets[sIdx];
      if (!targetSheet) return;
      Object.entries(targetSheet.cells).forEach(([addr, cell]) => {
        const val = cell?.value || cell?.formula || "";
        const cellText = matchCase ? val : val.toLowerCase();
        if (cellText.includes(textToFind)) {
          results.push({ sheetIdx: sIdx, address: addr, value: val });
        }
      });
    };

    if (searchScope === "sheet") {
      scanSheet(state.activeSheetIdx);
    } else {
      for (let i = 0; i < state.sheets.length; i++) {
        if (!state.sheets[i].isHidden) {
          scanSheet(i);
        }
      }
    }

    // Sort matching results logically
    results.sort((a, b) => {
      if (a.sheetIdx !== b.sheetIdx) return a.sheetIdx - b.sheetIdx;
      const aAddr = parseCellAddress(a.address);
      const bAddr = parseCellAddress(b.address);
      if (!aAddr || !bAddr) return 0;
      if (aAddr.row !== bAddr.row) return aAddr.row - bAddr.row;
      const colA = colLetterToNumber(aAddr.col);
      const colB = colLetterToNumber(bAddr.col);
      return colA - colB;
    });

    setSearchResults(results);

    if (results.length > 0) {
      const currentSelected = state.selectedCell;
      const foundIdx = results.findIndex(r => r.sheetIdx === state.activeSheetIdx && r.address === currentSelected);
      if (foundIdx !== -1) {
        setCurrentResultIdx(foundIdx);
      } else {
        setCurrentResultIdx(0);
      }
    } else {
      setCurrentResultIdx(-1);
    }
  }, [findText, searchScope, matchCase, state.activeSheetIdx, state.sheets]);

  // Global Keyboard Shortcuts for Find and Replace
  React.useEffect(() => {
    const handleEditorKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === "f" && e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          setShowHeader(prev => !prev);
        } else if (key === "f") {
          e.preventDefault();
          e.stopPropagation();
          setShowFindReplace(true);
          setFindMode("find");
          setTimeout(() => {
            const input = document.querySelector(".find-replace-input") as HTMLInputElement;
            if (input) {
              input.focus();
              input.select();
            }
          }, 50);
        } else if (key === "h") {
          e.preventDefault();
          e.stopPropagation();
          setShowFindReplace(true);
          setFindMode("replace");
          setTimeout(() => {
            const input = document.querySelector(".find-replace-input") as HTMLInputElement;
            if (input) {
              input.focus();
              input.select();
            }
          }, 50);
        }
      } else if (e.key === "Escape") {
        if (showFindReplace) {
          e.preventDefault();
          setShowFindReplace(false);
        }
      }
    };

    window.addEventListener("keydown", handleEditorKeyDown, true);
    return () => window.removeEventListener("keydown", handleEditorKeyDown, true);
  }, [showFindReplace, showHeader]);

  const navigateToResult = (idx: number) => {
    if (idx < 0 || idx >= searchResults.length) return;
    const match = searchResults[idx];
    setCurrentResultIdx(idx);

    if (state.activeSheetIdx !== match.sheetIdx) {
      state.setActiveSheetIdx(match.sheetIdx);
    }
    state.setSelectedCell(match.address);
    state.setSelectedRange({ start: match.address, end: match.address });

    setTimeout(() => {
      const cellEl = document.querySelector(`.sheet-cell[data-address="${match.address}"]`);
      if (cellEl) {
        cellEl.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      }
    }, 50);
  };

  const handleFindNext = () => {
    if (searchResults.length === 0) {
      toast.info("Không tìm thấy kết quả phù hợp!");
      return;
    }
    const nextIdx = (currentResultIdx + 1) % searchResults.length;
    navigateToResult(nextIdx);
  };

  const handleFindPrev = () => {
    if (searchResults.length === 0) {
      toast.info("Không tìm thấy kết quả phù hợp!");
      return;
    }
    const prevIdx = (currentResultIdx - 1 + searchResults.length) % searchResults.length;
    navigateToResult(prevIdx);
  };

  const handleReplace = () => {
    if (searchResults.length === 0 || currentResultIdx === -1) {
      toast.info("Không có kết quả nào để thay thế!");
      return;
    }
    const match = searchResults[currentResultIdx];
    const targetSheet = state.sheets[match.sheetIdx];
    if (!targetSheet) return;
    const cell = targetSheet.cells[match.address];
    const val = cell?.value || cell?.formula || "";

    const regex = new RegExp(findText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), matchCase ? "g" : "gi");
    const newVal = val.replace(regex, replaceText);

    state.updateSheetsAndSaveHistory((prev) => {
      const newSheets = [...prev];
      const sheetCopy = { ...newSheets[match.sheetIdx] };
      const currentCell = sheetCopy.cells[match.address] || { value: "", formula: "" };
      sheetCopy.cells = {
        ...sheetCopy.cells,
        [match.address]: {
          ...currentCell,
          value: newVal.startsWith("=") ? "" : newVal,
          formula: newVal.startsWith("=") ? newVal : ""
        }
      };
      newSheets[match.sheetIdx] = sheetCopy;
      return newSheets;
    });

    toast.success(`Đã thay thế tại ô ${match.address}`);
    setTimeout(() => {
      handleFindNext();
    }, 100);
  };

  const handleReplaceAll = () => {
    if (searchResults.length === 0) {
      toast.info("Không tìm thấy kết quả nào để thay thế!");
      return;
    }

    state.updateSheetsAndSaveHistory((prev) => {
      const newSheets = [...prev];
      const regex = new RegExp(findText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), matchCase ? "g" : "gi");
      let count = 0;

      searchResults.forEach(match => {
        const sheetCopy = newSheets[match.sheetIdx];
        if (!sheetCopy) return;
        const cell = sheetCopy.cells[match.address];
        const val = cell?.value || cell?.formula || "";
        const newVal = val.replace(regex, replaceText);

        sheetCopy.cells[match.address] = {
          ...cell,
          value: newVal.startsWith("=") ? "" : newVal,
          formula: newVal.startsWith("=") ? newVal : ""
        };
        count++;
      });

      toast.success(`Đã thay thế thành công ${count} kết quả.`);
      return newSheets;
    });
  };

  const activeCellStyle = (() => {
    const addrs = state.getSelectedAddresses();
    if (addrs.length === 0) return null;
    const first = state.cells[addrs[0]] || { value: "", formula: "" };
    const common: CellData = { ...first, fontFamily: first.fontFamily || "Times New Roman", fontSize: first.fontSize || "13px" };
    for (let i = 1; i < addrs.length; i++) {
      const cell = state.cells[addrs[i]] || { value: "", formula: "" };
      if (cell.bold !== common.bold) delete common.bold;
      if (cell.italic !== common.italic) delete common.italic;
      if (cell.underline !== common.underline) delete common.underline;
      if (cell.strikethrough !== common.strikethrough) delete common.strikethrough;
      if (cell.color !== common.color) delete common.color;
      if (cell.bg !== common.bg) delete common.bg;
      if (cell.align !== common.align) delete common.align;
      if ((cell.fontFamily || "Times New Roman") !== common.fontFamily) delete common.fontFamily;
      if ((cell.fontSize || "13px") !== common.fontSize) delete common.fontSize;
    }
    return common;
  })();

  return (
    <div className="sheet-editor-container">
      {showHeader && <SpreadsheetHeader
        title={state.title} setTitle={state.setTitle} isStarred={state.isStarred}
        setIsStarred={(star) => { state.setIsStarred(star); state.updateSheetsAndSaveHistory(p => p); }}
        isSaving={isSaving} onBack={onBack} onSave={() => state.updateSheetsAndSaveHistory(p => p)}
        onImportExcelClick={() => document.getElementById("excel-import-file-input")?.click()}
        handleExportJSON={() => {
          const link = document.createElement("a");
          link.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ title: state.title, sheets: state.sheets }));
          link.download = `${state.title || "workbook"}.json`;
          link.click();
        }}
        handleExportCSV={() => { exportToCsvOrTsv("csv", state.title, state.cells); toast.success("Đã xuất CSV!"); }}
        onUndo={state.handleUndo}
        onRedo={state.handleRedo}
        onCut={state.cutSelection}
        onCopy={state.copySelection}
        onPaste={() => state.pasteClipboard("all")}
        onPasteSpecial={state.pasteClipboard}
        onToggleFindReplace={() => setShowFindReplace(!showFindReplace)}
        onInsertRow={(pos) => state.selectedCell ? state.insertRow(parseCellAddress(state.selectedCell)!.row, pos) : state.insertRow(state.rowCount, pos)}
        onInsertCol={(pos) => state.selectedCell ? state.insertColumn(parseCellAddress(state.selectedCell)!.col, pos) : state.insertColumn(numberToColLetter(state.colCount - 1), pos)}
        onInsertFormula={state.insertFormula} onApplyStyle={state.handleToolbarStyleChange} onOpenHelp={() => setShowHelpModal(true)}
        onNewSpreadsheet={() => setNewDocModal({
          show: true, title: "Tạo trang tính mới", defaultName: "Trang tính chưa có tên", action: async (trimmed) => {
            setPendingDocName(trimmed);
            try {
              const res = await apiClient.get("/api/v1/spreadsheets/vip-templates/list");
              const templates = (res.data.data || []).map((t: any) => ({
                ...t.content,
                id: t.id
              }));

              if (templates.length > 0) {
                setVipTemplates(templates);
                setShowVipSelectModal(true);
              } else {
                await performCreateNewSpreadsheet(trimmed, []);
              }
            } catch (err: any) {
              await performCreateNewSpreadsheet(trimmed, []);
            }
          }
        })}
        onOpenSpreadsheet={handleOpenSpreadsheetModal}
        onMakeCopy={async () => {
          try {
            const res = await apiClient.post("/api/v1/spreadsheets", { title: `${state.title} - Bản sao`, content: { sheets: state.sheets } });
            window.location.href = `/admin/sheets/${res.data.data.id}`;
          } catch (e: any) { toast.error(e.message); }
        }}
        onShare={() => { navigator.clipboard.writeText(window.location.href); toast.success("Đã sao chép liên kết!"); }}
        onEmail={() => { window.location.href = `mailto:?subject=${state.title}&body=${window.location.href}`; }}
        onDownload={(type) => type === "xlsx" ? exportToXlsx(state.title, state.sheets) : type === "pdf" ? setShowPrintModal(true) : exportToCsvOrTsv(type, state.title, state.cells)}
        onRename={() => document.getElementById("sheet-title-input-el")?.focus()}
        onMoveToTrash={async () => {
          if (confirm("Xóa tài liệu và chuyển vào thùng rác?")) {
            try { await apiClient.delete(`/api/v1/spreadsheets/${sheetId}`); onBack(); } catch { toast.error("Lỗi xóa tài liệu!"); }
          }
        }}
        onVersionHistory={() => setShowVersionHistoryModal(true)} onShowDetails={() => setShowDetailsModal(true)}
        sheets={state.sheets} onUnhideSheet={(idx) => {
          state.updateSheetsAndSaveHistory(prev => { const copy = [...prev]; copy[idx] = { ...copy[idx], isHidden: false }; return copy; });
          state.setActiveSheetIdx(idx);
        }}
        showFormulaBar={state.showFormulaBar}
        setShowFormulaBar={state.setShowFormulaBar}
        showGridlines={state.showGridlines}
        setShowGridlines={state.setShowGridlines}
        showFormulas={state.showFormulas}
        setShowFormulas={state.setShowFormulas}
        freezeRows={state.freezeRows}
        setFreezeRows={state.setFreezeRows}
        freezeCols={state.freezeCols}
        setFreezeCols={state.setFreezeCols}
        onSortSheet={(dir) => { if (state.selectedCell) { const col = parseCellAddress(state.selectedCell)!.col; state.sortActiveSheet(col, dir); } }}
        onTrimWhitespace={state.trimWhitespace}
        onRemoveEmptyRows={state.removeEmptyRows}
        selectedCell={state.selectedCell}
        onDeleteRow={(rowNum) => state.deleteRow(rowNum)}
        onDeleteCol={(colLetter) => state.deleteColumn(colLetter)}
        onClearValues={() => {
          const addresses = state.getSelectedAddresses();
          if (addresses.length === 0) return;
          state.updateSheetsAndSaveHistory((prev) => {
            const newSheets = [...prev];
            const targetSheet = { ...newSheets[state.activeSheetIdx] };
            addresses.forEach((addr) => {
              targetSheet.cells[addr] = { value: "", formula: "" };
            });
            newSheets[state.activeSheetIdx] = targetSheet;
            return newSheets;
          });
        }}
        onFormatSelection={state.formatSelection}
        onAlignChange={state.handleAlignChange}
        onRemoveDuplicates={state.removeDuplicates}
        onClearFormatting={state.clearFormatting}
        commonFormulas={state.commonFormulas}
        addCommonFormula={state.addCommonFormula}
        updateCommonFormula={state.updateCommonFormula}
        deleteCommonFormula={state.deleteCommonFormula}
        applyCommonFormula={state.applyCommonFormula}
      />}

      <SpreadsheetToolbar
        activeCell={activeCellStyle} zoomLevel={state.zoomLevel} setZoomLevel={state.setZoomLevel}
        showFindReplace={showFindReplace} setShowFindReplace={setShowFindReplace}
        handleUndo={state.handleUndo} handleRedo={state.handleRedo}
        canUndo={state.canUndo} canRedo={state.canRedo}
        handleFontChange={state.handleFontChange} handleToolbarStyleChange={state.handleToolbarStyleChange}
        handleAlignChange={state.handleAlignChange} handleColorChange={(key, value) => state.handleColorChange(key === "color" ? "text" : "bg", value)}
        onFormatSelection={state.formatSelection} onInsertFormula={state.insertFormula}
        onInsertLink={() => {
          if (state.selectedCell) {
            setShowLinkModal({ address: state.selectedCell, defaultText: state.cells[state.selectedCell]?.value || "" });
          } else {
            toast.warn("Vui lòng chọn một ô trước khi chèn liên kết!");
          }
        }}
        onCreateFilter={() => {
          if (state.selectedCell) {
            const match = state.selectedCell.match(/^([A-Z]+)([0-9]+)$/);
            if (match) {
              setShowFilterModal({ colLetter: match[1] });
            }
          } else {
            toast.warn("Vui lòng chọn một ô trước khi tạo bộ lọc!");
          }
        }}
      />

      {showFindReplace && (
        <div className="find-replace-panel">
          <div className="find-replace-title">
            <div className="flex gap-2">
              <button 
                className={`text-xs pb-1 font-semibold border-b-2 transition-colors ${findMode === "find" ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent text-gray-400"}`}
                onClick={() => setFindMode("find")}
              >
                Tìm kiếm
              </button>
              <button 
                className={`text-xs pb-1 font-semibold border-b-2 transition-colors ${findMode === "replace" ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent text-gray-400"}`}
                onClick={() => setFindMode("replace")}
              >
                Thay thế
              </button>
            </div>
            <button onClick={() => setShowFindReplace(false)} className="text-gray-400 hover:text-gray-200">
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex flex-col gap-2 mt-1">
            <div className="relative flex items-center">
              <input 
                type="text" 
                className="find-replace-input w-full pr-16" 
                placeholder="Tìm..." 
                value={findText} 
                onChange={e => setFindText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (e.shiftKey) {
                      handleFindPrev();
                    } else {
                      handleFindNext();
                    }
                  }
                }}
              />
              <span className="absolute right-2 text-[10px] text-gray-400 pointer-events-none select-none">
                {searchResults.length > 0 ? `${currentResultIdx + 1}/${searchResults.length}` : "0/0"}
              </span>
            </div>

            {findMode === "replace" && (
              <input 
                type="text" 
                className="find-replace-input" 
                placeholder="Thay thế bằng..." 
                value={replaceText} 
                onChange={e => setReplaceText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleReplace();
                  }
                }}
              />
            )}

            <div className="flex items-center justify-between text-[11px] text-gray-400 mt-1 select-none">
              <div className="flex items-center gap-1">
                <input 
                  type="checkbox" 
                  id="find-match-case" 
                  checked={matchCase} 
                  onChange={e => setMatchCase(e.target.checked)} 
                  className="rounded border-gray-600 bg-gray-700 text-[var(--accent)] focus:ring-0 w-3 h-3 cursor-pointer"
                />
                <label htmlFor="find-match-case" className="cursor-pointer">Khớp hoa/thường</label>
              </div>

              <select 
                value={searchScope} 
                onChange={e => setSearchScope(e.target.value as "sheet" | "workbook")}
                className="bg-[var(--bg-3)] border border-[var(--border)] text-gray-300 rounded px-1 py-0.5 text-[11px] outline-none cursor-pointer"
              >
                <option value="sheet">Trang này</option>
                <option value="workbook">Toàn bộ</option>
              </select>
            </div>

            <div className="find-replace-actions mt-2 pt-2 border-t border-[var(--border)]">
              <div className="flex gap-1 mr-auto">
                <button 
                  onClick={handleFindPrev} 
                  className="btn-find-action secondary p-1" 
                  title="Kết quả trước"
                  disabled={searchResults.length === 0}
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={handleFindNext} 
                  className="btn-find-action secondary p-1" 
                  title="Kết quả tiếp theo"
                  disabled={searchResults.length === 0}
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              {findMode === "replace" ? (
                <>
                  <button 
                    onClick={handleReplace} 
                    className="btn-find-action secondary"
                    disabled={searchResults.length === 0}
                  >
                    Thay thế
                  </button>
                  <button 
                    onClick={handleReplaceAll} 
                    className="btn-find-action primary"
                    disabled={searchResults.length === 0}
                  >
                    Tất cả
                  </button>
                </>
              ) : (
                <button 
                  onClick={handleFindNext} 
                  className="btn-find-action primary"
                  disabled={searchResults.length === 0}
                >
                  Tìm tiếp
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {state.showFormulaBar && (
        <div className="sheet-formula-bar">
          <div className="formula-cell-address">{state.selectedCell || ""}</div>
          <div className="formula-icon-fx">fx</div>
          <input
            type="text" className="formula-input" value={state.formulaValue} onChange={state.handleFormulaInputChange}
            placeholder="Nhập giá trị hoặc công thức (ví dụ: =SUM(A1:A5))" disabled={!state.selectedCell}
          />
        </div>
      )}

      <div style={{ zoom: state.zoomLevel === "100%" ? undefined : parseFloat(state.zoomLevel) / 100, overflow: "auto", flex: 1 }}>
        <SpreadsheetGrid
          cells={state.cells} selectedCell={state.selectedCell} onSelectCell={state.setSelectedCell}
          selectedRange={state.selectedRange} onSelectRange={state.setSelectedRange} onUpdateCell={state.handleUpdateCell}
          rowCount={state.rowCount} colCount={state.colCount} onUndo={state.handleUndo}
          onRedo={state.handleRedo}
          onInsertRow={state.insertRow} onInsertCol={state.insertColumn} onDeleteRow={state.deleteRow} onDeleteCol={state.deleteColumn}
          onClearRow={state.clearRow} onClearCol={state.clearColumn} rowHeights={state.sheets[state.activeSheetIdx]?.rowHeights}
          colWidths={state.sheets[state.activeSheetIdx]?.colWidths} onUpdateRowHeight={state.handleUpdateRowHeight} onUpdateColWidth={state.handleUpdateColWidth}
          showGridlines={state.showGridlines} showFormulas={state.showFormulas} freezeRows={state.freezeRows} freezeCols={state.freezeCols}
          onCopy={state.copySelection} onPaste={() => state.pasteClipboard("all")} onCut={state.cutSelection}
          onPasteSpecial={state.pasteClipboard}
          onShiftCells={state.handleShiftCells}
          onDeleteCellsAndShift={state.handleDeleteCellsAndShift}
          hiddenRows={state.sheets[state.activeSheetIdx]?.hiddenRows}
          onConvertToTable={state.handleConvertToTable}
          onCreateFilter={state.handleCreateFilter}
          onFilterByCellValue={state.handleFilterByCellValue}
          onTriggerLinkModal={(addr) => setShowLinkModal({ address: addr, defaultText: state.cells[addr]?.value || "" })}
          onTriggerFilterModal={(colLetter) => setShowFilterModal({ colLetter })}
          filters={state.sheets[state.activeSheetIdx]?.filters}
        />
      </div>

      <div className="add-rows-panel">
        <span>Thêm</span>
        <input type="number" className="add-rows-input" value={state.addRowsNum} onChange={e => state.setAddRowsNum(Math.max(1, parseInt(e.target.value, 10) || 1))} />
        <span>hàng khác ở dưới cùng</span>
        <button onClick={state.handleAddRows} className="btn-add-rows">Thêm</button>
      </div>

      <div className="sheet-bottom-bar" onContextMenu={e => e.preventDefault()}>
        {state.sheets.map((sheet, idx) => !sheet.isHidden && (
          <div
            key={idx} className={`sheet-tab ${state.activeSheetIdx === idx ? "active" : ""}`}
            style={{ borderLeftColor: (sheet as any).color ? (sheet as any).color : undefined, borderLeftWidth: (sheet as any).color ? "4px" : undefined }}
            onClick={() => { state.setActiveSheetIdx(idx); state.setSelectedCell(null); state.setSelectedRange(null); }}
            onDoubleClick={() => setRenameSheetModal({ idx, name: sheet.name })}
            onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setTabContextMenu({ idx, x: e.clientX, y: e.clientY }); }}
          >
            <span className="flex items-center gap-1">
              {sheet.name}
              {sheet.isVip && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30 ml-1">⭐ VIP</span>}
            </span>
            {sheet.isProtected ? (
              <button className="btn-tab-close cursor-default"><Lock className="w-3 h-3 text-amber-500" /></button>
            ) : (
              visibleSheetsCount > 1 && <button className="btn-tab-close" onClick={e => { e.stopPropagation(); setDeleteSheetModal({ idx, name: sheet.name }); }}><X className="w-3 h-3" /></button>
            )}
          </div>
        ))}
        <button onClick={state.handleAddSheet} className="btn-add-tab"><Plus className="w-3.5 h-3.5" /></button>
      </div>

      <TabContextMenu
        tabContextMenu={tabContextMenu} onClose={() => setTabContextMenu(null)} sheets={state.sheets}
        visibleSheetsCount={visibleSheetsCount} updateSheetsAndSaveHistory={state.updateSheetsAndSaveHistory}
        setActiveSheetIdx={state.setActiveSheetIdx} setDeleteSheetModal={setDeleteSheetModal}
        setRenameSheetModal={setRenameSheetModal} handleSave={state.handleSave}
      />

      <HelpShortcutsModal show={showHelpModal} onClose={() => setShowHelpModal(false)} />
      <OpenSpreadsheetModal show={showOpenModal} onClose={() => setShowOpenModal(false)} loading={loadingOtherSheets} list={otherSheetsList} />
      <VersionHistoryModal
        show={showVersionHistoryModal} onClose={() => setShowVersionHistoryModal(false)} history={state.history}
        onRestore={(sheets, timestamp) => { state.updateSheetsAndSaveHistory(sheets); setShowVersionHistoryModal(false); toast.success(`Khôi phục: ${timestamp}`); }}
      />
      <DocumentDetailsModal show={showDetailsModal} onClose={() => setShowDetailsModal(false)} title={state.title} sheetsCount={state.sheets.length} cellsCount={Object.keys(state.cells).length} />
      <RenameSheetModal
        show={!!renameSheetModal} onClose={() => setRenameSheetModal(null)} name={renameSheetModal?.name || ""}
        setName={name => renameSheetModal && setRenameSheetModal({ ...renameSheetModal, name })}
        onConfirm={() => {
          if (renameSheetModal) {
            let u: Sheet[] = [];
            state.updateSheetsAndSaveHistory(prev => { const c = [...prev]; c[renameSheetModal.idx] = { ...c[renameSheetModal.idx], name: renameSheetModal.name.trim() }; u = c; return c; });
            setRenameSheetModal(null);
            setTimeout(() => state.handleSave(u), 100);
          }
        }}
      />
      <DeleteSheetModal
        show={!!deleteSheetModal} onClose={() => setDeleteSheetModal(null)} name={deleteSheetModal?.name || ""}
        onConfirm={() => {
          if (deleteSheetModal) {
            let u: Sheet[] = [];
            state.updateSheetsAndSaveHistory(prev => { const f = prev.filter((_, i) => i !== deleteSheetModal.idx); u = f; return f; });
            state.setActiveSheetIdx(p => Math.max(0, p - 1));
            state.setSelectedCell(null);
            state.setSelectedRange(null);
            setDeleteSheetModal(null);
            setTimeout(() => state.handleSave(u), 100);
          }
        }}
      />
      <ExcelImportModal show={showImportModal} onClose={() => setShowImportModal(false)} importOption={importOption} setImportOption={setImportOption} onExecuteImport={handleExecuteImport} />
      <NewDocModal show={newDocModal.show} onClose={() => setNewDocModal({ ...newDocModal, show: false })} title={newDocModal.title} name={newDocModal.defaultName} setName={name => setNewDocModal({ ...newDocModal, defaultName: name })} onConfirm={() => { newDocModal.action(newDocModal.defaultName.trim()); setNewDocModal({ ...newDocModal, show: false }); }} />
      <PrintSettingsModal show={showPrintModal} onClose={() => setShowPrintModal(false)} title={state.title} sheets={state.sheets} activeSheetIdx={state.activeSheetIdx} />
      <SelectVipSheetsModal
        show={showVipSelectModal}
        onClose={() => setShowVipSelectModal(false)}
        templates={vipTemplates}
        onConfirm={(selected) => performCreateNewSpreadsheet(pendingDocName, selected)}
        onCancelCreation={() => {
          setShowVipSelectModal(false);
          setNewDocModal({ show: false, title: "Tạo trang tính mới", defaultName: "Trang tính chưa có tên", action: () => {} });
        }}
      />
      <input type="file" id="excel-open-file-input" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelOpenChange} />
      <input type="file" id="excel-import-file-input" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelImportChange} />

      <LinkInsertModal
        show={!!showLinkModal}
        onClose={() => setShowLinkModal(null)}
        defaultText={showLinkModal?.defaultText || ""}
        onConfirm={(text, url) => {
          if (showLinkModal) {
            state.handleUpdateCell(showLinkModal.address, { value: text || url, link: url });
            toast.success("Đã chèn liên kết!");
          }
        }}
      />

      <FilterModal
        show={!!showFilterModal}
        onClose={() => setShowFilterModal(null)}
        colLetter={showFilterModal?.colLetter || ""}
        cells={state.cells}
        rowCount={state.rowCount}
        currentFilter={showFilterModal ? state.sheets[state.activeSheetIdx]?.filters?.[showFilterModal.colLetter] : undefined}
        onConfirm={(filterConfig) => {
          if (showFilterModal) {
            state.handleCreateFilter(showFilterModal.colLetter, filterConfig);
          }
        }}
        onSort={(dir) => {
          if (showFilterModal) {
            state.sortActiveSheet(showFilterModal.colLetter, dir);
          }
        }}
      />
    </div>
  );
};

export default SpreadsheetEditor;
