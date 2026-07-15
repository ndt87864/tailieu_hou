import { parseCellAddress, numberToColLetter } from "./formulaEvaluator.js";
import { Sheet, CellData } from "../hooks/useSpreadsheetState.js";

export const sortActiveSheetInSheets = (
  sheets: Sheet[],
  activeSheetIdx: number,
  colLetter: string,
  direction: "asc" | "desc"
): Sheet[] => {
  const newSheets = [...sheets];
  const targetSheet = { ...newSheets[activeSheetIdx] };
  const currentCells = targetSheet.cells;

  const rows: Record<number, Record<string, CellData>> = {};
  Object.keys(currentCells).forEach((addr) => {
    const parsed = parseCellAddress(addr);
    if (parsed) {
      if (!rows[parsed.row]) rows[parsed.row] = {};
      rows[parsed.row][parsed.col] = currentCells[addr];
    }
  });

  const sortedRowIndices = Object.keys(rows)
    .map(Number)
    .sort((rA, rB) => {
      const valA = rows[rA]?.[colLetter]?.value || "";
      const valB = rows[rB]?.[colLetter]?.value || "";
      const isNumA = !isNaN(Number(valA)) && valA !== "";
      const isNumB = !isNaN(Number(valB)) && valB !== "";

      if (isNumA && isNumB) {
        return direction === "asc" ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
      }
      return direction === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });

  const nextCells: Record<string, CellData> = {};
  sortedRowIndices.forEach((oldRow, newRowIdxZero) => {
    const newRow = newRowIdxZero + 1;
    const rowCells = rows[oldRow];
    if (rowCells) {
      Object.keys(rowCells).forEach((col) => {
        nextCells[`${col}${newRow}`] = rowCells[col];
      });
    }
  });

  targetSheet.cells = nextCells;
  newSheets[activeSheetIdx] = targetSheet;
  return newSheets;
};

export const trimWhitespaceInSheets = (
  sheets: Sheet[],
  activeSheetIdx: number
): Sheet[] => {
  const newSheets = [...sheets];
  const targetSheet = { ...newSheets[activeSheetIdx] };
  const nextCells = { ...targetSheet.cells };
  Object.keys(nextCells).forEach((addr) => {
    if (nextCells[addr]) {
      nextCells[addr] = { ...nextCells[addr], value: (nextCells[addr].value || "").trim() };
    }
  });
  targetSheet.cells = nextCells;
  newSheets[activeSheetIdx] = targetSheet;
  return newSheets;
};

export const removeEmptyRowsInSheets = (
  sheets: Sheet[],
  activeSheetIdx: number,
  rowCount: number,
  colCount: number
): Sheet[] => {
  const newSheets = [...sheets];
  const targetSheet = { ...newSheets[activeSheetIdx] };
  const currentCells = targetSheet.cells;

  const nonEmptyRows = new Set<number>();
  Object.keys(currentCells).forEach((addr) => {
    const parsed = parseCellAddress(addr);
    if (parsed && (currentCells[addr]?.value || currentCells[addr]?.formula)) {
      nonEmptyRows.add(parsed.row);
    }
  });

  const nextCells: Record<string, CellData> = {};
  let nextRowIdx = 1;
  for (let r = 1; r <= rowCount; r++) {
    if (nonEmptyRows.has(r)) {
      for (let c = 0; c < colCount; c++) {
        const addr = `${numberToColLetter(c)}${r}`;
        if (currentCells[addr]) {
          nextCells[`${numberToColLetter(c)}${nextRowIdx}`] = currentCells[addr];
        }
      }
      nextRowIdx++;
    }
  }

  targetSheet.cells = nextCells;
  targetSheet.rowCount = Math.max(10, nextRowIdx - 1);
  newSheets[activeSheetIdx] = targetSheet;
  return newSheets;
};

