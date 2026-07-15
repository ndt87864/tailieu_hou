// frontend/src/hooks/useSpreadsheetState.ts (types import workaround, operations are exported here)
import { parseCellAddress, colLetterToNumber, numberToColLetter } from "./formulaEvaluator.js";

// Define locally to avoid circular dependency
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

export const insertRowInSheets = (
  prev: Sheet[],
  activeIdx: number,
  atRow: number,
  position: "above" | "below"
): Sheet[] => {
  const newSheets = [...prev];
  const targetSheet = { ...newSheets[activeIdx] };
  const currentCells = targetSheet.cells;
  const newCells: Record<string, CellData> = {};
  const insertAt = position === "above" ? atRow : atRow + 1;

  Object.keys(currentCells).forEach((addr) => {
    const parsed = parseCellAddress(addr);
    if (parsed) {
      if (parsed.row >= insertAt) {
        newCells[`${parsed.col}${parsed.row + 1}`] = currentCells[addr];
      } else {
        newCells[addr] = currentCells[addr];
      }
    }
  });

  targetSheet.cells = newCells;
  targetSheet.rowCount = (targetSheet.rowCount || 500) + 1;

  if (targetSheet.rowHeights) {
    const newHeights: Record<number, number> = {};
    Object.keys(targetSheet.rowHeights).forEach((key) => {
      const r = parseInt(key, 10);
      if (r >= insertAt) {
        newHeights[r + 1] = targetSheet.rowHeights![r];
      } else {
        newHeights[r] = targetSheet.rowHeights![r];
      }
    });
    targetSheet.rowHeights = newHeights;
  }

  newSheets[activeIdx] = targetSheet;
  return newSheets;
};

export const insertColumnInSheets = (
  prev: Sheet[],
  activeIdx: number,
  atColLetter: string,
  position: "left" | "right"
): Sheet[] => {
  const newSheets = [...prev];
  const targetSheet = { ...newSheets[activeIdx] };
  const currentCells = targetSheet.cells;
  const newCells: Record<string, CellData> = {};
  const atColIdx = colLetterToNumber(atColLetter);
  const insertColIdx = position === "left" ? atColIdx : atColIdx + 1;

  Object.keys(currentCells).forEach((addr) => {
    const parsed = parseCellAddress(addr);
    if (parsed) {
      const colIdx = colLetterToNumber(parsed.col);
      if (colIdx >= insertColIdx) {
        const nextColLetter = numberToColLetter(colIdx + 1);
        newCells[`${nextColLetter}${parsed.row}`] = currentCells[addr];
      } else {
        newCells[addr] = currentCells[addr];
      }
    }
  });

  targetSheet.cells = newCells;
  targetSheet.colCount = (targetSheet.colCount || 26) + 1;

  if (targetSheet.colWidths) {
    const newWidths: Record<string, number> = {};
    Object.keys(targetSheet.colWidths).forEach((col) => {
      const colIdx = colLetterToNumber(col);
      if (colIdx >= insertColIdx) {
        newWidths[numberToColLetter(colIdx + 1)] = targetSheet.colWidths![col];
      } else {
        newWidths[col] = targetSheet.colWidths![col];
      }
    });
    targetSheet.colWidths = newWidths;
  }

  newSheets[activeIdx] = targetSheet;
  return newSheets;
};

export const deleteRowInSheets = (prev: Sheet[], activeIdx: number, atRow: number): Sheet[] => {
  const newSheets = [...prev];
  const targetSheet = { ...newSheets[activeIdx] };
  const currentCells = targetSheet.cells;
  const newCells: Record<string, CellData> = {};

  Object.keys(currentCells).forEach((addr) => {
    const parsed = parseCellAddress(addr);
    if (parsed) {
      if (parsed.row > atRow) {
        newCells[`${parsed.col}${parsed.row - 1}`] = currentCells[addr];
      } else if (parsed.row < atRow) {
        newCells[addr] = currentCells[addr];
      }
    }
  });

  targetSheet.cells = newCells;
  targetSheet.rowCount = Math.max(1, (targetSheet.rowCount || 500) - 1);

  if (targetSheet.rowHeights) {
    const newHeights: Record<number, number> = {};
    Object.keys(targetSheet.rowHeights).forEach((key) => {
      const r = parseInt(key, 10);
      if (r > atRow) {
        newHeights[r - 1] = targetSheet.rowHeights![r];
      } else if (r < atRow) {
        newHeights[r] = targetSheet.rowHeights![r];
      }
    });
    targetSheet.rowHeights = newHeights;
  }

  newSheets[activeIdx] = targetSheet;
  return newSheets;
};

export const deleteColumnInSheets = (prev: Sheet[], activeIdx: number, atColLetter: string): Sheet[] => {
  const atColIdx = colLetterToNumber(atColLetter);
  const newSheets = [...prev];
  const targetSheet = { ...newSheets[activeIdx] };
  const currentCells = targetSheet.cells;
  const newCells: Record<string, CellData> = {};

  Object.keys(currentCells).forEach((addr) => {
    const parsed = parseCellAddress(addr);
    if (parsed) {
      const colIdx = colLetterToNumber(parsed.col);
      if (colIdx > atColIdx) {
        const nextColLetter = numberToColLetter(colIdx - 1);
        newCells[`${nextColLetter}${parsed.row}`] = currentCells[addr];
      } else if (colIdx < atColIdx) {
        newCells[addr] = currentCells[addr];
      }
    }
  });

  targetSheet.cells = newCells;
  targetSheet.colCount = Math.max(1, (targetSheet.colCount || 26) - 1);

  if (targetSheet.colWidths) {
    const newWidths: Record<string, number> = {};
    Object.keys(targetSheet.colWidths).forEach((col) => {
      const colIdx = colLetterToNumber(col);
      if (colIdx > atColIdx) {
        newWidths[numberToColLetter(colIdx - 1)] = targetSheet.colWidths![col];
      } else if (colIdx < atColIdx) {
        newWidths[col] = targetSheet.colWidths![col];
      }
    });
    targetSheet.colWidths = newWidths;
  }

  newSheets[activeIdx] = targetSheet;
  return newSheets;
};

