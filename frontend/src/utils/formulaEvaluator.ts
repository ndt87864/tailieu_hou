// frontend/src/utils/formulaEvaluator.ts

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

type CellsMap = Record<string, CellData>;

export function serializeCellsToHtml(
  cells: Record<string, any>,
  minRow: number,
  maxRow: number,
  minCol: number,
  maxCol: number
): string {
  let html = `<table style="border-collapse:collapse;">`;
  for (let r = minRow; r <= maxRow; r++) {
    html += "<tr>";
    for (let c = minCol; c <= maxCol; c++) {
      const addr = `${numberToColLetter(c)}${r}`;
      const cell = cells[addr] || { value: "", formula: "" };
      
      const styles: string[] = [];
      if (cell.bold) styles.push("font-weight:bold");
      if (cell.italic) styles.push("font-style:italic");
      
      const textDecs: string[] = [];
      if (cell.underline) textDecs.push("underline");
      if (cell.strikethrough) textDecs.push("line-through");
      if (textDecs.length > 0) styles.push(`text-decoration:${textDecs.join(" ")}`);
      
      if (cell.color) styles.push(`color:${cell.color}`);
      if (cell.bg) styles.push(`background-color:${cell.bg}`);
      if (cell.align) styles.push(`text-align:${cell.align}`);
      if (cell.fontFamily) styles.push(`font-family:${cell.fontFamily}`);
      if (cell.fontSize) styles.push(`font-size:${cell.fontSize}`);
      
      const styleAttr = styles.length > 0 ? ` style="${styles.join(";")}"` : "";
      
      const dataAttrs: string[] = [];
      dataAttrs.push(`data-value="${encodeURIComponent(cell.value || "")}"`);
      dataAttrs.push(`data-formula="${encodeURIComponent(cell.formula || "")}"`);
      if (cell.bold) dataAttrs.push(`data-bold="true"`);
      if (cell.italic) dataAttrs.push(`data-italic="true"`);
      if (cell.underline) dataAttrs.push(`data-underline="true"`);
      if (cell.strikethrough) dataAttrs.push(`data-strikethrough="true"`);
      if (cell.color) dataAttrs.push(`data-color="${cell.color}"`);
      if (cell.bg) dataAttrs.push(`data-bg="${cell.bg}"`);
      if (cell.align) dataAttrs.push(`data-align="${cell.align}"`);
      if (cell.fontFamily) dataAttrs.push(`data-font-family="${cell.fontFamily}"`);
      if (cell.fontSize) dataAttrs.push(`data-font-size="${cell.fontSize}"`);
      
      html += `<td${styleAttr} ${dataAttrs.join(" ")}>${cell.value || ""}</td>`;
    }
    html += "</tr>";
  }
  html += "</table>";
  return html;
}

