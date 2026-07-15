// frontend/src/components/admin/SpreadsheetGrid.tsx
import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { 
  evaluateFormula, numberToColLetter, parseCellAddress, colLetterToNumber 
} from "../../utils/formulaEvaluator.js";
import { GridCell } from "./GridCell.js";
import { useGridResize } from "../../hooks/useGridResize.js";
import { GridContextMenu } from "./GridContextMenu.js";
import { LinkInsertModal, FilterModal } from "./modals/SpreadsheetModals.js";
import { Filter } from "lucide-react";

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

interface SpreadsheetGridProps {
  cells: Record<string, CellData>;
  selectedCell: string | null;
  onSelectCell: (address: string) => void;
  selectedRange: { start: string; end: string } | null;
  onSelectRange: (range: { start: string; end: string } | null) => void;
  onUpdateCell: (address: string, data: Partial<CellData>) => void;
  rowCount: number;
  colCount: number;
  onUndo: () => void;
  onInsertRow: (atRow: number, position: "above" | "below") => void;
  onInsertCol: (atColLetter: string, position: "left" | "right") => void;
  onDeleteRow: (atRow: number) => void;
  onDeleteCol: (atColLetter: string) => void;
  onClearRow: (atRow: number) => void;
  onClearCol: (atColLetter: string) => void;
  rowHeights?: Record<number, number>;
  colWidths?: Record<string, number>;
  onUpdateRowHeight: (rowNum: number, height: number) => void;
  onUpdateColWidth: (colLetter: string, width: number) => void;
  showGridlines: boolean;
  showFormulas: boolean;
  freezeRows: number;
  freezeCols: number;
  onCopy: () => void;
  onPaste: () => void;
  onCut: () => void;
  onRedo: () => void;
  onPasteSpecial?: (option: "value" | "format") => void;
  onShiftCells?: (direction: "down" | "right") => void;
  onDeleteCellsAndShift?: (direction: "up" | "left") => void;
  hiddenRows?: Record<number, boolean>;
  onConvertToTable?: () => void;
  onCreateFilter?: (colLetter: string, val: string) => void;
  onFilterByCellValue?: () => void;
  onTriggerLinkModal?: (address: string) => void;
  onTriggerFilterModal?: (colLetter: string) => void;
  filters?: Record<string, any>;
}

