// frontend/src/components/admin/SpreadsheetGrid.tsx
import React, { useState, useEffect, useRef } from "react";
import { 
  evaluateFormula, numberToColLetter, parseCellAddress, colLetterToNumber, serializeCellsToHtml, parseHtmlToCells 
} from "../../utils/formulaEvaluator.js";
import { GridCell } from "./GridCell.js";
import { useGridResize } from "../../hooks/useGridResize.js";
import { GridContextMenu } from "./GridContextMenu.js";

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
  onPasteCells: (pastedCells: Record<string, CellData>) => void;
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
}

export const SpreadsheetGrid: React.FC<SpreadsheetGridProps> = ({
  cells,
  selectedCell,
  onSelectCell,
  selectedRange,
  onSelectRange,
  onUpdateCell,
  onPasteCells,
  rowCount,
  colCount,
  onUndo,
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
}) => {
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: "row" | "col"; index: number } | null>(null);

  // Resize hook
  const { startColResize, startRowResize } = useGridResize(
    containerRef,
    colWidths,
    rowHeights,
    onUpdateColWidth,
    onUpdateRowHeight
  );

  const [localClipboard, setLocalClipboard] = useState<{ startCell: string; cells: Record<string, CellData> } | null>(null);

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

  const handleCut = () => {
    handleCopy();
    getSelectedAddresses().forEach((addr) => {
      onUpdateCell(addr, { value: "", formula: "" });
    });
  };

  const dragStartRef = useRef<{ col: number; row: number } | null>(null);
  const dragEndRef = useRef<string | null>(null);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isMouseDown && dragStartRef.current && dragEndRef.current) {
        onSelectRange({
          start: `${numberToColLetter(dragStartRef.current.col)}${dragStartRef.current.row}`,
          end: dragEndRef.current,
        });
      }
      setIsMouseDown(false);
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [isMouseDown, onSelectRange]);

  const handleCellMouseDown = React.useCallback((address: string, colIdx: number, rowNum: number, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsMouseDown(true);
    dragStartRef.current = { col: colIdx, row: rowNum };
    dragEndRef.current = address;
    onSelectCell(address);
    containerRef.current?.querySelectorAll(".sheet-cell").forEach(el => el.classList.remove("in-range"));
    containerRef.current?.focus();
  }, [onSelectCell]);

  const handleCellMouseEnter = React.useCallback((address: string, colIdx: number, rowNum: number) => {
    if (isMouseDown && dragStartRef.current) {
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
  }, [isMouseDown]);

  const handleContainerMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown || !containerRef.current) return;
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

  const getSelectedAddresses = (): string[] => {
    if (!selectedRange) return selectedCell ? [selectedCell] : [];
    const parts = `${selectedRange.start}:${selectedRange.end}`.split(":");
    if (parts.length !== 2) return [selectedRange.start];
    const start = parseCellAddress(parts[0]);
    const end = parseCellAddress(parts[1]);
    if (!start || !end) return [];

    const startColIdx = colLetterToNumber(start.col);
    const endColIdx = colLetterToNumber(end.col);
    const startRow = Math.min(start.row, end.row);
    const endRow = Math.max(start.row, end.row);
    const minCol = Math.min(startColIdx, endColIdx);
    const maxCol = Math.max(startColIdx, endColIdx);

    const addresses: string[] = [];
    for (let c = minCol; c <= maxCol; c++) {
      const colLetter = numberToColLetter(c);
      for (let r = startRow; r <= endRow; r++) {
        addresses.push(`${colLetter}${r}`);
      }
    }
    return addresses;
  };

  const handleCopy = () => {
    const addresses = getSelectedAddresses();
    if (addresses.length === 0) return;

    const copied: Record<string, CellData> = {};
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
            copied[addr] = { ...cells[addr] };
            rowVal.push(cells[addr].formula || cells[addr].value || "");
          } else {
            rowVal.push("");
          }
        }
        textDataRows.push(rowVal);
      }
    }

    setLocalClipboard({ startCell: selectedRange ? selectedRange.start : (selectedCell || "A1"), cells: copied });

    const tabSeparatedText = textDataRows.map(row => row.join("\t")).join("\n");
    let htmlText = "";
    if (start && end) {
      htmlText = serializeCellsToHtml(cells, Math.min(start.row, end.row), Math.max(start.row, end.row), Math.min(colLetterToNumber(start.col), colLetterToNumber(end.col)), Math.max(colLetterToNumber(start.col), colLetterToNumber(end.col)));
    }

    if (htmlText) {
      navigator.clipboard.write([
        new ClipboardItem({ "text/html": new Blob([htmlText], { type: "text/html" }), "text/plain": new Blob([tabSeparatedText], { type: "text/plain" }) })
      ]).catch(() => {
        navigator.clipboard.writeText(tabSeparatedText).catch(() => {});
      });
    } else {
      navigator.clipboard.writeText(tabSeparatedText).catch(() => {});
    }
  };

  const handlePaste = async () => {
    if (!selectedCell) return;
    try {
      const clipboardItems = await navigator.clipboard.read();
      let htmlText = "";
      let plainText = "";

      for (const item of clipboardItems) {
        if (item.types.includes("text/html")) htmlText = await (await item.getType("text/html")).text();
        if (item.types.includes("text/plain")) plainText = await (await item.getType("text/plain")).text();
      }

      const targetCellParsed = parseCellAddress(selectedCell);
      if (!targetCellParsed) return;

      const targetColIdx = colLetterToNumber(targetCellParsed.col);
      const startRow = targetCellParsed.row;
      const pasted: Record<string, CellData> = {};

      if (htmlText) {
        const parsed = parseHtmlToCells(htmlText);
        parsed?.rows.forEach((row, rOffset) => row.forEach((cellData, cOffset) => {
          const colIdx = targetColIdx + cOffset;
          const rowNum = startRow + rOffset;
          if (colIdx >= 0 && colIdx < colCount && rowNum >= 1 && rowNum <= rowCount) {
            pasted[`${numberToColLetter(colIdx)}${rowNum}`] = cellData;
          }
        }));
      }

      if (Object.keys(pasted).length === 0 && plainText) {
        const rows = plainText.split(/\r?\n/);
        rows.forEach((row, rOffset) => {
          if (rOffset === rows.length - 1 && row.trim() === "") return;
          row.split("\t").forEach((val, cOffset) => {
            const colIdx = targetColIdx + cOffset;
            const rowNum = startRow + rOffset;
            if (colIdx >= 0 && colIdx < colCount && rowNum >= 1 && rowNum <= rowCount) {
              pasted[`${numberToColLetter(colIdx)}${rowNum}`] = { value: val.startsWith("=") ? "" : val, formula: val.startsWith("=") ? val : "" };
            }
          });
        });
      }

      if (Object.keys(pasted).length > 0) {
        onPasteCells(pasted);
        return;
      }
    } catch {
      // Fallback
    }

    if (!localClipboard) return;
    const startCellParsed = parseCellAddress(localClipboard.startCell);
    const targetCellParsed = parseCellAddress(selectedCell);
    if (!startCellParsed || !targetCellParsed) return;

    const colOffset = colLetterToNumber(targetCellParsed.col) - colLetterToNumber(startCellParsed.col);
    const rowOffset = targetCellParsed.row - startCellParsed.row;
    const pastedLocal: Record<string, CellData> = {};

    Object.keys(localClipboard.cells).forEach((addr) => {
      const parsed = parseCellAddress(addr);
      if (parsed) {
        const newColIdx = colLetterToNumber(parsed.col) + colOffset;
        const newRow = parsed.row + rowOffset;
        if (newColIdx >= 0 && newColIdx < colCount && newRow >= 1 && newRow <= rowCount) {
          pastedLocal[`${numberToColLetter(newColIdx)}${newRow}`] = { ...localClipboard.cells[addr] };
        }
      }
    });
    onPasteCells(pastedLocal);
  };

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
        } else if (key === "c") { e.preventDefault(); handleCopy(); }
        else if (key === "v") { e.preventDefault(); handlePaste(); }
        else if (key === "z") { e.preventDefault(); onUndo(); }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [editingCell, colCount, rowCount, onSelectCell, onSelectRange, onUndo, cells, selectedRange, selectedCell, localClipboard]);

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
    const headerCols = [<th key="corner" className="th-corner" style={{ width: "40px", minWidth: "40px", maxWidth: "40px" }}></th>];
    for (let c = 0; c < colCount; c++) {
      const colLetter = numberToColLetter(c);
      const colWidth = colWidths?.[colLetter] || 100;
      headerCols.push(
        <th 
          key={colLetter} className="th-col"
          style={{ width: `${colWidth}px`, minWidth: `${colWidth}px`, maxWidth: `${colWidth}px`, position: "relative" }}
          onClick={() => handleColHeaderClick(c)} onContextMenu={(e) => handleColHeaderContextMenu(e, c)}
        >
          {colLetter}
          <span className="col-resize-handle" onMouseDown={(e) => startColResize(e, colLetter)} />
        </th>
      );
    }
    tableRows.push(<tr key="header-row" style={{ height: "25px" }}>{headerCols}</tr>);

    for (let r = 1; r <= renderedRowCount; r++) {
      const rowHeight = rowHeights?.[r] || 25;
      const rowCells = [
        <td 
          key={`row-header-${r}`} className="th-row" style={{ position: "relative" }}
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
        const displayValue = cellData ? (cellData.formula ? evaluateFormula(cellData.formula, cells) : (cellData.value || "")) : "";

        rowCells.push(
          <GridCell
            key={address} address={address} row={r} col={c} displayValue={displayValue} cellData={cellData}
            isSelected={selectedCell === address} isEditing={editingCell === address} inRange={isCellInRange(address)}
            onCellMouseDown={handleCellMouseDown} onCellMouseEnter={handleCellMouseEnter}
            onCellDoubleClick={handleCellDoubleClick} onCommit={(val, dir) => handleCommitEdit(address, val, dir)} onCancel={handleCancelEdit}
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
      onMouseMove={handleContainerMouseMove} style={{ outline: "none", position: "relative" }}
    >
      <table className="sheet-table" style={{ width: `${totalTableWidth}px`, tableLayout: "fixed" }}>
        <tbody>{renderCells()}</tbody>
      </table>

      <GridContextMenu
        contextMenu={contextMenu} onClose={() => setContextMenu(null)}
        handleCut={handleCut} handleCopy={handleCopy} handlePaste={handlePaste}
        onInsertRow={onInsertRow} onDeleteRow={onDeleteRow} onClearRow={onClearRow} rowHeights={rowHeights} onUpdateRowHeight={onUpdateRowHeight}
        onInsertCol={onInsertCol} onDeleteCol={onDeleteCol} onClearCol={onClearCol} colWidths={colWidths} onUpdateColWidth={onUpdateColWidth}
      />
    </div>
  );
};