export function parseHtmlToCells(htmlText: string): { rows: any[][] } | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, "text/html");
    const table = doc.querySelector("table");
    if (!table) return null;
    
    const rows = table.querySelectorAll("tr");
    const gridData: any[][] = [];
    
    rows.forEach((row) => {
      const rowData: any[] = [];
      const cols = row.querySelectorAll("td");
      cols.forEach((td) => {
        const hasValAttr = td.hasAttribute("data-value");
        let value = hasValAttr ? decodeURIComponent(td.getAttribute("data-value") || "") : td.textContent || "";
        let formula = hasValAttr ? decodeURIComponent(td.getAttribute("data-formula") || "") : "";
        
        let bold = td.getAttribute("data-bold") === "true";
        let italic = td.getAttribute("data-italic") === "true";
        let underline = td.getAttribute("data-underline") === "true";
        let strikethrough = td.getAttribute("data-strikethrough") === "true";
        let color = td.getAttribute("data-color") || undefined;
        let bg = td.getAttribute("data-bg") || undefined;
        let align = (td.getAttribute("data-align") as any) || undefined;
        let fontFamily = td.getAttribute("data-font-family") || undefined;
        let fontSize = td.getAttribute("data-font-size") || undefined;
        
        if (!hasValAttr) {
          // Check bold
          if (
            td.style.fontWeight === "bold" || 
            parseInt(td.style.fontWeight, 10) >= 700 || 
            td.querySelector("b, strong")
          ) {
            bold = true;
          } else {
            const hasBoldSpan = Array.from(td.querySelectorAll("span, font, div")).some(el => {
              const style = (el as HTMLElement).style;
              return style.fontWeight === "bold" || parseInt(style.fontWeight, 10) >= 700;
            });
            if (hasBoldSpan) bold = true;
          }

          // Check italic
          if (
            td.style.fontStyle === "italic" || 
            td.querySelector("i, em")
          ) {
            italic = true;
          } else {
            const hasItalicSpan = Array.from(td.querySelectorAll("span, font, div")).some(el => {
              return (el as HTMLElement).style.fontStyle === "italic";
            });
            if (hasItalicSpan) italic = true;
          }

          // Check underline
          const tdTextDec = td.style.textDecoration || "";
          if (
            tdTextDec.includes("underline") || 
            td.querySelector("u")
          ) {
            underline = true;
          } else {
            const hasUnderlineSpan = Array.from(td.querySelectorAll("span, font, div")).some(el => {
              return ((el as HTMLElement).style.textDecoration || "").includes("underline");
            });
            if (hasUnderlineSpan) underline = true;
          }

          // Check strikethrough
          if (
            tdTextDec.includes("line-through") || 
            td.querySelector("s, strike, del")
          ) {
            strikethrough = true;
          } else {
            const hasStrikethroughSpan = Array.from(td.querySelectorAll("span, font, div")).some(el => {
              return ((el as HTMLElement).style.textDecoration || "").includes("line-through");
            });
            if (hasStrikethroughSpan) strikethrough = true;
          }

          // Check color
          if (td.style.color) {
            color = td.style.color;
          } else {
            for (const el of Array.from(td.querySelectorAll("span, font, div"))) {
              const c = (el as HTMLElement).style.color;
              if (c) {
                color = c;
                break;
              }
            }
          }

          // Check bg
          if (td.style.backgroundColor || td.style.background) {
            bg = td.style.backgroundColor || td.style.background;
          } else {
            for (const el of Array.from(td.querySelectorAll("span, font, div"))) {
              const b = (el as HTMLElement).style.backgroundColor || (el as HTMLElement).style.background;
              if (b) {
                bg = b;
                break;
              }
            }
          }

          // Check align
          if (td.style.textAlign) {
            align = td.style.textAlign as any;
          } else {
            for (const el of Array.from(td.querySelectorAll("span, div"))) {
              const a = (el as HTMLElement).style.textAlign;
              if (a) {
                align = a as any;
                break;
              }
            }
          }

          // Check fontFamily
          if (td.style.fontFamily) {
            fontFamily = td.style.fontFamily;
          } else {
            for (const el of Array.from(td.querySelectorAll("span, font, div"))) {
              const f = (el as HTMLElement).style.fontFamily;
              if (f) {
                fontFamily = f;
                break;
              }
            }
          }

          // Check fontSize
          if (td.style.fontSize) {
            fontSize = td.style.fontSize;
          } else {
            for (const el of Array.from(td.querySelectorAll("span, font, div"))) {
              const s = (el as HTMLElement).style.fontSize;
              if (s) {
                fontSize = s;
                break;
              }
            }
          }
          
          if (value.startsWith("=")) {
            formula = value;
            value = "";
          }
        }
        
        const cellObj: any = { value, formula };
        if (bold) cellObj.bold = true;
        if (italic) cellObj.italic = true;
        if (underline) cellObj.underline = true;
        if (strikethrough) cellObj.strikethrough = true;
        if (color) cellObj.color = color;
        if (bg) cellObj.bg = bg;
        if (align) cellObj.align = align;
        if (fontFamily) cellObj.fontFamily = fontFamily;
        if (fontSize) cellObj.fontSize = fontSize;
        
        rowData.push(cellObj);
      });
      gridData.push(rowData);
    });
    
    return { rows: gridData };
  } catch (e) {
    console.error("Error parsing html to cells", e);
    return null;
  }
}

// Chuyển địa chỉ ô như A1 -> { colIndex: 0, rowIndex: 0 }
export function parseCellAddress(address: string): { col: string; row: number } | null {
  const match = address.match(/^([A-Z]+)([0-9]+)$/i);
  if (!match) return null;
  return {
    col: match[1].toUpperCase(),
    row: parseInt(match[2], 10),
  };
}

// Chuyển tên cột dạng chữ (A, B, C...) thành chỉ số index (0, 1, 2...)
export function colLetterToNumber(letter: string): number {
  let num = 0;
  for (let i = 0; i < letter.length; i++) {
    num = num * 26 + (letter.charCodeAt(i) - 64);
  }
  return num - 1;
}