export const SpreadsheetGrid: React.FC<SpreadsheetGridProps> = ({
  cells,
  selectedCell,
  onSelectCell,
  selectedRange,
  onSelectRange,
  onUpdateCell,
  rowCount,
  colCount,
  onUndo,
  onRedo,
  onInsertRow,
  onInsertCol,
  onDeleteRow,
  onDeleteCol,
  onClearRow,
  onClearCol,
  rowHeights,
  colWidths,
  onUpdateRowHeight,
  onUpdateColWidth,
  showGridlines,
  showFormulas,
  freezeRows,
  freezeCols,
  onCopy,
  onPaste,
  onCut,
  onPasteSpecial,
  onShiftCells,
  onDeleteCellsAndShift,
  hiddenRows,
  onConvertToTable,
  onCreateFilter,
  onFilterByCellValue,
  onTriggerLinkModal,
  onTriggerFilterModal,
  filters,
}) => {
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const isMouseDownRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: "row" | "col" | "cell"; index: number } | null>(null);
  const [hoveredLink, setHoveredLink] = useState<{ address: string; link: string; rect: any } | null>(null);

  // Resize hook
  const { startColResize, startRowResize } = useGridResize(
    containerRef,
    colWidths,
    rowHeights,
    onUpdateColWidth,
    onUpdateRowHeight
  );

  useEffect(() => {
    const handleDocumentClick = () => setContextMenu(null);
    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, []);

  const handleColHeaderClick = (colIdx: number) => {
    const colLetter = numberToColLetter(colIdx);
    const startCell = `${colLetter}1`;
    const endCell = `${colLetter}${rowCount}`;
    onSelectCell(startCell);
    onSelectRange({ start: startCell, end: endCell });
    
    containerRef.current?.querySelectorAll(".sheet-cell").forEach((el) => {
      const cellEl = el as HTMLElement;
      if (parseInt(cellEl.dataset.col || "0", 10) === colIdx) {
        cellEl.classList.add("in-range");
      } else {
        cellEl.classList.remove("in-range");
      }
    });
  };

  const handleRowHeaderClick = (rowNum: number) => {
    const lastColLetter = numberToColLetter(colCount - 1);
    const startCell = `A${rowNum}`;
    const endCell = `${lastColLetter}${rowNum}`;
    onSelectCell(startCell);
    onSelectRange({ start: startCell, end: endCell });
    
    containerRef.current?.querySelectorAll(".sheet-cell").forEach((el) => {
      const cellEl = el as HTMLElement;
      if (parseInt(cellEl.dataset.row || "0", 10) === rowNum) {
        cellEl.classList.add("in-range");
      } else {
        cellEl.classList.remove("in-range");
      }
    });
  };

  const handleColHeaderContextMenu = (e: React.MouseEvent, colIdx: number) => {
    e.preventDefault();
    handleColHeaderClick(colIdx);
    setContextMenu({ x: e.clientX, y: e.clientY, type: "col", index: colIdx });
  };

  const handleRowHeaderContextMenu = (e: React.MouseEvent, rowNum: number) => {
    e.preventDefault();
    handleRowHeaderClick(rowNum);
    setContextMenu({ x: e.clientX, y: e.clientY, type: "row", index: rowNum });
  };

  const handleCellContextMenu = (address: string, colIdx: number, rowNum: number, e: React.MouseEvent) => {
    e.preventDefault();
    onSelectCell(address);
    setContextMenu({ x: e.clientX, y: e.clientY, type: "cell", index: rowNum, colIndex: colIdx, address });
  };

  const handleClearCell = (address: string) => {
    onUpdateCell(address, { value: "", formula: "" });
  };

  const dragStartRef = useRef<{ col: number; row: number } | null>(null);
  const dragEndRef = useRef<string | null>(null);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isMouseDownRef.current && dragStartRef.current && dragEndRef.current) {
        onSelectRange({
          start: `${numberToColLetter(dragStartRef.current.col)}${dragStartRef.current.row}`,
          end: dragEndRef.current,
        });
      }
      isMouseDownRef.current = false;
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [onSelectRange]);

  const handleCellMouseDown = React.useCallback((address: string, colIdx: number, rowNum: number, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isMouseDownRef.current = true;
    dragStartRef.current = { col: colIdx, row: rowNum };
    dragEndRef.current = address;
    onSelectCell(address);
    containerRef.current?.querySelectorAll(".sheet-cell").forEach(el => el.classList.remove("in-range"));
    containerRef.current?.focus();
  }, [onSelectCell]);

  const handleCellMouseEnter = React.useCallback((address: string, colIdx: number, rowNum: number, e: React.MouseEvent) => {
    // 1. Kiểm tra hiển thị tooltip link khi hover
    const cellData = cells[address];
    if (cellData?.link) {
      const rect = e.currentTarget.getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (containerRect) {
        setHoveredLink({
          address,
          link: cellData.link,
          rect: {
            left: rect.left - containerRect.left + (containerRef.current?.scrollLeft || 0),
            top: rect.top - containerRect.top + (containerRef.current?.scrollTop || 0) + rect.height,
            width: rect.width,
            height: rect.height,
          }
        });
      }
    } else {
      setHoveredLink(null);
    }

    // 2. Kéo chọn vùng
    if (isMouseDownRef.current && dragStartRef.current) {
      dragEndRef.current = address;
      const start = dragStartRef.current;
      const minRow = Math.min(start.row, rowNum);
      const maxRow = Math.max(start.row, rowNum);
      const minCol = Math.min(start.col, colIdx);
      const maxCol = Math.max(start.col, colIdx);

      containerRef.current?.querySelectorAll(".sheet-cell").forEach((el) => {
        const cellEl = el as HTMLElement;
        const r = parseInt(cellEl.dataset.row || "0", 10);
        const c = parseInt(cellEl.dataset.col || "0", 10);
        if (r >= minRow && r <= maxRow && c >= minCol && c <= maxCol) {
          cellEl.classList.add("in-range");
        } else {
          cellEl.classList.remove("in-range");
        }
      });
    }
  }, [cells]);

  const handleContainerMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDownRef.current || !containerRef.current) return;
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const threshold = 40;
    const speed = 15;

    if (e.clientY > rect.bottom - threshold) container.scrollTop += speed;
    else if (e.clientY < rect.top + threshold) container.scrollTop -= speed;
    if (e.clientX > rect.right - threshold) container.scrollLeft += speed;
    else if (e.clientX < rect.left + threshold) container.scrollLeft -= speed;
  };

  const handleCellDoubleClick = React.useCallback((address: string) => {
    onSelectCell(address);
    onSelectRange({ start: address, end: address });
    setEditingCell(address);
  }, [onSelectCell, onSelectRange]);

  const handleCommitEdit = React.useCallback((address: string, newValue: string, moveDirection: "down" | "none") => {
    onUpdateCell(address, { value: newValue.startsWith("=") ? "" : newValue, formula: newValue.startsWith("=") ? newValue : "" });
    setEditingCell(null);

    if (moveDirection === "down") {
      const match = address.match(/^([A-Z]+)([0-9]+)$/);
      if (match) {
        const col = match[1];
        const row = parseInt(match[2], 10);
        if (row < rowCount) {
          const nextAddr = `${col}${row + 1}`;
          onSelectCell(nextAddr);
          onSelectRange({ start: nextAddr, end: nextAddr });
        }
      }
    }
  }, [onUpdateCell, rowCount, onSelectCell, onSelectRange]);

  const handleCancelEdit = React.useCallback(() => setEditingCell(null), []);



  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (editingCell) return;
      if (document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA" || document.activeElement.hasAttribute("contenteditable"))) return;

      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === "a") {
          e.preventDefault();
          onSelectCell("A1");
          onSelectRange({ start: "A1", end: `${numberToColLetter(colCount - 1)}${rowCount}` });
          containerRef.current?.querySelectorAll(".sheet-cell").forEach(el => el.classList.add("in-range"));
        } else if (key === "c") { e.preventDefault(); onCopy(); }
        else if (key === "v") { e.preventDefault(); onPaste(); }
        else if (key === "x") { e.preventDefault(); onCut(); }
        else if (key === "z") { e.preventDefault(); onUndo(); }
        else if (key === "y") { e.preventDefault(); onRedo(); }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [editingCell, colCount, rowCount, onSelectCell, onSelectRange, onUndo, onRedo, onCopy, onPaste, onCut]);

  const isCellInRange = (addr: string) => {
    if (!selectedRange) return false;
    const cell = parseCellAddress(addr);
    const start = parseCellAddress(selectedRange.start);
    const end = parseCellAddress(selectedRange.end);
    if (!cell || !start || !end) return false;

    const col = colLetterToNumber(cell.col);
    const startCol = colLetterToNumber(start.col);
    const endCol = colLetterToNumber(end.col);

    return col >= Math.min(startCol, endCol) && col <= Math.max(startCol, endCol) && cell.row >= Math.min(start.row, end.row) && cell.row <= Math.max(start.row, end.row);
  };

  const [renderedRowCount, setRenderedRowCount] = useState(() => Math.min(rowCount, 40));

  useEffect(() => {
    setRenderedRowCount(Math.min(rowCount, 40));
    const timer = setTimeout(() => setRenderedRowCount(rowCount), 50);
    return () => clearTimeout(timer);
  }, [rowCount]);

  const renderCells = () => {
    const tableRows = [];
    const cornerHeaderStyle: React.CSSProperties = {
      width: "40px", minWidth: "40px", maxWidth: "40px",
      position: "sticky", top: 0, left: 0, zIndex: 30
    };
    const headerCols = [<th key="corner" className="th-corner" style={cornerHeaderStyle}></th>];
    for (let c = 0; c < colCount; c++) {
      const colLetter = numberToColLetter(c);
      const colWidth = colWidths?.[colLetter] || 100;

      const isColFrozen = c < freezeCols;
      let stickyLeft = 0;
      if (isColFrozen) {
        let offset = 40;
        for (let prevC = 0; prevC < c; prevC++) {
          offset += colWidths?.[numberToColLetter(prevC)] || 100;
        }
        stickyLeft = offset;
      }

      const colHeaderStyle: React.CSSProperties = {
        width: `${colWidth}px`, minWidth: `${colWidth}px`, maxWidth: `${colWidth}px`,
        position: "sticky", top: 0,
        zIndex: isColFrozen ? 22 : 5
      };
      if (isColFrozen) {
        colHeaderStyle.left = `${stickyLeft}px`;
      }

      const hasFilter = !!filters?.[colLetter];
      headerCols.push(
        <th 
          key={colLetter} className={`th-col ${hasFilter ? "has-active-filter" : ""}`}
          style={colHeaderStyle}
          onClick={() => handleColHeaderClick(c)} onContextMenu={(e) => handleColHeaderContextMenu(e, c)}
        >
          <div className="th-col-content">
            <span className="col-letter">{colLetter}</span>
            <button 
              className={`col-filter-btn ${hasFilter ? "active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                if (onTriggerFilterModal) onTriggerFilterModal(colLetter);
              }}
              title={`Lọc cột ${colLetter}`}
            >
              <Filter className="w-3 h-3" />
            </button>
          </div>
          <span className="col-resize-handle" onMouseDown={(e) => startColResize(e, colLetter)} />
        </th>
      );
    }
    tableRows.push(<tr key="header-row" style={{ height: "25px" }}>{headerCols}</tr>);

    for (let r = 1; r <= renderedRowCount; r++) {
      if (hiddenRows?.[r]) continue;
      const rowHeight = rowHeights?.[r] || 25;

      const isRowFrozen = r <= freezeRows;
      let stickyTop = 0;
      if (isRowFrozen) {
        let offset = 25;
        for (let prevR = 1; prevR < r; prevR++) {
          offset += rowHeights?.[prevR] || 25;
        }
        stickyTop = offset;
      }

      const rowHeaderStyle: React.CSSProperties = {
        position: "sticky", left: 0,
        zIndex: isRowFrozen ? 21 : 5
      };
      if (isRowFrozen) {
        rowHeaderStyle.top = `${stickyTop}px`;
      }

      const rowCells = [
        <td 
          key={`row-header-${r}`} className="th-row" style={rowHeaderStyle}
          onClick={() => handleRowHeaderClick(r)} onContextMenu={(e) => handleRowHeaderContextMenu(e, r)}
        >
          {r}
          <span className="row-resize-handle" onMouseDown={(e) => startRowResize(e, r)} />
        </td>,
      ];

      for (let c = 0; c < colCount; c++) {
        const colLetter = numberToColLetter(c);
        const address = `${colLetter}${r}`;
        const cellData = cells[address];
        const displayValue = cellData ? (showFormulas ? (cellData.formula || cellData.value || "") : (cellData.formula ? evaluateFormula(cellData.formula, cells) : (cellData.value || ""))) : "";

        const isColFrozen = c < freezeCols;
        let stickyLeft = 0;
        if (isColFrozen) {
          let offset = 40;
          for (let prevC = 0; prevC < c; prevC++) {
            offset += colWidths?.[numberToColLetter(prevC)] || 100;
          }
          stickyLeft = offset;
        }

        const cellStyle: React.CSSProperties = {};
        if (isRowFrozen) {
          cellStyle.position = "sticky";
          cellStyle.top = `${stickyTop}px`;
          cellStyle.zIndex = isColFrozen ? 20 : 10;
        }
        if (isColFrozen) {
          cellStyle.position = "sticky";
          cellStyle.left = `${stickyLeft}px`;
          cellStyle.zIndex = isRowFrozen ? 20 : 9;
        }

        rowCells.push(
          <GridCell
            key={address} address={address} row={r} col={c} displayValue={displayValue} cellData={cellData}
            isSelected={selectedCell === address} isEditing={editingCell === address} inRange={isCellInRange(address)}
            onCellMouseDown={handleCellMouseDown} onCellMouseEnter={handleCellMouseEnter}
            onCellDoubleClick={handleCellDoubleClick}
            onCellContextMenu={handleCellContextMenu}
            onCommit={(val, dir) => handleCommitEdit(address, val, dir)} onCancel={handleCancelEdit}
            style={cellStyle}
          />
        );
      }
      tableRows.push(<tr key={`row-${r}`} style={{ height: `${rowHeight}px` }}>{rowCells}</tr>);
    }
    return tableRows;
  };

  const totalTableWidth = 40 + Array.from({ length: colCount }).reduce((acc: number, _, c) => acc + (colWidths?.[numberToColLetter(c)] || 100), 0);

  return (
    <div 
      ref={containerRef} className="sheet-grid-container" tabIndex={0}
      onMouseMove={handleContainerMouseMove} onMouseLeave={() => setHoveredLink(null)} style={{ outline: "none", position: "relative" }}
    >
      <table className={`sheet-table ${showGridlines ? "" : "hide-gridlines"}`} style={{ width: `${totalTableWidth}px`, tableLayout: "fixed" }}>
        <tbody>{renderCells()}</tbody>
      </table>

      <GridContextMenu
        contextMenu={contextMenu} onClose={() => setContextMenu(null)}
        handleCut={onCut} handleCopy={onCopy} handlePaste={onPaste}
        onInsertRow={onInsertRow} onDeleteRow={onDeleteRow} onClearRow={onClearRow} rowHeights={rowHeights} onUpdateRowHeight={onUpdateRowHeight}
        onInsertCol={onInsertCol} onDeleteCol={onDeleteCol} onClearCol={onClearCol} colWidths={colWidths} onUpdateColWidth={onUpdateColWidth}
        onClearCell={handleClearCell}
        onTriggerGemini={(addr) => toast.info(`Đang gọi Gemini AI phân tích và điền dữ liệu cho cột chứa ô ${addr}...`)}
        onShowCellHistory={(addr) => toast.info(`Lịch sử chỉnh sửa của ô ${addr} trống.`)}
        onInsertLink={(addr) => {
          if (onTriggerLinkModal) onTriggerLinkModal(addr);
        }}
        handlePasteSpecial={onPasteSpecial}
        onShiftCells={onShiftCells}
        onDeleteCellsAndShift={onDeleteCellsAndShift}
        onConvertToTable={onConvertToTable}
        onCreateFilter={() => {
          if (selectedCell) {
            const match = selectedCell.match(/^([A-Z]+)([0-9]+)$/);
            if (match && onTriggerFilterModal) {
              onTriggerFilterModal(match[1]);
            }
          }
        }}
        onFilterByCellValue={onFilterByCellValue}
      />

      {hoveredLink && (
        <div 
          className="sheets-link-popover"
          style={{
            position: "absolute",
            left: `${hoveredLink.rect.left}px`,
            top: `${hoveredLink.rect.top + 4}px`,
            zIndex: 1000,
          }}
          onMouseEnter={() => setHoveredLink(hoveredLink)}
          onMouseLeave={() => setHoveredLink(null)}
        >
          <a href={hoveredLink.link} target="_blank" rel="noopener noreferrer">
            {hoveredLink.link}
          </a>
        </div>
      )}
    </div>
  );
};
