// frontend/src/components/admin/SpreadsheetGrid.tsx
import React, { useState, useEffect, useRef } from "react";
import { 
  evaluateFormula, numberToColLetter, parseCellAddress, colLetterToNumber 
} from "../../utils/formulaEvaluator.js";
import { GridCell } from "./GridCell.js";

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
}) => {
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  
  const [localClipboard, setLocalClipboard] = useState<{
    startCell: string;
    cells: Record<string, CellData>;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Lưu trữ tọa độ bắt đầu và kết thúc kéo chuột bằng Ref để tránh kích hoạt React re-render liên tục khi kéo
  const dragStartRef = useRef<{ col: number; row: number } | null>(null);
  const dragEndRef = useRef<string | null>(null);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isMouseDown && dragStartRef.current && dragEndRef.current) {
        const startAddr = `${numberToColLetter(dragStartRef.current.col)}${dragStartRef.current.row}`;
        onSelectRange({
          start: startAddr,
          end: dragEndRef.current,
        });
      }
      setIsMouseDown(false);
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isMouseDown, onSelectRange]);

  const handleCellMouseDown = React.useCallback((address: string, colIdx: number, rowNum: number, e: React.MouseEvent) => {
    if (e.button !== 0) return;

    setIsMouseDown(true);
    dragStartRef.current = { col: colIdx, row: rowNum };
    dragEndRef.current = address;
    onSelectCell(address);

    // Cập nhật DOM trực tiếp: reset tất cả các ô đang được bôi màu range cũ
    const cellsDom = containerRef.current?.querySelectorAll(".sheet-cell");
    if (cellsDom) {
      cellsDom.forEach((el) => {
        el.classList.remove("in-range");
      });
    }

    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, [onSelectCell]);

  const handleCellMouseEnter = React.useCallback((address: string, colIdx: number, rowNum: number) => {
    if (isMouseDown && dragStartRef.current) {
      dragEndRef.current = address;

      // Cập nhật trực tiếp class CSS của DOM để đạt hiệu năng 60fps cực mượt mà không bị giật lag
      const start = dragStartRef.current;
      const minRow = Math.min(start.row, rowNum);
      const maxRow = Math.max(start.row, rowNum);
      const minCol = Math.min(start.col, colIdx);
      const maxCol = Math.max(start.col, colIdx);

      const cellsDom = containerRef.current?.querySelectorAll(".sheet-cell");
      if (cellsDom) {
        cellsDom.forEach((el) => {
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
    }
  }, [isMouseDown]);

  const handleContainerMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown || !containerRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    
    const threshold = 40;
    const speed = 15; // Tăng nhẹ tốc độ cuộn giúp trải nghiệm kéo lướt mượt hơn

    if (e.clientY > rect.bottom - threshold) {
      container.scrollTop += speed;
    } else if (e.clientY < rect.top + threshold) {
      container.scrollTop -= speed;
    }

    if (e.clientX > rect.right - threshold) {
      container.scrollLeft += speed;
    } else if (e.clientX < rect.left + threshold) {
      container.scrollLeft -= speed;
    }
  };

  const handleCellDoubleClick = React.useCallback((address: string) => {
    onSelectCell(address);
    onSelectRange({ start: address, end: address });
    setEditingCell(address);
  }, [onSelectCell, onSelectRange]);

  const handleCommitEdit = React.useCallback((address: string, newValue: string, moveDirection: "down" | "none") => {
    const isFormula = newValue.startsWith("=");
    onUpdateCell(address, {
      value: isFormula ? "" : newValue,
      formula: isFormula ? newValue : "",
    });
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

  const handleCancelEdit = React.useCallback(() => {
    setEditingCell(null);
  }, []);

  const getSelectedAddresses = (): string[] => {
    if (!selectedRange) return selectedCell ? [selectedCell] : [];
    return getCellRange(`${selectedRange.start}:${selectedRange.end}`);
  };

  const getCellRange = (rangeStr: string): string[] => {
    const parts = rangeStr.split(":");
    if (parts.length !== 2) return [rangeStr];
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

    setLocalClipboard({
      startCell: selectedRange ? selectedRange.start : (selectedCell || "A1"),
      cells: copied,
    });

    const tabSeparatedText = textDataRows.map(row => row.join("\t")).join("\n");
    navigator.clipboard.writeText(tabSeparatedText).catch(() => {});
  };

  const handlePaste = async () => {
    if (!selectedCell) return;

    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const targetCellParsed = parseCellAddress(selectedCell);
        if (!targetCellParsed) return;

        const targetColIdx = colLetterToNumber(targetCellParsed.col);
        const startRow = targetCellParsed.row;

        const rows = text.split(/\r?\n/);
        const pasted: Record<string, CellData> = {};

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

        if (Object.keys(pasted).length > 0) {
          onPasteCells(pasted);
          return;
        }
      }
    } catch (err) {
      console.warn("Không đọc được clipboard hệ thống, dùng clipboard cục bộ:", err);
    }

    if (!localClipboard) return;

    const startCellParsed = parseCellAddress(localClipboard.startCell);
    const targetCellParsed = parseCellAddress(selectedCell);
    if (!startCellParsed || !targetCellParsed) return;

    const startColIdx = colLetterToNumber(startCellParsed.col);
    const targetColIdx = colLetterToNumber(targetCellParsed.col);
    const colOffset = targetColIdx - startColIdx;
    const rowOffset = targetCellParsed.row - startCellParsed.row;

    const pastedLocal: Record<string, CellData> = {};
    Object.keys(localClipboard.cells).forEach((addr) => {
      const parsed = parseCellAddress(addr);
      if (parsed) {
        const newColIdx = colLetterToNumber(parsed.col) + colOffset;
        const newRow = parsed.row + rowOffset;
        if (newColIdx >= 0 && newColIdx < colCount && newRow >= 1 && newRow <= rowCount) {
          const newAddr = `${numberToColLetter(newColIdx)}${newRow}`;
          pastedLocal[newAddr] = { ...localClipboard.cells[addr] };
        }
      }
    });

    onPasteCells(pastedLocal);
  };



  const handleContainerKeyDown = (e: React.KeyboardEvent) => {
    if (editingCell) return;

    if (e.ctrlKey || e.metaKey) {
      if (e.key.toLowerCase() === "a") {
        e.preventDefault();
        const lastColLetter = numberToColLetter(colCount - 1);
        const lastCell = `${lastColLetter}${rowCount}`;
        onSelectCell("A1");
        onSelectRange({
          start: "A1",
          end: lastCell,
        });

        // Cập nhật giao diện bôi xanh lập tức trên DOM
        const cellsDom = containerRef.current?.querySelectorAll(".sheet-cell");
        if (cellsDom) {
          cellsDom.forEach((el) => {
            el.classList.add("in-range");
          });
        }
      } else if (e.key.toLowerCase() === "c") {
        e.preventDefault();
        handleCopy();
      } else if (e.key.toLowerCase() === "v") {
        e.preventDefault();
        handlePaste();
      } else if (e.key.toLowerCase() === "z") {
        e.preventDefault();
        onUndo();
      }
    }
  };

  const isCellInRange = (addr: string) => {
    if (!selectedRange) return false;
    const cell = parseCellAddress(addr);
    const start = parseCellAddress(selectedRange.start);
    const end = parseCellAddress(selectedRange.end);
    if (!cell || !start || !end) return false;

    const col = colLetterToNumber(cell.col);
    const startCol = colLetterToNumber(start.col);
    const endCol = colLetterToNumber(end.col);

    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);

    return col >= minCol && col <= maxCol && cell.row >= minRow && cell.row <= maxRow;
  };

  const renderCells = () => {
    const tableRows = [];
    const headerCols = [<th key="corner" className="th-corner"></th>];
    for (let c = 0; c < colCount; c++) {
      const colLetter = numberToColLetter(c);
      headerCols.push(
        <th key={colLetter} className="th-col">
          {colLetter}
        </th>
      );
    }
    tableRows.push(<tr key="header-row">{headerCols}</tr>);

    for (let r = 1; r <= rowCount; r++) {
      const rowCells = [
        <td key={`row-header-${r}`} className="th-row">
          {r}
        </td>,
      ];

      for (let c = 0; c < colCount; c++) {
        const colLetter = numberToColLetter(c);
        const address = `${colLetter}${r}`;
        const cellData = cells[address];
        const isSelected = selectedCell === address;
        const isEditing = editingCell === address;
        const inRange = isCellInRange(address);

        let displayValue = "";
        if (cellData) {
          if (cellData.formula) {
            displayValue = evaluateFormula(cellData.formula, cells);
          } else {
            displayValue = cellData.value || "";
          }
        }

        rowCells.push(
          <GridCell
            key={address}
            address={address}
            row={r}
            col={c}
            displayValue={displayValue}
            cellData={cellData}
            isSelected={isSelected}
            isEditing={isEditing}
            inRange={inRange}
            onCellMouseDown={handleCellMouseDown}
            onCellMouseEnter={handleCellMouseEnter}
            onCellDoubleClick={handleCellDoubleClick}
            onCommit={handleCommitEdit}
            onCancel={handleCancelEdit}
          />
        );
      }

      tableRows.push(<tr key={`row-${r}`}>{rowCells}</tr>);
    }

    return tableRows;
  };

  return (
    <div 
      ref={containerRef}
      className="sheet-grid-container"
      tabIndex={0}
      onKeyDown={handleContainerKeyDown}
      onMouseMove={handleContainerMouseMove}
      style={{ outline: "none" }}
    >
      <table className="sheet-table" style={{ width: `${40 + colCount * 100}px` }}>
        <tbody>{renderCells()}</tbody>
      </table>
    </div>
  );
};
