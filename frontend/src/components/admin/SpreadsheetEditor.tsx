// frontend/src/components/admin/SpreadsheetEditor.tsx
import React, { useState } from "react";
import { X, Plus, Lock } from "lucide-react";
import { SpreadsheetGrid } from "./SpreadsheetGrid.js";
import { parseCellAddress, numberToColLetter } from "../../utils/formulaEvaluator.js";
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
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [tabContextMenu, setTabContextMenu] = useState<{ idx: number; x: number; y: number } | null>(null);

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

  const handleFind = () => {
    if (!findText) return;
    const addr = Object.keys(state.cells).find(a => (state.cells[a]?.value || state.cells[a]?.formula || "").toLowerCase().includes(findText.toLowerCase()));
    if (addr) {
      state.setSelectedCell(addr);
      state.setSelectedRange({ start: addr, end: addr });
      document.querySelector(`.sheet-cell.selected`)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    } else { alert("Không tìm thấy kết quả!"); }
  };

  const handleReplace = () => {
    if (!state.selectedCell || !findText) return;
    const cell = state.cells[state.selectedCell];
    const val = cell?.value || cell?.formula || "";
    if (val.toLowerCase().includes(findText.toLowerCase())) {
      const newVal = val.replace(new RegExp(findText, "gi"), replaceText);
      state.handleUpdateCell(state.selectedCell, { value: newVal.startsWith("=") ? "" : newVal, formula: newVal.startsWith("=") ? newVal : "" });
    }
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
      <SpreadsheetHeader
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
            try {
              const confirmVip = await confirmModal({
                title: "Loại trang tính",
                message: "Bạn có muốn tạo trang tính VIP không?",
                confirmText: "Có (VIP)",
                cancelText: "Không (Thường)",
                type: "info",
              });
              const res = await apiClient.post("/api/v1/spreadsheets", { title: trimmed, content: { sheets: [{ name: "Sheet1", cells: {}, rowCount: 500, colCount: 26, isVip: confirmVip }] } });
              navigate(`/admin/sheets/${res.data.data.id}`);
            } catch (e: any) { toast.error(e.message); }
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
      />

      <SpreadsheetToolbar
        activeCell={activeCellStyle} zoomLevel={state.zoomLevel} setZoomLevel={state.setZoomLevel}
        showFindReplace={showFindReplace} setShowFindReplace={setShowFindReplace}
        handleUndo={state.handleUndo} handleRedo={state.handleRedo}
        canUndo={state.canUndo} canRedo={state.canRedo}
        handleFontChange={state.handleFontChange} handleToolbarStyleChange={state.handleToolbarStyleChange}
        handleAlignChange={state.handleAlignChange} handleColorChange={(key, value) => state.handleColorChange(key === "color" ? "text" : "bg", value)}
        onFormatSelection={state.formatSelection} onInsertFormula={state.insertFormula}
      />

      {showFindReplace && (
        <div className="find-replace-panel">
          <div className="find-replace-title"><span>Tìm kiếm & Thay thế</span><button onClick={() => setShowFindReplace(false)}><X className="w-4 h-4" /></button></div>
          <input type="text" className="find-replace-input" placeholder="Tìm..." value={findText} onChange={e => setFindText(e.target.value)} />
          <input type="text" className="find-replace-input" placeholder="Thay thế..." value={replaceText} onChange={e => setReplaceText(e.target.value)} />
          <div className="find-replace-actions">
            <button onClick={handleFind} className="btn-find-action secondary">Tìm</button>
            <button onClick={handleReplace} className="btn-find-action primary">Thay thế</button>
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
              <button className="btn-tab-close" style={{ cursor: "default" }}><Lock className="w-3 h-3 text-amber-500" /></button>
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
      <input type="file" id="excel-open-file-input" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={handleExcelOpenChange} />
      <input type="file" id="excel-import-file-input" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={handleExcelImportChange} />
    </div>
  );
};

export default SpreadsheetEditor;