// Chuyển chỉ số index (0, 1, 2...) thành tên cột dạng chữ (A, B, C...)
export function numberToColLetter(num: number): string {
  let letter = "";
  let temp = num;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

// Lấy danh sách địa chỉ ô trong một vùng chọn ví dụ: A1:B3 -> A1, A2, A3, B1, B2, B3
export function getCellRange(rangeStr: string): string[] {
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
}

// Đánh giá giá trị của một ô cụ thể
export function evaluateFormula(formula: string, cells: CellsMap, visited: Set<string> = new Set()): string {
  if (!formula.startsWith("=")) {
    return formula;
  }

  // Loại bỏ dấu "=" và khoảng trắng
  const expression = formula.slice(1).trim();

  // Kiểm tra lỗi vòng lặp
  // Để tránh đệ quy vô hạn khi các ô tham chiếu chéo nhau.

  try {
    // 1. Phân tích các hàm toán học: SUM, AVERAGE, MIN, MAX, COUNT
    const functionRegex = /^(SUM|AVERAGE|MIN|MAX|COUNT)\(([^)]+)\)$/i;
    const funcMatch = expression.match(functionRegex);

    if (funcMatch) {
      const funcName = funcMatch[1].toUpperCase();
      const rangeArg = funcMatch[2].trim();
      const targetCells = rangeArg.includes(":") ? getCellRange(rangeArg) : [rangeArg];

      const values = targetCells.map((addr) => {
        if (visited.has(addr)) return 0; // Tránh vòng lặp
        const cell = cells[addr];
        if (!cell) return 0;
        
        const nextVisited = new Set(visited).add(addr);
        const evaluatedVal = evaluateFormula(cell.formula || cell.value, cells, nextVisited);
        const num = parseFloat(evaluatedVal);
        return isNaN(num) ? 0 : num;
      });

      switch (funcName) {
        case "SUM":
          return values.reduce((sum, v) => sum + v, 0).toString();
        case "AVERAGE":
          return values.length ? (values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(2) : "0";
        case "MIN":
          return values.length ? Math.min(...values).toString() : "0";
        case "MAX":
          return values.length ? Math.max(...values).toString() : "0";
        case "COUNT":
          return targetCells.filter((addr) => {
            const cell = cells[addr];
            if (!cell) return false;
            const evaluatedVal = evaluateFormula(cell.formula || cell.value, cells, new Set(visited).add(addr));
            return !isNaN(parseFloat(evaluatedVal)) && evaluatedVal.trim() !== "";
          }).length.toString();
        default:
          return "#ERROR!";
      }
    }

    // 2. Phép tính cơ bản (+, -, *, /) và các tham chiếu trực tiếp đến các ô đơn lẻ
    // Thay thế các mã ô (như A1, B5) bằng giá trị số của chúng
    let evaluatedExpr = expression;
    const cellRefRegex = /[A-Z]+[0-9]+/g;
    let match;
    const refs = new Set<string>();

    while ((match = cellRefRegex.exec(expression)) !== null) {
      refs.add(match[0]);
    }

    for (const ref of refs) {
      if (visited.has(ref)) {
        return "#CYCLE!";
      }
      const cell = cells[ref];
      let val = "0";
      if (cell) {
        const nextVisited = new Set(visited).add(ref);
        val = evaluateFormula(cell.formula || cell.value, cells, nextVisited);
      }
      const numVal = parseFloat(val);
      const replacement = isNaN(numVal) ? "0" : numVal.toString();
      // Thay thế chính xác tên ô bằng giá trị của nó
      evaluatedExpr = evaluatedExpr.replace(new RegExp(`\\b${ref}\\b`, "g"), replacement);
    }

    // Đánh giá biểu thức số học
    // An toàn hơn eval: Chỉ cho phép số, khoảng trắng và các ký tự toán học
    if (!/^[0-9.+\-*/() ]+$/.test(evaluatedExpr)) {
      return "#VALUE!";
    }

    // Sử dụng hàm Function để đánh giá chuỗi biểu thức toán học
    const result = new Function(`return (${evaluatedExpr})`)();
    return typeof result === "number" ? (Number.isInteger(result) ? result.toString() : result.toFixed(2)) : "#ERROR!";
  } catch (err) {
    console.error("Formula parsing error:", err);
    return "#ERROR!";
  }
}
