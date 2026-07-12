// frontend/src/components/admin/SpreadsheetGrid.tsx
import React, { useState, useEffect, useRef } from "react";
import { 
  evaluateFormula, numberToColLetter, parseCellAddress, colLetterToNumber, getCellRange, serializeCellsToHtml, parseHtmlToCells 
} from "../../utils/formulaEvaluator.js";
import { GridCell } from "./GridCell.js";
import { Scissors, Copy, Clipboard, Plus, Trash2, X } from "lucide-react";

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

  // --- Resize: guide line được mount trực tiếp vào document.body ---
  // Lý do: nếu parent có transform/filter/will-change thì position:fixed sẽ lệch.
  // Mount vào body đảm bảo fixed luôn relative với actual viewport.
  const resizingColRef = useRef<{ colLetter: string; startX: number; startWidth: number } | null>(null);
  const resizingRowRef = useRef<{ rowNum: number; startY: number; startHeight: number } | null>(null);
  const guideColRef    = useRef<HTMLDivElement | null>(null);
  const guideRowRef    = useRef<HTMLDivElement | null>(null);
  const cachedRectRef  = useRef<DOMRect | null>(null);
  const rafColId       = useRef<number>(0);
  const rafRowId       = useRef<number>(0);
  const onUpdateColWidthRef  = useRef(onUpdateColWidth);
  const onUpdateRowHeightRef = useRef(onUpdateRowHeight);
  useEffect(() => { onUpdateColWidthRef.current  = onUpdateColWidth;  }, [onUpdateColWidth]);
  useEffect(() => { onUpdateRowHeightRef.current = onUpdateRowHeight; }, [onUpdateRowHeight]);

  // CSS zoom: 90% trên html → coordinate space của body bị scale 0.9x.
  // getBoundingClientRect() trả về visual viewport px (unaffected by CSS zoom).
  // offsetWidth trả về layout width trong zoomed coordinate space.
  // → tỉ lệ = CSS zoom factor thực tế.
  const getZoom = (): number => {
    const el = document.documentElement;
    const rect = el.getBoundingClientRect();
    // offsetWidth có thể = 0 trong một số trường hợp, dùng 1 làm fallback
    return el.offsetWidth ? (rect.width / el.offsetWidth) : 1;
  };

  // Tạo guide elements và gắn vào body khi mount
  useEffect(() => {
    const colEl = document.createElement("div");
    colEl.className = "resize-guide-line col-guide";
    colEl.style.display = "none";
    document.body.appendChild(colEl);
    guideColRef.current = colEl;

    const rowEl = document.createElement("div");
    rowEl.className = "resize-guide-line row-guide";
    rowEl.style.display = "none";
    document.body.appendChild(rowEl);
    guideRowRef.current = rowEl;

    const handleMouseMove = (e: MouseEvent) => {
      if (resizingColRef.current && colEl && cachedRectRef.current) {
        const zoom = getZoom();
        // Chia cho zoom để convert từ viewport px sang zoomed CSS px
        const x = Math.max(cachedRectRef.current.left, Math.min(e.clientX, cachedRectRef.current.right)) / zoom;
        cancelAnimationFrame(rafColId.current);
        rafColId.current = requestAnimationFrame(() => { colEl.style.left = `${x}px`; });
      }
      if (resizingRowRef.current && rowEl && cachedRectRef.current) {
        const zoom = getZoom();
        const y = Math.max(cachedRectRef.current.top, Math.min(e.clientY, cachedRectRef.current.bottom)) / zoom;
        cancelAnimationFrame(rafRowId.current);
        rafRowId.current = requestAnimationFrame(() => { rowEl.style.top = `${y}px`; });
      }
    };
    const handleMouseUp = (e: MouseEvent) => {
      cancelAnimationFrame(rafColId.current);
      cancelAnimationFrame(rafRowId.current);
      if (resizingColRef.current) {
        const dx = e.clientX - resizingColRef.current.startX;
        const newWidth = Math.max(30, resizingColRef.current.startWidth + dx);
        onUpdateColWidthRef.current(resizingColRef.current.colLetter, newWidth);
        resizingColRef.current = null;
        colEl.style.display = "none";
      }
      if (resizingRowRef.current) {
        const dy = e.clientY - resizingRowRef.current.startY;
        const newHeight = Math.max(15, resizingRowRef.current.startHeight + dy);
        onUpdateRowHeightRef.current(resizingRowRef.current.rowNum, newHeight);
        resizingRowRef.current = null;
        rowEl.style.display = "none";
      }
      cachedRectRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      if (document.body.contains(colEl)) document.body.removeChild(colEl);
      if (document.body.contains(rowEl)) document.body.removeChild(rowEl);
    };
  }, []);

  const startColResize = (e: React.MouseEvent, colLetter: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (containerRef.current) cachedRectRef.current = containerRef.current.getBoundingClientRect();
    const startWidth = colWidths?.[colLetter] || 100;
    resizingColRef.current = { colLetter, startX: e.clientX, startWidth };
    const colEl = guideColRef.current;
    if (colEl && cachedRectRef.current) {
      const zoom = getZoom();
      // Debug: mở DevTools để kiểm tra zoom và tọa độ
      console.log('[Resize] zoom=', zoom, 'clientX=', e.clientX, 'guideLeft=', e.clientX / zoom);
      colEl.style.left   = `${e.clientX / zoom}px`;
      colEl.style.top    = `${cachedRectRef.current.top / zoom}px`;
      colEl.style.height = `${cachedRectRef.current.height / zoom}px`;
      colEl.style.display = "block";
    }
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };


  const startRowResize = (e: React.MouseEvent, rowNum: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (containerRef.current) cachedRectRef.current = containerRef.current.getBoundingClientRect();
    const startHeight = rowHeights?.[rowNum] || 25;
    resizingRowRef.current = { rowNum, startY: e.clientY, startHeight };
    const rowEl = guideRowRef.current;
    if (rowEl && cachedRectRef.current) {
      const zoom = getZoom();
      rowEl.style.top   = `${e.clientY / zoom}px`;
      rowEl.style.left  = `${cachedRectRef.current.left / zoom}px`;
      rowEl.style.width = `${cachedRectRef.current.width / zoom}px`;
      rowEl.style.display = "block";
    }
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  };

  const [localClipboard, setLocalClipboard] = useState<{
    startCell: string;
    cells: Record<string, CellData>;
  } | null>(null);


  const containerRef = useRef<HTMLDivElement>(null);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: "row" | "col";
    index: number;
  } | null>(null);

  useEffect(() => {
    const handleDocumentClick = () => {
      setContextMenu(null);
    };
    document.addEventListener("click", handleDocumentClick);
    return () => {
      document.removeEventListener("click", handleDocumentClick);
    };
  }, []);

  const handleColHeaderClick = (colIdx: number) => {
    const colLetter = numberToColLetter(colIdx);
    const startCell = `${colLetter}1`;
    const endCell = `${colLetter}${rowCount}`;
    onSelectCell(startCell);
    onSelectRange({ start: startCell, end: endCell });
    
    const cellsDom = containerRef.current?.querySelectorAll(".sheet-cell");
    if (cellsDom) {
      cellsDom.forEach((el) => {
        const cellEl = el as HTMLElement;
        const c = parseInt(cellEl.dataset.col || "0", 10);
        if (c === colIdx) {
          cellEl.classList.add("in-range");
        } else {
          cellEl.classList.remove("in-range");
        }
      });
    }
  };

  const handleRowHeaderClick = (rowNum: number) => {
    const lastColLetter = numberToColLetter(colCount - 1);
    const startCell = `A${rowNum}`;
    const endCell = `${lastColLetter}${rowNum}`;
    onSelectCell(startCell);
    onSelectRange({ start: startCell, end: endCell });
    
    const cellsDom = containerRef.current?.querySelectorAll(".sheet-cell");
    if (cellsDom) {
      cellsDom.forEach((el) => {
        const cellEl = el as HTMLElement;
        const r = parseInt(cellEl.dataset.row || "0", 10);
        if (r === rowNum) {
          cellEl.classList.add("in-range");
        } else {
          cellEl.classList.remove("in-range");
        }
      });
    }
  };

  const handleColHeaderContextMenu = (e: React.MouseEvent, colIdx: number) => {
    e.preventDefault();
    handleColHeaderClick(colIdx);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: "col",
      index: colIdx,
    });
  };

  const handleRowHeaderContextMenu = (e: React.MouseEvent, rowNum: number) => {
    e.preventDefault();
    handleRowHeaderClick(rowNum);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: "row",
      index: rowNum,
    });
  };

  const handleCut = () => {
    handleCopy();
    const addresses = getSelectedAddresses();
    addresses.forEach((addr) => {
      onUpdateCell(addr, { value: "", formula: "" });
    });
  };

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
        onPasteCells(pasted);
        return;
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



  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (editingCell) return;
      
      const activeEl = document.activeElement;
      const isInput = activeEl && (
        activeEl.tagName === "INPUT" || 
        activeEl.tagName === "TEXTAREA" || 
        activeEl.hasAttribute("contenteditable")
      );
      if (isInput) return;

      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === "a") {
          e.preventDefault();
          const lastColLetter = numberToColLetter(colCount - 1);
          const lastCell = `${lastColLetter}${rowCount}`;
          onSelectCell("A1");
          onSelectRange({
            start: "A1",
            end: lastCell,
          });

          const cellsDom = containerRef.current?.querySelectorAll(".sheet-cell");
          if (cellsDom) {
            cellsDom.forEach((el) => {
              el.classList.add("in-range");
            });
          }
        } else if (key === "c") {
          e.preventDefault();
          handleCopy();
        } else if (key === "v") {
          e.preventDefault();
          handlePaste();
        } else if (key === "z") {
          e.preventDefault();
          onUndo();
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
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

    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);

    return col >= minCol && col <= maxCol && cell.row >= minRow && cell.row <= maxRow;
  };

  // Tối ưu hóa hiệu năng bằng cách chỉ vẽ 40 dòng hiển thị ban đầu, các dòng còn lại được vẽ song song sau 50ms
  const [renderedRowCount, setRenderedRowCount] = useState(() => Math.min(rowCount, 40));

  useEffect(() => {
    setRenderedRowCount(Math.min(rowCount, 40));
    const timer = setTimeout(() => {
      setRenderedRowCount(rowCount);
    }, 50);
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
          key={colLetter} 
          className="th-col"
          style={{ width: `${colWidth}px`, minWidth: `${colWidth}px`, maxWidth: `${colWidth}px`, position: "relative" }}
          onClick={() => handleColHeaderClick(c)}
          onContextMenu={(e) => handleColHeaderContextMenu(e, c)}
        >
          {colLetter}
          {/* Handle kéo để thay đổi chiều rộng cột */}
          <span
            className="col-resize-handle"
            onMouseDown={(e) => startColResize(e, colLetter)}
          />
        </th>
      );
    }
    tableRows.push(<tr key="header-row" style={{ height: "25px" }}>{headerCols}</tr>);

    for (let r = 1; r <= renderedRowCount; r++) {
      const rowHeight = rowHeights?.[r] || 25;
      const rowCells = [
        <td 
          key={`row-header-${r}`} 
          className="th-row"
          style={{ position: "relative" }}
          onClick={() => handleRowHeaderClick(r)}
          onContextMenu={(e) => handleRowHeaderContextMenu(e, r)}
        >
          {r}
          {/* Handle kéo để thay đổi chiều cao hàng */}
          <span
            className="row-resize-handle"
            onMouseDown={(e) => startRowResize(e, r)}
          />
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

      tableRows.push(<tr key={`row-${r}`} style={{ height: `${rowHeight}px` }}>{rowCells}</tr>);
    }

    return tableRows;
  };

  const totalTableWidth = 40 + Array.from({ length: colCount }).reduce((acc: number, _, c) => {
    const colLetter = numberToColLetter(c);
    return acc + (colWidths?.[colLetter] || 100);
  }, 0);

  return (
    <div 
      ref={containerRef}
      className="sheet-grid-container"
      tabIndex={0}
      onMouseMove={handleContainerMouseMove}
      style={{ outline: "none", position: "relative" }}
    >
      <table className="sheet-table" style={{ width: `${totalTableWidth}px`, tableLayout: "fixed" }}>
        <tbody>{renderCells()}</tbody>
      </table>

      {contextMenu && (
        <div 
          className="sheets-context-menu" 
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="sheets-context-menu-item" onClick={handleCut}>
            <span className="sheets-context-menu-item-left">
              <Scissors className="w-3.5 h-3.5 text-gray-400" />
              Cắt
            </span>
            <span className="sheets-context-menu-item-shortcut">Ctrl+X</span>
          </button>
          <button className="sheets-context-menu-item" onClick={handleCopy}>
            <span className="sheets-context-menu-item-left">
              <Copy className="w-3.5 h-3.5 text-gray-400" />
              Sao chép
            </span>
            <span className="sheets-context-menu-item-shortcut">Ctrl+C</span>
          </button>
          <button className="sheets-context-menu-item" onClick={handlePaste}>
            <span className="sheets-context-menu-item-left">
              <Clipboard className="w-3.5 h-3.5 text-gray-400" />
              Dán
            </span>
            <span className="sheets-context-menu-item-shortcut">Ctrl+V</span>
          </button>
          
          <div className="sheets-context-menu-divider" />

          {contextMenu.type === "row" ? (
            <>
              <button 
                className="sheets-context-menu-item" 
                onClick={() => {
                  onInsertRow(contextMenu.index, "above");
                  setContextMenu(null);
                }}
              >
                <span className="sheets-context-menu-item-left">
                  <Plus className="w-3.5 h-3.5 text-gray-400" />
                  Chèn 1 hàng lên trên
                </span>
              </button>
              <button 
                className="sheets-context-menu-item" 
                onClick={() => {
                  onInsertRow(contextMenu.index, "below");
                  setContextMenu(null);
                }}
              >
                <span className="sheets-context-menu-item-left">
                  <Plus className="w-3.5 h-3.5 text-gray-400" />
                  Chèn 1 hàng xuống dưới
                </span>
              </button>
              <button 
                className="sheets-context-menu-item text-red-500 hover:bg-red-50" 
                onClick={() => {
                  onDeleteRow(contextMenu.index);
                  setContextMenu(null);
                }}
              >
                <span className="sheets-context-menu-item-left">
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  Xóa hàng
                </span>
              </button>
              <button 
                className="sheets-context-menu-item" 
                onClick={() => {
                  onClearRow(contextMenu.index);
                  setContextMenu(null);
                }}
              >
                <span className="sheets-context-menu-item-left">
                  <X className="w-3.5 h-3.5 text-gray-400" />
                  Xóa nội dung hàng
                </span>
              </button>
              
              <div className="sheets-context-menu-divider" />
              
              <button 
                className="sheets-context-menu-item" 
                onClick={() => {
                  const currentHeight = rowHeights?.[contextMenu.index] || 25;
                  const val = prompt(`Nhập chiều cao cho hàng ${contextMenu.index} (px):`, currentHeight.toString());
                  if (val) {
                    const parsed = parseInt(val, 10);
                    if (!isNaN(parsed) && parsed > 5) {
                      onUpdateRowHeight(contextMenu.index, parsed);
                    }
                  }
                  setContextMenu(null);
                }}
              >
                <span className="sheets-context-menu-item-left">
                  <Plus className="w-3.5 h-3.5 text-gray-400" />
                  Đổi kích thước hàng
                </span>
              </button>
            </>
          ) : (
            <>
              <button 
                className="sheets-context-menu-item" 
                onClick={() => {
                  onInsertCol(numberToColLetter(contextMenu.index), "left");
                  setContextMenu(null);
                }}
              >
                <span className="sheets-context-menu-item-left">
                  <Plus className="w-3.5 h-3.5 text-gray-400" />
                  Chèn 1 cột bên trái
                </span>
              </button>
              <button 
                className="sheets-context-menu-item" 
                onClick={() => {
                  onInsertCol(numberToColLetter(contextMenu.index), "right");
                  setContextMenu(null);
                }}
              >
                <span className="sheets-context-menu-item-left">
                  <Plus className="w-3.5 h-3.5 text-gray-400" />
                  Chèn 1 cột bên phải
                </span>
              </button>
              <button 
                className="sheets-context-menu-item text-red-500 hover:bg-red-50" 
                onClick={() => {
                  onDeleteCol(numberToColLetter(contextMenu.index));
                  setContextMenu(null);
                }}
              >
                <span className="sheets-context-menu-item-left">
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  Xóa cột
                </span>
              </button>
              <button 
                className="sheets-context-menu-item" 
                onClick={() => {
                  onClearCol(numberToColLetter(contextMenu.index));
                  setContextMenu(null);
                }}
              >
                <span className="sheets-context-menu-item-left">
                  <X className="w-3.5 h-3.5 text-gray-400" />
                  Xóa nội dung cột
                </span>
              </button>

              <div className="sheets-context-menu-divider" />

              <button 
                className="sheets-context-menu-item" 
                onClick={() => {
                  const colLetter = numberToColLetter(contextMenu.index);
                  const currentWidth = colWidths?.[colLetter] || 100;
                  const val = prompt(`Nhập chiều rộng cho cột ${colLetter} (px):`, currentWidth.toString());
                  if (val) {
                    const parsed = parseInt(val, 10);
                    if (!isNaN(parsed) && parsed > 5) {
                      onUpdateColWidth(colLetter, parsed);
                    }
                  }
                  setContextMenu(null);
                }}
              >
                <span className="sheets-context-menu-item-left">
                  <Plus className="w-3.5 h-3.5 text-gray-400" />
                  Đổi kích thước cột
                </span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
