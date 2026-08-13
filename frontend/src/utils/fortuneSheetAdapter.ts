import { parseCellAddress, colLetterToNumber, numberToColLetter, evaluateFormula } from "./formulaEvaluator";

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
    const calcChain: any[] = [];
    
    // Create initial 2D data array filled with null
    const rowCount = sheet.rowCount || 500;
    const colCount = sheet.colCount || 26;
    const data: any[][] = [];
    for (let i = 0; i < rowCount; i++) {
      data.push(new Array(colCount).fill(null));
    }
    
    // Convert cells object to array of {r, c, v} and populate 2D array
    Object.entries(sheet.cells || {}).forEach(([address, cell]) => {
      const parsedAddr = parseCellAddress(address);
      if (!parsedAddr) return;
      
      const r = parsedAddr.row - 1; // Fortune sheet row is 0-indexed
      const c = colLetterToNumber(parsedAddr.col);
      
      const v: any = {};
      
      if (cell.formula) {
        v.f = cell.formula;
        let calculatedValue = cell.value;
        if (!calculatedValue || calculatedValue === "") {
          calculatedValue = evaluateFormula(cell.formula, sheet.cells || {});
        }
        
        if (calculatedValue !== undefined && calculatedValue !== "") {
          v.v = calculatedValue;
          v.m = String(calculatedValue);
        }
        calcChain.push({ r, c, index: index.toString() });
      } else if (cell.value !== undefined && cell.value !== "") {
        v.v = cell.value;
        v.m = String(cell.value);
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
        
        // Dynamically expand rows if necessary
        while (data.length <= r) {
           data.push(new Array(data[0]?.length || colCount).fill(null));
        }
        // Dynamically expand columns if necessary
        while (data[r].length <= c) {
           for (let i = 0; i < data.length; i++) {
               data[i].push(null);
           }
        }
        
        data[r][c] = v;
      }
    });

    return {
      name: sheet.name,
      color: "",
      index: index.toString(),
      status: index === 0 ? 1 : 0, // only first sheet is active by default
      order: index,
      data,
      celldata,
      calcChain: calcChain.length > 0 ? calcChain : undefined,
      row: data.length,
      column: data[0]?.length || 26,
    };
  });
};

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

export const convertFortuneToOldSheets = (fortuneSheets: any[]): OldSheet[] => {
  return fortuneSheets.map(sheet => {
    const cells: Record<string, OldCellData> = {};
    
    // Process a single cell value
    const processCell = (r: number, c: number, v: any) => {
      if (!v) return;

      const address = `${numberToColLetter(c)}${r + 1}`;
      const cell: OldCellData = { value: "", formula: "" };

      if (v.f) {
        cell.formula = v.f;
        cell.value = v.v !== undefined && v.v !== null ? String(v.v) : (v.m !== undefined && v.m !== null ? String(v.m) : "");
      } else {
        cell.value = v.v !== undefined && v.v !== null ? String(v.v) : (v.m !== undefined && v.m !== null ? String(v.m) : "");
      }

      if (v.bl) cell.bold = true;
      if (v.it) cell.italic = true;
      if (v.un) cell.underline = true;
      if (v.cl) cell.strikethrough = true;

      if (v.fc) cell.color = v.fc;
      if (v.bg) cell.bg = v.bg;

      if (v.ht === 1) cell.align = "left";
      if (v.ht === 0) cell.align = "center";
      if (v.ht === 2) cell.align = "right";

      if (v.ff) cell.fontFamily = v.ff;
      if (v.fs) cell.fontSize = `${v.fs}px`;

      // Only add to cells if it actually has content or formatting
      if (
        cell.value !== "" || cell.formula !== "" ||
        cell.bold || cell.italic || cell.underline || cell.strikethrough ||
        cell.color || cell.bg || cell.align || cell.fontFamily || cell.fontSize
      ) {
        cells[address] = cell;
      }
    };

    // Fortune Sheet updates `data` array in real-time when edited.
    // If it exists and has content, use it. Otherwise fallback to `celldata`.
    if (sheet.data && Array.isArray(sheet.data) && sheet.data.length > 0) {
      sheet.data.forEach((row: any[], r: number) => {
        if (!Array.isArray(row)) return;
        row.forEach((v: any, c: number) => {
          processCell(r, c, v);
        });
      });
    } else {
      const celldata = sheet.celldata || [];
      celldata.forEach((cd: any) => {
        processCell(cd.r, cd.c, cd.v);
      });
    }

    return {
      name: sheet.name,
      cells,
      rowCount: sheet.row || 500,
      colCount: sheet.column || 26,
    };
  });
};