export const clearRowInSheets = (prev: Sheet[], activeIdx: number, atRow: number): Sheet[] => {
  const newSheets = [...prev];
  const targetSheet = { ...newSheets[activeIdx] };
  const updatedCells = { ...targetSheet.cells };

  Object.keys(updatedCells).forEach((addr) => {
    const parsed = parseCellAddress(addr);
    if (parsed && parsed.row === atRow) {
      delete updatedCells[addr];
    }
  });

  targetSheet.cells = updatedCells;
  newSheets[activeIdx] = targetSheet;
  return newSheets;
};

export const clearColumnInSheets = (prev: Sheet[], activeIdx: number, atColLetter: string): Sheet[] => {
  const newSheets = [...prev];
  const targetSheet = { ...newSheets[activeIdx] };
  const updatedCells = { ...targetSheet.cells };

  Object.keys(updatedCells).forEach((addr) => {
    const parsed = parseCellAddress(addr);
    if (parsed && parsed.col === atColLetter) {
      delete updatedCells[addr];
    }
  });

  targetSheet.cells = updatedCells;
  newSheets[activeIdx] = targetSheet;
  return newSheets;
};

export const updateRowHeightInSheets = (prev: Sheet[], activeIdx: number, rowNum: number, height: number): Sheet[] => {
  const newSheets = [...prev];
  const targetSheet = { ...newSheets[activeIdx] };
  targetSheet.rowHeights = {
    ...(targetSheet.rowHeights || {}),
    [rowNum]: height,
  };
  newSheets[activeIdx] = targetSheet;
  return newSheets;
};

export const updateColWidthInSheets = (prev: Sheet[], activeIdx: number, colLetter: string, width: number): Sheet[] => {
  const newSheets = [...prev];
  const targetSheet = { ...newSheets[activeIdx] };
  targetSheet.colWidths = {
    ...(targetSheet.colWidths || {}),
    [colLetter]: width,
  };
  newSheets[activeIdx] = targetSheet;
  return newSheets;
};

export const shiftCellsInSheets = (
  prev: Sheet[],
  activeIdx: number,
  selectedCell: string,
  direction: "down" | "right",
  rowCount: number,
  colCount: number
): Sheet[] => {
  const newSheets = [...prev];
  const targetSheet = { ...newSheets[activeIdx] };
  const newCells = { ...targetSheet.cells };
  const parsed = parseCellAddress(selectedCell);
  if (!parsed) return prev;
  const { col: colLetter, row: rowNum } = parsed;
  const colIdx = colLetterToNumber(colLetter);

  if (direction === "down") {
    for (let r = rowCount; r > rowNum; r--) {
      const aboveAddr = `${colLetter}${r - 1}`;
      const currentAddr = `${colLetter}${r}`;
      if (newCells[aboveAddr]) {
        newCells[currentAddr] = { ...newCells[aboveAddr] };
      } else {
        delete newCells[currentAddr];
      }
    }
    newCells[`${colLetter}${rowNum}`] = { value: "", formula: "" };
  } else {
    for (let c = colCount - 1; c > colIdx; c--) {
      const leftAddr = `${numberToColLetter(c - 1)}${rowNum}`;
      const currentAddr = `${numberToColLetter(c)}${rowNum}`;
      if (newCells[leftAddr]) {
        newCells[currentAddr] = { ...newCells[leftAddr] };
      } else {
        delete newCells[currentAddr];
      }
    }
    newCells[`${colLetter}${rowNum}`] = { value: "", formula: "" };
  }

  targetSheet.cells = newCells;
  newSheets[activeIdx] = targetSheet;
  return newSheets;
};

export const deleteCellsAndShiftInSheets = (
  prev: Sheet[],
  activeIdx: number,
  selectedCell: string,
  direction: "up" | "left",
  rowCount: number,
  colCount: number
): Sheet[] => {
  const newSheets = [...prev];
  const targetSheet = { ...newSheets[activeIdx] };
  const newCells = { ...targetSheet.cells };
  const parsed = parseCellAddress(selectedCell);
  if (!parsed) return prev;
  const { col: colLetter, row: rowNum } = parsed;
  const colIdx = colLetterToNumber(colLetter);

  if (direction === "up") {
    for (let r = rowNum; r < rowCount; r++) {
      const belowAddr = `${colLetter}${r + 1}`;
      const currentAddr = `${colLetter}${r}`;
      if (newCells[belowAddr]) {
        newCells[currentAddr] = { ...newCells[belowAddr] };
      } else {
        delete newCells[currentAddr];
      }
    }
    delete newCells[`${colLetter}${rowCount}`];
  } else {
    for (let c = colIdx; c < colCount - 1; c++) {
      const rightAddr = `${numberToColLetter(c + 1)}${rowNum}`;
      const currentAddr = `${numberToColLetter(c)}${rowNum}`;
      if (newCells[rightAddr]) {
        newCells[currentAddr] = { ...newCells[rightAddr] };
      } else {
        delete newCells[currentAddr];
      }
    }
    delete newCells[`${numberToColLetter(colCount - 1)}${rowNum}`];
  }

  targetSheet.cells = newCells;
  newSheets[activeIdx] = targetSheet;
  return newSheets;
};
