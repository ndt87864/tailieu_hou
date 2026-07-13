// frontend/src/utils/spreadsheetExport.ts
import * as XLSX from "xlsx";
import { parseCellAddress, colLetterToNumber, numberToColLetter } from "./formulaEvaluator.js";

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

export const exportToXlsx = (title: string, sheets: Sheet[]) => {
  const wb = XLSX.utils.book_new();
  sheets.forEach((sh) => {
    let maxR = 1;
    let maxCIdx = 0;
    Object.keys(sh.cells || {}).forEach((addr) => {
      const parsed = parseCellAddress(addr);
      if (parsed) {
        if (parsed.row > maxR) maxR = parsed.row;
        const cIdx = colLetterToNumber(parsed.col);
        if (cIdx > maxCIdx) maxCIdx = cIdx;
      }
    });
    const gridData: any[][] = [];
    for (let r = 1; r <= maxR; r++) {
      const rowArr: any[] = [];
      for (let c = 0; c <= maxCIdx; c++) {
        const colLetter = numberToColLetter(c);
        const cell = sh.cells[`${colLetter}${r}`];
        rowArr.push(cell ? cell.value || cell.formula || "" : "");
      }
      gridData.push(rowArr);
    }
    const ws = XLSX.utils.aoa_to_sheet(gridData);
    XLSX.utils.book_append_sheet(wb, ws, sh.name || "Sheet");
  });
  XLSX.writeFile(wb, `${title || "workbook"}.xlsx`);
};

export const exportToCsvOrTsv = (type: "csv" | "tsv", title: string, cells: Record<string, CellData>) => {
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

  const mimeType = type === "tsv" ? "text/tab-separated-values;charset=utf-8;" : "text/csv;charset=utf-8;";
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), contentStr], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${title || "sheet"}.${type}`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