export const formatSelectionInSheets = (
  sheets: Sheet[],
  activeSheetIdx: number,
  addresses: string[],
  type: "currency" | "percent" | "decimal-inc" | "decimal-dec" | "time" | "date"
): Sheet[] => {
  const newSheets = [...sheets];
  const targetSheet = { ...newSheets[activeSheetIdx] };
  addresses.forEach((addr) => {
    const cell = targetSheet.cells[addr] || { value: "", formula: "" };
    let val = cell.value || "";
    if (!cell.formula) {
      const isDateStr = /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(val.trim());
      const isTimeStr = /^\d{1,2}:\d{1,2}(:\d{1,2})?$/.test(val.trim());

      if (type === "time") {
        if (isTimeStr) {
          // Giữ nguyên
        } else if (isDateStr) {
          const parts = val.split("/");
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const year = parseInt(parts[2], 10);
          const dateObj = new Date(year, month, day);
          val = !isNaN(dateObj.getTime()) ? dateObj.toTimeString().split(' ')[0] : val;
        } else {
          const clean = val.replace(/[^0-9.-]/g, "");
          const num = parseFloat(clean);
          if (!isNaN(num)) {
            const hours = Math.floor(num) % 24;
            const mins = Math.round((num - Math.floor(num)) * 60) % 60;
            val = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:00`;
          } else {
            val = new Date().toTimeString().split(' ')[0];
          }
        }
      } else if (type === "date") {
        const parseToDateStr = (dateObj: Date) => {
          const dd = String(dateObj.getDate()).padStart(2, '0');
          const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
          return `${dd}/${mm}/${dateObj.getFullYear()}`;
        };

        if (isDateStr) {
          // Giữ nguyên
        } else {
          const clean = val.replace(/[^0-9.-]/g, "");
          const num = parseFloat(clean);
          if (!isNaN(num)) {
            const dateObj = new Date(num > 1000000000000 ? num : num * 1000);
            val = parseToDateStr(dateObj);
          } else {
            const parsed = Date.parse(val);
            val = parseToDateStr(!isNaN(parsed) ? new Date(parsed) : new Date());
          }
        }
      } else {
        const clean = val.replace(/[^0-9.-]/g, "");
        const num = parseFloat(clean);
        if (!isNaN(num)) {
          if (type === "currency") val = `$${num.toLocaleString()}`;
          else if (type === "percent") val = `${num}%`;
          else if (type === "decimal-inc") val = num.toFixed(2);
          else if (type === "decimal-dec") val = Math.round(num).toString();
        }
      }
    }
    targetSheet.cells[addr] = { ...cell, value: val };
  });
  newSheets[activeSheetIdx] = targetSheet;
  return newSheets;
};

export const removeDuplicatesInSheets = (
  sheets: Sheet[],
  activeSheetIdx: number,
  rowCount: number,
  colCount: number
): Sheet[] => {
  const newSheets = [...sheets];
  const targetSheet = { ...newSheets[activeSheetIdx] };
  const currentCells = targetSheet.cells;

  const rowValues: Record<number, string> = {};
  for (let r = 1; r <= rowCount; r++) {
    let rowStr = "";
    for (let c = 0; c < colCount; c++) {
      const addr = `${numberToColLetter(c)}${r}`;
      rowStr += (currentCells[addr]?.value || "") + "|";
    }
    rowValues[r] = rowStr;
  }

  const seen = new Set<string>();
  const uniqueRows: number[] = [];
  for (let r = 1; r <= rowCount; r++) {
    const val = rowValues[r];
    const isEmpty = val.replace(/\|/g, "").trim() === "";
    if (isEmpty) {
      uniqueRows.push(r);
    } else if (!seen.has(val)) {
      seen.add(val);
      uniqueRows.push(r);
    }
  }

  const nextCells: Record<string, CellData> = {};
  uniqueRows.forEach((oldRow, newRowIdxZero) => {
    const newRow = newRowIdxZero + 1;
    for (let c = 0; c < colCount; c++) {
      const colLetter = numberToColLetter(c);
      const oldAddr = `${colLetter}${oldRow}`;
      if (currentCells[oldAddr]) {
        nextCells[`${colLetter}${newRow}`] = currentCells[oldAddr];
      }
    }
  });

  targetSheet.cells = nextCells;
  targetSheet.rowCount = Math.max(10, uniqueRows.length);
  newSheets[activeSheetIdx] = targetSheet;
  return newSheets;
};
