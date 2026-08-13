import { parseCellAddress } from "./formulaEvaluator";

// Cấu trúc dữ liệu cũ
interface OldCellData {
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
}

export interface OldSheet {
  name: string;
  cells: Record<string, OldCellData>;
  rowCount: number;
  colCount: number;
  isVip?: boolean;
}

// Chuyển đổi dữ liệu cũ sang Fortune Sheet
export const convertOldSheetsToFortune = (oldSheets: OldSheet[]): any[] => {
  return oldSheets.map((sheet, index) => {
    const celldata: any[] = [];
    
    // Convert cells object to array of {r, c, v}
    Object.entries(sheet.cells || {}).forEach(([address, cell]) => {
      const parsedAddr = parseCellAddress(address);
      if (!parsedAddr) return;
      
      const r = parsedAddr.row - 1; // Fortune sheet row is 0-indexed
      const c = colLetterToNumber(parsedAddr.col);
      
      const v: any = {};
      
      if (cell.formula) {
        v.f = cell.formula;
        v.v = cell.value;
        v.m = cell.value;
      } else if (cell.value) {
        v.v = cell.value;
        v.m = cell.value;
      }
      
      if (cell.bold) v.bl = 1;
      if (cell.italic) v.it = 1;
      if (cell.underline) v.un = 1;
      if (cell.strikethrough) v.cl = 1;
      
      if (cell.color) v.fc = cell.color;
      if (cell.bg) v.bg = cell.bg;
      
      if (cell.align === "left") v.ht = 1;
      if (cell.align === "center") v.ht = 0;
      if (cell.align === "right") v.ht = 2;
      
      if (cell.fontFamily) v.ff = cell.fontFamily;
      if (cell.fontSize) {
        // Fortune Sheet expects font size in points usually, but we'll store raw strings or numbers
        const match = cell.fontSize.match(/\d+/);
        if (match) {
          v.fs = parseInt(match[0], 10);
        }
      }

      if (Object.keys(v).length > 0) {
        celldata.push({ r, c, v });
      }
    });

    return {
      name: sheet.name,
      color: "",
      index: index.toString(),
      status: index === 0 ? 1 : 0, // only first sheet is active by default
      order: index,
      celldata,
      row: sheet.rowCount || 500,
      column: sheet.colCount || 26,
    };
  });
};

// Hàm hỗ trợ để lấy số từ cột A, B, C...
function colLetterToNumber(letter: string): number {
  let num = 0;
  for (let i = 0; i < letter.length; i++) {
    num = num * 26 + (letter.charCodeAt(i) - 64);
  }
  return num - 1;
}

// Kiểm tra xem content này là từ Fortune Sheet hay Old Sheet
export const isFortuneSheetData = (content: any): boolean => {
  if (Array.isArray(content) && content.length > 0) {
    if (content[0].celldata !== undefined || content[0].data !== undefined) return true;
  }
  
  if (content && Array.isArray(content.sheets)) {
    if (content.sheets.length > 0 && (content.sheets[0].celldata !== undefined || content.sheets[0].data !== undefined)) {
      return true;
    }
  }
  
  return false;
}
